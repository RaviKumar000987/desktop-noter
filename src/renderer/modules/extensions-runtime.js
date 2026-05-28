// ═══════════════════════════════════════════════════════════════
//  EXTENSIONS RUNTIME — extensions-runtime.js
//  Activates installed/enabled extensions and wires up their
//  UI contributions: toolbar buttons, context menu items,
//  command palette entries, and editor actions.
//
//  Deps: app.js globals — TabManager, explorerState, showToast,
//        actions, getLang, TerminalPanel, CommandPalette
// ═══════════════════════════════════════════════════════════════

const ExtensionRuntime = (() => {

  // ── Installed extension registry (refreshed on load / install) ──
  let installed = {};   // id → { id, name, version, enabled, ... }

  // ── Extension feature definitions ─────────────────────────────
  // Each entry declares what the extension contributes to the UI.
  // "capability" drives which slots are filled.
  const EXTENSION_DEFS = {
    "code-runner": {
      capabilities: ["toolbar", "context-menu", "command-palette", "keyboard"],
      toolbar: {
        id:    "ext-run-btn",
        icon:  "▶",
        label: "Run Code",
        title: "Run current file (Code Runner)",
        languages: null,   // null = all languages
      },
      commands: [
        { id: "code-runner.run", label: "Code Runner: Run File", shortcut: "Ctrl+Alt+N" },
      ],
      run() { runCurrentFile(); },
    },

    "markdown-pro": {
      capabilities: ["toolbar", "command-palette"],
      toolbar: {
        id:    "ext-md-preview-btn",
        icon:  "👁",
        label: "Preview",
        title: "Toggle Markdown Preview (Markdown Pro)",
        languages: ["markdown"],
      },
      commands: [
        { id: "markdown-pro.preview", label: "Markdown Pro: Toggle Preview" },
      ],
      run() { toggleMarkdownPreview(); },
    },

    "json-wizard": {
      capabilities: ["toolbar", "command-palette"],
      toolbar: {
        id:    "ext-json-fmt-btn",
        icon:  "{}",
        label: "Format",
        title: "Format JSON (JSON Wizard)",
        languages: ["json"],
      },
      commands: [
        { id: "json-wizard.format", label: "JSON Wizard: Format Document" },
      ],
      run() { formatCurrentDocument(); },
    },

    "git-insights": {
      capabilities: ["toolbar", "command-palette"],
      toolbar: {
        id:    "ext-git-btn",
        icon:  "⎇",
        label: "Git",
        title: "Show Git Info (Git Insights)",
        languages: null,
      },
      commands: [
        { id: "git-insights.blame", label: "Git Insights: Show Blame" },
        { id: "git-insights.log",   label: "Git Insights: Show Log" },
      ],
      run() { showGitInfo(); },
    },

    "bracket-colors": {
      capabilities: ["editor-option"],
      activate() {
        if (window.editor) {
          window.editor.updateOptions({
            bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
          });
        }
      },
    },

    "file-icons-pro": {
      capabilities: ["file-icons"],
      activate() { applyRichFileIcons(); },
    },

    "theme-studio": {
      capabilities: ["command-palette"],
      commands: [
        { id: "theme-studio.pick", label: "Theme Studio: Change Theme" },
      ],
      run() { showThemePicker(); },
    },
  };

  // ── Toolbar management ─────────────────────────────────────────
  let toolbarEl = null;

  function getToolbar() {
    if (toolbarEl) return toolbarEl;
    toolbarEl = document.getElementById("ext-toolbar");
    return toolbarEl;
  }

  function clearToolbar() {
    const tb = getToolbar();
    if (tb) tb.innerHTML = "";
  }

  function addToolbarButton(def, extDef) {
    const tb = getToolbar();
    if (!tb) return;

    // Don't add duplicates
    if (document.getElementById(def.id)) return;

    const btn = document.createElement("button");
    btn.id        = def.id;
    btn.className = "ext-toolbar-btn";
    btn.title     = def.title;

    const iconSpan = document.createElement("span");
    iconSpan.className = "ext-toolbar-icon";
    iconSpan.textContent = def.icon;

    const labelSpan = document.createElement("span");
    labelSpan.className = "ext-toolbar-label";
    labelSpan.textContent = def.label;

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);
    tb.appendChild(btn);

    // Show/hide based on active language
    if (def.languages) {
      updateButtonVisibility(btn, def.languages);
      document.addEventListener("tab-language-changed", () => {
        updateButtonVisibility(btn, def.languages);
      });
    }

    btn.addEventListener("click", () => extDef.run());
  }

  function updateButtonVisibility(btn, languages) {
    const tab = TabManager.getActive();
    const lang = tab ? tab.language : "plaintext";
    btn.style.display = (languages && !languages.includes(lang)) ? "none" : "";
  }

  // ── Built-in extension actions ─────────────────────────────────

  function runCurrentFile() {
    const tab = TabManager.getActive();
    if (!tab) { showToast("No file to run", "error"); return; }

    if (!tab.filePath) {
      showToast("Save the file first before running", "info");
      return;
    }

    const lang = tab.language;
    const fp   = tab.filePath;
    let cmd    = null;

    const runners = {
      javascript: `node "${fp}"`,
      typescript: `npx ts-node "${fp}"`,
      python:     `python "${fp}"`,
      java:       `javac "${fp}" && java -cp "${fp.substring(0, fp.lastIndexOf("\\") || fp.lastIndexOf("/"))}" ${fp.split(/[/\\]/).pop().replace(".java","")}`,
      c:          `gcc "${fp}" -o "${fp.replace(/\.[^.]+$/, "")}" && "${fp.replace(/\.[^.]+$/, "")}"`,
      cpp:        `g++ "${fp}" -o "${fp.replace(/\.[^.]+$/, "")}" && "${fp.replace(/\.[^.]+$/, "")}"`,
      rust:       `rustc "${fp}" -o "${fp.replace(/\.[^.]+$/, "")}" && "${fp.replace(/\.[^.]+$/, "")}"`,
      go:         `go run "${fp}"`,
      shell:      `bash "${fp}"`,
    };

    cmd = runners[lang];
    if (!cmd) {
      showToast(`No runner configured for ${lang}`, "info");
      return;
    }

    // Save file first if modified
    if (tab.isModified) {
      actions.saveFile().then(() => {
        TerminalPanel.show();
        setTimeout(() => {
          const input = document.getElementById("terminal-input");
          if (input) { input.value = cmd; input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }
        }, 100);
      });
    } else {
      TerminalPanel.show();
      setTimeout(() => {
        const input = document.getElementById("terminal-input");
        if (input) { input.value = cmd; input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }
      }, 100);
    }
  }

  function toggleMarkdownPreview() {
    const tab = TabManager.getActive();
    if (!tab || tab.language !== "markdown") {
      showToast("Open a Markdown file to preview", "info");
      return;
    }

    let preview = document.getElementById("md-preview-panel");
    if (preview) {
      preview.remove();
      showToast("Markdown preview closed", "info");
      setTimeout(() => window.editor?.layout(), 60);
      return;
    }

    preview = document.createElement("div");
    preview.id = "md-preview-panel";
    preview.style.cssText = `
      flex:1; overflow:auto; padding:20px 28px; background:var(--base);
      color:var(--text); font-family:sans-serif; line-height:1.7;
      border-left:1px solid var(--surface0); font-size:15px;
    `;

    function renderMd(text) {
      return text
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/^#{6}\s(.+)$/gm, "<h6>$1</h6>")
        .replace(/^#{5}\s(.+)$/gm, "<h5>$1</h5>")
        .replace(/^#{4}\s(.+)$/gm, "<h4>$1</h4>")
        .replace(/^#{3}\s(.+)$/gm, "<h3>$1</h3>")
        .replace(/^#{2}\s(.+)$/gm, "<h2>$1</h2>")
        .replace(/^#{1}\s(.+)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/^[-*]\s(.+)$/gm, "<li>$1</li>")
        .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
        .replace(/\n\n/g, "</p><p>")
        .replace(/^(?!<[hluobp])/gm, "");
    }

    const updatePreview = () => {
      const content = window.editor?.getValue() || "";
      preview.innerHTML = `<div style="max-width:720px;margin:0 auto">${renderMd(content)}</div>`;
    };
    updatePreview();

    const wrapper = document.getElementById("editor-wrapper");
    if (wrapper) wrapper.appendChild(preview);
    window.editor?.onDidChangeModelContent(() => updatePreview());
    setTimeout(() => window.editor?.layout(), 60);
    showToast("Markdown preview opened", "success");
  }

  function formatCurrentDocument() {
    if (!window.editor) return;
    window.editor.trigger("ext", "editor.action.formatDocument", null);
    showToast("Document formatted", "success");
  }

  function showGitInfo() {
    const tab = TabManager.getActive();
    if (!tab?.filePath) { showToast("No file open", "info"); return; }
    TerminalPanel.show();
    setTimeout(() => {
      const input = document.getElementById("terminal-input");
      const dir   = tab.filePath.replace(/[^/\\]+$/, "");
      if (input) {
        input.value = `git log --oneline -10 "${tab.filePath}"`;
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      }
    }, 100);
  }

  function applyRichFileIcons() {
    // File Icons Pro: override explorer icon rendering with richer icons
    const FILE_ICONS = {
      js:   { icon: "󰌞", color: "#f9e2af" },
      ts:   { icon: "󰛦", color: "#89b4fa" },
      jsx:  { icon: "󰜈", color: "#89dceb" },
      tsx:  { icon: "󰛦", color: "#89dceb" },
      html: { icon: "󰌝", color: "#fab387" },
      css:  { icon: "󰌜", color: "#89dceb" },
      scss: { icon: "󰌜", color: "#f5c2e7" },
      json: { icon: "󰘦", color: "#a6e3a1" },
      md:   { icon: "󰍔", color: "#94e2d5" },
      py:   { icon: "󰌠", color: "#89b4fa" },
      rs:   { icon: "󱘗", color: "#fab387" },
      go:   { icon: "󰟓", color: "#89dceb" },
      java: { icon: "󰬷", color: "#fab387" },
      cpp:  { icon: "󰙲", color: "#89b4fa" },
      c:    { icon: "󰙱", color: "#89b4fa" },
      sh:   { icon: "󰆍", color: "#a6e3a1" },
      env:  { icon: "󰙊", color: "#f9e2af" },
      git:  { icon: "󰊢", color: "#f38ba8" },
    };
    window._fileIconsProDefs = FILE_ICONS;
  }

  function showThemePicker() {
    const themes = [
      { id: "catppuccin-mocha",   label: "Catppuccin Mocha"   },
      { id: "vs-dark",            label: "VS Dark"            },
      { id: "vs",                 label: "VS Light"           },
      { id: "hc-black",           label: "High Contrast Dark" },
    ];
    const cur = localStorage.getItem("noter-theme") || "catppuccin-mocha";
    const overlay = document.createElement("div");
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9000;display:flex;align-items:center;justify-content:center`;
    const box = document.createElement("div");
    box.style.cssText = `background:var(--mantle);border:1px solid var(--surface1);border-radius:12px;padding:20px;min-width:260px`;
    box.innerHTML = `<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">Theme Studio — Select Theme</div>`;
    themes.forEach(t => {
      const row = document.createElement("div");
      row.style.cssText = `padding:8px 12px;border-radius:7px;cursor:pointer;color:var(--text);font-size:12px;display:flex;align-items:center;gap:8px`;
      if (t.id === cur) row.style.background = "var(--surface0)";
      row.innerHTML = `<span style="width:12px;height:12px;border-radius:50%;background:var(--blue);display:inline-block;opacity:${t.id===cur?1:0.3}"></span>${t.label}`;
      row.addEventListener("click", () => {
        monaco.editor.setTheme(t.id);
        localStorage.setItem("noter-theme", t.id);
        overlay.remove();
        showToast(`Theme: ${t.label}`, "success");
      });
      row.addEventListener("mouseenter", () => row.style.background = "var(--surface0)");
      row.addEventListener("mouseleave", () => row.style.background = t.id===cur?"var(--surface0)":"");
      box.appendChild(row);
    });
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // ── Main activation ────────────────────────────────────────────
  async function activate() {
    try {
      installed = await window.electronAPI.marketplaceGetInstalled?.() || {};
    } catch { installed = {}; }

    clearToolbar();

    const enabledIds = Object.entries(installed)
      .filter(([, meta]) => meta.enabled !== false)
      .map(([id]) => id.toLowerCase().replace(/\s+/g, "-"));

    for (const id of enabledIds) {
      const def = EXTENSION_DEFS[id];
      if (!def) continue;

      // Toolbar button
      if (def.capabilities?.includes("toolbar") && def.toolbar) {
        addToolbarButton(def.toolbar, def);
      }

      // One-time editor option
      if (def.capabilities?.includes("editor-option") && def.activate) {
        def.activate();
      }

      // File icons
      if (def.capabilities?.includes("file-icons") && def.activate) {
        def.activate();
      }
    }

    // Always show Run Code button if ANY code runner is installed
    if (enabledIds.includes("code-runner") || enabledIds.some(id => id.includes("runner"))) {
      // Already added above if code-runner matched
    }

    // Update toolbar language visibility when active tab changes
    document.addEventListener("tab-language-changed", () => refreshToolbarVisibility());
    updateRunButtonVisibility();
  }

  function updateRunButtonVisibility() {
    const btn = document.getElementById("ext-run-btn");
    if (!btn) return;
    const tab = TabManager.getActive();
    const lang = tab ? tab.language : "plaintext";
    const RUNNABLE = new Set(["javascript","typescript","python","java","c","cpp","rust","go","shell"]);
    btn.style.opacity = RUNNABLE.has(lang) ? "1" : "0.4";
    btn.title = RUNNABLE.has(lang)
      ? `Run ${lang} file (Code Runner)`
      : `No runner for ${lang}`;
  }

  function refreshToolbarVisibility() {
    updateRunButtonVisibility();
    const tab  = TabManager.getActive();
    const lang = tab ? tab.language : "plaintext";

    document.querySelectorAll(".ext-toolbar-btn[data-langs]").forEach(btn => {
      const langs = btn.dataset.langs.split(",");
      btn.style.display = langs.includes(lang) || langs.includes("*") ? "" : "none";
    });
  }

  // ── Re-activate after marketplace install/uninstall ───────────
  function refresh() {
    activate();
  }

  // ── Keyboard shortcut: Ctrl+Alt+N → Run File ──────────────────
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && e.key === "n") {
      e.preventDefault();
      runCurrentFile();
    }
  });
  document.addEventListener("monaco-ready", () => {
    window.editor?.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyN,
      () => runCurrentFile()
    );
  });

  return {
    activate,
    refresh,
    runCurrentFile,
    formatCurrentDocument,
    toggleMarkdownPreview,
    showGitInfo,
    showThemePicker,
  };
})();

// Auto-activate after DOM + Monaco are ready
document.addEventListener("monaco-ready", () => {
  setTimeout(() => ExtensionRuntime.activate(), 200);
});

// Also update run button on tab changes
document.addEventListener("tab-language-changed", () => {
  const btn = document.getElementById("ext-run-btn");
  if (!btn) return;
  const tab = TabManager.getActive();
  const lang = tab ? tab.language : "plaintext";
  const RUNNABLE = new Set(["javascript","typescript","python","java","c","cpp","rust","go","shell"]);
  btn.style.opacity = RUNNABLE.has(lang) ? "1" : "0.4";
});
