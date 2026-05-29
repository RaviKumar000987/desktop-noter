// ═══════════════════════════════════════════════════════════════
//  DIAGNOSTICS PANEL — src/renderer/ui/diagnostics-panel.js
//  VS Code-style "Problems" panel — collects Monaco markers
//  and LSP diagnostics into one unified view.
// ═══════════════════════════════════════════════════════════════
'use strict';

window.DiagnosticsPanel = (() => {

  let _panel   = null;
  let _filter  = 'all';   // all | error | warning | info
  let _search  = '';
  let _visible = false;
  let _badgeEl = null;    // status bar badge

  // ── Collect all diagnostics from Monaco markers ───────────────
  function _collect() {
    if (typeof monaco === 'undefined') return [];
    const all = [];
    for (const model of monaco.editor.getModels()) {
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      for (const m of markers) {
        const filePath = _uriToPath(model.uri.toString());
        all.push({
          uri:      model.uri.toString(),
          filePath,
          fileName: filePath.split(/[\\/]/).pop(),
          severity: m.severity,       // 8=Error, 4=Warning, 2=Info, 1=Hint
          message:  m.message,
          line:     m.startLineNumber,
          col:      m.startColumn,
          source:   m.source || '',
          code:     m.code || '',
        });
      }
    }
    // Sort: errors first, then warnings, then by file
    return all.sort((a, b) => b.severity - a.severity || a.filePath.localeCompare(b.filePath));
  }

  function _uriToPath(uri) {
    return uri.replace(/^file:\/\/\//, '').replace(/^noter:\/\/tab\/[^/]+\//, '(unsaved) ');
  }

  // ── Filter helpers ────────────────────────────────────────────
  function _applyFilter(diags) {
    let d = diags;
    if (_filter === 'error')   d = d.filter(x => x.severity === 8);
    if (_filter === 'warning') d = d.filter(x => x.severity === 4);
    if (_filter === 'info')    d = d.filter(x => x.severity <= 2);
    if (_search) {
      const q = _search.toLowerCase();
      d = d.filter(x => x.message.toLowerCase().includes(q) || x.fileName.toLowerCase().includes(q));
    }
    return d;
  }

  // ── Severity helpers ──────────────────────────────────────────
  function _sevClass(s)  { return s >= 8 ? 'dp-error' : s >= 4 ? 'dp-warn' : s >= 2 ? 'dp-info' : 'dp-hint'; }
  function _sevIcon(s)   { return s >= 8 ? '✕' : s >= 4 ? '⚠' : s >= 2 ? 'ℹ' : '·'; }
  function _sevLabel(s)  { return s >= 8 ? 'Error' : s >= 4 ? 'Warning' : s >= 2 ? 'Info' : 'Hint'; }

  // ── Build panel DOM ───────────────────────────────────────────
  function _build() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.id = 'dp-panel';
    _panel.innerHTML = `
      <div class="dp-header">
        <span class="dp-title">PROBLEMS</span>
        <div class="dp-filters" id="dp-filters">
          <button class="dp-filter-btn dp-filter-active" data-filter="all">All</button>
          <button class="dp-filter-btn" data-filter="error">
            <span class="dp-error">✕</span> Errors
          </button>
          <button class="dp-filter-btn" data-filter="warning">
            <span class="dp-warn">⚠</span> Warnings
          </button>
          <button class="dp-filter-btn" data-filter="info">
            <span class="dp-info">ℹ</span> Info
          </button>
        </div>
        <input id="dp-search" class="dp-search" type="text"
               placeholder="Filter problems…" autocomplete="off" spellcheck="false"/>
        <div class="dp-header-actions">
          <button class="dp-action-btn" id="dp-refresh-btn" title="Refresh">↻</button>
          <button class="dp-action-btn" id="dp-close-btn" title="Close">✕</button>
        </div>
      </div>
      <div id="dp-list" class="dp-list"></div>
      <div class="dp-footer" id="dp-footer"></div>`;

    document.body.appendChild(_panel);

    // Filter buttons
    _panel.querySelector('#dp-filters').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      _filter = btn.dataset.filter;
      _panel.querySelectorAll('.dp-filter-btn').forEach(b =>
        b.classList.toggle('dp-filter-active', b === btn));
      render();
    });

    // Search
    _panel.querySelector('#dp-search').addEventListener('input', (e) => {
      _search = e.target.value;
      render();
    });

    // Refresh
    _panel.querySelector('#dp-refresh-btn').addEventListener('click', render);

    // Close
    _panel.querySelector('#dp-close-btn').addEventListener('click', hide);

    // Click item → navigate to location in editor
    _panel.querySelector('#dp-list').addEventListener('click', (e) => {
      const row = e.target.closest('[data-uri]');
      if (!row) return;
      const { uri, line, col } = row.dataset;
      _navigateTo(uri, +line, +col);
    });
  }

  // ── Render the list ───────────────────────────────────────────
  function render() {
    if (!_panel || !_visible) { _updateBadge(); return; }
    const all      = _collect();
    const filtered = _applyFilter(all);

    // Count by severity for footer
    const errN  = all.filter(x => x.severity === 8).length;
    const warnN = all.filter(x => x.severity === 4).length;
    const infoN = all.filter(x => x.severity <= 2).length;

    const list = _panel.querySelector('#dp-list');

    if (!filtered.length) {
      list.innerHTML = `<div class="dp-empty">${
        all.length ? 'No problems match filter.' : '✓ No problems detected.'
      }</div>`;
    } else {
      // Group by file
      const groups = new Map();
      for (const d of filtered) {
        if (!groups.has(d.uri)) groups.set(d.uri, []);
        groups.get(d.uri).push(d);
      }
      list.innerHTML = [...groups.entries()].map(([uri, diags]) => {
        const first = diags[0];
        const fileErrors = diags.filter(d => d.severity === 8).length;
        const fileWarns  = diags.filter(d => d.severity === 4).length;
        return `
          <div class="dp-file-group">
            <div class="dp-file-header">
              <span class="dp-file-name">${first.fileName}</span>
              <span class="dp-file-path">${first.filePath}</span>
              <span class="dp-file-counts">
                ${fileErrors ? `<span class="dp-error">✕ ${fileErrors}</span>` : ''}
                ${fileWarns  ? `<span class="dp-warn">⚠ ${fileWarns}</span>`  : ''}
              </span>
            </div>
            ${diags.map(d => `
              <div class="dp-row" data-uri="${d.uri}" data-line="${d.line}" data-col="${d.col}"
                   title="${d.message}">
                <span class="dp-sev-icon ${_sevClass(d.severity)}">${_sevIcon(d.severity)}</span>
                <span class="dp-row-msg">${_escHtml(d.message)}</span>
                <span class="dp-row-meta">
                  ${d.source ? `<span class="dp-source">${d.source}</span>` : ''}
                  ${d.code   ? `<span class="dp-code">${d.code}</span>`     : ''}
                  <span class="dp-loc">Ln ${d.line}, Col ${d.col}</span>
                </span>
              </div>`).join('')}
          </div>`;
      }).join('');
    }

    // Footer summary
    const footer = _panel.querySelector('#dp-footer');
    footer.innerHTML = `
      <span class="${errN  ? 'dp-error'  : 'dp-muted'}">✕ ${errN}  Error${errN !== 1 ? 's' : ''}</span>
      <span class="${warnN ? 'dp-warn'   : 'dp-muted'}">⚠ ${warnN} Warning${warnN !== 1 ? 's' : ''}</span>
      <span class="${infoN ? 'dp-info'   : 'dp-muted'}">ℹ ${infoN} Info</span>`;

    _updateBadge(errN, warnN, infoN);
  }

  // ── Navigate editor to a diagnostic location ──────────────────
  function _navigateTo(uri, line, col) {
    if (!window.editor) return;
    // Find tab with this model
    const models = monaco.editor.getModels();
    const model  = models.find(m => m.uri.toString() === uri);
    if (!model) return;

    // Find and activate the tab
    const tabs = window.TabManager?.getAll?.() || window.TabManager?.tabs || [];
    const tab  = tabs.find(t => t.model === model);
    if (tab) window.TabManager?.activate?.(tab.id);

    // Move cursor
    const pos = { lineNumber: line, column: col };
    window.editor.setPosition(pos);
    window.editor.revealPositionInCenter(pos);
    window.editor.focus();
  }

  // ── Status bar badge ──────────────────────────────────────────
  function _updateBadge(errN, warnN, infoN) {
    const all = _collect();
    const e   = errN  ?? all.filter(x => x.severity === 8).length;
    const w   = warnN ?? all.filter(x => x.severity === 4).length;
    const i   = infoN ?? all.filter(x => x.severity <= 2).length;

    if (!_badgeEl) {
      _badgeEl = document.createElement('span');
      _badgeEl.id = 'dp-status-badge';
      _badgeEl.className = 'dp-status-badge';
      _badgeEl.title = 'Problems — click to toggle';
      _badgeEl.addEventListener('click', toggle);
      document.querySelector('.status-left')?.appendChild(_badgeEl);
    }

    _badgeEl.innerHTML = `
      <span class="${e ? 'dp-error' : 'dp-muted'}">✕ ${e}</span>
      <span class="${w ? 'dp-warn'  : 'dp-muted'}">⚠ ${w}</span>`;
    _badgeEl.classList.toggle('dp-badge-has-errors', e > 0);
  }

  // ── Escape HTML ───────────────────────────────────────────────
  function _escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Show / Hide / Toggle ──────────────────────────────────────
  function show() {
    _build();
    _visible = true;
    _panel.classList.add('dp-visible');
    render();
  }

  function hide() {
    _visible = false;
    _panel?.classList.remove('dp-visible');
    _updateBadge();
  }

  function toggle() {
    _visible ? hide() : show();
  }

  // ── Auto-update when Monaco markers change ────────────────────
  function _autoRefresh() {
    if (typeof monaco === 'undefined') return;
    monaco.editor.onDidChangeMarkers(() => {
      if (_visible) render();
      else _updateBadge();
    });
    document.addEventListener('lsp:diagnostics-updated', () => {
      if (_visible) render();
      else _updateBadge();
    });
  }

  // ── Init ──────────────────────────────────────────────────────
  document.addEventListener('monaco-ready', () => {
    _autoRefresh();
    _updateBadge();

    // Register command
    window.NoterCommands?.register({
      id:      'view.problems',
      title:   'Show Problems',
      category:'View',
      description: 'Toggle the diagnostics / problems panel',
      aliases: ['problems','diagnostics','errors'],
      handler: toggle,
    });
  });

  return { show, hide, toggle, render, getDiagnostics: _collect };
})();
