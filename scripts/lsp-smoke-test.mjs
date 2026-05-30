/**
 * LSP Smoke Test — scripts/lsp-smoke-test.mjs
 *
 * Tests typescript-language-server at the JSON-RPC protocol level.
 * No GUI, no Electron, no Monaco. Validates the LSP path that the
 * real app uses before committing to Week 2 work.
 *
 * Usage:  node scripts/lsp-smoke-test.mjs
 * Passes: all test lines show ✓
 * Fails:  any line shows ✗ — message explains what's wrong
 */

import { spawn }    from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync }    from 'fs';
import path              from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const TMP        = path.join(ROOT, '.lsp-smoke-tmp');
// Spawn node directly with the CLI entry point — avoids .cmd + spaces-in-path issues on Windows.
const SERVER_SCRIPT = path.join(ROOT, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs');
const SERVER_BIN    = path.join(ROOT, 'node_modules', '.bin',
  process.platform === 'win32' ? 'typescript-language-server.cmd' : 'typescript-language-server');

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const OK  = (msg) => console.log(`  ✓ ${msg}`);
const FAIL= (msg) => { console.error(`  ✗ ${msg}`); process.exitCode = 1; };
const HDR = (msg) => console.log(`\n── ${msg} ──`);

// ── JSON-RPC 2.0 over stdio ───────────────────────────────────────────────────
class LspConnection {
  constructor(proc) {
    this._proc    = proc;
    this._buf     = '';
    this._pending = new Map();
    this._seq     = 1;
    this._notifs  = [];   // unhandled notifications (e.g. publishDiagnostics)
    proc.stdout.on('data', d => { this._buf += d.toString(); this._parse(); });
    proc.stderr.on('data', d => {
      // suppress verbose tsserver logs but surface errors
      const s = d.toString();
      if (s.includes('[Error]') || s.includes('Unhandled')) process.stderr.write('[tsserver] ' + s);
    });
  }

  _parse() {
    while (true) {
      const end = this._buf.indexOf('\r\n\r\n');
      if (end === -1) break;
      const hdr = this._buf.slice(0, end);
      const m   = hdr.match(/Content-Length:\s*(\d+)/i);
      if (!m) { this._buf = this._buf.slice(end + 4); continue; }
      const len = parseInt(m[1]);
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

  request(method, params, timeout = 10_000) {
    return new Promise((resolve, reject) => {
      const id = this._seq++;
      const t  = setTimeout(() => { this._pending.delete(id); reject(new Error(`timeout: ${method}`)); }, timeout);
      this._pending.set(id, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } });
      this._send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) { this._send({ jsonrpc: '2.0', method, params }); }

  waitNotif(method, timeout = 5_000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const poll  = () => {
        const idx = this._notifs.findIndex(n => n.method === method);
        if (idx !== -1) { const n = this._notifs.splice(idx, 1)[0]; return resolve(n); }
        if (Date.now() - start > timeout) return reject(new Error(`timeout waiting for ${method}`));
        setTimeout(poll, 50);
      };
      poll();
    });
  }

  kill() { try { this._proc.kill(); } catch {} }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toUri(p) { return pathToFileURL(p).toString(); }

async function writeTs(name, content) {
  const p = path.join(TMP, name);
  await writeFile(p, content, 'utf8');
  return p;
}

async function hover(lsp, filePath, line, char) {
  const t0 = Date.now();
  const r   = await lsp.request('textDocument/hover', {
    textDocument: { uri: toUri(filePath) },
    position:     { line, character: char },
  });
  return { result: r, ms: Date.now() - t0 };
}

// ── Boot LSP ──────────────────────────────────────────────────────────────────
async function bootLsp(workspaceRoot) {
  // Spawn node directly to sidestep .cmd + path-with-spaces issues on Windows
  const proc = spawn(process.execPath, [SERVER_SCRIPT, '--stdio'], {
    cwd:   workspaceRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
  });
  const lsp = new LspConnection(proc);

  await lsp.request('initialize', {
    processId:    process.pid,
    clientInfo:   { name: 'noter-smoke-test', version: '1.0' },
    rootUri:      toUri(workspaceRoot),
    workspaceFolders: [{ uri: toUri(workspaceRoot), name: 'workspace' }],
    capabilities: {
      textDocument: {
        hover:       { contentFormat: ['markdown', 'plaintext'] },
        completion:  { completionItem: { snippetSupport: true } },
        publishDiagnostics: { relatedInformation: true },
        synchronization: { willSave: false, didSave: false },
      },
    },
    initializationOptions: {
      preferences: { includeInlayParameterNameHints: 'all' },
      tsserver:    { logVerbosity: 'off', trace: 'off' },
    },
  });
  lsp.notify('initialized', {});
  return lsp;
}

function didOpen(lsp, filePath, content) {
  lsp.notify('textDocument/didOpen', {
    textDocument: { uri: toUri(filePath), languageId: 'typescript', version: 1, text: content },
  });
}

function didChange(lsp, filePath, content, version) {
  lsp.notify('textDocument/didChange', {
    textDocument:   { uri: toUri(filePath), version },
    contentChanges: [{ text: content }],
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
async function runTests() {
  // Pre-flight
  HDR('Pre-flight');
  if (!existsSync(SERVER_BIN)) {
    FAIL(`typescript-language-server not found at ${SERVER_BIN}`);
    FAIL('Run: npm install (in project root)');
    return;
  }
  OK(`binary found: ${SERVER_BIN}`);

  await mkdir(TMP, { recursive: true });

  // ── Test 1 — Parameter hover ──────────────────────────────────
  HDR('Test 1 — Parameter Hover');
  {
    const src  = 'function greet(name: string) {\n  return name;\n}\n';
    const file = await writeTs('test1.ts', src);
    const lsp  = await bootLsp(TMP);
    didOpen(lsp, file, src);
    await new Promise(r => setTimeout(r, 500)); // let tsserver index

    // Hover over `name` on line 0, char 15
    const { result, ms } = await hover(lsp, file, 0, 15);
    const text = extractHoverText(result);
    if (text?.includes('name') && text?.includes('string')) {
      OK(`hover text: "${text.slice(0, 60)}"  (${ms}ms)`);
    } else {
      FAIL(`expected "(parameter) name: string", got: ${JSON.stringify(text)} (${ms}ms)`);
    }
    lsp.kill();
  }

  // ── Test 2 — Inferred type hover ──────────────────────────────
  HDR('Test 2 — Inferred Type Hover');
  {
    const src  = 'const user = { id: 1 };\n';
    const file = await writeTs('test2.ts', src);
    const lsp  = await bootLsp(TMP);
    didOpen(lsp, file, src);
    await new Promise(r => setTimeout(r, 500));

    // Hover over `user` on line 0, char 6
    const { result, ms } = await hover(lsp, file, 0, 6);
    const text = extractHoverText(result);
    if (text?.includes('user') && text?.includes('id')) {
      OK(`hover text: "${text.slice(0, 80)}"  (${ms}ms)`);
    } else {
      FAIL(`expected inferred type with "id: number", got: ${JSON.stringify(text)} (${ms}ms)`);
    }
    lsp.kill();
  }

  // ── Test 3 — External lib hover (express — may not have @types) ──
  HDR('Test 3 — External Lib Hover');
  {
    const src  = 'import express from "express";\nconst app = express();\n';
    const file = await writeTs('test3.ts', src);
    const lsp  = await bootLsp(TMP);
    didOpen(lsp, file, src);
    await new Promise(r => setTimeout(r, 800));

    const { result, ms } = await hover(lsp, file, 0, 7);
    const text = extractHoverText(result);
    if (text) {
      OK(`hover text: "${text.slice(0, 80)}"  (${ms}ms)`);
      if (!text.includes('any')) {
        OK('@types/express present — full type docs shown');
      } else {
        console.log('  ⚠  hover shows "any" — install @types/express for full docs (expected)');
      }
    } else {
      FAIL(`no hover result for "express" import (${ms}ms) — tsserver may not have started`);
    }
    lsp.kill();
  }

  // ── Test 4 — Large workspace latency ─────────────────────────
  HDR('Test 4 — Hover Latency (50 files)');
  {
    // Create 50 .ts files
    for (let i = 0; i < 50; i++) {
      await writeTs(`module${i}.ts`, `export const val${i} = ${i};\nexport function fn${i}(x: number) { return x + ${i}; }\n`);
    }
    const src  = 'function hello(msg: string) { return msg; }\n';
    const file = await writeTs('main.ts', src);
    const lsp  = await bootLsp(TMP);
    didOpen(lsp, file, src);
    await new Promise(r => setTimeout(r, 1500)); // indexing time

    const { result, ms } = await hover(lsp, file, 0, 9);
    const text = extractHoverText(result);
    if (ms <= 200) {
      OK(`latency ${ms}ms ≤ 200ms — within target`);
    } else if (ms <= 500) {
      console.log(`  ⚠  latency ${ms}ms — acceptable but above 200ms target`);
    } else {
      FAIL(`latency ${ms}ms — too slow (target: <200ms)`);
    }
    if (!text) FAIL('no hover result — tsserver not responding');
    lsp.kill();
  }

  // ── Test 5 — Cross-file hover ─────────────────────────────────
  HDR('Test 5 — Cross-file Hover (document sync)');
  {
    const srcA = 'export function add(a: number, b: number): number {\n  return a + b;\n}\n';
    const srcB = 'import { add } from "./fileA";\nconst r = add(1, 2);\n';
    const fileA = await writeTs('fileA.ts', srcA);
    const fileB = await writeTs('fileB.ts', srcB);

    const lsp = await bootLsp(TMP);
    didOpen(lsp, fileA, srcA);
    didOpen(lsp, fileB, srcB);
    await new Promise(r => setTimeout(r, 1000));

    // Hover over `add` on line 1 of fileB (char 10)
    const { result, ms } = await hover(lsp, fileB, 1, 10);
    const text = extractHoverText(result);
    if (text?.includes('add') && text?.includes('number')) {
      OK(`cross-file hover: "${text.slice(0, 80)}"  (${ms}ms)`);
      OK('workspace URI + document sync: working');
    } else {
      FAIL(`expected "function add(a: number, b: number): number", got: ${JSON.stringify(text)} (${ms}ms)`);
      FAIL('document sync or workspace URI may be broken');
    }
    lsp.kill();
  }

  // ── Test 6 — Unsaved buffer hover ────────────────────────────
  HDR('Test 6 — Unsaved Buffer Hover (didChange sync)');
  {
    const srcV1  = 'const user = { id: 1 };\n';
    const srcV2  = 'const user = { id: 1, name: "Ravi" };\n';
    const file   = await writeTs('unsaved.ts', srcV1);
    const lsp    = await bootLsp(TMP);

    didOpen(lsp, file, srcV1);
    await new Promise(r => setTimeout(r, 500));

    // Version 1: hover `id`
    const { result: r1 } = await hover(lsp, file, 0, 20);
    const t1 = extractHoverText(r1);

    // Simulate editor change WITHOUT saving to disk
    didChange(lsp, file, srcV2, 2);
    await new Promise(r => setTimeout(r, 300));

    // Version 2: hover `name` — should reflect in-memory content, not disk
    const { result: r2, ms } = await hover(lsp, file, 0, 25);
    const t2 = extractHoverText(r2);

    if (t2?.includes('name') && t2?.includes('string')) {
      OK(`unsaved buffer hover: "${t2.slice(0, 80)}"  (${ms}ms)`);
      OK('didChange sync working — tsserver uses editor state, not disk');
    } else {
      FAIL(`expected "name: string" from in-memory content, got: ${JSON.stringify(t2)} (${ms}ms)`);
      FAIL('didChange may not be sent — tsserver using stale disk content');
    }
    lsp.kill();
  }

  // ── Test 7 — Server restart recovery ─────────────────────────
  HDR('Test 7 — Server Restart Recovery');
  {
    const src  = 'const x: number = 42;\n';
    const file = await writeTs('restart.ts', src);
    const lsp  = await bootLsp(TMP);
    didOpen(lsp, file, src);
    await new Promise(r => setTimeout(r, 500));

    // Verify hover works before kill
    const { result: before } = await hover(lsp, file, 0, 6);
    if (extractHoverText(before)?.includes('number')) {
      OK('hover works before kill');
    } else {
      FAIL('hover not working before kill — test 7 invalid');
    }

    // Force kill the server
    lsp.kill();
    OK('server killed');

    // Boot a fresh server (simulates circuit breaker restart)
    const lsp2 = await bootLsp(TMP);
    didOpen(lsp2, file, src);
    await new Promise(r => setTimeout(r, 500));

    const { result: after, ms } = await hover(lsp2, file, 0, 6);
    if (extractHoverText(after)?.includes('number')) {
      OK(`hover works after restart  (${ms}ms)`);
      OK('circuit breaker restart path: validated');
    } else {
      FAIL(`hover failed after restart (${ms}ms) — restart path broken`);
    }
    lsp2.kill();
  }

  // ── Cleanup ───────────────────────────────────────────────────
  HDR('Summary');
  if (process.exitCode === 1) {
    console.error('\nSome tests FAILED — do not proceed to Week 2 until fixed.\n');
  } else {
    console.log('\nAll tests PASSED — Week 1 hover is production-grade. ✓\n');
  }
  // Windows: tsserver holds file locks for a moment after kill — wait before cleanup
  await new Promise(r => setTimeout(r, 1000));
  await rm(TMP, { recursive: true, force: true }).catch(() => {
    console.log('  (temp dir cleanup skipped — locked by OS, safe to ignore)');
  });
}

// ── Hover text extractor ──────────────────────────────────────────────────────
function extractHoverText(result) {
  if (!result?.contents) return null;
  const c = result.contents;
  if (typeof c === 'string')       return c;
  if (Array.isArray(c))            return c.map(x => typeof x === 'string' ? x : x.value).join('\n');
  if (typeof c.value === 'string') return c.value;
  return null;
}

// ── Run ───────────────────────────────────────────────────────────────────────
runTests().catch(e => {
  console.error('FATAL:', e.message);
  process.exitCode = 1;
});
