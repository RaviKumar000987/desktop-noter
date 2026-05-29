// ═══════════════════════════════════════════════════════════════
//  NOTER MEMORY MANAGER — src/renderer/perf/memory-manager.js
//
//  Tracks every disposable resource created by the app:
//    • Event listeners registered with NoterBus
//    • DOM event listeners
//    • setInterval / setTimeout handles
//    • Web Workers
//    • Custom disposables ({ dispose() })
//
//  On memory pressure (performance.memory) or explicit gc() calls,
//  disposes idle resources in priority order.
//
//  Usage:
//    MemoryManager.track('bus', unsub);           // NoterBus unsub fn
//    MemoryManager.track('interval', id);         // clearInterval handle
//    MemoryManager.track('worker', worker);        // Worker instance
//    MemoryManager.track('custom', { dispose() {} });
//    MemoryManager.untrack(handle);               // remove by handle ref
//    MemoryManager.gc();                          // forced sweep
// ═══════════════════════════════════════════════════════════════
'use strict';

window.MemoryManager = (() => {
  // type → Set<entry>
  const _registry = new Map([
    ['bus',      new Set()],
    ['interval', new Set()],
    ['timeout',  new Set()],
    ['worker',   new Set()],
    ['custom',   new Set()],
  ]);

  // ref → type (for O(1) untrack)
  const _index = new Map();

  let _sweepId     = null;
  let _pressureId  = null;

  const SWEEP_INTERVAL = 120_000; // 2 min

  // ── Disposal helpers ──────────────────────────────────────────

  function _dispose(type, ref) {
    try {
      switch (type) {
        case 'bus':      if (typeof ref === 'function') ref(); break;
        case 'interval': clearInterval(ref);  break;
        case 'timeout':  clearTimeout(ref);   break;
        case 'worker':   if (ref && ref.terminate) ref.terminate(); break;
        case 'custom':   if (ref && ref.dispose)   ref.dispose();   break;
      }
    } catch { /* ignore disposal errors */ }
  }

  // ── Pressure detection ────────────────────────────────────────

  function _checkPressure() {
    if (!performance.memory) return;
    const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
    const ratio = usedJSHeapSize / jsHeapSizeLimit;

    if (ratio > 0.85) {
      console.warn(`[MemoryManager] Heap pressure at ${(ratio * 100).toFixed(1)}% — running GC`);
      gc();
      NoterBus?.emit('memory:pressure', { ratio });
    }
  }

  // ── Public API ────────────────────────────────────────────────

  /** Start background sweep + pressure checks. */
  function start() {
    if (_sweepId) return;
    _sweepId    = setInterval(_sweep, SWEEP_INTERVAL);
    _pressureId = setInterval(_checkPressure, 30_000);
  }

  function stop() {
    clearInterval(_sweepId);
    clearInterval(_pressureId);
    _sweepId    = null;
    _pressureId = null;
  }

  /**
   * Register a resource for tracking.
   * Returns the original ref (for chaining or direct assignment).
   */
  function track(type, ref) {
    if (!_registry.has(type)) _registry.set(type, new Set());
    _registry.get(type).add(ref);
    _index.set(ref, type);
    return ref;
  }

  /** Remove and dispose a tracked resource immediately. */
  function untrack(ref) {
    const type = _index.get(ref);
    if (!type) return;
    _registry.get(type)?.delete(ref);
    _index.delete(ref);
    _dispose(type, ref);
  }

  /**
   * Forced GC sweep.
   * Disposes resources marked as disposed/terminated by the runtime
   * but not yet removed from our registry.
   */
  function gc() {
    // Sweep terminated workers
    for (const w of _registry.get('worker') || []) {
      if (w._terminated) {
        _registry.get('worker').delete(w);
        _index.delete(w);
      }
    }

    // Emit GC event so ModelManager / other subs can sweep too
    window.NoterBus?.emit('memory:gc', {});
  }

  function _sweep() {
    _checkPressure();
    gc();
  }

  /** Dispose ALL tracked resources (called on app close). */
  function disposeAll() {
    for (const [type, set] of _registry) {
      for (const ref of set) _dispose(type, ref);
      set.clear();
    }
    _index.clear();
  }

  function stats() {
    const out = {};
    for (const [type, set] of _registry) out[type] = set.size;
    out.total = _index.size;
    if (performance.memory) {
      const m = performance.memory;
      out.heapUsedMB  = (m.usedJSHeapSize  / 1048576).toFixed(1);
      out.heapLimitMB = (m.jsHeapSizeLimit  / 1048576).toFixed(1);
      out.heapRatio   = (m.usedJSHeapSize  / m.jsHeapSizeLimit).toFixed(3);
    }
    return out;
  }

  return { start, stop, track, untrack, gc, disposeAll, stats };
})();
