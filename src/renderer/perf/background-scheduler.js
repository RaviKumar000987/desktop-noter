// ═══════════════════════════════════════════════════════════════
//  NOTER BACKGROUND SCHEDULER — src/renderer/perf/background-scheduler.js
//
//  Priority-aware task queue that runs jobs off the UI thread via
//  requestIdleCallback (with a setTimeout fallback).
//
//  Three priority lanes:
//    HIGH   — diagnostics, user-triggered actions     (~next idle frame)
//    MEDIUM — indexing, git status                    (batched, yielding)
//    LOW    — cleanup, telemetry, prefetch            (deeply deferred)
//
//  Usage:
//    Scheduler.schedule('diagnostics', () => runDiag(), Scheduler.HIGH);
//    Scheduler.schedule('index-file',  () => index(f), Scheduler.MEDIUM);
//    Scheduler.cancel('diagnostics');
// ═══════════════════════════════════════════════════════════════
'use strict';

window.Scheduler = (() => {
  const HIGH   = 0;
  const MEDIUM = 1;
  const LOW    = 2;

  // queue per priority: Array<{ key, fn, deadline }>
  const _queues = [[], [], []];
  // key → priority (for cancel)
  const _keys   = new Map();

  let _running   = false;
  let _idleHandle = null;

  // Budget per idle tick (ms) by priority
  const BUDGET = [12, 8, 4];

  // ── Internal ──────────────────────────────────────────────────

  function _hasWork() {
    return _queues.some(q => q.length > 0);
  }

  function _runBatch(deadline) {
    _running = true;
    _idleHandle = null;

    for (let pri = HIGH; pri <= LOW; pri++) {
      const q      = _queues[pri];
      const budget = BUDGET[pri];
      const start  = performance.now();

      while (q.length) {
        const item = q[0];

        // Respect idle deadline or our own budget
        const timeLeft = deadline
          ? deadline.timeRemaining()
          : budget - (performance.now() - start);

        if (timeLeft < 1 && pri !== HIGH) break; // yield for MEDIUM/LOW

        q.shift();
        _keys.delete(item.key);

        try { item.fn(); } catch (e) {
          console.error(`[Scheduler] Task "${item.key}" threw:`, e);
        }

        if (pri !== HIGH && (performance.now() - start) >= budget) break;
      }
    }

    _running = false;
    if (_hasWork()) _requestTick();
  }

  function _requestTick() {
    if (_idleHandle) return;
    if (typeof requestIdleCallback === 'function') {
      _idleHandle = requestIdleCallback(_runBatch, { timeout: 300 });
    } else {
      _idleHandle = setTimeout(() => _runBatch(null), 16);
    }
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Schedule a task.
   * @param {string}   key      - unique identifier (duplicate replaces old)
   * @param {Function} fn       - work to run
   * @param {number}   priority - HIGH | MEDIUM | LOW  (default MEDIUM)
   */
  function schedule(key, fn, priority = MEDIUM) {
    // Deduplicate: cancel previous task with same key
    cancel(key);

    const q = _queues[priority];
    q.push({ key, fn });
    _keys.set(key, priority);

    if (!_running) _requestTick();
  }

  /** Remove a pending task by key (no-op if already run). */
  function cancel(key) {
    if (!_keys.has(key)) return;
    const pri = _keys.get(key);
    const q   = _queues[pri];
    const idx = q.findIndex(item => item.key === key);
    if (idx !== -1) q.splice(idx, 1);
    _keys.delete(key);
  }

  /** Schedule a one-shot delayed task (falls back to setTimeout). */
  function defer(key, fn, delayMs = 0, priority = LOW) {
    const handle = setTimeout(() => schedule(key, fn, priority), delayMs);
    return () => { clearTimeout(handle); cancel(key); };
  }

  function pending() {
    return _queues.reduce((n, q) => n + q.length, 0);
  }

  function stats() {
    return {
      high:   _queues[HIGH].length,
      medium: _queues[MEDIUM].length,
      low:    _queues[LOW].length,
      total:  pending(),
    };
  }

  return { schedule, cancel, defer, pending, stats, HIGH, MEDIUM, LOW };
})();
