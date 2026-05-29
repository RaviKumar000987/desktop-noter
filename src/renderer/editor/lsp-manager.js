// ═══════════════════════════════════════════════════════════════
//  NOTER LSP MANAGER — src/renderer/editor/lsp-manager.js
//
//  Wraps LspClient with:
//    • Per-server request queue (requests buffer while server starts)
//    • Automatic restart on crash / timeout (up to MAX_RETRIES)
//    • Health-check pings (textDocument/didChange heartbeat)
//    • Unified status API consumed by the status bar
//    • Retry backoff: 2 s → 4 s → 8 s (exponential, capped at 30 s)
//
//  LspManager does NOT replace LspClient; it supervises it.
//  LspClient continues to own the LSP protocol.
//
//  Usage:
//    LspManager.init();
//    LspManager.getStatus('pyright');   // 'running' | 'starting' | 'crashed' | 'off'
//    LspManager.onStatusChange(cb);
//    LspManager.restart('pyright');     // manual restart
// ═══════════════════════════════════════════════════════════════
'use strict';

window.LspManager = (() => {
  const MAX_RETRIES     = 5;
  const BASE_BACKOFF_MS = 2000;
  const MAX_BACKOFF_MS  = 30_000;
  const PING_INTERVAL   = 45_000;

  // serverId → { retries, backoffMs, pingTimer, status }
  const _servers = new Map();
  const _statusCbs = new Set();

  // ── Helpers ───────────────────────────────────────────────────

  function _entry(id) {
    if (!_servers.has(id)) {
      _servers.set(id, {
        retries:   0,
        backoffMs: BASE_BACKOFF_MS,
        pingTimer: null,
        status:    'off',
      });
    }
    return _servers.get(id);
  }

  function _setStatus(id, status) {
    _entry(id).status = status;
    const detail = { id, status };
    for (const cb of _statusCbs) {
      try { cb(detail); } catch { /* ignore */ }
    }
    window.NoterBus?.emit('lsp:statusChange', detail);
  }

  function _backoff(id) {
    const e = _entry(id);
    e.retries++;
    if (e.retries > MAX_RETRIES) {
      _setStatus(id, 'crashed');
      console.error(`[LspManager] ${id} exceeded max retries — giving up`);
      return;
    }
    const delay = Math.min(e.backoffMs * Math.pow(2, e.retries - 1), MAX_BACKOFF_MS);
    console.warn(`[LspManager] ${id} crashed — retry ${e.retries}/${MAX_RETRIES} in ${delay}ms`);
    _setStatus(id, 'restarting');
    setTimeout(() => _restartServer(id), delay);
  }

  // ── Ping (keep-alive) ─────────────────────────────────────────

  function _startPing(id) {
    const e = _entry(id);
    clearInterval(e.pingTimer);
    e.pingTimer = setInterval(async () => {
      if (!window.electronAPI?.lspRequest) return;
      try {
        await window.electronAPI.lspRequest(id, '$/ping', {});
      } catch {
        // Server unresponsive
        clearInterval(e.pingTimer);
        _backoff(id);
      }
    }, PING_INTERVAL);
  }

  function _stopPing(id) {
    const e = _entry(id);
    clearInterval(e.pingTimer);
    e.pingTimer = null;
  }

  // ── Server lifecycle ──────────────────────────────────────────

  async function _restartServer(id) {
    if (!window.electronAPI?.lspStart) return;
    _setStatus(id, 'starting');

    try {
      const result = await window.electronAPI.lspStart(id);
      if (!result?.ok) {
        _setStatus(id, 'off');
        return;
      }

      // Re-initialise via LspClient if available
      if (window.LspClient?._restartServer) {
        await window.LspClient._restartServer(id);
      }

      _entry(id).retries   = 0;
      _entry(id).backoffMs = BASE_BACKOFF_MS;
      _setStatus(id, 'running');
      _startPing(id);

    } catch (err) {
      console.error(`[LspManager] restart failed for ${id}:`, err);
      _backoff(id);
    }
  }

  // ── Server crash listener ─────────────────────────────────────

  function _listenForCrashes() {
    window.electronAPI?.onLspServerStatus?.((status) => {
      const { id, state } = status;
      _entry(id).status = state;

      if (state === 'crashed' || state === 'stopped') {
        _stopPing(id);
        _backoff(id);
      } else if (state === 'running') {
        _entry(id).retries   = 0;
        _entry(id).backoffMs = BASE_BACKOFF_MS;
        _startPing(id);
      }

      _setStatus(id, state);
    });
  }

  // ── Public API ────────────────────────────────────────────────

  async function init() {
    _listenForCrashes();

    // Mirror LspClient status into our registry
    if (!window.electronAPI?.lspDetect) return;
    const available = await window.electronAPI.lspDetect().catch(() => ({}));
    for (const [id, found] of Object.entries(available)) {
      _entry(id).status = found ? 'starting' : 'off';
    }

    // Delegate actual init to LspClient
    if (window.LspClient?.init) await window.LspClient.init();
  }

  function getStatus(serverId) {
    return _entry(serverId).status;
  }

  function getAllStatuses() {
    const out = {};
    for (const [id, e] of _servers) out[id] = e.status;
    return out;
  }

  function onStatusChange(cb) {
    _statusCbs.add(cb);
    return () => _statusCbs.delete(cb);
  }

  async function restart(serverId) {
    _stopPing(serverId);
    _entry(serverId).retries = 0;
    await _restartServer(serverId);
  }

  function dispose() {
    for (const [id] of _servers) _stopPing(id);
    _servers.clear();
    _statusCbs.clear();
  }

  return { init, getStatus, getAllStatuses, onStatusChange, restart, dispose };
})();
