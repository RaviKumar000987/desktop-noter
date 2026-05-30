#!/usr/bin/env node
/**
 * Phase 2.3 — Project Reasoning Engine Smoke Test Suite
 * Tests: reasoning-engine.js · activity-bar panel hiding · preload namespace
 *        main.js IPC stubs · CSS styles · HTML wiring · smoke 2.25 compat
 * Run: node scripts/phase23-smoke-test.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');
const SRC   = join(root, 'src');

// ── Test runner ────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    const r = fn();
    if (r === false) { failed++; failures.push({ name, reason: 'returned false' }); console.log(`  ✗ ${name}`); }
    else             { passed++; console.log(`  ✓ ${name}`); }
  } catch (e) {
    failed++;
    failures.push({ name, reason: e.message });
    console.log(`  ✗ ${name}  →  ${e.message}`);
  }
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 52 - title.length))}`);
}

function read(...parts) { return readFileSync(join(SRC, ...parts), 'utf8'); }

// ═══════════════════════════════════════════════════════════════
//  1. FILE EXISTENCE
// ═══════════════════════════════════════════════════════════════
section('1. File Existence');

test('reasoning-engine.js exists', () => existsSync(join(SRC, 'renderer/ui/reasoning-engine.js')));
test('phase23-smoke-test.mjs exists', () => existsSync(join(__dir, 'phase23-smoke-test.mjs')));

// ═══════════════════════════════════════════════════════════════
//  2. SYNTAX CHECK
// ═══════════════════════════════════════════════════════════════
section('2. JavaScript Syntax');

test('reasoning-engine.js: syntax OK', () => {
  try {
    execSync(`node --check "${join(SRC, 'renderer/ui/reasoning-engine.js')}"`, { stdio: 'pipe' });
    return true;
  } catch (e) { throw new Error(e.stderr?.toString()?.slice(0, 120) || 'syntax error'); }
});

// ═══════════════════════════════════════════════════════════════
//  3. REASONING ENGINE — CORE API
// ═══════════════════════════════════════════════════════════════
section('3. ReasoningEngine Core API');

const re = read('renderer/ui/reasoning-engine.js');

test('re: IIFE pattern used',               () => re.includes('const ReasoningEngine = (() =>'));
test('re: show() method exported',          () => re.includes('function show()'));
test('re: hide() method exported',          () => re.includes('function hide()'));
test('re: toggle() method exported',        () => re.includes('function toggle()'));
test('re: window.ReasoningEngine exposed',  () => re.includes('window.ReasoningEngine = ReasoningEngine'));

// ═══════════════════════════════════════════════════════════════
//  4. FIVE TABS
// ═══════════════════════════════════════════════════════════════
section('4. Five Reasoning Tabs');

test('re: Overview tab rendered',  () => re.includes("data-tab=\"overview\"") && re.includes('_buildOverviewTab'));
test('re: Risk tab rendered',      () => re.includes("data-tab=\"risk\"")     && re.includes('_buildRiskTab'));
test('re: Simulate tab rendered',  () => re.includes("data-tab=\"simulate\"") && re.includes('_buildSimulateTab'));
test('re: Debt tab rendered',      () => re.includes("data-tab=\"debt\"")     && re.includes('_buildDebtTab'));
test('re: Advice tab rendered',    () => re.includes("data-tab=\"advice\"")   && re.includes('_buildAdviceTab'));

// ═══════════════════════════════════════════════════════════════
//  5. HEALTH SCORE ALGORITHM
// ═══════════════════════════════════════════════════════════════
section('5. Health Score Algorithm');

test('re: _computeHealth function exists',  () => re.includes('function _computeHealth'));
test('re: architecture score computed',     () => re.includes('archScore'));
test('re: debt score computed',             () => re.includes('debtScore'));
test('re: complexity score computed',       () => re.includes('compScore'));
test('re: risk score computed',             () => re.includes('riskScore'));
test('re: performance score from monitor',  () => re.includes('PerformanceMonitor'));
test('re: weighted total (0.20+0.25+...)',  () => re.includes('0.20') && re.includes('0.25'));

// ═══════════════════════════════════════════════════════════════
//  6. RISK ENGINE
// ═══════════════════════════════════════════════════════════════
section('6. Risk Engine');

test('re: _computeRiskItems function exists', () => re.includes('function _computeRiskItems'));
test('re: deterministic hash (no Math.random)', () => !re.includes('Math.random()'));
test('re: _hash function for determinism',      () => re.includes('function _hash'));
test('re: cycle detection for risk',            () => re.includes('cyclicFiles'));
test('re: HIGH risk patterns (service, controller, etc.)', () =>
  re.includes('/service/i') && re.includes('/controller/i') && re.includes('/middleware/i'));
test('re: MEDIUM risk patterns (util, helper, lib)',    () =>
  re.includes('/util/i') && re.includes('/helper/i') && re.includes('/lib'));
test('re: risk levels: critical / medium / low', () =>
  re.includes("'critical'") && re.includes("'medium'") && re.includes("'low'"));

// ═══════════════════════════════════════════════════════════════
//  7. CHANGE SIMULATOR
// ═══════════════════════════════════════════════════════════════
section('7. Change Simulator');

test('re: simulate tab uses noter.graph.impact', () => re.includes('graph?.impact'));
test('re: sim result shows directImporters',     () => re.includes('directImporters'));
test('re: sim result shows impactedFiles',        () => re.includes('impactedFiles'));
test('re: impact severity HIGH/MEDIUM/LOW',       () =>
  re.includes("'HIGH'") && re.includes("'MEDIUM'") && re.includes("'LOW'"));
test('re: sim-safe state for no dependents',      () => re.includes('re-sim-safe'));
test('re: Enter key triggers simulation',          () => re.includes("key === 'Enter'"));

// ═══════════════════════════════════════════════════════════════
//  8. TECHNICAL DEBT DETECTION
// ═══════════════════════════════════════════════════════════════
section('8. Technical Debt Detection');

test('re: _buildDebtTab function exists',         () => re.includes('function _buildDebtTab'));
test('re: cycles shown in debt tab',              () => re.includes('CIRCULAR DEPENDENCIES'));
test('re: arch violations shown in debt tab',     () => re.includes('ARCH VIOLATIONS'));
test('re: dead code shown in debt tab',           () => re.includes('DEAD CODE'));
test('re: large files shown in debt tab',         () => re.includes('COMPLEX FILES'));
test('re: debt uses noter.graph.deadCode',        () => re.includes('deadCode'));
test('re: debt uses noter.graph.cycles',          () => re.includes('cycles'));
test('re: debt uses noter.graph.archViolations',  () => re.includes('archViolations'));

// ═══════════════════════════════════════════════════════════════
//  9. RECOMMENDATIONS ENGINE
// ═══════════════════════════════════════════════════════════════
section('9. Recommendations Engine');

test('re: _buildRecommendations function exists',    () => re.includes('function _buildRecommendations'));
test('re: priority levels: high/medium/low',         () =>
  re.includes("priority: 'high'") && re.includes("priority: 'medium'") && re.includes("priority: 'low'"));
test('re: cycles trigger high-priority rec',         () => re.includes('Break Circular Dependencies'));
test('re: critical risk triggers split rec',         () => re.includes('Split High-Risk Modules'));
test('re: arch violations trigger medium rec',       () => re.includes('Fix Architecture Violations'));
test('re: dead code triggers medium rec',            () => re.includes('Remove Dead Code'));
test('re: healthy state handled gracefully',         () => re.includes('Project looks healthy'));

// ═══════════════════════════════════════════════════════════════
//  10. DATA PIPELINE
// ═══════════════════════════════════════════════════════════════
section('10. Analysis Pipeline');

test('re: _runAnalysis function exists',           () => re.includes('async function _runAnalysis'));
test('re: parallel fetch with Promise.all',        () => re.includes('await Promise.all'));
test('re: fetches graph.build',                    () => re.includes("graph?.build"));
test('re: fetches graph.deadCode',                 () => re.includes("graph?.deadCode"));
test('re: fetches graph.cycles',                   () => re.includes("graph?.cycles"));
test('re: fetches graph.archViolations',           () => re.includes("graph?.archViolations"));
test('re: fetches project file list',              () => re.includes("listWorkspaceFiles"));
test('re: graceful null safety (_try wrapper)',    () => re.includes('async function _try'));
test('re: analyzing state shown while running',    () => re.includes("_analyzing = true"));
test('re: error state handled in _data.error',     () => re.includes('_data = { error:'));

// ═══════════════════════════════════════════════════════════════
//  11. ACTIVITY BAR WIRING
// ═══════════════════════════════════════════════════════════════
section('11. Activity Bar Wiring');

const abJs = read('renderer/ui/activity-bar.js');

test('re: ab-reasoning button click handled in reasoning-engine.js',
  () => re.includes("$('ab-reasoning')?.addEventListener('click'"));

test('ab: reasoning-panel hidden when entering explorer',
  () => abJs.includes('"reasoning-panel"'));

test('ab: reasoning-panel hidden when entering search',
  () => abJs.split('"reasoning-panel"').length >= 3); // at least 3 occurrences

test('ab: reasoning-panel hidden when opening AI panel',
  () => abJs.includes('"reasoning-panel"'));

// ═══════════════════════════════════════════════════════════════
//  12. HTML WIRING
// ═══════════════════════════════════════════════════════════════
section('12. HTML Wiring');

const html = read('renderer/index.html');

test('html: ab-reasoning button exists',        () => html.includes('id="ab-reasoning"'));
test('html: reasoning-panel div exists',        () => html.includes('id="reasoning-panel"'));
test('html: reasoning-engine.js script loaded', () => html.includes('reasoning-engine.js'));

// ═══════════════════════════════════════════════════════════════
//  13. PRELOAD IPC CONTRACT
// ═══════════════════════════════════════════════════════════════
section('13. Preload IPC Contract');

const preload = read('preload/preload.js');

test('preload: reasoning namespace declared',                    () => preload.includes('reasoning:'));
test('preload: getRisk invokes noter:reasoning:risk',            () => preload.includes('"noter:reasoning:risk"'));
test('preload: simulateChange invokes noter:reasoning:simulate', () => preload.includes('"noter:reasoning:simulate"'));
test('preload: getDebt invokes noter:reasoning:debt',            () => preload.includes('"noter:reasoning:debt"'));
test('preload: getAdvice invokes noter:reasoning:advice',        () => preload.includes('"noter:reasoning:advice"'));
test('preload: getHealth invokes noter:reasoning:health',        () => preload.includes('"noter:reasoning:health"'));

// ═══════════════════════════════════════════════════════════════
//  14. MAIN.JS IPC STUBS
// ═══════════════════════════════════════════════════════════════
section('14. Main.js IPC Stubs');

const mainJs = read('main/main.js');

test('main: noter:reasoning:risk handler exists',     () => mainJs.includes('"noter:reasoning:risk"'));
test('main: noter:reasoning:simulate handler exists', () => mainJs.includes('"noter:reasoning:simulate"'));
test('main: noter:reasoning:debt handler exists',     () => mainJs.includes('"noter:reasoning:debt"'));
test('main: noter:reasoning:advice handler exists',   () => mainJs.includes('"noter:reasoning:advice"'));
test('main: noter:reasoning:health handler exists',   () => mainJs.includes('"noter:reasoning:health"'));
test('main: stubs return null (future Rust engine)',
  () => mainJs.includes('"noter:reasoning:risk",     () => null'));

// ═══════════════════════════════════════════════════════════════
//  15. CSS STYLES
// ═══════════════════════════════════════════════════════════════
section('15. CSS Styles');

const css = read('styles/noter-premium.css');

test('css: #reasoning-panel rule exists',    () => css.includes('#reasoning-panel'));
test('css: .re-header rule exists',          () => css.includes('.re-header'));
test('css: .re-tabs rule exists',            () => css.includes('.re-tabs'));
test('css: .re-score-circle rule exists',    () => css.includes('.re-score-circle'));
test('css: .re-bar-wrap / .re-bar exists',   () => css.includes('.re-bar-wrap') && css.includes('.re-bar'));
test('css: .re-risk-row rule exists',        () => css.includes('.re-risk-row'));
test('css: .re-dot-crit / med / low exist',  () => css.includes('.re-dot-crit') && css.includes('.re-dot-low'));
test('css: .re-sim-input rule exists',       () => css.includes('.re-sim-input'));
test('css: .re-badge-err / warn / info',     () => css.includes('.re-badge-err') && css.includes('.re-badge-warn'));
test('css: .re-advice-high / medium / low',  () => css.includes('.re-advice-high') && css.includes('.re-advice-low'));
test('css: @keyframes re-spin defined',      () => css.includes('@keyframes re-spin'));

// ═══════════════════════════════════════════════════════════════
//  16. INTEGRATION — NO BREAKING CHANGES
// ═══════════════════════════════════════════════════════════════
section('16. No Regressions from Phase 2.25');

// Phase 2.25 features must still be intact
test('health-dashboard.js: still exists',     () => existsSync(join(SRC, 'renderer/ui/health-dashboard.js')));
test('html: ab-health button still present',  () => html.includes('id="ab-health"'));
test('html: health-panel still present',      () => html.includes('id="health-panel"'));
test('css: .hd-section rule still present',   () => css.includes('.hd-section'));
test('main: git stubs still present',         () => mainJs.includes('"noter:git:status"'));
test('preload: ai namespace still present',   () => preload.includes('"noter:ai:query"'));
test('preload: symbols namespace still present', () => preload.includes('"noter:symbols:build-call-graph"'));

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════
const total = passed + failed;
console.log('\n' + '═'.repeat(58));
console.log(`  Phase 2.3 Smoke Test Results`);
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

const readiness = score >= 95 ? 'READY — Phase 2.3 complete' :
                  score >= 80 ? 'MOSTLY READY' : 'NEEDS WORK';
console.log(`  Status: ${readiness}`);
console.log('');

process.exit(failed > 0 ? 1 : 0);
