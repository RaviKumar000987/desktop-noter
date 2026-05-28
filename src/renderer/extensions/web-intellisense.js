/**
 * Web IntelliSense  — Phase 4 Extension
 * Extended HTML attributes, Tailwind CSS classes, CSS custom props, SVG, Emmet-style.
 */
"use strict";

window._exts = window._exts || {};
window._exts['web-intellisense'] = {
  id:   'web-intellisense',
  name: 'Web IntelliSense',
  icon: '🌐',
  desc: 'HTML attributes, Tailwind CSS, CSS properties, SVG patterns',
  version: '1.0.0',
  category: 'IntelliSense',

  activate(ctx) {
    document.addEventListener('monaco-ready', () => _register(ctx));
  },
};

function _register(ctx) {
  if (typeof monaco === 'undefined') return;

  // ── CSS Properties list ────────────────────────────────────────────────
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
    'bottom','box-shadow','box-sizing','break-after','break-before','break-inside',
    'caption-side','caret-color','clear','clip-path','color','color-scheme',
    'column-count','column-fill','column-gap','column-rule','column-span','column-width',
    'columns','contain','content','counter-increment','counter-reset','cursor',
    'direction','display','empty-cells','filter','flex','flex-basis','flex-direction',
    'flex-flow','flex-grow','flex-shrink','flex-wrap','float','font','font-display',
    'font-face','font-family','font-feature-settings','font-kerning','font-size',
    'font-size-adjust','font-stretch','font-style','font-variant','font-weight',
    'gap','grid','grid-area','grid-auto-columns','grid-auto-flow','grid-auto-rows',
    'grid-column','grid-column-end','grid-column-gap','grid-column-start','grid-gap',
    'grid-row','grid-row-end','grid-row-gap','grid-row-start','grid-template',
    'grid-template-areas','grid-template-columns','grid-template-rows',
    'height','hyphens','image-rendering','inset','isolation','justify-content',
    'justify-items','justify-self','left','letter-spacing','line-clamp','line-height',
    'list-style','list-style-image','list-style-position','list-style-type','margin',
    'margin-block','margin-block-end','margin-block-start','margin-bottom',
    'margin-inline','margin-left','margin-right','margin-top','mask','max-height',
    'max-width','min-height','min-width','mix-blend-mode','object-fit','object-position',
    'offset','opacity','order','outline','outline-color','outline-offset','outline-style',
    'outline-width','overflow','overflow-x','overflow-y','overscroll-behavior',
    'padding','padding-block','padding-bottom','padding-inline','padding-left',
    'padding-right','padding-top','place-content','place-items','place-self',
    'pointer-events','position','quotes','resize','right','row-gap','scroll-behavior',
    'scroll-margin','scroll-padding','scroll-snap-align','scroll-snap-stop',
    'scroll-snap-type','scrollbar-color','scrollbar-width','shape-outside',
    'table-layout','text-align','text-align-last','text-decoration',
    'text-decoration-color','text-decoration-line','text-decoration-style',
    'text-indent','text-justify','text-overflow','text-shadow','text-transform',
    'top','transform','transform-origin','transform-style','transition',
    'transition-delay','transition-duration','transition-property',
    'transition-timing-function','unicode-bidi','user-select','vertical-align',
    'visibility','white-space','width','will-change','word-break','word-spacing',
    'word-wrap','writing-mode','z-index',
  ];

  // ── Tailwind CSS class groups ─────────────────────────────────────────────
  const _tailwindClasses = [
    // Layout
    'container','block','inline-block','inline','flex','inline-flex','grid','inline-grid',
    'hidden','visible','invisible','static','fixed','absolute','relative','sticky',
    // Flexbox
    'flex-row','flex-col','flex-row-reverse','flex-col-reverse','flex-wrap','flex-nowrap',
    'flex-1','flex-auto','flex-initial','flex-none','grow','grow-0','shrink','shrink-0',
    'justify-start','justify-end','justify-center','justify-between','justify-around','justify-evenly',
    'items-start','items-end','items-center','items-baseline','items-stretch',
    'self-start','self-end','self-center','self-stretch',
    // Grid
    'grid-cols-1','grid-cols-2','grid-cols-3','grid-cols-4','grid-cols-5','grid-cols-6',
    'grid-cols-12','col-span-1','col-span-2','col-span-3','col-span-full',
    'gap-0','gap-1','gap-2','gap-4','gap-6','gap-8','gap-x-4','gap-y-4',
    // Spacing (padding/margin)
    'p-0','p-1','p-2','p-3','p-4','p-5','p-6','p-8','p-10','p-12','p-16',
    'px-0','px-1','px-2','px-4','px-6','px-8','py-0','py-1','py-2','py-4','py-6','py-8',
    'pt-0','pt-4','pt-8','pb-0','pb-4','pb-8','pl-0','pl-4','pr-0','pr-4',
    'm-0','m-1','m-2','m-4','m-6','m-8','m-auto','mx-auto','my-auto',
    'mt-0','mt-2','mt-4','mt-8','mb-0','mb-2','mb-4','mb-8','ml-0','ml-4','mr-0','mr-4',
    // Sizing
    'w-0','w-1','w-2','w-4','w-8','w-16','w-32','w-64','w-full','w-screen','w-auto','w-fit',
    'h-0','h-1','h-2','h-4','h-8','h-16','h-32','h-64','h-full','h-screen','h-auto',
    'min-w-0','min-w-full','max-w-sm','max-w-md','max-w-lg','max-w-xl','max-w-2xl',
    'max-w-full','max-w-screen-lg','min-h-screen','max-h-screen',
    // Typography
    'text-xs','text-sm','text-base','text-lg','text-xl','text-2xl','text-3xl','text-4xl',
    'text-5xl','text-6xl','font-thin','font-light','font-normal','font-medium',
    'font-semibold','font-bold','font-extrabold','font-black',
    'italic','not-italic','underline','line-through','no-underline','uppercase',
    'lowercase','capitalize','normal-case','truncate','text-ellipsis','whitespace-nowrap',
    'text-left','text-center','text-right','text-justify',
    'text-white','text-black','text-gray-100','text-gray-200','text-gray-400',
    'text-gray-500','text-gray-600','text-gray-700','text-gray-800','text-gray-900',
    'text-blue-500','text-blue-600','text-red-500','text-green-500','text-yellow-500',
    'text-purple-500','text-pink-500','text-indigo-500',
    'leading-none','leading-tight','leading-snug','leading-normal','leading-relaxed','leading-loose',
    'tracking-tight','tracking-normal','tracking-wide','tracking-wider','tracking-widest',
    // Backgrounds
    'bg-transparent','bg-white','bg-black','bg-gray-50','bg-gray-100','bg-gray-200',
    'bg-gray-800','bg-gray-900','bg-blue-500','bg-blue-600','bg-red-500','bg-green-500',
    'bg-yellow-400','bg-purple-500','bg-pink-500','bg-indigo-600',
    // Borders
    'border','border-0','border-2','border-4','border-8','border-t','border-b','border-l','border-r',
    'border-solid','border-dashed','border-dotted','border-none','rounded','rounded-sm',
    'rounded-md','rounded-lg','rounded-xl','rounded-2xl','rounded-full','rounded-none',
    // Shadows
    'shadow','shadow-sm','shadow-md','shadow-lg','shadow-xl','shadow-2xl','shadow-inner','shadow-none',
    // Effects
    'opacity-0','opacity-25','opacity-50','opacity-75','opacity-100',
    'transition','transition-all','transition-colors','transition-opacity','transition-transform',
    'duration-75','duration-100','duration-150','duration-200','duration-300','duration-500',
    'ease-in','ease-out','ease-in-out','ease-linear',
    'scale-0','scale-50','scale-75','scale-90','scale-95','scale-100','scale-105','scale-110',
    'rotate-0','rotate-45','rotate-90','rotate-180',
    'translate-x-0','translate-x-4','-translate-x-4','translate-y-0','translate-y-4',
    'hover:opacity-80','hover:scale-105','hover:shadow-lg','focus:outline-none',
    'focus:ring','focus:ring-2','focus:ring-blue-500',
    // Interactivity
    'cursor-default','cursor-pointer','cursor-wait','cursor-text','cursor-not-allowed',
    'select-none','select-text','select-all','pointer-events-none',
    // Overflow
    'overflow-hidden','overflow-auto','overflow-scroll','overflow-visible','overflow-x-hidden','overflow-y-auto',
    // Z-index
    'z-0','z-10','z-20','z-30','z-40','z-50','z-auto',
  ];

  // ── Tailwind provider for HTML/JSX/TSX ────────────────────────────────────
  const _twLangs = ['html', 'javascriptreact', 'typescriptreact', 'javascript', 'typescript'];
  _twLangs.forEach(lang => {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['"', "'", ' ', '-'],
      provideCompletionItems(model, position) {
        const lineText  = model.getLineContent(position.lineNumber);
        const charBefore = lineText.substring(0, position.column - 1);
        // Only trigger inside className="" or class=""
        const inClass = /class(?:Name)?\s*=\s*["'][^"']*$/.test(charBefore) ||
                        /class(?:Name)?\s*=\s*\{`[^`]*$/.test(charBefore);
        if (!inClass && lang !== 'html') return { suggestions: [] };

        const word  = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn,
        };
        return {
          suggestions: _tailwindClasses.map(cls => ({
            label: cls,
            kind:  monaco.languages.CompletionItemKind.Value,
            detail: 'Tailwind CSS',
            insertText: cls,
            filterText: cls,
            sortText: 't' + cls,
            range,
          })),
        };
      },
    });
  });

  // ── CSS property value completions ────────────────────────────────────────
  monaco.languages.registerCompletionItemProvider(['css', 'scss', 'less'], {
    triggerCharacters: [':'],
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

  // ── HTML attribute completions ────────────────────────────────────────────
  const _htmlAttrs = {
    global: ['id', 'class', 'style', 'title', 'tabindex', 'hidden', 'draggable',
             'contenteditable', 'spellcheck', 'lang', 'dir', 'accesskey',
             'data-*', 'aria-label', 'aria-hidden', 'aria-expanded', 'aria-controls',
             'aria-describedby', 'role'],
    a:      ['href', 'target', 'rel', 'download', 'type'],
    img:    ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'crossorigin'],
    input:  ['type', 'name', 'value', 'placeholder', 'required', 'disabled', 'readonly',
             'checked', 'min', 'max', 'step', 'pattern', 'autocomplete', 'autofocus',
             'multiple', 'accept', 'form', 'list'],
    button: ['type', 'disabled', 'form', 'formaction', 'formmethod', 'name', 'value'],
    form:   ['action', 'method', 'enctype', 'novalidate', 'target', 'autocomplete'],
    script: ['src', 'type', 'async', 'defer', 'module', 'crossorigin', 'integrity'],
    link:   ['rel', 'href', 'type', 'media', 'crossorigin', 'integrity'],
    meta:   ['name', 'content', 'charset', 'http-equiv', 'property'],
    video:  ['src', 'autoplay', 'controls', 'loop', 'muted', 'poster', 'preload', 'width', 'height'],
    audio:  ['src', 'autoplay', 'controls', 'loop', 'muted', 'preload'],
    iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'loading', 'sandbox'],
    select: ['name', 'multiple', 'disabled', 'required', 'size', 'form'],
    textarea:['name', 'rows', 'cols', 'placeholder', 'required', 'disabled', 'readonly', 'maxlength'],
    canvas: ['width', 'height'],
    svg:    ['xmlns', 'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width',
             'stroke-linecap', 'stroke-linejoin', 'opacity', 'transform'],
  };

  monaco.languages.registerCompletionItemProvider('html', {
    triggerCharacters: [' ', '\t'],
    provideCompletionItems(model, position) {
      const word    = model.getWordUntilPosition(position);
      const lineText = model.getLineContent(position.lineNumber);
      const range   = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };
      // Detect current tag
      const tagMatch = lineText.match(/<(\w+)/);
      const tag      = tagMatch ? tagMatch[1].toLowerCase() : null;
      const attrs    = [...(_htmlAttrs.global), ...(_htmlAttrs[tag] || [])];

      return {
        suggestions: attrs.map(attr => ({
          label: attr,
          kind:  monaco.languages.CompletionItemKind.Property,
          detail: `HTML attribute`,
          insertText: attr.endsWith('*') ? attr.replace('*', '${1:key}="${2:val}"')
                                         : attr + '="${1}"',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          sortText: 'h' + attr,
          range,
        })),
      };
    },
  });

  // ── SVG element + attribute completions ──────────────────────────────────
  const _svgSnippets = [
    { label: 'path', insertText: '<path d="${1:M0 0}" fill="${2:currentColor}"/>', detail: 'SVG path' },
    { label: 'circle', insertText: '<circle cx="${1:50}" cy="${2:50}" r="${3:40}" fill="${4:currentColor}"/>', detail: 'SVG circle' },
    { label: 'rect', insertText: '<rect x="${1:0}" y="${2:0}" width="${3:100}" height="${4:100}" rx="${5:4}" fill="${6:currentColor}"/>', detail: 'SVG rect' },
    { label: 'text', insertText: '<text x="${1:50}" y="${2:50}" text-anchor="middle">${3:Text}</text>', detail: 'SVG text' },
    { label: 'line', insertText: '<line x1="${1:0}" y1="${2:0}" x2="${3:100}" y2="${4:100}" stroke="${5:currentColor}" stroke-width="${6:2}"/>', detail: 'SVG line' },
    { label: 'polyline', insertText: '<polyline points="${1:0,0 50,50 100,0}" fill="none" stroke="${2:currentColor}"/>', detail: 'SVG polyline' },
    { label: 'g', insertText: '<g transform="${1:translate(0,0)}">\n\t${2}\n</g>', detail: 'SVG group' },
    { label: 'defs', insertText: '<defs>\n\t<linearGradient id="${1:grad}">\n\t\t<stop offset="0%" stop-color="${2:#000}"/>\n\t\t<stop offset="100%" stop-color="${3:#fff}"/>\n\t</linearGradient>\n</defs>', detail: 'SVG defs' },
    { label: 'animate', insertText: '<animate attributeName="${1:opacity}" from="${2:0}" to="${3:1}" dur="${4:1s}" repeatCount="${5:indefinite}"/>', detail: 'SVG animation' },
  ];

  monaco.languages.registerCompletionItemProvider('html', {
    provideCompletionItems(model, position) {
      const lineText = model.getLineContent(position.lineNumber);
      if (!/<svg/.test(lineText.substring(0, position.column))) {
        // Check surrounding context for SVG
        let inSvg = false;
        const totalLines = Math.min(position.lineNumber, 20);
        for (let i = position.lineNumber; i >= Math.max(1, position.lineNumber - 20); i--) {
          const l = model.getLineContent(i);
          if (/<svg/.test(l)) { inSvg = true; break; }
          if (/<\/svg>/.test(l)) break;
        }
        if (!inSvg) return { suggestions: [] };
      }
      const word  = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };
      return {
        suggestions: _svgSnippets.map(s => ({
          label: s.label,
          kind:  monaco.languages.CompletionItemKind.Snippet,
          detail: s.detail,
          insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          sortText: 's' + s.label,
          range,
        })),
      };
    },
  });
}
