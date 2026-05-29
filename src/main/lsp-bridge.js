// ═══════════════════════════════════════════════════════════════
//  LSP BRIDGE — src/main/lsp-bridge.js
//  Spawns and manages Language Server Protocol servers.
//  Routes JSON-RPC 2.0 messages between renderer and servers.
//  Loaded by main.js; exposes IPC handlers to renderer via preload.
// ═══════════════════════════════════════════════════════════════
'use strict';

const { ipcMain } = require('electron');
const { spawn }   = require('child_process');
const path        = require('path');
const fs          = require('fs');
const os          = require('os');

// ── LSP Server configurations ─────────────────────────────────
const SERVER_CONFIGS = {
  typescript: {
    id:       'typescript',
    name:     'TypeScript Language Server',
    langs:    ['javascript','typescript','javascriptreact','typescriptreact'],
    // Monaco has built-in tsserver via TypeScript worker — no external process needed
    builtin:  true,
  },
  pyright: {
    id:       'pyright',
    name:     'Pyright (Python)',
    langs:    ['python'],
    builtin:  false,
    // Try to find pyright in several locations
    commands: [
      () => { // via npm local install
        const local = path.join(process.cwd(), 'node_modules', '.bin', 'pyright-langserver');
        return fs.existsSync(local) ? [local, ['--stdio']] : null;
      },
      () => { // via npx (global)
        return [process.platform === 'win32' ? 'npx.cmd' : 'npx',
                ['--yes', 'pyright', '--langserver', '--stdio']];
      },
      () => { // system pyright
        const bins = process.platform === 'win32'
          ? ['pyright-langserver.exe','pyright-langserver']
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
    id:       'clangd',
    name:     'clangd (C/C++)',
    langs:    ['c','cpp','cuda-cpp'],
    builtin:  false,
    commands: [
      () => {
        const bins = ['clangd-18','clangd-17','clangd-16','clangd-15','clangd'];
        for (const b of bins) {
          try {
            require('child_process').execSync(
              process.platform === 'win32' ? `where ${b}` : `which ${b}`,
              { stdio: 'ignore' }
            );
            return [b, ['--background-index','--clang-tidy',
                        '--completion-style=detailed','--function-arg-placeholders']];
          } catch { continue; }
        }
        return null;
      },
    ],
    installHint: 'Install LLVM/clang: https://releases.llvm.org/',
  },
  jdtls: {
    id:       'jdtls',
    name:     'Eclipse JDT LS (Java)',
    langs:    ['java'],
    builtin:  false,
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
    this.state    = 'stopped'; // stopped | starting | running | error
    this.error    = null;
    this._buf     = '';
    this._pending = new Map(); // requestId → { resolve, reject }
    this._seq     = 1;
    this._win     = null; // BrowserWindow reference for sending responses
    this._msgListeners = [];
  }

  // ── Resolve command ─────────────────────────────────────────
  _resolveCommand() {
    if (this.config.builtin) return null;
    for (const cmdFn of (this.config.commands || [])) {
      try {
        const result = cmdFn();
        if (result) return result;
      } catch {}
    }
    return null;
  }

  // ── Start server ────────────────────────────────────────────
  start(win) {
    if (this.state === 'running' || this.state === 'starting') return true;
    const cmd = this._resolveCommand();
    if (!cmd) {
      this.state = 'not_found';
      this.error = `${this.config.name} not found. ${this.config.installHint || ''}`;
      return false;
    }

    this._win   = win;
    this.state  = 'starting';
    this._buf   = '';

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

    // ── stdout: parse LSP messages ─────────────────────────────
    this.process.stdout.on('data', (chunk) => {
      this._buf += chunk.toString();
      this._parseMessages();
    });

    this.process.stderr.on('data', (d) => {
      // Language servers write logs/errors to stderr — don't treat as fatal
      console.log(`[LSP:${this.config.id}] stderr:`, d.toString().slice(0, 200));
    });

    this.process.on('exit', (code) => {
      console.log(`[LSP:${this.config.id}] exited with code`, code);
      this.state   = 'stopped';
      this.process = null;
      this._notify('lsp:server-status', { id: this.config.id, state: 'stopped' });
    });

    this.process.on('error', (err) => {
      this.state = 'error';
      this.error = err.message;
      this._notify('lsp:server-status', { id: this.config.id, state: 'error', error: err.message });
    });

    this.state = 'running';
    this._notify('lsp:server-status', { id: this.config.id, state: 'running', name: this.config.name });
    return true;
  }

  // ── Parse LSP messages from stdout buffer ───────────────────
  _parseMessages() {
    while (true) {
      const headerEnd = this._buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header  = this._buf.slice(0, headerEnd);
      const lenMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lenMatch) { this._buf = this._buf.slice(headerEnd + 4); continue; }

      const len  = parseInt(lenMatch[1], 10);
      const body = this._buf.slice(headerEnd + 4);
      if (body.length < len) break; // wait for more data

      const msg = body.slice(0, len);
      this._buf = body.slice(len);

      try {
        const parsed = JSON.parse(msg);
        this._handleMessage(parsed);
      } catch (e) {
        console.warn('[LSP] parse error:', e.message);
      }
    }
  }

  _handleMessage(msg) {
    if (msg.id !== undefined && this._pending.has(msg.id)) {
      // Response to our request
      const { resolve, reject } = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else {
      // Notification or server-initiated request → forward to renderer
      this._notify('lsp:message', { server: this.config.id, message: msg });
    }
  }

  // ── Send LSP message ─────────────────────────────────────────
  send(message) {
    if (!this.process?.stdin?.writable) return;
    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    this.process.stdin.write(header + json);
  }

  // ── Request with response ────────────────────────────────────
  request(method, params) {
    return new Promise((resolve, reject) => {
      const id = this._seq++;
      this._pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
      // Timeout after 10s
      setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new Error(`LSP request timeout: ${method}`));
        }
      }, 10000);
    });
  }

  // ── Notification (no response expected) ─────────────────────
  notify(method, params) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  // ── Stop server ─────────────────────────────────────────────
  stop() {
    if (!this.process) return;
    try {
      this.send({ jsonrpc: '2.0', id: this._seq++, method: 'shutdown', params: null });
      this.send({ jsonrpc: '2.0', method: 'exit' });
      setTimeout(() => { try { this.process?.kill(); } catch {} }, 2000);
    } catch {}
  }

  // ── Send event to renderer ───────────────────────────────────
  _notify(channel, data) {
    try { this._win?.webContents?.send(channel, data); } catch {}
  }
}

