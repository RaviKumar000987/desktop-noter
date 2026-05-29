// ═══════════════════════════════════════════════════════════════
//  NOTER PERSISTENT CACHE — src/renderer/perf/persistent-cache.js
//
//  IndexedDB-backed key/value cache with TTL and namespace support.
//  Replaces in-memory re-computation on every startup with an
//  instant read from the local DB.
//
//  Stores: symbols, diagnostics, workspace state, git status,
//          search results, extension manifests.
//
//  Usage:
//    await PersistentCache.init();
//    await PersistentCache.set('symbols', '/src/app.js', data, 3600);
//    const v = await PersistentCache.get('symbols', '/src/app.js');
//    await PersistentCache.delete('symbols', '/src/app.js');
//    await PersistentCache.clear('symbols');
// ═══════════════════════════════════════════════════════════════
'use strict';

window.PersistentCache = (() => {
  const DB_NAME    = 'noter-cache-v1';
  const DB_VERSION = 1;
  const STORE      = 'entries';    // { ns_key, value, expiresAt }

  let _db = null;

  // ── IndexedDB helpers ─────────────────────────────────────────

  function _open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db    = e.target.result;
        const store = db.createObjectStore(STORE, { keyPath: 'ns_key' });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      };

      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function _tx(mode = 'readonly') {
    return _db.transaction(STORE, mode).objectStore(STORE);
  }

  function _promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Expiry pruning (runs on init) ─────────────────────────────

  function _pruneExpired() {
    const store     = _tx('readwrite');
    const idx       = store.index('expiresAt');
    const range     = IDBKeyRange.upperBound(Date.now());
    const req       = idx.openCursor(range);

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  }

  // ── Public API ────────────────────────────────────────────────

  async function init() {
    if (_db) return;
    _db = await _open();
    _pruneExpired();
  }

  /**
   * Store a value.
   * @param {string} ns       - namespace  (e.g. 'symbols', 'git')
   * @param {string} key      - item key   (e.g. '/src/app.js')
   * @param {*}      value    - any serialisable value
   * @param {number} ttlSec   - time-to-live in seconds (0 = no expiry)
   */
  async function set(ns, key, value, ttlSec = 0) {
    if (!_db) await init();
    const expiresAt = ttlSec > 0 ? Date.now() + ttlSec * 1000 : Infinity;
    return _promisify(_tx('readwrite').put({ ns_key: `${ns}::${key}`, value, expiresAt }));
  }

  /**
   * Retrieve a value (returns null if missing or expired).
   */
  async function get(ns, key) {
    if (!_db) await init();
    const record = await _promisify(_tx().get(`${ns}::${key}`));
    if (!record) return null;
    if (record.expiresAt !== Infinity && record.expiresAt < Date.now()) {
      _promisify(_tx('readwrite').delete(`${ns}::${key}`));
      return null;
    }
    return record.value;
  }

  async function del(ns, key) {
    if (!_db) await init();
    return _promisify(_tx('readwrite').delete(`${ns}::${key}`));
  }

  /** Delete all entries in a namespace. */
  async function clear(ns) {
    if (!_db) await init();
    const store = _tx('readwrite');
    const range = IDBKeyRange.bound(`${ns}::`, `${ns}::￿`);
    return new Promise((resolve, reject) => {
      const req = store.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { resolve(); return; }
        cursor.delete();
        cursor.continue();
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /** Get all keys in a namespace. */
  async function keys(ns) {
    if (!_db) await init();
    const store  = _tx();
    const range  = IDBKeyRange.bound(`${ns}::`, `${ns}::￿`);
    const result = await _promisify(store.getAllKeys(range));
    return result.map(k => k.slice(ns.length + 2));
  }

  /** Wipe the entire cache (all namespaces). */
  async function clearAll() {
    if (!_db) await init();
    return _promisify(_tx('readwrite').clear());
  }

  async function size() {
    if (!_db) await init();
    return _promisify(_tx().count());
  }

  return { init, set, get, delete: del, clear, keys, clearAll, size };
})();
