// ─── C/C++ Toolkit ───────────────────────────────────────────────
(window._exts = window._exts || {})['cpp-toolkit'] = (() => {
  'use strict';
  let _ctx, _disposables = [];

  const SNIPS_CPP = [
    { label:'main',    detail:'main function',      insertText:'#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    ${1:// your code}\n    \n    return 0;\n}' },
    { label:'forn',    detail:'for loop 0..n',       insertText:'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}' },
    { label:'forr',    detail:'for range loop',       insertText:'for (auto& ${1:item} : ${2:container}) {\n    ${3}\n}' },
    { label:'sort',    detail:'sort vector',          insertText:'sort(${1:v}.begin(), ${1:v}.end()${2:, [](auto& a, auto& b){ return a < b; }});' },
    { label:'pb',      detail:'push_back',            insertText:'${1:v}.push_back(${2:val});' },
    { label:'vint',    detail:'vector<int>',          insertText:'vector<int> ${1:v}(${2:n}, ${3:0});' },
    { label:'pq',      detail:'priority_queue',       insertText:'priority_queue<${1:int}> ${2:pq};  // max-heap\n// priority_queue<int, vector<int>, greater<int>> pq; // min-heap' },
    { label:'map',     detail:'unordered_map',        insertText:'unordered_map<${1:string}, ${2:int}> ${3:mp};' },
    { label:'set',     detail:'unordered_set',        insertText:'unordered_set<${1:int}> ${2:st};' },
    { label:'pair',    detail:'pair',                 insertText:'pair<${1:int}, ${2:int}> ${3:p} = {${4:a}, ${5:b}};' },
    { label:'lambda',  detail:'lambda function',      insertText:'auto ${1:fn} = [${2:&}](${3:int x}) -> ${4:int} {\n    return ${5:x};\n};' },
    { label:'gcd',     detail:'GCD using __gcd',      insertText:'int g = __gcd(${1:a}, ${2:b});' },
    { label:'lcm',     detail:'LCM',                  insertText:'long long l = (long long)${1:a} / __gcd(${1:a}, ${2:b}) * ${2:b};' },
    { label:'debug',   detail:'debug macro',          insertText:'#define DEBUG(x) cerr << #x << " = " << x << "\\n"' },
    { label:'yes',     detail:'YES/NO output',        insertText:'cout << (${1:condition} ? "YES" : "NO") << "\\n";' },
  ];

  function _compileRun() {
    const fp = _ctx?.getFilePath(); if (!fp) { _ctx?.toast('No C/C++ file open','info'); return; }
    const ext  = fp.split('.').pop().toLowerCase();
    const out  = fp.replace(/\.[^.]+$/, process.platform==='win32'?'.exe':'');
    const comp = ext==='c' ? `gcc "${fp}" -o "${out}" -Wall` : `g++ -std=c++17 "${fp}" -o "${out}" -Wall`;
    _ctx.runInTerminal(`${comp} && echo "Compiled OK" && "${out}"`);
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({ id:'ext-cpp-btn', icon:'🔵', label:'Build & Run',
      title:'C/C++ Toolkit — compile and run', languages:['c','cpp'], run:_compileRun });
    ['c','cpp'].forEach(lang => _disposables.push(
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems(model, pos) {
          const word = model.getWordUntilPosition(pos);
          const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber, startColumn:word.startColumn, endColumn:word.endColumn };
          return { suggestions: SNIPS_CPP.map(s => ({ label:s.label, kind:monaco.languages.CompletionItemKind.Snippet, detail:'🔵 C++ — '+s.detail, insertText:s.insertText, insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range })) };
        },
      })
    ));
    document.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && (e.key==='R'||e.key==='r') && ['c','cpp'].includes(ctx.getLang())) { e.preventDefault(); _compileRun(); } });
  }

  function deactivate() { _disposables.forEach(d=>d.dispose()); _disposables=[]; document.getElementById('ext-cpp-btn')?.remove(); }

  function getQuickStart() {
    return {
      icon:'🔵', title:'C/C++ Toolkit', subtitle:'Compile & run C/C++ with 15 competitive programming snippets',
      steps:[
        { title:'Compile & Run', desc:'Open a <code>.c</code> or <code>.cpp</code> file. Click <strong>🔵 Build & Run</strong> toolbar button or press <kbd>Ctrl+Shift+R</kbd>.' },
        { title:'Snippets', desc:'Type <kbd>main</kbd> for competitive programming boilerplate, <kbd>forn</kbd> for a for-loop, <kbd>pq</kbd> for priority_queue, etc.' },
        { title:'Boilerplate', desc:'The <kbd>main</kbd> snippet includes <code>bits/stdc++.h</code>, fast I/O, and <code>using namespace std</code> — competition-ready.' },
      ],
      shortcuts:[{ keys:'Ctrl+Shift+R', desc:'Compile and run C/C++ file' }],
      commands:[{ name:'cpp.run', desc:'Compile and run current C/C++ file' }],
      tips:['Requires GCC/G++ to be installed and in PATH.','Use the DSA Forge extension for algorithm snippets in C++.'],
      onStart:_compileRun,
    };
  }
  return { id:'cpp-toolkit', activate, deactivate, getQuickStart, commands:[{ id:'cpp.run', label:'C/C++: Compile & Run', run:_compileRun }] };
})();
