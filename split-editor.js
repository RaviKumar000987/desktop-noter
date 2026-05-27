// ═══════════════════════════════════════════════════════════════
//  SPLIT EDITOR — split-editor.js
//  Toggle : Ctrl + \
//  Opens a second Monaco pane side-by-side with the main editor.
// ═══════════════════════════════════════════════════════════════

const SplitEditor = (() => {
  let active = false;
  let editor2 = null;
  let ownModel = null; // model we created (disposable), null if mirroring a tab model

  // ── Open split ───────────────────────────────────────────────
  function open() {
    if (active) return;
    if (!window.editor) {
      showToast("Editor not ready yet", "error");
      return;
    }
    active = true;

    const wrapper = document.getElementById("editor-wrapper");

    // Right pane container
    const pane = document.createElement("div");
    pane.id = "se-right-pane";
    pane.innerHTML = `
      <div id="se-header">
        <span id="se-title">Split — ${TabManager.getActive()?.title || "Untitled"}</span>
        <div style="display:flex;gap:2px;flex-shrink:0">
          <button class="sidebar-btn" id="se-open-btn"  title="Open file in split (Ctrl+Shift+O)">📂</button>
          <button class="sidebar-btn" id="se-close-btn" title="Close Split (Ctrl+\\)">×</button>
        </div>
      </div>
      <div id="editor2"></div>`;
    wrapper.appendChild(pane);

    // Create second Monaco editor
    editor2 = monaco.editor.create(document.getElementById("editor2"), {
      model: null,
      theme: "catppuccin-mocha",
      automaticLayout: true,
      fontSize: editorFontSize,
      fontFamily:
        "'Dank Mono','Cascadia Code','Fira Code',Consolas,'Courier New',monospace",
      lineHeight: 38,
      padding: { top: 20, bottom: 20 },
      minimap: { enabled: false },
      wordWrap: wordWrapEnabled ? "on" : "off",
      smoothScrolling: true,
      renderLineHighlight: "all",
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      roundedSelection: true,
    });

    // Mirror active tab in right pane (shared model → edits in sync)
    const activeTab = TabManager.getActive();
    if (activeTab) {
      editor2.setModel(activeTab.model);
    }

    // ── Button listeners ──────────────────────────────────────
    document.getElementById("se-close-btn").addEventListener("click", close);
    document
      .getElementById("se-open-btn")
      .addEventListener("click", openFileInRight);

    showToast("Split Editor opened  (Ctrl+\\ to close)", "info", 2000);
  }

  // ── Open a file specifically in the right pane ───────────────
  async function openFileInRight() {
    if (!active || !editor2) return;
    const file = await window.electronAPI.openFile();
    if (!file) return;

    const lang = getLang(file.filePath);
    const uri = monaco.Uri.parse("noter://split/" + Date.now());
    const m = monaco.editor.createModel(file.content, lang, uri);

    // Dispose previous own model (not a tab model)
    if (ownModel) {
      ownModel.dispose();
    }
    ownModel = m;
    editor2.setModel(m);

    const titleEl = document.getElementById("se-title");
    if (titleEl) titleEl.textContent = "Split — " + basename(file.filePath);
  }

  // ── Sync right pane when active tab changes ──────────────────
  // Called from app.js via TabManager.activate (we hook in below)
  function syncWithTab(tab) {
    if (!active || !editor2 || !tab) return;
    // Only mirror if we're not showing an independently opened file
    if (!ownModel) {
      editor2.setModel(tab.model);
      const titleEl = document.getElementById("se-title");
      if (titleEl) titleEl.textContent = "Split — " + tab.title;
    }
  }

  // ── Close split ──────────────────────────────────────────────
  function close() {
    if (!active) return;
    active = false;

    if (editor2) {
      editor2.dispose();
      editor2 = null;
    }
    if (ownModel) {
      ownModel.dispose();
      ownModel = null;
    }

    document.getElementById("se-right-pane")?.remove();
    window.editor?.focus();
  }

  function toggle() {
    active ? close() : open();
  }
  function isActive() {
    return active;
  }

  // ── Global shortcut ──────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "\\") {
      e.preventDefault();
      toggle();
    }
  });

  // ── Monaco shortcut ──────────────────────────────────────────
  document.addEventListener("monaco-ready", () => {
    window.editor?.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash,
      () => toggle(),
    );
  });

  return { open, close, toggle, isActive, syncWithTab };
})();
