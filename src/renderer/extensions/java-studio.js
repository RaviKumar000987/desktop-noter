// ─── Java Studio ─────────────────────────────────────────────────
(window._exts = window._exts || {})['java-studio'] = (() => {
  'use strict';
  let _ctx, _disposables = [];

  const SNIPS = [
    { label:'main',      detail:'public static void main', insertText:'public static void main(String[] args) {\n    ${1:System.out.println("Hello, World!");}\n}' },
    { label:'sout',      detail:'System.out.println',      insertText:'System.out.println(${1});' },
    { label:'soutv',     detail:'print variable',           insertText:'System.out.println("${1:var} = " + ${1:var});' },
    { label:'psvm',      detail:'class with main',          insertText:'public class ${1:Main} {\n    public static void main(String[] args) {\n        ${2}\n    }\n}' },
    { label:'fori',      detail:'for i loop',               insertText:'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}' },
    { label:'foreach',   detail:'enhanced for',             insertText:'for (${1:String} ${2:item} : ${3:collection}) {\n    ${4}\n}' },
    { label:'try',       detail:'try-catch',                insertText:'try {\n    ${1}\n} catch (${2:Exception} e) {\n    e.printStackTrace();\n}' },
    { label:'iface',     detail:'interface',                insertText:'public interface ${1:MyInterface} {\n    ${2:void method();};\n}' },
    { label:'lambda',    detail:'lambda',                   insertText:'(${1:x}) -> ${2:x * 2}' },
    { label:'stream',    detail:'stream filter/map',        insertText:'${1:list}.stream()\n    .filter(${2:x -> x > 0})\n    .map(${3:x -> x * 2})\n    .collect(Collectors.toList())' },
    { label:'opt',       detail:'Optional',                 insertText:'Optional<${1:String}> ${2:opt} = Optional.ofNullable(${3:value});\n${2:opt}.ifPresent(v -> ${4:System.out.println(v)});' },
    { label:'hashmap',   detail:'HashMap',                  insertText:'Map<${1:String}, ${2:Integer}> ${3:map} = new HashMap<>();' },
    { label:'arraylist', detail:'ArrayList',                insertText:'List<${1:String}> ${2:list} = new ArrayList<>();' },
  ];

  function _compileRun() {
    const fp = _ctx?.getFilePath(); if (!fp) { _ctx?.toast('No Java file open','info'); return; }
    const dir  = fp.replace(/[^/\\]+$/, '');
    const cls  = fp.split(/[/\\]/).pop().replace('.java','');
    _ctx.runInTerminal(`javac "${fp}" && java -cp "${dir}" ${cls}`);
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({ id:'ext-java-btn', icon:'☕', label:'Run Java', title:'Java Studio — compile & run', languages:['java'], run:_compileRun });
    _disposables.push(
      monaco.languages.registerCompletionItemProvider('java', {
        provideCompletionItems(model, pos) {
          const word = model.getWordUntilPosition(pos);
          const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber, startColumn:word.startColumn, endColumn:word.endColumn };
          return { suggestions: SNIPS.map(s => ({ label:s.label, kind:monaco.languages.CompletionItemKind.Snippet, detail:'☕ '+s.detail, insertText:s.insertText, insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range })) };
        },
      })
    );
  }

  function deactivate() { _disposables.forEach(d=>d.dispose()); _disposables=[]; document.getElementById('ext-java-btn')?.remove(); }

  function getQuickStart() {
    return {
      icon:'☕', title:'Java Studio', subtitle:'Compile & run Java with 13 productivity snippets',
      steps:[
        { title:'Compile & Run', desc:'Open a <code>.java</code> file and click <strong>☕ Run Java</strong> in the toolbar.' },
        { title:'Snippets', desc:'Type <kbd>psvm</kbd> for a class with main, <kbd>sout</kbd> for println, <kbd>stream</kbd> for stream API, etc.' },
        { title:'Maven/Gradle', desc:'Use the terminal to run <code>mvn compile</code>, <code>mvn exec:java</code>, or <code>gradle run</code>.' },
      ],
      shortcuts:[{ keys:'☕ toolbar button', desc:'Compile and run Java file' }],
      commands:[{ name:'java.run', desc:'Compile and run current Java file' }],
      tips:['Requires JDK to be installed and in PATH.'],
      onStart:_compileRun,
    };
  }
  return { id:'java-studio', activate, deactivate, getQuickStart, commands:[{ id:'java.run', label:'Java Studio: Compile & Run', run:_compileRun }] };
})();
