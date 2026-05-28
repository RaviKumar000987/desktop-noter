// ─── Workspace Notes ─────────────────────────────────────────────
// Color-coded sticky notes + todo lists that persist per workspace.

(window._exts = window._exts || {})['workspace-notes'] = (() => {
  'use strict';

  let _ctx;
  const COLORS = ['#f9e2af','#89dceb','#a6e3a1','#f38ba8','#cba6f7','#fab387'];

  function _storageKey() {
    const ws = _ctx?.getWorkspace() || '__global__';
    return 'notes-' + ws;
  }

  function _load() {
    try { return JSON.parse(localStorage.getItem(_storageKey()) || '[]'); } catch { return []; }
  }

  function _save(notes) {
    localStorage.setItem(_storageKey(), JSON.stringify(notes));
  }

  function _openPanel() {
    const panelId = 'ext-notes-panel';
    const existing = document.getElementById(panelId);
    if (existing) { existing.remove(); return; }

    let notes = _load();

    const panel = document.createElement('div');
    panel.id        = 'ext-notes-panel';
    panel.className = 'ext-panel';
    panel.style.cssText = 'position:fixed;top:60px;right:20px;width:300px;max-height:70vh;z-index:7900;display:flex;flex-direction:column;';
    document.body.appendChild(panel);

    function render() {
      const existing = document.getElementById(panelId + '-body');
      const body = existing || document.createElement('div');
      body.id = panelId + '-body';
      body.className = 'ext-panel-body';
      body.innerHTML = notes.map((n, i) => `
        <div class="note-item">
          <div class="note-header">
            <span class="note-dot" style="background:${n.color}"></span>
            <input class="note-title" value="${(n.title||'').replace(/"/g,'&quot;')}"
              style="flex:1;background:transparent;border:none;outline:none;color:#e6edf3;font-size:12.5px;font-weight:600"
              data-ni="${i}" placeholder="Note title…">
            <button class="note-del" data-di="${i}">🗑</button>
          </div>
          <div class="note-body">
            <textarea data-ti="${i}" placeholder="Write your note here…"
              style="width:100%;min-height:72px;resize:vertical;background:#161b22;border:none;outline:none;color:#e6edf3;font-size:12px;padding:8px 10px;font-family:inherit;line-height:1.6"
            >${n.text || ''}</textarea>
          </div>
        </div>`).join('') + `
        <button class="note-add-btn" id="_note_add">+ Add Note</button>`;

      if (!existing) panel.appendChild(body);

      body.querySelectorAll('[data-ti]').forEach(ta => {
        ta.addEventListener('input', () => {
          notes[+ta.dataset.ti].text = ta.value;
          _save(notes);
        });
      });
      body.querySelectorAll('[data-ni]').forEach(inp => {
        inp.addEventListener('input', () => {
          notes[+inp.dataset.ni].title = inp.value;
          _save(notes);
        });
      });
      body.querySelectorAll('[data-di]').forEach(btn => {
        btn.addEventListener('click', () => {
          notes.splice(+btn.dataset.di, 1);
          _save(notes); render();
        });
      });
      document.getElementById('_note_add').addEventListener('click', () => {
        notes.push({ title:'', text:'', color: COLORS[notes.length % COLORS.length] });
        _save(notes); render();
      });
    }

    panel.innerHTML = `
      <div class="ext-panel-header">
        <span class="ext-panel-icon">📝</span>
        <span class="ext-panel-title">Workspace Notes</span>
        <button class="ext-panel-close">×</button>
      </div>`;
    panel.querySelector('.ext-panel-close').onclick = () => panel.remove();
    render();
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({
      id: 'ext-notes-btn', icon: '📝', label: 'Notes',
      title: 'Workspace Notes (Ctrl+Alt+K)',
      run: _openPanel,
    });
    document.addEventListener('keydown', _onKey);
  }

  function _onKey(e) {
    if (e.ctrlKey && e.altKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault(); _openPanel();
    }
  }

  function deactivate() {
    document.getElementById('ext-notes-btn')?.remove();
    document.getElementById('ext-notes-panel')?.remove();
    document.removeEventListener('keydown', _onKey);
  }

  function getQuickStart() {
    return {
      icon:'📝', title:'Workspace Notes', subtitle:'Sticky notes that persist per workspace folder',
      steps:[
        { title:'Open Notes Panel', desc:'Click <strong>📝 Notes</strong> in the toolbar or press <kbd>Ctrl+Alt+K</kbd>.' },
        { title:'Add a Note', desc:'Click <strong>+ Add Note</strong> at the bottom. Each note has a color indicator, title, and text area.' },
        { title:'Notes are Workspace-Specific', desc:'Notes are saved separately for each workspace folder. Global notes are saved when no folder is open.' },
      ],
      shortcuts:[{ keys:'Ctrl+Alt+K', desc:'Toggle Notes panel' }],
      commands:[{ name:'notes.open', desc:'Open Workspace Notes panel' }],
      tips:['Notes auto-save as you type — no save button needed.','Each workspace has its own independent note set.'],
      onStart: _openPanel,
    };
  }

  return {
    id:'workspace-notes', activate, deactivate, getQuickStart,
    commands:[{ id:'notes.open', label:'Workspace Notes: Open Panel', run:_openPanel }],
  };
})();
