// ═══════════════════════════════════════════════════════════════
//  LSP BRIDGE — src/main/lsp-bridge.js
//  Spawns and manages Language Server Protocol servers.
//  Routes JSON-RPC 2.0 messages between renderer and servers.
//
//  Channels: both legacy (lsp:*) and noter-namespace (noter:lsp:*)
//  are registered so old renderer code keeps working while new
//  code migrates to window.noter.lsp.*.
// ═══════════════════════════════════════════════════════════════
'use strict';

const { ipcMain } = require('electron');
const { spawn }   = require('child_process');
const path        = require('path');
const fs          = require('fs');
const os          = require('os');

// ── LSP Server configurations ─────────────────────────────────
const SERVER_CONFIGS = {
  // TypeScript/JavaScript — typescript-language-server wraps tsserver
  typescript: {
    id:    'typescript',
    name:  'TypeScript Language Server',
    langs: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
    commands: [
      // 1. Workspace-local install (most reliable — versions match the project)
      () => {
        const ext  = process.platform === 'win32' ? '.cmd' : '';
        const local = path.join(process.cwd(), 'node_modules', '.bin', `typescript-language-server${ext}`);
        return fs.existsSync(local) ? [local, ['--stdio']] : null;
      },
      // 2. Global PATH install
      () => {
        const bins = process.platform === 'win32'
          ? ['typescript-language-server.cmd', 'typescript-language-server']
          : ['typescript-language-server'];
        for (const b of bins) {
          try {
            require('child_process').execSync(
              process.platform === 'win32' ? `where ${b}` : `which ${b}`,
              { stdio: 'ignore' }
            );
            return [b, ['--stdio']];
          } catch { continue; }
        }
        return null;
      },
      // 3. Bundled alongside the app (optional — for packaged releases)
      () => {
        const bundled = path.join(__dirname, '..', '..', 'node_modules', '.bin',
          process.platform === 'win32' ? 'typescript-language-server.cmd' : 'typescript-language-server');
        return fs.existsSync(bundled) ? [bundled, ['--stdio']] : null;
      },
    ],
    installHint: 'npm install -g typescript-language-server typescript',
  },

  pyright: {
    id:    'pyright',
    name:  'Pyright (Python)',
    langs: ['python'],
    commands: [
      () => {
        const local = path.join(process.cwd(), 'node_modules', '.bin', 'pyright-langserver');
        return fs.existsSync(local) ? [local, ['--stdio']] : null;
      },
      () => [
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['--yes', 'pyright', '--langserver', '--stdio'],
      ],
      () => {
        const bins = process.platform === 'win32'
          ? ['pyright-langserver.exe', 'pyright-langserver']
          : ['pyright-langserver'];
        for (const b of bins) {
          try {
            require('child_process').execSync(`where ${b}`, { stdio: 'ignore' });
            return [b, ['--stdio']];
          } catch { continue; }
        }
        return null;
      },
    ],
    installHint: 'npm install -g pyright  OR  pip install python-lsp-server',
  },

  clangd: {
    id:    'clangd',
    name:  'clangd (C/C++)',
    langs: ['c', 'cpp', 'cuda-cpp'],
    commands: [
      () => {
        const bins = ['clangd-18', 'clangd-17', 'clangd-16', 'clangd-15', 'clangd'];
        for (const b of bins) {
          try {
            require('child_process').execSync(
              process.platform === 'win32' ? `where ${b}` : `which ${b}`,
              { stdio: 'ignore' }
            );
            return [b, ['--background-index', '--clang-tidy',
                        '--completion-style=detailed', '--function-arg-placeholders']];
          } catch { continue; }
        }
        return null;
      },
    ],
    installHint: 'Install LLVM/clang: https://releases.llvm.org/',
  },

  jdtls: {
    id:    'jdtls',
    name:  'Eclipse JDT LS (Java)',
    langs: ['java'],
    commands: [
      () => {
        const jdtls = process.env.JDTLS_HOME
          ? path.join(process.env.JDTLS_HOME, 'bin', 'jdtls')
          : null;
        return jdtls && fs.existsSync(jdtls) ? [jdtls, []] : null;
      },
    ],
    installHint: 'Install Eclipse JDT LS: https://github.com/eclipse-jdtls/eclipse.jdt.ls',
  },
};

