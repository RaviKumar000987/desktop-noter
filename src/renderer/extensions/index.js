// ═══════════════════════════════════════════════════════════════
//  NOTER APP — Extension Runtime v2  (extensions/index.js)
//  Loader · Activator · Quick-Start panel · Toolbar · Status-bar
// ═══════════════════════════════════════════════════════════════

const ExtensionRuntime = (() => {
  'use strict';

  // ── State ─────────────────────────────────────────────────────
  let _installed = {};
  let _active    = new Map();  // id → ext object

  // ── Shared helpers exposed to every extension via ctx ─────────
  function runInTerminal(cmd) {
    if (typeof TerminalPanel !== 'undefined') TerminalPanel.show();
    setTimeout(() => window.electronAPI?.ptyWrite?.(cmd + '\r'), 350);
  }

  const ctx = {
    runInTerminal,
    getFilePath:   () => TabManager?.getActive()?.filePath  || null,
    getLang:       () => TabManager?.getActive()?.language  || 'plaintext',
    getContent:    () => window.editor?.getValue()          || '',
    getWorkspace:  () => (typeof explorerState !== 'undefined' ? explorerState.rootPath : null),
    toast:         (msg, t) => showToast(msg, t || 'info'),
    addToolbarBtn: addToolbarButton,
    addStatus:     addStatusItem,
    removeStatus:  removeStatusItem,
    updateStatus:  updateStatusItem,
    openPanel:     openPanel,
  };

  // ── Toolbar ───────────────────────────────────────────────────
  function clearToolbar() {
    const tb = document.getElementById('ext-toolbar');
    if (tb) tb.innerHTML = '';
  }

  function addToolbarButton(opts) {
    const tb = document.getElementById('ext-toolbar');
    if (!tb || document.getElementById(opts.id)) return;
    const btn = document.createElement('button');
    btn.id        = opts.id;
    btn.className = 'ext-toolbar-btn';
    btn.title     = opts.title || opts.label;
    btn.innerHTML = `<span class="ext-toolbar-icon">${opts.icon}</span>`
                  + `<span class="ext-toolbar-label">${opts.label}</span>`;
    if (opts.languages) {
      btn.dataset.langs = opts.languages.join(',');
      const refresh = () => {
        const l = ctx.getLang();
        btn.style.display = opts.languages.includes(l) || opts.languages.includes('*') ? '' : 'none';
      };
      refresh();
      document.addEventListener('tab-language-changed', refresh);
    }
    btn.addEventListener('click', opts.run);
    tb.appendChild(btn);
  }

  // ── Status-bar items ──────────────────────────────────────────
  function addStatusItem(id, text, title, action, side = 'right') {
    removeStatusItem(id);
    const el = document.createElement('span');
    el.id        = 'ext-status-' + id;
    el.className = 'ext-status-item';
    el.textContent = text;
    if (title)  el.title = title;
    if (action) el.addEventListener('click', action);
    const bar = document.querySelector(side === 'left' ? '.status-left' : '.status-right');
    if (bar) bar.insertBefore(el, bar.firstChild);
    return el;
  }
  function removeStatusItem(id) { document.getElementById('ext-status-' + id)?.remove(); }
  function updateStatusItem(id, text) {
    const el = document.getElementById('ext-status-' + id);
    if (el) el.textContent = text;
  }

  // ── Generic floating panel ────────────────────────────────────
  function openPanel(id, title, bodyHTML, opts = {}) {
    document.getElementById(id)?.remove();
    const wrap = document.createElement('div');
    wrap.id        = id;
    wrap.className = 'ext-panel ' + (opts.className || 'ext-panel-overlay');
    wrap.innerHTML = `
      <div class="ext-panel-header">
        <span class="ext-panel-icon">${opts.icon || '🔌'}</span>
        <span class="ext-panel-title">${title}</span>
        <div class="ext-panel-hactions">${opts.headerActions || ''}</div>
        <button class="ext-panel-close">×</button>
      </div>
      <div class="ext-panel-body" id="${id}-body">${bodyHTML}</div>`;
    wrap.querySelector('.ext-panel-close').onclick = () => wrap.remove();
    document.body.appendChild(wrap);
    return wrap;
  }

  // ── Quick-Start panel (shown right after install) ──────────────
  function showQuickStart(extId) {
    const ext = (window._exts || {})[extId];
    if (!ext?.getQuickStart) {
      showToast(`${extId} installed! Open Command Palette (Ctrl+Shift+P) to use it.`, 'success', 5000);
      return;
    }
    const qs = ext.getQuickStart();

    document.getElementById('ext-qs-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id        = 'ext-qs-overlay';
    overlay.className = 'ext-qs-overlay';

    const stepsHTML = (qs.steps || []).map((s, i) => `
      <div class="ext-qs-step">
        <div class="ext-qs-num">${i + 1}</div>
        <div class="ext-qs-step-body">
          <div class="ext-qs-step-title">${s.title}</div>
          <div class="ext-qs-step-desc">${s.desc}</div>
        </div>
      </div>`).join('');

    const shortHTML = (qs.shortcuts || []).map(s => `
      <div class="ext-qs-shortcut">
        <kbd class="ext-qs-key">${s.keys}</kbd>
        <span class="ext-qs-key-desc">${s.desc}</span>
      </div>`).join('');

    const cmdsHTML = (qs.commands || []).map(c => `
      <div class="ext-qs-cmd">
        <span class="ext-qs-cmd-id">${c.name}</span>
        <span class="ext-qs-cmd-desc">${c.desc}</span>
      </div>`).join('');

    const tipsHTML = (qs.tips || []).map(t =>
      `<div class="ext-qs-tip">💡 ${t}</div>`).join('');

    overlay.innerHTML = `
      <div class="ext-qs-modal">
        <div class="ext-qs-header">
          <div class="ext-qs-big-icon">${qs.icon || '🔌'}</div>
          <div class="ext-qs-hinfo">
            <div class="ext-qs-htitle">${qs.title}
              <span class="ext-qs-badge">✓ Installed</span>
            </div>
            <div class="ext-qs-hsubtitle">${qs.subtitle || ''}</div>
          </div>
          <button class="ext-qs-x" id="_qs_x">×</button>
        </div>

        ${stepsHTML ? `<div class="ext-qs-section">
          <div class="ext-qs-section-label">How to Use</div>${stepsHTML}</div>` : ''}

        ${shortHTML ? `<div class="ext-qs-section">
          <div class="ext-qs-section-label">Keyboard Shortcuts</div>${shortHTML}</div>` : ''}

        ${cmdsHTML ? `<div class="ext-qs-section">
          <div class="ext-qs-section-label">Command Palette  <kbd>Ctrl+Shift+P</kbd></div>
          ${cmdsHTML}</div>` : ''}

        ${tipsHTML ? `<div class="ext-qs-section ext-qs-tips">${tipsHTML}</div>` : ''}

        <div class="ext-qs-footer">
          <button class="ext-qs-btn-primary" id="_qs_start">Start Using →</button>
          <button class="ext-qs-btn-sec"     id="_qs_close">Close</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    document.getElementById('_qs_x').onclick     = close;
    document.getElementById('_qs_close').onclick = close;
    document.getElementById('_qs_start').onclick = () => { close(); qs.onStart?.(); };
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
  }

  // ── CSS (self-contained, injected once) ───────────────────────
  function injectCSS() {
    if (document.getElementById('ext-runtime-css')) return;
    const s = document.createElement('style');
    s.id = 'ext-runtime-css';
    s.textContent = `
/* ── Extension toolbar buttons ─────────────────────── */
.ext-toolbar-btn {
  display:inline-flex; align-items:center; gap:5px;
  padding:3px 10px; border-radius:5px; border:none;
  background:transparent; color:var(--gh-text,#e6edf3);
  font-size:12px; cursor:pointer; transition:background .1s;
  height:26px; white-space:nowrap;
}
.ext-toolbar-btn:hover { background:var(--gh-border,#30363d); }
.ext-toolbar-icon { font-size:13px; }
.ext-toolbar-label { font-size:11.5px; opacity:.9; }

/* ── Extension status-bar items ─────────────────────── */
.ext-status-item {
  cursor:pointer; padding:0 6px; font-size:11.5px;
  color:var(--gh-subtext,#7d8590); transition:color .1s;
  user-select:none;
}
.ext-status-item:hover { color:var(--gh-text,#e6edf3); }

/* ── Generic floating panel ─────────────────────────── */
.ext-panel {
  position:fixed; z-index:8000; display:flex; flex-direction:column;
  background:#161b22; border:1px solid var(--gh-border,#30363d);
  border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,.72);
  min-width:320px; max-width:680px; max-height:80vh; overflow:hidden;
}
.ext-panel-overlay { top:50%; left:50%; transform:translate(-50%,-50%); }
.ext-panel-right   { top:60px; right:20px; bottom:60px; }
.ext-panel-header  {
  display:flex; align-items:center; gap:8px; padding:10px 14px 10px;
  border-bottom:1px solid var(--gh-border,#30363d); flex-shrink:0;
  background:#0d1117;
}
.ext-panel-icon  { font-size:15px; }
.ext-panel-title { flex:1; font-size:13px; font-weight:600; color:var(--gh-text,#e6edf3); }
.ext-panel-hactions { display:flex; gap:6px; }
.ext-panel-close {
  background:none; border:none; color:var(--gh-subtext,#7d8590);
  font-size:16px; cursor:pointer; padding:2px 6px; border-radius:4px;
  line-height:1;
}
.ext-panel-close:hover { background:rgba(248,81,73,.15); color:#f38ba8; }
.ext-panel-body { flex:1; overflow-y:auto; padding:14px; scrollbar-width:thin;
  scrollbar-color:#30363d transparent; }

/* ── Quick-Start overlay ─────────────────────────────── */
.ext-qs-overlay {
  position:fixed; inset:0; z-index:9500;
  background:rgba(0,0,0,.75); backdrop-filter:blur(6px);
  display:flex; align-items:center; justify-content:center;
  animation:extQsFadeIn .15s ease;
}
@keyframes extQsFadeIn { from{opacity:0} to{opacity:1} }
.ext-qs-modal {
  background:#161b22; border:1px solid var(--gh-border,#30363d);
  border-radius:16px; width:560px; max-width:94vw; max-height:84vh;
  display:flex; flex-direction:column; overflow:hidden;
  box-shadow:0 28px 72px rgba(0,0,0,.8);
  animation:extQsDrop .15s ease-out;
}
@keyframes extQsDrop { from{opacity:0;transform:translateY(-14px)} to{opacity:1;transform:none} }
.ext-qs-header {
  display:flex; align-items:center; gap:14px;
  padding:20px 22px 16px;
  background:#0d1117; border-bottom:1px solid var(--gh-border,#30363d); flex-shrink:0;
}
.ext-qs-big-icon { font-size:32px; flex-shrink:0; }
.ext-qs-hinfo   { flex:1; min-width:0; }
.ext-qs-htitle  { font-size:16px; font-weight:700; color:var(--gh-text,#e6edf3);
  display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ext-qs-hsubtitle { font-size:12px; color:var(--gh-subtext,#7d8590); margin-top:3px; }
.ext-qs-badge {
  background:#1f6feb22; color:#58a6ff; border:1px solid #1f6feb55;
  border-radius:20px; padding:1px 10px; font-size:11px; font-weight:600;
}
.ext-qs-x {
  background:none; border:none; color:var(--gh-subtext,#7d8590);
  font-size:18px; cursor:pointer; padding:4px 8px; border-radius:6px;
  flex-shrink:0;
}
.ext-qs-x:hover { background:rgba(248,81,73,.15); color:#f38ba8; }
.ext-qs-modal > .ext-qs-section:first-of-type,
.ext-qs-section { overflow-y:auto; padding:16px 22px 8px; border-bottom:1px solid #21262d; }
.ext-qs-section:last-of-type { border-bottom:none; }
.ext-qs-section-label {
  font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em; color:var(--gh-subtext,#7d8590); margin-bottom:10px;
  display:flex; align-items:center; gap:8px;
}
.ext-qs-section-label kbd { font-size:10px; background:#21262d;
  border:1px solid #30363d; border-radius:4px; padding:1px 6px; color:#58a6ff; }
.ext-qs-step {
  display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;
}
.ext-qs-num {
  width:24px; height:24px; border-radius:50%; background:#1f6feb33;
  color:#58a6ff; font-size:12px; font-weight:700; display:flex;
  align-items:center; justify-content:center; flex-shrink:0;
}
.ext-qs-step-body { flex:1; min-width:0; }
.ext-qs-step-title { font-size:13px; font-weight:600; color:var(--gh-text,#e6edf3); margin-bottom:3px; }
.ext-qs-step-desc  { font-size:12px; color:var(--gh-subtext,#7d8590); line-height:1.55; }
.ext-qs-step-desc kbd {
  background:#21262d; border:1px solid #30363d; border-radius:4px;
  padding:1px 6px; font-size:11px; color:#e6edf3;
}
.ext-qs-shortcut {
  display:flex; align-items:center; gap:12px; padding:5px 0;
  border-bottom:1px solid #21262d;
}
.ext-qs-shortcut:last-child { border-bottom:none; }
.ext-qs-key {
  background:#21262d; border:1px solid #30363d; border-radius:5px;
  padding:3px 8px; font-size:11.5px; color:#e6edf3; white-space:nowrap; flex-shrink:0;
}
.ext-qs-key-desc { font-size:12.5px; color:var(--gh-subtext,#7d8590); }
.ext-qs-cmd { display:flex; gap:10px; padding:4px 0; align-items:baseline;
  border-bottom:1px solid #21262d; }
.ext-qs-cmd:last-child { border-bottom:none; }
.ext-qs-cmd-id   { font-size:12px; color:#58a6ff; font-family:monospace; white-space:nowrap; }
.ext-qs-cmd-desc { font-size:12px; color:var(--gh-subtext,#7d8590); }
.ext-qs-tips     { background:#0d1117; }
.ext-qs-tip { font-size:12px; color:var(--gh-subtext,#7d8590); padding:4px 0; }
.ext-qs-footer {
  display:flex; gap:8px; padding:14px 22px; justify-content:flex-end;
  background:#0d1117; border-top:1px solid var(--gh-border,#30363d); flex-shrink:0;
}
.ext-qs-btn-primary {
  padding:7px 20px; border-radius:7px; border:none;
  background:var(--gh-accent,#58a6ff); color:#fff; font-size:13px;
  font-weight:600; cursor:pointer; transition:background .1s;
}
.ext-qs-btn-primary:hover { background:#79b8ff; }
.ext-qs-btn-sec {
  padding:7px 16px; border-radius:7px;
  border:1px solid var(--gh-border,#30363d); background:#21262d;
  color:var(--gh-text,#e6edf3); font-size:13px; cursor:pointer;
}
.ext-qs-btn-sec:hover { background:#2d333b; }

/* ── Error Lens decorations ──────────────────────────── */
.el-line-error   { background:rgba(248,81,73,.08)  !important; }
.el-line-warning { background:rgba(210,153,34,.08) !important; }
.el-line-hint    { background:rgba(88,166,255,.06) !important; }
.el-inline-error   { color:#f85149; font-style:italic; font-size:12px;
  margin-left:16px; opacity:.85; }
.el-inline-warning { color:#d2993d; font-style:italic; font-size:12px;
  margin-left:16px; opacity:.85; }
.el-inline-hint    { color:#58a6ff; font-style:italic; font-size:12px;
  margin-left:16px; opacity:.75; }

/* ── Live Preview panel ──────────────────────────────── */
#ext-live-preview-panel .ext-panel-body { padding:0; }
#lp-toolbar { display:flex; gap:6px; padding:8px 12px;
  background:#0d1117; border-bottom:1px solid #21262d; flex-shrink:0; }
.lp-btn { padding:4px 10px; border-radius:5px; border:1px solid #30363d;
  background:#21262d; color:#e6edf3; font-size:11.5px; cursor:pointer; }
.lp-btn:hover { background:#30363d; }
.lp-btn.active { border-color:#58a6ff; color:#58a6ff; }
#lp-frame { width:100%; flex:1; border:none; background:#fff; }

/* ── Project Dashboard ───────────────────────────────── */
.dash-section { margin-bottom:16px; }
.dash-section-title {
  font-size:10.5px; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em; color:var(--gh-subtext,#7d8590);
  margin-bottom:8px; padding-bottom:4px;
  border-bottom:1px solid #21262d;
}
.dash-row { display:flex; align-items:center; gap:8px; padding:4px 0;
  font-size:12.5px; color:var(--gh-text,#e6edf3); }
.dash-label { color:var(--gh-subtext,#7d8590); flex-shrink:0; font-size:12px; }
.dash-value { flex:1; }
.dash-badge { padding:1px 8px; border-radius:10px; font-size:11px;
  background:#21262d; border:1px solid #30363d; }
.dash-action-btn { padding:5px 12px; border-radius:6px; border:1px solid #30363d;
  background:#21262d; color:#e6edf3; font-size:12px; cursor:pointer;
  transition:background .1s; }
.dash-action-btn:hover { background:#30363d; border-color:#58a6ff55; }

/* ── Workspace Notes ─────────────────────────────────── */
#ext-notes-panel { width:320px; }
.note-item { background:#0d1117; border:1px solid #21262d; border-radius:8px;
  margin-bottom:8px; overflow:hidden; }
.note-header { display:flex; align-items:center; gap:6px; padding:6px 10px;
  cursor:pointer; }
.note-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.note-title { flex:1; font-size:12.5px; font-weight:600; color:#e6edf3; }
.note-del { background:none; border:none; color:#7d8590; cursor:pointer;
  font-size:13px; padding:2px 4px; }
.note-del:hover { color:#f38ba8; }
.note-body textarea {
  width:100%; min-height:80px; background:#161b22; border:none; outline:none;
  color:#e6edf3; font-size:12px; padding:8px 10px; resize:vertical;
  font-family:inherit; line-height:1.6;
}
.note-add-btn { width:100%; padding:7px; border-radius:7px; border:1px dashed #30363d;
  background:transparent; color:#7d8590; font-size:12px; cursor:pointer; }
.note-add-btn:hover { border-color:#58a6ff; color:#58a6ff; }

/* ── Node Toolkit panel ──────────────────────────────── */
.nt-script-row { display:flex; align-items:center; gap:8px; padding:5px 0;
  border-bottom:1px solid #21262d; }
.nt-script-row:last-child { border-bottom:none; }
.nt-script-name { flex:1; font-size:12.5px; color:#e6edf3; font-family:monospace; }
.nt-run-btn { padding:3px 10px; border-radius:5px; border:1px solid #30363d;
  background:#21262d; color:#58a6ff; font-size:11.5px; cursor:pointer; }
.nt-run-btn:hover { background:#1f6feb22; border-color:#58a6ff; }

/* ── Git Insights panel ──────────────────────────────── */
.gi-commit { padding:7px 0; border-bottom:1px solid #21262d; }
.gi-commit:last-child { border-bottom:none; }
.gi-hash { color:#58a6ff; font-family:monospace; font-size:11.5px; }
.gi-msg  { font-size:12.5px; color:#e6edf3; margin-top:2px; }
.gi-meta { font-size:11px; color:#7d8590; margin-top:2px; }

/* ── Security scanner ────────────────────────────────── */
.sec-issue { display:flex; gap:10px; padding:8px 0; border-bottom:1px solid #21262d; }
.sec-issue:last-child { border-bottom:none; }
.sec-sev { width:8px; flex-shrink:0; border-radius:2px; }
.sec-sev.high   { background:#f85149; }
.sec-sev.medium { background:#d2993d; }
.sec-sev.low    { background:#58a6ff; }
.sec-body { flex:1; }
.sec-title { font-size:13px; font-weight:600; color:#e6edf3; }
.sec-desc  { font-size:12px; color:#7d8590; margin-top:3px; line-height:1.5; }
.sec-fix   { font-size:11.5px; color:#3fb950; margin-top:4px; }

/* ── Theme Studio grid ───────────────────────────────── */
.ts-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
.ts-card { border-radius:8px; padding:10px; cursor:pointer;
  border:2px solid transparent; transition:border-color .15s; }
.ts-card:hover { border-color:#58a6ff88; }
.ts-card.active { border-color:#58a6ff; }
.ts-card-name { font-size:12.5px; font-weight:600; color:#e6edf3; margin-bottom:6px; }
.ts-swatches { display:flex; gap:3px; }
.ts-sw { width:14px; height:14px; border-radius:3px; }
    `;
    document.head.appendChild(s);
  }

  // ── Main activation ───────────────────────────────────────────
  async function activate() {
    injectCSS();
    try {
      _installed = await window.electronAPI?.marketplaceGetInstalled?.() || {};
    } catch { _installed = {}; }

    clearToolbar();
    _active.clear();

    const registry = window._exts || {};

    for (const [id, meta] of Object.entries(_installed)) {
      if (meta.enabled === false) continue;
      const extId = id.toLowerCase().replace(/\s+/g, '-');
      const ext   = registry[extId];
      if (!ext) continue;
      try {
        ext.activate(ctx);
        _active.set(extId, ext);
        // Register commands with CommandPalette if it has a .register()
        if (Array.isArray(ext.commands) && typeof CommandPalette !== 'undefined' && CommandPalette.registerExtCmd) {
          ext.commands.forEach(cmd => CommandPalette.registerExtCmd(cmd.id, cmd.label, cmd.run));
        }
      } catch (err) {
        console.warn(`[Ext] Failed to activate ${extId}:`, err);
      }
    }

    document.addEventListener('tab-language-changed', _refreshLangButtons);
  }

  function _refreshLangButtons() {
    const lang = ctx.getLang();
    document.querySelectorAll('.ext-toolbar-btn[data-langs]').forEach(btn => {
      const ok = btn.dataset.langs.split(',').some(l => l === lang || l === '*');
      btn.style.display = ok ? '' : 'none';
    });
  }

  function refresh() {
    _active.forEach(ext => { try { ext.deactivate?.(); } catch {} });
    activate();
  }

  // ── Listen for marketplace install event ──────────────────────
  document.addEventListener('extension-installed', e => {
    const id = e.detail?.id;
    if (!id) return;
    refresh();
    setTimeout(() => showQuickStart(id), 600);
  });

  return { activate, refresh, showQuickStart };
})();

// Auto-boot after Monaco is ready
document.addEventListener('monaco-ready', () => {
  setTimeout(() => ExtensionRuntime.activate(), 300);
});
