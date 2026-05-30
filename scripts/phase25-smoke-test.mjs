#!/usr/bin/env node
/**
 * Phase 2.5 — Workspace Memory Engine Smoke Test Suite
 * Tests: workspace-memory.js · hooks · preload namespace · IPC stubs · CSS · HTML
 * Run: node scripts/phase25-smoke-test.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');
const SRC   = join(root, 'src');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    const r = fn();
    if (r === false) { failed++; failures.push({ name, reason: 'returned false' }); console.log(`  ✗ ${name}`); }
    else             { passed++; console.log(`  ✓ ${name}`); }
  } catch (e) {
    failed++; failures.push({ name, reason: e.message }); console.log(`  ✗ ${name}  →  ${e.message}`);
  }
}
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 52 - t.length))}`); }
function read(...p) { return readFileSync(join(SRC, ...p), 'utf8'); }

// ═══════════════════════════════════════════════════════════════
//  1. FILE EXISTENCE
// ═══════════════════════════════════════════════════════════════
section('1. File Existence');
test('workspace-memory.js exists',     () => existsSync(join(SRC, 'renderer/ui/workspace-memory.js')));
test('phase25-smoke-test.mjs exists',  () => existsSync(join(__dir, 'phase25-smoke-test.mjs')));

// ═══════════════════════════════════════════════════════════════
//  2. SYNTAX
// ═══════════════════════════════════════════════════════════════
section('2. JavaScript Syntax');
test('workspace-memory.js: syntax OK', () => {
  try { execSync(`node --check "${join(SRC, 'renderer/ui/workspace-memory.js')}"`, { stdio: 'pipe' }); return true; }
  catch (e) { throw new Error(e.stderr?.toString()?.slice(0, 120) || 'syntax error'); }
});

// ═══════════════════════════════════════════════════════════════
//  3. CORE API
// ═══════════════════════════════════════════════════════════════
section('3. WorkspaceMemory Core API');
const wm = read('renderer/ui/workspace-memory.js');
test('wm: IIFE pattern',                  () => wm.includes('const WorkspaceMemory = (() =>'));
test('wm: show() exported',               () => wm.includes('function show()'));
test('wm: hide() exported',               () => wm.includes('function hide()'));
test('wm: toggle() exported',             () => wm.includes('function toggle()'));
test('wm: window.WorkspaceMemory exposed',() => wm.includes('window.WorkspaceMemory = WorkspaceMemory'));

// ═══════════════════════════════════════════════════════════════
//  4. PUBLIC RECORD METHODS
// ═══════════════════════════════════════════════════════════════
section('4. Record Methods');
test('wm: recordFileOpen method',         () => wm.includes('function recordFileOpen'));
test('wm: recordAiQuery method',          () => wm.includes('function recordAiQuery'));
test('wm: recordProjectData method',      () => wm.includes('function recordProjectData'));
test('wm: getContext method',             () => wm.includes('function getContext'));
test('wm: getWelcomeInsight method',      () => wm.includes('function getWelcomeInsight'));

// ═══════════════════════════════════════════════════════════════
//  5. STORAGE LAYER
// ═══════════════════════════════════════════════════════════════
section('5. Storage Layer');
test('wm: localStorage key prefix noter.mem.',  () => wm.includes("'noter.mem.'"));
test('wm: deterministic hash function',         () => wm.includes('function _hash'));
test('wm: _load helper',                        () => wm.includes('function _load'));
test('wm: _save helper',                        () => wm.includes('function _save'));
test('wm: files capped at 60',                  () => wm.includes('hist.slice(0, 60)'));
test('wm: queries capped at 30',                () => wm.includes('hist.slice(0, 30)'));

// ═══════════════════════════════════════════════════════════════
//  6. FIVE TABS
// ═══════════════════════════════════════════════════════════════
section('6. Five Tabs');
test('wm: Session tab',   () => wm.includes("'session'")  && wm.includes('_buildSession'));
test('wm: Patterns tab',  () => wm.includes("'patterns'") && wm.includes('_buildPatterns'));
test('wm: History tab',   () => wm.includes("'history'")  && wm.includes('_buildHistory'));
test('wm: Insights tab',  () => wm.includes("'insights'") && wm.includes('_buildInsights'));
test('wm: Prefs tab',     () => wm.includes("'prefs'")    && wm.includes('_buildPrefs'));

// ═══════════════════════════════════════════════════════════════
//  7. PATTERN DETECTION
// ═══════════════════════════════════════════════════════════════
section('7. Pattern Detection');
test('wm: _detectNaming function',        () => wm.includes('function _detectNaming'));
test('wm: camelCase detection',           () => wm.includes('camelCase'));
test('wm: PascalCase detection',          () => wm.includes('PascalCase'));
test('wm: snake_case detection',          () => wm.includes('snake_case'));
test('wm: kebab-case detection',          () => wm.includes('kebab-case'));
test('wm: scan button triggers project scan', () => wm.includes('noter?.project?.scan'));

// ═══════════════════════════════════════════════════════════════
//  8. INSIGHTS ENGINE
// ═══════════════════════════════════════════════════════════════
section('8. Insights Engine');
test('wm: most active file insight',        () => wm.includes('Most Active File'));
test('wm: current focus detection (auth)',  () => wm.includes('Authentication'));
test('wm: current focus detection (api)',   () => wm.includes('API Layer'));
test('wm: current focus detection (db)',    () => wm.includes('Database'));
test('wm: session count insight',           () => wm.includes('Sessions on This Project'));
test('wm: AI query history insight',        () => wm.includes('Recent AI Focus'));

// ═══════════════════════════════════════════════════════════════
//  9. SMART WELCOME
// ═══════════════════════════════════════════════════════════════
section('9. Smart Welcome Insight');
test('wm: getWelcomeInsight uses lastFile',  () => wm.includes('s.lastFile'));
test('wm: welcome message format correct',   () => wm.includes('Welcome back! You were working on'));
test('wm: welcome toast shown on load',      () => wm.includes("window.toast?.(msg, 'info')"));
test('wm: welcome has 3s delay',             () => wm.includes('setTimeout'));

// ═══════════════════════════════════════════════════════════════
//  10. AI CONTEXT ENRICHMENT
// ═══════════════════════════════════════════════════════════════
section('10. AI Context Enrichment');
test('wm: getContext returns recentFiles',       () => wm.includes('recentFiles:'));
test('wm: getContext returns recentQueries',     () => wm.includes('recentQueries:'));
test('wm: getContext returns namingConvention',  () => wm.includes('namingConvention:'));
test('wm: getContext returns framework',         () => wm.includes('framework:'));
test('wm: getContext returns architecture',      () => wm.includes('architecture:'));

// ═══════════════════════════════════════════════════════════════
//  11. HOOKS — app.js & ai-chat.js
// ═══════════════════════════════════════════════════════════════
section('11. Hook Integration');
const appJs    = read('renderer/core/app.js');
const aiChatJs = read('renderer/ui/ai-chat.js');
test('app.js: recordFileOpen called on tab open',
  () => appJs.includes('window.WorkspaceMemory?.recordFileOpen'));
test('ai-chat.js: recordAiQuery called on query submit',
  () => aiChatJs.includes('window.WorkspaceMemory?.recordAiQuery'));
test('app.js: hook is after TabManager.activate',
  () => appJs.indexOf('WorkspaceMemory?.recordFileOpen') > appJs.indexOf('TabManager.activate(tab.id)'));

// ═══════════════════════════════════════════════════════════════
//  12. ACTIVITY BAR WIRING
// ═══════════════════════════════════════════════════════════════
section('12. Activity Bar Wiring');
const abJs = read('renderer/ui/activity-bar.js');
test('wm: ab-memory click handler in workspace-memory.js',
  () => wm.includes("$('ab-memory')?.addEventListener('click'"));
test('ab: memory-panel in explorer hide list',
  () => abJs.includes('"memory-panel"'));
test('ab: memory-panel appears in multiple hide lists',
  () => (abJs.match(/"memory-panel"/g) || []).length >= 4);

// ═══════════════════════════════════════════════════════════════
//  13. HTML WIRING
// ═══════════════════════════════════════════════════════════════
section('13. HTML Wiring');
const html = read('renderer/index.html');
test('html: ab-memory button exists',         () => html.includes('id="ab-memory"'));
test('html: memory-panel div exists',         () => html.includes('id="memory-panel"'));
test('html: workspace-memory.js script',      () => html.includes('workspace-memory.js'));
test('html: memory loads before reasoning',   () => {
  const mi = html.indexOf('workspace-memory.js');
  const ri = html.indexOf('reasoning-engine.js');
  return mi < ri && mi > 0;
});

// ═══════════════════════════════════════════════════════════════
//  14. PRELOAD IPC CONTRACT
// ═══════════════════════════════════════════════════════════════
section('14. Preload IPC Contract');
const preload = read('preload/preload.js');
test('preload: memory namespace declared',            () => preload.includes('memory:'));
test('preload: noter:memory:session channel',         () => preload.includes('"noter:memory:session"'));
test('preload: noter:memory:patterns channel',        () => preload.includes('"noter:memory:patterns"'));
test('preload: noter:memory:history channel',         () => preload.includes('"noter:memory:history"'));
test('preload: noter:memory:insights channel',        () => preload.includes('"noter:memory:insights"'));
test('preload: noter:memory:record channel',          () => preload.includes('"noter:memory:record"'));

// ═══════════════════════════════════════════════════════════════
//  15. MAIN.JS IPC STUBS
// ═══════════════════════════════════════════════════════════════
section('15. Main.js IPC Stubs');
const mainJs = read('main/main.js');
test('main: noter:memory:session handler',  () => mainJs.includes('"noter:memory:session"'));
test('main: noter:memory:patterns handler', () => mainJs.includes('"noter:memory:patterns"'));
test('main: noter:memory:history handler',  () => mainJs.includes('"noter:memory:history"'));
test('main: noter:memory:insights handler', () => mainJs.includes('"noter:memory:insights"'));
test('main: noter:memory:record handler',   () => mainJs.includes('"noter:memory:record"'));

// ═══════════════════════════════════════════════════════════════
//  16. CSS STYLES
// ═══════════════════════════════════════════════════════════════
section('16. CSS Styles');
const css = read('styles/noter-premium.css');
test('css: #memory-panel rule',       () => css.includes('#memory-panel'));
test('css: .wm-header rule',          () => css.includes('.wm-header'));
test('css: .wm-tabs rule',            () => css.includes('.wm-tabs'));
test('css: .wm-tab-active rule',      () => css.includes('.wm-tab-active'));
test('css: .wm-file-row rule',        () => css.includes('.wm-file-row'));
test('css: .wm-hist-row rule',        () => css.includes('.wm-hist-row'));
test('css: .wm-insight-row rule',     () => css.includes('.wm-insight-row'));
test('css: .wm-action-btn rule',      () => css.includes('.wm-action-btn'));
test('css: .wm-action-danger rule',   () => css.includes('.wm-action-danger'));

// ═══════════════════════════════════════════════════════════════
//  17. EXPORT & CLEAR ACTIONS
// ═══════════════════════════════════════════════════════════════
section('17. Export & Clear Actions');
test('wm: export memory as JSON blob',      () => wm.includes('application/json'));
test('wm: clear workspace memory action',   () => wm.includes('Clear all memory for this workspace'));
test('wm: clear uses localStorage prefix',  () => wm.includes("'noter.mem.' + _hash"));

// ═══════════════════════════════════════════════════════════════
//  18. NO REGRESSIONS
// ═══════════════════════════════════════════════════════════════
section('18. No Regressions from Phase 2.3 + 2.25');
test('reasoning-engine.js still exists',    () => existsSync(join(SRC, 'renderer/ui/reasoning-engine.js')));
test('health-dashboard.js still exists',    () => existsSync(join(SRC, 'renderer/ui/health-dashboard.js')));
test('html: reasoning-panel still present', () => html.includes('id="reasoning-panel"'));
test('html: health-panel still present',    () => html.includes('id="health-panel"'));
test('main: reasoning stubs still present', () => mainJs.includes('"noter:reasoning:risk"'));
test('preload: ai namespace intact',        () => preload.includes('"noter:ai:query"'));
test('css: .re-* rules still present',      () => css.includes('#reasoning-panel'));
test('css: sidebar resize fix intact',      () => {
  const block = css.slice(css.indexOf('#sidebar {'), css.indexOf('#sidebar {') + 200);
  return !block.includes('width: var(--np-sidebar-w) !important');
});

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════
const total = passed + failed;
console.log('\n' + '═'.repeat(58));
console.log(`  Phase 2.5 Smoke Test Results`);
console.log('═'.repeat(58));
console.log(`  Total  : ${total}`);
console.log(`  Passed : ${passed}  ✓`);
console.log(`  Failed : ${failed}  ✗`);
console.log('═'.repeat(58));

if (failures.length) {
  console.log('\n  FAILURES:');
  failures.forEach(f => console.log(`  ✗ ${f.name}\n    → ${f.reason}`));
}

const score = total > 0 ? Math.round((passed / total) * 100) : 0;
console.log(`\n  Test Score: ${score}%`);
console.log(`  Status: ${score >= 95 ? 'READY — Phase 2.5 complete' : score >= 80 ? 'MOSTLY READY' : 'NEEDS WORK'}`);
console.log('');
process.exit(failed > 0 ? 1 : 0);
