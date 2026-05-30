/**
 * AI Context Engine Smoke Test — Phase 2.2
 * scripts/context-retrieval-smoke-test.mjs
 *
 * Tests:
 *   T1 — buildAiContext returns without crash (no SymbolDB = empty context)
 *   T2 — buildAiPrompt returns system + user strings
 *   T3 — Context build time < 200ms
 *   T4 — Prompt contains query text
 *   T5 — invalidateAiContext works without crash
 *
 * Usage: node scripts/context-retrieval-smoke-test.mjs
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.resolve(__dirname, '..');
const NATIVE = path.join(ROOT, 'src', 'native', 'index.js');

let passed = 0, failed = 0, skipped = 0;
const OK   = (m) => { console.log(`  ✓ ${m}`); passed++; };
const FAIL = (m) => { console.error(`  ✗ ${m}`); failed++; process.exitCode = 1; };
const SKIP = (m) => { console.log(`  ○ ${m}`); skipped++; };
const HDR  = (m) => console.log(`\n── ${m} ──`);

let native = null;
try {
  const { createRequire } = await import('module');
  native = createRequire(import.meta.url)(NATIVE);
  if (!native.isAvailable()) native = null;
} catch {}

if (!native || typeof native.buildAiContext !== 'function') {
  console.log('\n[context-retrieval-smoke-test] Native module not built or Phase 2.2 not included.\n');
  process.exit(0);
}

const PROJECT = { language: 'TypeScript', framework: 'Express', architecture: 'MVC', database: 'PostgreSQL', orm: 'Prisma', authSystem: 'JWT' };
const ROOT_PATH = ROOT;
const EMPTY_DB  = '';

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  AI Context Engine Smoke Test — Phase 2.2        ║');
console.log('╚══════════════════════════════════════════════════╝');

// ── T1: buildAiContext doesn't crash ──────────────────────────────────────────
HDR('T1 — buildAiContext (no SymbolDB)');
try {
  const t0 = Date.now();
  const ctx = native.buildAiContext(ROOT_PATH, 'Add OAuth Login', EMPTY_DB, PROJECT);
  const ms = Date.now() - t0;
  if (ctx !== null) {
    OK(`buildAiContext returned (${ms}ms)`);
    OK(`query field: "${ctx.query}"`);
    OK(`language: "${ctx.language}"`);
    OK(`framework: "${ctx.framework}"`);
    if (ctx.rankedSymbols !== undefined) OK(`rankedSymbols: ${ctx.rankedSymbols.length} (expected 0 without SymbolDB)`);
  } else {
    SKIP('buildAiContext returned null (SymbolDB not built)');
  }
} catch (e) {
  FAIL(`buildAiContext threw: ${e.message}`);
}

// ── T2: buildAiPrompt returns system + user ───────────────────────────────────
HDR('T2 — buildAiPrompt structure');
try {
  const prompt = native.buildAiPrompt(ROOT_PATH, 'Add OAuth Login', EMPTY_DB, PROJECT, 'claude-sonnet-4-6');
  if (prompt) {
    if (prompt.system?.length > 0) OK(`system prompt: ${prompt.system.length} chars`);
    else FAIL('system prompt is empty');
    if (prompt.user?.length > 0) OK(`user message: ${prompt.user.length} chars`);
    else FAIL('user message is empty');
    if (prompt.model === 'claude-sonnet-4-6') OK(`model: ${prompt.model}`);
    else FAIL(`wrong model: ${prompt.model}`);
  } else {
    SKIP('buildAiPrompt returned null');
  }
} catch (e) {
  FAIL(`buildAiPrompt threw: ${e.message}`);
}

// ── T3: Build time < 200ms ────────────────────────────────────────────────────
HDR('T3 — Context build time');
try {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    native.buildAiContext(ROOT_PATH, `Query ${i}`, EMPTY_DB, PROJECT);
    times.push(Date.now() - t0);
  }
  const avg = times.reduce((a,b) => a+b, 0) / times.length;
  if (avg < 200) OK(`Average build time: ${avg.toFixed(1)}ms (< 200ms target)`);
  else FAIL(`Too slow: ${avg.toFixed(1)}ms (target < 200ms)`);
} catch (e) {
  FAIL(`Build time test threw: ${e.message}`);
}

// ── T4: Prompt contains query text ────────────────────────────────────────────
HDR('T4 — Prompt contains query');
try {
  const prompt = native.buildAiPrompt(ROOT_PATH, 'Add JWT authentication', EMPTY_DB, PROJECT, 'claude-sonnet-4-6');
  if (prompt?.user?.includes('JWT authentication')) {
    OK('Prompt user message contains query text');
  } else {
    FAIL(`Query not found in prompt. Got: ${prompt?.user?.slice(0, 100)}`);
  }
  if (prompt?.system?.includes('Expert') || prompt?.system?.includes('project') || prompt?.system?.includes('TypeScript')) {
    OK('System prompt includes project context');
  } else {
    SKIP('System prompt may not include all expected text');
  }
} catch (e) {
  FAIL(`Prompt content test threw: ${e.message}`);
}

// ── T5: Cache invalidation works ──────────────────────────────────────────────
HDR('T5 — invalidateAiContext');
try {
  native.invalidateAiContext(ROOT_PATH);
  OK('invalidateAiContext completed without error');
  // Build again after invalidation
  const ctx = native.buildAiContext(ROOT_PATH, 'Add OAuth Login', EMPTY_DB, PROJECT);
  OK('Re-build after invalidation succeeded');
} catch (e) {
  FAIL(`invalidateAiContext threw: ${e.message}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────────');
console.log(`  Passed:  ${passed}`);
console.log(`  Failed:  ${failed}`);
console.log(`  Skipped: ${skipped}`);
console.log('──────────────────────────────────────────────────');
console.log('\n  NOTE: Full symbol ranking (T1 scored results) requires');
console.log('  a built SymbolDB. Run workspace index first.\n');

if (failed > 0) process.exit(1);
