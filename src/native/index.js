const path = require('path');

let native = null;

function load() {
  if (native) return native;
  try {
    native = require(path.join(__dirname, 'noter_core.node'));
  } catch (e) {
    console.warn('[noter-native] Failed to load Rust core:', e.message);
    native = null;
  }
  return native;
}

/**
 * Search files in workspace — replaces search.worker.js
 * @param {string} root
 * @param {string} pattern
 * @param {boolean} caseSensitive
 * @returns {Array<{file,line,column,text,matchStart,matchEnd}>}
 */
function searchWorkspace(root, pattern, caseSensitive = false) {
  const n = load();
  if (!n) return [];
  return n.searchWorkspace(root, pattern, caseSensitive);
}

/**
 * Get git status for a repo path
 * @param {string} repoPath
 * @returns {{branch, ahead, behind, files: Array<{path, status}>} | null}
 */
function gitStatus(repoPath) {
  const n = load();
  if (!n) return null;
  try {
    return n.gitStatus(repoPath);
  } catch {
    return null;
  }
}

/**
 * Index all files in workspace and write to SQLite DB
 * @param {string} root
 * @param {string} dbPath
 * @returns {number} symbols indexed
 */
function indexWorkspace(root, dbPath) {
  const n = load();
  if (!n) return 0;
  return n.indexWorkspace(root, dbPath);
}

/**
 * Search symbols by name — used for Ctrl+P / Go-to-Symbol
 * @param {string} dbPath
 * @param {string} query
 * @returns {Array<{name,kind,file,line,column,container}>}
 */
function searchSymbols(dbPath, query) {
  const n = load();
  if (!n) return [];
  return n.searchSymbols(dbPath, query);
}

/**
 * Persistent cache set
 */
function cacheSet(dbPath, namespace, key, value) {
  const n = load();
  if (!n) return;
  n.cacheSet(dbPath, namespace, key, JSON.stringify(value));
}

/**
 * Persistent cache get
 */
function cacheGet(dbPath, namespace, key) {
  const n = load();
  if (!n) return null;
  const raw = n.cacheGet(dbPath, namespace, key);
  return raw ? JSON.parse(raw) : null;
}

// ── Project Intelligence (Phase 1.5) ─────────────────────────────────────────

/**
 * Scan a workspace and return full project intelligence (language, framework,
 * dependency, architecture, project map). Results are cached by manifest hash.
 * @param {string} root  Absolute workspace root path
 * @returns {object|null}  JsProjectInfo or null if Rust core unavailable
 */
function scanProjectWorkspace(root) {
  const n = load();
  if (!n || typeof n.scanProjectWorkspace !== 'function') return null;
  try {
    return n.scanProjectWorkspace(root);
  } catch (e) {
    console.warn('[noter-native] scanProjectWorkspace error:', e.message);
    return null;
  }
}

/**
 * Force-invalidate cached project scan for a workspace root.
 * @param {string} root
 */
function invalidateProjectCache(root) {
  const n = load();
  if (!n || typeof n.invalidateProjectCache !== 'function') return;
  try {
    n.invalidateProjectCache(root);
  } catch {}
}

// ── AI Context Engine (Phase 2.2) ────────────────────────────────────────────

function _aiCall(fn, ...args) {
  const n = load();
  if (!n || typeof n[fn] !== 'function') return null;
  try { return n[fn](...args); } catch (e) { console.warn(`[noter-native] ${fn}:`, e.message); return null; }
}

function buildAiContext(root, query, symbolDb, project) { return _aiCall('buildAiContext', root, query, symbolDb, project); }
function buildAiPrompt(root, query, symbolDb, project, model) { return _aiCall('buildAiPrompt', root, query, symbolDb, project, model); }
function invalidateAiContext(root) { return _aiCall('invalidateAiContext', root); }

// ── Symbol Intelligence Engine (Phase 2.1) ────────────────────────────────────

function _symCall(fn, ...args) {
  const n = load();
  if (!n || typeof n[fn] !== 'function') return null;
  try { return n[fn](...args); } catch (e) { console.warn(`[noter-native] ${fn}:`, e.message); return null; }
}

