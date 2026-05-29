// ─── Node Toolkit ────────────────────────────────────────────────
// Run npm scripts, install packages, view dependencies — all inside the editor.

(window._exts = window._exts || {})['node-toolkit'] = (() => {
  'use strict';
  let _ctx;

  async function _readPkgJson() {
    const ws = _ctx?.getWorkspace();
    if (!ws) return null;
    try {
      const fp = ws.replace(/\\/g,'/') + '/package.json';
      const res = await window.electronAPI?.openFileByPath?.(fp);
      return res ? JSON.parse(res.content) : null;
    } catch { return null; }
  }

  async function _openPanel() {
    const id = 'ext-node-panel';
    document.getElementById(id)?.remove();

    const pkg = await _readPkgJson();

    if (!pkg) {
      _ctx?.toast('No package.json found in workspace root', 'info');
      return;
    }

    const scripts = Object.entries(pkg.scripts || {});
    const deps    = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});

    const scriptRows = scripts.length
      ? scripts.map(([name, cmd]) => `
          <div class="nt-script-row">
            <span class="nt-script-name">npm run ${name}</span>
            <button class="nt-run-btn" data-cmd="npm run ${name}">▶ Run</button>
          </div>`).join('')
      : '<div style="color:#7d8590;font-size:12px">No scripts defined.</div>';

    const panel = _ctx.openPanel(id, `Node Toolkit — ${pkg.name || 'package'}`, `
      <div class="dash-section">
        <div class="dash-section-title">Info</div>
        <div class="dash-row"><span class="dash-label">Name:</span><strong style="color:#58a6ff">${pkg.name||'—'}</strong></div>
        <div class="dash-row"><span class="dash-label">Version:</span>${pkg.version||'—'}</div>
        <div class="dash-row"><span class="dash-label">Dependencies:</span>${deps.length}</div>
        <div class="dash-row"><span class="dash-label">devDependencies:</span>${devDeps.length}</div>
      </div>

      <div class="dash-section">
        <div class="dash-section-title">Scripts</div>
        ${scriptRows}
      </div>

      <div class="dash-section">
        <div class="dash-section-title">Quick Commands</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="dash-action-btn" data-cmd="npm install">📦 npm install</button>
          <button class="dash-action-btn" data-cmd="npm update">🔄 npm update</button>
          <button class="dash-action-btn" data-cmd="npm audit">🔒 npm audit</button>
          <button class="dash-action-btn" data-cmd="npm outdated">📋 npm outdated</button>
        </div>
      </div>
    `, { icon: '⬢' });

    const ws = _ctx?.getWorkspace()?.replace(/\\/g,'/') || '';
    panel.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = ws ? `cd "${ws}" && ${btn.dataset.cmd}` : btn.dataset.cmd;
        _ctx.runInTerminal(cmd);
        panel.remove();
      });
    });
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({ id:'ext-node-btn', icon:'⬢', label:'npm',
      title:'Node Toolkit — package.json scripts & commands', run:_openPanel });
  }

  function deactivate() { document.getElementById('ext-node-btn')?.remove(); }

  function getQuickStart() {
    return {
      icon:'⬢', title:'Node Toolkit', subtitle:'Run npm scripts and manage packages without leaving the editor',
      steps:[
        { title:'Open Node Toolkit', desc:'Click <strong>⬢ npm</strong> in the toolbar. It reads your workspace\'s <code>package.json</code> automatically.' },
        { title:'Run Scripts', desc:'All <code>scripts</code> from package.json appear with a <strong>▶ Run</strong> button. One click runs them in the terminal.' },
        { title:'Quick Commands', desc:'npm install, npm update, npm audit, and npm outdated are one click away.' },
      ],
      shortcuts:[{ keys:'⬢ npm toolbar', desc:'Open Node Toolkit panel' }],
      commands:[{ name:'node.panel', desc:'Open Node Toolkit panel' }],
      tips:['Node Toolkit reads the package.json from your workspace root folder.','Works with yarn too — just change "npm" to "yarn" in the command.'],
      onStart:_openPanel,
    };
  }

  return {
    id:'node-toolkit', activate, deactivate, getQuickStart,
    commands:[{ id:'node.panel', label:'Node Toolkit: Open Panel', run:_openPanel }],
  };
})();
