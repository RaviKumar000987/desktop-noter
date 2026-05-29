// ─── .NET Runner ─────────────────────────────────────────────────
(window._exts = window._exts || {})['dotnet-runner'] = (() => {
  'use strict';
  let _ctx, _disposables = [];

  const SNIPS_CS = [
    { label:'ns',       detail:'namespace + class', insertText:'namespace ${1:MyApp};\n\npublic class ${2:Program}\n{\n    ${3}\n}' },
    { label:'main',     detail:'Main entry point',  insertText:'static void Main(string[] args)\n{\n    ${1:Console.WriteLine("Hello, World!");}\n}' },
    { label:'prop',     detail:'auto property',     insertText:'public ${1:string} ${2:Name} { get; set; }' },
    { label:'ctor',     detail:'constructor',       insertText:'public ${1:ClassName}(${2:params})\n{\n    ${3}\n}' },
    { label:'async',    detail:'async method',      insertText:'public async Task<${1:string}> ${2:Method}(${3:params})\n{\n    ${4:await Task.Delay(0);}\n    return ${5:result};\n}' },
    { label:'linq',     detail:'LINQ query',        insertText:'var ${1:result} = ${2:collection}\n    .Where(${3:x => x.Id > 0})\n    .Select(${4:x => x.Name})\n    .ToList();' },
    { label:'record',   detail:'record type',       insertText:'public record ${1:MyRecord}(${2:string Name}, ${3:int Age});' },
    { label:'try',      detail:'try/catch',         insertText:'try\n{\n    ${1}\n}\ncatch (${2:Exception} ex)\n{\n    Console.WriteLine(ex.Message);\n}' },
    { label:'sw',       detail:'switch expression', insertText:'var ${1:result} = ${2:value} switch\n{\n    ${3:1} => "${4:one}",\n    _ => "${5:other}",\n};' },
    { label:'null',     detail:'null-coalescing',   insertText:'${1:value} ?? ${2:defaultValue}' },
    { label:'pattern',  detail:'pattern matching',  insertText:'if (${1:obj} is ${2:MyType} ${3:t})\n{\n    ${4:Console.WriteLine(t);}\n}' },
    { label:'inject',   detail:'DI constructor',    insertText:'private readonly ${1:IService} _${2:service};\n\npublic ${3:MyClass}(${1:IService} ${2:service})\n{\n    _${2:service} = ${2:service};\n}' },
  ];

  function _dotnetPanel() {
    const ws = _ctx?.getWorkspace()?.replace(/\\/g, '/');
    const id = 'ext-dotnet-panel';
    document.getElementById(id)?.remove();
    const panel = _ctx.openPanel(id, '.NET Runner', `
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="dash-action-btn" data-cmd="dotnet run">▶ dotnet run</button>
        <button class="dash-action-btn" data-cmd="dotnet build">🏗 dotnet build</button>
        <button class="dash-action-btn" data-cmd="dotnet test">🧪 dotnet test</button>
        <button class="dash-action-btn" data-cmd="dotnet restore">📦 dotnet restore</button>
        <button class="dash-action-btn" data-cmd="dotnet --version">ℹ dotnet --version</button>
      </div>
    `, { icon: '💜' });
    panel.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const prefix = ws ? `cd "${ws}" && ` : '';
        _ctx.runInTerminal(prefix + btn.dataset.cmd); panel.remove();
      });
    });
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({ id:'ext-dotnet-btn', icon:'💜', label:'.NET', title:'.NET Runner', languages:['csharp'], run:_dotnetPanel });
    _disposables.push(
      monaco.languages.registerCompletionItemProvider('csharp', {
        provideCompletionItems(model, pos) {
          const word = model.getWordUntilPosition(pos);
          const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber, startColumn:word.startColumn, endColumn:word.endColumn };
          return { suggestions: SNIPS_CS.map(s => ({ label:s.label, kind:monaco.languages.CompletionItemKind.Snippet, detail:'💜 C# — '+s.detail, insertText:s.insertText, insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range })) };
        },
      })
    );
  }

  function deactivate() { _disposables.forEach(d=>d.dispose()); _disposables=[]; document.getElementById('ext-dotnet-btn')?.remove(); }

  function getQuickStart() {
    return {
      icon:'💜', title:'.NET Runner', subtitle:'dotnet build/run/test with 12 C# snippets',
      steps:[
        { title:'Run .NET Project', desc:'Click <strong>💜 .NET</strong> toolbar button (visible in .cs files) to open the .NET command panel.' },
        { title:'C# Snippets', desc:'Type <kbd>prop</kbd>, <kbd>async</kbd>, <kbd>linq</kbd>, <kbd>record</kbd>, <kbd>sw</kbd> and Tab for modern C# patterns.' },
        { title:'Commands', desc:'dotnet run, build, test, and restore are one click away in the panel.' },
      ],
      shortcuts:[{ keys:'💜 toolbar (C# files)', desc:'Open .NET Runner panel' }],
      commands:[{ name:'dotnet.panel', desc:'Open .NET Runner panel' }],
      tips:['Requires .NET SDK to be installed.'],
      onStart:_dotnetPanel,
    };
  }
  return { id:'dotnet-runner', activate, deactivate, getQuickStart, commands:[{ id:'dotnet.panel', label:'.NET Runner: Open Panel', run:_dotnetPanel }] };
})();
