// ─── Bracket Colors ──────────────────────────────────────────────
(window._exts = window._exts || {})['bracket-colors'] = (() => {
  'use strict';
  function activate() {
    window.editor?.updateOptions({ bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true } });
  }
  function deactivate() {
    window.editor?.updateOptions({ bracketPairColorization: { enabled: false } });
  }
  function getQuickStart() {
    return {
      icon:'🌈', title:'Bracket Colors', subtitle:'Rainbow bracket pairs — instantly find matching brackets',
      steps:[
        { title:'Automatic — No Setup', desc:'Bracket Colors activates immediately. Each pair of (), [], and {} gets a unique color, so you can instantly match them visually.' },
        { title:'Works with All Languages', desc:'Compatible with JavaScript, TypeScript, Python, C, C++, Java, and every other language in the editor.' },
      ],
      shortcuts:[], commands:[],
      tips:['Color assignment is independent per bracket type — () never shares a color with [].',
            'The colors scale with nesting depth, making it easy to see deeply nested structures.'],
    };
  }
  return { id:'bracket-colors', activate, deactivate, getQuickStart, commands:[] };
})();
