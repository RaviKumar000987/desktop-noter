/**
 * Web IntelliSense v2 — HTML · CSS · Tailwind · SVG
 * CSS value completions · HTML hover docs · Tailwind hover docs
 * ARIA support · event attributes · property-value awareness
 */
"use strict";

window._exts = window._exts || {};
window._exts['web-intellisense'] = {
  id:   'web-intellisense',
  name: 'Web IntelliSense',
  icon: '🌐',
  desc: 'HTML attributes, CSS values, Tailwind CSS, SVG patterns, hover documentation',
  version: '2.0.0',
  category: 'IntelliSense',

  activate() {
    document.addEventListener('monaco-ready', () => _register());
  },
};

function _register() {
  if (typeof monaco === 'undefined') return;

  // ════════════════════════════════════════════════════════════════════════════
  //  CSS PROPERTY VALUE COMPLETIONS
  //  Fires when the cursor is after "property: " inside CSS/SCSS/LESS/style attrs
  // ════════════════════════════════════════════════════════════════════════════
  const CSS_VALUES = {
    'display':              ['flex','grid','block','inline','inline-block','inline-flex','inline-grid','none','table','table-row','table-cell','flow-root','contents','list-item'],
    'position':             ['relative','absolute','fixed','sticky','static'],
    'float':                ['left','right','none','inline-start','inline-end'],
    'clear':                ['both','left','right','none'],
    'overflow':             ['hidden','auto','scroll','visible','clip'],
    'overflow-x':           ['hidden','auto','scroll','visible','clip'],
    'overflow-y':           ['hidden','auto','scroll','visible','clip'],
    'flex-direction':       ['row','column','row-reverse','column-reverse'],
    'flex-wrap':            ['nowrap','wrap','wrap-reverse'],
    'justify-content':      ['center','space-between','space-around','space-evenly','flex-start','flex-end','start','end','normal','stretch'],
    'align-items':          ['center','flex-start','flex-end','stretch','baseline','start','end'],
    'align-content':        ['center','space-between','space-around','flex-start','flex-end','stretch','normal'],
    'align-self':           ['auto','center','flex-start','flex-end','stretch','baseline'],
    'justify-items':        ['start','end','center','stretch','auto'],
    'justify-self':         ['auto','start','end','center','stretch'],
    'object-fit':           ['cover','contain','fill','none','scale-down'],
    'object-position':      ['center','top','bottom','left','right','top left','top right','bottom left','bottom right'],
    'visibility':           ['visible','hidden','collapse'],
    'cursor':               ['pointer','default','text','wait','not-allowed','grab','grabbing','zoom-in','zoom-out','move','crosshair','help','none','auto'],
    'text-align':           ['left','right','center','justify','start','end'],
    'text-transform':       ['none','uppercase','lowercase','capitalize','full-width'],
    'text-decoration':      ['none','underline','overline','line-through','underline overline'],
    'text-overflow':        ['ellipsis','clip'],
    'vertical-align':       ['baseline','top','middle','bottom','text-top','text-bottom','sub','super'],
    'white-space':          ['normal','nowrap','pre','pre-wrap','pre-line','break-spaces'],
    'word-break':           ['normal','break-all','keep-all','break-word'],
    'font-style':           ['normal','italic','oblique'],
    'font-weight':          ['normal','bold','bolder','lighter','100','200','300','400','500','600','700','800','900'],
    'font-variant':         ['normal','small-caps'],
    'box-sizing':           ['border-box','content-box'],
    'pointer-events':       ['auto','none','visiblePainted','visibleFill','visibleStroke','visible','painted','fill','stroke','all'],
    'user-select':          ['none','auto','text','all','contain'],
    'resize':               ['none','both','horizontal','vertical'],
    'appearance':           ['none','auto','textfield','button','checkbox','radio','menulist'],
    'mix-blend-mode':       ['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion'],
    'isolation':            ['auto','isolate'],
    'backface-visibility':  ['visible','hidden'],
    'transform-style':      ['flat','preserve-3d'],
    'background-size':      ['auto','cover','contain'],
    'background-repeat':    ['repeat','no-repeat','repeat-x','repeat-y','space','round'],
    'background-attachment':['scroll','fixed','local'],
    'background-clip':      ['border-box','padding-box','content-box','text'],
    'background-origin':    ['border-box','padding-box','content-box'],
    'border-style':         ['none','solid','dashed','dotted','double','groove','ridge','inset','outset','hidden'],
    'border-collapse':      ['collapse','separate'],
    'table-layout':         ['auto','fixed'],
    'caption-side':         ['top','bottom'],
    'list-style-type':      ['none','disc','circle','square','decimal','decimal-leading-zero','lower-roman','upper-roman','lower-alpha','upper-alpha'],
    'list-style-position':  ['inside','outside'],
    'grid-auto-flow':       ['row','column','dense','row dense','column dense'],
    'animation-fill-mode':  ['none','forwards','backwards','both'],
    'animation-direction':  ['normal','reverse','alternate','alternate-reverse'],
    'animation-play-state': ['running','paused'],
    'animation-timing-function':  ['ease','linear','ease-in','ease-out','ease-in-out','step-start','step-end'],
    'transition-timing-function': ['ease','linear','ease-in','ease-out','ease-in-out'],
    'scroll-behavior':      ['auto','smooth'],
    'scroll-snap-type':     ['none','x mandatory','y mandatory','both mandatory','x proximity','y proximity'],
    'scroll-snap-align':    ['none','start','end','center'],
    'direction':            ['ltr','rtl'],
    'writing-mode':         ['horizontal-tb','vertical-rl','vertical-lr'],
    'will-change':          ['auto','scroll-position','contents','transform','opacity'],
    'filter':               ['none','blur(4px)','brightness(1.2)','contrast(1.2)','grayscale(1)','invert(1)','opacity(0.5)','saturate(2)','sepia(1)'],
    'backdrop-filter':      ['none','blur(4px)','brightness(0.8)','contrast(1.1)'],
    'content':              ['none','normal','""','open-quote','close-quote','no-open-quote','no-close-quote'],
    'quotes':               ['none','auto'],
  };

  // ── CSS Value provider (works in CSS, SCSS, LESS, and HTML style attributes) ─
  function _makeCssValueProvider(langIds) {
    return monaco.languages.registerCompletionItemProvider(langIds, {
      triggerCharacters: [':',' '],
      provideCompletionItems(model, position) {
        const lineText  = model.getLineContent(position.lineNumber);
        const textBefore = lineText.slice(0, position.column - 1);

        // Match "property: [partial-value]" — handles indented CSS and inline style
        const propMatch = textBefore.match(/(?:^|[{;])\s*([\w-]+)\s*:\s*([\w-]*)$/);
        if (!propMatch) return { suggestions: [] };

        const prop = propMatch[1];
        const values = CSS_VALUES[prop];
        if (!values || !values.length) return { suggestions: [] };

        const typed = propMatch[2];
        const word  = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn,
        };

        return {
          suggestions: values
            .filter(v => !typed || v.startsWith(typed))
            .map((v, i) => ({
              label: v,
              kind:  monaco.languages.CompletionItemKind.Value,
              detail: `${prop}: ${v}`,
              insertText: v,
              sortText: String(i).padStart(3, '0'),
              range,
            })),
        };
      },
    });
  }

  _makeCssValueProvider(['css', 'scss', 'less']);
  // Also provide in HTML style attributes (lang stays 'html' but context is style="")
  _makeCssValueProvider(['html']);

  // ── CSS Property completions ──────────────────────────────────────────────
  const _cssProps = [
    'align-content','align-items','align-self','all','animation','animation-delay',
    'animation-direction','animation-duration','animation-fill-mode',
    'animation-iteration-count','animation-name','animation-play-state',
    'animation-timing-function','appearance','aspect-ratio',
    'backdrop-filter','backface-visibility','background','background-attachment',
    'background-blend-mode','background-clip','background-color','background-image',
    'background-origin','background-position','background-repeat','background-size',
    'border','border-bottom','border-bottom-color','border-bottom-left-radius',
    'border-bottom-right-radius','border-bottom-style','border-bottom-width',
    'border-collapse','border-color','border-image','border-left','border-radius',
    'border-right','border-spacing','border-style','border-top','border-width',
    'bottom','box-shadow','box-sizing','break-after','break-before',
    'caption-side','caret-color','clear','clip-path','color','color-scheme',
    'column-count','column-gap','column-rule','column-span','column-width','columns',
    'contain','content','counter-increment','counter-reset','cursor',
    'direction','display','empty-cells','filter','flex','flex-basis','flex-direction',
    'flex-flow','flex-grow','flex-shrink','flex-wrap','float','font','font-family',
    'font-feature-settings','font-kerning','font-size','font-size-adjust',
    'font-stretch','font-style','font-variant','font-weight',
    'gap','grid','grid-area','grid-auto-columns','grid-auto-flow','grid-auto-rows',
    'grid-column','grid-column-end','grid-column-start','grid-row','grid-row-end',
    'grid-row-start','grid-template','grid-template-areas','grid-template-columns',
    'grid-template-rows',
    'height','hyphens','image-rendering','inset','isolation','justify-content',
    'justify-items','justify-self','left','letter-spacing','line-clamp','line-height',
    'list-style','list-style-image','list-style-position','list-style-type',
    'margin','margin-block','margin-bottom','margin-inline','margin-left',
    'margin-right','margin-top','mask','max-height','max-width','min-height',
    'min-width','mix-blend-mode','object-fit','object-position',
    'opacity','order','outline','outline-color','outline-offset','outline-style',
    'outline-width','overflow','overflow-x','overflow-y','overscroll-behavior',
    'padding','padding-block','padding-bottom','padding-inline','padding-left',
    'padding-right','padding-top','place-content','place-items','place-self',
    'pointer-events','position','quotes','resize','right','row-gap',
    'scroll-behavior','scroll-margin','scroll-padding','scroll-snap-align',
    'scroll-snap-type','scrollbar-color','scrollbar-width','shape-outside',
    'table-layout','text-align','text-decoration','text-decoration-color',
    'text-decoration-line','text-decoration-style','text-indent','text-overflow',
    'text-shadow','text-transform','top','transform','transform-origin',
    'transform-style','transition','transition-delay','transition-duration',
    'transition-property','transition-timing-function','unicode-bidi',
    'user-select','vertical-align','visibility','white-space','width',
    'will-change','word-break','word-spacing','word-wrap','writing-mode','z-index',
  ];

  monaco.languages.registerCompletionItemProvider(['css', 'scss', 'less'], {
    triggerCharacters: ['-'],
    provideCompletionItems(model, position) {
      const word  = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };
      return {
        suggestions: _cssProps.map(prop => ({
          label: prop,
          kind:  monaco.languages.CompletionItemKind.Property,
          detail: 'CSS property',
          insertText: prop + ': ${1};',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          sortText: 'p' + prop,
          range,
        })),
      };
    },
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  HTML ATTRIBUTE COMPLETIONS
  // ════════════════════════════════════════════════════════════════════════════
  const _htmlAttrs = {
    _global: [
      'id','class','style','title','tabindex','hidden','draggable','contenteditable',
      'spellcheck','lang','dir','accesskey','translate','data-*',
      // ARIA
      'role','aria-label','aria-labelledby','aria-describedby','aria-hidden',
      'aria-expanded','aria-controls','aria-selected','aria-checked','aria-disabled',
      'aria-live','aria-atomic','aria-relevant','aria-busy','aria-current',
      'aria-haspopup','aria-invalid','aria-multiline','aria-multiselectable',
      'aria-orientation','aria-owns','aria-pressed','aria-readonly','aria-required',
      'aria-valuemax','aria-valuemin','aria-valuenow','aria-valuetext',
      // Events
      'onclick','ondblclick','onmousedown','onmouseup','onmouseover','onmouseout',
      'onmousemove','onkeydown','onkeyup','onkeypress','onfocus','onblur',
      'onchange','oninput','onsubmit','onreset','onscroll','onresize',
      'onload','onunload','onerror','oncontextmenu','onwheel','ondragstart',
      'ondragend','ondragover','ondrop','ontouchstart','ontouchend','ontouchmove',
    ],
    a:        ['href','target','rel','download','type','hreflang','referrerpolicy'],
    img:      ['src','alt','width','height','loading','decoding','crossorigin','srcset','sizes'],
    input:    ['type','name','value','placeholder','required','disabled','readonly',
               'checked','min','max','step','pattern','autocomplete','autofocus',
               'multiple','accept','form','list','maxlength','minlength','size'],
    button:   ['type','disabled','form','formaction','formmethod','formnovalidate','name','value','autofocus'],
    form:     ['action','method','enctype','novalidate','target','autocomplete','name'],
    script:   ['src','type','async','defer','crossorigin','integrity','nonce','referrerpolicy'],
    link:     ['rel','href','type','media','crossorigin','integrity','as','referrerpolicy'],
    meta:     ['name','content','charset','http-equiv','property','viewport'],
    video:    ['src','autoplay','controls','loop','muted','poster','preload','width','height','playsinline'],
    audio:    ['src','autoplay','controls','loop','muted','preload'],
    iframe:   ['src','width','height','frameborder','allow','allowfullscreen','loading','sandbox','title'],
    select:   ['name','multiple','disabled','required','size','form','autocomplete'],
    textarea: ['name','rows','cols','placeholder','required','disabled','readonly','maxlength','minlength','wrap','form'],
    canvas:   ['width','height'],
    svg:      ['xmlns','viewBox','width','height','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','transform'],
    table:    ['border','cellspacing','cellpadding','summary','width'],
    td:       ['colspan','rowspan','headers','scope'],
    th:       ['colspan','rowspan','headers','scope','abbr'],
    label:    ['for','form'],
    details:  ['open'],
    dialog:   ['open'],
    ol:       ['start','type','reversed'],
    li:       ['value'],
    area:     ['href','target','alt','coords','shape'],
    base:     ['href','target'],
    track:    ['kind','src','srclang','label','default'],
    source:   ['src','type','srcset','media','sizes'],
    colgroup: ['span'],
    col:      ['span'],
    optgroup: ['label','disabled'],
    option:   ['value','disabled','selected','label'],
    output:   ['for','form','name'],
    progress: ['value','max'],
    meter:    ['value','min','max','low','high','optimum'],
    fieldset: ['disabled','form','name'],
    legend:   [],
    map:      ['name'],
    data:     ['value'],
    time:     ['datetime'],
    ins:      ['cite','datetime'],
    del:      ['cite','datetime'],
    blockquote:['cite'],
    q:        ['cite'],
    object:   ['data','type','width','height','name','form','usemap'],
  };

  monaco.languages.registerCompletionItemProvider('html', {
    triggerCharacters: [' ', '\t'],
    provideCompletionItems(model, position) {
      const word     = model.getWordUntilPosition(position);
      const lineText = model.getLineContent(position.lineNumber);
      const range    = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };

      // Detect current tag
      const tagMatch = lineText.slice(0, position.column).match(/<(\w+)[^>]*$/);
      const tag      = tagMatch ? tagMatch[1].toLowerCase() : null;
      const attrs    = [...(_htmlAttrs._global), ...(_htmlAttrs[tag] || [])];

      return {
        suggestions: attrs.map(attr => ({
          label: attr,
          kind:  attr.startsWith('on') || attr.startsWith('aria-')
                   ? monaco.languages.CompletionItemKind.Event
                   : monaco.languages.CompletionItemKind.Property,
          detail: attr.startsWith('aria-') ? 'ARIA attribute'
                : attr.startsWith('on')    ? 'DOM event handler'
                : `HTML attribute`,
          insertText: attr === 'data-*'
            ? 'data-${1:key}="${2:value}"'
            : attr.endsWith('*')
            ? attr.replace('*','${1:key}="${2:val}"')
            : (attr.startsWith('on') ? `${attr}="${1}"` : `${attr}="\${1}"`),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          sortText: attr.startsWith('aria') ? 'c' + attr : attr.startsWith('on') ? 'b' + attr : 'a' + attr,
          range,
        })),
      };
    },
  });

  // ── Attribute value completions ───────────────────────────────────────────
  const ATTR_VALUES = {
    type:    ['text','email','password','number','tel','url','date','time','datetime-local','month','week','color','file','range','checkbox','radio','submit','reset','button','hidden','search','image'],
    target:  ['_blank','_self','_parent','_top'],
    rel:     ['noopener','noreferrer','nofollow','stylesheet','icon','canonical','alternate','author','preload','prefetch','dns-prefetch','preconnect'],
    method:  ['get','post','put','delete','patch'],
    enctype: ['application/x-www-form-urlencoded','multipart/form-data','text/plain'],
    loading: ['lazy','eager','auto'],
    decoding:['async','sync','auto'],
    role:    ['alert','alertdialog','application','article','banner','button','cell',
              'checkbox','columnheader','combobox','complementary','contentinfo',
              'definition','dialog','directory','document','feed','figure','form',
              'grid','gridcell','group','heading','img','link','list','listbox',
              'listitem','log','main','marquee','math','menu','menubar','menuitem',
              'menuitemcheckbox','menuitemradio','navigation','none','note',
              'option','presentation','progressbar','radio','radiogroup','region',
              'row','rowgroup','rowheader','scrollbar','search','searchbox',
              'separator','slider','spinbutton','status','switch','tab','table',
              'tablist','tabpanel','term','textbox','timer','toolbar','tooltip',
              'tree','treegrid','treeitem'],
    autocomplete: ['on','off','name','email','username','current-password','new-password','one-time-code','street-address','postal-code','country','tel','url'],
    crossorigin:  ['anonymous','use-credentials'],
    preload:      ['none','metadata','auto'],
    referrerpolicy: ['no-referrer','no-referrer-when-downgrade','origin','origin-when-cross-origin','same-origin','strict-origin','strict-origin-when-cross-origin','unsafe-url'],
    sandbox: ['allow-scripts','allow-same-origin','allow-forms','allow-popups','allow-modals'],
  };

  monaco.languages.registerCompletionItemProvider('html', {
    triggerCharacters: ['"', "'"],
    provideCompletionItems(model, position) {
      const lineText  = model.getLineContent(position.lineNumber);
      const before    = lineText.slice(0, position.column - 1);
      const attrMatch = before.match(/\s([\w-]+)\s*=\s*["']([^"']*)$/);
      if (!attrMatch) return { suggestions: [] };

      const attrName = attrMatch[1].toLowerCase();
      const values   = ATTR_VALUES[attrName];
      if (!values) return { suggestions: [] };

      const typed = attrMatch[2];
      const word  = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };
      return {
        suggestions: values
          .filter(v => !typed || v.startsWith(typed))
          .map((v, i) => ({
            label: v,
            kind:  monaco.languages.CompletionItemKind.Value,
            detail: `${attrName}="${v}"`,
            insertText: v,
            sortText: String(i).padStart(3, '0'),
            range,
          })),
      };
    },
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  HTML HOVER DOCUMENTATION
  // ════════════════════════════════════════════════════════════════════════════
  const HTML_HOVER = {
    // Block elements
    div:        '**`<div>`** — Generic block-level container with no semantic meaning. Use it to group elements for styling or scripting.',
    span:       '**`<span>`** — Generic inline container with no semantic meaning. Used to style or script a portion of text.',
    p:          '**`<p>`** — Paragraph element. Represents a block of text separated from adjacent content by blank lines.',
    section:    '**`<section>`** — Thematic grouping of content, typically with a heading. Use for chapters, tabs, or distinct sections.',
    article:    '**`<article>`** — Self-contained, independently distributable content (blog post, news article, forum post).',
    aside:      '**`<aside>`** — Content tangentially related to the main content (sidebars, pull quotes, advertising).',
    header:     '**`<header>`** — Introductory content or navigational links for its nearest sectioning element.',
    footer:     '**`<footer>`** — Footer for its nearest sectioning ancestor (copyright, author info, related links).',
    main:       '**`<main>`** — The dominant content of the document body. Only one `<main>` per page.',
    nav:        '**`<nav>`** — A section with navigation links (menus, tables of contents, breadcrumbs).',
    figure:     '**`<figure>`** — Self-contained content referenced from the main flow, optionally with a `<figcaption>`.',
    figcaption: '**`<figcaption>`** — Caption or legend for the parent `<figure>` element.',
    details:    '**`<details>`** — A disclosure widget where content is visible only when open. Uses `<summary>` for the toggle.',
    summary:    '**`<summary>`** — Visible heading for a `<details>` element. Clicking toggles visibility of the details.',
    dialog:     '**`<dialog>`** — A dialog box or sub-window. Controlled via `open` attribute or `dialog.show()` / `dialog.showModal()`.',
    // Headings
    h1:         '**`<h1>`** — Top-level heading. Only one per page. Defines the most important heading.',
    h2:         '**`<h2>`** — Second-level heading. Used for major sections under `<h1>`.',
    h3:         '**`<h3>`** — Third-level heading.',
    h4:         '**`<h4>`** — Fourth-level heading.',
    h5:         '**`<h5>`** — Fifth-level heading.',
    h6:         '**`<h6>`** — Sixth-level (lowest) heading.',
    // Inline text
    a:          '**`<a>`** — Hyperlink anchor. The `href` attribute specifies the destination URL.\n\n**Key attrs:** `href`, `target`, `rel`, `download`',
    strong:     '**`<strong>`** — Strong importance, seriousness, or urgency. Rendered bold by default.',
    em:         '**`<em>`** — Stress emphasis. Rendered italic by default.',
    code:       '**`<code>`** — Inline code fragment. Use `<pre><code>` for blocks.',
    pre:        '**`<pre>`** — Preformatted text where whitespace is significant.',
    kbd:        '**`<kbd>`** — Keyboard input (keys the user should press).',
    samp:       '**`<samp>`** — Sample output from a computer program.',
    var:        '**`<var>`** — Mathematical or programming variable.',
    mark:       '**`<mark>`** — Text highlighted for reference or notation.',
    del:        '**`<del>`** — Text deleted from the document.',
    ins:        '**`<ins>`** — Text inserted into the document.',
    abbr:       '**`<abbr>`** — Abbreviation or acronym. Use `title` attribute to expand it.',
    cite:       '**`<cite>`** — Reference to a creative work (book, article, website).',
    q:          '**`<q>`** — Short inline quotation. Browsers add quotation marks.',
    blockquote: '**`<blockquote>`** — Extended quotation from another source. Use `cite` for the source URL.',
    time:       '**`<time>`** — Machine-readable date/time. Use `datetime` attribute for the value.',
    sub:        '**`<sub>`** — Subscript text (chemical formulas, footnotes).',
    sup:        '**`<sup>`** — Superscript text (exponents, ordinals).',
    small:      '**`<small>`** — Fine print, side comments, or legal text.',
    b:          '**`<b>`** — Bold text without semantic importance (use `<strong>` for importance).',
    i:          '**`<i>`** — Italic text — technical terms, foreign phrases, thoughts (use `<em>` for stress).',
    u:          '**`<u>`** — Underlined text. Avoid for hyperlinks; use for non-textual annotation.',
    s:          '**`<s>`** — Strikethrough for content no longer accurate or relevant.',
    // Forms
    form:       '**`<form>`** — Interactive controls for submitting data.\n\n**Key attrs:** `action`, `method`, `enctype`, `novalidate`',
    input:      '**`<input>`** — Interactive form control. Behavior changes with `type` attribute.\n\n**Common types:** `text`, `email`, `password`, `number`, `checkbox`, `radio`, `file`, `submit`',
    button:     '**`<button>`** — Clickable button. Types: `submit` (default), `reset`, `button`.',
    textarea:   '**`<textarea>`** — Multi-line plain text editing control.',
    select:     '**`<select>`** — Drop-down list. Contains `<option>` and `<optgroup>` elements.',
    option:     '**`<option>`** — Item within `<select>`, `<optgroup>`, or `<datalist>`.',
    optgroup:   '**`<optgroup>`** — Group of options within a `<select>` element.',
    label:      '**`<label>`** — Caption for a form control. Use `for` to associate with an input `id`.',
    fieldset:   '**`<fieldset>`** — Groups related form controls. Use `<legend>` for its caption.',
    legend:     '**`<legend>`** — Caption for its parent `<fieldset>`.',
    datalist:   '**`<datalist>`** — Predefined options for an `<input>`. Referenced via `input list` attribute.',
    output:     '**`<output>`** — Result of a calculation or user action.',
    progress:   '**`<progress>`** — Progress indicator for a task. Use `value` and `max` attributes.',
    meter:      '**`<meter>`** — Scalar measurement or fractional value (disk usage, relevance score).',
    // Lists
    ul:         '**`<ul>`** — Unordered list. Items have no particular order.',
    ol:         '**`<ol>`** — Ordered (numbered) list. Use `start` and `type` attributes.',
    li:         '**`<li>`** — List item inside `<ul>`, `<ol>`, or `<menu>`.',
    dl:         '**`<dl>`** — Description list. Contains `<dt>` (term) and `<dd>` (description) pairs.',
    dt:         '**`<dt>`** — Term in a description list.',
    dd:         '**`<dd>`** — Description or value in a description list.',
    // Tables
    table:      '**`<table>`** — Tabular data. Contains `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<th>`, `<td>`.',
    thead:      '**`<thead>`** — Header rows of a table.',
    tbody:      '**`<tbody>`** — Body rows of a table.',
    tfoot:      '**`<tfoot>`** — Footer rows of a table.',
    tr:         '**`<tr>`** — Table row. Contains `<td>` or `<th>` elements.',
    td:         '**`<td>`** — Table data cell. Use `colspan` and `rowspan` to span cells.',
    th:         '**`<th>`** — Table header cell. Use `scope` to associate with rows or columns.',
    caption:    '**`<caption>`** — Title or caption for a table. Must be the first child of `<table>`.',
    colgroup:   '**`<colgroup>`** — Group of columns for bulk styling via `<col>`.',
    col:        '**`<col>`** — Specifies column properties within a `<colgroup>`.',
    // Media
    img:        '**`<img>`** — Embeds an image.\n\n**Key attrs:** `src` (required), `alt` (required for accessibility), `width`, `height`, `loading="lazy"`',
    video:      '**`<video>`** — Embeds a video. Contains `<source>` elements for multiple formats.',
    audio:      '**`<audio>`** — Embeds audio. Contains `<source>` elements for multiple formats.',
    source:     '**`<source>`** — Alternative media source for `<video>`, `<audio>`, or `<picture>`.',
    picture:    '**`<picture>`** — Container for `<source>` elements and one `<img>` for responsive images.',
    track:      '**`<track>`** — Timed text tracks (subtitles, captions) for `<video>` and `<audio>`.',
    canvas:     '**`<canvas>`** — Bitmap drawing surface for JavaScript Canvas API graphics.',
    // Structural
    html:       '**`<html>`** — Root element of the HTML document. Use `lang` attribute for accessibility.',
    head:       '**`<head>`** — Machine-readable document metadata (title, scripts, styles, meta tags).',
    body:       '**`<body>`** — Visible content of the document.',
    title:      '**`<title>`** — Document title shown in browser tab/title bar and search results.',
    meta:       '**`<meta>`** — Metadata. Common uses: charset, viewport, description, og: tags.',
    link:       '**`<link>`** — External resource link. Typically used for CSS stylesheets and icons.',
    style:      '**`<style>`** — Embedded CSS styles. Prefer external stylesheets for maintainability.',
    script:     '**`<script>`** — Embeds or links JavaScript. Use `defer` or `async` for performance.',
    noscript:   '**`<noscript>`** — Fallback content when JavaScript is disabled.',
    template:   '**`<template>`** — Client-side template — rendered but not displayed. Cloned with JS.',
    slot:       '**`<slot>`** — Placeholder inside a Web Component for projected content.',
    // Interactive
    iframe:     '**`<iframe>`** — Nested browsing context (embeds another HTML page).\n\n**Key attrs:** `src`, `sandbox`, `allow`, `loading="lazy"`',
    embed:      '**`<embed>`** — External content (Flash was common, now rare).',
    object:     '**`<object>`** — External resource as image, nested browsing context, or plugin.',
    // SVG
    svg:        '**`<svg>`** — Scalable Vector Graphics container.\n\n**Key attrs:** `xmlns`, `viewBox`, `width`, `height`',
    path:       '**`<path>`** — SVG path. `d` attribute uses path commands (M, L, C, Z, etc.).',
    circle:     '**`<circle>`** — SVG circle. `cx`, `cy`, `r` for center and radius.',
    rect:       '**`<rect>`** — SVG rectangle. `x`, `y`, `width`, `height`, `rx` for rounded corners.',
    line:       '**`<line>`** — SVG line from `(x1,y1)` to `(x2,y2)`.',
    polyline:   '**`<polyline>`** — SVG open shape with `points` attribute.',
    polygon:    '**`<polygon>`** — SVG closed shape with `points` attribute.',
    text:       '**`<text>`** — SVG text element.',
    g:          '**`<g>`** — SVG group element. Applies transforms and styles to all children.',
    defs:       '**`<defs>`** — SVG definitions (gradients, filters, clip paths) not rendered directly.',
    use:        '**`<use>`** — Reuses an SVG element by `href` reference.',
    // Break & HR
    br:         '**`<br>`** — Line break. Avoid using for spacing — use CSS margin instead.',
    hr:         '**`<hr>`** — Thematic break (paragraph-level change of topic).',
    wbr:        '**`<wbr>`** — Word break opportunity — hints where text may wrap.',
  };

  const ATTR_HOVER = {
    href:        '**`href`** — Hyperlink Reference. URL of the linked page or resource.',
    src:         '**`src`** — Source URL for embedded content (image, script, audio, video, iframe).',
    alt:         '**`alt`** — Alternative text description for images. Required for accessibility.',
    class:       '**`class`** — CSS class name(s) separated by spaces.',
    id:          '**`id`** — Unique identifier for the element. Must be unique per page.',
    style:       '**`style`** — Inline CSS styles. Prefer class-based styling for maintainability.',
    type:        '**`type`** — Content type or control type. Context-dependent (input, button, script, link).',
    name:        '**`name`** — Name of the form control (used in form data submission).',
    value:       '**`value`** — Initial value of a form control.',
    placeholder: '**`placeholder`** — Short hint text shown in an empty input field.',
    required:    '**`required`** — Boolean. Field must be filled before form submission.',
    disabled:    '**`disabled`** — Boolean. Makes the control non-interactive.',
    readonly:    '**`readonly`** — Boolean. Value cannot be modified by the user.',
    checked:     '**`checked`** — Boolean. Pre-selects a checkbox or radio button.',
    target:      '**`target`** — Browsing context for link navigation. `_blank` opens in a new tab.',
    rel:         '**`rel`** — Relationship between current document and linked resource.',
    action:      '**`action`** — URL where form data is submitted.',
    method:      '**`method`** — HTTP method: `get` (data in URL) or `post` (data in request body).',
    enctype:     '**`enctype`** — Encoding type for form data. Use `multipart/form-data` for file uploads.',
    novalidate:  '**`novalidate`** — Boolean. Skips browser-native form validation.',
    for:         '**`for`** — Associates a `<label>` with a form control by its `id`.',
    loading:     '**`loading`** — Loading strategy. `lazy` defers off-screen images for performance.',
    decoding:    '**`decoding`** — Image decoding hint: `async` (non-blocking), `sync`, `auto`.',
    width:       '**`width`** — Width of the element in pixels (or percentage for tables).',
    height:      '**`height`** — Height of the element in pixels.',
    colspan:     '**`colspan`** — Number of columns a table cell should span.',
    rowspan:     '**`rowspan`** — Number of rows a table cell should span.',
    scope:       '**`scope`** — Associates `<th>` with `col`, `colgroup`, `row`, or `rowgroup`.',
    defer:       '**`defer`** — Boolean. Script executes after document parsing (no render blocking).',
    async:       '**`async`** — Boolean. Script downloads and executes asynchronously.',
    crossorigin: '**`crossorigin`** — CORS policy for cross-origin requests.',
    integrity:   '**`integrity`** — Subresource Integrity (SRI) hash for security verification.',
    sandbox:     '**`sandbox`** — Restricts iframe capabilities. Empty value = all restrictions.',
    allow:       '**`allow`** — Feature policy for iframes (camera, microphone, fullscreen, etc.).',
    role:        '**`role`** — ARIA role — overrides semantic element role for accessibility.',
    tabindex:    '**`tabindex`** — Focusability order. `0` = natural order, `-1` = focusable via JS only.',
    'aria-label':       '**`aria-label`** — Accessible name when visible label is absent.',
    'aria-labelledby':  '**`aria-labelledby`** — References another element\'s text as accessible name.',
    'aria-describedby': '**`aria-describedby`** — References element providing extended description.',
    'aria-hidden':      '**`aria-hidden`** — Hides element from assistive technology (`true`/`false`).',
    'aria-expanded':    '**`aria-expanded`** — Whether a collapsible element is expanded (`true`/`false`).',
    'aria-controls':    '**`aria-controls`** — IDs of elements controlled by this element.',
    'aria-live':        '**`aria-live`** — Screen reader update policy: `off`, `polite`, `assertive`.',
    viewBox:     '**`viewBox`** — SVG coordinate system: `min-x min-y width height`. Enables scaling.',
    'xmlns':     '**`xmlns`** — XML namespace. For SVG: `http://www.w3.org/2000/svg`.',
    'd':         '**`d`** — SVG path data. Uses commands: `M`(move), `L`(line), `C`(curve), `Z`(close).',
    'fill':      '**`fill`** — SVG fill color. `currentColor` inherits CSS `color`.',
    'stroke':    '**`stroke`** — SVG stroke (border) color.',
  };

  monaco.languages.registerHoverProvider('html', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const w   = word.word.toLowerCase();
      const line = model.getLineContent(position.lineNumber);

      // Check if word is inside a tag name position (<tag or </tag)
      const beforeWord = line.slice(0, word.startColumn - 1);
      const isTagCtx   = /<\/?$/.test(beforeWord) || /<[^>]*$/.test(beforeWord);

      const doc = HTML_HOVER[w] || (isTagCtx ? null : ATTR_HOVER[word.word]) || ATTR_HOVER[w];
      if (!doc) return null;

      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [{ value: doc }],
      };
    },
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  TAILWIND CSS — COMPLETIONS + HOVER DOCS
  // ════════════════════════════════════════════════════════════════════════════
  const _tw = {
    // Layout
    container:'max-width matches the current breakpoint min-width',
    block:'display: block', 'inline-block':'display: inline-block',
    inline:'display: inline', flex:'display: flex',
    'inline-flex':'display: inline-flex', grid:'display: grid',
    'inline-grid':'display: inline-grid', hidden:'display: none',
    // Position
    static:'position: static', fixed:'position: fixed',
    absolute:'position: absolute', relative:'position: relative',
    sticky:'position: sticky',
    // Flexbox direction
    'flex-row':'flex-direction: row', 'flex-col':'flex-direction: column',
    'flex-row-reverse':'flex-direction: row-reverse',
    'flex-col-reverse':'flex-direction: column-reverse',
    // Flex wrap
    'flex-wrap':'flex-wrap: wrap', 'flex-nowrap':'flex-wrap: nowrap',
    'flex-wrap-reverse':'flex-wrap: wrap-reverse',
    // Flex sizing
    'flex-1':'flex: 1 1 0%', 'flex-auto':'flex: 1 1 auto',
    'flex-initial':'flex: 0 1 auto', 'flex-none':'flex: none',
    grow:'flex-grow: 1', 'grow-0':'flex-grow: 0',
    shrink:'flex-shrink: 1', 'shrink-0':'flex-shrink: 0',
    // Justify
    'justify-start':'justify-content: flex-start',
    'justify-end':'justify-content: flex-end',
    'justify-center':'justify-content: center',
    'justify-between':'justify-content: space-between',
    'justify-around':'justify-content: space-around',
    'justify-evenly':'justify-content: space-evenly',
    // Align items
    'items-start':'align-items: flex-start',
    'items-end':'align-items: flex-end',
    'items-center':'align-items: center',
    'items-baseline':'align-items: baseline',
    'items-stretch':'align-items: stretch',
    // Self align
    'self-start':'align-self: flex-start',
    'self-end':'align-self: flex-end',
    'self-center':'align-self: center',
    'self-stretch':'align-self: stretch',
    // Overflow
    'overflow-hidden':'overflow: hidden', 'overflow-auto':'overflow: auto',
    'overflow-scroll':'overflow: scroll', 'overflow-visible':'overflow: visible',
    'overflow-x-hidden':'overflow-x: hidden', 'overflow-y-auto':'overflow-y: auto',
    // Text size
    'text-xs':'font-size: 0.75rem; line-height: 1rem',
    'text-sm':'font-size: 0.875rem; line-height: 1.25rem',
    'text-base':'font-size: 1rem; line-height: 1.5rem',
    'text-lg':'font-size: 1.125rem; line-height: 1.75rem',
    'text-xl':'font-size: 1.25rem; line-height: 1.75rem',
    'text-2xl':'font-size: 1.5rem; line-height: 2rem',
    'text-3xl':'font-size: 1.875rem; line-height: 2.25rem',
    'text-4xl':'font-size: 2.25rem; line-height: 2.5rem',
    'text-5xl':'font-size: 3rem; line-height: 1',
    // Text align
    'text-left':'text-align: left', 'text-center':'text-align: center',
    'text-right':'text-align: right', 'text-justify':'text-align: justify',
    // Font weight
    'font-thin':'font-weight: 100', 'font-light':'font-weight: 300',
    'font-normal':'font-weight: 400', 'font-medium':'font-weight: 500',
    'font-semibold':'font-weight: 600', 'font-bold':'font-weight: 700',
    'font-extrabold':'font-weight: 800', 'font-black':'font-weight: 900',
    // Text decoration
    underline:'text-decoration-line: underline',
    'line-through':'text-decoration-line: line-through',
    'no-underline':'text-decoration-line: none',
    // Transform
    uppercase:'text-transform: uppercase',
    lowercase:'text-transform: lowercase',
    capitalize:'text-transform: capitalize',
    'normal-case':'text-transform: none',
    // Truncate
    truncate:'overflow: hidden; text-overflow: ellipsis; white-space: nowrap',
    // Width
    'w-full':'width: 100%', 'w-screen':'width: 100vw',
    'w-auto':'width: auto', 'w-fit':'width: fit-content',
    // Height
    'h-full':'height: 100%', 'h-screen':'height: 100vh',
    'h-auto':'height: auto',
    // Max width
    'max-w-sm':'max-width: 24rem', 'max-w-md':'max-width: 28rem',
    'max-w-lg':'max-width: 32rem', 'max-w-xl':'max-width: 36rem',
    'max-w-2xl':'max-width: 42rem', 'max-w-full':'max-width: 100%',
    // Border radius
    'rounded-none':'border-radius: 0', 'rounded-sm':'border-radius: 0.125rem',
    rounded:'border-radius: 0.25rem', 'rounded-md':'border-radius: 0.375rem',
    'rounded-lg':'border-radius: 0.5rem', 'rounded-xl':'border-radius: 0.75rem',
    'rounded-2xl':'border-radius: 1rem', 'rounded-full':'border-radius: 9999px',
    // Shadow
    'shadow-sm':'box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)',
    shadow:'box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    'shadow-md':'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    'shadow-lg':'box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    'shadow-xl':'box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    'shadow-2xl':'box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)',
    'shadow-inner':'box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    'shadow-none':'box-shadow: 0 0 #0000',
    // Opacity
    'opacity-0':'opacity: 0', 'opacity-25':'opacity: 0.25',
    'opacity-50':'opacity: 0.5', 'opacity-75':'opacity: 0.75',
    'opacity-100':'opacity: 1',
    // Transition
    transition:'transition-property: color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter; transition-duration: 150ms',
    'transition-all':'transition-property: all; transition-duration: 150ms',
    'transition-colors':'transition-property: color,background-color,border-color; transition-duration: 150ms',
    'transition-opacity':'transition-property: opacity; transition-duration: 150ms',
    'transition-transform':'transition-property: transform; transition-duration: 150ms',
    // Duration
    'duration-75':'transition-duration: 75ms', 'duration-100':'transition-duration: 100ms',
    'duration-150':'transition-duration: 150ms', 'duration-200':'transition-duration: 200ms',
    'duration-300':'transition-duration: 300ms', 'duration-500':'transition-duration: 500ms',
    // Cursor
    'cursor-pointer':'cursor: pointer', 'cursor-default':'cursor: default',
    'cursor-not-allowed':'cursor: not-allowed', 'cursor-wait':'cursor: wait',
    'cursor-text':'cursor: text', 'cursor-move':'cursor: move',
    // Select
    'select-none':'user-select: none', 'select-text':'user-select: text',
    'select-all':'user-select: all',
    // Pointer events
    'pointer-events-none':'pointer-events: none',
    // Z-index
    'z-0':'z-index: 0', 'z-10':'z-index: 10', 'z-20':'z-index: 20',
    'z-30':'z-index: 30', 'z-40':'z-index: 40', 'z-50':'z-index: 50',
    'z-auto':'z-index: auto',
    // Border
    'border-solid':'border-style: solid', 'border-dashed':'border-style: dashed',
    'border-dotted':'border-style: dotted', 'border-none':'border-style: none',
    // Object fit
    'object-cover':'object-fit: cover', 'object-contain':'object-fit: contain',
    'object-fill':'object-fit: fill', 'object-none':'object-fit: none',
    // Visibility
    visible:'visibility: visible', invisible:'visibility: hidden',
    // Box sizing
    'box-border':'box-sizing: border-box', 'box-content':'box-sizing: content-box',
    // Grid
    'grid-cols-1':'grid-template-columns: repeat(1, minmax(0, 1fr))',
    'grid-cols-2':'grid-template-columns: repeat(2, minmax(0, 1fr))',
    'grid-cols-3':'grid-template-columns: repeat(3, minmax(0, 1fr))',
    'grid-cols-4':'grid-template-columns: repeat(4, minmax(0, 1fr))',
    'grid-cols-6':'grid-template-columns: repeat(6, minmax(0, 1fr))',
    'grid-cols-12':'grid-template-columns: repeat(12, minmax(0, 1fr))',
    // Whitespace
    'whitespace-nowrap':'white-space: nowrap',
    'whitespace-pre':'white-space: pre',
    'whitespace-normal':'white-space: normal',
  };

  // All Tailwind class names (for completion)
  const _twClasses = [
    ...Object.keys(_tw),
    // Spacing (generated patterns covered by hover map above)
    'p-0','p-1','p-2','p-3','p-4','p-5','p-6','p-8','p-10','p-12','p-16',
    'px-0','px-1','px-2','px-4','px-6','px-8','py-0','py-1','py-2','py-4','py-6','py-8',
    'pt-0','pt-2','pt-4','pt-8','pb-0','pb-2','pb-4','pb-8',
    'pl-0','pl-2','pl-4','pr-0','pr-2','pr-4',
    'm-0','m-1','m-2','m-4','m-6','m-8','m-auto','mx-auto','my-auto',
    'mt-0','mt-2','mt-4','mt-8','mb-0','mb-2','mb-4','mb-8',
    'ml-0','ml-4','mr-0','mr-4',
    // Width
    'w-0','w-1','w-2','w-4','w-8','w-16','w-32','w-64','w-1/2','w-1/3','w-2/3','w-3/4',
    // Height
    'h-0','h-1','h-2','h-4','h-8','h-16','h-32','h-64',
    'min-h-screen','min-h-0','max-h-screen',
    // Gap
    'gap-0','gap-1','gap-2','gap-4','gap-6','gap-8','gap-x-4','gap-y-4',
    // Border
    'border','border-0','border-2','border-4','border-8',
    'border-t','border-b','border-l','border-r',
    'border-white','border-black','border-gray-200','border-gray-300',
    // Colors (text)
    'text-white','text-black','text-transparent','text-current',
    'text-gray-100','text-gray-200','text-gray-300','text-gray-400',
    'text-gray-500','text-gray-600','text-gray-700','text-gray-800','text-gray-900',
    'text-red-500','text-red-600','text-blue-500','text-blue-600',
    'text-green-500','text-green-600','text-yellow-400','text-yellow-500',
    'text-purple-500','text-pink-500','text-indigo-500','text-indigo-600',
    // Colors (bg)
    'bg-transparent','bg-white','bg-black',
    'bg-gray-50','bg-gray-100','bg-gray-200','bg-gray-800','bg-gray-900',
    'bg-blue-500','bg-blue-600','bg-red-500','bg-green-500',
    'bg-yellow-400','bg-purple-500','bg-pink-500','bg-indigo-600',
    // Line height
    'leading-none','leading-tight','leading-snug','leading-normal','leading-relaxed','leading-loose',
    // Letter spacing
    'tracking-tight','tracking-normal','tracking-wide','tracking-wider','tracking-widest',
    // Scale / rotate
    'scale-0','scale-50','scale-75','scale-90','scale-95','scale-100','scale-105','scale-110',
    'rotate-0','rotate-45','rotate-90','rotate-180',
    // Hover / focus variants
    'hover:opacity-80','hover:scale-105','hover:shadow-lg',
    'focus:outline-none','focus:ring','focus:ring-2','focus:ring-blue-500',
    'active:scale-95',
    // Responsive prefixes (for display)
    'sm:hidden','md:block','lg:flex','xl:grid',
  ];

  const _twLangs = ['html','javascriptreact','typescriptreact','javascript','typescript'];

  // Completions
  _twLangs.forEach(lang => {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['"', "'", ' ', '-'],
      provideCompletionItems(model, position) {
        const lineText   = model.getLineContent(position.lineNumber);
        const charBefore = lineText.slice(0, position.column - 1);

        const inClass = /class(?:Name)?\s*=\s*["'][^"']*$/.test(charBefore) ||
                        /class(?:Name)?\s*=\s*\{`[^`]*$/.test(charBefore);
        if (!inClass && lang !== 'html') return { suggestions: [] };

        const word  = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn,
        };
        return {
          suggestions: _twClasses.map(cls => ({
            label: cls,
            kind:  monaco.languages.CompletionItemKind.Value,
            detail: _tw[cls] ? `Tailwind → ${_tw[cls]}` : 'Tailwind CSS',
            documentation: _tw[cls] ? { value: `\`\`\`css\n${_tw[cls]}\n\`\`\`` } : undefined,
            insertText: cls,
            filterText: cls,
            sortText: 't' + cls,
            range,
          })),
        };
      },
    });
  });

  // Tailwind hover provider
  _twLangs.forEach(lang => {
    monaco.languages.registerHoverProvider(lang, {
      provideHover(model, position) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        // Check if word is inside a class attribute
        const line   = model.getLineContent(position.lineNumber);
        const before = line.slice(0, word.startColumn - 1);
        const after  = line.slice(word.endColumn - 1);
        const inClass = /class(?:Name)?\s*=\s*["'][^"']*$/.test(before) && /[^"']*["']/.test(after);
        if (!inClass && lang !== 'html') return null;

        // Try exact match, then with hyphen prefix for partial
        let key = word.word;
        // Also check for classes like "hover:opacity-80" where word is just "opacity"
        const fullClass = before.match(/([\w:-]+)$/)
          ? before.match(/([\w:-]+)$/)[1] + word.word
          : word.word;

        const css = _tw[fullClass] || _tw[key];
        if (!css) return null;

        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [{ value: `**Tailwind: \`${fullClass}\`**\n\`\`\`css\n${css}\n\`\`\`` }],
        };
      },
    });
  });

  // ── SVG element completions ───────────────────────────────────────────────
  const _svgSnippets = [
    { label:'path',     insertText:'<path d="${1:M0 0}" fill="${2:currentColor}"/>',                                                                     detail:'SVG path' },
    { label:'circle',   insertText:'<circle cx="${1:50}" cy="${2:50}" r="${3:40}" fill="${4:currentColor}"/>',                                           detail:'SVG circle' },
    { label:'rect',     insertText:'<rect x="${1:0}" y="${2:0}" width="${3:100}" height="${4:100}" rx="${5:4}" fill="${6:currentColor}"/>',               detail:'SVG rect' },
    { label:'text',     insertText:'<text x="${1:50}" y="${2:50}" text-anchor="middle">${3:Text}</text>',                                               detail:'SVG text' },
    { label:'line',     insertText:'<line x1="${1:0}" y1="${2:0}" x2="${3:100}" y2="${4:100}" stroke="${5:currentColor}" stroke-width="${6:2}"/>',        detail:'SVG line' },
    { label:'polyline', insertText:'<polyline points="${1:0,0 50,50 100,0}" fill="none" stroke="${2:currentColor}"/>',                                   detail:'SVG polyline' },
    { label:'polygon',  insertText:'<polygon points="${1:0,50 50,0 100,50}" fill="${2:currentColor}"/>',                                                 detail:'SVG polygon' },
    { label:'g',        insertText:'<g transform="${1:translate(0,0)}">\n\t${2}\n</g>',                                                                  detail:'SVG group' },
    { label:'defs',     insertText:'<defs>\n\t<linearGradient id="${1:grad}">\n\t\t<stop offset="0%" stop-color="${2:#000}"/>\n\t\t<stop offset="100%" stop-color="${3:#fff}"/>\n\t</linearGradient>\n</defs>', detail:'SVG defs + gradient' },
    { label:'animate',  insertText:'<animate attributeName="${1:opacity}" from="${2:0}" to="${3:1}" dur="${4:1s}" repeatCount="${5:indefinite}"/>',       detail:'SVG animation' },
    { label:'clipPath', insertText:'<clipPath id="${1:clip}">\n\t<rect width="${2:100}" height="${3:100}"/>\n</clipPath>',                               detail:'SVG clip path' },
    { label:'mask',     insertText:'<mask id="${1:mask}">\n\t${2}\n</mask>',                                                                             detail:'SVG mask' },
    { label:'filter',   insertText:'<filter id="${1:blur}">\n\t<feGaussianBlur stdDeviation="${2:4}"/>\n</filter>',                                     detail:'SVG filter' },
    { label:'use',      insertText:'<use href="#${1:id}" x="${2:0}" y="${3:0}"/>',                                                                        detail:'SVG use' },
  ];

  monaco.languages.registerCompletionItemProvider('html', {
    provideCompletionItems(model, position) {
      // Only show inside <svg context
      let inSvg = false;
      for (let i = position.lineNumber; i >= Math.max(1, position.lineNumber - 30); i--) {
        const l = model.getLineContent(i);
        if (/<svg\b/.test(l)) { inSvg = true; break; }
        if (/<\/svg>/.test(l)) break;
      }
      if (!inSvg) return { suggestions: [] };

      const word  = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };
      return {
        suggestions: _svgSnippets.map(s => ({
          label: s.label, kind: monaco.languages.CompletionItemKind.Snippet,
          detail: `SVG — ${s.detail}`, insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          sortText: 's' + s.label, range,
        })),
      };
    },
  });
}
