// ═══════════════════════════════════════════════════════════════
//  COMMAND PALETTE — command-palette.js
//  Open  :  Ctrl + Shift + P
//  Deps  :  app.js globals (actions, TabManager, toggleSidebar …)
//           terminal.js, split-editor.js, global-search.js
// ═══════════════════════════════════════════════════════════════

const CommandPalette = (() => {
  // ── Full command list ────────────────────────────────────────
  // `fn` is evaluated lazily so forward-refs to other modules work
  const COMMANDS = [
    {
      label: "New File / Tab",
      shortcut: "Ctrl+N",
      fn: () => actions.newFile(),
    },
    { label: "Open File…", shortcut: "Ctrl+O", fn: () => actions.openFile() },
    { label: "Open Folder…", shortcut: "", fn: () => actions.openFolder() },
    { label: "Save", shortcut: "Ctrl+S", fn: () => actions.saveFile() },
    {
      label: "Save As…",
      shortcut: "Ctrl+Shift+S",
      fn: () => actions.saveAsFile(),
    },
    { label: "New Workspace",   shortcut: "", fn: () => createWorkspace() },
    { label: "Save Workspace",  shortcut: "", fn: () => saveWorkspace() },
    { label: "Open Workspace…", shortcut: "", fn: () => openWorkspace() },
    {
      label: "Close Tab",
      shortcut: "Ctrl+W",
      fn: () => {
        const t = TabManager.getActive();
        if (t) TabManager.close(t.id);
      },
    },
    { label: "Undo", shortcut: "Ctrl+Z", fn: () => actions.undo() },
    { label: "Redo", shortcut: "Ctrl+Y", fn: () => actions.redo() },
    { label: "Cut", shortcut: "Ctrl+X", fn: () => actions.cut() },
    { label: "Copy", shortcut: "Ctrl+C", fn: () => actions.copy() },
    { label: "Paste", shortcut: "Ctrl+V", fn: () => actions.paste() },
    { label: "Select All", shortcut: "Ctrl+A", fn: () => actions.selectAll() },
    {
      label: "Duplicate Line",
      shortcut: "Ctrl+D",
      fn: () => actions.duplicateLine(),
    },
    { label: "Find", shortcut: "Ctrl+F", fn: () => actions.find() },
    {
      label: "Find & Replace",
      shortcut: "Ctrl+H",
      fn: () => actions.replace(),
    },
    { label: "Toggle Explorer", shortcut: "Ctrl+B", fn: () => toggleSidebar() },
    {
      label: "Toggle Word Wrap",
      shortcut: "",
      fn: () => actions.toggleWordWrap(),
    },
    { label: "Zoom In", shortcut: "Ctrl++", fn: () => actions.zoomIn() },
    { label: "Zoom Out", shortcut: "Ctrl+-", fn: () => actions.zoomOut() },
    { label: "Reset Zoom", shortcut: "Ctrl+0", fn: () => actions.resetZoom() },
    {
      label: "Toggle Terminal",
      shortcut: "Ctrl+J",
      fn: () => TerminalPanel.toggle(),
    },
    {
      label: "Toggle Split Editor",
      shortcut: "Ctrl+\\",
      fn: () => SplitEditor.toggle(),
    },
    {
      label: "Global Search",
      shortcut: "Ctrl+Shift+F",
      fn: () => GlobalSearch.show(),
    },
    { label: "Quit", shortcut: "", fn: () => window.electronAPI.quit() },
  ];

  let filtered = [...COMMANDS];
  let selIdx = 0;
  let built = false;

  // ── Build DOM once ───────────────────────────────────────────
  function build() {
    if (built) return;
    built = true;

    const overlay = document.createElement("div");
    overlay.id = "cp-overlay";
    overlay.innerHTML = `
      <div id="cp-box">
        <div id="cp-header">
          <span>⌘ Command Palette</span>
          <kbd>Esc to close</kbd>
        </div>
        <input id="cp-input" type="text" placeholder="Type to search commands…"
               autocomplete="off" spellcheck="false"/>
        <div id="cp-list"></div>
      </div>`;

    // Click outside → close
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) hide();
    });

    document.body.appendChild(overlay);

    document.getElementById("cp-input").addEventListener("input", filterList);
    document.getElementById("cp-input").addEventListener("keydown", onKey);
  }

  // ── Filter ───────────────────────────────────────────────────
  function filterList() {
    const q = (document.getElementById("cp-input")?.value || "")
      .trim()
      .toLowerCase();
    filtered = q
      ? COMMANDS.filter((c) => c.label.toLowerCase().includes(q))
      : [...COMMANDS];
    selIdx = 0;
    render();
  }

  // ── Render list ──────────────────────────────────────────────
  function render() {
    const list = document.getElementById("cp-list");
    if (!list) return;
    list.innerHTML = "";

    if (filtered.length === 0) {
      list.innerHTML = `<div class="cp-empty">No commands found</div>`;
      return;
    }

    filtered.forEach((cmd, i) => {
      const el = document.createElement("div");
      el.className = "cp-item" + (i === selIdx ? " cp-sel" : "");
      el.innerHTML =
        `<span class="cp-label">${cmd.label}</span>` +
        (cmd.shortcut
          ? `<span class="cp-shortcut">${cmd.shortcut}</span>`
          : "");
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        run(i);
      });
      el.addEventListener("mouseover", () => {
        selIdx = i;
        render();
      });
      list.appendChild(el);
    });

    const sel = list.querySelector(".cp-sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  // ── Keyboard handler ─────────────────────────────────────────
  function onKey(e) {
    if (e.key === "Escape") {
      hide();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selIdx = Math.min(selIdx + 1, filtered.length - 1);
      render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selIdx = Math.max(selIdx - 1, 0);
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(selIdx);
    }
  }

  function run(i) {
    const cmd = filtered[i];
    if (!cmd) return;
    hide();
    setTimeout(() => cmd.fn(), 30);
  }

  // ── Public API ───────────────────────────────────────────────
  function show() {
    build();
    const overlay = document.getElementById("cp-overlay");
    const input = document.getElementById("cp-input");
    overlay.classList.add("cp-visible");
    filtered = [...COMMANDS];
    selIdx = 0;
    input.value = "";
    render();
    input.focus();
  }

  function hide() {
    document.getElementById("cp-overlay")?.classList.remove("cp-visible");
    window.editor?.focus();
  }

  function toggle() {
    const overlay = document.getElementById("cp-overlay");
    overlay?.classList.contains("cp-visible") ? hide() : show();
  }

  // ── Document-level shortcut (when Monaco doesn't have focus) ─
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      toggle();
    }
  });

  // ── Monaco shortcut (when editor has focus) ──────────────────
  document.addEventListener("monaco-ready", () => {
    window.editor?.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      () => toggle(),
    );
  });

  return { show, hide, toggle };
})();
