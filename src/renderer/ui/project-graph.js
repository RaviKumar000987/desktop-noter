// ═══════════════════════════════════════════════════════════════
//  CODE GRAPH PANEL — project-graph.js           (Phase 2)
//  9-layer project brain UI: File Dependencies · Impact Analysis
//  · Dead Code · Circular Dependencies
// ═══════════════════════════════════════════════════════════════

const CodeGraph = (() => {
  const $ = (id) => document.getElementById(id);

  let _root = null;
  let _stats = null;
  let _built = false;
  let _building = false;
  let _activeTab = 'graph';

  // ── Public ────────────────────────────────────────────────────

  function show() {
    $('code-graph-panel').style.display = 'flex';
    $('code-graph-panel').style.flexDirection = 'column';

    // Pick up folder opened before this panel was first shown
    if (!_root && window.currentFolderPath) {
      _root = window.currentFolderPath;
    }

    if (!_root) { showEmpty('Open a folder to\nbuild the code graph'); return; }
    if (_built) { renderContent(); return; }
    if (!_building) triggerBuild(_root);
  }

  function hide() { $('code-graph-panel').style.display = 'none'; }

  function onWorkspaceOpen(root) {
    _root = root;
    _built = false;
    _stats = null;
    triggerBuild(root);
  }

  // Called by Phase 1.75 WatchEngine when a file changes
  function onFileChanged(filePath) {
    if (!_built || !_root) return;
    window.noter.graph.updateFile({ workspaceRoot: _root, filePath }).catch(() => {});
  }

  // ── Build ─────────────────────────────────────────────────────

  async function triggerBuild(root) {
    if (_building) return;
    _building = true;
    showLoading();

    try {
      const stats = await window.noter.graph.build({ workspaceRoot: root });
      _building = false;
      if (!stats || !stats.isBuilt) {
        showEmpty(stats?.error?.includes('unavailable')
          ? 'Rust engine not built yet\nRun: cargo build -p noter-napi'
          : 'Graph build failed — check console');
        return;
      }
      _stats = stats;
      _built = true;
      renderContent();
    } catch (err) {
      _building = false;
      showEmpty('Graph unavailable: ' + (err?.message || 'native core not built'));
    }
  }

  // ── Render ────────────────────────────────────────────────────

  function renderContent() {
    showContent();
    renderStatsBar();
    switchTab(_activeTab);
  }

  function renderStatsBar() {
    const bar = $('cg-stats-bar');
    if (!bar || !_stats) return;
    bar.innerHTML = `
      <span class="cg-stat"><b>${_stats.fileCount}</b> files</span>
      <span class="cg-stat"><b>${_stats.symbolCount}</b> symbols</span>
      <span class="cg-stat"><b>${_stats.importEdgeCount}</b> imports</span>
      <span class="cg-stat cg-stat-time">${_stats.durationMs}ms</span>
    `;
  }

  // ── Tabs ──────────────────────────────────────────────────────

  function switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.cg-tab').forEach(btn => {
      btn.classList.toggle('cg-tab-active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.cg-tab-panel').forEach(panel => {
      panel.style.display = 'none';
    });
    const panel = $('cg-tab-' + tab);
    if (panel) panel.style.display = 'flex';

    if (tab === 'graph')    renderGraphTab();
    if (tab === 'deadcode') renderDeadCodeTab();
    if (tab === 'cycles')   renderCyclesTab();
  }

  // ── Graph tab ─────────────────────────────────────────────────

  async function renderGraphTab() {
    if (!_root) return;
    const list = $('cg-file-list');
    if (!list) return;
    list.innerHTML = '<div class="cg-loading-row">Loading…</div>';

    try {
      // Build a compact adjacency view using import edges
      // We show: each file + how many files import it + how many it imports
      const stats = await window.noter.graph.stats({ workspaceRoot: _root });
      if (!stats) { list.innerHTML = '<div class="cg-empty-row">No data</div>'; return; }

      // For the graph tab we show a sorted list of files by import count
      // (most-imported = most critical)
      list.innerHTML = `
        <div class="cg-graph-note">
          ${stats.fileCount} files · ${stats.importEdgeCount} import edges<br>
          <span class="cg-hint">Click a file to see its import chain</span>
        </div>
      `;
    } catch { list.innerHTML = '<div class="cg-empty-row">Error loading graph</div>'; }
  }

  // ── Dead Code tab ─────────────────────────────────────────────

  async function renderDeadCodeTab() {
    if (!_root) return;
    const list = $('cg-deadcode-list');
    if (!list) return;
    list.innerHTML = '<div class="cg-loading-row">Scanning…</div>';

    try {
      const unused = await window.noter.graph.deadCode({ workspaceRoot: _root });
      if (!unused?.length) {
        list.innerHTML = '<div class="cg-empty-row cg-good">No unused exports detected</div>';
        return;
      }
      list.innerHTML = unused.slice(0, 50).map(sym => `
        <div class="cg-dead-item">
          <span class="cg-kind-chip cg-kind-${sym.kind}">${sym.kind}</span>
          <span class="cg-dead-name">${sym.name}</span>
          <span class="cg-dead-file" title="${sym.file}">${basename(sym.file)}:${sym.line}</span>
        </div>
      `).join('') + (unused.length > 50 ? `<div class="cg-more">+${unused.length - 50} more</div>` : '');
    } catch { list.innerHTML = '<div class="cg-empty-row">Error scanning dead code</div>'; }
  }

  // ── Cycles tab ───────────────────────────────────────────────

  async function renderCyclesTab() {
    if (!_root) return;
    const list = $('cg-cycles-list');
    if (!list) return;
    list.innerHTML = '<div class="cg-loading-row">Detecting cycles…</div>';

    try {
      const cycles = await window.noter.graph.cycles({ workspaceRoot: _root });
      if (!cycles?.length) {
        list.innerHTML = '<div class="cg-empty-row cg-good">No circular dependencies</div>';
        return;
      }
      list.innerHTML = cycles.map((cycle, i) => `
        <div class="cg-cycle">
          <div class="cg-cycle-header">Cycle ${i + 1} — ${cycle.files.length} files</div>
          ${cycle.files.map((f, j) => `
            <div class="cg-cycle-file">
              ${j > 0 ? '<span class="cg-cycle-arrow">↓</span>' : ''}
              <span class="cg-cycle-path" title="${f}">${basename(f)}</span>
            </div>
          `).join('')}
          <div class="cg-cycle-file"><span class="cg-cycle-arrow">↩</span> <span class="cg-cycle-path">(back to start)</span></div>
        </div>
      `).join('');
    } catch { list.innerHTML = '<div class="cg-empty-row">Error detecting cycles</div>'; }
  }

  // ── Impact tab ───────────────────────────────────────────────

  async function runImpactAnalysis(filePath) {
    if (!_root || !filePath) return;
    const result = $('cg-impact-result');
    result.innerHTML = '<div class="cg-loading-row">Analyzing…</div>';

    try {
      const impact = await window.noter.graph.impact({ workspaceRoot: _root, filePath });
      if (!impact) { result.innerHTML = '<div class="cg-empty-row">File not in graph</div>'; return; }

      const severity = impact.affectedFileCount === 0 ? 'cg-impact-safe'
                      : impact.affectedFileCount < 5 ? 'cg-impact-low'
                      : impact.affectedFileCount < 20 ? 'cg-impact-med'
                      : 'cg-impact-high';

      result.innerHTML = `
        <div class="cg-impact-summary ${severity}">
          <div class="cg-impact-num">${impact.affectedFileCount}</div>
          <div class="cg-impact-label">files affected</div>
        </div>
        <div class="cg-impact-meta">
          <span>${impact.affectedSymbolCount} symbols · depth ${impact.maxDepth}</span>
        </div>
        ${impact.affectedFiles.length ? `
          <div class="cg-section-header">AFFECTED FILES</div>
          <div class="cg-impact-files">
            ${impact.affectedFiles.slice(0, 30).map(f =>
              `<div class="cg-impact-file" title="${f}">${f}</div>`
            ).join('')}
            ${impact.affectedFiles.length > 30 ? `<div class="cg-more">+${impact.affectedFiles.length - 30} more</div>` : ''}
          </div>
        ` : ''}
      `;
    } catch (e) {
      result.innerHTML = `<div class="cg-empty-row">Error: ${e?.message || 'unknown'}</div>`;
    }
  }

  // ── State helpers ─────────────────────────────────────────────

  function showLoading() {
    $('cg-loading').style.display = 'flex';
    $('cg-empty').style.display   = 'none';
    $('cg-content').style.display = 'none';
  }

  function showEmpty(msg = 'Open a folder to\nbuild the code graph') {
    $('cg-loading').style.display = 'none';
    $('cg-empty').style.display   = 'flex';
    $('cg-content').style.display = 'none';
    const p = $('cg-empty').querySelector('p');
    if (p) p.innerHTML = msg.replace('\n', '<br>');
  }

  function showContent() {
    $('cg-loading').style.display = 'none';
    $('cg-empty').style.display   = 'none';
    $('cg-content').style.display = 'flex';
    $('cg-content').style.flexDirection = 'column';
  }

  function basename(path) {
    return path.replace(/\\/g, '/').split('/').pop() || path;
  }

  // ── Event wiring ─────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.cg-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Impact analysis button
    $('cg-impact-btn')?.addEventListener('click', () => {
      const input = $('cg-impact-input')?.value?.trim();
      if (input) runImpactAnalysis(input);
    });
    $('cg-impact-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') $('cg-impact-btn')?.click();
    });

    // Activity bar button
    $('ab-graph')?.addEventListener('click', () => {
      const panel = $('code-graph-panel');
      const sidebar = $('sidebar');
      const isVisible = panel?.style.display !== 'none';
      const sidebarHidden = sidebar?.classList.contains('hidden');

      if (isVisible && !sidebarHidden) {
        // Collapse — use window.toggleSidebar so app.js sidebarVisible stays in sync
        if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
        else { sidebar?.classList.add('hidden'); $('resize-handle')?.classList.add('hidden'); }
        $('ab-graph')?.classList.remove('ab-active');
        CodeGraph.hide();
      } else {
        _showGraphPanel();
      }
    });
  });

  function _showGraphPanel() {
    const sidebar = $('sidebar');
    // Hide other panels
    ['explorer-content','no-folder-msg','search-panel','project-overview-panel','ai-chat-panel'].forEach(id => {
      const el = $(id);
      if (el) el.style.display = 'none';
    });
    // Show sidebar — use toggleSidebar so app.js sidebarVisible stays in sync
    if (typeof window.toggleSidebar === 'function') window.toggleSidebar(true);
    else { sidebar?.classList.remove('hidden'); $('resize-handle')?.classList.remove('hidden'); }
    // Title
    const title = sidebar?.querySelector('.sidebar-title');
    if (title) title.textContent = 'CODE GRAPH';
    // Activate button
    document.querySelectorAll('.ab-btn').forEach(b => b.classList.remove('ab-active'));
    $('ab-graph')?.classList.add('ab-active');

    CodeGraph.show();
  }

  // Auto-build on workspace open
  // app.js dispatches "workspace-opened" on document (not window) with detail.path
  document.addEventListener('workspace-opened', e => {
    const root = e.detail?.path;
    if (root) onWorkspaceOpen(root);
  });

  // Integrate with Phase 1.75 watch events
  if (window.noter?.index) {
    window.noter.index.onFileChanged(events => {
      if (Array.isArray(events)) events.forEach(ev => onFileChanged(ev.path));
    });
  }

  return { show, hide, onWorkspaceOpen, onFileChanged };
})();

window.CodeGraph = CodeGraph;
