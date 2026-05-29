// ─── Emmet++ v2 — Full VS Code–identical Emmet Engine ────────────────────────
// Supports Tab-key expansion of: !, html:5, div.class, ul>li*5,
// section.hero>h1+p, nav>ul>li*5>a, input:text, table>tr*5>td*4, and more.
// Also handles CSS abbreviations: m10, df, jcc, p20px, etc.

(window._exts = window._exts || {})['emmet-plus'] = (() => {
  'use strict';

  // ── Constants ───────────────────────────────────────────────────────────────
  const VOID_TAGS = new Set([
    'area','base','br','col','embed','hr','img','input',
    'link','meta','param','source','track','wbr',
  ]);

  const HTML_TAGS = new Set([
    'a','abbr','address','article','aside','audio','b','blockquote','body',
    'br','button','canvas','caption','cite','code','col','colgroup','datalist',
    'dd','del','details','dfn','dialog','div','dl','dt','em','embed','fieldset',
    'figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','head',
    'header','hr','html','i','iframe','img','input','ins','kbd','label','legend',
    'li','link','main','map','mark','menu','meta','meter','nav','noscript','ol',
    'optgroup','option','output','p','picture','pre','progress','q','script',
    'section','select','small','source','span','strong','style','sub','summary',
    'sup','table','tbody','td','template','textarea','tfoot','th','thead','time',
    'title','tr','track','u','ul','var','video','wbr',
  ]);

  const HTML5_BOILERPLATE = [
    '<!DOCTYPE html>',
    '<html lang="${1:en}">',
    '<head>',
    '\t<meta charset="UTF-8">',
    '\t<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '\t<title>${2:Document}</title>',
    '</head>',
    '<body>',
    '\t$0',
    '</body>',
    '</html>',
  ].join('\n');

  // ── CSS Abbreviation Map ────────────────────────────────────────────────────
  const CSS_PROP = {
    // Margin
    m:'margin', mt:'margin-top', mb:'margin-bottom', ml:'margin-left', mr:'margin-right',
    mx:'margin-inline', my:'margin-block',
    // Padding
    p:'padding', pt:'padding-top', pb:'padding-bottom', pl:'padding-left', pr:'padding-right',
    px:'padding-inline', py:'padding-block',
    // Size
    w:'width', h:'height',
    mxw:'max-width', mxh:'max-height', mnw:'min-width', mnh:'min-height',
    // Display (some include value)
    d:'display', db:'display:block', di:'display:inline', df:'display:flex',
    dg:'display:grid', dn:'display:none', dib:'display:inline-block',
    dif:'display:inline-flex', dig:'display:inline-grid',
    // Position
    pos:'position', t:'top', b:'bottom', l:'left', r:'right', z:'z-index',
    // Flex
    fxd:'flex-direction', fxw:'flex-wrap', fxg:'flex-grow', fxs:'flex-shrink',
    fxb:'flex-basis', ord:'order',
    ai:'align-items', ac:'align-content', aself:'align-self',
    jc:'justify-content', ji:'justify-items', jself:'justify-self',
    gap:'gap', rg:'row-gap', cg:'column-gap',
    // Grid
    gtc:'grid-template-columns', gtr:'grid-template-rows', gta:'grid-template-areas',
    gaf:'grid-auto-flow', gc:'grid-column', gr:'grid-row',
    // Typography
    fs:'font-size', fw:'font-weight', ff:'font-family', lh:'line-height',
    ls:'letter-spacing', ws:'word-spacing', ta:'text-align', td:'text-decoration',
    tt:'text-transform', va:'vertical-align', whs:'white-space', wbreak:'word-break',
    // Color & Background
    c:'color', bg:'background', bgc:'background-color', bgi:'background-image',
    bgp:'background-position', bgs:'background-size', bgr:'background-repeat',
    bga:'background-attachment',
    // Border
    bd:'border', bdt:'border-top', bdb:'border-bottom', bdl:'border-left',
    bdr:'border-right', bdc:'border-color', bdw:'border-width', bds:'border-style',
    br:'border-radius', brtl:'border-top-left-radius', btrr:'border-top-right-radius',
    brbr:'border-bottom-right-radius', brbl:'border-bottom-left-radius',
    // Effects
    bs:'box-shadow', op:'opacity', tran:'transition', anim:'animation',
    tf:'transform', tfo:'transform-origin',
    // Layout
    fl:'float', clr:'clear', ov:'overflow', ofx:'overflow-x', ofy:'overflow-y',
    vis:'visibility', obj:'object-fit', bxz:'box-sizing', res:'resize',
    // Interaction
    cur:'cursor', us:'user-select', pe:'pointer-events',
    // Misc
    ct:'content', vw:'visibility', scb:'scroll-behavior',
  };

  const CSS_VALUE = {
    f:'flex', g:'grid', n:'none', b:'block', i:'inline', ib:'inline-block',
    if:'inline-flex', ig:'inline-grid',
    r:'relative', a:'absolute', fi:'fixed', s:'sticky', st:'static',
    t:'transparent', cc:'currentColor',
    c:'center', sb:'space-between', sa:'space-around', se:'space-evenly',
    fs:'flex-start', fe:'flex-end',
    row:'row', col:'column',
    wr:'wrap', nw:'nowrap',
    au:'auto', no:'normal',
    bd:'bold', bolder:'bolder',
    un:'underline', lt:'line-through',
    up:'uppercase', lc:'lowercase', cap:'capitalize',
    l:'left', ri:'right', ju:'justify',
  };

  // ── Parser ──────────────────────────────────────────────────────────────────
  // Grammar:
  //   group    := sequence ('+' sequence)*
  //   sequence := item ('>' group)?
  //   item     := '(' group ')' mult? | element
  //   element  := tagname? modifier* mult?
  //   modifier := '.' ident | '#' ident | ':' ident | '[' attrs ']' | '{' text '}'
  //   mult     := '*' digit+

  class _Parser {
    constructor(src) { this.s = src; this.i = 0; }
    ch(d = 0) { return this.s[this.i + d]; }
    end()     { return this.i >= this.s.length; }
    eat()     { return this.s[this.i++]; }

    parse() {
      const node = this._group();
      return node;
    }

    _group() {
      const items = [this._seq()];
      while (!this.end() && this.ch() === '+') {
        this.eat();
        if (!this.end() && this.ch() !== ')') items.push(this._seq());
      }
      return { t: 'group', items };
    }

    _seq() {
      const node = this._item();
      if (!this.end() && this.ch() === '>') {
        this.eat();
        node.children = this._group();
      }
      return node;
    }

    _item() {
      if (!this.end() && this.ch() === '(') {
        this.eat();
        const g = this._group();
        if (!this.end() && this.ch() === ')') this.eat();
        let m = 1;
        if (!this.end() && this.ch() === '*') { this.eat(); m = parseInt(this._num()) || 1; }
        return { t: 'repeat', group: g, m };
      }
      return this._el();
    }

    _el() {
      let tag = '';
      while (!this.end() && /[a-z0-9-]/i.test(this.ch())) tag += this.eat();

      const node = { t: 'el', tag: tag || 'div', cls: [], id: null, attrs: {}, text: null, m: 1, children: null };

      while (!this.end()) {
        const c = this.ch();
        if      (c === '.') { this.eat(); node.cls.push(this._ident()); }
        else if (c === '#') { this.eat(); node.id = this._ident(); }
        else if (c === ':') { this.eat(); node.attrs.type = this._ident(); }
        else if (c === '*') { this.eat(); node.m = parseInt(this._num()) || 1; }
        else if (c === '[') { this.eat(); this._attrs(node.attrs); if (this.ch() === ']') this.eat(); }
        else if (c === '{') { this.eat(); node.text = this._until('}'); if (!this.end()) this.eat(); }
        else break;
      }
      return node;
    }

    _attrs(out) {
      const raw = this._until(']');
      const re = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
      let m;
      while ((m = re.exec(raw)) !== null) out[m[1]] = m[2] ?? m[3] ?? m[4] ?? true;
    }

    _ident() { let s=''; while (!this.end() && /[\w-]/.test(this.ch())) s += this.eat(); return s; }
    _num()   { let s=''; while (!this.end() && /\d/.test(this.ch())) s += this.eat(); return s; }
    _until(c){ let s=''; while (!this.end() && this.ch() !== c) s += this.eat(); return s; }
  }

  // ── Generator ───────────────────────────────────────────────────────────────
  class _Gen {
    constructor() { this.n = 0; }
    tab()        { return `\${${++this.n}}`; }

    render(node, ind) {
      if (node.t === 'group') {
        return node.items.map(x => this.render(x, ind)).join('\n' + ind);
      }
      if (node.t === 'repeat') {
        const parts = [];
        for (let i = 0; i < node.m; i++) parts.push(this.render(node.group, ind));
        return parts.join('\n' + ind);
      }
      if (node.t === 'el') {
        const out = [];
        for (let i = 0; i < node.m; i++) out.push(this._tag(node, ind));
        return out.join('\n' + ind);
      }
      return '';
    }

    _tag(node, ind) {
      const { tag, cls, id, attrs, text, children } = node;

      let astr = '';
      if (id) astr += ` id="${id}"`;
      if (cls.length) astr += ` class="${cls.join(' ')}"`;
      for (const [k, v] of Object.entries(attrs)) {
        astr += (v === true) ? ` ${k}` : ` ${k}="${v}"`;
      }

      if (VOID_TAGS.has(tag)) return `<${tag}${astr}>`;

      let inner;
      if (children) {
        inner = '\n' + ind + '\t' + this.render(children, ind + '\t') + '\n' + ind;
      } else if (text != null) {
        inner = text || this.tab();
      } else {
        inner = this.tab();
      }

      return `<${tag}${astr}>${inner}</${tag}>`;
    }
  }

  // ── Expanders ───────────────────────────────────────────────────────────────
  function _expandHtml(abbr) {
    if (abbr === '!' || abbr === 'html:5') return HTML5_BOILERPLATE;

    // Only proceed if abbreviation looks like Emmet (has operators or is a known tag)
    const hasOp = /[>.+*#[\]{]/.test(abbr) || /[.]([\w-]+)/.test(abbr) || /:\w/.test(abbr);
    const isTag = HTML_TAGS.has(abbr.toLowerCase());
    if (!hasOp && !isTag) return null;

    try {
      const ast = new _Parser(abbr).parse();
      const gen = new _Gen();
      return gen.render(ast, '');
    } catch { return null; }
  }

  function _expandCss(abbr) {
    // Explicit value: d:f → display: flex;  jc:sb → justify-content: space-between;
    const ci = abbr.indexOf(':');
    if (ci > 0) {
      const pa = abbr.slice(0, ci);
      const va = abbr.slice(ci + 1);
      const prop = CSS_PROP[pa] || pa;
      const val  = CSS_VALUE[va] || va;
      return `${prop}: ${val};\${0}`;
    }

    // Property + number + optional unit: m10, p20px, w100%, fs1.5rem
    const nm = abbr.match(/^([a-z_]+?)(-?[\d.]+)(px|em|rem|%|vh|vw|vmin|vmax|fr|s|ms|deg)?$/i);
    if (nm) {
      const [, pa, val, unit] = nm;
      const prop = CSS_PROP[pa];
      if (prop && !prop.includes(':')) {
        const u = unit || (prop.includes('duration') || prop.includes('delay') ? 'ms' : 'px');
        return `${prop}: ${val}${u};\${0}`;
      }
    }

    // Pure property abbreviation (with implicit value): df, dg, etc.
    const full = CSS_PROP[abbr];
    if (!full) return null;
    if (full.includes(':')) {
      // Abbreviation encodes both prop and value (e.g. "df" → "display:flex")
      const [prop, val] = full.split(':');
      return `${prop}: ${val};\${0}`;
    }
    return `${full}: \${1};\${0}`;
  }

  // ── Tab-key expansion (VS Code behaviour) ────────────────────────────────────
  function _isSuggestVisible(ed) {
    try { return !!ed._contextKeyService?.getContextKeyValue?.('suggestWidgetVisible'); }
    catch { return false; }
  }
  function _isInSnippet(ed) {
    try { return !!ed._contextKeyService?.getContextKeyValue?.('inSnippetMode'); }
    catch { return false; }
  }

  function _tryExpand(ed) {
    const model = ed.getModel();
    if (!model) return false;

    const lang = model.getLanguageId();
    const isHtml = ['html','javascriptreact','typescriptreact'].includes(lang);
    const isCss  = ['css','scss','less'].includes(lang);
    if (!isHtml && !isCss) return false;

    const pos    = ed.getPosition();
    const line   = model.getLineContent(pos.lineNumber);
    const before = line.slice(0, pos.column - 1);

    // Extract potential abbreviation (stops at whitespace/delimiters)
    const match = before.match(/([^\s<>"'`=;,()[\]{}|!@#$%^&\\]+)$/);
    if (!match) return false;

    const abbr     = match[1];
    const expanded = isHtml ? _expandHtml(abbr) : _expandCss(abbr);
    if (!expanded) return false;

    // Delete abbreviation then insert as Monaco snippet
    const startCol = pos.column - abbr.length;
    ed.executeEdits('emmet', [{
      range: new monaco.Range(pos.lineNumber, startCol, pos.lineNumber, pos.column),
      text: '',
    }]);
    ed.trigger('emmet', 'editor.action.insertSnippet', { snippet: expanded });
    return true;
  }

  function _hookTab(ed) {
    ed.onKeyDown(e => {
      if (e.keyCode !== monaco.KeyCode.Tab) return;
      if (e.shiftKey || e.ctrlKey || e.altKey)   return;
      if (_isSuggestVisible(ed))                  return; // accept suggestion instead
      if (_isInSnippet(ed))                       return; // navigate snippet tab stop

      const sel = ed.getSelection();
      if (sel && !sel.isEmpty())                  return; // block-indent selected lines

      if (_tryExpand(ed)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  // ── Completion provider (dropdown preview of Emmet suggestions) ─────────────
  let _disposables = [];

  function _registerProviders() {
    // ── HTML / JSX / TSX ──────────────────────────────────────────────────
    _disposables.push(
      monaco.languages.registerCompletionItemProvider(
        ['html', 'javascriptreact', 'typescriptreact'],
        {
          triggerCharacters: ['>','.','#','*',':','(','!','[','{','+'],
          provideCompletionItems(model, pos) {
            const line   = model.getLineContent(pos.lineNumber);
            const before = line.slice(0, pos.column - 1);
            const match  = before.match(/([^\s<>"'`=;,()[\]{}|]+)$/);
            const abbr   = match ? match[1] : model.getWordUntilPosition(pos).word;
            if (!abbr) return { suggestions: [] };

            const expanded = _expandHtml(abbr);
            if (!expanded) return { suggestions: [] };

            const range = {
              startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber,
              startColumn: pos.column - abbr.length, endColumn: pos.column,
            };
            return {
              suggestions: [{
                label: abbr,
                kind:  monaco.languages.CompletionItemKind.Snippet,
                detail: '⚡ Emmet expansion  (Tab)',
                documentation: { value: `Expands **\`${abbr}\`** via Emmet.\n\nPress **Tab** outside the suggestions list for instant expansion.` },
                insertText: expanded,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                sortText: '000',
                range,
              }],
            };
          },
        }
      )
    );

    // ── CSS / SCSS / LESS ──────────────────────────────────────────────────
    _disposables.push(
      monaco.languages.registerCompletionItemProvider(
        ['css', 'scss', 'less'],
        {
          provideCompletionItems(model, pos) {
            const word = model.getWordUntilPosition(pos);
            if (!word.word) return { suggestions: [] };
            const range = {
              startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber,
              startColumn: word.startColumn, endColumn: word.endColumn,
            };
            return {
              suggestions: Object.entries(CSS_PROP)
                .filter(([abbr]) => abbr.startsWith(word.word))
                .map(([abbr, full]) => {
                  const snippet = full.includes(':')
                    ? `${full.replace(':', ': ')};\${0}`
                    : `${full}: \${1};\${0}`;
                  return {
                    label: abbr,
                    kind:  monaco.languages.CompletionItemKind.Snippet,
                    detail: `⚡ Emmet — ${full.replace(':', ': ')}`,
                    insertText: snippet,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    sortText: '0' + abbr,
                    range,
                  };
                }),
            };
          },
        }
      )
    );
  }

  // ── Activate / deactivate ───────────────────────────────────────────────────
  function activate() {
    const ready = () => {
      if (typeof monaco === 'undefined') return;
      _registerProviders();
      // Attach Tab hook once editor exists
      const attach = () => {
        if (window.editor) { _hookTab(window.editor); }
        else setTimeout(attach, 300);
      };
      attach();
    };
    document.addEventListener('monaco-ready', ready);
  }

  function deactivate() {
    _disposables.forEach(d => d.dispose?.());
    _disposables = [];
  }

  // ── Quick-start card ────────────────────────────────────────────────────────
  function getQuickStart() {
    return {
      icon: '⚡', title: 'Emmet++', subtitle: 'VS Code–identical Emmet abbreviation expansion',
      steps: [
        { title: 'Tab Expansion', desc: 'Type any Emmet abbreviation and press <kbd>Tab</kbd> to expand instantly — no dropdown required.' },
        { title: 'HTML Structures', desc: 'Type <kbd>ul&gt;li*5</kbd> for a list · <kbd>section.hero&gt;h1+p</kbd> for nested section · <kbd>table&gt;tr*3&gt;td*4</kbd> for a table.' },
        { title: 'Boilerplate', desc: 'Type <kbd>!</kbd> or <kbd>html:5</kbd> and press Tab for a complete HTML5 template with tab stops.' },
        { title: 'CSS Shortcuts', desc: 'In CSS/SCSS/LESS: <kbd>m10</kbd> → <code>margin: 10px</code> · <kbd>df</kbd> → <code>display: flex</code> · <kbd>jc:sb</kbd> → <code>justify-content: space-between</code>.' },
      ],
      shortcuts: [
        { keys: '! → Tab',                desc: 'Full HTML5 boilerplate' },
        { keys: 'div.container → Tab',    desc: '<div class="container"></div>' },
        { keys: 'ul>li*5 → Tab',          desc: '<ul> with 5 <li> items & tab stops' },
        { keys: 'section.hero>h1+p',      desc: 'Section containing h1 + p siblings' },
        { keys: 'nav>ul>li*5>a',          desc: 'Deeply nested nav structure' },
        { keys: 'table>tr*3>td*4 → Tab',  desc: '3 rows × 4 columns table' },
        { keys: 'input:email → Tab',      desc: '<input type="email">' },
        { keys: 'm10 (CSS → Tab)',         desc: 'margin: 10px;' },
        { keys: 'df (CSS → Tab)',          desc: 'display: flex;' },
        { keys: 'jc:c (CSS → Tab)',        desc: 'justify-content: center;' },
      ],
      commands: [],
      tips: [
        'Tab expansion works in HTML, JSX, TSX, CSS, SCSS, and LESS.',
        'Emmet takes priority over the suggestion dropdown on Tab.',
        'Use > for child nesting, + for siblings, * for repetition.',
        'Use . for class, # for id, : for attribute type (input:text).',
        'CSS: abbreviation + number + unit (w100%, fs1.5rem, p20px).',
        'CSS: prop:val shorthand (d:f = display:flex, pos:a = position:absolute).',
      ],
    };
  }

  return { id:'emmet-plus', name:'Emmet++', version:'2.0.0', activate, deactivate, getQuickStart, commands:[] };
})();
