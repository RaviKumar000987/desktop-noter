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

// Generic safe call helper
function _call(fn, ...args) {
  const n = load();
  if (!n || typeof n[fn] !== 'function') return null;
  try { return n[fn](...args); }
  catch (e) { console.warn(`[noter-native] ${fn}:`, e.message); return null; }
}
function _callArr(fn, ...args) { return _call(fn, ...args) || []; }
function _callBool(fn, ...args) { return _call(fn, ...args) || false; }

// ── Phase 1: Search ───────────────────────────────────────────────────────────
function searchWorkspace(root, pattern, cs = false) { return _callArr('searchWorkspace', root, pattern, cs); }
function indexWorkspace(root, dbPath)               { return _call('indexWorkspace', root, dbPath) || 0; }
function searchSymbols(dbPath, query)               { return _callArr('searchSymbols', dbPath, query); }

// ── Phase 1: Git ──────────────────────────────────────────────────────────────
function gitStatus(repoPath)                        { return _call('gitStatus', repoPath); }
function gitDiff(repoPath, filePath = null)         { return _call('gitDiff', repoPath, filePath) || { files: [] }; }
function gitLog(repoPath, maxCount = 50, fp = null) { return _callArr('gitLog', repoPath, maxCount, fp); }
function gitBranches(repoPath)                      { return _callArr('gitBranches', repoPath); }

// ── Phase 1: Cache ────────────────────────────────────────────────────────────
function cacheSet(dbPath, ns, key, value) {
  const n = load(); if (!n) return;
  try { n.cacheSet(dbPath, ns, key, JSON.stringify(value)); } catch {}
}
function cacheGet(dbPath, ns, key) {
  const raw = _call('cacheGet', dbPath, ns, key);
  return raw ? JSON.parse(raw) : null;
}

// ── Phase 1.5: Project Intelligence ──────────────────────────────────────────
function scanProjectWorkspace(root)  { return _call('scanProjectWorkspace', root); }
function invalidateProjectCache(root){ _call('invalidateProjectCache', root); }

// ── Phase 1.75: Watch Engine ──────────────────────────────────────────────────
function startWorkspaceWatch(root)   { return _callBool('startWorkspaceWatch', root); }
function stopWorkspaceWatch(root)    { return _callBool('stopWorkspaceWatch', root); }
function pollWatchEvents(root)       { return _callArr('pollWatchEvents', root); }
function requestFileReindex(r, p)    { return _callBool('requestFileReindex', r, p); }
function getWatchStats(root)         { return _call('getWatchStats', root); }

// ── Phase 2: Code Graph ───────────────────────────────────────────────────────
function buildCodeGraph(root)            { return _call('buildCodeGraph', root); }
function updateGraphFile(root, file)     { return _call('updateGraphFile', root, file); }
function invalidateCodeGraph(root)       { _call('invalidateCodeGraph', root); }
function getGraphStats(root)             { return _call('getGraphStats', root); }
function queryGraphNode(root, name)      { return _callArr('queryGraphNode', root, name); }
function getFileImports(root, file)      { return _callArr('getFileImports', root, file); }
function getFileImporters(root, file)    { return _callArr('getFileImporters', root, file); }
function analyzeImpact(root, file)       { return _call('analyzeImpact', root, file); }
function findDeadCode(root)              { return _callArr('findDeadCode', root); }
function findDependencyCycles(root)      { return _callArr('findDependencyCycles', root); }
function checkArchViolations(root, pat)  { return _callArr('checkArchViolations', root, pat); }
function findImportPath(root, from, to)  { return _call('findImportPath', root, from, to); }

// ── Phase 2.1: Symbol Intelligence ───────────────────────────────────────────
function buildSymbolCallGraph(r, sDb, cDb)     { return _call('buildSymbolCallGraph', r, sDb, cDb); }
function hydrateSymbolGraph(r, cDb)            { return _call('hydrateSymbolGraph', r, cDb); }
function updateSymbolFile(r, fp, sDb, cDb)     { return _call('updateSymbolFile', r, fp, sDb, cDb); }
function findSymbolCallers(r, id, sDb)         { return _callArr('findSymbolCallers', r, id, sDb); }
function findSymbolCallees(r, id, sDb)         { return _callArr('findSymbolCallees', r, id, sDb); }
function findSymbolImplementations(r, n, sDb)  { return _callArr('findSymbolImplementations', r, n, sDb); }
function traceExecutionFlow(r, id, d, sDb)     { return _call('traceExecutionFlow', r, id, d, sDb); }
function getSymbolImpact(r, id, sDb)           { return _call('getSymbolImpact', r, id, sDb); }

