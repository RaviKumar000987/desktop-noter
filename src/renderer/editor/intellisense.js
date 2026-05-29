/**
 * NOTER INTELLISENSE ENGINE  — Phase 4
 * Core: snippet bank, workspace indexer, Monaco completion/hover providers.
 * Initialises after "monaco-ready" event; works for 20+ languages.
 */
"use strict";

const IntelliSense = (() => {

  // ── Workspace symbol registry ────────────────────────────────────────────
  const _registry = new Map();   // filePath -> { symbols[], words[], lang }
  let   _wsRoot   = null;
  let   _reindexT = null;

  // ── Indexer Web Worker (off-thread symbol extraction) ────────────────────
  let   _worker        = null;
  let   _workerSeq     = 0;
  const _workerPending = new Map(); // id -> resolve

  function _getWorker() {
    if (_worker) return _worker;
    try {
      const url = new URL("../../workers/indexer.worker.js", window.location.href).href;
      _worker = new Worker(url);
      _worker.onmessage = ({ data: { id, results } }) => {
        const resolve = _workerPending.get(id);
        if (!resolve) return;
        _workerPending.delete(id);
        resolve(results);
      };
      _worker.onerror = () => { _worker = null; }; // reset so next call retries
    } catch {
      _worker = null;
    }
    return _worker;
  }

  // Send a batch of {path, content, lang} objects to the worker for extraction
  function _extractViaWorker(batch) {
    return new Promise((resolve) => {
      const worker = _getWorker();
      if (!worker) {
        // Fallback: extract in main thread
        const results = {};
        for (const { path: fp, content, lang } of batch) {
          if (content) results[fp] = _extractSymbols(content, lang);
        }
        resolve(results);
        return;
      }
      const id = ++_workerSeq;
      _workerPending.set(id, resolve);
      worker.postMessage({ id, files: batch });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const _langFromExt = {
    js:'javascript', mjs:'javascript', cjs:'javascript',
    ts:'typescript', jsx:'javascriptreact', tsx:'typescriptreact',
    py:'python', rb:'ruby', php:'php',
    java:'java', kt:'kotlin', scala:'scala',
    c:'c', h:'c', cpp:'cpp', cc:'cpp', cxx:'cpp', hpp:'cpp',
    cs:'csharp', go:'go', rs:'rust', swift:'swift',
    sh:'shell', bash:'shell', zsh:'shell',
    html:'html', htm:'html', xml:'xml',
    css:'css', scss:'scss', less:'less',
    json:'json', yaml:'yaml', yml:'yaml', toml:'plaintext',
    md:'markdown',
  };

  function _extLang(filePath) {
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    return _langFromExt[ext] || 'plaintext';
  }

  // ── Symbol extractors (regex-based, fast) ────────────────────────────────
  const _EXTRACTORS = {
    javascript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|class\s+(\w+)|export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+))/g,
    typescript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+)\s*=|enum\s+(\w+))/g,
    python:     /(?:def\s+(\w+)|class\s+(\w+)|^(\w+)\s*=(?!=))/gm,
    java:       /(?:class\s+(\w+)|interface\s+(\w+)|enum\s+(\w+)|(?:public|private|protected|static)\s+\w[\w<>[\]]*\s+(\w+)\s*[=(])/g,
    go:         /(?:func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)|type\s+(\w+)\s+(?:struct|interface)|var\s+(\w+))/g,
    rust:       /(?:fn\s+(\w+)|struct\s+(\w+)|enum\s+(\w+)|trait\s+(\w+)|impl\s+(\w+)|const\s+(\w+)|let\s+(?:mut\s+)?(\w+))/g,
  };

  function _extractSymbols(content, lang) {
    const symbols = new Set();
    const words   = new Set();

    // Words (3+ alpha chars) for cross-file word-based completion
    (content.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]{2,}\b/g) || []).forEach(w => words.add(w));

    const baseKey = lang === 'javascriptreact' ? 'javascript'
                  : lang === 'typescriptreact' ? 'typescript'
                  : lang;
    const re = _EXTRACTORS[baseKey];
    if (re) {
      const rex = new RegExp(re.source, re.flags);
      let m;
      while ((m = rex.exec(content)) !== null) {
        for (let i = 1; i < m.length; i++) { if (m[i]) symbols.add(m[i]); }
      }
    }
    return { symbols: [...symbols], words: [...words] };
  }

  // ── Index one file (used for single-file re-index on save/change) ────────
  async function _indexFile(fp) {
    if (!window.electronAPI?.readFileContent) return;
    const lang    = _extLang(fp);
    const content = await window.electronAPI.readFileContent(fp);
    if (!content) return;
    const results = await _extractViaWorker([{ path: fp, content, lang }]);
    if (results[fp]) _registry.set(fp, { ...results[fp], lang });
    else _registry.set(fp, _extractSymbols(content, lang));
  }

  // ── Index entire workspace (batched; heavy CPU work runs in a Web Worker) ─
  async function _indexWorkspace(root) {
    if (!root || !window.electronAPI?.listWorkspaceFiles) return;
    _wsRoot = root;
    const files = (await window.electronAPI.listWorkspaceFiles(root)).slice(0, 500);

    for (let i = 0; i < files.length; i += 25) {
      const batch = files.slice(i, i + 25);

      // Read file content in parallel via IPC (I/O stays on main process)
      const withContent = await Promise.all(batch.map(async (fp) => {
        const lang    = _extLang(fp);
        const content = await window.electronAPI.readFileContent(fp).catch(() => null);
        return { path: fp, content: content || "", lang };
      }));

      // Offload symbol extraction to Web Worker (keeps UI thread free)
      const results = await _extractViaWorker(withContent);
      for (const [fp, data] of Object.entries(results)) {
        _registry.set(fp, { ...data, lang: _extLang(fp) });
      }

      // Yield to renderer between batches
      await new Promise(r => setTimeout(r, 8));
    }
  }

  // ── Build workspace completions for a given file ──────────────────────────
  function _wsCompletions(currentFile, range) {
    const out = [];
    _registry.forEach(({ symbols, words }, fp) => {
      if (fp === currentFile) return;
      const short = fp.split(/[/\\]/).pop();
      symbols.forEach(s => out.push({
        label: s,
        kind:  monaco.languages.CompletionItemKind.Reference,
        detail: `↗ ${short}`,
        sortText: 'w' + s,
        range,
      }));
      words.forEach(w => out.push({
        label: w,
        kind:  monaco.languages.CompletionItemKind.Text,
        detail: `word · ${short}`,
        sortText: 'ww' + w,
        range,
      }));
    });
    return out;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SNIPPET BANK
  // ════════════════════════════════════════════════════════════════════════
  const _S = {}; // language → snippet[]

  function _sn(label, detail, insertText, doc) {
    return { label, detail, insertText, documentation: doc || detail };
  }

  // ── JavaScript / JSX ────────────────────────────────────────────────────
  _S.javascript = [
    // Functions
    _sn('fn',      'function decl',       'function ${1:name}(${2:params}) {\n\t${3:// body}\n}'),
    _sn('afn',     'arrow function',      'const ${1:name} = (${2:params}) => {\n\t${3:// body}\n};'),
    _sn('afne',    'arrow expr',          '(${1:params}) => ${2:expr}'),
    _sn('asyncfn', 'async function',      'async function ${1:name}(${2:params}) {\n\t${3:// body}\n}'),
    _sn('asyncaf', 'async arrow',         'const ${1:name} = async (${2:params}) => {\n\t${3:// body}\n};'),
    _sn('iife',    'IIFE',                '(async () => {\n\t${1:// body}\n})();'),
    // Classes
    _sn('class',   'class decl',          'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t${3}\n\t}\n\n\t${4:method}() {\n\t\t${5}\n\t}\n}'),
    _sn('ext',     'class extends',       'class ${1:Child} extends ${2:Parent} {\n\tconstructor(${3:params}) {\n\t\tsuper(${4:args});\n\t\t${5}\n\t}\n}'),
    // Error handling
    _sn('try',     'try-catch',           'try {\n\t${1:// code}\n} catch (${2:err}) {\n\tconsole.error(${2:err});\n}'),
    _sn('tryf',    'try-catch-finally',   'try {\n\t${1}\n} catch (${2:err}) {\n\t${3}\n} finally {\n\t${4}\n}'),
    _sn('promise', 'new Promise',         'new Promise((resolve, reject) => {\n\t${1}\n\tresolve(${2:value});\n})'),
    _sn('aw',      'await expr',          'const ${1:res} = await ${2:promise};'),
    // Console
    _sn('cl',   'console.log',            'console.log(${1:value});'),
    _sn('ce',   'console.error',          'console.error(${1:err});'),
    _sn('cw',   'console.warn',           'console.warn(${1:msg});'),
    _sn('ct',   'console.table',          'console.table(${1:data});'),
    _sn('cd',   'console.dir',            'console.dir(${1:obj}, { depth: null });'),
    _sn('ctm',  'console.time',           'console.time(\'${1:label}\');\n${2:// code}\nconsole.timeEnd(\'${1:label}\');'),
    // Array
    _sn('map',       '.map()',            '${1:arr}.map((${2:item}) => ${3:item})'),
    _sn('filter',    '.filter()',         '${1:arr}.filter((${2:item}) => ${3:cond})'),
    _sn('reduce',    '.reduce()',         '${1:arr}.reduce((${2:acc}, ${3:cur}) => {\n\t${4:return acc + cur;}\n}, ${5:0})'),
    _sn('forEach',   '.forEach()',        '${1:arr}.forEach((${2:item}, ${3:i}) => {\n\t${4}\n});'),
    _sn('find',      '.find()',           '${1:arr}.find((${2:item}) => ${3:cond})'),
    _sn('some',      '.some()',           '${1:arr}.some((${2:item}) => ${3:cond})'),
    _sn('every',     '.every()',          '${1:arr}.every((${2:item}) => ${3:cond})'),
    _sn('flat',      '.flatMap()',        '${1:arr}.flatMap((${2:item}) => ${3:item})'),
    _sn('spread',    'spread array',      '[...${1:arr}]'),
    _sn('spreado',   'spread obj',        '{ ...${1:obj} }'),
    // Destructuring
    _sn('do',    'obj destruct',          'const { ${1:prop} } = ${2:obj};'),
    _sn('da',    'arr destruct',          'const [${1:first}, ${2:rest}] = ${3:arr};'),
    // Imports
    _sn('imp',   'ES6 import',            'import ${1:mod} from \'${2:path}\';'),
    _sn('impn',  'named import',          'import { ${1:name} } from \'${2:mod}\';'),
    _sn('req',   'require',              'const ${1:name} = require(\'${2:mod}\');'),
    _sn('mexp',  'module.exports',       'module.exports = ${1:value};'),
    _sn('expd',  'export default',       'export default ${1:value};'),
    _sn('expn',  'export named',         'export const ${1:name} = ${2:value};'),
    // Loops
    _sn('forof', 'for…of',              'for (const ${1:item} of ${2:iter}) {\n\t${3}\n}'),
    _sn('forin', 'for…in',              'for (const ${1:key} in ${2:obj}) {\n\t${3}\n}'),
    _sn('fori',  'for i loop',           'for (let ${1:i} = 0; ${1:i} < ${2:len}; ${1:i}++) {\n\t${3}\n}'),
    _sn('wh',    'while',                'while (${1:cond}) {\n\t${2}\n}'),
    // Misc
    _sn('ter',   'ternary',              '${1:cond} ? ${2:a} : ${3:b}'),
    _sn('nc',    'nullish coalesce',     '${1:val} ?? ${2:default}'),
    _sn('oc',    'optional chain',       '${1:obj}?.${2:prop}'),
    _sn('sw',    'switch',               'switch (${1:val}) {\n\tcase ${2:a}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\t${4}\n}'),
    _sn('sto',   'setTimeout',           'setTimeout(() => {\n\t${1}\n}, ${2:1000});'),
    _sn('sti',   'setInterval',          'setInterval(() => {\n\t${1}\n}, ${2:1000});'),
    _sn('ev',    'addEventListener',     '${1:el}.addEventListener(\'${2:click}\', (${3:e}) => {\n\t${4}\n});'),
    _sn('qs',    'querySelector',        'document.querySelector(\'${1:selector}\')'),
    _sn('qsa',   'querySelectorAll',     'document.querySelectorAll(\'${1:selector}\')'),
    _sn('ge',    'getElementById',       'document.getElementById(\'${1:id}\')'),
    _sn('fetch', 'fetch API',            'const ${1:res} = await fetch(\'${2:url}\');\nconst ${3:data} = await ${1:res}.json();'),
  ];

  // ── TypeScript extras ────────────────────────────────────────────────────
  _S.typescript = [
    ..._S.javascript,
    _sn('iface',     'interface',         'interface ${1:Name} {\n\t${2:prop}: ${3:string};\n}'),
    _sn('type',      'type alias',        'type ${1:Name} = ${2:type};'),
    _sn('enum',      'enum',              'enum ${1:Name} {\n\t${2:A},\n\t${3:B},\n}'),
    _sn('gen',       'generic fn',        'function ${1:fn}<${2:T}>(${3:arg}: ${2:T}): ${4:T} {\n\t${5:return arg;}\n}'),
    _sn('guard',     'type guard',        'function is${1:T}(v: unknown): v is ${1:T} {\n\treturn ${2:Boolean(v)};\n}'),
    _sn('partial',   'Partial<T>',        'Partial<${1:Type}>'),
    _sn('required',  'Required<T>',       'Required<${1:Type}>'),
    _sn('readonly',  'Readonly<T>',       'Readonly<${1:Type}>'),
    _sn('record',    'Record<K,V>',       'Record<${1:string}, ${2:unknown}>'),
    _sn('pick',      'Pick<T,K>',         'Pick<${1:Type}, \'${2:key}\'>'),
    _sn('omit',      'Omit<T,K>',         'Omit<${1:Type}, \'${2:key}\'>'),
    _sn('nonnull',   'NonNullable<T>',    'NonNullable<${1:Type}>'),
    _sn('rettype',   'ReturnType<T>',     'ReturnType<typeof ${1:fn}>'),
    _sn('async',     'async typed fn',    'async function ${1:fn}(${2:params}): Promise<${3:void}> {\n\t${4}\n}'),
  ];

  // ── React (JSX/TSX) ──────────────────────────────────────────────────────
  const _reactSnippets = [
    _sn('rfc',  'React FC',         'import React from \'react\';\n\nconst ${1:Component} = () => {\n\treturn (\n\t\t<div>\n\t\t\t${2}\n\t\t</div>\n\t);\n};\n\nexport default ${1:Component};'),
    _sn('rfcp', 'React FC + props', 'import React from \'react\';\n\ninterface ${1:Component}Props {\n\t${2:children}: React.ReactNode;\n}\n\nconst ${1:Component} = ({ ${2:children} }: ${1:Component}Props) => {\n\treturn (\n\t\t<div>\n\t\t\t{${2:children}}\n\t\t</div>\n\t);\n};\n\nexport default ${1:Component};'),
    _sn('rcc',  'React class comp', 'import React, { Component } from \'react\';\n\nclass ${1:Name} extends Component {\n\trender() {\n\t\treturn (\n\t\t\t<div>\n\t\t\t\t${2}\n\t\t\t</div>\n\t\t);\n\t}\n}\n\nexport default ${1:Name};'),
    _sn('ust',  'useState',         'const [${1:state}, set${2:State}] = useState(${3:null});'),
    _sn('uef',  'useEffect',        'useEffect(() => {\n\t${1}\n\treturn () => { ${2} };\n}, [${3}]);'),
    _sn('uef0', 'useEffect []',     'useEffect(() => {\n\t${1}\n}, []);'),
    _sn('urf',  'useRef',           'const ${1:ref} = useRef(${2:null});'),
    _sn('ucb',  'useCallback',      'const ${1:fn} = useCallback((${2:params}) => {\n\t${3}\n}, [${4}]);'),
    _sn('um',   'useMemo',          'const ${1:val} = useMemo(() => {\n\treturn ${2};\n}, [${3}]);'),
    _sn('uctx', 'useContext',       'const ${1:val} = useContext(${2:Context});'),
    _sn('urd',  'useReducer',       'const [${1:state}, dispatch] = useReducer(${2:reducer}, ${3:init});'),
    _sn('ctx',  'createContext',    'const ${1:Ctx} = createContext(${2:undefined});'),
    _sn('frag', 'Fragment',         '<>\n\t${1}\n</>'),
    _sn('prv',  'Provider',         '<${1:Ctx}.Provider value={${2:val}}>\n\t${3}\n</${1:Ctx}.Provider>'),
    _sn('ssp',  'getServerSideProps', 'export async function getServerSideProps(ctx) {\n\treturn { props: { ${1} } };\n}'),
    _sn('gsp',  'getStaticProps',   'export async function getStaticProps() {\n\treturn { props: { ${1} } };\n}'),
  ];

  _S.javascriptreact  = [..._S.javascript,  ..._reactSnippets];
  _S.typescriptreact  = [..._S.typescript,  ..._reactSnippets];

  // ── Python ───────────────────────────────────────────────────────────────
  _S.python = [
    _sn('def',    'function def',        'def ${1:name}(${2:params}):\n\t${3:pass}'),
    _sn('adef',   'async def',           'async def ${1:name}(${2:params}):\n\t${3:pass}'),
    _sn('cls',    'class',               'class ${1:Name}:\n\tdef __init__(self${2:, params}):\n\t\t${3:pass}'),
    _sn('clsi',   'class + inherit',     'class ${1:Name}(${2:Base}):\n\tdef __init__(self${3:, params}):\n\t\tsuper().__init__(${4:args})\n\t\t${5:pass}'),
    _sn('pr',     'print',               'print(${1:value})'),
    _sn('prf',    'print f-string',      'print(f"${1:msg}: {${2:val}}")'),
    _sn('ifm',    '__main__',            'if __name__ == "__main__":\n\t${1:main()}'),
    _sn('try',    'try-except',          'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}'),
    _sn('tryf',   'try-except-finally',  'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}\nfinally:\n\t${5:pass}'),
    _sn('lc',     'list comp',           '[${1:x} for ${2:x} in ${3:iter}]'),
    _sn('dc',     'dict comp',           '{${1:k}: ${2:v} for ${3:k}, ${4:v} in ${5:d}.items()}'),
    _sn('sc',     'set comp',            '{${1:x} for ${2:x} in ${3:iter}}'),
    _sn('lcif',   'list comp cond',      '[${1:x} for ${2:x} in ${3:iter} if ${4:cond}]'),
    _sn('for',    'for loop',            'for ${1:item} in ${2:iter}:\n\t${3:pass}'),
    _sn('fori',   'for range',           'for ${1:i} in range(${2:n}):\n\t${3:pass}'),
    _sn('fore',   'for enumerate',       'for ${1:i}, ${2:v} in enumerate(${3:iter}):\n\t${4:pass}'),
    _sn('forz',   'for zip',             'for ${1:a}, ${2:b} in zip(${3:xs}, ${4:ys}):\n\t${5:pass}'),
    _sn('wh',     'while',               'while ${1:cond}:\n\t${2:pass}'),
    _sn('wo',     'with open',           'with open("${1:file}", "${2:r}") as ${3:f}:\n\t${4:data = f.read()}'),
    _sn('fstr',   'f-string',            'f"${1:text} {${2:var}}"'),
    _sn('lam',    'lambda',              'lambda ${1:x}: ${2:x}'),
    _sn('prop',   '@property',           '@property\ndef ${1:name}(self):\n\treturn self._${1:name}'),
    _sn('proset', '@prop.setter',        '@${1:name}.setter\ndef ${1:name}(self, value):\n\tself._${1:name} = value'),
    _sn('sm',     '@staticmethod',       '@staticmethod\ndef ${1:name}(${2:params}):\n\t${3:pass}'),
    _sn('cm',     '@classmethod',        '@classmethod\ndef ${1:name}(cls${2:, params}):\n\t${3:pass}'),
    _sn('gen',    'generator',           'def ${1:gen}(${2:params}):\n\t${3:yield} ${4:val}'),
    _sn('dc8',    'dataclass',           'from dataclasses import dataclass\n\n@dataclass\nclass ${1:Name}:\n\t${2:field}: ${3:str}'),
    _sn('ab',     'abstract class',      'from abc import ABC, abstractmethod\n\nclass ${1:Name}(ABC):\n\t@abstractmethod\n\tdef ${2:method}(self):\n\t\tpass'),
    _sn('imp',    'import',              'import ${1:module}'),
    _sn('fr',     'from import',         'from ${1:module} import ${2:name}'),
    _sn('asy',    'asyncio main',        'import asyncio\n\nasync def main():\n\t${1:pass}\n\nasyncio.run(main())'),
  ];

  // ── HTML ─────────────────────────────────────────────────────────────────
  _S.html = [
    _sn('html5',   'HTML5 boilerplate',    '<!DOCTYPE html>\n<html lang="${1:en}">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${2:Title}</title>\n\t<link rel="stylesheet" href="${3:style.css}">\n</head>\n<body>\n\t${4}\n\t<script src="${5:app.js}"></script>\n</body>\n</html>'),
    _sn('div',     '<div>',                '<div class="${1:container}">\n\t${2}\n</div>'),
    _sn('span',    '<span>',               '<span class="${1:cls}">${2:text}</span>'),
    _sn('a',       '<a>',                  '<a href="${1:#}" ${2:target="_blank"}>${3:text}</a>'),
    _sn('img',     '<img>',                '<img src="${1:path}" alt="${2:desc}" class="${3:img}">'),
    _sn('input',   '<input>',              '<input type="${1:text}" id="${2:id}" name="${3:name}" placeholder="${4:…}">'),
    _sn('btn',     '<button>',             '<button type="${1:button}" class="${2:btn}" id="${3:id}">${4:Click}</button>'),
    _sn('form',    '<form>',               '<form action="${1:#}" method="${2:post}">\n\t${3}\n\t<button type="submit">Submit</button>\n</form>'),
    _sn('sel',     '<select>',             '<select id="${1:id}" name="${2:name}">\n\t<option value="${3:val}">${4:Label}</option>\n</select>'),
    _sn('tx',      '<textarea>',           '<textarea id="${1:id}" name="${2:name}" rows="${3:4}">${4}</textarea>'),
    _sn('ul',      '<ul>',                 '<ul class="${1:list}">\n\t<li>${2:item}</li>\n</ul>'),
    _sn('ol',      '<ol>',                 '<ol class="${1:list}">\n\t<li>${2:item}</li>\n</ol>'),
    _sn('tbl',     '<table>',              '<table>\n\t<thead>\n\t\t<tr><th>${1:Header}</th></tr>\n\t</thead>\n\t<tbody>\n\t\t<tr><td>${2:Data}</td></tr>\n\t</tbody>\n</table>'),
    _sn('hdr',     '<header>',             '<header class="${1:header}">\n\t${2}\n</header>'),
    _sn('main',    '<main>',               '<main class="${1:main}">\n\t${2}\n</main>'),
    _sn('sec',     '<section>',            '<section id="${1:id}">\n\t<h2>${2:Title}</h2>\n\t${3}\n</section>'),
    _sn('art',     '<article>',            '<article>\n\t${1}\n</article>'),
    _sn('ftr',     '<footer>',             '<footer class="${1:footer}">\n\t${2}\n</footer>'),
    _sn('nav',     '<nav>',                '<nav>\n\t<ul>\n\t\t<li><a href="${1:#}">${2:Home}</a></li>\n\t</ul>\n</nav>'),
    _sn('meta',    '<meta>',               '<meta name="${1:name}" content="${2:value}">'),
    _sn('link',    '<link>',               '<link rel="${1:stylesheet}" href="${2:path}">'),
    _sn('scrip',   '<script>',             '<script src="${1:path}" defer></script>'),
    _sn('og',      'Open Graph',           '<meta property="og:title" content="${1:title}">\n<meta property="og:description" content="${2:desc}">\n<meta property="og:image" content="${3:img}">'),
    _sn('twc',     'Twitter Card',         '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${1:title}">'),
    _sn('canvas',  '<canvas>',             '<canvas id="${1:canvas}" width="${2:800}" height="${3:600}"></canvas>'),
    _sn('vid',     '<video>',              '<video src="${1:path}" controls width="${2:640}">\n\tYour browser does not support video.\n</video>'),
    _sn('audio',   '<audio>',              '<audio src="${1:path}" controls></audio>'),
    _sn('svg',     '<svg>',                '<svg xmlns="http://www.w3.org/2000/svg" width="${1:24}" height="${2:24}" viewBox="0 0 ${1:24} ${2:24}">\n\t${3}\n</svg>'),
    _sn('details', '<details>',            '<details>\n\t<summary>${1:Summary}</summary>\n\t${2}\n</details>'),
    _sn('dialog',  '<dialog>',             '<dialog id="${1:dlg}">\n\t${2}\n\t<button onclick="this.closest(\'dialog\').close()">Close</button>\n</dialog>'),
  ];

  // ── CSS / SCSS ────────────────────────────────────────────────────────────
  _S.css = [
    _sn('flex',     'flexbox',              'display: flex;\nalign-items: ${1:center};\njustify-content: ${2:center};'),
    _sn('flexcol',  'flex column',          'display: flex;\nflex-direction: column;\nalign-items: ${1:stretch};'),
    _sn('grid',     'CSS grid',             'display: grid;\ngrid-template-columns: ${1:repeat(3, 1fr)};\ngap: ${2:1rem};'),
    _sn('gridarea', 'grid-template-areas',  'display: grid;\ngrid-template-areas:\n\t"${1:header header}"\n\t"${2:sidebar main}"\n\t"${3:footer footer}";'),
    _sn('abs',      'absolute',             'position: absolute;\ntop: ${1:0};\nleft: ${2:0};'),
    _sn('fixed',    'fixed',                'position: fixed;\ntop: ${1:0};\nleft: ${2:0};\nz-index: ${3:100};'),
    _sn('sticky',   'sticky',               'position: sticky;\ntop: ${1:0};\nz-index: ${2:10};'),
    _sn('mq',       '@media mobile',        '@media (max-width: ${1:768px}) {\n\t${2:/* responsive */}\n}'),
    _sn('mqmin',    '@media desktop',       '@media (min-width: ${1:1024px}) {\n\t${2:/* large screen */}\n}'),
    _sn('mqd',      '@media dark',          '@media (prefers-color-scheme: dark) {\n\t${1}\n}'),
    _sn('tran',     'transition',           'transition: ${1:all} ${2:0.3s} ${3:ease};'),
    _sn('anim',     'animation',            'animation: ${1:name} ${2:0.5s} ${3:ease} ${4:forwards};'),
    _sn('kf',       '@keyframes',           '@keyframes ${1:slide} {\n\t0%   { ${2:opacity: 0;} }\n\t100% { ${3:opacity: 1;} }\n}'),
    _sn('var',      'CSS var()',             'var(--${1:color})'),
    _sn('root',     ':root vars',           ':root {\n\t--${1:primary}: ${2:#3b82f6};\n\t--${3:bg}: ${4:#ffffff};\n}'),
    _sn('shadow',   'box-shadow',           'box-shadow: ${1:0} ${2:4px} ${3:16px} ${4:rgba(0,0,0,0.15)};'),
    _sn('grad',     'gradient',             'background: linear-gradient(${1:135deg}, ${2:#667eea}, ${3:#764ba2});'),
    _sn('ellip',    'text ellipsis',        'overflow: hidden;\ntext-overflow: ellipsis;\nwhite-space: nowrap;'),
    _sn('clamp',    'clamp()',              'font-size: clamp(${1:1rem}, ${2:2.5vw}, ${3:2rem});'),
    _sn('aspect',   'aspect-ratio',         'aspect-ratio: ${1:16} / ${2:9};'),
    _sn('custom',   'CSS reset snippet',    '*, *::before, *::after {\n\tbox-sizing: border-box;\n\tmargin: 0;\n\tpadding: 0;\n}'),
    _sn('scroll',   'smooth scroll',        'scroll-behavior: smooth;\nscrollbar-width: thin;'),
    _sn('hover',    ':hover',               '&:hover {\n\t${1:/* hover styles */}\n}'),
    _sn('focus',    ':focus-visible',       '&:focus-visible {\n\toutline: 2px solid ${1:var(--primary)};\n\toutline-offset: 2px;\n}'),
  ];
  _S.scss = [..._S.css,
    _sn('mixin',   '@mixin',               '@mixin ${1:name}(${2:$param}) {\n\t${3}\n}'),
    _sn('inc',     '@include',             '@include ${1:mixin}(${2:args});'),
    _sn('each',    '@each',                '@each $${1:item} in ${2:list} {\n\t${3}\n}'),
    _sn('for',     '@for',                 '@for $${1:i} from ${2:1} through ${3:10} {\n\t${4}\n}'),
    _sn('fn',      '@function',            '@function ${1:name}(${2:$param}) {\n\t@return ${3:$param};\n}'),
    _sn('ext',     '@extend',              '@extend ${1:.class};'),
    _sn('nest',    'nested selector',      '${1:.parent} {\n\t${2:color: red;}\n\n\t&:hover {\n\t\t${3}\n\t}\n\n\t&__${4:child} {\n\t\t${5}\n\t}\n}'),
  ];
  _S.less = [..._S.css];

  // ── C / C++ ──────────────────────────────────────────────────────────────
  _S.c = [
    _sn('#inc',    '#include',             '#include <${1:stdio.h}>'),
    _sn('#incl',   '#include ""',          '#include "${1:header.h}"'),
    _sn('main',    'main function',        '#include <stdio.h>\n\nint main(int argc, char *argv[]) {\n\t${1:printf("Hello\\n");}\n\treturn 0;\n}'),
    _sn('printf',  'printf',               'printf("${1:%s\\n}", ${2:value});'),
    _sn('scanf',   'scanf',                'scanf("${1:%d}", &${2:var});'),
    _sn('fori',    'for loop',             'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}'),
    _sn('while',   'while loop',           'while (${1:cond}) {\n\t${2}\n}'),
    _sn('struct',  'struct',               'typedef struct {\n\t${1:int field};\n} ${2:Name};'),
    _sn('func',    'function',             '${1:void} ${2:name}(${3:params}) {\n\t${4}\n}'),
    _sn('malloc',  'malloc',               '${1:Type} *${2:ptr} = (${1:Type} *)malloc(sizeof(${1:Type}) * ${3:n});'),
    _sn('free',    'free',                 'free(${1:ptr});\n${1:ptr} = NULL;'),
    _sn('sw',      'switch',               'switch (${1:val}) {\n\tcase ${2:A}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}'),
    _sn('ifndef',  '#ifndef guard',        '#ifndef ${1:HEADER_H}\n#define ${1:HEADER_H}\n\n${2}\n\n#endif /* ${1:HEADER_H} */'),
    _sn('fopen',   'fopen',                'FILE *${1:fp} = fopen("${2:file.txt}", "${3:r}");\nif (!${1:fp}) { perror("fopen"); return 1; }'),
  ];
  _S.cpp = [
    ..._S.c,
    _sn('cout',    'cout',                 'std::cout << ${1:val} << std::endl;'),
    _sn('cin',     'cin',                  'std::cin >> ${1:var};'),
    _sn('cls',     'class',                'class ${1:Name} {\npublic:\n\t${1:Name}() = default;\n\t~${1:Name}() = default;\n\n\t${2:void method();\n}\nprivate:\n\t${3:// members}\n};'),
    _sn('str',     'struct',               'struct ${1:Name} {\n\t${2:int x};\n\t${3:int y};\n};'),
    _sn('vec',     'vector',               'std::vector<${1:int}> ${2:v};'),
    _sn('map',     'map',                  'std::map<${1:std::string}, ${2:int}> ${3:m};'),
    _sn('unmap',   'unordered_map',        'std::unordered_map<${1:std::string}, ${2:int}> ${3:m};'),
    _sn('set',     'set',                  'std::set<${1:int}> ${2:s};'),
    _sn('pair',    'pair',                 'std::pair<${1:int}, ${2:int}> ${3:p} = {${4:0}, ${5:0}};'),
    _sn('rangefor','range-for',            'for (const auto& ${1:item} : ${2:cont}) {\n\t${3}\n}'),
    _sn('try',     'try-catch',            'try {\n\t${1}\n} catch (const std::exception& ${2:e}) {\n\tstd::cerr << ${2:e}.what() << "\\n";\n}'),
    _sn('uniq',    'unique_ptr',           'auto ${1:ptr} = std::make_unique<${2:Type}>(${3:args});'),
    _sn('shar',    'shared_ptr',           'auto ${1:ptr} = std::make_shared<${2:Type}>(${3:args});'),
    _sn('lam',     'lambda',               '[${1:&}](${2:auto x}) -> ${3:auto} {\n\treturn ${4:x};\n}'),
    _sn('tmpl',    'template',             'template <typename ${1:T}>\n${2:void} ${3:fn}(${1:T} ${4:arg}) {\n\t${5}\n}'),
    _sn('ns',      'namespace',            'namespace ${1:name} {\n\n${2}\n\n} // namespace ${1:name}'),
    _sn('ostr',    'operator<<',           'friend std::ostream& operator<<(std::ostream& ${1:os}, const ${2:Type}& ${3:obj}) {\n\treturn ${1:os} << ${4:obj.val};\n}'),
    _sn('sort',    'std::sort',            'std::sort(${1:v}.begin(), ${1:v}.end()${2:, [](auto& a, auto& b){ return a < b; }});'),
    _sn('algo',    '#include algorithms',  '#include <algorithm>\n#include <vector>\n#include <string>\n#include <iostream>'),
  ];

  // ── Java ─────────────────────────────────────────────────────────────────
  _S.java = [
    _sn('cls',     'class',                'public class ${1:Name} {\n\tpublic ${1:Name}() {\n\t\t${2}\n\t}\n}'),
    _sn('main',    'main method',          'public static void main(String[] args) {\n\t${1:// code}\n}'),
    _sn('sout',    'System.out.println',   'System.out.println(${1:val});'),
    _sn('serr',    'System.err.println',   'System.err.println(${1:msg});'),
    _sn('printf',  'System.out.printf',    'System.out.printf("${1:%s%n}", ${2:val});'),
    _sn('iface',   'interface',            'public interface ${1:Name} {\n\t${2:void method();};\n}'),
    _sn('enum',    'enum',                 'public enum ${1:Name} {\n\t${2:VALUE1}, ${3:VALUE2};\n}'),
    _sn('abs',     'abstract class',       'public abstract class ${1:Name} {\n\tpublic abstract ${2:void} ${3:method}();\n}'),
    _sn('try',     'try-catch',            'try {\n\t${1}\n} catch (${2:Exception} ${3:e}) {\n\t${3:e}.printStackTrace();\n}'),
    _sn('tryres',  'try-with-resources',   'try (${1:Resource r = new Resource()}) {\n\t${2}\n} catch (Exception ${3:e}) {\n\t${3:e}.printStackTrace();\n}'),
    _sn('for',     'enhanced for',         'for (${1:String} ${2:item} : ${3:list}) {\n\t${4}\n}'),
    _sn('fori',    'for loop',             'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}'),
    _sn('list',    'ArrayList',            'List<${1:String}> ${2:list} = new ArrayList<>();'),
    _sn('map',     'HashMap',              'Map<${1:String}, ${2:Object}> ${3:map} = new HashMap<>();'),
    _sn('set',     'HashSet',              'Set<${1:String}> ${2:set} = new HashSet<>();'),
    _sn('opt',     'Optional',             'Optional<${1:String}> ${2:opt} = Optional.ofNullable(${3:val});'),
    _sn('stream',  'stream pipeline',      '${1:list}.stream()\n\t.filter(${2:x} -> ${3:cond})\n\t.map(${4:x} -> ${5:x})\n\t.collect(Collectors.toList());'),
    _sn('lam',     'lambda',               '${1:x} -> ${2:x}'),
    _sn('ov',      '@Override',            '@Override\npublic ${1:void} ${2:method}(${3:params}) {\n\t${4}\n}'),
    _sn('get',     'getter',               'public ${1:String} get${2:Name}() {\n\treturn this.${3:field};\n}'),
    _sn('set',     'setter',               'public void set${1:Name}(${2:String} ${3:val}) {\n\tthis.${4:field} = ${3:val};\n}'),
    _sn('rec',     'Java record',          'public record ${1:Name}(${2:String field}) {}'),
    _sn('ann',     '@annotation',          '@${1:FunctionalInterface}\n${2}'),
    _sn('imp',     'import',               'import ${1:java.util.List};'),
    _sn('sw',      'switch expr',          '${1:result} = switch (${2:val}) {\n\tcase ${3:A} -> ${4:expr};\n\tdefault -> ${5:expr};\n};'),
  ];

  // ── Go ───────────────────────────────────────────────────────────────────
  _S.go = [
    _sn('main',  'main func',             'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("${1:Hello, World!}")\n}'),
    _sn('fn',    'function',              'func ${1:name}(${2:params}) ${3:returnType} {\n\t${4}\n}'),
    _sn('meth',  'method',               'func (${1:r} *${2:Recv}) ${3:Method}(${4:params}) ${5:error} {\n\t${6}\n}'),
    _sn('str',   'struct',               'type ${1:Name} struct {\n\t${2:Field} ${3:string}\n}'),
    _sn('iface', 'interface',            'type ${1:Name} interface {\n\t${2:Method}() ${3:error}\n}'),
    _sn('err',   'error check',          'if err != nil {\n\treturn ${1:nil,} err\n}'),
    _sn('iferr', 'if err return',        'if err != nil {\n\t${1:log.Fatal(err)}\n}'),
    _sn('gor',   'goroutine',            'go func() {\n\t${1:// concurrent}\n}()'),
    _sn('ch',    'channel',              '${1:ch} := make(chan ${2:int}${3:, 1})'),
    _sn('sel',   'select',               'select {\ncase ${1:v} := <-${2:ch}:\n\t${3:_ = v}\ndefault:\n\t${4:// no message}\n}'),
    _sn('for',   'for range',            'for ${1:i}, ${2:v} := range ${3:slice} {\n\t${4}\n}'),
    _sn('fori',  'for loop',             'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n\t${3}\n}'),
    _sn('def',   'defer',                'defer ${1:fn}()'),
    _sn('map',   'map',                  '${1:m} := make(map[${2:string}]${3:int})'),
    _sn('sl',    'slice',                '${1:s} := make([]${2:int}, ${3:0}, ${4:10})'),
    _sn('test',  'test function',        'func Test${1:Name}(t *testing.T) {\n\t${2}\n}'),
    _sn('bench', 'benchmark',            'func Benchmark${1:Name}(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t${2}\n\t}\n}'),
    _sn('http',  'http handler',         'func ${1:handler}(w http.ResponseWriter, r *http.Request) {\n\t${2:fmt.Fprintln(w, "ok")}\n}'),
  ];

  // ── Rust ─────────────────────────────────────────────────────────────────
  _S.rust = [
    _sn('fn',    'function',              'fn ${1:name}(${2:params}) -> ${3:()} {\n\t${4}\n}'),
    _sn('pfn',   'pub function',          'pub fn ${1:name}(${2:params}) -> ${3:()} {\n\t${4}\n}'),
    _sn('main',  'main',                  'fn main() {\n\t${1:println!("Hello, world!");}\n}'),
    _sn('str',   'struct',                'struct ${1:Name} {\n\t${2:field}: ${3:Type},\n}'),
    _sn('impl',  'impl',                  'impl ${1:Type} {\n\tfn ${2:new}() -> Self {\n\t\t${3:Self {}}\n\t}\n}'),
    _sn('trait', 'trait',                 'trait ${1:Name} {\n\tfn ${2:method}(&self) -> ${3:()};\n}'),
    _sn('impltr','impl trait',            'impl ${1:Trait} for ${2:Type} {\n\tfn ${3:method}(&self) -> ${4:()} {\n\t\t${5}\n\t}\n}'),
    _sn('enum',  'enum',                  'enum ${1:Name} {\n\t${2:Variant1},\n\t${3:Variant2}(${4:Type}),\n}'),
    _sn('match', 'match',                 'match ${1:val} {\n\t${2:pattern} => ${3:result},\n\t_ => ${4:()},\n}'),
    _sn('opt',   'Option match',          'match ${1:opt} {\n\tSome(${2:v}) => ${3:v},\n\tNone => ${4:return},\n}'),
    _sn('res',   'Result match',          'match ${1:res} {\n\tOk(${2:v}) => ${3:v},\n\tErr(${4:e}) => return Err(${4:e}),\n}'),
    _sn('?',     '? operator',            '${1:expr}?'),
    _sn('vec',   'vec!',                  'vec![${1:elems}]'),
    _sn('pln',   'println!',              'println!("${1:{}}", ${2:val});'),
    _sn('dbg',   'dbg!',                  'dbg!(${1:expr});'),
    _sn('drv',   '#[derive]',             '#[derive(${1:Debug, Clone, PartialEq})]'),
    _sn('lf',    'lifetime fn',           'fn ${1:name}<\'${2:a}>(${3:x}: &\'${2:a} ${4:str}) -> &\'${2:a} ${4:str} {\n\t${5:x}\n}'),
    _sn('clos',  'closure',               '|${1:x}| -> ${2:_} {\n\t${3:x}\n}'),
    _sn('arc',   'Arc',                   'use std::sync::Arc;\nlet ${1:shared} = Arc::new(${2:value});'),
    _sn('mutex', 'Mutex',                 'use std::sync::Mutex;\nlet ${1:lock} = Mutex::new(${2:value});'),
    _sn('test',  '#[test]',               '#[test]\nfn ${1:test_name}() {\n\t${2:assert_eq!(1 + 1, 2);}\n}'),
  ];

  // ── PHP ──────────────────────────────────────────────────────────────────
  _S.php = [
    _sn('php',   '<?php',                 '<?php\n\n${1:// code}\n'),
    _sn('echo',  'echo',                  'echo "${1:text}";'),
    _sn('prf',   'printf',                'printf("%${1:s}", ${2:val});'),
    _sn('fn',    'function',              'function ${1:name}(${2:params}) {\n\t${3}\n\treturn ${4:null};\n}'),
    _sn('cls',   'class',                 'class ${1:Name} {\n\tpublic function __construct(${2:params}) {\n\t\t${3}\n\t}\n}'),
    _sn('arr',   'array',                 '$${1:arr} = [${2:value}];'),
    _sn('for',   'foreach',               'foreach ($${1:arr} as $${2:key} => $${3:val}) {\n\t${4}\n}'),
    _sn('try',   'try-catch',             'try {\n\t${1}\n} catch (${2:Exception} $${3:e}) {\n\techo $${3:e}->getMessage();\n}'),
    _sn('pdo',   'PDO query',             '$${1:stmt} = $${2:pdo}->prepare("${3:SELECT * FROM table}");\n$${1:stmt}->execute();\n$${4:rows} = $${1:stmt}->fetchAll(PDO::FETCH_ASSOC);'),
  ];

  // ── Shell (Bash) ──────────────────────────────────────────────────────────
  _S.shell = [
    _sn('shebang', 'bash shebang',        '#!/bin/bash\nset -euo pipefail\n\n${1:# script}'),
    _sn('if',    'if statement',          'if [[ ${1:cond} ]]; then\n\t${2}\nfi'),
    _sn('ife',   'if-else',               'if [[ ${1:cond} ]]; then\n\t${2}\nelse\n\t${3}\nfi'),
    _sn('elif',  'elif chain',            'if [[ ${1:cond1} ]]; then\n\t${2}\nelif [[ ${3:cond2} ]]; then\n\t${4}\nelse\n\t${5}\nfi'),
    _sn('for',   'for loop',              'for ${1:item} in ${2:list}; do\n\t${3:echo "$item"}\ndone'),
    _sn('fori',  'for range',             'for ((${1:i}=0; ${1:i}<${2:10}; ${1:i}++)); do\n\t${3}\ndone'),
    _sn('wh',    'while loop',            'while [[ ${1:cond} ]]; do\n\t${2}\ndone'),
    _sn('fn',    'function',              '${1:name}() {\n\tlocal ${2:var}="${3:$1}"\n\t${4}\n}'),
    _sn('case',  'case statement',        'case "${1:$var}" in\n\t${2:pattern})\n\t\t${3}\n\t\t;;\n\t*)\n\t\t${4}\n\t\t;;\nesac'),
    _sn('echo',  'echo',                  'echo "${1:message}"'),
    _sn('read',  'read input',            'read -rp "${1:Prompt: }" ${2:var}'),
    _sn('chk',   'check command exists',  'command -v ${1:cmd} &>/dev/null || { echo "${1:cmd} not found"; exit 1; }'),
    _sn('err',   'error exit',            'echo "Error: ${1:msg}" >&2\nexit ${2:1}'),
    _sn('trap',  'trap',                  'trap \'${1:cleanup}\' EXIT INT TERM'),
    _sn('dir',   'script dir',            'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"'),
  ];

  // ── Markdown ─────────────────────────────────────────────────────────────
  _S.markdown = [
    _sn('code',  'code block',            '```${1:js}\n${2:// code}\n```'),
    _sn('link',  'link',                  '[${1:text}](${2:url})'),
    _sn('img',   'image',                 '![${1:alt}](${2:src})'),
    _sn('table', 'table',                 '| ${1:Col1} | ${2:Col2} |\n|--------|--------|\n| ${3:val} | ${4:val} |'),
    _sn('todo',  'task list',             '- [ ] ${1:task}'),
    _sn('detail','<details>',             '<details>\n<summary>${1:Summary}</summary>\n\n${2:Content}\n\n</details>'),
    _sn('badge', 'shield badge',          '![${1:label}](https://img.shields.io/badge/${1:label}-${2:green})'),
  ];

  // ── YAML ─────────────────────────────────────────────────────────────────
  _S.yaml = [
    _sn('gh',    'GitHub workflow',       'name: ${1:CI}\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: ${2:Step}\n        run: ${3:echo ok}'),
    _sn('docker','docker-compose',        'version: "3.9"\nservices:\n  ${1:app}:\n    image: ${2:node:20}\n    ports:\n      - "${3:3000}:${3:3000}"'),
    _sn('kube',  'k8s deployment',        'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${1:app}\nspec:\n  replicas: ${2:1}\n  template:\n    spec:\n      containers:\n        - name: ${1:app}\n          image: ${3:image}'),
  ];

  // ════════════════════════════════════════════════════════════════════════
  //  HOVER DOCUMENTATION  (common APIs)
  // ════════════════════════════════════════════════════════════════════════
  const _HOVER_DOCS = {
    // JS array methods
    'map':       '**Array.prototype.map()**\nCreates a new array with results of calling a function on every element.',
    'filter':    '**Array.prototype.filter()**\nCreates a new array with elements passing the test function.',
    'reduce':    '**Array.prototype.reduce()**\nReduces array to a single value using a reducer function.',
    'forEach':   '**Array.prototype.forEach()**\nExecutes a function for each array element.',
    'find':      '**Array.prototype.find()**\nReturns the first element satisfying the test function.',
    'findIndex': '**Array.prototype.findIndex()**\nReturns the index of the first element satisfying the test.',
    'some':      '**Array.prototype.some()**\nTests if at least one element passes the test.',
    'every':     '**Array.prototype.every()**\nTests if all elements pass the test.',
    'includes':  '**Array.prototype.includes()**\nDetermines if an array includes a certain value.',
    'flat':      '**Array.prototype.flat()**\nCreates a new array with sub-array elements concatenated.',
    'flatMap':   '**Array.prototype.flatMap()**\nMaps each element, then flattens the result.',
    'slice':     '**Array.prototype.slice()**\nReturns a shallow copy of a portion of an array.',
    'splice':    '**Array.prototype.splice()**\nChanges the contents of an array by removing/replacing/adding elements.',
    'sort':      '**Array.prototype.sort()**\nSorts the elements of an array in-place.',
    'join':      '**Array.prototype.join()**\nJoins all array elements into a string.',
    // JS object methods
    'Object.keys':    '**Object.keys()**\nReturns an array of the object\'s own enumerable property names.',
    'Object.values':  '**Object.values()**\nReturns an array of the object\'s own enumerable property values.',
    'Object.entries': '**Object.entries()**\nReturns an array of the object\'s own enumerable [key, value] pairs.',
    'Object.assign':  '**Object.assign()**\nCopies enumerable own properties from source objects to a target.',
    'Object.freeze':  '**Object.freeze()**\nFreezes an object — prevents modification.',
    // Promise
    'Promise.all':   '**Promise.all()**\nResolves when all promises resolve; rejects if any rejects.',
    'Promise.race':  '**Promise.race()**\nResolves/rejects as soon as one promise resolves/rejects.',
    'Promise.allSettled': '**Promise.allSettled()**\nResolves after all promises settle, returns their results.',
    'Promise.any':   '**Promise.any()**\nResolves with the first fulfilling promise.',
    // JSON
    'JSON.parse':     '**JSON.parse()**\nParses a JSON string and returns the JavaScript value.',
    'JSON.stringify': '**JSON.stringify()**\nConverts a JavaScript value to a JSON string.',
    // Console
    'console.log':   '**console.log()**\nOutputs a message to the console.',
    'console.error': '**console.error()**\nOutputs an error message to the console.',
    'console.warn':  '**console.warn()**\nOutputs a warning message to the console.',
    'console.table': '**console.table()**\nDisplays data as a table in the console.',
    'console.time':  '**console.time()**\nStarts a timer with the given label.',
    // Math
    'Math.max':      '**Math.max()**\nReturns the largest of the given numbers.',
    'Math.min':      '**Math.min()**\nReturns the smallest of the given numbers.',
    'Math.floor':    '**Math.floor()**\nReturns the largest integer ≤ x.',
    'Math.ceil':     '**Math.ceil()**\nReturns the smallest integer ≥ x.',
    'Math.round':    '**Math.round()**\nReturns the nearest integer.',
    'Math.abs':      '**Math.abs()**\nReturns the absolute value.',
    'Math.random':   '**Math.random()**\nReturns a pseudo-random number between 0 and 1.',
    // String
    'trim':          '**String.prototype.trim()**\nRemoves whitespace from both ends of the string.',
    'split':         '**String.prototype.split()**\nSplits the string into an array at the separator.',
    'replace':       '**String.prototype.replace()**\nReplaces the first match of a pattern with a replacement.',
    'replaceAll':    '**String.prototype.replaceAll()**\nReplaces all matches of a pattern with a replacement.',
    'includes':      '**String.prototype.includes()**\nDetermines whether the string contains the value.',
    'startsWith':    '**String.prototype.startsWith()**\nChecks if the string starts with the given value.',
    'endsWith':      '**String.prototype.endsWith()**\nChecks if the string ends with the given value.',
    'padStart':      '**String.prototype.padStart()**\nPads the beginning of the string to the given length.',
    'padEnd':        '**String.prototype.padEnd()**\nPads the end of the string to the given length.',
    // Array extras
    'at':            '**Array.prototype.at()**\nReturns the element at the given index (supports negative indices).',
    'fill':          '**Array.prototype.fill()**\nFills all array elements with a static value.',
    'indexOf':       '**Array.prototype.indexOf()**\nReturns the first index of the given element, or -1.',
    'lastIndexOf':   '**Array.prototype.lastIndexOf()**\nReturns the last index of the given element, or -1.',
    'copyWithin':    '**Array.prototype.copyWithin()**\nShallow-copies part of the array to another location.',
    'entries':       '**Array.prototype.entries()**\nReturns an iterator of [index, value] pairs.',
    'keys':          '**Array.prototype.keys()**\nReturns an iterator of array indices.',
    'values':        '**Array.prototype.values()**\nReturns an iterator of array values.',
    'findLast':      '**Array.prototype.findLast()**\nReturns the last element satisfying the test function.',
    'findLastIndex': '**Array.prototype.findLastIndex()**\nReturns the last index satisfying the test function.',
    'toSorted':      '**Array.prototype.toSorted()**\nReturns a sorted copy without mutating the original.',
    'toReversed':    '**Array.prototype.toReversed()**\nReturns a reversed copy without mutating the original.',
    'with':          '**Array.prototype.with()**\nReturns a copy with one element replaced at the given index.',
    'Array.from':    '**Array.from()**\nCreates an array from an iterable or array-like object.',
    'Array.isArray': '**Array.isArray()**\nDetermines whether the value is an Array.',
    'Array.of':      '**Array.of()**\nCreates an array from the given arguments.',
    // Object extras
    'Object.create':       '**Object.create()**\nCreates a new object with the given prototype.',
    'Object.defineProperty':'**Object.defineProperty()**\nDefines or modifies a property descriptor on an object.',
    'Object.fromEntries':  '**Object.fromEntries()**\nTransforms a list of key-value pairs into an object.',
    'Object.hasOwn':       '**Object.hasOwn()**\nReturns true if the object has the given own property.',
    'Object.is':           '**Object.is()**\nDetermines if two values are the same value (like === but handles NaN and ±0).',
    'Object.keys':         '**Object.keys()**\nReturns an array of own enumerable property names.',
    'Object.values':       '**Object.values()**\nReturns an array of own enumerable property values.',
    'Object.entries':      '**Object.entries()**\nReturns an array of own enumerable [key, value] pairs.',
    // String extras
    'matchAll':      '**String.prototype.matchAll()**\nReturns an iterator of all regex matches including capture groups.',
    'match':         '**String.prototype.match()**\nMatches string against a regex; returns matches or null.',
    'repeat':        '**String.prototype.repeat()**\nReturns the string repeated n times.',
    'slice_str':     '**String.prototype.slice()**\nExtracts a section of a string and returns it.',
    'substring':     '**String.prototype.substring()**\nReturns characters between two indices.',
    'toLowerCase':   '**String.prototype.toLowerCase()**\nConverts string to lowercase.',
    'toUpperCase':   '**String.prototype.toUpperCase()**\nConverts string to uppercase.',
    'charAt':        '**String.prototype.charAt()**\nReturns the character at the specified index.',
    'charCodeAt':    '**String.prototype.charCodeAt()**\nReturns the UTF-16 code unit at the index.',
    'normalize':     '**String.prototype.normalize()**\nReturns the Unicode Normalization Form of the string.',
    // React Hooks
    'useState':      '**React.useState(initialValue)**\nReturns [state, setState]. Re-renders on state change.\n\n```tsx\nconst [count, setCount] = useState(0);\n```',
    'useEffect':     '**React.useEffect(effect, deps?)**\nRuns after render. Optionally return a cleanup function.\n\n```tsx\nuseEffect(() => { /* side effect */ return () => { /* cleanup */ }; }, [dep]);\n```',
    'useCallback':   '**React.useCallback(fn, deps)**\nMemoizes a callback function. Re-creates only when deps change.',
    'useMemo':       '**React.useMemo(fn, deps)**\nMemoizes an expensive computed value. Re-computes when deps change.',
    'useRef':        '**React.useRef(initial?)**\nReturns a mutable ref object. `ref.current` persists across renders.',
    'useContext':    '**React.useContext(Context)**\nSubscribes to a React context value.',
    'useReducer':    '**React.useReducer(reducer, init)**\nAlternative to useState for complex state logic.',
    'useId':         '**React.useId()**\nGenerates a stable, unique ID for accessibility attributes.',
    'useTransition': '**React.useTransition()**\nMarks updates as non-urgent to keep the UI responsive.',
    'useDeferredValue':'**React.useDeferredValue(value)**\nDefers re-rendering of a non-urgent part of the UI.',
    'useLayoutEffect':'**React.useLayoutEffect(effect, deps?)**\nLike useEffect but fires synchronously after DOM mutations.',
    'useImperativeHandle':'**React.useImperativeHandle(ref, fn, deps?)**\nCustomizes the instance exposed when using forwardRef.',
    'useDebugValue': '**React.useDebugValue(value)**\nDisplays a label for custom hooks in React DevTools.',
    // Fetch API extras
    'Response':      '**Response**\nRepresents a response to a fetch request. Key methods: `.json()`, `.text()`, `.blob()`, `.arrayBuffer()`.',
    'Request':       '**Request**\nRepresents a resource request. Passed to `fetch(request)`.',
    'Headers':       '**Headers**\nRepresents HTTP headers. Methods: `get()`, `set()`, `append()`, `has()`, `delete()`.',
    'AbortController':'**AbortController**\nAllows aborting a fetch request with `.abort()`. Pass `.signal` to fetch options.',
    'URL':           '**URL**\nWeb API for URL parsing and construction. `new URL(href, base)`.',
    'URLSearchParams':'**URLSearchParams**\nUtility to work with URL query strings.',
    // Storage
    'localStorage':  '**localStorage**\nPersistent key-value storage. Survives page reloads. Methods: `getItem`, `setItem`, `removeItem`, `clear`.',
    'sessionStorage':'**sessionStorage**\nSession-scoped key-value storage. Cleared when tab closes.',
    'IndexedDB':     '**IndexedDB**\nLow-level API for client-side storage of significant amounts of structured data.',
    // Timer
    'setTimeout':    '**setTimeout(fn, delay, ...args)**\nCalls fn after at least delay milliseconds. Returns a timer ID.',
    'clearTimeout':  '**clearTimeout(id)**\nCancels a timeout created with setTimeout.',
    'setInterval':   '**setInterval(fn, delay, ...args)**\nCalls fn repeatedly every delay milliseconds. Returns an interval ID.',
    'clearInterval': '**clearInterval(id)**\nCancels an interval created with setInterval.',
    'requestAnimationFrame':'**requestAnimationFrame(fn)**\nSchedules fn to run before the next repaint for smooth animation.',
    // Events
    'addEventListener':    '**EventTarget.addEventListener(type, listener, options?)**\nAttaches an event handler to the element.',
    'removeEventListener': '**EventTarget.removeEventListener(type, listener)**\nRemoves an event handler from the element.',
    'dispatchEvent':       '**EventTarget.dispatchEvent(event)**\nDispatches a synthetic event at the target.',
    'CustomEvent':         '**CustomEvent(type, { detail })**\nCreates a custom event with optional attached data.',
    // Node.js common
    'require':       '**require(id)**\nLoads a CommonJS module. Built-in modules: `fs`, `path`, `os`, `http`, `crypto`, `events`.',
    '__dirname':     '**__dirname**\nAbsolute path of the directory containing the current module file.',
    '__filename':    '**__filename**\nAbsolute path of the current module file.',
    'process':       '**process**\nNode.js global. Key properties: `env`, `argv`, `cwd()`, `exit()`, `platform`, `version`.',
    'Buffer':        '**Buffer**\nNode.js global for binary data. `Buffer.from()`, `Buffer.alloc()`, `buf.toString()`.',
  };

  // ════════════════════════════════════════════════════════════════════════
  //  KEYWORD PROVIDERS  (for non-Monaco-native languages)
  // ════════════════════════════════════════════════════════════════════════
  const _KEYWORDS = {
    python: ['False','None','True','and','as','assert','async','await','break',
             'class','continue','def','del','elif','else','except','finally',
             'for','from','global','if','import','in','is','lambda','nonlocal',
             'not','or','pass','raise','return','try','while','with','yield',
             'print','len','range','enumerate','zip','map','filter','list',
             'dict','set','tuple','str','int','float','bool','bytes','type',
             'super','self','cls','property','staticmethod','classmethod',
             'open','input','isinstance','issubclass','hasattr','getattr',
             'setattr','delattr','callable','iter','next','sorted','reversed',
             'any','all','sum','max','min','abs','round','hash','id','repr'],
    java: ['abstract','assert','boolean','break','byte','case','catch','char',
           'class','const','continue','default','do','double','else','enum',
           'extends','final','finally','float','for','goto','if','implements',
           'import','instanceof','int','interface','long','native','new',
           'package','private','protected','public','return','short','static',
           'strictfp','super','switch','synchronized','this','throw','throws',
           'transient','try','var','void','volatile','while','record','sealed',
           'String','Object','List','Map','Set','ArrayList','HashMap','HashSet',
           'Optional','Stream','System','Math','Arrays','Collections',
           'StringBuilder','Iterator','Exception','RuntimeException'],
    go: ['break','case','chan','const','continue','default','defer','else',
         'fallthrough','for','func','go','goto','if','import','interface',
         'map','package','range','return','select','struct','switch','type',
         'var','nil','true','false','iota','append','cap','close','complex',
         'copy','delete','imag','len','make','new','panic','print','println',
         'real','recover','error','string','int','int8','int16','int32','int64',
         'uint','uint8','uint16','uint32','uint64','float32','float64','bool',
         'byte','rune','uintptr'],
    rust: ['as','break','const','continue','crate','else','enum','extern',
           'false','fn','for','if','impl','in','let','loop','match','mod',
           'move','mut','pub','ref','return','self','Self','static','struct',
           'super','trait','true','type','unsafe','use','where','while',
           'async','await','dyn','abstract','become','box','do','final',
           'macro','override','priv','typeof','unsized','virtual','yield',
           'String','Vec','HashMap','HashSet','Option','Result','Box','Arc',
           'Rc','Mutex','RwLock','Cell','RefCell','i8','i16','i32','i64','i128',
           'u8','u16','u32','u64','u128','f32','f64','bool','char','str','usize'],
    php: ['abstract','and','array','as','break','callable','case','catch',
          'class','clone','const','continue','declare','default','die','do',
          'echo','else','elseif','empty','enddeclare','endfor','endforeach',
          'endif','endswitch','endwhile','eval','exit','extends','final',
          'finally','fn','for','foreach','function','global','goto','if',
          'implements','include','include_once','instanceof','insteadof',
          'interface','isset','list','match','namespace','new','null','or',
          'print','private','protected','public','readonly','require',
          'require_once','return','static','switch','throw','trait','true',
          'false','try','unset','use','var','while','xor','yield'],
    shell: ['if','then','else','elif','fi','for','while','do','done','case',
            'esac','function','in','select','until','time','coproc','echo',
            'printf','read','local','return','exit','source','export','declare',
            'typeset','unset','shift','set','unalias','alias','trap','wait',
            'exec','eval','getopts','let','test','true','false','break',
            'continue','dirs','pushd','popd','pwd','cd','ls','cp','mv','rm',
            'mkdir','rmdir','touch','cat','grep','sed','awk','cut','sort',
            'uniq','wc','head','tail','find','xargs','pipe','chmod','chown'],
  };

  function _registerKeywordProvider(lang, keywords) {
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        if (word.word.length < 1) return { suggestions: [] };
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn,
        };
        return {
          suggestions: keywords.map(kw => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            detail: `${lang} keyword`,
            insertText: kw,
            sortText: 'k' + kw,
            range,
          })),
        };
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  PROVIDER REGISTRATION
  // ════════════════════════════════════════════════════════════════════════
  function _registerSnippetProvider(langs, snips) {
    if (!snips || !snips.length) return;
    const langArr = Array.isArray(langs) ? langs : [langs];
    langArr.forEach(lang => {
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems(model, position) {
          const word  = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: word.startColumn, endColumn: word.endColumn,
          };
          return {
            suggestions: snips.map(s => ({
              label: s.label,
              kind:  monaco.languages.CompletionItemKind.Snippet,
              detail: s.detail,
              documentation: { value: s.documentation || '' },
              insertText: s.insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              filterText: s.label,
              sortText: 'a' + s.label,
              range,
            })),
          };
        },
      });
    });
  }

  function _registerWorkspaceProvider(langs) {
    const langArr = Array.isArray(langs) ? langs : [langs];
    langArr.forEach(lang => {
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems(model, position) {
          const word = model.getWordUntilPosition(position);
          if (word.word.length < 2) return { suggestions: [] };
          const currentFile = (model.uri?.fsPath || model.uri?.path || '').replace(/^\//, '');
          const range = {
            startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: word.startColumn, endColumn: word.endColumn,
          };
          return { suggestions: _wsCompletions(currentFile, range) };
        },
      });
    });
  }

  function _registerHoverProvider() {
    // JS / TS / JSX / TSX — method and API docs
    ['javascript','typescript','javascriptreact','typescriptreact'].forEach(lang => {
      monaco.languages.registerHoverProvider(lang, {
        provideHover(model, position) {
          const word = model.getWordAtPosition(position);
          if (!word) return null;
          const line   = model.getLineContent(position.lineNumber);
          const before = line.slice(0, word.startColumn - 1);

          // Check dotted access: "arr.map" → look up "map"; also bare word
          const dotKey = before.endsWith('.') ? word.word : null;
          const doc    = _HOVER_DOCS[word.word] || (dotKey ? _HOVER_DOCS[dotKey] : null);
          if (!doc) return null;
          return {
            range: new monaco.Range(
              position.lineNumber, word.startColumn,
              position.lineNumber, word.endColumn
            ),
            contents: [{ value: doc }],
          };
        },
      });
    });

    // CSS / SCSS / LESS — property docs
    const CSS_PROP_DOCS = {
      display:        '**`display`** — Controls how an element is rendered in the layout flow.\n\nCommon values: `block`, `inline`, `flex`, `grid`, `inline-flex`, `none`.',
      position:       '**`position`** — Sets how an element is positioned.\n\n`relative` — offset from normal flow · `absolute` — relative to nearest positioned ancestor · `fixed` — relative to viewport · `sticky` — hybrid scrolling behavior.',
      flexDirection:  '**`flex-direction`** — Defines the main axis of a flex container. `row` (default) | `column` | `row-reverse` | `column-reverse`.',
      'flex-direction':'**`flex-direction`** — Defines the main axis of a flex container.',
      justifyContent: '**`justify-content`** — Aligns flex/grid items along the main axis.',
      'justify-content':'**`justify-content`** — Aligns items along the main axis.\n\nValues: `flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`.',
      alignItems:     '**`align-items`** — Aligns flex/grid items along the cross axis.',
      'align-items':  '**`align-items`** — Aligns flex items along the cross axis.\n\nValues: `stretch`, `flex-start`, `flex-end`, `center`, `baseline`.',
      gap:            '**`gap`** — Shorthand for `row-gap` and `column-gap`. Sets spacing between flex/grid items.',
      overflow:       '**`overflow`** — Controls clipping of content that overflows an element\'s box.\n\nValues: `visible`, `hidden`, `scroll`, `auto`.',
      transform:      '**`transform`** — Applies 2D/3D transformations: `translate()`, `rotate()`, `scale()`, `skew()`, `matrix()`.',
      transition:     '**`transition`** — Smoothly animates CSS property changes.\n\nSyntax: `property duration timing-function delay`.',
      animation:      '**`animation`** — Applies a CSS keyframe animation.\n\nSyntax: `name duration timing-function delay iteration-count direction fill-mode`.',
      'z-index':      '**`z-index`** — Controls stacking order of positioned elements. Higher = on top. Only works on positioned elements.',
      opacity:        '**`opacity`** — Transparency level from `0` (invisible) to `1` (fully visible).',
      'border-radius':'**`border-radius`** — Rounds the corners of an element\'s border box. Accepts `px`, `%`, or `em`.',
      'box-shadow':   '**`box-shadow`** — Adds shadow effects around an element.\n\nSyntax: `offset-x offset-y blur-radius spread-radius color`.',
      'grid-template-columns':'**`grid-template-columns`** — Defines the columns of a grid.\n\nExamples: `repeat(3, 1fr)`, `200px 1fr`, `auto auto`.',
      'grid-template-rows':'**`grid-template-rows`** — Defines the rows of a grid.',
      'background-image':'**`background-image`** — Sets background image(s).\n\nExamples: `url(img.png)`, `linear-gradient(to right, #000, #fff)`.',
      'object-fit':   '**`object-fit`** — Specifies how `<img>` or `<video>` content fits its container.\n\nValues: `fill`, `contain`, `cover`, `none`, `scale-down`.',
      'user-select':  '**`user-select`** — Controls text selection by the user. `none` prevents selection.',
      'pointer-events':'**`pointer-events`** — Controls whether an element can be the target of mouse/touch events. `none` disables all interaction.',
      'will-change':  '**`will-change`** — Hints to the browser about which properties will change, enabling GPU-layer promotion.',
      'clip-path':    '**`clip-path`** — Clips an element to a shape. Supports `circle()`, `polygon()`, `inset()`, `path()`.',
      'backdrop-filter':'**`backdrop-filter`** — Applies graphical effects to the area behind an element. `blur()`, `brightness()`, etc.',
      'mix-blend-mode':'**`mix-blend-mode`** — Controls how an element\'s content blends with its background.',
      'scroll-behavior':'**`scroll-behavior`** — Controls scroll animation. `smooth` enables animated scrolling.',
      'aspect-ratio': '**`aspect-ratio`** — Sets the preferred aspect ratio. Example: `aspect-ratio: 16 / 9`.',
      'container':    '**`container`** — CSS Containment. Enables container queries with `container-type` and `container-name`.',
    };

    ['css','scss','less'].forEach(lang => {
      monaco.languages.registerHoverProvider(lang, {
        provideHover(model, position) {
          const word = model.getWordAtPosition(position);
          if (!word) return null;
          // CSS properties are hyphenated — get the full property including hyphens
          const line   = model.getLineContent(position.lineNumber);
          const propRe = /([\w-]+)(?:\s*:)/;
          const lineUp = line.slice(0, position.column + 30);
          const m      = propRe.exec(lineUp.slice(Math.max(0, position.column - 30)));
          const prop   = m ? m[1] : word.word;
          const doc    = CSS_PROP_DOCS[prop] || CSS_PROP_DOCS[word.word];
          if (!doc) return null;
          return {
            range: new monaco.Range(
              position.lineNumber, word.startColumn,
              position.lineNumber, word.endColumn
            ),
            contents: [{ value: doc }],
          };
        },
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  INIT
  // ════════════════════════════════════════════════════════════════════════
  function _init() {
    if (typeof monaco === 'undefined') return;

    // Snippet providers
    _registerSnippetProvider(['javascript','javascriptreact'], _S.javascript);
    _registerSnippetProvider(['typescript','typescriptreact'],  _S.typescript);
    _registerSnippetProvider('javascriptreact', _S.javascriptreact);
    _registerSnippetProvider('typescriptreact', _S.typescriptreact);
    _registerSnippetProvider('python',  _S.python);
    _registerSnippetProvider('html',    _S.html);
    _registerSnippetProvider(['css'],   _S.css);
    _registerSnippetProvider(['scss'],  _S.scss);
    _registerSnippetProvider(['less'],  _S.less);
    _registerSnippetProvider(['c'],     _S.c);
    _registerSnippetProvider(['cpp'],   _S.cpp);
    _registerSnippetProvider('java',    _S.java);
    _registerSnippetProvider('go',      _S.go);
    _registerSnippetProvider('rust',    _S.rust);
    _registerSnippetProvider('php',     _S.php);
    _registerSnippetProvider(['shell','shellscript'], _S.shell);
    _registerSnippetProvider('markdown', _S.markdown);
    _registerSnippetProvider(['yaml'],   _S.yaml);

    // Keyword providers for non-native languages
    Object.entries(_KEYWORDS).forEach(([lang, kws]) => {
      _registerKeywordProvider(lang, kws);
    });

    // Workspace cross-file symbol providers
    const codeLanguages = [
      'javascript','typescript','javascriptreact','typescriptreact',
      'python','java','cpp','c','go','rust','php','shell',
    ];
    _registerWorkspaceProvider(codeLanguages);

    // Hover documentation
    _registerHoverProvider();

    // Kick off initial workspace index
    const rootPath = (typeof explorerState !== 'undefined') ? explorerState.rootPath : null;
    if (rootPath) _indexWorkspace(rootPath);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init: _init,

    reindexWorkspace() {
      const root = (typeof explorerState !== 'undefined') ? explorerState.rootPath : _wsRoot;
      if (root) {
        clearTimeout(_reindexT);
        _reindexT = setTimeout(() => _indexWorkspace(root), 800);
      }
    },

    indexDocument(filePath, content, language) {
      if (!filePath || !content) return;
      const { symbols, words } = _extractSymbols(content, language || _extLang(filePath));
      _registry.set(filePath, { symbols, words, lang: language });
    },

    removeDocument(filePath) {
      _registry.delete(filePath);
    },

    getSnippets(lang) {
      return _S[lang] || [];
    },
  };
})();

// Boot after Monaco
document.addEventListener('monaco-ready', () => IntelliSense.init());
// Re-index when workspace opens
document.addEventListener('workspace-opened', () => IntelliSense.reindexWorkspace());
