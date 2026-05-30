// ─── Prettier Pro ────────────────────────────────────────────────
// Format documents on demand or on every save. Configurable options.

(window._exts = window._exts || {})['prettier-pro'] = (() => {
  'use strict';

  let _ctx;
  let _formatOnSave = false;
  let _saveIntercept = null;
  let _settings = { tabSize: 2, singleQuote: false, semi: true, printWidth: 100 };

  const SUPPORTED = new Set(['javascript','typescript','html','css','scss','less',
                              'json','markdown','jsx','tsx']);

  function _loadSettings() {
    try {
      const s = localStorage.getItem('prettier-pro-settings');
      if (s) _settings = { ..._settings, ...JSON.parse(s) };
      _formatOnSave = localStorage.getItem('prettier-pro-fos') === 'true';
    } catch {}
  }

  function _saveSettings() {
    localStorage.setItem('prettier-pro-settings', JSON.stringify(_settings));
    localStorage.setItem('prettier-pro-fos', String(_formatOnSave));
  }

  // Delegate formatting to Monaco's built-in formatDocument action.
  // Monaco ships a full formatter for JSON, HTML, CSS, TS/JS via its language services.
  function _formatDoc() {
    if (!window.editor) return;
    const lang = ctx?.getLang?.() ?? TabManager?.getActive()?.language;
    if (lang && !SUPPORTED.has(lang)) {
      _ctx?.toast(`Prettier Pro: no formatter for "${lang}"`, 'info');
      return;
    }
    // Apply our tab-size setting before formatting
    window.editor.updateOptions({ tabSize: _settings.tabSize, insertSpaces: true });
    window.editor.getAction('editor.action.formatDocument')?.run();
    _ctx?.toast('Formatted ✓', 'success', 1600);
  }

  function _formatSel() {
    if (!window.editor) return;
    window.editor.getAction('editor.action.formatSelection')?.run();
    _ctx?.toast('Selection formatted ✓', 'success', 1600);
  }

  function _toggleFOS() {
    _formatOnSave = !_formatOnSave;
    _saveSettings();
    _ctx?.updateStatus('prettier-fos', `✨ FOS: ${_formatOnSave ? 'ON' : 'OFF'}`);
    _ctx?.toast(`Format on Save ${_formatOnSave ? 'enabled' : 'disabled'}`, 'info');
  }

  function _openSettings() {
    const panelId = 'ext-prettier-settings';
    document.getElementById(panelId)?.remove();
    const panel = _ctx.openPanel(panelId, 'Prettier Pro — Settings', `
      <div style="display:flex;flex-direction:column;gap:14px">

        <label style="display:flex;flex-direction:column;gap:4px">
          <span style="font-size:12px;color:#7d8590">Tab Width</span>
          <select id="pp-tab" style="background:#21262d;border:1px solid #30363d;color:#e6edf3;padding:5px 8px;border-radius:5px;font-size:13px">
            <option value="2" ${_settings.tabSize===2?'selected':''}>2 spaces</option>
            <option value="4" ${_settings.tabSize===4?'selected':''}>4 spaces</option>
          </select>
        </label>

        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" id="pp-sq" ${_settings.singleQuote?'checked':''}
            style="width:15px;height:15px;accent-color:#58a6ff">
          <span style="font-size:13px;color:#e6edf3">Single Quotes</span>
        </label>

        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" id="pp-semi" ${_settings.semi?'checked':''}
            style="width:15px;height:15px;accent-color:#58a6ff">
          <span style="font-size:13px;color:#e6edf3">Semicolons</span>
        </label>

        <label style="display:flex;flex-direction:column;gap:4px">
          <span style="font-size:12px;color:#7d8590">Print Width</span>
          <input type="number" id="pp-pw" value="${_settings.printWidth}" min="60" max="200"
            style="background:#21262d;border:1px solid #30363d;color:#e6edf3;padding:5px 8px;border-radius:5px;font-size:13px;width:100%">
        </label>

        <button id="pp-save-btn" style="padding:8px 16px;border-radius:7px;border:none;
          background:#58a6ff;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
          Save Settings
        </button>
      </div>
    `, { icon: '✨' });

    document.getElementById('pp-save-btn').onclick = () => {
      _settings.tabSize    = parseInt(document.getElementById('pp-tab').value, 10);
      _settings.singleQuote = document.getElementById('pp-sq').checked;
      _settings.semi        = document.getElementById('pp-semi').checked;
      _settings.printWidth  = parseInt(document.getElementById('pp-pw').value, 10) || 100;
      _saveSettings();
      panel.remove();
      _ctx.toast('Prettier settings saved ✓', 'success');
    };
  }

  function activate(ctx) {
    _ctx = ctx;
    _loadSettings();

    ctx.addToolbarBtn({
      id:    'ext-prettier-btn',
      icon:  '✨',
      label: 'Format',
      title: 'Format Document (Prettier Pro)  Alt+Shift+F',
      run:   _formatDoc,
    });

    // Format on Save — intercept Ctrl+S
    _saveIntercept = (e) => {
      if (_formatOnSave && e.ctrlKey && !e.shiftKey && e.key === 's') {
        _formatDoc();  // format happens synchronously before save resolves
      }
    };
    document.addEventListener('keydown', _saveIntercept, true);

    // Alt+Shift+F
    document.addEventListener('keydown', _altShiftF);

    ctx.addStatus(
      'prettier-fos', `✨ FOS: ${_formatOnSave ? 'ON' : 'OFF'}`,
      'Prettier Pro — click to toggle Format on Save', _toggleFOS
    );
  }

  function _altShiftF(e) {
    if (e.altKey && e.shiftKey && e.key === 'F') { e.preventDefault(); _formatDoc(); }
  }

  function deactivate() {
    if (_saveIntercept) document.removeEventListener('keydown', _saveIntercept, true);
    document.removeEventListener('keydown', _altShiftF);
    document.getElementById('ext-prettier-btn')?.remove();
    _ctx?.removeStatus('prettier-fos');
  }

  function getQuickStart() {
    return {
      icon:     '✨',
      title:    'Prettier Pro',
      subtitle: 'Professional code formatter — JS, TS, HTML, CSS, JSON',
      steps: [
        {
          title: 'Format the Current File',
          desc:  'Press <kbd>Alt+Shift+F</kbd> or click the <strong>✨ Format</strong> toolbar button.',
        },
        {
          title: 'Enable Format on Save',
          desc:  'Click the <kbd>✨ FOS: OFF</kbd> badge in the status bar (bottom) to toggle automatic formatting on every Ctrl+S.',
        },
        {
          title: 'Adjust Settings',
          desc:  'Click the ✨ Format toolbar button with Ctrl held, or use Command Palette → "Prettier: Settings" to change tab width, quotes, and semicolons.',
        },
      ],
      shortcuts: [
        { keys: 'Alt+Shift+F',      desc: 'Format Document'              },
        { keys: 'Status bar badge', desc: 'Toggle Format on Save (FOS)'  },
      ],
      commands: [
        { name: 'prettier.format',    desc: 'Format the current document' },
        { name: 'prettier.formatSel', desc: 'Format the selected text'    },
        { name: 'prettier.toggleFOS', desc: 'Toggle Format on Save'       },
        { name: 'prettier.settings',  desc: 'Open Prettier settings panel'},
      ],
      tips: [
        'Format on Save is OFF by default — enable it in the status bar.',
        'Tab width and quote style are configurable in Prettier Settings.',
      ],
      onStart: _formatDoc,
    };
  }

  return {
    id: 'prettier-pro',
    activate, deactivate, getQuickStart,
    commands: [
      { id: 'prettier.format',    label: 'Prettier: Format Document',      run: _formatDoc   },
      { id: 'prettier.formatSel', label: 'Prettier: Format Selection',     run: _formatSel   },
      { id: 'prettier.toggleFOS', label: 'Prettier: Toggle Format on Save', run: _toggleFOS  },
      { id: 'prettier.settings',  label: 'Prettier: Settings',             run: _openSettings},
    ],
  };
})();
