// ─── Project Dashboard ───────────────────────────────────────────
// Workspace overview: git, tabs, word counts, quick actions.

(window._exts = window._exts || {})['project-dashboard'] = (() => {
  'use strict';

  let _ctx;

  async function _openDashboard() {
    const id = 'ext-dashboard-panel';
    document.getElementById(id)?.remove();

    const ws     = _ctx?.getWorkspace() || '—';
    const wsName = ws !== '—' ? ws.split(/[/\\]/).filter(Boolean).pop() : '—';

    // Gather tab stats
    const tabs   = typeof TabManager !== 'undefined' ? TabManager.tabs : [];
    const words  = tabs.reduce((sum, t) => sum + (t.model?.getValue().trim().split(/\s+/).filter(Boolean).length || 0), 0);
    const dirty  = tabs.filter(t => t.isModified).length;

    const tabRows = tabs.slice(0, 8).map(t => `
      <div class="dash-row" style="cursor:pointer" onclick="TabManager.activate('${t.id}')">
        <span class="dash-label">${t.title}</span>
        <span style="font-size:11px;color:${t.isModified?'#d2993d':'#3fb950'}">${t.isModified?'●modified':'●saved'}</span>
      </div>`).join('') + (tabs.length > 8 ? `<div class="dash-row" style="color:#7d8590">+${tabs.length-8} more…</div>` : '');

    // Git info
    let branch = '—', gitStatus = '';
    try {
      const br = await window.electronAPI?.terminalExec?.('git rev-parse --abbrev-ref HEAD');
      branch = (br?.stdout || '').trim() || '—';
    } catch {}

    const panel = _ctx.openPanel(id, 'Project Dashboard', `
      <div class="dash-section">
        <div class="dash-section-title">Workspace</div>
        <div class="dash-row"><span class="dash-label">Folder:</span><span class="dash-value">${wsName}</span></div>
        <div class="dash-row"><span class="dash-label">Branch:</span>
          <span class="dash-value" style="color:#58a6ff">⎇ ${branch}</span></div>
      </div>

      <div class="dash-section">
        <div class="dash-section-title">Open Tabs (${tabs.length})</div>
        <div class="dash-row"><span class="dash-label">Total words:</span><span class="dash-value">${words.toLocaleString()}</span></div>
        <div class="dash-row"><span class="dash-label">Unsaved:</span>
          <span class="dash-value" style="color:${dirty>0?'#d2993d':'#3fb950'}">${dirty} file${dirty!==1?'s':''}</span></div>
        ${tabRows}
      </div>

      <div class="dash-section">
        <div class="dash-section-title">Quick Actions</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="dash-action-btn" id="_da_format">✨ Format All Open Files</button>
          <button class="dash-action-btn" id="_da_saveAll">💾 Save All</button>
          <button class="dash-action-btn" id="_da_gitStatus">⎇ git status</button>
          <button class="dash-action-btn" id="_da_refresh">↻ Refresh Explorer</button>
        </div>
      </div>
    `, { icon: '📊' });

    panel.querySelector('#_da_format').onclick = () => {
      window.editor?.getAction('editor.action.formatDocument')?.run();
      _ctx.toast('Formatted active document ✓', 'success');
    };
    panel.querySelector('#_da_saveAll').onclick = () => {
      typeof actions !== 'undefined' && actions.saveFile?.();
      _ctx.toast('Saved active file', 'success');
    };
    panel.querySelector('#_da_gitStatus').onclick = () => {
      const cmd = ws !== '—' ? `cd "${ws.replace(/\\/g,'/')}" && git status` : 'git status';
      _ctx.runInTerminal(cmd); panel.remove();
    };
    panel.querySelector('#_da_refresh').onclick = () => {
      typeof refreshExplorer !== 'undefined' && refreshExplorer();
      panel.remove();
    };
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({ id:'ext-dash-btn', icon:'📊', label:'Dashboard',
      title:'Project Dashboard', run:_openDashboard });
  }

  function deactivate() { document.getElementById('ext-dash-btn')?.remove(); }

  function getQuickStart() {
    return {
      icon:'📊', title:'Project Dashboard', subtitle:'Workspace overview with git, tabs, and quick actions',
      steps:[
        { title:'Open Dashboard', desc:'Click <strong>📊 Dashboard</strong> in the toolbar for a real-time overview of your workspace.' },
        { title:'What You See', desc:'Current git branch, all open tabs with save status, total word count, and quick-action buttons.' },
        { title:'Quick Actions', desc:'Format document, save all, run git status, or refresh the explorer — all with one click.' },
      ],
      shortcuts:[{ keys:'📊 toolbar button', desc:'Open Project Dashboard' }],
      commands:[{ name:'dashboard.open', desc:'Open Project Dashboard' }],
      tips:['Click any tab name in the dashboard to switch to that file instantly.'],
      onStart: _openDashboard,
    };
  }

  return {
    id:'project-dashboard', activate, deactivate, getQuickStart,
    commands:[{ id:'dashboard.open', label:'Project Dashboard: Open', run:_openDashboard }],
  };
})();
