// ═══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS UI — keybindings-ui.js
//  VS Code-style editor: search · edit · record · conflict detect
//  Depends on: command-registry.js, keybindings.js
// ═══════════════════════════════════════════════════════════════

window.KeybindingsUI = (() => {
  let _panel    = null;
  let _recording = false;
  let _editCmd  = null;
  let _recorded = '';
  let _recListener = null;

  // ── Build panel ───────────────────────────────────────────────
  function _build() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.id = 'kb-overlay';
    _panel.innerHTML = `
      <div class="kb-panel">
        <div class="kb-header">
          <div class="kb-hdr-left">
            <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" style="flex-shrink:0">
              <path d="M0 5.75A5.75 5.75 0 0 1 11.5 5a4.5 4.5 0 0 1 4.496 4.502.75.75 0 0 1-1.5.002A3 3 0 0 0 11.5 6.5a4.25 4.25 0 1 0 0 8.5h3.25a.75.75 0 0 1 0 1.5H11.5A5.75 5.75 0 0 1 0 10.75v-5Z"/>
            </svg>
            <span class="kb-hdr-title">Keyboard Shortcuts</span>
          </div>
          <div class="kb-hdr-center">
            <input id="kb-search" class="kb-search-input"
                   type="text" placeholder="Search by keybinding, command, or category…"
                   autocomplete="off" spellcheck="false"/>
          </div>
          <div class="kb-hdr-right">
            <button class="kb-icon-btn" id="kb-export-btn" title="Export keybindings (JSON)">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Zm-1-5.427 3.22-3.22a.75.75 0 1 1 1.06 1.06L4.81 7.625 7.25 10.066V2.75a.75.75 0 0 1 1.5 0v7.316l2.44-2.44a.749.749 0 0 1 1.06 1.06l-3.5 3.5a.749.749 0 0 1-1.06 0l-3.5-3.5a.749.749 0 0 1 0-1.06Z"/>
              </svg>
            </button>
            <button class="kb-icon-btn" id="kb-import-btn" title="Import keybindings (JSON)">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Zm5.03-11.78a.749.749 0 0 1 1.06 1.06l-3.22 3.22h7.69a.75.75 0 0 1 0 1.5H5.62l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-4.5-4.5a.749.749 0 0 1 0-1.06l4.5-4.5Z"/>
              </svg>
            </button>
            <button class="kb-icon-btn" id="kb-reset-all-btn" title="Reset all to defaults">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M2.083 9h1.423a.75.75 0 0 1 0 1.5H0V7.25a.75.75 0 0 1 1.5 0v1.51l.184-.185a7.001 7.001 0 0 1 9.77.306 7 7 0 0 1-.047 9.92.75.75 0 0 1-1.053-1.068A5.5 5.5 0 1 0 5.25 4.12l-.24.007V5.5a.75.75 0 0 1-1.5 0V2.833a.75.75 0 0 1 .75-.75h2.499A.75.75 0 0 1 7 3.583v1.42Z"/>
              </svg>
            </button>
            <button class="kb-icon-btn" id="kb-close-btn" title="Close (Esc)">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="kb-cols-header">
          <span class="kb-col-key">Keybinding</span>
          <span class="kb-col-cmd">Command</span>
          <span class="kb-col-cat">Category</span>
          <span class="kb-col-src">Source</span>
          <span class="kb-col-act"></span>
        </div>
        <div id="kb-list" class="kb-list"></div>
      </div>

      <!-- Key recorder modal -->
      <div id="kb-rec-modal" class="kb-rec-modal" style="display:none">
        <div class="kb-rec-box">
          <div class="kb-rec-title">Press desired key combination</div>
          <div id="kb-rec-display" class="kb-rec-display">Waiting for keys…</div>
          <div class="kb-rec-hint">
            Press <kbd>Esc</kbd> to cancel &nbsp;·&nbsp; <kbd>Enter</kbd> to confirm
          </div>
          <div id="kb-rec-conflict" class="kb-rec-conflict" style="display:none"></div>
          <div class="kb-rec-actions">
            <button id="kb-rec-cancel" class="kb-btn">Cancel</button>
            <button id="kb-rec-confirm" class="kb-btn kb-btn-primary" disabled>Assign</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(_panel);
    _bindEvents();
  }

  function _bindEvents() {
    _panel.querySelector('#kb-close-btn').addEventListener('click', close);
    _panel.querySelector('#kb-search').addEventListener('input', e => _render(e.target.value));

    _panel.addEventListener('click', e => { if (e.target === _panel) close(); });
    _panel.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !_recording) { e.stopPropagation(); close(); }
    });

    _panel.querySelector('#kb-export-btn').addEventListener('click', () => {
      const json = NoterKeybindings.exportBindings();
      _downloadText(json, 'noter-keybindings.json');
    });

    _panel.querySelector('#kb-import-btn').addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json';
      inp.onchange = async () => {
        const text = await inp.files[0]?.text();
        if (!text) return;
        if (NoterKeybindings.importBindings(text)) {
          _render();
          typeof toast === 'function' && toast('Keybindings imported', 'info');
        } else {
          typeof toast === 'function' && toast('Invalid keybindings file', 'error');
        }
      };
      inp.click();
    });

    _panel.querySelector('#kb-reset-all-btn').addEventListener('click', () => {
      if (!confirm('Reset ALL keyboard shortcuts to defaults?')) return;
      NoterKeybindings.resetAll();
      _render();
      typeof toast === 'function' && toast('All shortcuts reset to defaults', 'info');
    });

    _panel.querySelector('#kb-rec-cancel').addEventListener('click', _cancelRec);
    _panel.querySelector('#kb-rec-confirm').addEventListener('click', _confirmRec);
  }

  // ── Render list ───────────────────────────────────────────────
  function _render(q) {
    const list = _panel?.querySelector('#kb-list');
    if (!list) return;
    const lq = ((q !== undefined ? q : _panel?.querySelector('#kb-search')?.value) || '').toLowerCase().trim();

    let bindings = NoterKeybindings.getAll();
    if (lq) {
      bindings = bindings.filter(b =>
        b.label.toLowerCase().includes(lq)       ||
        b.command.toLowerCase().includes(lq)     ||
        b.effectiveKey.toLowerCase().includes(lq)||
        b.category.toLowerCase().includes(lq)
      );
    }

    if (!bindings.length) {
      list.innerHTML = `<div class="kb-empty">No keybindings match "<strong>${lq}</strong>"</div>`;
      return;
    }

    // Group by category
    const groups = {};
    for (const b of bindings) {
      (groups[b.category] = groups[b.category] || []).push(b);
    }

    list.innerHTML = Object.entries(groups).map(([cat, items]) => `
      <div class="kb-group">
        <div class="kb-group-label">${cat}</div>
        ${items.map(_row).join('')}
      </div>`).join('');

    list.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => _startRec(btn.dataset.edit))
    );
    list.querySelectorAll('[data-reset]').forEach(btn =>
      btn.addEventListener('click', () => { NoterKeybindings.resetBinding(btn.dataset.reset); _render(); })
    );
    list.querySelectorAll('[data-clear]').forEach(btn =>
      btn.addEventListener('click', () => { NoterKeybindings.setUserBinding(btn.dataset.clear, ''); _render(); })
    );
  }

  function _row(b) {
    const conflicts = NoterKeybindings.getConflicts(b.effectiveKey, b.command);
    const hasConflict = conflicts.length > 0 && b.effectiveKey;
    return `
      <div class="kb-row ${b.isCustom ? 'kb-row-custom' : ''} ${hasConflict ? 'kb-row-conflict' : ''}">
        <span class="kb-col-key">
          ${b.effectiveKey
            ? `<kbd class="kb-key-badge">${_fmtKey(b.effectiveKey)}</kbd>`
            : '<span class="kb-unbound">unbound</span>'}
          ${hasConflict ? `<span class="kb-warn" title="Conflicts with: ${conflicts.map(c=>c.label).join(', ')}">⚠</span>` : ''}
        </span>
        <span class="kb-col-cmd">
          <span class="kb-cmd-label">${b.label}</span>
          ${b.isCustom ? '<span class="kb-custom-tag">custom</span>' : ''}
          <span class="kb-cmd-id">${b.command}</span>
        </span>
        <span class="kb-col-cat">${b.category}</span>
        <span class="kb-col-src">${b.source}</span>
        <span class="kb-col-act">
          <button class="kb-row-btn" data-edit="${b.command}" title="Change keybinding">✎</button>
          ${b.effectiveKey ? `<button class="kb-row-btn" data-clear="${b.command}" title="Remove keybinding">✕</button>` : ''}
          ${b.isCustom ? `<button class="kb-row-btn kb-row-btn-reset" data-reset="${b.command}" title="Reset to default">↺</button>` : ''}
        </span>
      </div>`;
  }

  function _fmtKey(key) {
    return key.split(' ').map(chord =>
      chord.split('+').map(k => k.charAt(0).toUpperCase() + k.slice(1)).join('+')
    ).join(' → ');
  }

  // ── Key recorder ──────────────────────────────────────────────
  function _startRec(commandId) {
    _editCmd  = commandId;
    _recorded = '';
    _recording = true;

    const modal   = _panel.querySelector('#kb-rec-modal');
    const display = _panel.querySelector('#kb-rec-display');
    const confirm = _panel.querySelector('#kb-rec-confirm');
    const warn    = _panel.querySelector('#kb-rec-conflict');

    modal.style.display = 'flex';
    display.textContent = 'Waiting for keys…';
    confirm.disabled = true;
    warn.style.display = 'none';

    _recListener = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { _cancelRec(); return; }
      if (e.key === 'Enter' && _recorded) { _confirmRec(); return; }

      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.altKey)  parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      const k = e.key.toLowerCase();
      if (!['control','alt','shift','meta'].includes(k)) parts.push(k);
      if (parts.length < 2) return;

      _recorded = parts.join('+');
      display.textContent = _fmtKey(_recorded);
      confirm.disabled = false;

      const conflicts = NoterKeybindings.getConflicts(_recorded, _editCmd);
      if (conflicts.length) {
        warn.style.display = 'block';
        warn.textContent = `⚠ Already used by: ${conflicts.map(c => c.label).join(', ')}`;
      } else {
        warn.style.display = 'none';
      }
    };

    document.addEventListener('keydown', _recListener, true);
  }

  function _cancelRec() {
    _recording = false; _editCmd = null; _recorded = '';
    document.removeEventListener('keydown', _recListener, true);
    if (_panel) _panel.querySelector('#kb-rec-modal').style.display = 'none';
  }

  function _confirmRec() {
    if (_recorded && _editCmd) {
      NoterKeybindings.setUserBinding(_editCmd, _recorded);
      _render();
      typeof toast === 'function' && toast(`Shortcut assigned: ${_fmtKey(_recorded)}`, 'info');
    }
    _cancelRec();
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _downloadText(text, filename) {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([text], { type: 'application/json' })),
      download: filename,
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  // ── Open / Close ──────────────────────────────────────────────
  function open() {
    _build();
    _panel.classList.add('kb-visible');
    _render();
    setTimeout(() => _panel.querySelector('#kb-search')?.focus(), 60);
  }

  function close() {
    if (_recording) _cancelRec();
    _panel?.classList.remove('kb-visible');
    setTimeout(() => (window._refocusEditor || (() => window.editor?.focus()))(), 50);
  }

  // ── Register command (after registry is ready) ────────────────
  document.addEventListener('DOMContentLoaded', () => {
    if (window.NoterCommands) {
      NoterCommands.register({
        id: 'workbench.keyboardShortcuts',
        title: 'Keyboard Shortcuts',
        category: 'Workspace',
        description: 'Open the keyboard shortcuts editor',
        aliases: ['keybindings', 'shortcuts'],
        handler: open,
      });
    }
  });

  return { open, close };
})();
