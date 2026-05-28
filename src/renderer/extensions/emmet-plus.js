// ─── Emmet++ ────────────────────────────────────────────────────
// HTML/CSS abbreviation expansion with smart cursor placement.

(window._exts = window._exts || {})['emmet-plus'] = (() => {
  'use strict';

  let _disposables = [];

  // ── HTML abbreviation expander ────────────────────────────────
  function _expandHtml(abbr) {
    // ul>li*N
    const listMatch = abbr.match(/^(\w+)>([\w-]+)\*(\d+)$/);
    if (listMatch) {
      const [, parent, child, n] = listMatch;
      const items = Array.from({length:+n}, (_,i) =>
        `\t<${child}>\${${i+1}}</${child}>`).join('\n');
      return `<${parent}>\n${items}\n</${parent}>`;
    }
    // element.class
    const classMatch = abbr.match(/^(\w+)\.([\w-]+)$/);
    if (classMatch) return `<${classMatch[1]} class="${classMatch[2]}">\${1}</${classMatch[1]}>`;
    // element#id
    const idMatch = abbr.match(/^(\w+)#([\w-]+)$/);
    if (idMatch) return `<${idMatch[1]} id="${idMatch[2]}">\${1}</${idMatch[1]}>`;
    // element.class#id
    const bothMatch = abbr.match(/^(\w+)\.([\w-]+)#([\w-]+)$/);
    if (bothMatch) return `<${bothMatch[1]} class="${bothMatch[2]}" id="${bothMatch[3]}">\${1}</${bothMatch[1]}>`;
    // input:type
    const inputMatch = abbr.match(/^input:(\w+)$/);
    if (inputMatch) return `<input type="${inputMatch[1]}" name="\${1}" id="\${2}" />`;
    // common tags
    const SELF_CLOSE = new Set(['br','hr','img','input','meta','link','area','base','col','embed','source','track','wbr']);
    if (/^\w+$/.test(abbr)) {
      return SELF_CLOSE.has(abbr) ? `<${abbr} \${1}/>` : `<${abbr}>\${1}</${abbr}>`;
    }
    return null;
  }

  // ── CSS abbreviation expander ─────────────────────────────────
  const CSS_MAP = {
    m:'margin', mt:'margin-top', mb:'margin-bottom', ml:'margin-left', mr:'margin-right',
    p:'padding', pt:'padding-top', pb:'padding-bottom', pl:'padding-left', pr:'padding-right',
    w:'width', h:'height', mw:'max-width', mh:'max-height',
    d:'display', db:'display: block', di:'display: inline', df:'display: flex', dg:'display: grid',
    fl:'float', pos:'position', t:'top', b:'bottom', l:'left', r:'right',
    bg:'background', bgc:'background-color', c:'color',
    fs:'font-size', fw:'font-weight', ff:'font-family', lh:'line-height',
    ta:'text-align', td:'text-decoration', tt:'text-transform',
    bd:'border', br:'border-radius', bs:'box-shadow',
    op:'opacity', ov:'overflow', cur:'cursor', us:'user-select',
    z:'z-index', fxd:'flex-direction', fxw:'flex-wrap', ai:'align-items',
    jc:'justify-content', gap:'gap', g:'gap',
  };

  function _expandCss(abbr) {
    const valMatch = abbr.match(/^([a-z]+)(\d+)(px|em|rem|%|vh|vw)?$/);
    if (valMatch) {
      const [, prop, val, unit] = valMatch;
      const fullProp = CSS_MAP[prop];
      if (fullProp) return `${fullProp}: ${val}${unit||'px'};\${1}`;
    }
    const propOnly = CSS_MAP[abbr];
    if (propOnly) return `${propOnly}: \${1};`;
    return null;
  }

  const HTML_SNIPPETS = [
    { label:'html:5',       detail:'HTML5 boilerplate',
      insertText:'<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${1:Document}</title>\n  <link rel="stylesheet" href="${2:style.css}">\n</head>\n<body>\n  ${3}\n  <script src="${4:script.js}"></script>\n</body>\n</html>' },
    { label:'!',            detail:'HTML5 boilerplate (shorthand)',
      insertText:'<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${1:Document}</title>\n</head>\n<body>\n  ${2}\n</body>\n</html>' },
    { label:'link:css',     detail:'<link> stylesheet',
      insertText:'<link rel="stylesheet" href="${1:style.css}">' },
    { label:'script:src',   detail:'<script src>',
      insertText:'<script src="${1:script.js}"></script>' },
    { label:'meta:viewport',detail:'Viewport meta tag',
      insertText:'<meta name="viewport" content="width=device-width, initial-scale=1.0">' },
    { label:'form:post',    detail:'POST form',
      insertText:'<form action="${1:#}" method="post">\n  ${2}\n  <button type="submit">${3:Submit}</button>\n</form>' },
    { label:'table',        detail:'HTML table',
      insertText:'<table>\n  <thead>\n    <tr><th>${1:Header}</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>${2:Data}</td></tr>\n  </tbody>\n</table>' },
    { label:'flexbox',      detail:'Flexbox container',
      insertText:'<div style="display:flex;align-items:${1:center};justify-content:${2:space-between};gap:${3:16px}">\n  ${4}\n</div>' },
    { label:'grid',         detail:'CSS Grid container',
      insertText:'<div style="display:grid;grid-template-columns:${1:repeat(3,1fr)};gap:${2:16px}">\n  ${3}\n</div>' },
  ];

  function activate() {
    // HTML completion
    _disposables.push(
      monaco.languages.registerCompletionItemProvider('html', {
        triggerCharacters: ['>','.','#','*',':'],
        provideCompletionItems(model, pos) {
          const word  = model.getWordUntilPosition(pos);
          const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber,
                          startColumn:word.startColumn, endColumn:word.endColumn };
          const suggestions = HTML_SNIPPETS.map(s => ({
            label:s.label, kind:monaco.languages.CompletionItemKind.Snippet,
            detail:`⚡ Emmet++ — ${s.detail}`,
            insertText:s.insertText,
            insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          }));
          // Dynamic expansion
          const typed = model.getValueInRange({ startLineNumber:pos.lineNumber, startColumn:1, endLineNumber:pos.lineNumber, endColumn:pos.column }).trim();
          const expanded = _expandHtml(typed);
          if (expanded) suggestions.unshift({
            label: typed,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: '⚡ Emmet++ expand',
            insertText: expanded,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: '0000',
          });
          return { suggestions };
        },
      })
    );

    // CSS completion
    _disposables.push(
      monaco.languages.registerCompletionItemProvider('css', {
        provideCompletionItems(model, pos) {
          const word  = model.getWordUntilPosition(pos);
          const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber,
                          startColumn:word.startColumn, endColumn:word.endColumn };
          const suggestions = Object.entries(CSS_MAP).map(([abbr, prop]) => ({
            label:abbr, kind:monaco.languages.CompletionItemKind.Snippet,
            detail:`⚡ ${prop}`,
            insertText:`${prop}: \${1};`,
            insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          }));
          return { suggestions };
        },
      })
    );
  }

  function deactivate() { _disposables.forEach(d => d.dispose()); _disposables = []; }

  function getQuickStart() {
    return {
      icon:'⚡', title:'Emmet++', subtitle:'HTML/CSS abbreviation expansion with smart Tab stops',
      steps:[
        { title:'Expand HTML Abbreviations', desc:'In an HTML file type <kbd>div.container</kbd> and press Tab, or type <kbd>ul>li*5</kbd> for a 5-item list.' },
        { title:'CSS Shorthand', desc:'In a CSS file type <kbd>m10</kbd> for <code>margin: 10px</code>, <kbd>df</kbd> for <code>display: flex</code>, <kbd>jc</kbd> for <code>justify-content</code>.' },
        { title:'Boilerplate Snippets', desc:'Type <kbd>!</kbd> or <kbd>html:5</kbd> for a complete HTML5 template. Type <kbd>link:css</kbd> for a stylesheet link tag.' },
      ],
      shortcuts:[
        { keys:'div.container → Tab', desc:'<div class="container"></div>' },
        { keys:'ul>li*3 → Tab',       desc:'<ul> with 3 <li> items'       },
        { keys:'m10 (in CSS) → Tab',  desc:'margin: 10px;'                 },
        { keys:'! → Tab (in HTML)',   desc:'Full HTML5 boilerplate'         },
      ],
      commands:[],
      tips:['Works in HTML and CSS files.','CSS abbreviations: m=margin, p=padding, d=display, w=width, h=height, bg=background, c=color.'],
    };
  }

  return {
    id:'emmet-plus', activate, deactivate, getQuickStart, commands:[],
  };
})();
