/**
 * JavaScript IntelliSense Pro  — Phase 4 Extension
 * Enhanced completions: Node.js APIs, DOM, Express, React hooks, fetch patterns.
 */
"use strict";

window._exts = window._exts || {};
window._exts['js-intellisense'] = {
  id:   'js-intellisense',
  name: 'JavaScript IntelliSense Pro',
  icon: '⚡',
  desc: 'Deep JS/TS/JSX completions — Node.js, DOM, Express, React, Promises',
  version: '1.0.0',
  category: 'IntelliSense',

  activate(ctx) {
    document.addEventListener('monaco-ready', () => _register(ctx));
  },
};

function _register(ctx) {
  if (typeof monaco === 'undefined') return;

  // ── Extra type declarations for Node.js / Electron ────────────────────
  const nodeDeclarations = `
declare module 'fs' {
  export function readFileSync(path: string, enc: string): string;
  export function writeFileSync(path: string, data: string): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, opts?: object): void;
  export function readdirSync(path: string): string[];
  export function unlinkSync(path: string): void;
  export function statSync(path: string): { isFile(): boolean; isDirectory(): boolean; size: number; };
  export const promises: {
    readFile(path: string, enc: string): Promise<string>;
    writeFile(path: string, data: string): Promise<void>;
    readdir(path: string, opts?: object): Promise<any[]>;
    mkdir(path: string, opts?: object): Promise<void>;
    unlink(path: string): Promise<void>;
    stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean; size: number; }>;
  };
}
declare module 'path' {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
  export function relative(from: string, to: string): string;
  export function isAbsolute(p: string): boolean;
  export const sep: string;
}
declare module 'os' {
  export function homedir(): string;
  export function tmpdir(): string;
  export function platform(): string;
  export function arch(): string;
  export function cpus(): any[];
  export function totalmem(): number;
  export function freemem(): number;
}
declare module 'http' {
  export function createServer(handler: (req: any, res: any) => void): any;
}
declare module 'https' {
  export function createServer(opts: object, handler: (req: any, res: any) => void): any;
}
declare module 'events' {
  export class EventEmitter {
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    removeAllListeners(event?: string): this;
  }
}
declare module 'crypto' {
  export function randomUUID(): string;
  export function createHash(algo: string): { update(data: string): { digest(enc: string): string; }; };
  export function randomBytes(n: number): Buffer;
}
declare module 'child_process' {
  export function exec(cmd: string, cb: (err: Error | null, stdout: string, stderr: string) => void): any;
  export function spawn(cmd: string, args: string[], opts?: object): any;
  export function execSync(cmd: string, opts?: object): Buffer;
}
`;

  // Inject into both JS and TS defaults
  try {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(nodeDeclarations, 'ts:noter-node.d.ts');
    monaco.languages.typescript.typescriptDefaults.addExtraLib(nodeDeclarations, 'ts:noter-node.d.ts');
  } catch (_) {}

  // ── Node.js API completion items ──────────────────────────────────────
  const _nodeItems = [
    // fs module patterns
    { label: 'fs.readFileSync', detail: 'Node.js fs', insertText: "fs.readFileSync('${1:path}', 'utf-8')" },
    { label: 'fs.writeFileSync', detail: 'Node.js fs', insertText: "fs.writeFileSync('${1:path}', ${2:data})" },
    { label: 'fs.existsSync', detail: 'Node.js fs', insertText: "fs.existsSync('${1:path}')" },
    { label: 'fs.promises.readFile', detail: 'Node.js async fs', insertText: "await fs.promises.readFile('${1:path}', 'utf-8')" },
    { label: 'fs.promises.writeFile', detail: 'Node.js async fs', insertText: "await fs.promises.writeFile('${1:path}', ${2:data})" },
    { label: 'fs.promises.readdir', detail: 'Node.js async fs', insertText: "await fs.promises.readdir('${1:path}')" },
    // path module
    { label: 'path.join', detail: 'Node.js path', insertText: "path.join(${1:__dirname}, '${2:file}')" },
    { label: 'path.resolve', detail: 'Node.js path', insertText: "path.resolve('${1:dir}', '${2:file}')" },
    { label: 'path.dirname', detail: 'Node.js path', insertText: "path.dirname(${1:filePath})" },
    { label: 'path.basename', detail: 'Node.js path', insertText: "path.basename(${1:filePath})" },
    { label: 'path.extname', detail: 'Node.js path', insertText: "path.extname(${1:filePath})" },
    // process
    { label: 'process.env', detail: 'Node.js process', insertText: 'process.env.${1:VAR}' },
    { label: 'process.argv', detail: 'Node.js process', insertText: 'process.argv.slice(2)' },
    { label: 'process.exit', detail: 'Node.js process', insertText: 'process.exit(${1:0})' },
    { label: 'process.cwd', detail: 'Node.js process', insertText: 'process.cwd()' },
  ];

  // ── DOM API completion items ─────────────────────────────────────────
  const _domItems = [
    { label: 'document.querySelector', detail: 'DOM', insertText: "document.querySelector('${1:selector}')" },
    { label: 'document.querySelectorAll', detail: 'DOM', insertText: "document.querySelectorAll('${1:selector}')" },
    { label: 'document.getElementById', detail: 'DOM', insertText: "document.getElementById('${1:id}')" },
    { label: 'document.createElement', detail: 'DOM', insertText: "document.createElement('${1:div}')" },
    { label: 'document.addEventListener', detail: 'DOM', insertText: "document.addEventListener('${1:DOMContentLoaded}', () => {\n\t${2}\n});" },
    { label: 'el.classList.add', detail: 'DOM classList', insertText: "${1:el}.classList.add('${2:class}')" },
    { label: 'el.classList.remove', detail: 'DOM classList', insertText: "${1:el}.classList.remove('${2:class}')" },
    { label: 'el.classList.toggle', detail: 'DOM classList', insertText: "${1:el}.classList.toggle('${2:class}')" },
    { label: 'el.classList.contains', detail: 'DOM classList', insertText: "${1:el}.classList.contains('${2:class}')" },
    { label: 'el.setAttribute', detail: 'DOM attr', insertText: "${1:el}.setAttribute('${2:name}', ${3:value})" },
    { label: 'el.getAttribute', detail: 'DOM attr', insertText: "${1:el}.getAttribute('${2:name}')" },
    { label: 'el.addEventListener', detail: 'DOM event', insertText: "${1:el}.addEventListener('${2:click}', (${3:e}) => {\n\t${4}\n});" },
    { label: 'el.removeEventListener', detail: 'DOM event', insertText: "${1:el}.removeEventListener('${2:click}', ${3:handler})" },
    { label: 'el.appendChild', detail: 'DOM mutation', insertText: "${1:parent}.appendChild(${2:child})" },
    { label: 'el.insertBefore', detail: 'DOM mutation', insertText: "${1:parent}.insertBefore(${2:newEl}, ${3:ref})" },
    { label: 'el.removeChild', detail: 'DOM mutation', insertText: "${1:parent}.removeChild(${2:child})" },
    { label: 'el.innerHTML', detail: 'DOM prop', insertText: "${1:el}.innerHTML = '${2:html}'" },
    { label: 'el.textContent', detail: 'DOM prop', insertText: "${1:el}.textContent = '${2:text}'" },
    { label: 'window.localStorage.setItem', detail: 'Storage', insertText: "localStorage.setItem('${1:key}', JSON.stringify(${2:value}))" },
    { label: 'window.localStorage.getItem', detail: 'Storage', insertText: "JSON.parse(localStorage.getItem('${1:key}') || '${2:null}')" },
    { label: 'window.localStorage.removeItem', detail: 'Storage', insertText: "localStorage.removeItem('${1:key}')" },
    { label: 'fetch', detail: 'Fetch API', insertText: "const ${1:res} = await fetch('${2:url}', {\n\tmethod: '${3:GET}',\n\theaders: { 'Content-Type': 'application/json' },\n${4:\tbody: JSON.stringify(${5:data}),}\n});\nconst ${6:data} = await ${1:res}.json();" },
    { label: 'navigator.geolocation.getCurrentPosition', detail: 'Geolocation', insertText: "navigator.geolocation.getCurrentPosition(\n\t(${1:pos}) => {\n\t\tconst { latitude, longitude } = ${1:pos}.coords;\n\t\t${2}\n\t},\n\t(${3:err}) => console.error(${3:err})\n);" },
  ];

  // ── Express.js patterns ──────────────────────────────────────────────
  const _expressItems = [
    { label: 'express.app', detail: 'Express setup', insertText: "const express = require('express');\nconst app = express();\n\napp.use(express.json());\n\napp.listen(${1:3000}, () => console.log('Server on port ${1:3000}'));" },
    { label: 'app.get', detail: 'Express GET', insertText: "app.get('${1:/path}', async (req, res) => {\n\ttry {\n\t\tres.json({ ${2:ok: true} });\n\t} catch (err) {\n\t\tres.status(500).json({ error: err.message });\n\t}\n});" },
    { label: 'app.post', detail: 'Express POST', insertText: "app.post('${1:/path}', async (req, res) => {\n\tconst { ${2:data} } = req.body;\n\tres.status(201).json({ ${3:id: 1} });\n});" },
    { label: 'app.put', detail: 'Express PUT', insertText: "app.put('${1:/path/:id}', async (req, res) => {\n\tconst { id } = req.params;\n\tres.json({ id });\n});" },
    { label: 'app.delete', detail: 'Express DELETE', insertText: "app.delete('${1:/path/:id}', async (req, res) => {\n\tres.json({ deleted: true });\n});" },
    { label: 'express.router', detail: 'Express Router', insertText: "const router = express.Router();\n\nrouter.get('/', (req, res) => res.json({ ok: true }));\n\nmodule.exports = router;" },
    { label: 'express.middleware', detail: 'Express middleware', insertText: "const ${1:auth} = (req, res, next) => {\n\t${2:// validate}\n\tnext();\n};" },
  ];

  // ── Register custom JS completion provider ───────────────────────────
  const allItems = [..._nodeItems, ..._domItems, ..._expressItems];
  const JS_LANGS = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];

  JS_LANGS.forEach(lang => {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['.', "'", '"'],
      provideCompletionItems(model, position) {
        const word  = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn,
        };
        return {
          suggestions: allItems.map(item => ({
            label: item.label,
            kind:  monaco.languages.CompletionItemKind.Function,
            detail: item.detail,
            insertText: item.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: 'b' + item.label,
            range,
          })),
        };
      },
    });
  });

  // ── Index currently-open documents ─────────────────────────────────
  if (typeof TabManager !== 'undefined' && typeof IntelliSense !== 'undefined') {
    TabManager.tabs.forEach(tab => {
      if (tab.model && tab.filePath) {
        IntelliSense.indexDocument(tab.filePath, tab.model.getValue(), tab.language);
      }
    });

    // Index on model change (debounced)
    const _indexDebounce = new Map();
    if (window.editor) {
      window.editor.onDidChangeModelContent(() => {
        const activeTab = typeof TabManager !== 'undefined' ? TabManager.getActive() : null;
        if (!activeTab?.filePath) return;
        clearTimeout(_indexDebounce.get(activeTab.filePath));
        _indexDebounce.set(activeTab.filePath, setTimeout(() => {
          const model = window.editor.getModel();
          if (model && typeof IntelliSense !== 'undefined') {
            IntelliSense.indexDocument(activeTab.filePath, model.getValue(), activeTab.language);
          }
        }, 1500));
      });
    }
  }

  ctx.toast?.('JavaScript IntelliSense Pro active', 'info');
}
