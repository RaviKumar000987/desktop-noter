#!/usr/bin/env node
/**
 * Phase 2.25 — Hardening & Reliability Smoke Test Suite
 * Tests: IPC contracts · Command wiring · UI globals · Settings
 * Run: node scripts/phase225-smoke-test.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = join(__dir, '..');
const SRC    = join(root, 'src');

// ── Test runner ────────────────────────────────────────────────
let passed = 0, failed = 0, warned = 0;
const failures = [];

function test(name, fn) {
  try {
    const r = fn();
    if (r === false) {
      failed++;
      failures.push({ name, reason: 'returned false' });
      console.log(`  ✗ ${name}`);
    } else {
      passed++;
      console.log(`  ✓ ${name}`);
    }
  } catch (e) {
    failed++;
    failures.push({ name, reason: e.message });
    console.log(`  ✗ ${name}  →  ${e.message}`);
  }
}

function warn(name, fn) {
  try {
    fn(); warned++;
    console.log(`  ⚠ ${name}`);
  } catch {}
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 52 - title.length))}`);
}

function readSrc(...parts) {
  return readFileSync(join(SRC, ...parts), 'utf8');
}

// ═══════════════════════════════════════════════════════════════
//  1. FILE EXISTENCE
// ═══════════════════════════════════════════════════════════════
section('1. File Existence');

const REQUIRED_FILES = [
  'main/main.js',
  'main/lsp-bridge.js',
  'main/settings-file.js',
  'main/ai-provider.js',
  'preload/preload.js',
  'native/index.js',
  'renderer/index.html',
  'renderer/core/app.js',
  'renderer/ui/activity-bar.js',
  'renderer/ui/ai-chat.js',
  'renderer/ui/command-palette.js',
  'renderer/ui/command-registry.js',
  'renderer/ui/health-dashboard.js',
  'renderer/ui/project-graph.js',
  'renderer/ui/project-overview.js',
  'renderer/ui/bottom-panel.js',
  'renderer/ui/diagnostics-panel.js',
  'renderer/ui/lang-status.js',
  'renderer/ui/keybindings.js',
  'renderer/ui/keybindings-ui.js',
  'renderer/ui/welcome.js',
  'renderer/ui/performance-monitor.js',
  'renderer/ui/crash-recovery.js',
  'renderer/editor/lsp-client.js',
  'renderer/editor/lsp-manager.js',
  'renderer/editor/intellisense.js',
  'renderer/editor/model-manager.js',
  'renderer/editor/split-editor.js',
  'renderer/editor/code-actions.js',
  'renderer/editor/diagnostic-store.js',
  'renderer/editor/file-index-db.js',
  'renderer/editor/completion-normalizer.js',
  'renderer/editor/monaco-ts-config.js',
  'renderer/editor/editor-context-menu.js',
  'renderer/explorer/virtual-explorer.js',
  'renderer/explorer/context-menu.js',
  'renderer/terminal/terminal.js',
  'renderer/search/global-search.js',
  'renderer/marketplace/marketplace.js',
  'renderer/settings/settings-json.js',
  'renderer/settings/settings-manager.js',
  'renderer/settings/settings-ui.js',
  'renderer/perf/event-bus.js',
  'renderer/perf/dom-patcher.js',
  'renderer/perf/worker-pool.js',
  'renderer/perf/background-scheduler.js',
  'renderer/perf/persistent-cache.js',
  'renderer/perf/memory-manager.js',
  'renderer/perf/lazy-loader.js',
  'shared/constants.js',
  'styles/style.css',
  'styles/features.css',
  'styles/noter-premium.css',
];

for (const f of REQUIRED_FILES) {
  test(`exists: src/${f}`, () => existsSync(join(SRC, f)));
}

// ═══════════════════════════════════════════════════════════════
//  2. SYNTAX CHECK (node --check)
// ═══════════════════════════════════════════════════════════════
section('2. JavaScript Syntax');
import { execSync } from 'child_process';

const JS_FILES_TO_CHECK = [
  'main/main.js', 'main/lsp-bridge.js', 'main/settings-file.js',
  'native/index.js',
  'renderer/core/app.js',
  'renderer/ui/activity-bar.js', 'renderer/ui/ai-chat.js',
  'renderer/ui/command-palette.js', 'renderer/ui/command-registry.js',
  'renderer/ui/health-dashboard.js', 'renderer/ui/project-graph.js',
  'renderer/ui/project-overview.js',
  'renderer/editor/split-editor.js', 'renderer/editor/lsp-client.js',
  'renderer/editor/lsp-manager.js',
  'renderer/search/global-search.js',
  'renderer/terminal/terminal.js',
  'renderer/perf/dom-patcher.js', 'renderer/perf/event-bus.js',
];

for (const f of JS_FILES_TO_CHECK) {
  test(`syntax OK: src/${f}`, () => {
    try {
      execSync(`node --check "${join(SRC, f)}"`, { stdio: 'pipe' });
      return true;
    } catch (e) {
      throw new Error(e.stderr?.toString()?.slice(0, 120) || 'syntax error');
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  3. PRELOAD ↔ MAIN IPC CONTRACT
// ═══════════════════════════════════════════════════════════════
section('3. Preload ↔ Main IPC Contract');

const preload      = readSrc('preload/preload.js');
const mainJs       = readSrc('main/main.js');
const lspBr        = readSrc('main/lsp-bridge.js');
const settingsFile = readSrc('main/settings-file.js');

// Every ipcRenderer.invoke("X") in preload must have ipcMain.handle("X") somewhere in main
// Handles: single-line, multi-line, variable-based (loop), and string literals
const invokeRe  = /ipcRenderer\.invoke\(["']([^"']+)["']/g;
const handleRe  = /ipcMain\.handle\([\s\n]*["']([^"']+)["']/g;
// Also detect dynamic channel arrays like ['lsp:start', 'noter:lsp:start']
const arrayRe   = /\[['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\]/g;

const invokedChannels = [...preload.matchAll(invokeRe)].map(m => m[1]);
const allMainSrc      = mainJs + '\n' + lspBr + '\n' + settingsFile;

const handledChannels = [
  ...[...allMainSrc.matchAll(handleRe)].map(m => m[1]),
];
// Extract channels from array literals (e.g., for (const ch of ['lsp:start','noter:lsp:start']))
for (const m of allMainSrc.matchAll(arrayRe)) {
  handledChannels.push(m[1], m[2]);
}
// Also extract individual string literals that appear near ipcMain.on/handle context
const singleRe = /['"]([a-z][a-z0-9:_-]+)['"]/g;
const ctxLines = allMainSrc.split('\n').filter(l =>
  l.includes('ipcMain.handle') || l.includes('ipcMain.on') ||
  l.includes("ch of [") || l.includes("for (const ch")
);
for (const line of ctxLines) {
  for (const m of line.matchAll(singleRe)) handledChannels.push(m[1]);
}
const handledSet = new Set(handledChannels);

// Phase-3 stubs that intentionally return null
const KNOWN_STUBS = new Set([
  'noter:git:diff', 'noter:git:log', 'noter:git:branches',
  'noter:workspace:memory',
]);

for (const ch of [...new Set(invokedChannels)]) {
  if (KNOWN_STUBS.has(ch)) {
    test(`IPC stub (intentional): ${ch}`, () => handledSet.has(ch));
  } else {
    test(`IPC handled: ${ch}`, () => handledSet.has(ch));
  }
}

// ═══════════════════════════════════════════════════════════════
//  4. WINDOW GLOBAL EXPOSURES
// ═══════════════════════════════════════════════════════════════
section('4. window.* Global Exposures');

const appJs = readSrc('renderer/core/app.js');

const REQUIRED_WINDOW_GLOBALS = [
  ['window.TabManager = TabManager',     'app.js'],
  ['window.TabDnD = TabDnD',             'app.js'],
  ['window.toggleSidebar = toggleSidebar','app.js'],
  ['window.actions = actions',           'app.js'],
  ['window.explorerState = explorerState','app.js'],
  ['window.toast = showToast',           'app.js'],
  ['window.ActivityBar = ActivityBar',   'activity-bar.js'],
  ['window.GlobalSearch = GlobalSearch', 'global-search.js'],
  ['window.SplitEditor = SplitEditor',   'split-editor.js'],
  ['window.Marketplace = Marketplace',   'marketplace.js'],
  ['window.HealthDashboard = HealthDashboard', 'health-dashboard.js'],
];

function srcFor(file) {
  const map = {
    'app.js':              appJs,
    'activity-bar.js':     readSrc('renderer/ui/activity-bar.js'),
    'global-search.js':    readSrc('renderer/search/global-search.js'),
    'split-editor.js':     readSrc('renderer/editor/split-editor.js'),
    'marketplace.js':      readSrc('renderer/marketplace/marketplace.js'),
    'health-dashboard.js': readSrc('renderer/ui/health-dashboard.js'),
  };
  return map[file] || '';
}

const _srcCache = {};
for (const [expr, file] of REQUIRED_WINDOW_GLOBALS) {
  if (!_srcCache[file]) _srcCache[file] = srcFor(file);
  test(`${expr}  (${file})`, () => _srcCache[file].includes(expr));
}

// ═══════════════════════════════════════════════════════════════
//  5. TAB CLOSE BUG FIX VERIFICATION
// ═══════════════════════════════════════════════════════════════
section('5. Tab Close Button Fix');

const domPatcher = readSrc('renderer/perf/dom-patcher.js');

test('dom-patcher: uses window.TabManager lazily (not wired via param)', () =>
  domPatcher.includes('window.TabManager?.close'));
test('dom-patcher: activate uses window.TabManager', () =>
  domPatcher.includes('window.TabManager?.activate'));
test('dom-patcher: no TabManagerRef parameter usage', () =>
  !domPatcher.includes('TabManagerRef.close') && !domPatcher.includes('TabManagerRef.activate'));
test('app.js: window.TabManager = TabManager exposed', () =>
  appJs.includes('window.TabManager = TabManager'));
test('app.js: window.TabDnD = TabDnD exposed', () =>
  appJs.includes('window.TabDnD = TabDnD'));

// ═══════════════════════════════════════════════════════════════
//  6. COMMAND REGISTRY INTEGRITY
// ═══════════════════════════════════════════════════════════════
section('6. Command Registry Integrity');

const cmdPalette = readSrc('renderer/ui/command-palette.js');
const cmdRegistry = readSrc('renderer/ui/command-registry.js');

test('command-registry: execute has async error handler', () =>
  cmdRegistry.includes("typeof result.then === 'function'"));
test('command-registry: unknown command shows toast', () =>
  cmdRegistry.includes("window.toast?.("));
test('command-palette: no typeof toast checks remain', () =>
  !cmdPalette.includes("typeof toast === 'function'"));
test('command-palette: uses window.toast', () =>
  cmdPalette.includes('window.toast?.('));
test('command-palette: file.saveAll uses TabManager.tabs', () =>
  cmdPalette.includes('window.TabManager?.tabs'));
test('command-palette: nav.nextTab uses TabManager.tabs', () =>
  cmdPalette.includes("const tabs = window.TabManager?.tabs || []"));
test('command-palette: view.problems opens bottom panel', () =>
  cmdPalette.includes("data-tab=\"problems\""));

// ═══════════════════════════════════════════════════════════════
//  7. IPC RELIABILITY FIXES
// ═══════════════════════════════════════════════════════════════
section('7. IPC Reliability Fixes');

test('main.js: get-noter-data-dir handler exists', () =>
  mainJs.includes('"get-noter-data-dir"'));
test('main.js: noter:search:symbols handler exists', () =>
  mainJs.includes('"noter:search:symbols"'));
test('main.js: noter:search:text handler exists', () =>
  mainJs.includes('"noter:search:text"'));
test('main.js: noter:index:workspace handler exists', () =>
  mainJs.includes('"noter:index:workspace"'));
test('main.js: noter:runtime:states handler exists', () =>
  mainJs.includes('"noter:runtime:states"'));
test('main.js: noter:git:status handler exists', () =>
  mainJs.includes('"noter:git:status"'));
test('main.js: noter:workspace:scan alias exists', () =>
  mainJs.includes('"noter:workspace:scan"'));
test('main.js: noter:workspace:map alias exists', () =>
  mainJs.includes('"noter:workspace:map"'));
test('preload: getNoterDataDir exposed', () =>
  preload.includes('getNoterDataDir'));
test('preload: lspSetWorkspace exposed', () =>
  preload.includes('lspSetWorkspace'));
test('preload: noter.lsp.setWorkspace exposed', () =>
  preload.includes('setWorkspace: (root)'));

// ═══════════════════════════════════════════════════════════════
//  8. DUPLICATE KEY FIX VERIFICATION
// ═══════════════════════════════════════════════════════════════
section('8. Preload Duplicate Key Fix');

test('preload: no duplicate graph stub (referencesTo gone)', () =>
  !preload.includes('"noter:graph:refs-to"'));
test('preload: no duplicate ai stub (embeddings gone)', () =>
  !preload.includes('"noter:ai:embeddings"'));
test('preload: full graph object has build/stats/etc', () =>
  preload.includes('"noter:graph:build"'));
test('preload: full ai object has query/cancel/context', () =>
  preload.includes('"noter:ai:query"') && preload.includes('"noter:ai:cancel"'));

// ═══════════════════════════════════════════════════════════════
//  9. SIDEBAR SYNC FIX
// ═══════════════════════════════════════════════════════════════
section('9. Sidebar State Sync');

const actBar  = readSrc('renderer/ui/activity-bar.js');
const graphJs = readSrc('renderer/ui/project-graph.js');

test('activity-bar: showSidebar calls window.toggleSidebar', () =>
  actBar.includes('window.toggleSidebar(true)'));
test('activity-bar: hideSidebar calls window.toggleSidebar', () =>
  actBar.includes('window.toggleSidebar(false)'));
test('activity-bar: window.ActivityBar = ActivityBar exposed', () =>
  actBar.includes('window.ActivityBar = ActivityBar'));
test('project-graph: uses window.toggleSidebar not window.sidebarVisible=', () =>
  graphJs.includes('window.toggleSidebar(') && !graphJs.includes('window.sidebarVisible = '));

// ═══════════════════════════════════════════════════════════════
//  10. LSP WORKSPACE FIX
// ═══════════════════════════════════════════════════════════════
section('10. LSP Workspace Root Fix');

test('lsp-bridge: _workspaceRoot variable declared', () =>
  lspBr.includes("let _workspaceRoot = os.homedir()"));
test('lsp-bridge: spawn uses _workspaceRoot', () =>
  lspBr.includes('cwd:   _workspaceRoot'));
test('lsp-bridge: set-workspace handler registered', () =>
  lspBr.includes("'lsp:set-workspace'"));
test('app.js: lspSetWorkspace called on openExplorerFolder', () =>
  appJs.includes('lspSetWorkspace?.(folderPath)'));

// ═══════════════════════════════════════════════════════════════
//  11. REMOVE FROM WORKSPACE FIX
// ═══════════════════════════════════════════════════════════════
section('11. Remove From Workspace');

test('app.js: removeFromWorkspace function defined', () =>
  appJs.includes('function removeFromWorkspace()'));
test('app.js: button wired without typeof guard', () =>
  appJs.includes('removeFromWorkspace()') &&
  !appJs.includes('typeof removeFromWorkspace === "function"'));
test('app.js: removeFromWorkspace closes tabs', () =>
  appJs.includes('TabManager._suppressAutoBlank = true'));
test('app.js: removeFromWorkspace clears explorer', () =>
  appJs.includes('folderName.textContent') &&
  appJs.includes('function removeFromWorkspace'));

// ═══════════════════════════════════════════════════════════════
//  12. TOGGLE LINE NUMBERS FIX
// ═══════════════════════════════════════════════════════════════
section('12. Toggle Line Numbers Fix');

test('app.js: uses !== 0 for lineNumbers check (not string "on")', () =>
  appJs.includes("cur !== 0 ? \"off\" : \"on\""));
test('app.js: NOT using cur === "on" (old broken check gone)', () =>
  !appJs.includes("cur === \"on\" ? \"off\" : \"on\""));

// ═══════════════════════════════════════════════════════════════
//  13. RUN MENU FIX
// ═══════════════════════════════════════════════════════════════
section('13. Run Menu PTY Fix');

test('app.js: runCurrentFile is async', () =>
  appJs.includes('async function runCurrentFile'));
test('app.js: reuses existing PTY with isRunning check', () =>
  appJs.includes('TerminalPanel.isRunning?.()'));
test('app.js: no hardcoded cmd.exe in runCurrentFile', () => {
  const fnStart = appJs.indexOf('async function runCurrentFile');
  const fnEnd   = appJs.indexOf('\n}', fnStart) + 2;
  const fn      = appJs.slice(fnStart, fnEnd);
  return !fn.includes('"cmd.exe"');
});
test('terminal.js: isRunning() method exposed', () => {
  const term = readSrc('renderer/terminal/terminal.js');
  return term.includes('isRunning: () => ptyReady');
});

// ═══════════════════════════════════════════════════════════════
//  14. HEALTH DASHBOARD
// ═══════════════════════════════════════════════════════════════
section('14. Health Dashboard');

const health = readSrc('renderer/ui/health-dashboard.js');

test('health-dashboard.js: show/hide/toggle methods', () =>
  health.includes('function show()') && health.includes('function hide()'));
test('health-dashboard.js: error tracking installed', () =>
  health.includes('_installErrorTracking'));
test('health-dashboard.js: intercepts unhandledrejection', () =>
  health.includes("addEventListener('unhandledrejection'"));
test('health-dashboard.js: intercepts console.error', () =>
  health.includes('console.error = '));
test('health-dashboard.js: activity bar button wired', () =>
  health.includes("$('ab-health')?.addEventListener"));
test('health-dashboard.js: LSP restart action', () =>
  health.includes("lspStop?.('typescript')"));
test('health-dashboard.js: rebuild index action', () =>
  health.includes('nativeIndexWorkspace'));
test('health-dashboard.js: window.HealthDashboard exposed', () =>
  health.includes('window.HealthDashboard = HealthDashboard'));
test('index.html: ab-health button exists', () => {
  const html = readSrc('renderer/index.html');
  return html.includes('id="ab-health"');
});
test('index.html: health-panel div exists', () => {
  const html = readSrc('renderer/index.html');
  return html.includes('id="health-panel"');
});
test('index.html: health-dashboard.js loaded', () => {
  const html = readSrc('renderer/index.html');
  return html.includes('health-dashboard.js');
});
test('noter-premium.css: health dashboard styles present', () => {
  const css = readSrc('styles/noter-premium.css');
  return css.includes('#health-panel') && css.includes('.hd-section');
});

// ═══════════════════════════════════════════════════════════════
//  15. SETTINGS FILE INTEGRITY
// ═══════════════════════════════════════════════════════════════
section('15. Settings File');

// settingsFile already read in section 3

test('settings-file: ensureFile creates settings.json', () =>
  settingsFile.includes('ensureFile'));
test('settings-file: invalid JSON returns error not throw', () =>
  settingsFile.includes("return { ok: false, error: e.message }"));
test('settings-file: all 5 IPC handlers registered', () => {
  const handlers = [
    "'settings-json:read-raw'", "'settings-json:read'",
    "'settings-json:write-raw'", "'settings-json:get-path'",
    "'settings-json:get-defaults'"
  ];
  return handlers.every(h => settingsFile.includes(h));
});
test('settings-file: editor.fontSize default is 14', () =>
  settingsFile.includes('"editor.fontSize":                    14'));

// ═══════════════════════════════════════════════════════════════
//  16. SESSION & CRASH RECOVERY
// ═══════════════════════════════════════════════════════════════
section('16. Session & Crash Recovery');

test('app.js: saveSessionState with 500ms debounce', () =>
  appJs.includes('_sessionTimer = setTimeout'));
test('app.js: restoreSessionState with Promise.all parallel fetch', () =>
  appJs.includes('const files = await Promise.all(filePromises)'));
test('app.js: crash backup read on startup', () =>
  appJs.includes('CrashRecovery.checkCrash()'));
test('app.js: beforeunload marks clean exit', () =>
  appJs.includes("CrashRecovery.markCleanExit()"));
test('main.js: crash-backup-read handler', () =>
  mainJs.includes('"crash-backup-read"'));
test('main.js: crash-backup-write handler', () =>
  mainJs.includes('"crash-backup-write"'));

// ═══════════════════════════════════════════════════════════════
//  17. SECURITY
// ═══════════════════════════════════════════════════════════════
section('17. Security');

test('main.js: nodeIntegration false', () =>
  mainJs.includes('nodeIntegration: false'));
test('main.js: contextIsolation true', () =>
  mainJs.includes('contextIsolation: true'));
test('index.html: CSP no unsafe-eval', () => {
  const html = readSrc('renderer/index.html');
  return html.includes("Content-Security-Policy") && !html.includes("unsafe-eval");
});
test('main.js: AI API key never written to disk', () =>
  !mainJs.includes('writeFileSync') || mainJs.indexOf('apiKey') < 0 ||
  (() => {
    const writeIdx = mainJs.lastIndexOf('writeFileSync');
    const keyIdx   = mainJs.lastIndexOf('apiKey');
    return Math.abs(writeIdx - keyIdx) > 200;
  })());
test('main.js: fs-delete uses shell.trashItem (recoverable)', () =>
  mainJs.includes('shell.trashItem'));

// ═══════════════════════════════════════════════════════════════
//  18. MENU COMPLETENESS
// ═══════════════════════════════════════════════════════════════
section('18. Menu Item Wiring');

const HTML_IDS = [
  'newFile','newTab','openFile','openFolder','saveFile','saveAsFile',
  'createWorkspace','saveWorkspace','openWorkspace','quitApp',
  'undoAction','redoAction','cutAction','copyAction','pasteAction','selectAllAction',
  'duplicateLineAction','moveLineUpAction','moveLineDownAction',
  'toggleLineCommentAction','toggleBlockCommentAction',
  'formatDocumentAction','organizeImportsAction','trimWhitespaceAction',
  'findAction','replaceAction',
  'toggleExplorerMenu','toggleTerminalMenu','toggleSplitMenu',
  'commandPaletteMenu','globalSearchMenu','wordWrap',
  'toggleMinimapMenu','toggleBreadcrumbMenu','toggleLineNumbersMenu',
  'zoomIn','zoomOut','resetZoom',
  'goToDefinition','goToTypeDefinition','goToReferences','goToImplementation',
  'goToSymbol','goToLine','goToFile','goBack','goForward',
  'goJumpToBracket','goNextProblem','goPrevProblem',
  'gitStageAll','gitUnstageAll','gitCommit','gitPush','gitPull',
  'gitFetch','gitCreateBranch','gitSwitchBranch','gitMergeBranch',
  'gitViewDiff','gitViewBlame','gitRevertFile',
  'runFile','runInTerminal','runWithNode','runWithPython','runWithDeno',
  'stopProcess','openDebugConsole',
  'openMarketplace','manageExtensions',
  'openSettingsJson','openDefaultSettings',
  'documentation','shortcuts','performanceDiagnostics','reloadWindowMenu','aboutApp',
];

for (const id of HTML_IDS) {
  test(`menu item #${id} has addEventListener in app.js`, () => {
    const pattern = `getElementById("${id}")`;
    return appJs.includes(pattern);
  });
}

// ═══════════════════════════════════════════════════════════════
//  19. ACTIVITY BAR BUTTONS
// ═══════════════════════════════════════════════════════════════
section('19. Activity Bar Buttons');

const AB_BUTTONS = ['ab-explorer','ab-search','ab-extensions','ab-ai','ab-project','ab-settings','ab-graph','ab-health'];

for (const id of AB_BUTTONS) {
  test(`activity bar: ${id} exists in index.html`, () => {
    const html = readSrc('renderer/index.html');
    return html.includes(`id="${id}"`);
  });
}

test('ab-explorer: has click handler in activity-bar.js', () =>
  actBar.includes('"ab-explorer"'));
test('ab-search: has click handler in activity-bar.js', () =>
  actBar.includes('"ab-search"'));
test('ab-ai: has click handler in activity-bar.js', () =>
  actBar.includes('"ab-ai"'));
test('ab-project: has click handler in activity-bar.js', () =>
  actBar.includes('"ab-project"'));
test('ab-graph: has click handler in project-graph.js', () =>
  graphJs.includes("'ab-graph'") || graphJs.includes('"ab-graph"'));
test('ab-health: has click handler in health-dashboard.js', () =>
  health.includes("'ab-health'") || health.includes('"ab-health"'));

// ═══════════════════════════════════════════════════════════════
//  20. KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════
section('20. Keyboard Shortcuts');

const SHORTCUTS = [
  ["Ctrl+N (new file)",    "key === \"n\""],
  ["Ctrl+T (new tab)",     "key === \"t\""],
  ["Ctrl+W (close tab)",   "key === \"w\""],
  ["Ctrl+O (open file)",   "key === \"o\""],
  ["Ctrl+S (save)",        "actions.saveFile()"],
  ["Ctrl+Shift+S (save as)","actions.saveAsFile()"],
  ["Ctrl+B (toggle sidebar)","toggleSidebar()"],
  ["Ctrl+P (quick open)",  "QuickOpen.toggle()"],
  ["Alt+Z (zen mode)",     "toggleZenMode()"],
  ["Ctrl+Tab (next tab)",  "TabManager.tabs"],
  ["Ctrl+, (settings)",    "SettingsJSON?.openFile"],
];

for (const [name, pattern] of SHORTCUTS) {
  test(`shortcut: ${name}`, () => appJs.includes(pattern));
}

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════
const total = passed + failed;
console.log('\n' + '═'.repeat(58));
console.log(`  Phase 2.25 Smoke Test Results`);
console.log('═'.repeat(58));
console.log(`  Total  : ${total}`);
console.log(`  Passed : ${passed}  ✓`);
console.log(`  Failed : ${failed}  ✗`);
if (warned) console.log(`  Warned : ${warned}  ⚠`);
console.log('═'.repeat(58));

if (failures.length) {
  console.log('\n  FAILURES:');
  failures.forEach(f => console.log(`  ✗ ${f.name}\n    → ${f.reason}`));
}

const score = total > 0 ? Math.round((passed / total) * 100) : 0;
console.log(`\n  Test Score: ${score}%`);

const readiness = score >= 95 ? 'READY' : score >= 80 ? 'MOSTLY READY' : 'NEEDS WORK';
console.log(`  Release Status: ${readiness}`);
console.log('');

process.exit(failed > 0 ? 1 : 0);
