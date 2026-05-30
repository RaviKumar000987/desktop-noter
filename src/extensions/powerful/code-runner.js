// ─── Code Runner ─────────────────────────────────────────────────
// Run 15+ languages directly from the editor. Save → Run in terminal.

(window._exts = window._exts || {})['code-runner'] = (() => {
  'use strict';

  const RUNNERS = {
    javascript: fp => `node "${fp}"`,
    typescript: fp => `npx ts-node "${fp}"`,
    python:     fp => `python "${fp}"`,
    java:       fp => {
      const dir  = fp.replace(/[^/\\]+$/, '').replace(/\\/g,'/');
      const cls  = fp.split(/[/\\]/).pop().replace('.java','');
      return `javac "${fp}" && java -cp "${dir}" ${cls}`;
    },
    c:          fp => `gcc "${fp}" -o "${fp.replace(/\.[^.]+$/,'')}" && "${fp.replace(/\.[^.]+$/,'')}"`,
    cpp:        fp => `g++ -std=c++17 "${fp}" -o "${fp.replace(/\.[^.]+$/,'')}" && "${fp.replace(/\.[^.]+$/,'')}"`,
    rust:       fp => `rustc "${fp}" -o "${fp.replace(/\.[^.]+$/,'')}" && "${fp.replace(/\.[^.]+$/,'')}"`,
    go:         fp => `go run "${fp}"`,
    shell:      fp => `bash "${fp}"`,
    php:        fp => `php "${fp}"`,
    ruby:       fp => `ruby "${fp}"`,
    csharp:     fp => `dotnet-script "${fp}"`,
    kotlin:     fp => `kotlinc "${fp}" -include-runtime -d out.jar && java -jar out.jar`,
    swift:      fp => `swift "${fp}"`,
    lua:        fp => `lua "${fp}"`,
  };

  const RUNNABLE = new Set(Object.keys(RUNNERS));

  let _ctx;

  function _run() {
    const tab  = TabManager?.getActive();
    if (!tab) { _ctx?.toast('No active file', 'error'); return; }
    if (!tab.filePath) { _ctx?.toast('Save the file first before running', 'info'); return; }

    const lang = tab.language;
    const fp   = tab.filePath;
    const make = RUNNERS[lang];

    if (!make) { _ctx?.toast(`No runner for: ${lang}`, 'info'); return; }

    const run = () => {
      _ctx.runInTerminal(make(fp));
      _ctx.toast(`Running ${tab.title}…`, 'info', 1800);
    };

    if (tab.isModified) {
      actions?.saveFile().then?.(run) ?? run();
    } else {
      run();
    }
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({
      id:        'ext-run-btn',
      icon:      '▶',
      label:     'Run',
      title:     'Run current file (Code Runner)  Ctrl+Alt+N',
      languages: [...RUNNABLE],
      run:       _run,
    });

    // Ctrl+Alt+N
    document.addEventListener('keydown', _onKey);
    document.addEventListener('monaco-ready', _monacoReady);
  }

  function _onKey(e) {
    if (e.ctrlKey && e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault(); _run();
    }
  }

  function _monacoReady() {
    window.editor?.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyN,
      _run
    );
  }

  function deactivate() {
    document.removeEventListener('keydown', _onKey);
    document.getElementById('ext-run-btn')?.remove();
  }

  function getQuickStart() {
    return {
      icon: '▶',
      title: 'Code Runner',
      subtitle: 'Run 15+ languages directly from the editor',
      steps: [
        {
          title: 'Run Current File',
          desc: 'Press <kbd>Ctrl+Alt+N</kbd> or click the <strong>▶ Run</strong> button in the toolbar.',
        },
        {
          title: 'Supported Languages',
          desc: 'JS, TS, Python, Java, C, C++, Rust, Go, PHP, Ruby, Shell, Kotlin, Swift, Lua, C#',
        },
        {
          title: 'Auto-Save Before Run',
          desc: 'If your file has unsaved changes, Code Runner saves automatically before running.',
        },
      ],
      shortcuts: [
        { keys: 'Ctrl+Alt+N', desc: 'Run Current File' },
        { keys: '▶ toolbar',  desc: 'Run button (visible for runnable languages)' },
      ],
      commands: [
        { name: 'code-runner.run', desc: 'Run the current file in the integrated terminal' },
      ],
      tips: [
        'The Run button dims for non-runnable file types — this is normal.',
        'Output appears in the integrated terminal below the editor.',
      ],
      onStart: _run,
    };
  }

  return {
    id: 'code-runner',
    activate, deactivate, getQuickStart,
    commands: [{ id: 'code-runner.run', label: 'Code Runner: Run File', run: _run }],
  };
})();
