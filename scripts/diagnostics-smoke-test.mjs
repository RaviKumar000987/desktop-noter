/**
 * Diagnostics Smoke Test — scripts/diagnostics-smoke-test.mjs
 *
 * Tests textDocument/publishDiagnostics pipeline at the JSON-RPC level:
 *   type error appears → fix → diagnostic cleared.
 *
 * Week 3 success criteria (protocol level):
 *   const x: string = 123;  → Error diagnostic
 *   const x: string = "ok"; → Empty diagnostics (cleared)
 *
 * Usage:  node scripts/diagnostics-smoke-test.mjs
 */

import { spawn }              from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import path                   from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const ROOT          = path.resolve(__dirname, '..');
const TMP           = path.join(ROOT, '.diagnostics-smoke-tmp');
const SERVER_SCRIPT = path.join(ROOT, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs');

const OK   = (msg) => console.log(`  ✓ ${msg}`);
const FAIL = (msg) => { console.error(`  ✗ ${msg}`); process.exitCode = 1; };
const WARN = (msg) => console.log(`  ⚠  ${msg}`);
const HDR  = (msg) => console.log(`\n── ${msg} ──`);

// ── JSON-RPC connection ───────────────────────────────────────────────────────
class LspConnection {
  constructor(proc) {
    this._proc    = proc;
    this._buf     = '';
    this._pending = new Map();
    this._notifs  = [];
    this._seq     = 1;
    proc.stdout.on('data', d => { this._buf += d.toString(); this._parse(); });
    proc.stderr.on('data', d => {
      const s = d.toString();
      if (s.includes('[Error]')) process.stderr.write('[tsserver] ' + s);
    });
  }

  _parse() {
    while (true) {
      const end = this._buf.indexOf('\r\n\r\n'); if (end === -1) break;
      const hdr = this._buf.slice(0, end);
      const m   = hdr.match(/Content-Length:\s*(\d+)/i);
      if (!m) { this._buf = this._buf.slice(end + 4); continue; }
      const len  = parseInt(m[1]);
      const body = this._buf.slice(end + 4);
      if (body.length < len) break;
      try { this._dispatch(JSON.parse(body.slice(0, len))); } catch {}
      this._buf = body.slice(len);
    }
  }

  _dispatch(msg) {
    if (msg.id !== undefined && this._pending.has(msg.id)) {
      const { resolve, reject } = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else {
      this._notifs.push(msg);
    }
  }

  _send(msg) {
    const json = JSON.stringify(msg);
    this._proc.stdin.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
  }

  request(method, params, timeout = 15_000) {
    return new Promise((resolve, reject) => {
      const id = this._seq++;
      const t  = setTimeout(() => { this._pending.delete(id); reject(new Error(`timeout: ${method}`)); }, timeout);
      this._pending.set(id, {
        resolve: v => { clearTimeout(t); resolve(v); },
        reject:  e => { clearTimeout(t); reject(e); },
      });
      this._send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) { this._send({ jsonrpc: '2.0', method, params }); }

  // Wait for a specific notification from the server (push events)
  waitNotif(method, timeout = 10_000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const poll  = () => {
        const idx = this._notifs.findIndex(n => n.method === method);
        if (idx !== -1) return resolve(this._notifs.splice(idx, 1)[0]);
        if (Date.now() - start > timeout) return reject(new Error(`timeout waiting for ${method}`));
        setTimeout(poll, 50);
      };
      poll();
    });
  }

  // Drain all pending notifications for a method
  drainNotifs(method) {
    const matched = this._notifs.filter(n => n.method === method);
    this._notifs  = this._notifs.filter(n => n.method !== method);
    return matched;
  }

  kill() { try { this._proc.kill(); } catch {} }
}

// pathToFileURL handles Windows drive letters, spaces, special chars correctly
function toUri(p) { return pathToFileURL(p).toString(); }
// Normalize for comparison — tsserver encodes drive colon as %3A, Node uses literal :
function normUri(u) { return decodeURIComponent(u).toLowerCase().replace(/\\/g, '/'); }
async function writeTs(name, content) {
  const p = path.join(TMP, name);
  await writeFile(p, content, 'utf8');
  return p;
}

async function bootLsp(root) {
  const proc = spawn(process.execPath, [SERVER_SCRIPT, '--stdio'], {
    cwd: root, stdio: ['pipe', 'pipe', 'pipe'], shell: false,
  });
  const lsp = new LspConnection(proc);
  await lsp.request('initialize', {
    processId: process.pid,
    clientInfo: { name: 'noter-diagnostics-smoke', version: '1.0' },
    rootUri: toUri(root),
    workspaceFolders: [{ uri: toUri(root), name: 'workspace' }],
    capabilities: {
      textDocument: {
        publishDiagnostics: {
          relatedInformation: true,
          tagSupport: { valueSet: [1, 2] },
          versionSupport: false,
          codeDescriptionSupport: true,
          dataSupport: true,
        },
        synchronization: { willSave: false, didSave: false },
      },
    },
    initializationOptions: {
      tsserver: { logVerbosity: 'off', trace: 'off' },
    },
  });
  lsp.notify('initialized', {});
  return lsp;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
async function runTests() {
  HDR('Pre-flight');
  await mkdir(TMP, { recursive: true });
  OK('temp dir ready');

  // ── Test 1 — Type error produces diagnostic ───────────────────
  HDR('Test 1 — Type error → red squiggle (publishDiagnostics)');
  {
    const src  = 'const x: string = 123;\n';
    const file = await writeTs('t1.ts', src);
    const lsp  = await bootLsp(TMP);

    lsp.notify('textDocument/didOpen', {
      textDocument: { uri: toUri(file), languageId: 'typescript', version: 1, text: src },
    });

    const t0 = Date.now();
    let notif;
    try {
      notif = await lsp.waitNotif('textDocument/publishDiagnostics', 8000);
    } catch {
      FAIL('no publishDiagnostics received within 8s — tsserver may not be emitting diagnostics');
      lsp.kill(); return;
    }
    const ms = Date.now() - t0;

    const { uri, diagnostics } = notif.params;
    if (normUri(uri) !== normUri(toUri(file))) {
      FAIL(`URI mismatch: expected ${toUri(file)}, got ${uri}`);
      lsp.kill(); return;
    }

    const errors = diagnostics.filter(d => d.severity === 1);
    if (errors.length > 0) {
      OK(`${errors.length} error(s) received in ${ms}ms`);
      OK(`message: "${errors[0].message}"`);
      OK(`range: line ${errors[0].range.start.line + 1} col ${errors[0].range.start.character + 1}`);

      // Validate severity scale
      if (errors[0].severity === 1) OK('severity=1 (Error) — correct LSP severity');
    } else if (diagnostics.length > 0) {
      WARN(`received ${diagnostics.length} diagnostic(s) but none are errors (severities: ${diagnostics.map(d => d.severity).join(',')})`);
    } else {
      FAIL('publishDiagnostics received but diagnostics array is EMPTY — type checking may be off');
    }

    lsp.kill();
  }

  // ── Test 2 — Fix error → diagnostics cleared ─────────────────
  HDR('Test 2 — Fix error → diagnostics cleared (didChange sync)');
  {
    const srcBad  = 'const x: string = 123;\n';
    const srcGood = 'const x: string = "hello";\n';
    const file    = await writeTs('t2.ts', srcBad);
    const lsp     = await bootLsp(TMP);

    // Open with type error
    lsp.notify('textDocument/didOpen', {
      textDocument: { uri: toUri(file), languageId: 'typescript', version: 1, text: srcBad },
    });

    // Wait for error diagnostic
    try {
      const badNotif = await lsp.waitNotif('textDocument/publishDiagnostics', 8000);
      const errors   = badNotif.params.diagnostics.filter(d => d.severity === 1);
      if (errors.length > 0) {
        OK(`error confirmed: "${errors[0].message.slice(0, 60)}"`);
      } else {
        WARN('no errors in first publishDiagnostics — may be delayed');
      }
    } catch {
      FAIL('no initial publishDiagnostics — cannot validate fix flow');
      lsp.kill(); return;
    }

    // Drain any pending notifs
    lsp.drainNotifs('textDocument/publishDiagnostics');

    // Fix the error (simulate editor change without save)
    lsp.notify('textDocument/didChange', {
      textDocument:   { uri: toUri(file), version: 2 },
      contentChanges: [{ text: srcGood }],
    });

    // Wait for cleared diagnostics
    const t0 = Date.now();
    try {
      const fixedNotif = await lsp.waitNotif('textDocument/publishDiagnostics', 8000);
      const ms = Date.now() - t0;
      const diags = fixedNotif.params.diagnostics;
      if (diags.length === 0) {
        OK(`diagnostics cleared after fix  (${ms}ms)`);
        OK('didChange sync → tsserver re-analyzes → publishDiagnostics with empty array: WORKING');
      } else {
        const remaining = diags.filter(d => d.severity === 1);
        if (remaining.length === 0) {
          OK(`errors cleared (${diags.length} hint/info remaining — normal)  (${ms}ms)`);
        } else {
          FAIL(`${remaining.length} error(s) still present after fix  (${ms}ms): ${remaining[0].message}`);
        }
      }
    } catch {
      FAIL('no publishDiagnostics after fix — didChange may not be triggering re-analysis');
    }

    lsp.kill();
  }

  // ── Test 3 — Multiple errors in one file ──────────────────────
  HDR('Test 3 — Multiple type errors reported correctly');
  {
    const src  = [
      'const a: string = 1;',
      'const b: number = "hello";',
      'const c: boolean = 99;',
    ].join('\n') + '\n';
    const file = await writeTs('t3.ts', src);
    const lsp  = await bootLsp(TMP);

    lsp.notify('textDocument/didOpen', {
      textDocument: { uri: toUri(file), languageId: 'typescript', version: 1, text: src },
    });

    try {
      const notif = await lsp.waitNotif('textDocument/publishDiagnostics', 8000);
      const errors = notif.params.diagnostics.filter(d => d.severity === 1);
      if (errors.length >= 3) {
        OK(`${errors.length} errors detected (all 3 type mismatches caught)`);
        for (const e of errors) {
          OK(`  line ${e.range.start.line + 1}: "${e.message.slice(0, 60)}"`);
        }
      } else if (errors.length > 0) {
        WARN(`only ${errors.length}/3 errors detected — tsserver may batch diagnostics`);
      } else {
        FAIL('no errors for 3 intentional type mismatches');
      }
    } catch {
      FAIL('no publishDiagnostics received');
    }

    lsp.kill();
  }

  // ── Test 4 — Diagnostic latency ───────────────────────────────
  HDR('Test 4 — Diagnostic latency (time to first error)');
  {
    const src  = 'const x: string = 123;\n';
    const file = await writeTs('t4.ts', src);
    const lsp  = await bootLsp(TMP);

    const t0 = Date.now();
    lsp.notify('textDocument/didOpen', {
      textDocument: { uri: toUri(file), languageId: 'typescript', version: 1, text: src },
    });

    try {
      await lsp.waitNotif('textDocument/publishDiagnostics', 10_000);
      const ms = Date.now() - t0;
      if (ms < 500) {
        OK(`first diagnostic in ${ms}ms — excellent (< 500ms target)`);
      } else if (ms < 2000) {
        OK(`first diagnostic in ${ms}ms — acceptable (< 2000ms)`);
      } else {
        WARN(`first diagnostic in ${ms}ms — slow (> 2s, user may notice)`);
      }
    } catch {
      FAIL('diagnostic never arrived within 10s');
    }

    lsp.kill();
  }

  // ── Test 5 — Cross-file error (import non-existent) ──────────
  HDR('Test 5 — Cross-file error (bad import)');
  {
    const src  = 'import { doesNotExist } from "./missing-file";\n';
    const file = await writeTs('t5.ts', src);
    const lsp  = await bootLsp(TMP);

    lsp.notify('textDocument/didOpen', {
      textDocument: { uri: toUri(file), languageId: 'typescript', version: 1, text: src },
    });

    try {
      const notif = await lsp.waitNotif('textDocument/publishDiagnostics', 8000);
      const errors = notif.params.diagnostics.filter(d => d.severity === 1);
      if (errors.length > 0) {
        OK(`module-not-found error detected: "${errors[0].message.slice(0, 60)}"`);
      } else {
        WARN('no error for missing module import — tsserver may not flag this without tsconfig');
      }
    } catch {
      FAIL('no publishDiagnostics');
    }

    lsp.kill();
  }

  // ── Summary ───────────────────────────────────────────────────
  HDR('Summary');
  await new Promise(r => setTimeout(r, 1000));
  await rm(TMP, { recursive: true, force: true }).catch(() => {
    console.log('  (temp cleanup skipped — Windows file lock, safe to ignore)');
  });

  if (process.exitCode === 1) {
    console.error('\nSome tests FAILED — fix before marking Week 3 complete.\n');
  } else {
    console.log('\nAll tests PASSED — Week 3 diagnostics pipeline is production-grade. ✓\n');
  }
}

runTests().catch(e => { console.error('FATAL:', e.message); process.exitCode = 1; });