// ── IPC Handler registration ──────────────────────────────────
function registerHandlers(mainWindow) {
  // Initialize a server for a language
  ipcMain.handle('lsp:start', async (_e, serverId) => {
    const config = SERVER_CONFIGS[serverId];
    if (!config) return { ok: false, error: `Unknown server: ${serverId}` };
    if (config.builtin) return { ok: true, builtin: true };

    if (!_servers.has(serverId)) {
      _servers.set(serverId, new ServerInstance(config));
    }
    const inst = _servers.get(serverId);
    const ok   = inst.start(mainWindow);
    return { ok, state: inst.state, error: inst.error };
  });

  // Stop a server
  ipcMain.handle('lsp:stop', async (_e, serverId) => {
    _servers.get(serverId)?.stop();
    return { ok: true };
  });

  // Send a message to a server — returns the response
  ipcMain.handle('lsp:request', async (_e, { serverId, method, params }) => {
    const inst = _servers.get(serverId);
    if (!inst || inst.state !== 'running') {
      return { error: `Server ${serverId} not running` };
    }
    try {
      const result = await inst.request(method, params);
      return { result };
    } catch (err) {
      return { error: err.message };
    }
  });

  // Send a notification (no response)
  ipcMain.on('lsp:notify', (_e, { serverId, method, params }) => {
    _servers.get(serverId)?.notify(method, params);
  });

  // Get all server statuses
  ipcMain.handle('lsp:status', async () => {
    const statuses = {};
    for (const [id, config] of Object.entries(SERVER_CONFIGS)) {
      if (config.builtin) {
        statuses[id] = { id, name: config.name, state: 'builtin', langs: config.langs };
      } else {
        const inst = _servers.get(id);
        statuses[id] = {
          id, name: config.name, langs: config.langs,
          state: inst?.state || 'stopped',
          error: inst?.error || null,
          installHint: config.installHint,
        };
      }
    }
    return statuses;
  });

  // Detect which servers are available (command resolves)
  ipcMain.handle('lsp:detect', async () => {
    const available = {};
    for (const [id, config] of Object.entries(SERVER_CONFIGS)) {
      if (config.builtin) { available[id] = true; continue; }
      const inst = new ServerInstance(config);
      available[id] = !!inst._resolveCommand();
    }
    return available;
  });
}

module.exports = { registerHandlers, SERVER_CONFIGS };
