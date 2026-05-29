// ═══════════════════════════════════════════════════════════════
//  LAZY LOADER  — src/renderer/perf/lazy-loader.js
//  Defers loading of non-critical scripts until the browser is
//  idle. Prevents startup jank by keeping the main thread free
//  while the editor initialises.
//
//  Usage:
//    NoterLoader.defer('src/path/to/script.js')
//    NoterLoader.defer(['a.js', 'b.js'], { priority: 'high' })
//    NoterLoader.onIdle(() => heavySetupTask())
// ═══════════════════════════════════════════════════════════════
'use strict';

window.NoterLoader = (() => {
  const _queue    = [];  // { src, resolve, reject }
  const _loaded   = new Set();
  let   _running  = false;

  // Polyfill for requestIdleCallback (Edge/older Electron)
  const _idle = window.requestIdleCallback
    ? (cb, opts) => window.requestIdleCallback(cb, opts)
    : (cb)       => setTimeout(() => cb({ timeRemaining: () => 50 }), 16);

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (_loaded.has(src)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload  = () => { _loaded.add(src); resolve(); };
      s.onerror = (e) => {
        console.warn(`[NoterLoader] Failed to load: ${src}`);
        resolve(); // non-fatal — don't block the queue
      };
      document.head.appendChild(s);
    });
  }

  async function _drainQueue(deadline) {
    while (_queue.length > 0) {
      // Yield to the browser if we're running low on idle time
      if (deadline && deadline.timeRemaining() < 5 && _queue.length > 1) {
        _idle(_drainQueue, { timeout: 2000 });
        return;
      }
      const item = _queue.shift();
      try {
        await _loadScript(item.src);
        item.resolve();
      } catch (e) {
        item.reject(e);
      }
    }
    _running = false;
  }

  function _ensureRunning() {
    if (_running) return;
    _running = true;
    _idle(_drainQueue, { timeout: 3000 });
  }

  // Queue a script for deferred idle-time loading
  function defer(src) {
    return new Promise((resolve, reject) => {
      if (typeof src === 'string') {
        _queue.push({ src, resolve, reject });
      }
      _ensureRunning();
    });
  }

  // Queue multiple scripts (loaded in given order)
  function deferAll(srcs) {
    return srcs.reduce(
      (chain, src) => chain.then(() => defer(src)),
      Promise.resolve()
    );
  }

  // Run a callback during idle time (no script loading)
  function onIdle(fn) {
    _idle(() => {
      try { fn(); } catch (e) { console.error('[NoterLoader] onIdle error:', e); }
    }, { timeout: 5000 });
  }

  // Load immediately (bypass the queue — for urgent scripts)
  function loadNow(src) {
    return _loadScript(src);
  }

  return { defer, deferAll, onIdle, loadNow };
})();
