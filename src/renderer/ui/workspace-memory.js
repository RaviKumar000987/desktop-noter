// ═══════════════════════════════════════════════════════════════
//  WORKSPACE MEMORY UI — workspace-memory.js   (Phase 2.5)
//  Pure subscriber. All persistence in Rust SQLite via IPC.
//  Renderer: renders data it receives. No localStorage, no computation.
// ═══════════════════════════════════════════════════════════════

const WorkspaceMemory = (() => {
  const $ = (id) => document.getElementById(id);

  let _visible   = false;
  let _activeTab = 'session';
  let _workspace = null;

  // ── Public: record events (called from app.js / ai-chat.js) ───

  function recordFileOpen(filePath, workspaceRoot) {
    if (!filePath || !workspaceRoot) return;
    window.noter?.memory?.recordFile({ workspace: workspaceRoot, filePath }).catch?.(() => {});
  }

  function recordAiQuery(query, workspaceRoot) {
    if (!query || !workspaceRoot) return;
    window.noter?.memory?.recordQuery({ workspace: workspaceRoot, query: String(query).slice(0, 120) }).catch?.(() => {});
  }

  function recordProjectData(data, workspaceRoot) {
    if (!data || !workspaceRoot) return;
    window.noter?.memory?.updatePatterns({
      workspace:    workspaceRoot,
      naming:       null,
      framework:    data.framework    || data.primaryFramework  || null,
      architecture: data.architecture || data.architectureStyle || null,
      language:     data.language     || data.primaryLanguage   || null,
    }).catch?.(() => {});
  }

  async function getContext(workspaceRoot) {
    if (!workspaceRoot) return null;
    try { return await window.noter?.memory?.getContext({ workspace: workspaceRoot }); }
    catch { return null; }
  }

  async function getWelcomeInsight(workspaceRoot) {
    if (!workspaceRoot) return null;
    try { return await window.noter?.memory?.getWelcome({ workspace: workspaceRoot }); }
    catch { return null; }
  }

  // ── Public API ─────────────────────────────────────────────────

  function show() {
    _visible   = true;
    _workspace = window.explorerState?.rootPath || null;
    if (_workspace) {
      window.noter?.memory?.bumpSession({ workspace: _workspace }).catch?.(() => {});
    }
    _render();
    const p = $('memory-panel');
    if (p) { p.style.display = 'flex'; p.style.flexDirection = 'column'; }
  }

  function hide() {
    _visible = false;
    const p = $('memory-panel');
    if (p) p.style.display = 'none';
  }

  function toggle() { _visible ? hide() : show(); }

  // ── Panel skeleton ─────────────────────────────────────────────

  function _render() {
    const panel = $('memory-panel');
    if (!panel) return;
    const TABS = [
      ['session', 'Session'],
      ['patterns','Patterns'],
      ['history', 'History'],
      ['insights','Insights'],
      ['prefs',   'Prefs'],
    ];
    panel.innerHTML = `
      <div class="wm-header">
        <span class="wm-title">WORKSPACE MEMORY</span>
        <button class="wm-icon-btn" id="wm-clear-btn" title="Clear workspace memory">⊗</button>
      </div>
      <div class="wm-tabs">
        ${TABS.map(([id, label]) =>
          `<button class="wm-tab ${_activeTab===id?'wm-tab-active':''}" data-tab="${id}">${label}</button>`
        ).join('')}
      </div>
      <div class="wm-body" id="wm-body"><div class="wm-loading">Loading…</div></div>
    `;

    panel.querySelectorAll('.wm-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeTab = btn.dataset.tab;
        panel.querySelectorAll('.wm-tab').forEach(b =>
          b.classList.toggle('wm-tab-active', b.dataset.tab === _activeTab));
        _refreshBody();
      });
    });

    $('wm-clear-btn')?.addEventListener('click', async () => {
      if (!_workspace) return;
      if (!confirm('Clear all memory for this workspace?')) return;
      await window.noter?.memory?.clear({ workspace: _workspace }).catch?.(() => {});
      window.toast?.('Workspace memory cleared', 'info');
      _refreshBody();
    });

    _refreshBody();
  }

  async function _refreshBody() {
    const body = $('wm-body');
    if (!body) return;

    if (!_workspace) {
      body.innerHTML = `<div class="wm-empty"><div class="wm-empty-icon">🧠</div><p>Open a workspace to use<br>Workspace Memory.</p></div>`;
      return;
    }

    body.innerHTML = '<div class="wm-loading">Loading…</div>';

    try {
      switch (_activeTab) {
        case 'session':  body.innerHTML = await _buildSession();  break;
        case 'patterns': body.innerHTML = await _buildPatterns(); break;
        case 'history':  body.innerHTML = await _buildHistory();  break;
        case 'insights': body.innerHTML = await _buildInsights(); break;
        case 'prefs':    body.innerHTML = await _buildPrefs();    break;
      }
      _wireBodyEvents();
    } catch (err) {
      body.innerHTML = `<div class="wm-error">Error: ${err.message}</div>`;
    }
  }

  // ── Tab: Session ───────────────────────────────────────────────

  async function _buildSession() {
    const s     = await window.noter?.memory?.getSession({ workspace: _workspace }).catch(() => null) || {};
    const files = await window.noter?.memory?.getFileHistory({ workspace: _workspace, limit: 8 }).catch(() => []) || [];
    const wsName = _workspace.split(/[/\\]/).pop();

    const fileRows = files.map(f => {
      const name = f.path.split(/[/\\]/).pop();
      return `<div class="wm-file-row">
        <span class="wm-file-name" title="${f.path}">${name}</span>
        <span class="wm-file-meta">${f.opens} open${f.opens !== 1 ? 's' : ''} · ${_relTime(f.lastOpened)}</span>
      </div>`;
    }).join('');

    return `
      <div class="wm-section">
        <div class="wm-section-title">THIS WORKSPACE</div>
        ${_row('Project',     wsName)}
        ${_row('Sessions',    s.sessionCount || 0)}
        ${_row('Last Active', s.lastActive ? _relTime(s.lastActive / 1000) : 'Just now')}
        ${_row('Last File',   s.lastFile ? s.lastFile.split(/[/\\]/).pop() : 'None yet')}
      </div>
      <div class="wm-section">
        <div class="wm-section-title">RECENT FILES (${files.length})</div>
        ${fileRows || '<div class="wm-empty-hint">Open files to start tracking.</div>'}
      </div>
    `;
  }

  // ── Tab: Patterns ──────────────────────────────────────────────

  async function _buildPatterns() {
    const pat = await window.noter?.memory?.getPatterns({ workspace: _workspace }).catch(() => null) || {};

    return `
      <div class="wm-section">
        <div class="wm-section-title">DETECTED PATTERNS</div>
        ${_row('Naming Convention', pat.naming       || '—')}
        ${_row('Architecture',      pat.architecture || '—')}
        ${_row('Framework',         pat.framework    || '—')}
        ${_row('Language',          pat.language     || '—')}
      </div>
      <div class="wm-section">
        <div class="wm-section-title">HOW THIS HELPS</div>
        <p class="wm-info-text">
          AI suggestions follow your project's naming conventions and architecture instead of generic code.
        </p>
        <button class="wm-action-btn" id="wm-scan-btn">Scan Workspace Now</button>
      </div>
    `;
  }

  // ── Tab: History ───────────────────────────────────────────────

  async function _buildHistory() {
    const files   = await window.noter?.memory?.getFileHistory({ workspace: _workspace, limit: 12 }).catch(() => []) || [];
    const queries = await window.noter?.memory?.getQueries({ workspace: _workspace, limit: 10 }).catch(() => []) || [];

    const sortedFiles = [...files].sort((a, b) => b.lastOpened - a.lastOpened);

    const fRows = sortedFiles.map(f => `
      <div class="wm-hist-row">
        <span class="wm-hist-icon">📄</span>
        <span class="wm-hist-name" title="${f.path}">${f.path.split(/[/\\]/).pop()}</span>
        <span class="wm-hist-time">${_relTime(f.lastOpened / 1000)}</span>
      </div>`).join('');

    const qRows = queries.map(q => `
      <div class="wm-hist-row">
        <span class="wm-hist-icon">💬</span>
        <span class="wm-hist-name">${q.query.length > 45 ? q.query.slice(0, 45) + '…' : q.query}</span>
        <span class="wm-hist-time">${_relTime(q.at / 1000)}</span>
      </div>`).join('');

    return `
      <div class="wm-section">
        <div class="wm-section-title">FILE HISTORY (${sortedFiles.length})</div>
        ${fRows || '<div class="wm-empty-hint">Open files to build history.</div>'}
      </div>
      ${queries.length ? `
      <div class="wm-section">
        <div class="wm-section-title">AI QUERY HISTORY (${queries.length})</div>
        ${qRows}
      </div>` : ''}
    `;
  }

  // ── Tab: Insights ──────────────────────────────────────────────

  async function _buildInsights() {
    const insights = await window.noter?.memory?.getInsights({ workspace: _workspace }).catch(() => []) || [];

    if (insights.length <= 1) return `<div class="wm-empty">
      <div class="wm-empty-icon">💡</div>
      <p>Insights appear as you work.<br>Open files and use AI chat<br>to build workspace context.</p>
    </div>`;

    return `<div class="wm-section">
      <div class="wm-section-title">WORKSPACE INSIGHTS</div>
      ${insights.map(i => `
        <div class="wm-insight-row">
          <span class="wm-insight-icon">${i.icon}</span>
          <div class="wm-insight-body">
            <div class="wm-insight-title">${i.title}</div>
            <div class="wm-insight-detail">${i.detail}</div>
          </div>
        </div>`).join('')}
    </div>`;
  }

  // ── Tab: Prefs ─────────────────────────────────────────────────

  async function _buildPrefs() {
    const files   = await window.noter?.memory?.getFileHistory({ workspace: _workspace, limit: 60 }).catch(() => []) || [];
    const queries = await window.noter?.memory?.getQueries({ workspace: _workspace, limit: 30 }).catch(() => []) || [];
    const pat     = await window.noter?.memory?.getPatterns({ workspace: _workspace }).catch(() => null) || {};

    const patCount = Object.values(pat).filter(Boolean).length;

    return `
      <div class="wm-section">
        <div class="wm-section-title">MEMORY STATS</div>
        ${_row('Files Tracked',  files.length)}
        ${_row('AI Queries',     queries.length)}
        ${_row('Patterns',       patCount + ' detected')}
      </div>
      <div class="wm-section">
        <div class="wm-section-title">ACTIONS</div>
        <div class="wm-btn-row">
          <button class="wm-action-btn" id="wm-export-btn">Export Memory JSON</button>
          <button class="wm-action-btn wm-action-danger" id="wm-clear-ws-btn">Clear This Workspace</button>
        </div>
      </div>
    `;
  }

  // ── Body event wiring ──────────────────────────────────────────

  function _wireBodyEvents() {
    $('wm-scan-btn')?.addEventListener('click', async () => {
      if (!_workspace) return;
      window.toast?.('Scanning workspace patterns…', 'info');
      try {
        const data = await window.noter?.project?.scan({ workspaceRoot: _workspace });
        if (data) {
          recordProjectData(data, _workspace);
          await window.noter?.memory?.detectNaming({ workspace: _workspace }).catch?.(() => {});
          window.toast?.('Patterns updated', 'success');
          _refreshBody();
        }
      } catch {}
    });

    $('wm-export-btn')?.addEventListener('click', async () => {
      if (!_workspace) return;
      try {
        const [session, files, queries, patterns, insights] = await Promise.all([
          window.noter?.memory?.getSession({ workspace: _workspace }).catch(() => null),
          window.noter?.memory?.getFileHistory({ workspace: _workspace, limit: 60 }).catch(() => []),
          window.noter?.memory?.getQueries({ workspace: _workspace, limit: 30 }).catch(() => []),
          window.noter?.memory?.getPatterns({ workspace: _workspace }).catch(() => null),
          window.noter?.memory?.getInsights({ workspace: _workspace }).catch(() => []),
        ]);
        const dump = { workspace: _workspace, session, files, queries, patterns, insights };
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'noter-memory-export.json';
        a.click();
      } catch {}
    });

    $('wm-clear-ws-btn')?.addEventListener('click', async () => {
      if (!_workspace) return;
      if (!confirm('Clear all memory for this workspace?')) return;
      await window.noter?.memory?.clear({ workspace: _workspace }).catch?.(() => {});
      window.toast?.('Workspace memory cleared', 'info');
      _refreshBody();
    });
  }

  // ── Helpers ────────────────────────────────────────────────────

  function _row(label, value) {
    return `<div class="wm-row"><span class="wm-label">${label}</span><span class="wm-value">${value}</span></div>`;
  }

  function _relTime(seconds) {
    if (!seconds) return '—';
    const diff = Date.now() / 1000 - seconds;
    const m = Math.floor(diff / 60);
    if (m < 1)   return 'just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30)  return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  }

  // ── Activity bar wiring ────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    $('ab-memory')?.addEventListener('click', () => {
      const sidebar = $('sidebar');
      const panel   = $('memory-panel');
      const isOpen  = panel?.style.display !== 'none' && !sidebar?.classList.contains('hidden');

      if (isOpen) {
        if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
        else sidebar?.classList.add('hidden');
        $('ab-memory')?.classList.remove('ab-active');
        hide();
        return;
      }

      ['explorer-content','no-folder-msg','search-panel','project-overview-panel',
       'code-graph-panel','ai-chat-panel','health-panel','reasoning-panel'].forEach(id => {
        const el = $(id); if (el) el.style.display = 'none';
      });

      if (typeof window.toggleSidebar === 'function') window.toggleSidebar(true);
      else { sidebar?.classList.remove('hidden'); $('resize-handle')?.classList.remove('hidden'); }

      const title = sidebar?.querySelector('.sidebar-title');
      if (title) title.textContent = 'WORKSPACE MEMORY';

      document.querySelectorAll('.ab-btn').forEach(b => b.classList.remove('ab-active'));
      $('ab-memory')?.classList.add('ab-active');

      _workspace = window.explorerState?.rootPath || null;
      show();
    });

    // Smart welcome toast (from Rust SQLite, not localStorage)
    setTimeout(async () => {
      const ws = window.explorerState?.rootPath || window.currentFolderPath;
      if (!ws) return;
      try {
        const msg = await getWelcomeInsight(ws);
        if (msg) window.toast?.(msg, 'info');
      } catch {}
    }, 3000);
  });

  return { show, hide, toggle, recordFileOpen, recordAiQuery, recordProjectData, getContext, getWelcomeInsight };
})();

window.WorkspaceMemory = WorkspaceMemory;
