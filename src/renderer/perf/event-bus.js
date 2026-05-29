// ═══════════════════════════════════════════════════════════════
//  NOTER EVENT BUS  — src/renderer/perf/event-bus.js
//  Lightweight typed pub/sub. Replaces direct cross-module calls
//  so no module needs to import another — just emit an event.
//
//  Usage:
//    NoterBus.on('tab:activated', ({ id }) => ...)
//    NoterBus.emit('tab:activated', { id: 'tab-1' })
//    const unsub = NoterBus.on(...); unsub();          // unsubscribe
//    NoterBus.once('monaco:ready', () => ...)          // fires once
// ═══════════════════════════════════════════════════════════════
'use strict';

window.NoterBus = (() => {
  const _listeners = new Map(); // event → Set<handler>

  function on(event, handler) {
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event).add(handler);
    return () => _listeners.get(event)?.delete(handler);
  }

  function once(event, handler) {
    const unsub = on(event, (data) => { unsub(); handler(data); });
    return unsub;
  }

  function emit(event, data) {
    const set = _listeners.get(event);
    if (!set) return;
    for (const h of set) {
      try { h(data); } catch (e) {
        console.error(`[NoterBus] Error in handler for "${event}":`, e);
      }
    }
  }

  function off(event, handler) {
    _listeners.get(event)?.delete(handler);
  }

  // Drain all listeners for an event (used in tests / resets)
  function clear(event) {
    if (event) _listeners.delete(event);
    else _listeners.clear();
  }

  return { on, once, emit, off, clear };
})();