// ── Server instance state ─────────────────────────────────────
const _servers = new Map(); // serverId → ServerInstance

class ServerInstance {
  constructor(config) {
    this.config   = config;
    this.process  = null;
    this.state    = 'stopped'; // stopped | starting | running | not_found | error
    this.error    = null;
    this.pid      = null;
    this._buf     = '';
    this._pending = new Map(); // requestId → { resolve, reject, timer }
    this._seq     = 1;
    this._win     = null;
  }

  _resolveCommand() {
    for (const cmdFn of (this.config.commands || [])) {
      try {
        const result = cmdFn();
        if (result) return result;
      } catch {}
    }
    return null;
  }

  start(win) {
    if (this.state === 'running' || this.state === 'starting') return true;

    const cmd = this._resolveCommand();
    if (!cmd) {
      this.state = 'not_found';
      this.error = `${this.config.name} not found. ${this.config.installHint || ''}`;
      return false;
    }

    this._win  = win;
    this.state = 'starting';
    this._buf  = '';

    const [bin, args] = cmd;
    try {
      this.process = spawn(bin, args, {
        cwd:   win?.workspaceRoot || os.homedir(),
        env:   { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      this.state = 'error';
      this.error = err.message;
      return false;
    }

    this.pid = this.process.pid;

    this.process.stdout.on('data', (chunk) => {
      this._buf += chunk.toString();
      this._parseMessages();
    });

    this.process.stderr.on('data', (d) => {
      // LSP servers write verbose logs to stderr — not fatal
      const msg = d.toString().slice(0, 300);
      if (!msg.includes('[Info]') && !msg.includes('[Trace]')) {
        console.log(`[LSP:${this.config.id}] stderr:`, msg);
      }
    });

    this.process.on('exit', (code) => {
      console.log(`[LSP:${this.config.id}] exited with code`, code);
      this.state   = 'stopped';
      this.process = null;
      this.pid     = null;
      // Reject all pending requests
      for (const [id, { reject, timer }] of this._pending) {
        clearTimeout(timer);
        reject(new Error(`Server ${this.config.id} exited`));
      }
      this._pending.clear();
      this._pushState('stopped');
    });

    this.process.on('error', (err) => {
      this.state = 'error';
      this.error = err.message;
      this._pushState('error', err.message);
    });

    this.state = 'running';
    this._pushState('running');
    return true;
  }

  _parseMessages() {
    while (true) {
      const headerEnd = this._buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header   = this._buf.slice(0, headerEnd);
      const lenMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lenMatch) { this._buf = this._buf.slice(headerEnd + 4); continue; }

      const len  = parseInt(lenMatch[1], 10);
      const body = this._buf.slice(headerEnd + 4);
      if (body.length < len) break;

      const msg  = body.slice(0, len);
      this._buf  = body.slice(len);

      try {
        this._handleMessage(JSON.parse(msg));
      } catch (e) {
        console.warn('[LSP] parse error:', e.message);
      }
    }
  }

  _handleMessage(msg) {
    if (msg.id !== undefined && this._pending.has(msg.id)) {
      const { resolve, reject, timer } = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      clearTimeout(timer);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else {
      // Notification or server-initiated request → push to renderer
      this._pushMessage(msg);
    }
  }

  send(message) {
    if (!this.process?.stdin?.writable) return;
    const json   = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    this.process.stdin.write(header + json);
  }

  request(method, params) {
    return new Promise((resolve, reject) => {
      const id    = this._seq++;
      const timer = setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new Error(`LSP request timeout: ${method}`));
        }
      }, 10_000);
      this._pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  stop() {
    if (!this.process) return;
    try {
      this.send({ jsonrpc: '2.0', id: this._seq++, method: 'shutdown', params: null });
      this.send({ jsonrpc: '2.0', method: 'exit' });
      setTimeout(() => { try { this.process?.kill(); } catch {} }, 2000);
    } catch {}
  }

  health() {
    return {
      id:           this.config.id,
      name:         this.config.name,
      state:        this.state,
      pid:          this.pid,
      error:        this.error,
      pending:      this._pending.size,
      installHint:  this.config.installHint,
    };
  }

  // ── Push helpers ──────────────────────────────────────────────

  _pushState(state, error = null) {
    const data = { id: this.config.id, name: this.config.name, state, error };
    try { this._win?.webContents?.send('lsp:server-status', data); } catch {}
    try { this._win?.webContents?.send('noter:lsp:server-status', data); } catch {}
  }

  _pushMessage(msg) {
    const data = { server: this.config.id, message: msg };
    try { this._win?.webContents?.send('lsp:message', data); } catch {}
    try { this._win?.webContents?.send('noter:lsp:message', data); } catch {}
  }
}

// ── Shared handler logic ──────────────────────────────────────
// Extracted so both lsp:* and noter:lsp:* channels call the same code.

async function _handleStart(serverId, mainWindow) {
  const config = SERVER_CONFIGS[serverId];
  if (!config) return { ok: false, error: `Unknown server: ${serverId}` };

  if (!_servers.has(serverId)) {
    _servers.set(serverId, new ServerInstance(config));
  }
  const inst = _servers.get(serverId);
  const ok   = inst.start(mainWindow);
  return { ok, state: inst.state, pid: inst.pid, error: inst.error };
}

async function _handleStop(serverId) {
  _servers.get(serverId)?.stop();
  return { ok: true };
}

async function _handleRequest(serverId, method, params) {
  const inst = _servers.get(serverId);
  if (!inst || inst.state !== 'running') {
    return { error: `Server ${serverId} not running (state: ${inst?.state ?? 'none'})` };
  }
  try {
    const result = await inst.request(method, params);
    return { result };
  } catch (err) {
    return { error: err.message };
  }
}

function _handleNotify(serverId, method, params) {
  _servers.get(serverId)?.notify(method, params);
}

async function _handleStatus() {
  const statuses = {};
  for (const [id, config] of Object.entries(SERVER_CONFIGS)) {
    const inst = _servers.get(id);
    statuses[id] = inst ? inst.health() : {
      id, name: config.name, state: 'stopped', pid: null, error: null,
      pending: 0, installHint: config.installHint,
    };
  }
  return statuses;
}

async function _handleDetect() {
  const available = {};
  for (const [id, config] of Object.entries(SERVER_CONFIGS)) {
    const probe = new ServerInstance(config);
    available[id] = !!probe._resolveCommand();
  }
  return available;
}

// ── IPC Handler registration ──────────────────────────────────
function registerHandlers(mainWindow) {
  // Register both channel families. Old renderer code uses lsp:* (no break).
  // New code (window.noter.lsp.*) uses noter:lsp:* channels.

  const channels = [
    ['lsp:start',   'noter:lsp:start'],
    ['lsp:stop',    'noter:lsp:stop'],
    ['lsp:request', 'noter:lsp:request'],
    ['lsp:status',  'noter:lsp:status'],
    ['lsp:detect',  'noter:lsp:detect'],
  ];

  // ── handle channels (request/response) ───────────────────────

  for (const [legacy, noter] of channels) {
    // start
    if (legacy === 'lsp:start') {
      for (const ch of [legacy, noter]) {
        ipcMain.handle(ch, async (_e, arg) => {
          const serverId = typeof arg === 'string' ? arg : arg?.server_id;
          return _handleStart(serverId, mainWindow);
        });
      }
    }
    // stop
    if (legacy === 'lsp:stop') {
      for (const ch of [legacy, noter]) {
        ipcMain.handle(ch, async (_e, arg) => {
          const serverId = typeof arg === 'string' ? arg : arg?.server_id;
          return _handleStop(serverId);
        });
      }
    }
    // request
    if (legacy === 'lsp:request') {
      for (const ch of [legacy, noter]) {
        ipcMain.handle(ch, async (_e, { serverId, method, params }) => {
          return _handleRequest(serverId, method, params);
        });
      }
    }
    // status
    if (legacy === 'lsp:status') {
      for (const ch of [legacy, noter]) {
        ipcMain.handle(ch, async () => _handleStatus());
      }
    }
    // detect
    if (legacy === 'lsp:detect') {
      for (const ch of [legacy, noter]) {
        ipcMain.handle(ch, async () => _handleDetect());
      }
    }
  }

  // ── fire-and-forget (notify) ──────────────────────────────────
  for (const ch of ['lsp:notify', 'noter:lsp:notify']) {
    ipcMain.on(ch, (_e, { serverId, method, params }) => {
      _handleNotify(serverId, method, params);
    });
  }
}

module.exports = { registerHandlers, SERVER_CONFIGS };
