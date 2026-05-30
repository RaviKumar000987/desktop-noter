// ═══════════════════════════════════════════════════════════════
//  EDITOR CONTEXT MENU — editor-context-menu.js
//  Adds custom items to Monaco's native right-click context menu.
//  Called once after Monaco editor is created (see app.js init).
//
//  Monaco context menu groups (ascending order shown in menu):
//    1_goto   — navigation
//    5_format — formatting
//    7_noter  — noter custom (above clipboard)
//    9_cutcopypaste — Monaco built-in clipboard
// ═══════════════════════════════════════════════════════════════

function registerEditorContextMenuActions(editor) {
  if (!editor || typeof monaco === "undefined") return;

  // ── Navigation group ──────────────────────────────────────────

  editor.addAction({
    id: "noter.goToDefinition",
    label: "Go to Definition",
    keybindings: [monaco.KeyCode.F12],
    contextMenuGroupId: "1_goto",
    contextMenuOrder: 1,
    run(ed) { ed.trigger("context", "editor.action.revealDefinition", null); },
  });

  editor.addAction({
    id: "noter.goToTypeDefinition",
    label: "Go to Type Definition",
    contextMenuGroupId: "1_goto",
    contextMenuOrder: 1.5,
    run(ed) { ed.trigger("context", "editor.action.goToTypeDefinition", null); },
  });

  editor.addAction({
    id: "noter.findReferences",
    label: "Find All References",
    keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
    contextMenuGroupId: "1_goto",
    contextMenuOrder: 2,
    run(ed) { ed.trigger("context", "editor.action.goToReferences", null); },
  });

  editor.addAction({
    id: "noter.renameSymbol",
    label: "Rename Symbol",
    keybindings: [monaco.KeyCode.F2],
    contextMenuGroupId: "1_goto",
    contextMenuOrder: 3,
    run(ed) { ed.trigger("context", "editor.action.rename", null); },
  });

  editor.addAction({
    id: "noter.peekDefinition",
    label: "Peek Definition",
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
    contextMenuGroupId: "1_goto",
    contextMenuOrder: 4,
    run(ed) { ed.trigger("context", "editor.action.peekDefinition", null); },
  });

  // ── Quick Fix ─────────────────────────────────────────────────

  editor.addAction({
    id: "noter.quickFix",
    label: "Quick Fix…",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period],
    contextMenuGroupId: "1_goto",
    contextMenuOrder: 5,
    run(ed) { ed.trigger("context", "editor.action.quickFix", null); },
  });

  // ── Format group ──────────────────────────────────────────────

  editor.addAction({
    id: "noter.formatDocument",
    label: "Format Document",
    keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
    contextMenuGroupId: "5_format",
    contextMenuOrder: 1,
    run(ed) { ed.trigger("context", "editor.action.formatDocument", null); },
  });

  editor.addAction({
    id: "noter.formatSelection",
    label: "Format Selection",
    contextMenuGroupId: "5_format",
    contextMenuOrder: 2,
    run(ed) { ed.trigger("context", "editor.action.formatSelection", null); },
  });

  editor.addAction({
    id: "noter.organizeImports",
    label: "Organize Imports",
    contextMenuGroupId: "5_format",
    contextMenuOrder: 3,
    run(ed) { ed.trigger("context", "editor.action.organizeImports", null); },
  });

  editor.addAction({
    id: "noter.toggleLineComment",
    label: "Toggle Line Comment",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
    contextMenuGroupId: "5_format",
    contextMenuOrder: 4,
    run(ed) { ed.trigger("context", "editor.action.commentLine", null); },
  });

  editor.addAction({
    id: "noter.toggleBlockComment",
    label: "Toggle Block Comment",
    keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
    contextMenuGroupId: "5_format",
    contextMenuOrder: 5,
    run(ed) { ed.trigger("context", "editor.action.blockComment", null); },
  });

  // ── Noter custom group ────────────────────────────────────────

  editor.addAction({
    id: "noter.copyFilePath",
    label: "Copy File Path",
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 1,
    run() {
      const tab = typeof TabManager !== "undefined" ? TabManager.getActive?.() : null;
      if (tab?.filePath) {
        navigator.clipboard.writeText(tab.filePath);
        if (typeof showToast === "function") showToast("Path copied", "success", 1500);
      }
    },
  });

  editor.addAction({
    id: "noter.copyRelativePath",
    label: "Copy Relative Path",
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 2,
    run() {
      const tab = typeof TabManager !== "undefined" ? TabManager.getActive?.() : null;
      const root = typeof explorerState !== "undefined" ? explorerState.root : null;
      if (tab?.filePath) {
        const rel = root && tab.filePath.startsWith(root)
          ? tab.filePath.slice(root.length).replace(/^[\\/]/, "")
          : tab.filePath;
        navigator.clipboard.writeText(rel);
        if (typeof showToast === "function") showToast("Relative path copied", "success", 1500);
      }
    },
  });

  editor.addAction({
    id: "noter.revealInExplorer",
    label: "Reveal in Explorer",
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 3,
    run() {
      const tab = typeof TabManager !== "undefined" ? TabManager.getActive?.() : null;
      if (tab?.filePath) window.electronAPI?.shellReveal?.(tab.filePath);
    },
  });

  editor.addAction({
    id: "noter.openInTerminal",
    label: "Open Containing Folder in Terminal",
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 4,
    run() {
      const tab = typeof TabManager !== "undefined" ? TabManager.getActive?.() : null;
      if (!tab?.filePath) return;
      const dir = tab.filePath.replace(/[\\/][^\\/]+$/, "");
      if (typeof TerminalPanel !== "undefined") TerminalPanel.show();
      setTimeout(() => window.electronAPI?.ptyWrite?.(`cd "${dir}"\r`), 300);
    },
  });

  editor.addAction({
    id: "noter.runFile",
    label: "Run File",
    keybindings: [monaco.KeyCode.F5],
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 5,
    run() {
      if (typeof runCurrentFile === "function") runCurrentFile("auto");
    },
  });

  // ── Inlay hints toggle ────────────────────────────────────────

  editor.addAction({
    id: "noter.toggleInlayHints",
    label: "Toggle Inlay Hints",
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 6,
    run(ed) {
      const cur = ed.getOption(monaco.editor.EditorOption.inlayHints)?.enabled;
      ed.updateOptions({ inlayHints: { enabled: cur === "on" ? "off" : "on" } });
    },
  });

  // ── Run file ─────────────────────────────────────────────────

  editor.addAction({
    id: "noter.runFileCtx",
    label: "▶  Run File",
    keybindings: [monaco.KeyCode.F5],
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 0.5,
    run() {
      if (typeof runCurrentFile === "function") runCurrentFile("auto");
      else if (typeof showToast === "function") showToast("Save the file first", "warn");
    },
  });

  editor.addAction({
    id: "noter.runInTerminal",
    label: "Run in Terminal",
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 0.6,
    run() {
      if (typeof TerminalPanel !== "undefined") TerminalPanel.show();
    },
  });

  // ── Spell check ───────────────────────────────────────────────
  // Monaco has no built-in spell check, but its hidden textarea can use
  // the browser's native spell check. We also implement a word-level
  // spell check using the browser's spellcheck API on selections.

  let _spellCheckEnabled = false;

  editor.addAction({
    id: "noter.toggleSpellCheck",
    label: "Toggle Spell Check",
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 7,
    run(ed) {
      _spellCheckEnabled = !_spellCheckEnabled;

      // Toggle on Monaco's underlying textarea (highlights misspelled words
      // using the browser's native spell check engine)
      const domNode = ed.getDomNode();
      if (domNode) {
        const textarea = domNode.querySelector("textarea.inputarea");
        if (textarea) {
          textarea.spellcheck = _spellCheckEnabled;
          textarea.setAttribute("lang", "en");
        }
        // Also apply to the editor's content area
        domNode.setAttribute("spellcheck", _spellCheckEnabled ? "true" : "false");
      }

      // Visual marker on misspelled words (basic approach using Monaco markers)
      if (_spellCheckEnabled) {
        _runSpellCheckOnModel(ed);
      } else {
        monaco.editor.setModelMarkers(ed.getModel(), "spell-check", []);
      }

      if (typeof showToast === "function") {
        showToast(`Spell Check ${_spellCheckEnabled ? "ON" : "OFF"}`, "info", 1800);
      }
    },
  });

  editor.addAction({
    id: "noter.checkSelectionSpelling",
    label: "Check Spelling of Selection",
    contextMenuGroupId: "7_noter",
    contextMenuOrder: 7.5,
    run(ed) {
      const sel = ed.getSelection();
      const model = ed.getModel();
      if (!sel || !model) return;
      const text = model.getValueInRange(sel);
      if (!text.trim()) return;

      // Use browser's built-in spell check via a temporary textarea
      const ta = document.createElement("textarea");
      ta.setAttribute("spellcheck", "true");
      ta.setAttribute("lang", "en");
      ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
      ta.value = text;
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      setTimeout(() => {
        document.body.removeChild(ta);
        ed.focus();
      }, 1500);

      if (typeof showToast === "function") {
        showToast("Browser spell check active — right-click in editor for suggestions", "info", 3000);
      }
    },
  });
}

