"use strict";
/**
 * NOTER — Monaco Model Lifecycle Manager
 *
 * Tracks every Monaco model created by TabManager, enforces an LRU cap,
 * and runs background cleanup to prevent heap accumulation.
 *
 * Integration points:
 *   TabManager.create() → ModelManager.register(model)
 *   TabManager.close()  → ModelManager.dispose(model)
 *   SplitEditor.open()  → ModelManager.acquire(model)
 *   SplitEditor.close() → ModelManager.release(model)
 */
const ModelManager = (() => {
  const MAX_MODELS       = 50;        // hard cap — evict oldest idle when exceeded
  const CLEANUP_INTERVAL = 60_000;    // background sweep every 60 s
  const IDLE_EVICT_MS    = 600_000;   // evict unreferenced models idle > 10 min

  // uri-string → { model, refs, lastUsed }
  const _cache = new Map();
  let _sweepId = null;

  // ── Internal ──────────────────────────────────────────────────────────────

  function _evictUnreferenced(needed) {
    const candidates = [..._cache.entries()]
      .filter(([, e]) => e.refs === 0 && !e.model.isDisposed())
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed); // oldest first

    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
      const [key, entry] = candidates[i];
      try { entry.model.dispose(); } catch { /* ignore */ }
      _cache.delete(key);
    }
  }

  function _sweep() {
    const now = Date.now();

    // 1. Remove stale disposed entries
    for (const [key, entry] of _cache) {
      if (entry.model.isDisposed()) _cache.delete(key);
    }

    // 2. Evict unreferenced models that have been idle too long
    for (const [key, entry] of _cache) {
      if (entry.refs === 0 && (now - entry.lastUsed) > IDLE_EVICT_MS) {
        try { entry.model.dispose(); } catch { /* ignore */ }
        _cache.delete(key);
      }
    }

    // 3. If still over the cap, evict oldest unreferenced
    if (_cache.size > MAX_MODELS) {
      _evictUnreferenced(_cache.size - MAX_MODELS);
    }

    // 4. Sweep orphan models created outside ModelManager
    if (typeof monaco !== "undefined") {
      for (const m of monaco.editor.getModels()) {
        const key = m.uri.toString();
        if (m.uri.scheme === "noter" && !_cache.has(key)) {
          try { m.dispose(); } catch { /* ignore */ }
        }
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function start() {
    if (_sweepId) return;
    _sweepId = setInterval(_sweep, CLEANUP_INTERVAL);
  }

  function stop() {
    clearInterval(_sweepId);
    _sweepId = null;
  }

  /** Register a newly created model with an initial ref-count of 1. */
  function register(model) {
    const key = model.uri.toString();
    _cache.set(key, { model, refs: 1, lastUsed: Date.now() });

    // Over cap? Evict immediately (don't wait for the sweep timer).
    if (_cache.size > MAX_MODELS) {
      _evictUnreferenced(_cache.size - MAX_MODELS);
    }
  }

  /** Increment ref-count (e.g. split editor opens the same model). */
  function acquire(model) {
    const entry = _cache.get(model.uri.toString());
    if (entry) { entry.refs++; entry.lastUsed = Date.now(); }
  }

  /** Decrement ref-count. Drops to 0 → eligible for idle eviction. */
  function release(model) {
    const entry = _cache.get(model.uri.toString());
    if (entry) {
      entry.refs = Math.max(0, entry.refs - 1);
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Fully dispose and remove a model (tab closed).
   * Safe to call on already-disposed or unregistered models.
   */
  function dispose(model) {
    _cache.delete(model.uri.toString());
    try { if (!model.isDisposed()) model.dispose(); } catch { /* ignore */ }
  }

  /** Manually trigger a cleanup pass (e.g. before workspace switch). */
  function forceCleanup() { _sweep(); }

  function getStats() {
    const inactive = [..._cache.values()].filter(e => e.refs === 0).length;
    const monacoAll = typeof monaco !== "undefined"
      ? monaco.editor.getModels().length : 0;
    return { tracked: _cache.size, inactive, monacoAll };
  }

  function getDiagnostics() {
    return [..._cache.entries()].map(([uri, e]) => ({
      uri,
      refs:     e.refs,
      idleSec:  Math.round((Date.now() - e.lastUsed) / 1000),
      disposed: e.model.isDisposed(),
    }));
  }

  return {
    start, stop,
    register, acquire, release, dispose,
    forceCleanup, getStats, getDiagnostics,
  };
})();

window.ModelManager = ModelManager;
