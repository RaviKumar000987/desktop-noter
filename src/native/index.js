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

/** Check if Rust native core loaded successfully */
function isAvailable() {
  return load() !== null;
}

module.exports = {
  isAvailable,
  searchWorkspace,
  gitStatus,
  indexWorkspace,
  searchSymbols,
  cacheSet,
  cacheGet,
};