// ── Phase 2.2: AI Context ─────────────────────────────────────────────────────
function buildAiContext(r, q, sDb, proj)       { return _call('buildAiContext', r, q, sDb, proj); }
function buildAiPrompt(r, q, sDb, proj, model) { return _call('buildAiPrompt', r, q, sDb, proj, model); }
function invalidateAiContext(root)             { _call('invalidateAiContext', root); }

// ── Phase 2.3: Reasoning Engine ───────────────────────────────────────────────
function analyzeProject(root)       { return _call('analyzeProject', root); }
function getProjectRisk(root)       { return _callArr('getProjectRisk', root); }
function getProjectDebt(root)       { return _call('getProjectDebt', root); }
function invalidateReasoning(root)  { _call('invalidateReasoning', root); }

// ── Phase 2.5: Memory Engine ──────────────────────────────────────────────────
function memoryBumpSession(db, ws)                      { return _call('memoryBumpSession', db, ws); }
function memoryGetSession(db, ws)                       { return _call('memoryGetSession', db, ws); }
function memoryRecordFileOpen(db, ws, fp)               { _call('memoryRecordFileOpen', db, ws, fp); }
function memoryGetFileHistory(db, ws, limit)            { return _callArr('memoryGetFileHistory', db, ws, limit); }
function memoryRecordAiQuery(db, ws, query)             { _call('memoryRecordAiQuery', db, ws, query); }
function memoryGetAiQueries(db, ws, limit)              { return _callArr('memoryGetAiQueries', db, ws, limit); }
function memoryGetPatterns(db, ws)                      { return _call('memoryGetPatterns', db, ws); }
function memoryUpdatePatterns(db, ws, n, fw, arch, lang){ _call('memoryUpdatePatterns', db, ws, n, fw, arch, lang); }
function memoryDetectNaming(db, ws)                     { return _call('memoryDetectNaming', db, ws); }
function memoryGetContext(db, ws)                       { return _call('memoryGetContext', db, ws); }
function memoryGetInsights(db, ws)                      { return _callArr('memoryGetInsights', db, ws); }
function memoryGetWelcome(db, ws)                       { return _call('memoryGetWelcome', db, ws); }
function memoryClearWorkspace(db, ws)                   { _call('memoryClearWorkspace', db, ws); }

function isAvailable() { return load() !== null; }

module.exports = {
  isAvailable,
  // Search
  searchWorkspace, indexWorkspace, searchSymbols,
  // Git (full — status + diff + log + branches)
  gitStatus, gitDiff, gitLog, gitBranches,
  // Cache
  cacheSet, cacheGet,
  // Project
  scanProjectWorkspace, invalidateProjectCache,
  // Watch
  startWorkspaceWatch, stopWorkspaceWatch, pollWatchEvents, requestFileReindex, getWatchStats,
  // Code Graph
  buildCodeGraph, updateGraphFile, invalidateCodeGraph, getGraphStats,
  queryGraphNode, getFileImports, getFileImporters, analyzeImpact,
  findDeadCode, findDependencyCycles, checkArchViolations, findImportPath,
  // Symbol Intelligence
  buildSymbolCallGraph, hydrateSymbolGraph, updateSymbolFile,
  findSymbolCallers, findSymbolCallees, findSymbolImplementations,
  traceExecutionFlow, getSymbolImpact,
  // AI Context
  buildAiContext, buildAiPrompt, invalidateAiContext,
  // Reasoning Engine (Phase 2.3 — Rust)
  analyzeProject, getProjectRisk, getProjectDebt, invalidateReasoning,
  // Memory Engine (Phase 2.5 — Rust SQLite)
  memoryBumpSession, memoryGetSession, memoryRecordFileOpen, memoryGetFileHistory,
  memoryRecordAiQuery, memoryGetAiQueries, memoryGetPatterns, memoryUpdatePatterns,
  memoryDetectNaming, memoryGetContext, memoryGetInsights, memoryGetWelcome, memoryClearWorkspace,
};
