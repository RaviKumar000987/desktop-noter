// ─── JSON Wizard ─────────────────────────────────────────────────
(window._exts = window._exts || {})['json-wizard'] = (() => {
  'use strict';
  let _ctx;

  function _format() {
    if (!window.editor) return;
    const lang = _ctx?.getLang();
    if (lang === 'json') {
      try {
        const pretty = JSON.stringify(JSON.parse(window.editor.getValue()), null, 2);
        window.editor.setValue(pretty);
        _ctx?.toast('JSON formatted ✓', 'success');
      } catch (e) { _ctx?.toast('Invalid JSON: ' + e.message, 'error'); }
    } else {
      window.editor.getAction('editor.action.formatDocument')?.run();
      _ctx?.toast('Document formatted ✓', 'success');
    }
  }

  function _minify() {
    if (!window.editor || _ctx?.getLang() !== 'json') { _ctx?.toast('Open a JSON file to minify','info'); return; }
    try {
      const mini = JSON.stringify(JSON.parse(window.editor.getValue()));
      window.editor.setValue(mini);
      _ctx?.toast('JSON minified ✓', 'success');
    } catch (e) { _ctx?.toast('Invalid JSON: ' + e.message, 'error'); }
  }

  function _validate() {
    if (!window.editor || _ctx?.getLang() !== 'json') { _ctx?.toast('Open a JSON file to validate','info'); return; }
    try {
      JSON.parse(window.editor.getValue());
      _ctx?.toast('✅ Valid JSON!', 'success');
    } catch (e) { _ctx?.toast('❌ Invalid JSON: ' + e.message, 'error', 5000); }
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({ id:'ext-json-btn', icon:'{}', label:'Format', title:'JSON Wizard — format/minify/validate', languages:['json'], run:_format });
  }

  function deactivate() { document.getElementById('ext-json-btn')?.remove(); }

  function getQuickStart() {
    return {
      icon:'🔮', title:'JSON Wizard', subtitle:'Format, minify, and validate JSON instantly',
      steps:[
        { title:'Format JSON', desc:'Click <strong>{} Format</strong> in the toolbar (visible in .json files) to prettify with 2-space indent.' },
        { title:'Validate JSON', desc:'Use Command Palette → "JSON: Validate" to check syntax. Errors are shown as toasts with line info.' },
        { title:'Minify', desc:'Use Command Palette → "JSON: Minify" to strip all whitespace.' },
      ],
      shortcuts:[{ keys:'{} toolbar (JSON files)', desc:'Format JSON' }],
      commands:[
        { name:'json.format',   desc:'Format JSON with 2-space indent' },
        { name:'json.minify',   desc:'Minify JSON — remove all whitespace' },
        { name:'json.validate', desc:'Validate JSON syntax' },
      ],
      tips:['Format shortcut also works via Alt+Shift+F (Prettier Pro) if both extensions are installed.'],
      onStart:_format,
    };
  }
  return {
    id:'json-wizard', activate, deactivate, getQuickStart,
    commands:[
      { id:'json.format',   label:'JSON Wizard: Format',   run:_format   },
      { id:'json.minify',   label:'JSON Wizard: Minify',   run:_minify   },
      { id:'json.validate', label:'JSON Wizard: Validate', run:_validate },
    ],
  };
})();