// ── Spell check engine (Monaco markers) ──────────────────────────
// Uses a curated list of common programming misspellings.
// Intentionally lightweight — full dictionary = Phase 6 AI Context engine.
const _COMMON_MISSPELLINGS = {
  "occured": "occurred", "recieve": "receive", "seperate": "separate",
  "definately": "definitely", "occurance": "occurrence", "existance": "existence",
  "persistance": "persistence", "dependancy": "dependency", "arguement": "argument",
  "lenght": "length", "widht": "width", "paramter": "parameter",
  "functoin": "function", "fucntion": "function", "retrun": "return",
  "flase": "false", "treu": "true", "nul": "null", "undefiend": "undefined",
  "consloe": "console", "consolle": "console", "documnet": "document",
  "windwo": "window", "cahce": "cache", "lateny": "latency", "databse": "database",
  "excpetion": "exception", "expcetion": "exception", "propery": "property",
  "porperty": "property", "contructor": "constructor", "constuctor": "constructor",
};

function _runSpellCheckOnModel(editor) {
  const model = editor.getModel();
  if (!model) return;

  const text = model.getValue();
  const markers = [];

  for (const [wrong, correct] of Object.entries(_COMMON_MISSPELLINGS)) {
    const regex = new RegExp(`\\b${wrong}\\b`, "gi");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const pos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + wrong.length);
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: `Possible misspelling: "${wrong}" → "${correct}"`,
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
        source: "Spell Check",
      });
    }
  }

  monaco.editor.setModelMarkers(model, "spell-check", markers);
}

// Export so app.js can call after editor creation
window.registerEditorContextMenuActions = registerEditorContextMenuActions;
