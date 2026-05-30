// ─── Python Power ────────────────────────────────────────────────
(window._exts = window._exts || {})['python-power'] = (() => {
  'use strict';
  let _ctx, _disposables = [];

  const SNIPS = [
    { label:'main',     detail:'main guard',      insertText:'def main():\n    ${1:pass}\n\nif __name__ == "__main__":\n    main()' },
    { label:'defn',     detail:'function def',    insertText:'def ${1:func}(${2:args}):\n    """${3:docstring}"""\n    ${4:pass}' },
    { label:'cls',      detail:'class',           insertText:'class ${1:MyClass}:\n    def __init__(self${2:, args}):\n        ${3:pass}' },
    { label:'dc',       detail:'dataclass',       insertText:'from dataclasses import dataclass\n\n@dataclass\nclass ${1:MyClass}:\n    ${2:field}: ${3:str}' },
    { label:'try',      detail:'try/except',      insertText:'try:\n    ${1:pass}\nexcept ${2:Exception} as e:\n    ${3:print(e)}' },
    { label:'ctx',      detail:'context manager', insertText:'with ${1:open("${2:file.txt}")} as ${3:f}:\n    ${4:data = f.read()}' },
    { label:'lc',       detail:'list comprehension', insertText:'[${1:expr} for ${2:item} in ${3:iterable}${4: if ${5:condition}}]' },
    { label:'dc2',      detail:'dict comprehension', insertText:'{${1:k}: ${2:v} for ${3:k}, ${4:v} in ${5:items}}' },
    { label:'async',    detail:'async function',  insertText:'async def ${1:func}(${2:args}):\n    ${3:await ${4:coroutine}}' },
    { label:'dec',      detail:'decorator',       insertText:'def ${1:decorator}(func):\n    def wrapper(*args, **kwargs):\n        ${2:# before}\n        result = func(*args, **kwargs)\n        ${3:# after}\n        return result\n    return wrapper' },
    { label:'pprint',   detail:'pretty print',    insertText:'from pprint import pprint\npprint(${1:obj})' },
    { label:'argparse', detail:'argparse setup',  insertText:'import argparse\nparser = argparse.ArgumentParser(description="${1:desc}")\nparser.add_argument("${2:arg}", help="${3:help}")\nargs = parser.parse_args()' },
  ];

  function _venvPanel() {
    const ws = _ctx?.getWorkspace()?.replace(/\\/g,'/');
    const id = 'ext-py-panel';
    document.getElementById(id)?.remove();
    const panel = _ctx.openPanel(id, 'Python Power', `
      <div class="dash-section">
        <div class="dash-section-title">Environment</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="dash-action-btn" data-cmd="python -m venv venv">🐍 Create venv</button>
          <button class="dash-action-btn" data-cmd="venv\\Scripts\\activate">▶ Activate venv (Windows)</button>
          <button class="dash-action-btn" data-cmd="source venv/bin/activate">▶ Activate venv (Mac/Linux)</button>
          <button class="dash-action-btn" data-cmd="pip install -r requirements.txt">📦 pip install -r requirements.txt</button>
          <button class="dash-action-btn" data-cmd="pip list">📋 pip list</button>
          <button class="dash-action-btn" data-cmd="pip freeze > requirements.txt">💾 pip freeze → requirements.txt</button>
        </div>
      </div>
      <div class="dash-section">
        <div class="dash-section-title">Run</div>
        <button class="dash-action-btn" id="_py_run">▶ Run current file</button>
      </div>
    `, { icon: '🐍' });

    panel.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const prefix = ws ? `cd "${ws}" && ` : '';
        _ctx.runInTerminal(prefix + btn.dataset.cmd); panel.remove();
      });
    });
    panel.querySelector('#_py_run').onclick = () => {
      const fp = _ctx?.getFilePath();
      if (fp) { _ctx.runInTerminal(`python "${fp}"`); panel.remove(); }
      else _ctx.toast('No Python file open', 'info');
    };
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({ id:'ext-py-btn', icon:'🐍', label:'Python',
      title:'Python Power — venv, pip, run', languages:['python'], run:_venvPanel });
    _disposables.push(
      monaco.languages.registerCompletionItemProvider('python', {
        provideCompletionItems(model, pos) {
          const word = model.getWordUntilPosition(pos);
          const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber,
                          startColumn:word.startColumn, endColumn:word.endColumn };
          return { suggestions: SNIPS.map(s => ({
            label:s.label, kind:monaco.languages.CompletionItemKind.Snippet,
            detail:'🐍 '+s.detail, insertText:s.insertText,
            insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range,
          })) };
        },
      })
    );
  }

  function deactivate() {
    _disposables.forEach(d=>d.dispose()); _disposables=[];
    document.getElementById('ext-py-btn')?.remove();
  }

  function getQuickStart() {
    return {
      icon:'🐍', title:'Python Power', subtitle:'Snippets, venv management, and one-click run',
      steps:[
        { title:'Insert Snippets', desc:'In any .py file type <kbd>main</kbd>, <kbd>defn</kbd>, <kbd>cls</kbd>, <kbd>try</kbd>, <kbd>lc</kbd>, etc. and press Tab.' },
        { title:'Open Python Panel', desc:'Click <strong>🐍 Python</strong> toolbar button (visible in .py files) for venv creation, pip commands, and run.' },
        { title:'Run Python File', desc:'In the panel click <strong>▶ Run current file</strong>, or use Code Runner with <kbd>Ctrl+Alt+N</kbd>.' },
      ],
      shortcuts:[{ keys:'Ctrl+Alt+N', desc:'Run current Python file' }],
      commands:[{ name:'python.panel', desc:'Open Python Power panel' }],
      tips:['The toolbar button is only visible when a .py file is active.'],
      onStart:_venvPanel,
    };
  }
  return { id:'python-power', activate, deactivate, getQuickStart, commands:[{ id:'python.panel', label:'Python Power: Open Panel', run:_venvPanel }] };
})();
