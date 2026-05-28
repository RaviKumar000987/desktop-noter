// ─── Error Lens ──────────────────────────────────────────────────
// Inline error/warning messages directly in the editor via Monaco decorations.

(window._exts = window._exts || {})['error-lens'] = (() => {
  'use strict';

  let _ctx;
  let _enabled    = true;
  let _decorIds   = [];
  let _markerSub  = null;
  let _modelSub   = null;
  let _statusEl   = null;

  // Severity constants: error=8, warning=4, info=2, hint=1
  const SEV = { 8: 'error', 4: 'warning', 2: 'hint', 1: 'hint' };

  function _refresh() {
    if (!window.editor || !_enabled) { _clearDecorations(); return; }
    const model = window.editor.getModel();
    if (!model) return;

    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const decorations = markers.map(m => {
      const sev  = SEV[m.severity] || 'hint';
      const icon = sev === 'error' ? '⚠' : sev === 'warning' ? '⚡' : 'ℹ';
      const msg  = m.message.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return {
        range: {
          startLineNumber: m.startLineNumber, startColumn: 1,
          endLineNumber:   m.startLineNumber, endColumn:   1,
        },
        options: {
          isWholeLine:      true,
          className:        `el-line-${sev}`,
          after: {
            content:         ` ${icon} ${m.message.split('\n')[0].slice(0,120)}`,
            inlineClassName: `el-inline-${sev}`,
          },
        },
      };
    });

    _decorIds = window.editor.deltaDecorations(_decorIds, decorations);
  }

  function _clearDecorations() {
    if (window.editor) _decorIds = window.editor.deltaDecorations(_decorIds, []);
  }

  function _toggle() {
    _enabled = !_enabled;
    if (_statusEl) _statusEl.textContent = `EL: ${_enabled ? 'ON' : 'OFF'}`;
    if (!_enabled) _clearDecorations();
    else _refresh();
    _ctx?.toast(`Error Lens ${_enabled ? 'enabled' : 'disabled'}`, 'info');
  }

  function activate(ctx) {
    _ctx = ctx;
    _enabled = localStorage.getItem('error-lens-enabled') !== 'false';

    // Listen for marker changes on any model
    _markerSub = monaco.editor.onDidChangeMarkers(() => _refresh());

    // Re-run when model changes (tab switch)
    _modelSub = window.editor?.onDidChangeModel(() => {
      _decorIds = [];
      setTimeout(_refresh, 100);
    });

    _refresh();

    _statusEl = ctx.addStatus(
      'error-lens', `EL: ${_enabled ? 'ON' : 'OFF'}`,
      'Error Lens — click to toggle', _toggle, 'right'
    );
  }

  function deactivate() {
    _markerSub?.dispose();
    _modelSub?.dispose();
    _clearDecorations();
    _ctx?.removeStatus('error-lens');
  }

  function getQuickStart() {
    return {
      icon:     '🔴',
      title:    'Error Lens',
      subtitle: 'Inline errors & warnings — no more hover hunting',
      steps: [
        {
          title: 'Automatic — no setup needed',
          desc:  'Error Lens activates immediately. Errors appear in <span style="color:#f85149">red</span>, warnings in <span style="color:#d2993d">yellow</span>, hints in <span style="color:#58a6ff">blue</span> at the end of affected lines.',
        },
        {
          title: 'Toggle On / Off',
          desc:  'Click the <kbd>EL: ON</kbd> badge in the status bar, or use Command Palette → "Error Lens: Toggle".',
        },
        {
          title: 'Works with All Monaco Languages',
          desc:  'TypeScript, JavaScript, CSS, JSON, HTML — all diagnostics from Monaco language services are shown inline.',
        },
      ],
      shortcuts: [
        { keys: 'Status bar EL badge', desc: 'Toggle Error Lens on / off' },
      ],
      commands: [
        { name: 'error-lens.toggle', desc: 'Toggle inline error display' },
      ],
      tips: [
        'Error Lens reads Monaco\'s built-in diagnostics — no external linter needed.',
        'Only the first line of a multi-line error message is shown inline.',
      ],
    };
  }

  return {
    id: 'error-lens',
    activate, deactivate, getQuickStart,
    commands: [
      { id: 'error-lens.toggle', label: 'Error Lens: Toggle Inline Errors', run: _toggle },
    ],
  };
})();