function buildSymbolCallGraph(root, symbolDbPath, callDbPath) { return _symCall('buildSymbolCallGraph', root, symbolDbPath, callDbPath); }
function hydrateSymbolGraph(root, callDbPath)               { return _symCall('hydrateSymbolGraph', root, callDbPath); }
function updateSymbolFile(root, filePath, symbolDb, callDb) { return _symCall('updateSymbolFile', root, filePath, symbolDb, callDb); }
function findSymbolCallers(root, symbolId, symbolDb)        { return _symCall('findSymbolCallers', root, symbolId, symbolDb) || []; }
function findSymbolCallees(root, symbolId, symbolDb)        { return _symCall('findSymbolCallees', root, symbolId, symbolDb) || []; }
function findSymbolImplementations(root, ifaceName, symbolDb) { return _symCall('findSymbolImplementations', root, ifaceName, symbolDb) || []; }
function traceExecutionFlow(root, startId, maxDepth, symbolDb) { return _symCall('traceExecutionFlow', root, startId, maxDepth, symbolDb); }
function getSymbolImpact(root, symbolId, symbolDb)          { return _symCall('getSymbolImpact', root, symbolId, symbolDb); }

// ── Code Graph Engine (Phase 2) ───────────────────────────────────────────────

function _graphCall(fn, ...args) {
  const n = load();
  if (!n || typeof n[fn] !== 'function') return null;
  try { return n[fn](...args); } catch (e) { console.warn(`[noter-native] ${fn}:`, e.message); return null; }
}

function buildCodeGraph(root)                   { return _graphCall('buildCodeGraph', root); }
function updateGraphFile(root, file)            { return _graphCall('updateGraphFile', root, file); }
function invalidateCodeGraph(root)              { return _graphCall('invalidateCodeGraph', root); }
function getGraphStats(root)                    { return _graphCall('getGraphStats', root); }
function queryGraphNode(root, name)             { return _graphCall('queryGraphNode', root, name) || []; }
function getFileImports(root, file)             { return _graphCall('getFileImports', root, file) || []; }
function getFileImporters(root, file)           { return _graphCall('getFileImporters', root, file) || []; }
function analyzeImpact(root, file)              { return _graphCall('analyzeImpact', root, file); }
function findDeadCode(root)                     { return _graphCall('findDeadCode', root) || []; }
function findDependencyCycles(root)             { return _graphCall('findDependencyCycles', root) || []; }
function checkArchViolations(root, pattern)     { return _graphCall('checkArchViolations', root, pattern) || []; }
function findImportPath(root, from, to)         { return _graphCall('findImportPath', root, from, to); }

// ── Incremental Watch Engine (Phase 1.75) ─────────────────────────────────────

function startWorkspaceWatch(root) {
  const n = load();
  if (!n || typeof n.startWorkspaceWatch !== 'function') return false;
  try { return n.startWorkspaceWatch(root); } catch (e) { console.warn('[noter-native] startWorkspaceWatch:', e.message); return false; }
}

function stopWorkspaceWatch(root) {
  const n = load();
  if (!n || typeof n.stopWorkspaceWatch !== 'function') return false;
  try { return n.stopWorkspaceWatch(root); } catch (e) { return false; }
}

function pollWatchEvents(root) {
  const n = load();
  if (!n || typeof n.pollWatchEvents !== 'function') return [];
  try { return n.pollWatchEvents(root) || []; } catch { return []; }
}

function requestFileReindex(root, path) {
  const n = load();
  if (!n || typeof n.requestFileReindex !== 'function') return false;
  try { return n.requestFileReindex(root, path); } catch { return false; }
}

function getWatchStats(root) {
  const n = load();
  if (!n || typeof n.getWatchStats !== 'function') return null;
  try { return n.getWatchStats(root); } catch { return null; }
}

/** Check if Rust native core loaded successfully */
function isAvailable() {
  return load() !== null;
}

module.exports = {
  isAvailable,
  buildAiContext,
  buildAiPrompt,
  invalidateAiContext,
  buildSymbolCallGraph,
  hydrateSymbolGraph,
  updateSymbolFile,
  findSymbolCallers,
  findSymbolCallees,
  findSymbolImplementations,
  traceExecutionFlow,
  getSymbolImpact,
  buildCodeGraph, updateGraphFile, invalidateCodeGraph, getGraphStats,
  queryGraphNode, getFileImports, getFileImporters, analyzeImpact,
  findDeadCode, findDependencyCycles, checkArchViolations, findImportPath,
  searchWorkspace,
  gitStatus,
  indexWorkspace,
  searchSymbols,
  cacheSet,
  cacheGet,
  scanProjectWorkspace,
  invalidateProjectCache,
  startWorkspaceWatch,
  stopWorkspaceWatch,
  pollWatchEvents,
  requestFileReindex,
  getWatchStats,
};
