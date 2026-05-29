"use strict";
/**
 * NOTER — Performance Monitor
 *
 * Continuously samples renderer heap, frame rate, and event-loop lag.
 * Fires warnings (via callback + console) when thresholds are breached.
 * History arrays allow a diagnostics panel to draw sparklines.
 *
 * Usage:
 *   PerformanceMonitor.start((warning) => showToast(warning.message, 'warning'));
 *   const snap = PerformanceMonitor.getSnapshot();
 *   PerformanceMonitor.stop();
 */
const PerformanceMonitor = (() => {
  // ── Thresholds ────────────────────────────────────────────────────────────
  const SAMPLE_MS    = 3_000;   // how often to sample
  const WARN_HEAP_MB = 512;     // renderer heap warning threshold (MB)
  const WARN_MODELS  = 40;      // Monaco model count warning
  const WARN_LAG_MS  = 80;      // event-loop lag warning (ms)
  const WARN_FPS     = 25;      // FPS warning floor
  const MAX_HISTORY  = 40;      // samples retained (≈ 2 min at 3 s)

  // ── State ─────────────────────────────────────────────────────────────────
  let _rafId      = null;
  let _sampleId   = null;
  let _running    = false;
  let _onWarn     = null;

  // FPS tracking via requestAnimationFrame
  let _fps         = 60;
  let _frameCount  = 0;
  let _bucketMs    = 0;
  let _lastRafTs   = 0;

  // Sampled history: { t: ms-timestamp, v: number }[]
  const _history = { heapMB: [], fps: [], lagMs: [] };

  // Warning deduplication — each key fires once until condition clears
  const _warned = new Set();

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _push(key, v) {
    _history[key].push({ t: Date.now(), v });
    if (_history[key].length > MAX_HISTORY) _history[key].shift();
  }

  function _rafLoop(ts) {
    if (_lastRafTs === 0) { _lastRafTs = ts; _rafId = requestAnimationFrame(_rafLoop); return; }
    const delta = ts - _lastRafTs;
    _lastRafTs  = ts;
    _frameCount++;
    _bucketMs  += delta;

    if (_bucketMs >= 1_000) {
      _fps        = Math.round((_frameCount * 1_000) / _bucketMs);
      _frameCount = 0;
      _bucketMs   = 0;
    }
    _rafId = requestAnimationFrame(_rafLoop);
  }

  async function _sample() {
    // Heap (Chromium exposes this in renderer; undefined in non-Chromium)
    const mem    = performance.memory;
    const heapMB = mem ? Math.round(mem.usedJSHeapSize / 1_048_576) : 0;

    // Event-loop lag: schedule a 0ms timeout and measure actual delay
    const t0  = Date.now();
    await new Promise(r => setTimeout(r, 0));
    const lagMs = Date.now() - t0;

    // Monaco model count
    const modelStats = (typeof ModelManager !== "undefined")
      ? ModelManager.getStats() : { monacoAll: 0 };

    _push("heapMB", heapMB);
    _push("fps",    _fps);
    _push("lagMs",  lagMs);

    // Issue warnings (each fires once per condition onset)
    _checkWarn("heap",   heapMB > WARN_HEAP_MB,   heapMB <= WARN_HEAP_MB,
      `Renderer heap is high: ${heapMB} MB (threshold ${WARN_HEAP_MB} MB)`);

    _checkWarn("models", modelStats.monacoAll > WARN_MODELS, modelStats.monacoAll <= WARN_MODELS,
      `High Monaco model count: ${modelStats.monacoAll} (threshold ${WARN_MODELS}). Consider closing unused tabs.`);

    _checkWarn("lag",    lagMs > WARN_LAG_MS,   lagMs <= WARN_LAG_MS,
      `Event-loop lag: ${lagMs}ms — UI may be stuttering`);

    _checkWarn("fps",    _fps > 0 && _fps < WARN_FPS, _fps >= WARN_FPS,
      `Low frame rate: ${_fps} FPS — renderer may be overloaded`);
  }

  function _checkWarn(key, condition, clearCond, msg) {
    if (condition && !_warned.has(key)) {
      _warned.add(key);
      console.warn("[PerformanceMonitor]", msg);
      _onWarn?.({ key, message: msg });
    }
    if (clearCond) _warned.delete(key);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function start(onWarn) {
    if (_running) return;
    _running  = true;
    _onWarn   = onWarn || null;
    _lastRafTs = 0;
    _rafId    = requestAnimationFrame(_rafLoop);
    _sampleId = setInterval(_sample, SAMPLE_MS);
  }

  function stop() {
    if (!_running) return;
    _running = false;
    cancelAnimationFrame(_rafId);
    clearInterval(_sampleId);
    _rafId = _sampleId = null;
  }

  /** Current snapshot — safe to call at any time. */
  function getSnapshot() {
    const mem    = performance.memory;
    const heapMB = mem ? Math.round(mem.usedJSHeapSize / 1_048_576) : null;
    const models = (typeof ModelManager !== "undefined") ? ModelManager.getStats() : null;
    return { heapMB, fps: _fps, models, history: _history };
  }

  return { start, stop, getSnapshot };
})();

window.PerformanceMonitor = PerformanceMonitor;
