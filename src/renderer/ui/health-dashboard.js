// ═══════════════════════════════════════════════════════════════
//  HEALTH DASHBOARD — health-dashboard.js   (Phase 2.25)
//  Pure subscriber. No polling timers in renderer.
//  Main process pushes memory stats via noter:health:push.
//  Renderer just renders what it receives.
// ═══════════════════════════════════════════════════════════════

const HealthDashboard = (() => {
  const $ = (id) => document.getElementById(id);

  let _visible   = false;
  let _activeTab = 'system';
  let _errorLog  = [];          // { ts, source, message, level }
  let _mainMem   = null;        // last pushed memory snapshot from main process
  const MAX_ERRORS = 100;

  // ── Public API ────────────────────────────────────────────────

  function show() {
    _visible = true;
    window.electronAPI?.healthOpen?.();                 // tell main to start pushing
    window.electronAPI?.onHealthPush?.(_onMainMemPush); // subscribe once
    _render();
    $('health-panel').style.display = 'flex';
    $('health-panel').style.flexDirection = 'column';
  }

  function hide() {
    _visible = false;
    window.electronAPI?.healthClose?.();  // tell main to stop pushing
    window.electronAPI?.offHealthPush?.();
    $('health-panel').style.display = 'none';
  }

  function toggle() { _visible ? hide() : show(); }

  // ── Main process memory push (replaces setInterval in renderer) ──

  function _onMainMemPush(data) {
    _mainMem = data;
    if (_visible && _activeTab === 'system') _refreshBody();
  }

  // ── Track errors globally ─────────────────────────────────────

  function _installErrorTracking() {
    window.addEventListener('unhandledrejection', (e) => {
      _logError('UnhandledPromise', e.reason?.message || String(e.reason));
    });
    const _origError = console.error.bind(console);
    console.error = (...args) => {
      _logError('Console', args.map(a => (typeof a === 'object' ? JSON.stringify(a)?.slice(0, 120) : String(a))).join(' '));
      _origError(...args);
    };
    const _origWarn = console.warn.bind(console);
    console.warn = (...args) => {
      _logError('Warning', args.map(a => String(a)).join(' '), 'warn');
      _origWarn(...args);
    };
  }

  function _logError(source, message, level = 'error') {
    if (!message || message.includes('[health-dashboard]')) return;
    _errorLog.unshift({ ts: Date.now(), source, message: String(message).slice(0, 200), level });
    if (_errorLog.length > MAX_ERRORS) _errorLog.length = MAX_ERRORS;
    _updateHealthBadge();
  }

  function _updateHealthBadge() {
    const btn = $('ab-health');
    if (!btn) return;
    const errors = _errorLog.filter(e => e.level === 'error').length;
    let badge = btn.querySelector('.ab-health-badge');
    if (errors > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ab-health-badge';
        btn.appendChild(badge);
      }
      badge.textContent = errors > 9 ? '9+' : errors;
    } else {
      badge?.remove();
    }
  }

  // ── Panel render ──────────────────────────────────────────────

  function _render() {
    const panel = $('health-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="hd-header">
        <span class="hd-title">SYSTEM HEALTH</span>
        <button class="hd-refresh-btn" id="hd-refresh" title="Refresh">↻</button>
      </div>
      <div class="hd-tabs">
        <button class="hd-tab ${_activeTab==='system'?'hd-tab-active':''}" data-tab="system">System</button>
        <button class="hd-tab ${_activeTab==='services'?'hd-tab-active':''}" data-tab="services">Services</button>
        <button class="hd-tab ${_activeTab==='perf'?'hd-tab-active':''}" data-tab="perf">Performance</button>
        <button class="hd-tab ${_activeTab==='errors'?'hd-tab-active':''}" data-tab="errors">
          Errors${_errorLog.filter(e=>e.level==='error').length > 0
            ? `<span class="hd-tab-badge">${_errorLog.filter(e=>e.level==='error').length}</span>`
            : ''}
        </button>
      </div>
      <div class="hd-body" id="hd-body"></div>
    `;

    panel.querySelectorAll('.hd-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeTab = btn.dataset.tab;
        panel.querySelectorAll('.hd-tab').forEach(b => b.classList.toggle('hd-tab-active', b.dataset.tab === _activeTab));
        _refreshBody();
      });
    });

    $('hd-refresh')?.addEventListener('click', () => _refreshBody());
    _refreshBody();
  }

  async function _refreshBody() {
    const body = $('hd-body');
    if (!body) return;
    body.innerHTML = '<div class="hd-loading">Loading…</div>';
    try {
      switch (_activeTab) {
        case 'system':   body.innerHTML = await _buildSystemTab();   break;
        case 'services': body.innerHTML = await _buildServicesTab(); break;
        case 'perf':     body.innerHTML = _buildPerfTab();           break;
        case 'errors':   body.innerHTML = _buildErrorsTab();         break;
      }
      _wireBodyEvents();
    } catch (err) {
      body.innerHTML = `<div class="hd-error">Error: ${err.message}</div>`;
    }
  }

  // ── System tab — uses pushed main-process mem, no polling ─────

  async function _buildSystemTab() {
    // Fetch once on demand if no pushed data yet
    if (!_mainMem) {
      _mainMem = await window.electronAPI?.getProcessMemory?.().catch(() => null);
    }
    const heap  = window.PerformanceMonitor?.getSnapshot?.() || {};
    const tabs  = window.TabManager?.tabs?.length ?? 0;
    const mm    = window.ModelManager?.getStats?.() || {};
    const native = window.electronAPI?.nativeGitStatus ? '🟢 Loaded' : '🔴 Not built';
    const ws    = window.explorerState?.rootPath;

    return `
      <div class="hd-section">
        <div class="hd-section-title">PROCESS MEMORY</div>
        ${_row('Main Process RSS',    _mainMem ? `${_mainMem.mainRss ?? _mainMem.rss} MB`       : 'N/A')}
        ${_row('Renderer Heap Used',  heap.heapMB != null ? `${heap.heapMB} MB`                  : 'N/A')}
        ${_row('External / Native',   _mainMem ? `${_mainMem.mainExternal ?? _mainMem.external} MB` : 'N/A')}
      </div>
      <div class="hd-section">
        <div class="hd-section-title">EDITOR STATE</div>
        ${_row('Open Tabs',    tabs)}
        ${_row('Monaco Models', mm.monacoAll != null ? `${mm.monacoAll} (${mm.inactive||0} idle)` : 'N/A')}
        ${_row('FPS',          heap.fps != null ? `${heap.fps} FPS` : 'N/A')}
      </div>
      <div class="hd-section">
        <div class="hd-section-title">ENVIRONMENT</div>
        ${_row('Rust Core',    native)}
        ${_row('Workspace',    ws ? `<span title="${ws}">${_shortPath(ws)}</span>` : '<em>None open</em>')}
        ${_row('Symbol DB',    window._noterSymbolDb ? '🟢 Ready' : '🟡 Not indexed')}
        ${_row('Unhandled Errors', _errorLog.filter(e=>e.level==='error').length > 0
            ? `<span class="hd-val-bad">${_errorLog.filter(e=>e.level==='error').length}</span>`
            : '<span class="hd-val-good">0</span>')}
      </div>
    `;
  }

  // ── Services tab ──────────────────────────────────────────────

  async function _buildServicesTab() {
    let lspHtml = '<div class="hd-svc-row hd-svc-unknown">LSP bridge not available</div>';
    try {
      const lspStatus = await window.electronAPI?.lspStatus?.();
      if (lspStatus) {
        lspHtml = Object.entries(lspStatus).map(([id, s]) => {
          const dot = s.state === 'running' ? '🟢' : s.state === 'not_found' ? '🔴' : '🟡';
          return `<div class="hd-svc-row">
            ${dot} <span class="hd-svc-name">${s.name}</span>
            <span class="hd-svc-state">${s.state}</span>
            ${s.pid ? `<span class="hd-svc-pid">PID ${s.pid}</span>` : ''}
            ${s.state === 'not_found' ? `<div class="hd-svc-hint">${s.installHint || ''}</div>` : ''}
          </div>`;
        }).join('');
      }
    } catch {}

    const nativeDot = window.electronAPI?.nativeGitStatus ? '🟢' : '🔴';

    let watchHtml = '🟡 No workspace open';
    const wsRoot = window.explorerState?.rootPath;
    if (wsRoot) {
      try {
        const ws = await window.noter?.index?.watch?.stats?.({ workspaceRoot: wsRoot });
        watchHtml = ws?.isWatching ? '🟢 Watching' : '🔴 Stopped';
      } catch { watchHtml = '🟡 Stats unavailable'; }
    }

    let runtimeHtml = '';
    try {
      const rt = await window.noter?.runtime?.serviceStates?.();
      if (rt) {
        runtimeHtml = Object.entries(rt).map(([k, v]) => {
          const d = v === 'running' ? '🟢' : v === 'unavailable' ? '🔴' : '🟡';
          return _row(k, `${d} ${v}`);
        }).join('');
      }
    } catch {}

    return `
      <div class="hd-section">
        <div class="hd-section-title">LANGUAGE SERVERS</div>
        ${lspHtml}
      </div>
      <div class="hd-section">
        <div class="hd-section-title">NATIVE ENGINE</div>
        ${_row('Rust Core (noter-napi)', `${nativeDot} ${window.electronAPI?.nativeGitStatus ? 'Loaded' : 'Not built'}`)}
        ${_row('File Watch Engine', watchHtml)}
      </div>
      ${runtimeHtml ? `<div class="hd-section"><div class="hd-section-title">RUNTIME SERVICES</div>${runtimeHtml}</div>` : ''}
      <div class="hd-section">
        <div class="hd-section-title">ACTIONS</div>
        <div class="hd-btn-row">
          <button class="hd-action-btn" id="hd-restart-ts">Restart TypeScript LSP</button>
          <button class="hd-action-btn" id="hd-rebuild-index">Rebuild Symbol Index</button>
        </div>
      </div>
    `;
  }

  // ── Performance tab — renderer-side only, no async IPC ────────

  function _buildPerfTab() {
    const snap  = window.PerformanceMonitor?.getSnapshot?.() || {};
    const mem   = _mainMem;
    const mm    = window.ModelManager?.getStats?.() || {};
    const sched = window.Scheduler?.getStats?.() || {};
    const cache = window.PersistentCache?.getStats?.() || {};
    const pool  = window.WorkerPool?.getStats?.() || {};

    return `
      <div class="hd-section">
        <div class="hd-section-title">RENDERER</div>
        ${_row('FPS',            snap.fps != null ? `${snap.fps}` : 'N/A')}
        ${_row('Heap Used',      snap.heapMB != null ? `${snap.heapMB} MB` : 'N/A')}
        ${_row('Long Tasks',     snap.longTasks != null ? snap.longTasks : 'N/A')}
        ${_row('Layout Thrash',  snap.layoutThrash != null ? snap.layoutThrash : 'N/A')}
      </div>
      <div class="hd-section">
        <div class="hd-section-title">MAIN PROCESS</div>
        ${_row('RSS',         mem ? `${mem.mainRss ?? mem.rss} MB`               : 'N/A')}
        ${_row('Heap Used',   mem ? `${mem.mainHeapUsed ?? mem.heapUsed} MB`     : 'N/A')}
        ${_row('Heap Total',  mem ? `${mem.mainHeapTotal ?? mem.heapTotal} MB`   : 'N/A')}
        ${_row('External',    mem ? `${mem.mainExternal ?? mem.external} MB`     : 'N/A')}
      </div>
      <div class="hd-section">
        <div class="hd-section-title">EDITOR</div>
        ${_row('Open Tabs',      window.TabManager?.tabs?.length ?? 'N/A')}
        ${_row('Monaco Models',  mm.monacoAll ?? 'N/A')}
        ${_row('Idle Models',    mm.inactive ?? 'N/A')}
      </div>
      <div class="hd-section">
        <div class="hd-section-title">INFRASTRUCTURE</div>
        ${_row('Scheduler Tasks',  sched.pending ?? 'N/A')}
        ${_row('Cache Entries',    cache.entries ?? 'N/A')}
        ${_row('Worker Pools',     pool.pools ?? 'N/A')}
      </div>
      <div class="hd-section">
        <div class="hd-section-title">ACTIONS</div>
        <div class="hd-btn-row">
          <button class="hd-action-btn" id="hd-force-gc">Force Model GC</button>
          <button class="hd-action-btn" id="hd-clear-cache">Clear Cache</button>
        </div>
      </div>
    `;
  }

  // ── Errors tab ────────────────────────────────────────────────

  function _buildErrorsTab() {
    if (!_errorLog.length) {
      return `<div class="hd-empty"><span class="hd-ok-icon">✓</span><p>No errors recorded<br>in this session.</p></div>`;
    }
    const items = _errorLog.slice(0, 50).map(e => {
      const time = new Date(e.ts).toTimeString().slice(0, 8);
      const cls  = e.level === 'error' ? 'hd-err-error' : 'hd-err-warn';
      return `<div class="hd-err-item ${cls}">
        <span class="hd-err-time">${time}</span>
        <span class="hd-err-src">${e.source}</span>
        <span class="hd-err-msg">${e.message}</span>
      </div>`;
    }).join('');
    return `
      <div class="hd-err-toolbar">
        <button class="hd-action-btn hd-action-danger" id="hd-clear-errors">Clear Log</button>
        <span class="hd-err-count">${_errorLog.length} entries</span>
      </div>
      <div class="hd-err-list">${items}</div>
    `;
  }

  // ── Body event wiring ─────────────────────────────────────────

  function _wireBodyEvents() {
    $('hd-restart-ts')?.addEventListener('click', async () => {
      try {
        await window.electronAPI?.lspStop?.('typescript');
        await new Promise(r => setTimeout(r, 400));
        const r = await window.electronAPI?.lspStart?.('typescript');
        window.toast?.(r?.ok ? 'TypeScript LSP restarted ✓' : 'LSP restart failed', r?.ok ? 'success' : 'error');
        _refreshBody();
      } catch (e) { window.toast?.('LSP restart error: ' + e.message, 'error'); }
    });

    $('hd-rebuild-index')?.addEventListener('click', async () => {
      const root = window.explorerState?.rootPath;
      if (!root) return window.toast?.('Open a workspace first', 'warn');
      window.toast?.('Rebuilding symbol index…', 'info');
      try {
        const count = await window.electronAPI?.nativeIndexWorkspace?.(root, window._noterSymbolDb || '');
        window.toast?.(`Index rebuilt — ${count ?? 0} symbols`, 'success');
      } catch (e) { window.toast?.('Index error: ' + e.message, 'error'); }
    });

    $('hd-force-gc')?.addEventListener('click', () => {
      window.ModelManager?.forceCleanup?.();
      window.MemoryManager?.gc?.();
      window.toast?.('GC triggered', 'info');
      setTimeout(_refreshBody, 600);
    });

    $('hd-clear-cache')?.addEventListener('click', () => {
      if (!confirm('Clear session cache? Settings and history are preserved.')) return;
      Object.keys(localStorage)
        .filter(k => k.startsWith('noter.') && !['noter.settings.user','noter.keybindings'].includes(k))
        .forEach(k => localStorage.removeItem(k));
      window.toast?.('Cache cleared', 'info');
    });

    $('hd-clear-errors')?.addEventListener('click', () => {
      _errorLog.length = 0;
      _updateHealthBadge();
      _refreshBody();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  function _row(label, value) {
    return `<div class="hd-row"><span class="hd-label">${label}</span><span class="hd-value">${value}</span></div>`;
  }

  function _shortPath(p) {
    const parts = (p || '').replace(/\\/g, '/').split('/');
    return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p;
  }

  // ── Activity bar wiring ───────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    _installErrorTracking();

    $('ab-health')?.addEventListener('click', () => {
      const sidebar = $('sidebar');
      const panel   = $('health-panel');
      const isOpen  = panel?.style.display !== 'none' && !sidebar?.classList.contains('hidden');

      if (isOpen) {
        if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
        else sidebar?.classList.add('hidden');
        $('ab-health')?.classList.remove('ab-active');
        hide();
        return;
      }

      ['explorer-content','no-folder-msg','search-panel',
       'project-overview-panel','code-graph-panel','ai-chat-panel'].forEach(id => {
        const el = $(id); if (el) el.style.display = 'none';
      });

      if (typeof window.toggleSidebar === 'function') window.toggleSidebar(true);
      else { sidebar?.classList.remove('hidden'); $('resize-handle')?.classList.remove('hidden'); }

      const title = sidebar?.querySelector('.sidebar-title');
      if (title) title.textContent = 'SYSTEM HEALTH';

      document.querySelectorAll('.ab-btn').forEach(b => b.classList.remove('ab-active'));
      $('ab-health')?.classList.add('ab-active');

      show();
    });
  });

  return { show, hide, toggle, logError: _logError };
})();

window.HealthDashboard = HealthDashboard;
