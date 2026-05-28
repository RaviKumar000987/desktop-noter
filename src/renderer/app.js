// ═══════════════════════════════════════════════════════════════
//  NOTER APP — app.js
//  Features: Multi-Tab · Project Explorer · Workspace
// ═══════════════════════════════════════════════════════════════

// ─── Monaco Loader config (must run before require calls) ───────
require.config({ paths: { vs: "../../node_modules/monaco-editor/min/vs" } });

// ─── Settings & runtime state ───────────────────────────────────
let editorFontSize = 18;
let wordWrapEnabled = true;
let sidebarVisible = true;
let sidebarWidth = 220;
let zenModeActive = false;

// ─── Utility ────────────────────────────────────────────────────
function basename(p) {
  if (!p) return "Untitled";
  return p.replace(/\\/g, "/").split("/").filter(Boolean).pop() || p;
}

// ─── Language detection ─────────────────────────────────────────
const EXT_TO_LANG = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  jsx: "javascript",
  tsx: "typescript",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  jsonc: "json",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  rb: "ruby",
  php: "php",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  sh: "shell",
  bash: "shell",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  txt: "plaintext",
};

const LANG_DISPLAY = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  less: "LESS",
  json: "JSON",
  markdown: "Markdown",
  python: "Python",
  ruby: "Ruby",
  php: "PHP",
  java: "Java",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  shell: "Shell",
  xml: "XML",
  yaml: "YAML",
  sql: "SQL",
  plaintext: "Plain Text",
};

function getLang(filePath) {
  if (!filePath) return "plaintext";
  const ext = filePath.split(".").pop().toLowerCase();
  return EXT_TO_LANG[ext] || "plaintext";
}
function getLangDisplay(lang) {
  return LANG_DISPLAY[lang] || lang;
}

// ─── File-type colours (for explorer) ───────────────────────────
const EXT_COLOR = {
  js: "#f9e2af",
  mjs: "#f9e2af",
  cjs: "#f9e2af",
  ts: "#89b4fa",
  jsx: "#f9e2af",
  tsx: "#89b4fa",
  html: "#fab387",
  htm: "#fab387",
  css: "#89dceb",
  scss: "#f5c2e7",
  less: "#cba6f7",
  json: "#a6e3a1",
  jsonc: "#a6e3a1",
  md: "#94e2d5",
  markdown: "#94e2d5",
  py: "#89b4fa",
  rs: "#fab387",
  go: "#89dceb",
  rb: "#f38ba8",
  java: "#fab387",
  c: "#89b4fa",
  h: "#89b4fa",
  cpp: "#89b4fa",
  cc: "#89b4fa",
  cs: "#a6e3a1",
  sh: "#a6e3a1",
  bash: "#a6e3a1",
  zenModeActive: "",
  xml: "#fab387",
  svg: "#f5c2e7",
  yaml: "#f38ba8",
  yml: "#f38ba8",
  sql: "#89b4fa",
  txt: "#9399b2",
  env: "#f9e2af",
  gitignore: "#f38ba8",
};
function getFileColor(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  // Special dotfiles
  if (name === ".env") return "#f9e2af";
  if (name === ".gitignore") return "#f38ba8";
  return EXT_COLOR[ext] || "#7f849c";
}

// ═══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function showToast(message, type = "info", duration = 2200) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

// ═══════════════════════════════════════════════════════════════
//  TAB MANAGER
// ═══════════════════════════════════════════════════════════════
const TabManager = {
  tabs: [],
  activeId: null,
  _uid: 1,
  // When true, TabManager.close() will not auto-create a blank tab when the last
  // tab is closed. Set to true during workspace/session restoration flows.
  _suppressAutoBlank: false,

  /**
   * Create a new tab with its own Monaco model.
   * Call ONLY after Monaco is initialised.
   */
  create(filePath = null, content = "", language = null) {
    const id = "tab-" + this._uid++;
    const lang = language || getLang(filePath);
    const uri = monaco.Uri.parse("noter://tab/" + id);
    const model = monaco.editor.createModel(content, lang, uri);

    // Track model lifecycle to prevent heap accumulation
    if (typeof ModelManager !== "undefined") ModelManager.register(model);

    // Warn when many tabs are open
    if (this.tabs.length >= 29 && typeof showToast === "function") {
      showToast(
        this.tabs.length +
          1 +
          " tabs open - consider closing unused tabs to free memory",
        "warning",
        4000,
      );
    }

    const tab = {
      id,
      filePath,
      title: filePath ? basename(filePath) : "Untitled",
      language: lang,
      isModified: false,
      viewState: null,
      model,
    };

    // Per-model content change → track dirty state
    model.onDidChangeContent((e) => {
      if (e.isFlush) return; // programmatic setValue — not dirty
      if (!tab.isModified) {
        tab.isModified = true;
        renderTabs();
        updateTitleBar();
      }
      if (TabManager.activeId === id) updateCounts();
    });

    this.tabs.push(tab);
    return tab;
  },

  get(id) {
    return this.tabs.find((t) => t.id === id);
  },
  getActive() {
    return this.get(this.activeId);
  },

  /** Switch to tab `id`, saving the current editor view-state first. */
  activate(id) {
    const prev = this.getActive();
    if (prev && window.editor) {
      prev.viewState = window.editor.saveViewState();
    }

    this.activeId = id;
    const tab = this.get(id);
    if (!tab) return;

    if (window.editor) {
      window.editor.setModel(tab.model);
      if (tab.viewState) window.editor.restoreViewState(tab.viewState);
      window.editor.focus();
    }

    updateStatusBar();
    updateTitleBar();
    updateBreadcrumb();
    renderTabs();
    updateExplorerActiveFile();
    saveSessionState();
    if (typeof SplitEditor !== "undefined") SplitEditor.syncWithTab(tab);
    document.dispatchEvent(
      new CustomEvent("tab-language-changed", {
        detail: { language: tab.language },
      }),
    );
  },

  /** Close a tab (prompts if unsaved). Returns true if closed. */
  close(id, force = false) {
    const tab = this.get(id);
    if (!tab) return false;

    if (!force && tab.isModified) {
      if (
        !confirm(`"${tab.title}" has unsaved changes.\nClose without saving?`)
      )
        return false;
    }

    const idx = this.tabs.findIndex((t) => t.id === id);
    if (tab.filePath) window.electronAPI?.unwatchFile?.(tab.filePath);
    // Use ModelManager for tracked disposal; fall back to direct dispose
    if (typeof ModelManager !== "undefined") ModelManager.dispose(tab.model);
    else tab.model.dispose();
    this.tabs.splice(idx, 1);

    if (this.activeId === id) {
      // Prefer the tab to the right, then left
      const next = this.tabs[idx] || this.tabs[idx - 1];
      if (next) {
        this.activate(next.id);
      } else if (!this._suppressAutoBlank) {
        // No tabs left and not in a bulk restore — create a blank tab
        const blank = this.create();
        this.activate(blank.id);
      } else {
        this.activeId = null;
        renderTabs();
      }
    }

    renderTabs();
    saveSessionState();
    return true;
  },

  closeAll(force = false) {
    const ids = this.tabs.map((t) => t.id);
    for (const id of ids) this.close(id, force);
  },
};

// ═══════════════════════════════════════════════════════════════
//  DRAG & DROP TAB REORDERING
// ═══════════════════════════════════════════════════════════════
const TabDnD = (() => {
  let dragTabId = null;
  let indicatorEl = null;

  function getIndicator() {
    if (!indicatorEl) {
      indicatorEl = document.createElement("div");
      indicatorEl.id = "tab-drop-indicator";
      document.body.appendChild(indicatorEl);
    }
    return indicatorEl;
  }

  function clearIndicator() {
    const el = document.getElementById("tab-drop-indicator");
    if (el) el.style.display = "none";
  }

  function getTabEl(e) {
    return e.target.closest(".tab-item[data-id]");
  }

  function onDragStart(e) {
    const el = getTabEl(e);
    if (!el) return;
    dragTabId = el.dataset.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragTabId);
    // Fade source tab while dragging
    setTimeout(() => {
      el.style.opacity = "0.45";
    }, 0);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const el = getTabEl(e);
    if (!el || el.dataset.id === dragTabId) {
      clearIndicator();
      return;
    }

    const rect = el.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    const pos = e.clientX < mid ? "before" : "after";

    el.dataset.dropPos = pos;
    const ind = getIndicator();
    ind.style.display = "block";
    ind.style.left = (pos === "before" ? rect.left : rect.right) - 1 + "px";
    ind.style.top = rect.top + "px";
    ind.style.height = rect.height + "px";
  }

  function onDragLeave(e) {
    const el = getTabEl(e);
    if (el) delete el.dataset.dropPos;
  }

  function onDrop(e) {
    e.preventDefault();
    clearIndicator();
    const el = getTabEl(e);
    if (!el || !dragTabId || el.dataset.id === dragTabId) return;

    const targetId = el.dataset.id;
    const dropPos = el.dataset.dropPos || "after";
    delete el.dataset.dropPos;

    const fromIdx = TabManager.tabs.findIndex((t) => t.id === dragTabId);
    if (fromIdx === -1) return;

    const [moved] = TabManager.tabs.splice(fromIdx, 1);
    let toIdx = TabManager.tabs.findIndex((t) => t.id === targetId);
    if (toIdx === -1) {
      TabManager.tabs.push(moved);
    } else {
      const insertAt = dropPos === "before" ? toIdx : toIdx + 1;
      TabManager.tabs.splice(insertAt, 0, moved);
    }

    renderTabs();
    saveSessionState();
  }

  function onDragEnd(e) {
    clearIndicator();
    dragTabId = null;
    document.querySelectorAll(".tab-item").forEach((el) => {
      el.style.opacity = "";
      delete el.dataset.dropPos;
    });
  }

  return { onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd };
})();

// ── Tab context menu ──────────────────────────────────────────
function showTabContextMenu(tab, x, y) {
  // Lazy-reference ContextMenu (loaded by context-menu.js after us)
  const CM =
    window.ContextMenu ||
    (typeof ContextMenu !== "undefined" ? ContextMenu : null);
  if (!CM) return;

  const items = [
    {
      icon: "✕",
      label: "Close Tab",
      shortcut: "Ctrl+W",
      action: () => TabManager.close(tab.id),
    },
    {
      icon: "✕",
      label: "Close Others",
      action: () => {
        const others = TabManager.tabs
          .filter((t) => t.id !== tab.id)
          .map((t) => t.id);
        others.forEach((id) => TabManager.close(id, false));
      },
    },
    {
      icon: "✕",
      label: "Close All",
      action: () => {
        const ids = TabManager.tabs.map((t) => t.id);
        ids.forEach((id) => TabManager.close(id, false));
      },
    },
    { separator: true },
  ];

  if (tab.filePath) {
    items.push(
      {
        icon: "💾",
        label: "Save",
        shortcut: "Ctrl+S",
        action: () => {
          TabManager.activate(tab.id);
          actions.saveFile();
        },
      },
      {
        icon: "💾",
        label: "Save As…",
        action: () => {
          TabManager.activate(tab.id);
          actions.saveAsFile();
        },
      },
      { separator: true },
      {
        icon: "⎘",
        label: "Copy Path",
        action: () => navigator.clipboard.writeText(tab.filePath),
      },
      {
        icon: "⎘",
        label: "Copy Relative Path",
        action: () => {
          const root = explorerState.rootPath || "";
          const rel = tab.filePath.startsWith(root)
            ? tab.filePath.slice(root.length).replace(/^[/\\]/, "")
            : tab.filePath;
          navigator.clipboard.writeText(rel);
        },
      },
      {
        icon: "⊢",
        label: "Reveal in Explorer",
        action: () => window.electronAPI.shellReveal(tab.filePath),
      },
      { separator: true },
      {
        icon: "⊟",
        label: "Open to Side",
        action: () => {
          TabManager.activate(tab.id);
          if (typeof SplitEditor !== "undefined") SplitEditor.open();
        },
      },
    );
  }

  CM.show(items, x, y);
}

// ═══════════════════════════════════════════════════════════════
//  RENDER TABS
// ═══════════════════════════════════════════════════════════════
function renderTabs() {
  const list = document.getElementById("tabs-list");
  if (!list) return;
  list.innerHTML = "";

  TabManager.tabs.forEach((tab) => {
    const el = document.createElement("div");
    el.className =
      "tab-item" + (tab.id === TabManager.activeId ? " active" : "");
    el.dataset.id = tab.id;
    el.title = tab.filePath || tab.title;

    if (tab.isModified) {
      const dot = document.createElement("span");
      dot.className = "tab-modified-dot";
      dot.textContent = "●";
      el.appendChild(dot);
    }

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.title;
    el.appendChild(label);

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Close tab";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      TabManager.close(tab.id);
    });
    el.appendChild(closeBtn);

    // Left-click → activate
    el.addEventListener("click", () => TabManager.activate(tab.id));

    // Middle-click → close
    el.addEventListener("mousedown", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        TabManager.close(tab.id);
      }
    });

    // Right-click → tab context menu
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTabContextMenu(tab, e.clientX, e.clientY);
    });

    // Drag & Drop reordering
    el.draggable = true;
    el.addEventListener("dragstart", TabDnD.onDragStart);
    el.addEventListener("dragover", TabDnD.onDragOver);
    el.addEventListener("dragleave", TabDnD.onDragLeave);
    el.addEventListener("drop", TabDnD.onDrop);
    el.addEventListener("dragend", TabDnD.onDragEnd);

    list.appendChild(el);
  });

  // Scroll active tab into view
  const activeEl = list.querySelector(".tab-item.active");
  if (activeEl)
    activeEl.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// ═══════════════════════════════════════════════════════════════
//  STATUS BAR HELPERS
// ═══════════════════════════════════════════════════════════════
function updateStatusBar() {
  const tab = TabManager.getActive();
  const lang = tab ? tab.language : "plaintext";

  const langEl = document.getElementById("language");
  if (langEl) langEl.textContent = getLangDisplay(lang);

  const fileEl = document.getElementById("fileStatus");
  if (fileEl) fileEl.textContent = tab ? tab.title : "Untitled";
}

function updateZoomStatus() {
  const el = document.getElementById("zoomStatus");
  if (el) el.textContent = `${Math.round((editorFontSize / 18) * 100)}%`;
}
function updateWrapStatus() {
  const el = document.getElementById("wrapStatus");
  if (el) el.textContent = wordWrapEnabled ? "Wrap ON" : "Wrap OFF";
}

let _countTimer = null;
function updateCounts() {
  clearTimeout(_countTimer);
  _countTimer = setTimeout(() => {
    if (!window.editor) return;
    const text = window.editor.getValue();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const el = (id) => document.getElementById(id);
    if (el("wordCount")) el("wordCount").textContent = `Words: ${words}`;
    if (el("charCount")) el("charCount").textContent = `Chars: ${text.length}`;
    if (el("lineCount"))
      el("lineCount").textContent =
        `Lines: ${window.editor.getModel()?.getLineCount() || 0}`;
  }, 150);
}

function updateTitleBar() {
  const tab = TabManager.getActive();
  const name = tab ? tab.title : "Untitled";
  const modified = tab ? tab.isModified : false;

  const titleEl = document.getElementById("titleFileName");
  const dotEl = document.getElementById("modifiedDot");
  if (titleEl) titleEl.textContent = name + " — Noter";
  if (dotEl) dotEl.style.display = modified ? "inline" : "none";
}

// ── Breadcrumb navigation ─────────────────────────────────────
function updateBreadcrumb() {
  const crumb = document.getElementById("breadcrumb");
  if (!crumb) return;
  const tab = TabManager.getActive();
  if (!tab || !tab.filePath) {
    crumb.innerHTML = `<span class="crumb-item crumb-active">Untitled</span>`;
    return;
  }

  const fp = tab.filePath.replace(/\\/g, "/");
  const root = (explorerState.rootPath || "").replace(/\\/g, "/");
  const parts = fp.split("/").filter(Boolean);

  let displayParts;
  if (root && fp.startsWith(root)) {
    const rootParts = root.split("/").filter(Boolean);
    displayParts = [
      { label: rootParts[rootParts.length - 1] || root, isRoot: true },
      ...parts.slice(rootParts.length).map((p, i, arr) => ({
        label: p,
        isLast: i === arr.length - 1,
      })),
    ];
  } else {
    displayParts = parts.map((p, i) => ({
      label: p,
      isLast: i === parts.length - 1,
    }));
  }

  crumb.innerHTML = displayParts
    .map((p, i) => {
      const cls = p.isLast ? "crumb-item crumb-active" : "crumb-item";
      const sep =
        i < displayParts.length - 1 ? `<span class="crumb-sep">›</span>` : "";
      return `<span class="${cls}">${p.label}</span>${sep}`;
    })
    .join("");
}

// ── Zen Mode ──────────────────────────────────────────────────
function toggleZenMode(force) {
  zenModeActive = force !== undefined ? force : !zenModeActive;
  document.body.classList.toggle("zen-mode", zenModeActive);
  if (zenModeActive) {
    showToast("Zen Mode — press Escape or Alt+Z to exit", "info", 2800);
  }
  setTimeout(() => window.editor?.layout(), 60);
}

// ── Quick Open palette (Ctrl+P) ───────────────────────────────
const QuickOpen = (() => {
  let visible = false;
  let wsFiles = [];
  let wsFilesTs = 0;
  let selIdx = 0;
  let filtered = [];
  const CACHE_MS = 8000;

  function ensureOverlay() {
    if (document.getElementById("qo-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "qo-overlay";
    overlay.innerHTML = `
      <div id="qo-box">
        <div id="qo-header">
          <span>Quick Open</span>
          <kbd>Esc to close</kbd>
        </div>
        <input id="qo-input" type="text" placeholder="Search files by name…"
               autocomplete="off" spellcheck="false"/>
        <div id="qo-list"></div>
      </div>`;
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) hide();
    });
    document.body.appendChild(overlay);
    document.getElementById("qo-input").addEventListener("input", filterList);
    document.getElementById("qo-input").addEventListener("keydown", onKey);
  }

  async function getFiles() {
    const now = Date.now();
    if (now - wsFilesTs < CACHE_MS) return wsFiles;
    wsFilesTs = now;
    wsFiles = [];
    if (explorerState.rootPath && window.electronAPI.listWorkspaceFiles) {
      wsFiles = await window.electronAPI
        .listWorkspaceFiles(explorerState.rootPath)
        .catch(() => []);
    }
    return wsFiles;
  }

  function buildItems(files) {
    const openPaths = new Set(
      TabManager.tabs.map((t) => t.filePath).filter(Boolean),
    );

    // Open tabs first
    const tabItems = TabManager.tabs.map((t) => ({
      label: t.title,
      subLabel: t.filePath || "",
      isTab: true,
      modified: t.isModified,
      action: () => TabManager.activate(t.id),
    }));

    // Workspace files that aren't already open
    const wsItems = files
      .filter((f) => !openPaths.has(f))
      .map((f) => ({
        label: basename(f),
        subLabel: f,
        isTab: false,
        action: () => openFileFromExplorer(f),
      }));

    return [...tabItems, ...wsItems];
  }

  async function filterList() {
    const q = (document.getElementById("qo-input")?.value || "")
      .trim()
      .toLowerCase();
    const files = await getFiles();
    const all = buildItems(files);

    filtered = q
      ? all.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            it.subLabel.toLowerCase().includes(q),
        )
      : all;
    selIdx = 0;
    render();
  }

  function render() {
    const list = document.getElementById("qo-list");
    if (!list) return;
    list.innerHTML = "";

    if (filtered.length === 0) {
      list.innerHTML = `<div class="qo-empty">No files found</div>`;
      return;
    }

    filtered.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = "qo-item" + (i === selIdx ? " qo-sel" : "");
      const dot = item.modified ? `<span class="qo-modified">●</span>` : "";
      el.innerHTML =
        `<span class="qo-label">${dot}${item.label}</span>` +
        (item.subLabel ? `<span class="qo-path">${item.subLabel}</span>` : "");
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

    const sel = list.querySelector(".qo-sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
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
    const item = filtered[i];
    if (!item) return;
    hide();
    setTimeout(() => {
      item.action();
    }, 30);
  }

  async function show() {
    ensureOverlay();
    const overlay = document.getElementById("qo-overlay");
    const input = document.getElementById("qo-input");
    overlay.classList.add("qo-visible");
    visible = true;
    input.value = "";
    selIdx = 0;

    // Start fetching files in background then render open tabs immediately
    filtered = buildItems([]);
    render();
    input.focus();

    // Then update with workspace files
    const files = await getFiles();
    if (visible) {
      await filterList();
    }
  }

  function hide() {
    visible = false;
    document.getElementById("qo-overlay")?.classList.remove("qo-visible");
    window.editor?.focus();
  }

  function toggle() {
    const overlay = document.getElementById("qo-overlay");
    overlay?.classList.contains("qo-visible") ? hide() : show();
  }

  return { show, hide, toggle };
})();

// ── File change watcher listener ──────────────────────────────
window.electronAPI?.onFileExternalChange?.((filePath) => {
  const tab = TabManager.tabs.find((t) => t.filePath === filePath);
  if (!tab) return;

  const name = basename(filePath);
  const isActive = tab.id === TabManager.activeId;

  if (!tab.isModified) {
    // Auto-reload if no unsaved changes
    window.electronAPI.openFileByPath(filePath).then((file) => {
      if (!file) return;
      tab.model.setValue(file.content);
      tab.isModified = false;
      if (isActive) {
        renderTabs();
        updateTitleBar();
        updateCounts();
      }
      showToast(`${name} reloaded (changed on disk)`, "info", 2200);
    });
  } else {
    // Has unsaved changes — show a persistent notification
    showToast(
      `${name} changed on disk (has unsaved edits — save to keep yours)`,
      "info",
      5000,
    );
  }
});

// ═══════════════════════════════════════════════════════════════
//  WORKSPACE MANAGER
//  Manages noter.workspace metadata file inside the workspace
//  folder and the global recent-workspaces list.
// ═══════════════════════════════════════════════════════════════
const WorkspaceManager = (() => {
  let _path = null;
  let _saveTimer = null;

  function getCurrentPath() {
    return _path;
  }

  // Set current path without writing (used during session restore)
  function setCurrentPath(p) {
    _path = p;
  }

  function _buildMeta() {
    const tabs = TabManager.tabs
      .map((t) => {
        if (!t.filePath) {
          const content = t.model?.getValue() || "";
          if (!content.trim() && !t.isModified) return null;
          return {
            filePath: null,
            isActive: t.id === TabManager.activeId,
            untitledContent: content,
            language: t.language,
          };
        }
        return { filePath: t.filePath, isActive: t.id === TabManager.activeId };
      })
      .filter(Boolean);

    return {
      version: 2,
      name: _path ? basename(_path) : "Workspace",
      path: _path,
      lastOpenedAt: new Date().toISOString(),
      tabs,
      explorer: { expandedPaths: [...explorerState.expandedPaths] },
      ui: { sidebarVisible, sidebarWidth },
      editor: { fontSize: editorFontSize, wordWrap: wordWrapEnabled },
    };
  }

  // Debounced write to noter.workspace file
  function scheduleSave() {
    if (!_path) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      if (!_path) return;
      await window.electronAPI.workspaceWriteMeta(_path, _buildMeta());
    }, 1000);
  }

  // Immediately write workspace file + update recent workspaces list
  async function activate(folderPath, extra = {}) {
    _path = folderPath;
    const entry = {
      name: extra.name || basename(folderPath),
      path: folderPath,
      lastOpenedAt: new Date().toISOString(),
      template: extra.template || null,
    };
    await window.electronAPI.addRecentWorkspace(entry);
    await window.electronAPI.workspaceWriteMeta(folderPath, _buildMeta());
  }

  function deactivate() {
    _path = null;
    clearTimeout(_saveTimer);
  }

  return { getCurrentPath, setCurrentPath, scheduleSave, activate, deactivate };
})();

// ═══════════════════════════════════════════════════════════════
//  SIDEBAR / EXPLORER
// ═══════════════════════════════════════════════════════════════
const explorerState = {
  rootPath: null,
  expandedPaths: new Set(),
};

function toggleSidebar(force) {
  sidebarVisible = force !== undefined ? force : !sidebarVisible;

  const sidebar = document.getElementById("sidebar");
  const handle = document.getElementById("resize-handle");
  const btn = document.getElementById("sidebar-toggle");

  if (sidebarVisible) {
    sidebar.classList.remove("hidden");
    sidebar.style.width = sidebarWidth + "px";
    if (handle) handle.style.display = "";
  } else {
    sidebar.classList.add("hidden");
    if (handle) handle.style.display = "none";
  }

  if (btn) btn.classList.toggle("active", sidebarVisible);
  saveSessionState();
}

async function openExplorerFolder(folderPath) {
  if (!folderPath) return;

  // Stop watching old workspace before switching
  if (explorerState.rootPath && explorerState.rootPath !== folderPath) {
    window.electronAPI?.unwatchWorkspace?.(explorerState.rootPath);
  }

  explorerState.rootPath = folderPath;

  document.getElementById("no-folder-msg").style.display = "none";
  const content = document.getElementById("explorer-content");
  content.style.display = "flex";

  const nameEl = document.getElementById("folder-name");
  if (nameEl) nameEl.textContent = basename(folderPath).toUpperCase();

  const tree = document.getElementById("explorer-tree");
  tree.innerHTML = "";
  await loadExplorerChildren(folderPath, tree, 0);

  // Auto-show sidebar
  if (!sidebarVisible) toggleSidebar(true);

  // Sync terminal cwd with opened folder
  if (typeof TerminalPanel !== "undefined") TerminalPanel.setCwd(folderPath);

  // Phase 4 — start filesystem watcher for auto-refresh
  window.electronAPI?.watchWorkspace?.(folderPath);

  // Phase 4 — signal IntelliSense to index the workspace
  document.dispatchEvent(
    new CustomEvent("workspace-opened", { detail: { path: folderPath } }),
  );

  saveSessionState();
}

async function refreshExplorer() {
  if (!explorerState.rootPath) return;
  const tree = document.getElementById("explorer-tree");
  tree.innerHTML = "";
  await loadExplorerChildren(explorerState.rootPath, tree, 0);
}

// Phase 4 — smart refresh that preserves scroll + active-file highlight
let _explorerRefreshTimer = null;
async function refreshExplorerPreserved() {
  if (!explorerState.rootPath) return;
  // Debounce rapid filesystem bursts (e.g. npm install writing many files)
  clearTimeout(_explorerRefreshTimer);
  _explorerRefreshTimer = setTimeout(async () => {
    const sidebar = document.getElementById("sidebar");
    const scrollTop = sidebar ? sidebar.scrollTop : 0;
    await refreshExplorer();
    requestAnimationFrame(() => {
      if (sidebar) sidebar.scrollTop = scrollTop;
      updateExplorerActiveFile();
    });
  }, 400);
}

async function loadExplorerChildren(dirPath, container, depth) {
  container.innerHTML = `<div class="explorer-row" style="padding-left:${depth * 16 + 24}px">
       <span style="color:var(--overlay0);font-size:11px">Loading…</span>
     </div>`;

  const entries = await window.electronAPI.readDirectory(dirPath);
  container.innerHTML = "";

  if (!entries) {
    container.innerHTML = `<div class="explorer-row" style="padding-left:${depth * 16 + 24}px">
         <span style="color:var(--red);font-size:11px">Cannot read folder</span>
       </div>`;
    return;
  }

  for (const entry of entries) {
    container.appendChild(createExplorerItem(entry, depth));
  }
}

// ── Explorer Drag & Drop state ────────────────────────────────
const ExplorerDnD = (() => {
  let dragPath = null;
  let dragType = null; // "file" | "directory"
  let dropTarget = null;

  function clearHighlights() {
    document
      .querySelectorAll(".explorer-row.dnd-over")
      .forEach((r) => r.classList.remove("dnd-over"));
    document
      .querySelectorAll(".explorer-row.dnd-over-file")
      .forEach((r) => r.classList.remove("dnd-over-file"));
  }

  function getDropDir(row) {
    const isFolder = !!row.querySelector(".explorer-toggle");
    if (isFolder) return row.dataset.path;
    const p = row.dataset.path;
    const sep = p.includes("\\") ? "\\" : "/";
    return p.substring(0, p.lastIndexOf(sep));
  }

  function onDragStart(e, path, type) {
    dragPath = path;
    dragType = type;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", path);
    e.currentTarget.style.opacity = "0.5";
  }

  function onDragEnd(e) {
    dragPath = null;
    dragType = null;
    e.currentTarget.style.opacity = "";
    clearHighlights();
  }

  function onDragOver(e, row) {
    if (!dragPath) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    clearHighlights();
    const isFolder = !!row.querySelector(".explorer-toggle");
    row.classList.add(isFolder ? "dnd-over" : "dnd-over-file");
    dropTarget = row;
  }

  function onDragLeave(e, row) {
    row.classList.remove("dnd-over", "dnd-over-file");
  }

  async function onDrop(e, row) {
    e.preventDefault();
    clearHighlights();
    if (!dragPath) return;

    const destDir = getDropDir(row);
    const sep = dragPath.includes("\\") ? "\\" : "/";
    const name = dragPath.split(sep).pop();
    const newPath = destDir + sep + name;

    if (newPath === dragPath) return;
    if (newPath.startsWith(dragPath + sep)) {
      showToast("Cannot move a folder into itself", "error");
      return;
    }

    const ok = await window.electronAPI.fsRename(dragPath, newPath);
    if (ok) {
      // Update open tabs
      TabManager.tabs.forEach((t) => {
        if (t.filePath === dragPath) {
          t.filePath = newPath;
          t.title = basename(newPath);
          t.language = getLang(newPath);
          if (typeof monaco !== "undefined")
            monaco.editor.setModelLanguage(t.model, t.language);
        } else if (t.filePath && t.filePath.startsWith(dragPath + sep)) {
          t.filePath = newPath + t.filePath.slice(dragPath.length);
          t.title = basename(t.filePath);
        }
      });
      renderTabs();
      updateStatusBar();
      updateTitleBar();
      refreshExplorer();
      showToast(`Moved: ${name}`, "success");
    } else {
      showToast("Move failed", "error");
    }
    dragPath = null;
  }

  return { onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop };
})();

function createExplorerItem(entry, depth) {
  const wrapper = document.createElement("div");

  if (entry.type === "directory") {
    // ── Directory row ──────────────────────────────
    const row = document.createElement("div");
    row.className = "explorer-row";
    row.dataset.path = entry.path;
    row.draggable = true;
    row.innerHTML =
      `<span class="explorer-indent" style="width:${depth * 16 + 6}px"></span>` +
      `<span class="explorer-toggle">▶</span>` +
      `<span class="explorer-file-icon" style="color:var(--yellow)">📁</span>` +
      `<span class="explorer-name">${entry.name}</span>`;

    const childrenContainer = document.createElement("div");

    const isExpanded = explorerState.expandedPaths.has(entry.path);
    if (isExpanded) {
      row.querySelector(".explorer-toggle").classList.add("open");
      row.querySelector(".explorer-file-icon").textContent = "📂";
      loadExplorerChildren(entry.path, childrenContainer, depth + 1);
    }

    row.addEventListener("click", async () => {
      const open = row
        .querySelector(".explorer-toggle")
        .classList.contains("open");
      if (open) {
        row.querySelector(".explorer-toggle").classList.remove("open");
        row.querySelector(".explorer-file-icon").textContent = "📁";
        childrenContainer.innerHTML = "";
        explorerState.expandedPaths.delete(entry.path);
      } else {
        row.querySelector(".explorer-toggle").classList.add("open");
        row.querySelector(".explorer-file-icon").textContent = "📂";
        explorerState.expandedPaths.add(entry.path);
        await loadExplorerChildren(entry.path, childrenContainer, depth + 1);
      }
    });

    // DnD — directory can be dragged AND is a drop target
    row.addEventListener("dragstart", (e) =>
      ExplorerDnD.onDragStart(e, entry.path, "directory"),
    );
    row.addEventListener("dragend", (e) => ExplorerDnD.onDragEnd(e));
    row.addEventListener("dragover", (e) => ExplorerDnD.onDragOver(e, row));
    row.addEventListener("dragleave", (e) => ExplorerDnD.onDragLeave(e, row));
    row.addEventListener("drop", (e) => ExplorerDnD.onDrop(e, row));

    wrapper.appendChild(row);
    wrapper.appendChild(childrenContainer);
  } else {
    // ── File row ───────────────────────────────────
    const color = getFileColor(entry.name);
    const row = document.createElement("div");
    row.className = "explorer-row";
    row.dataset.path = entry.path;
    row.draggable = true;
    row.innerHTML =
      `<span class="explorer-indent" style="width:${depth * 16 + 22}px"></span>` +
      `<span class="explorer-file-icon" style="color:${color}">◦</span>` +
      `<span class="explorer-name" style="color:${color}">${entry.name}</span>`;

    row.addEventListener("click", () => openFileFromExplorer(entry.path));

    // DnD — file can be dragged and dropped onto folders
    row.addEventListener("dragstart", (e) =>
      ExplorerDnD.onDragStart(e, entry.path, "file"),
    );
    row.addEventListener("dragend", (e) => ExplorerDnD.onDragEnd(e));
    row.addEventListener("dragover", (e) => ExplorerDnD.onDragOver(e, row));
    row.addEventListener("dragleave", (e) => ExplorerDnD.onDragLeave(e, row));
    row.addEventListener("drop", (e) => ExplorerDnD.onDrop(e, row));

    wrapper.appendChild(row);
  }

  return wrapper;
}

async function openFileFromExplorer(filePath) {
  // If already open in a tab — just switch
  const existing = TabManager.tabs.find((t) => t.filePath === filePath);
  if (existing) {
    TabManager.activate(existing.id);
    return;
  }

  const file = await window.electronAPI.openFileByPath(filePath);
  if (!file) {
    showToast("Could not open: " + basename(filePath), "error");
    return;
  }

  const lang = getLang(filePath);
  const tab = TabManager.create(filePath, file.content, lang);
  TabManager.activate(tab.id);
  addToRecentFiles(filePath);
  window.electronAPI?.watchFile?.(filePath);
}

function updateExplorerActiveFile() {
  const activePath = TabManager.getActive()?.filePath;
  document.querySelectorAll(".explorer-row[data-path]").forEach((row) => {
    row.classList.toggle("active-file", row.dataset.path === activePath);
  });
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 4 — WORKSPACE FILESYSTEM WATCHER → explorer auto-refresh
// ═══════════════════════════════════════════════════════════════
if (window.electronAPI?.onWorkspaceChange) {
  window.electronAPI.onWorkspaceChange(({ folderPath, filename }) => {
    // Only refresh if this event belongs to the currently open workspace
    if (explorerState.rootPath && folderPath === explorerState.rootPath) {
      refreshExplorerPreserved();
      // Also trigger IntelliSense re-index after a short delay
      if (typeof IntelliSense !== "undefined") {
        IntelliSense.reindexWorkspace();
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  SIDEBAR RESIZE (drag handle)
// ═══════════════════════════════════════════════════════════════
(function initResizeHandle() {
  const handle = document.getElementById("resize-handle");
  const sidebar = document.getElementById("sidebar");
  let dragging = false,
    startX = 0,
    startW = 0;

  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add("dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMove = (e) => {
      if (!dragging) return;
      const w = Math.min(Math.max(startW + (e.clientX - startX), 150), 520);
      sidebarWidth = w;
      sidebar.style.width = w + "px";
    };
    const onUp = () => {
      dragging = false;
      handle.classList.remove("dragging");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      saveSessionState();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
})();

// ═══════════════════════════════════════════════════════════════
//  RECENT FILES  (localStorage)
// ═══════════════════════════════════════════════════════════════
function getRecentFiles() {
  try {
    return JSON.parse(localStorage.getItem("recentFiles") || "[]");
  } catch {
    return [];
  }
}

function addToRecentFiles(filePath) {
  let list = getRecentFiles();
  list = [filePath, ...list.filter((f) => f !== filePath)].slice(0, 10);
  localStorage.setItem("recentFiles", JSON.stringify(list));
  renderRecentFiles();
}

function renderRecentFiles() {
  const submenu = document.getElementById("recentFilesSubmenu");
  if (!submenu) return;
  submenu.innerHTML = "";

  const list = getRecentFiles();
  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "menu-option disabled";
    empty.textContent = "No recent files";
    submenu.appendChild(empty);
  } else {
    list.forEach((fp) => {
      const item = document.createElement("div");
      item.className = "menu-option";
      item.textContent = basename(fp);
      item.title = fp;
      item.addEventListener("click", async (e) => {
        e.stopPropagation();
        await openFileByPath(fp);
        closeAllMenus();
      });
      submenu.appendChild(item);
    });
    const sep = document.createElement("div");
    sep.className = "separator";
    submenu.appendChild(sep);
  }

  const clearBtn = document.createElement("div");
  clearBtn.className = "menu-option";
  clearBtn.textContent = "Clear Recent";
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    localStorage.removeItem("recentFiles");
    renderRecentFiles();
    closeAllMenus();
  });
  submenu.appendChild(clearBtn);
}

async function openFileByPath(fp) {
  const existing = TabManager.tabs.find((t) => t.filePath === fp);
  if (existing) {
    TabManager.activate(existing.id);
    return;
  }

  const file = await window.electronAPI.openFileByPath(fp);
  if (!file) {
    showToast("Could not open: " + basename(fp), "error");
    return;
  }

  const lang = getLang(fp);
  const tab = TabManager.create(fp, file.content, lang);
  TabManager.activate(tab.id);
  addToRecentFiles(fp);
  window.electronAPI?.watchFile?.(fp);
}

// ═══════════════════════════════════════════════════════════════
//  SESSION STATE  (localStorage — auto-saved on every change)
// ═══════════════════════════════════════════════════════════════
let _sessionTimer = null;
function saveSessionState() {
  clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(() => {
    // Build tab list: skip empty untitled tabs so they don't pollute future sessions.
    // Untitled tabs with actual content are saved with their content so they survive restarts.
    const tabs = TabManager.tabs
      .map((t) => {
        if (!t.filePath) {
          const content = t.model?.getValue() || "";
          if (!content.trim() && !t.isModified) return null; // skip empty untitled
          return {
            filePath: null,
            isActive: t.id === TabManager.activeId,
            untitledContent: content,
            language: t.language,
          };
        }
        return { filePath: t.filePath, isActive: t.id === TabManager.activeId };
      })
      .filter(Boolean);

    const state = {
      explorerPath: explorerState.rootPath,
      expandedPaths: [...explorerState.expandedPaths],
      sidebarVisible,
      sidebarWidth,
      fontSize: editorFontSize,
      wordWrap: wordWrapEnabled,
      tabs,
    };
    localStorage.setItem("noterSession", JSON.stringify(state));
    WorkspaceManager.scheduleSave();
  }, 500);
}

async function restoreSessionState() {
  try {
    const raw = localStorage.getItem("noterSession");
    if (!raw) return false;
    const s = JSON.parse(raw);

    // Settings
    sidebarVisible = s.sidebarVisible ?? true;
    sidebarWidth = s.sidebarWidth ?? 220;
    editorFontSize = s.fontSize ?? 18;
    wordWrapEnabled = s.wordWrap ?? true;

    // Apply sidebar state immediately (before Monaco)
    const sidebar = document.getElementById("sidebar");
    const handle = document.getElementById("resize-handle");
    const btn = document.getElementById("sidebar-toggle");
    if (!sidebarVisible) {
      sidebar.classList.add("hidden");
      if (handle) handle.style.display = "none";
    } else {
      sidebar.style.width = sidebarWidth + "px";
    }
    if (btn) btn.classList.toggle("active", sidebarVisible);

    // Restore explorer folder
    if (s.explorerPath) {
      explorerState.expandedPaths = new Set(s.expandedPaths || []);
      await openExplorerFolder(s.explorerPath);
      // Register this workspace path so future saves write the workspace file
      WorkspaceManager.setCurrentPath(s.explorerPath);
      window.electronAPI.addRecentWorkspace({
        name: basename(s.explorerPath),
        path: s.explorerPath,
        lastOpenedAt: new Date().toISOString(),
      });
    }

    // Restore tabs — suppress auto-blank while restoring
    TabManager._suppressAutoBlank = true;
    let restoredAny = false;
    if (Array.isArray(s.tabs) && s.tabs.length > 0) {
      for (const t of s.tabs) {
        if (t.filePath) {
          const file = await window.electronAPI.openFileByPath(t.filePath);
          if (file) {
            const tab = TabManager.create(
              file.filePath,
              file.content,
              getLang(file.filePath),
            );
            if (t.isActive) {
              TabManager.activate(tab.id);
              restoredAny = true;
            }
            window.electronAPI?.watchFile?.(t.filePath);
          }
        } else {
          // Restore untitled tab with its saved content
          const content = t.untitledContent || "";
          const lang = t.language || "plaintext";
          const tab = TabManager.create(null, content, lang);
          if (t.isActive) {
            TabManager.activate(tab.id);
            restoredAny = true;
          }
        }
      }
      if (!restoredAny && TabManager.tabs.length > 0) {
        TabManager.activate(TabManager.tabs[0].id);
        restoredAny = true;
      }
    }
    TabManager._suppressAutoBlank = false;

    return TabManager.tabs.length > 0;
  } catch (err) {
    console.warn("Session restore failed:", err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  PROJECT TEMPLATES
// ═══════════════════════════════════════════════════════════════
const LANGUAGE_TEMPLATES = [
  {
    id: "nodejs",
    label: "Node.js",
    icon: "⬢",
    desc: "npm · index.js",
    color: "#a6e3a1",
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "my-project",
            version: "1.0.0",
            description: "",
            main: "index.js",
            scripts: { start: "node index.js", test: 'echo "No tests yet"' },
            keywords: [],
            author: "",
            license: "ISC",
          },
          null,
          2,
        ),
      },
      {
        path: "index.js",
        content: '// Entry point\nconsole.log("Hello, World!");\n',
      },
      { path: "src/app.js", content: "// Application code\n" },
      { path: ".gitignore", content: "node_modules/\n.env\n*.log\n" },
      { path: ".env", content: "# Environment variables\n# PORT=3000\n" },
      {
        path: "README.md",
        content:
          "# My Node.js Project\n\n## Setup\n\n```bash\nnpm install\nnpm start\n```\n",
      },
    ],
  },
  {
    id: "python",
    label: "Python",
    icon: "🐍",
    desc: "venv · pip",
    color: "#89b4fa",
    files: [
      {
        path: "main.py",
        content:
          'def main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n',
      },
      {
        path: "requirements.txt",
        content: "# Add dependencies here\n# requests==2.31.0\n",
      },
      {
        path: ".gitignore",
        content: "__pycache__/\nvenv/\n.env\n*.pyc\n*.pyo\n.pytest_cache/\n",
      },
      { path: ".env", content: "# Environment variables\n# DEBUG=true\n" },
      {
        path: "README.md",
        content:
          "# My Python Project\n\n## Setup\n\n```bash\npython -m venv venv\n# Windows:\nvenv\\Scripts\\activate\n# Mac/Linux:\nsource venv/bin/activate\npip install -r requirements.txt\n```\n\n## Run\n\n```bash\npython main.py\n```\n",
      },
    ],
    setup: "python -m venv venv",
  },
  {
    id: "react",
    label: "React",
    icon: "⚛",
    desc: "Vite · JSX",
    color: "#89dceb",
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "my-react-app",
            version: "0.1.0",
            private: true,
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
            devDependencies: {
              "@vitejs/plugin-react": "^4.0.0",
              vite: "^5.0.0",
            },
          },
          null,
          2,
        ),
      },
      {
        path: "vite.config.js",
        content:
          "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n",
      },
      {
        path: "index.html",
        content:
          '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>React App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n',
      },
      {
        path: "src/main.jsx",
        content:
          "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n",
      },
      {
        path: "src/App.jsx",
        content:
          "import './App.css'\n\nfunction App() {\n  return (\n    <div className=\"App\">\n      <h1>Hello React!</h1>\n    </div>\n  )\n}\n\nexport default App\n",
      },
      {
        path: "src/index.css",
        content: "* { box-sizing: border-box; margin: 0; padding: 0; }\n",
      },
      {
        path: "src/App.css",
        content: ".App { text-align: center; padding: 2rem; }\n",
      },
      { path: ".gitignore", content: "node_modules/\ndist/\n.env\n*.local\n" },
      {
        path: "README.md",
        content:
          "# My React App\n\n## Setup\n\n```bash\nnpm install\nnpm run dev\n```\n",
      },
    ],
    hint: "Run `npm install` then `npm run dev` to start",
  },
  {
    id: "html",
    label: "HTML/CSS/JS",
    icon: "🌐",
    desc: "Vanilla web",
    color: "#fab387",
    files: [
      {
        path: "index.html",
        content:
          '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>My Project</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <script src="script.js"></script>\n</body>\n</html>\n',
      },
      {
        path: "style.css",
        content:
          "* { box-sizing: border-box; margin: 0; padding: 0; }\n\nbody {\n  font-family: sans-serif;\n  background: #1e1e2e;\n  color: #cdd6f4;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n}\n",
      },
      {
        path: "script.js",
        content: '// JavaScript code\nconsole.log("Hello, World!");\n',
      },
      {
        path: "README.md",
        content:
          "# My Web Project\n\nOpen `index.html` in a browser to get started.\n",
      },
    ],
  },
  {
    id: "vue",
    label: "Vue.js",
    icon: "💚",
    desc: "Vite · SFC",
    color: "#a6e3a1",
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "my-vue-app",
            version: "0.0.0",
            private: true,
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: { vue: "^3.3.0" },
            devDependencies: { "@vitejs/plugin-vue": "^4.2.0", vite: "^5.0.0" },
          },
          null,
          2,
        ),
      },
      {
        path: "vite.config.js",
        content:
          "import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\n\nexport default defineConfig({\n  plugins: [vue()],\n})\n",
      },
      {
        path: "index.html",
        content:
          '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Vue App</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.js"></script>\n  </body>\n</html>\n',
      },
      {
        path: "src/main.js",
        content:
          "import { createApp } from 'vue'\nimport App from './App.vue'\n\ncreateApp(App).mount('#app')\n",
      },
      {
        path: "src/App.vue",
        content:
          "<template>\n  <div>\n    <h1>Hello Vue!</h1>\n  </div>\n</template>\n\n<script setup>\n// Component logic\n</script>\n\n<style>\nh1 { color: #a6e3a1; }\n</style>\n",
      },
      { path: ".gitignore", content: "node_modules/\ndist/\n.env\n*.local\n" },
      {
        path: "README.md",
        content:
          "# My Vue App\n\n## Setup\n\n```bash\nnpm install\nnpm run dev\n```\n",
      },
    ],
    hint: "Run `npm install` then `npm run dev` to start",
  },
  {
    id: "flask",
    label: "Flask",
    icon: "🫙",
    desc: "Python · web",
    color: "#f5c2e7",
    files: [
      {
        path: "app.py",
        content:
          "from flask import Flask, render_template\n\napp = Flask(__name__)\n\n@app.route('/')\ndef index():\n    return render_template('index.html')\n\nif __name__ == '__main__':\n    app.run(debug=True)\n",
      },
      { path: "requirements.txt", content: "flask>=3.0.0\n" },
      {
        path: "templates/index.html",
        content:
          "<!DOCTYPE html>\n<html>\n<head><title>Flask App</title></head>\n<body>\n  <h1>Hello from Flask!</h1>\n</body>\n</html>\n",
      },
      {
        path: "static/style.css",
        content: "body { font-family: sans-serif; }\n",
      },
      {
        path: ".gitignore",
        content: "__pycache__/\nvenv/\n.env\n*.pyc\ninstance/\n",
      },
      { path: ".env", content: "FLASK_ENV=development\nFLASK_DEBUG=1\n" },
      {
        path: "README.md",
        content:
          "# My Flask App\n\n## Setup\n\n```bash\npython -m venv venv\nvenv\\Scripts\\activate  # Windows\npip install -r requirements.txt\npython app.py\n```\n",
      },
    ],
    setup: "python -m venv venv",
  },
  {
    id: "java",
    label: "Java",
    icon: "☕",
    desc: "Maven project",
    color: "#f9e2af",
    files: [
      {
        path: "src/main/java/Main.java",
        content:
          'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
      },
      {
        path: "pom.xml",
        content:
          '<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0"\n         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.example</groupId>\n  <artifactId>my-project</artifactId>\n  <version>1.0-SNAPSHOT</version>\n  <properties>\n    <maven.compiler.source>17</maven.compiler.source>\n    <maven.compiler.target>17</maven.compiler.target>\n    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>\n  </properties>\n</project>\n',
      },
      {
        path: ".gitignore",
        content: "target/\n*.class\n*.jar\n.idea/\n*.iml\n",
      },
      {
        path: "README.md",
        content:
          '# My Java Project\n\n## Build & Run\n\n```bash\nmvn compile\nmvn exec:java -Dexec.mainClass="Main"\n```\n',
      },
    ],
  },
  {
    id: "c",
    label: "C",
    icon: "🔵",
    desc: "GCC · Makefile",
    color: "#89b4fa",
    files: [
      {
        path: "main.c",
        content:
          '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
      },
      {
        path: "Makefile",
        content:
          "CC = gcc\nCFLAGS = -Wall -Wextra -std=c11\nTARGET = main\n\n$(TARGET): main.c\n\t$(CC) $(CFLAGS) -o $(TARGET) main.c\n\nclean:\n\trm -f $(TARGET)\n",
      },
      { path: ".gitignore", content: "*.o\n*.out\nmain\nbuild/\n" },
      {
        path: "README.md",
        content: "# My C Project\n\n## Build\n\n```bash\nmake\n./main\n```\n",
      },
    ],
  },
  {
    id: "cpp",
    label: "C++",
    icon: "🔷",
    desc: "G++ · Makefile",
    color: "#89b4fa",
    files: [
      {
        path: "main.cpp",
        content:
          '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
      },
      {
        path: "Makefile",
        content:
          "CXX = g++\nCXXFLAGS = -Wall -Wextra -std=c++17\nTARGET = main\n\n$(TARGET): main.cpp\n\t$(CXX) $(CXXFLAGS) -o $(TARGET) main.cpp\n\nclean:\n\trm -f $(TARGET)\n",
      },
      { path: ".gitignore", content: "*.o\n*.out\nmain\nbuild/\n" },
      {
        path: "README.md",
        content: "# My C++ Project\n\n## Build\n\n```bash\nmake\n./main\n```\n",
      },
    ],
  },
  {
    id: "go",
    label: "Go",
    icon: "🐹",
    desc: "Modules · go mod",
    color: "#89dceb",
    files: [
      {
        path: "main.go",
        content:
          'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}\n',
      },
      { path: "go.mod", content: "module my-project\n\ngo 1.21\n" },
      {
        path: ".gitignore",
        content:
          "# Binaries\n*.exe\n*.exe~\n*.dll\n*.so\n*.dylib\n/bin/\n*.out\n",
      },
      {
        path: "README.md",
        content:
          "# My Go Project\n\n## Run\n\n```bash\ngo run main.go\n```\n\n## Build\n\n```bash\ngo build -o app .\n```\n",
      },
    ],
  },
  {
    id: "rust",
    label: "Rust",
    icon: "🦀",
    desc: "Cargo · crates",
    color: "#fab387",
    files: [
      {
        path: "src/main.rs",
        content: 'fn main() {\n    println!("Hello, World!");\n}\n',
      },
      {
        path: "Cargo.toml",
        content:
          '[package]\nname = "my-project"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n',
      },
      { path: ".gitignore", content: "/target/\n" },
      {
        path: "README.md",
        content:
          "# My Rust Project\n\n## Run\n\n```bash\ncargo run\n```\n\n## Build\n\n```bash\ncargo build --release\n```\n",
      },
    ],
  },
  {
    id: "blank",
    label: "Blank",
    icon: "📄",
    desc: "Empty workspace",
    color: "#585b70",
    files: [
      {
        path: "README.md",
        content: "# My Project\n\nWelcome to your new workspace.\n",
      },
    ],
  },
];

// ── Language selection modal ──────────────────────────────────
function showProjectTemplateModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "proj-modal-overlay";

    const modal = document.createElement("div");
    modal.id = "proj-modal";

    const cards = LANGUAGE_TEMPLATES.map(
      (t) =>
        `<button class="proj-lang-card" data-id="${t.id}" style="--card-color:${t.color}" title="${t.label}">
         <span class="proj-card-icon">${t.icon}</span>
         <span class="proj-card-name">${t.label}</span>
         <span class="proj-card-desc">${t.desc}</span>
       </button>`,
    ).join("");

    modal.innerHTML = `<div id="proj-modal-header">
         <h2>Choose Project Template</h2>
         <p>Select a language or framework to scaffold your project structure</p>
       </div>
       <div id="proj-modal-grid">${cards}</div>
       <div id="proj-modal-footer">
         <p>ESC or click outside to cancel</p>
         <button class="proj-cancel-btn">Cancel</button>
       </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function finish(template) {
      overlay.remove();
      resolve(template);
    }

    modal.querySelectorAll(".proj-lang-card").forEach((card) => {
      card.addEventListener("click", () => {
        const t = LANGUAGE_TEMPLATES.find((x) => x.id === card.dataset.id);
        finish(t || null);
      });
    });

    modal
      .querySelector(".proj-cancel-btn")
      .addEventListener("click", () => finish(null));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(null);
    });

    const onKey = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        finish(null);
      }
    };
    document.addEventListener("keydown", onKey);
  });
}

// ═══════════════════════════════════════════════════════════════
//  WORKSPACE  (create / save / open .noterws files)
// ═══════════════════════════════════════════════════════════════

async function createWorkspace() {
  // ── 1. Warn if any tab has unsaved changes ──────────────────
  const dirty = TabManager.tabs.filter((t) => t.isModified);
  if (dirty.length > 0) {
    const names = dirty.map((t) => t.title).join(", ");
    if (
      !confirm(`Unsaved changes in: ${names}\n\nCreate a new workspace anyway?`)
    ) {
      closeAllMenus();
      return;
    }
  }

  closeAllMenus();

  // ── 2. Show template / language selection modal ─────────────
  const selectedTemplate = await showProjectTemplateModal();
  if (selectedTemplate === null) return;

  // ── 3. Wipe current state (no auto-blank tab during reset) ──
  TabManager._suppressAutoBlank = true;
  TabManager.closeAll(true);
  WorkspaceManager.deactivate();

  explorerState.rootPath = null;
  explorerState.expandedPaths = new Set();

  const noFolderMsg = document.getElementById("no-folder-msg");
  const explorerContent = document.getElementById("explorer-content");
  const explorerTree = document.getElementById("explorer-tree");
  const folderNameEl = document.getElementById("folder-name");

  if (noFolderMsg) noFolderMsg.style.display = "";
  if (explorerContent) explorerContent.style.display = "none";
  if (explorerTree) explorerTree.innerHTML = "";
  if (folderNameEl) folderNameEl.textContent = "";

  if (!sidebarVisible) toggleSidebar(true);

  // ── 4. Pick a root folder for the workspace ─────────────────
  const folderPath = await window.electronAPI.openFolder();
  TabManager._suppressAutoBlank = false;

  if (!folderPath) {
    // User cancelled — restore a blank editing state
    const tab = TabManager.create();
    TabManager.activate(tab.id);
    return;
  }

  // ── 5. Create project files ─────────────────────────────────
  const result = await window.electronAPI.createProjectStructure({
    folderPath,
    files: selectedTemplate.files,
    setupCommand: selectedTemplate.setup || null,
  });

  if (result.success) {
    let msg = `${selectedTemplate.label} project ready · ${result.filesCreated} files created`;
    if (result.setupDone) msg += " · environment setup done ✓";
    else if (result.setupError) msg += " · (run setup manually)";
    showToast(msg, "success", 4500);
    if (selectedTemplate.hint)
      setTimeout(() => showToast(selectedTemplate.hint, "info", 5000), 4600);
  } else {
    showToast(
      "Could not create project files: " + (result.error || "unknown error"),
      "error",
    );
  }

  // ── 6. Open the folder in explorer ─────────────────────────
  await openExplorerFolder(folderPath);

  // ── 7. Auto-create noter.workspace file + add to recent list ──
  await WorkspaceManager.activate(folderPath, {
    template: selectedTemplate.id,
  });

  // ── 8. Open the main entry-point file for this template ─────
  const sep = folderPath.includes("\\") ? "\\" : "/";
  const mainFile =
    selectedTemplate.files.find((f) => !f.path.includes("/")) ||
    selectedTemplate.files[0];
  if (mainFile) {
    const absPath = folderPath + sep + mainFile.path.replace(/\//g, sep);
    await openFileFromExplorer(absPath);
  } else {
    const tab = TabManager.create();
    TabManager.activate(tab.id);
  }

  showToast(`Workspace: ${basename(folderPath)}`, "info", 2000);
  window.editor?.focus();
}

async function saveWorkspace() {
  // Save workspace state to noter.workspace in the current workspace folder
  const wsPath = WorkspaceManager.getCurrentPath();
  if (!wsPath) {
    showToast("No workspace active. Open a folder first.", "info");
    closeAllMenus();
    return;
  }
  const ok = await window.electronAPI.workspaceWriteMeta(
    wsPath,
    _buildWorkspaceMeta(),
  );
  if (ok) showToast("Workspace saved", "success");
  else showToast("Workspace save failed", "error");
  closeAllMenus();
}

// Shared meta builder for saveWorkspace (mirrors WorkspaceManager._buildMeta but accessible here)
function _buildWorkspaceMeta() {
  const tabs = TabManager.tabs
    .map((t) => {
      if (!t.filePath) {
        const content = t.model?.getValue() || "";
        if (!content.trim() && !t.isModified) return null;
        return {
          filePath: null,
          isActive: t.id === TabManager.activeId,
          untitledContent: content,
          language: t.language,
        };
      }
      return { filePath: t.filePath, isActive: t.id === TabManager.activeId };
    })
    .filter(Boolean);

  const wsPath = WorkspaceManager.getCurrentPath();
  return {
    version: 2,
    name: wsPath ? basename(wsPath) : "Workspace",
    path: wsPath,
    lastOpenedAt: new Date().toISOString(),
    tabs,
    explorer: { expandedPaths: [...explorerState.expandedPaths] },
    ui: { sidebarVisible, sidebarWidth },
    editor: { fontSize: editorFontSize, wordWrap: wordWrapEnabled },
  };
}

async function openWorkspace() {
  // Show the recent-workspaces overlay (replaces the old .noterws file picker)
  closeAllMenus();
  await showRecentWorkspacesOverlay();
}

// ═══════════════════════════════════════════════════════════════
//  WORKSPACE OPEN HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Show the "Open Workspace" overlay with the recent-workspaces list.
 * Each entry lets the user click to restore the full workspace state.
 * An "Open Folder…" button lets the user browse for any folder.
 */
async function showRecentWorkspacesOverlay() {
  const recents = await window.electronAPI.getRecentWorkspaces();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "ws-overlay";

    function buildListHTML(list) {
      if (!list.length) {
        return `<div class="ws-empty">No recent workspaces.<br>Open a folder to get started.</div>`;
      }
      return list
        .map((ws, i) => {
          const name = ws.name || basename(ws.path);
          const date = ws.lastOpenedAt
            ? new Date(ws.lastOpenedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "";
          const safePath = ws.path
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;");
          return `
          <div class="ws-item" data-idx="${i}" data-path="${safePath}">
            <div class="ws-item-icon">📁</div>
            <div class="ws-item-info">
              <div class="ws-item-name">${name}</div>
              <div class="ws-item-path">${ws.path}</div>
              ${date ? `<div class="ws-item-date">Last opened ${date}</div>` : ""}
            </div>
            <button class="ws-item-remove" data-path="${safePath}" title="Remove from list">×</button>
          </div>`;
        })
        .join("");
    }

    const hasClear = recents.length > 0;
    overlay.innerHTML = `
      <div id="ws-modal">
        <div id="ws-modal-header">
          <h2>Open Workspace</h2>
          <p>Select a recent workspace or open a folder</p>
        </div>
        <div id="ws-modal-list">${buildListHTML(recents)}</div>
        <div id="ws-modal-footer">
          <button id="ws-open-folder-btn" class="ws-btn ws-btn-primary">Open Folder…</button>
          ${hasClear ? `<button id="ws-clear-btn" class="ws-btn ws-btn-danger">Clear Recent</button>` : ""}
          <button id="ws-cancel-btn" class="ws-btn">Cancel</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    function dismiss() {
      overlay.remove();
      resolve();
    }

    // Click on a workspace entry
    overlay.querySelectorAll(".ws-item").forEach((el) => {
      el.addEventListener("click", async (e) => {
        if (e.target.classList.contains("ws-item-remove")) return;
        dismiss();
        await loadWorkspaceFromFolder(el.dataset.path);
      });
    });

    // Remove individual entry
    overlay.querySelectorAll(".ws-item-remove").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await window.electronAPI.removeRecentWorkspace(btn.dataset.path);
        btn.closest(".ws-item").remove();
        const listEl = overlay.querySelector("#ws-modal-list");
        if (!listEl.querySelector(".ws-item")) {
          listEl.innerHTML = `<div class="ws-empty">No recent workspaces.<br>Open a folder to get started.</div>`;
          overlay.querySelector("#ws-clear-btn")?.remove();
        }
      });
    });

    // Open folder browser
    document
      .getElementById("ws-open-folder-btn")
      .addEventListener("click", async () => {
        dismiss();
        const folderPath = await window.electronAPI.openFolder();
        if (folderPath) await openFolderAsWorkspace(folderPath);
      });

    // Clear all recent
    document
      .getElementById("ws-clear-btn")
      ?.addEventListener("click", async () => {
        await window.electronAPI.clearRecentWorkspaces();
        overlay.querySelector("#ws-modal-list").innerHTML =
          `<div class="ws-empty">No recent workspaces.<br>Open a folder to get started.</div>`;
        document.getElementById("ws-clear-btn")?.remove();
      });

    // Cancel
    document.getElementById("ws-cancel-btn").addEventListener("click", dismiss);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) dismiss();
    });

    const onKey = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        dismiss();
      }
    };
    document.addEventListener("keydown", onKey);
  });
}

/**
 * Restore a workspace in full from its noter.workspace file.
 * Closes all current tabs, applies saved settings, reopens saved tabs.
 */
async function loadWorkspaceFromFolder(folderPath) {
  const meta = await window.electronAPI.workspaceReadMeta(folderPath);

  // ── Close current state ──────────────────────────────────────
  TabManager._suppressAutoBlank = true;
  TabManager.closeAll(true);
  WorkspaceManager.deactivate();

  // ── Apply settings from meta ─────────────────────────────────
  if (meta) {
    if (meta.editor?.fontSize) {
      editorFontSize = meta.editor.fontSize;
      window.editor?.updateOptions({ fontSize: editorFontSize });
      updateZoomStatus();
    }
    if (meta.editor?.wordWrap !== undefined) {
      wordWrapEnabled = meta.editor.wordWrap;
      window.editor?.updateOptions({
        wordWrap: wordWrapEnabled ? "on" : "off",
      });
      updateWrapStatus();
    }
    if (meta.ui?.sidebarVisible !== undefined)
      sidebarVisible = meta.ui.sidebarVisible;
    if (meta.ui?.sidebarWidth) sidebarWidth = meta.ui.sidebarWidth;
    if (meta.explorer?.expandedPaths) {
      explorerState.expandedPaths = new Set(meta.explorer.expandedPaths);
    }
  }

  // ── Open folder in explorer ──────────────────────────────────
  await openExplorerFolder(folderPath);

  // ── Apply sidebar state ──────────────────────────────────────
  const sidebar = document.getElementById("sidebar");
  const handle = document.getElementById("resize-handle");
  if (!sidebarVisible) {
    sidebar.classList.add("hidden");
    if (handle) handle.style.display = "none";
  } else {
    sidebar.classList.remove("hidden");
    sidebar.style.width = sidebarWidth + "px";
    if (handle) handle.style.display = "";
  }

  // ── Restore tabs ─────────────────────────────────────────────
  let anyActive = false;
  const tabsToRestore = meta?.tabs || [];

  for (const t of tabsToRestore) {
    if (t.filePath) {
      const file = await window.electronAPI.openFileByPath(t.filePath);
      if (file) {
        const tab = TabManager.create(
          file.filePath,
          file.content,
          getLang(file.filePath),
        );
        if (t.isActive) {
          TabManager.activate(tab.id);
          anyActive = true;
        }
        window.electronAPI?.watchFile?.(t.filePath);
      }
    } else {
      const content = t.untitledContent || "";
      const tab = TabManager.create(null, content, t.language || "plaintext");
      if (t.isActive) {
        TabManager.activate(tab.id);
        anyActive = true;
      }
    }
  }

  TabManager._suppressAutoBlank = false;

  if (!anyActive) {
    if (TabManager.tabs.length > 0) TabManager.activate(TabManager.tabs[0].id);
    else {
      const t = TabManager.create();
      TabManager.activate(t.id);
    }
  }

  renderTabs();

  // ── Register workspace + write updated file ──────────────────
  await WorkspaceManager.activate(folderPath, {
    name: meta?.name || basename(folderPath),
  });

  showToast(`Workspace loaded: ${basename(folderPath)}`, "success");
  window.editor?.focus();
}

/**
 * Open a folder as a workspace. Detects an existing noter.workspace
 * file and offers to restore session state, or opens fresh.
 */
async function openFolderAsWorkspace(folderPath) {
  const meta = await window.electronAPI.workspaceReadMeta(folderPath);

  if (meta && meta.tabs && meta.tabs.length > 0) {
    const restore = confirm(
      `"${basename(folderPath)}" has a saved workspace.\n\nRestore previous session?`,
    );
    if (restore) {
      await loadWorkspaceFromFolder(folderPath);
      return;
    }
  }

  // Open fresh (no tab restoration)
  await openExplorerFolder(folderPath);
  await WorkspaceManager.activate(folderPath);
  showToast(`Opened: ${basename(folderPath)}`, "success");
}

// ═══════════════════════════════════════════════════════════════
//  MENU SYSTEM
// ═══════════════════════════════════════════════════════════════
const closeAllMenus = () =>
  document
    .querySelectorAll(".dropdown")
    .forEach((d) => d.classList.remove("active"));

document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = item.querySelector(".dropdown");
    const wasOpen = dropdown.classList.contains("active");
    closeAllMenus();
    if (!wasOpen) dropdown.classList.add("active");
  });
});

document.addEventListener("click", closeAllMenus);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllMenus();
});

// ═══════════════════════════════════════════════════════════════
//  ACTIONS
// ═══════════════════════════════════════════════════════════════
const actions = {
  // ── File ──────────────────────────────────────────────────────
  newFile() {
    if (!window.editor) return;
    const tab = TabManager.create();
    TabManager.activate(tab.id);
    window.editor.updateOptions({ fontSize: editorFontSize });
    closeAllMenus();
  },

  async openFile() {
    if (!window.editor) return;
    const file = await window.electronAPI.openFile();
    if (!file) return;

    // Check if already open
    const existing = TabManager.tabs.find((t) => t.filePath === file.filePath);
    if (existing) {
      TabManager.activate(existing.id);
      closeAllMenus();
      return;
    }

    const lang = getLang(file.filePath);
    const tab = TabManager.create(file.filePath, file.content, lang);
    TabManager.activate(tab.id);
    addToRecentFiles(file.filePath);
    closeAllMenus();
  },

  async openFolder() {
    const folderPath = await window.electronAPI.openFolder();
    if (folderPath) await openFolderAsWorkspace(folderPath);
    closeAllMenus();
  },

  async saveFile() {
    if (!window.editor) return;
    const tab = TabManager.getActive();
    if (!tab) return;
    if (!tab.filePath) return actions.saveAsFile();

    const ok = await window.electronAPI.saveFile({
      path: tab.filePath,
      content: window.editor.getValue(),
    });
    if (ok) {
      tab.isModified = false;
      renderTabs();
      updateTitleBar();
      showToast("Saved: " + tab.title, "success");
    } else {
      showToast("Save failed!", "error");
    }
    closeAllMenus();
    window.editor.focus();
  },

  async saveAsFile() {
    if (!window.editor) return;
    const tab = TabManager.getActive();
    if (!tab) return;

    const newPath = await window.electronAPI.saveAsFile(
      window.editor.getValue(),
    );
    if (!newPath) return;

    tab.filePath = newPath;
    tab.title = basename(newPath);
    tab.language = getLang(newPath);
    tab.isModified = false;

    monaco.editor.setModelLanguage(tab.model, tab.language);
    updateStatusBar();
    updateTitleBar();
    renderTabs();
    addToRecentFiles(newPath);
    showToast("Saved as: " + tab.title, "success");
    closeAllMenus();
    window.editor.focus();
  },

  // ── Edit ──────────────────────────────────────────────────────
  undo() {
    window.editor?.trigger("kbd", "undo", null);
    window.editor?.focus();
  },
  redo() {
    window.editor?.trigger("kbd", "redo", null);
    window.editor?.focus();
  },
  cut() {
    window.editor?.trigger("kbd", "editor.action.clipboardCutAction", null);
    window.editor?.focus();
  },
  copy() {
    window.editor?.trigger("kbd", "editor.action.clipboardCopyAction", null);
    window.editor?.focus();
  },
  paste() {
    window.editor?.trigger("kbd", "editor.action.clipboardPasteAction", null);
    window.editor?.focus();
  },
  selectAll() {
    if (!window.editor) return;
    window.editor.setSelection(window.editor.getModel().getFullModelRange());
    window.editor.focus();
  },

  duplicateLine() {
    if (!window.editor) return;
    const model = window.editor.getModel();
    const pos = window.editor.getPosition();
    const lineNum = pos.lineNumber;
    const lineText = model.getLineContent(lineNum);
    const maxCol = model.getLineMaxColumn(lineNum);
    window.editor.pushUndoStop();
    window.editor.executeEdits("dup-line", [
      {
        range: {
          startLineNumber: lineNum,
          startColumn: maxCol,
          endLineNumber: lineNum,
          endColumn: maxCol,
        },
        text: "\n" + lineText,
      },
    ]);
    window.editor.pushUndoStop();
    window.editor.setPosition({ lineNumber: lineNum + 1, column: pos.column });
    window.editor.focus();
  },

  find() {
    window.editor?.trigger("kbd", "actions.find", null);
    closeAllMenus();
  },
  replace() {
    window.editor?.trigger("kbd", "editor.action.startFindReplaceAction", null);
    closeAllMenus();
  },

  // ── View ──────────────────────────────────────────────────────
  zoomIn() {
    editorFontSize = Math.min(editorFontSize + 2, 48);
    window.editor?.updateOptions({ fontSize: editorFontSize });
    updateZoomStatus();
    closeAllMenus();
  },
  zoomOut() {
    editorFontSize = Math.max(editorFontSize - 2, 8);
    window.editor?.updateOptions({ fontSize: editorFontSize });
    updateZoomStatus();
    closeAllMenus();
  },
  resetZoom() {
    editorFontSize = 18;
    window.editor?.updateOptions({ fontSize: 18 });
    updateZoomStatus();
    closeAllMenus();
  },
  toggleWordWrap() {
    wordWrapEnabled = !wordWrapEnabled;
    window.editor?.updateOptions({ wordWrap: wordWrapEnabled ? "on" : "off" });
    updateWrapStatus();
    closeAllMenus();
  },
  toggleExplorer() {
    toggleSidebar();
    closeAllMenus();
  },
};

// ═══════════════════════════════════════════════════════════════
//  EVENT LISTENERS (menus + buttons)
// ═══════════════════════════════════════════════════════════════

// ── File ────────────────────────────────────────────────────────
document
  .getElementById("newFile")
  .addEventListener("click", () => actions.newFile());
document
  .getElementById("newTab")
  .addEventListener("click", () => actions.newFile());
document
  .getElementById("openFile")
  .addEventListener("click", () => actions.openFile());
document
  .getElementById("openFolder")
  .addEventListener("click", () => actions.openFolder());
document
  .getElementById("saveFile")
  .addEventListener("click", () => actions.saveFile());
document
  .getElementById("saveAsFile")
  .addEventListener("click", () => actions.saveAsFile());
document
  .getElementById("createWorkspace")
  .addEventListener("click", () => createWorkspace());
document
  .getElementById("saveWorkspace")
  .addEventListener("click", () => saveWorkspace());
document
  .getElementById("openWorkspace")
  .addEventListener("click", () => openWorkspace());
document
  .getElementById("quitApp")
  .addEventListener("click", () => window.electronAPI.quit());

// ── Edit ────────────────────────────────────────────────────────
document.getElementById("undoAction").addEventListener("click", () => {
  actions.undo();
  closeAllMenus();
});
document.getElementById("redoAction").addEventListener("click", () => {
  actions.redo();
  closeAllMenus();
});
document.getElementById("cutAction").addEventListener("click", () => {
  actions.cut();
  closeAllMenus();
});
document.getElementById("copyAction").addEventListener("click", () => {
  actions.copy();
  closeAllMenus();
});
document.getElementById("pasteAction").addEventListener("click", () => {
  actions.paste();
  closeAllMenus();
});
document.getElementById("selectAllAction").addEventListener("click", () => {
  actions.selectAll();
  closeAllMenus();
});
document.getElementById("duplicateLineAction").addEventListener("click", () => {
  actions.duplicateLine();
  closeAllMenus();
});
document
  .getElementById("findAction")
  .addEventListener("click", () => actions.find());
document
  .getElementById("replaceAction")
  .addEventListener("click", () => actions.replace());

// ── View ────────────────────────────────────────────────────────
document
  .getElementById("toggleExplorerMenu")
  .addEventListener("click", () => actions.toggleExplorer());
document
  .getElementById("zoomIn")
  .addEventListener("click", () => actions.zoomIn());
document
  .getElementById("zoomOut")
  .addEventListener("click", () => actions.zoomOut());
document
  .getElementById("resetZoom")
  .addEventListener("click", () => actions.resetZoom());
document
  .getElementById("wordWrap")
  .addEventListener("click", () => actions.toggleWordWrap());

// ── New feature menu items ───────────────────────────────────────────────────
document.getElementById("toggleTerminalMenu").addEventListener("click", () => {
  TerminalPanel.toggle();
  closeAllMenus();
});
document.getElementById("toggleSplitMenu").addEventListener("click", () => {
  SplitEditor.toggle();
  closeAllMenus();
});
document.getElementById("commandPaletteMenu").addEventListener("click", () => {
  CommandPalette.show();
  closeAllMenus();
});
document.getElementById("globalSearchMenu").addEventListener("click", () => {
  GlobalSearch.show();
  closeAllMenus();
});

// ── Extensions ──────────────────────────────────────────────────
document.getElementById("openMarketplace").addEventListener("click", () => {
  Marketplace.open();
  closeAllMenus();
});
document.getElementById("manageExtensions").addEventListener("click", () => {
  Marketplace.open();
  closeAllMenus();
});

// ── Help ────────────────────────────────────────────────────────
document.getElementById("documentation").addEventListener("click", () => {
  window.electronAPI.openExternal(
    "https://github.com/RaviKumar000987/desktop-noter",
  );
  closeAllMenus();
});
document.getElementById("shortcuts").addEventListener("click", () => {
  alert(
    "Keyboard Shortcuts\n\n" +
      "Ctrl + N          →  New File / Tab\n" +
      "Ctrl + T          →  New Tab\n" +
      "Ctrl + W          →  Close Tab\n" +
      "Ctrl + O          →  Open File\n" +
      "Ctrl + S          →  Save\n" +
      "Ctrl + Shift + S  →  Save As\n" +
      "Ctrl + B          →  Toggle Explorer\n" +
      "─────────────────────────────────────\n" +
      "Ctrl + Z          →  Undo\n" +
      "Ctrl + Y          →  Redo\n" +
      "Ctrl + X          →  Cut\n" +
      "Ctrl + C          →  Copy\n" +
      "Ctrl + V          →  Paste\n" +
      "Ctrl + A          →  Select All\n" +
      "Ctrl + D          →  Duplicate Line\n" +
      "─────────────────────────────────────\n" +
      "Ctrl + F          →  Find\n" +
      "Ctrl + H          →  Find & Replace\n" +
      "─────────────────────────────────────\n" +
      "Ctrl + +          →  Zoom In\n" +
      "Ctrl + -          →  Zoom Out\n" +
      "Ctrl + 0          →  Reset Zoom\n" +
      "Esc               →  Close Menu",
  );
  closeAllMenus();
});
document.getElementById("aboutApp").addEventListener("click", () => {
  alert(
    "Noter App\n\n" +
      "Version 2.0.0\n\n" +
      "Features:\n" +
      "  • Multi-Tab Editor\n" +
      "  • Project Explorer\n" +
      "  • Workspace Save/Restore\n" +
      "  • Monaco Editor (VS Code engine)\n\n" +
      "Built with Electron · Monaco\n" +
      "Developer: Ravi Kumar",
  );
  closeAllMenus();
});

// ── Performance diagnostics panel ───────────────────────────────
function showPerformanceDiagnosticsPanel() {
  const existing = document.getElementById("noter-perf-panel");
  if (existing) {
    existing.remove();
    return;
  }

  const panel = document.createElement("div");
  panel.id = "noter-perf-panel";
  panel.innerHTML =
    '<div class="np-header">' +
    '<span class="np-title">Performance Diagnostics</span>' +
    '<button class="np-close" id="np-close-btn" title="Close">×</button>' +
    "</div>" +
    '<div class="np-body">' +
    '<table class="np-table">' +
    '<tr><td>Renderer Heap</td><td class="np-val" id="np-heap">-</td></tr>' +
    '<tr><td>Main Process RSS</td><td class="np-val" id="np-rss">-</td></tr>' +
    '<tr><td>Frame Rate</td><td class="np-val" id="np-fps">-</td></tr>' +
    '<tr><td>Monaco Models</td><td class="np-val" id="np-models">-</td></tr>' +
    '<tr><td>Open Tabs</td><td class="np-val" id="np-tabs">-</td></tr>' +
    "</table>" +
    '<div class="np-actions">' +
    '<button class="np-action-btn" id="np-cleanup-btn">Force Model Cleanup</button>' +
    '<button class="np-action-btn" id="np-reload-btn">Reload Window</button>' +
    "</div>" +
    "</div>";

  document.body.appendChild(panel);

  let _npRefreshId = null;
  async function _npRefresh() {
    if (!document.getElementById("noter-perf-panel")) return;
    const snap =
      typeof PerformanceMonitor !== "undefined"
        ? PerformanceMonitor.getSnapshot()
        : {};
    const mm =
      typeof ModelManager !== "undefined" ? ModelManager.getStats() : {};
    const proc = await window.electronAPI
      ?.getProcessMemory?.()
      .catch(() => null);

    const _el = (id) => document.getElementById(id);
    if (_el("np-heap"))
      _el("np-heap").textContent =
        snap.heapMB != null ? snap.heapMB + " MB" : "N/A";
    if (_el("np-rss"))
      _el("np-rss").textContent = proc ? proc.rss + " MB" : "N/A";
    if (_el("np-fps"))
      _el("np-fps").textContent = snap.fps != null ? snap.fps + " FPS" : "N/A";
    if (_el("np-models"))
      _el("np-models").textContent =
        mm.monacoAll != null
          ? mm.monacoAll + " (" + (mm.inactive || 0) + " idle)"
          : "N/A";
    if (_el("np-tabs")) _el("np-tabs").textContent = TabManager.tabs.length;

    _npRefreshId = setTimeout(_npRefresh, 2000);
  }

  document.getElementById("np-close-btn").onclick = () => {
    clearTimeout(_npRefreshId);
    panel.remove();
  };
  document.getElementById("np-cleanup-btn").onclick = () => {
    if (typeof ModelManager !== "undefined") {
      ModelManager.forceCleanup();
      showToast("Model cleanup triggered", "info", 2000);
    }
  };
  document.getElementById("np-reload-btn").onclick = () => {
    if (typeof CrashRecovery !== "undefined") CrashRecovery.markCleanExit();
    window.electronAPI?.reloadWindow?.();
  };

  _npRefresh();
}

document
  .getElementById("performanceDiagnostics")
  ?.addEventListener("click", () => {
    showPerformanceDiagnosticsPanel();
    closeAllMenus();
  });
document.getElementById("reloadWindowMenu")?.addEventListener("click", () => {
  if (typeof CrashRecovery !== "undefined") CrashRecovery.markCleanExit();
  window.electronAPI?.reloadWindow?.();
  closeAllMenus();
});

// ── Window controls ─────────────────────────────────────────────
document
  .getElementById("minimize")
  .addEventListener("click", () => window.electronAPI.minimize());
document
  .getElementById("maximize")
  .addEventListener("click", () => window.electronAPI.maximize());
document
  .getElementById("close")
  .addEventListener("click", () => window.electronAPI.close());

// ── Sidebar controls ────────────────────────────────────────────
document
  .getElementById("sidebar-toggle")
  .addEventListener("click", () => toggleSidebar());
document
  .getElementById("open-folder-btn")
  .addEventListener("click", () => actions.openFolder());
document
  .getElementById("open-folder-btn2")
  .addEventListener("click", () => actions.openFolder());
document
  .getElementById("refresh-explorer-btn")
  .addEventListener("click", () => refreshExplorer());
document
  .getElementById("remove-from-workspace-btn")
  .addEventListener("click", () => {
    if (typeof removeFromWorkspace === "function") removeFromWorkspace();
  });

// ── New tab "+" button ──────────────────────────────────────────
document.getElementById("new-tab-btn").addEventListener("click", () => {
  if (window.editor) actions.newFile();
});

// ── Status bar language click → change language mode ────────────
document.getElementById("language")?.addEventListener("click", () => {
  if (!window.editor) return;
  window.editor.trigger("statusbar", "editor.action.changeLanguageMode", null);
});

// ── Horizontal scroll on tabs with mouse-wheel ──────────────────
document.getElementById("tabs-container").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    e.currentTarget.scrollLeft += e.deltaY || e.deltaX;
  },
  { passive: false },
);

// ─── Global keyboard shortcuts (document level) ─────────────────
document.addEventListener("keydown", (e) => {
  // Ctrl+B → toggle sidebar
  if (e.ctrlKey && !e.shiftKey && e.key === "b") {
    e.preventDefault();
    toggleSidebar();
  }
  // Ctrl+N → new file/tab
  if (e.ctrlKey && !e.shiftKey && e.key === "n") {
    e.preventDefault();
    if (window.editor) actions.newFile();
  }
  // Ctrl+T → new tab
  if (e.ctrlKey && !e.shiftKey && e.key === "t") {
    e.preventDefault();
    if (window.editor) actions.newFile();
  }
  // Ctrl+W → close active tab
  if (e.ctrlKey && !e.shiftKey && e.key === "w") {
    e.preventDefault();
    const tab = TabManager.getActive();
    if (tab) TabManager.close(tab.id);
  }
  // Ctrl+O → open file
  if (e.ctrlKey && !e.shiftKey && e.key === "o") {
    e.preventDefault();
    actions.openFile();
  }
  // Ctrl+Shift+X → Extension Marketplace
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "x") {
    e.preventDefault();
    if (typeof Marketplace !== "undefined") Marketplace.toggle();
  }
  // Ctrl+Shift+S → save as  (check BEFORE plain S)
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    actions.saveAsFile();
  } else if (e.ctrlKey && !e.shiftKey && e.key === "s") {
    e.preventDefault();
    actions.saveFile();
  }
  // Ctrl+Tab → next tab
  if (e.ctrlKey && !e.shiftKey && e.key === "Tab") {
    e.preventDefault();
    const idx = TabManager.tabs.findIndex((t) => t.id === TabManager.activeId);
    const next = TabManager.tabs[(idx + 1) % TabManager.tabs.length];
    if (next) TabManager.activate(next.id);
  }
  // Ctrl+Shift+Tab → prev tab
  if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
    e.preventDefault();
    const idx = TabManager.tabs.findIndex((t) => t.id === TabManager.activeId);
    const prev =
      TabManager.tabs[
        (idx - 1 + TabManager.tabs.length) % TabManager.tabs.length
      ];
    if (prev) TabManager.activate(prev.id);
  }
  // Ctrl+P → quick file open
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "p") {
    e.preventDefault();
    QuickOpen.toggle();
  }
  // Alt+Z → zen mode
  if (e.altKey && !e.ctrlKey && e.key === "z") {
    e.preventDefault();
    toggleZenMode();
  }
  // Escape exits zen mode
  if (e.key === "Escape" && zenModeActive) {
    toggleZenMode(false);
  }
});

// ═══════════════════════════════════════════════════════════════
//  MONACO EDITOR INIT
// ═══════════════════════════════════════════════════════════════
require(["vs/editor/editor.main"], async () => {
  // ── TypeScript / JavaScript language service configuration ──
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    allowJs: true,
    checkJs: true,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    lib: ["ES2020", "DOM", "DOM.Iterable", "ES2020.Promise", "ES2020.String"],
    resolveJsonModule: true,
  });
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    allowJs: true,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    strict: true,
    lib: ["ES2020", "DOM", "DOM.Iterable", "ES2020.Promise", "ES2020.String"],
    resolveJsonModule: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
  });
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

  // Extra lib: Node.js + Electron globals for JS/TS files
  const _nodeGlobals = `
declare const require: NodeRequire;
declare interface NodeRequire { (id: string): any; resolve(id: string): string; }
declare const module: { exports: any; id: string; filename: string; loaded: boolean; };
declare const exports: any;
declare const __dirname: string;
declare const __filename: string;
declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  argv0: string;
  platform: 'win32' | 'darwin' | 'linux';
  arch: string;
  version: string;
  versions: Record<string, string>;
  pid: number;
  cwd(): string;
  chdir(dir: string): void;
  exit(code?: number): never;
  on(event: string, cb: (...args: any[]) => void): void;
  stdout: { write(s: string): void; };
  stderr: { write(s: string): void; };
};
declare const Buffer: {
  from(data: string | ArrayBuffer | number[], encoding?: string): Buffer;
  alloc(size: number): Buffer;
  isBuffer(obj: any): boolean;
};
declare function setTimeout(fn: (...args: any[]) => void, ms?: number, ...args: any[]): ReturnType<typeof setTimeout>;
declare function clearTimeout(id: ReturnType<typeof setTimeout>): void;
declare function setInterval(fn: (...args: any[]) => void, ms?: number, ...args: any[]): ReturnType<typeof setInterval>;
declare function clearInterval(id: ReturnType<typeof setInterval>): void;
declare function setImmediate(fn: (...args: any[]) => void): any;
declare function clearImmediate(id: any): void;
declare function queueMicrotask(fn: () => void): void;
declare const console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
  table(data: any, columns?: string[]): void;
  dir(obj: any, opts?: object): void;
  time(label?: string): void;
  timeEnd(label?: string): void;
  group(...args: any[]): void;
  groupEnd(): void;
  trace(...args: any[]): void;
  assert(cond: boolean, ...args: any[]): void;
};
declare const global: typeof globalThis & Record<string, any>;
`;
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    _nodeGlobals,
    "ts:noter-node-globals.d.ts",
  );
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    _nodeGlobals,
    "ts:noter-node-globals.d.ts",
  );

  // ── Catppuccin Mocha theme ─────────────────────────────────
  monaco.editor.defineTheme("catppuccin-mocha", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "cdd6f4", background: "1e1e2e" },
      { token: "comment", foreground: "585b70", fontStyle: "italic" },
      { token: "comment.line", foreground: "585b70", fontStyle: "italic" },
      { token: "comment.block", foreground: "585b70", fontStyle: "italic" },
      { token: "keyword", foreground: "cba6f7" },
      { token: "keyword.operator", foreground: "89dceb" },
      { token: "keyword.control", foreground: "cba6f7" },
      { token: "storage", foreground: "cba6f7" },
      { token: "storage.type", foreground: "89b4fa" },
      { token: "string", foreground: "a6e3a1" },
      { token: "string.escape", foreground: "f5c2e7" },
      { token: "string.template", foreground: "a6e3a1" },
      { token: "number", foreground: "fab387" },
      { token: "regexp", foreground: "f5c2e7" },
      { token: "type", foreground: "94e2d5" },
      { token: "class", foreground: "f9e2af" },
      { token: "function", foreground: "89b4fa" },
      { token: "variable", foreground: "cdd6f4" },
      { token: "variable.predefined", foreground: "f38ba8" },
      {
        token: "variable.parameter",
        foreground: "fab387",
        fontStyle: "italic",
      },
      { token: "constant", foreground: "fab387" },
      { token: "constant.language", foreground: "f38ba8" },
      { token: "operator", foreground: "89dceb" },
      { token: "delimiter", foreground: "89dceb" },
      { token: "delimiter.bracket", foreground: "cdd6f4" },
      { token: "tag", foreground: "f38ba8" },
      { token: "attribute.name", foreground: "f9e2af" },
      { token: "attribute.value", foreground: "a6e3a1" },
      { token: "metatag", foreground: "cba6f7" },
      { token: "annotation", foreground: "f9e2af" },
      { token: "decorator", foreground: "f9e2af" },
      { token: "bold", fontStyle: "bold" },
      { token: "italic", fontStyle: "italic" },
      { token: "heading", foreground: "89b4fa", fontStyle: "bold" },
      { token: "link", foreground: "94e2d5" },
    ],
    colors: {
      "editor.background": "#1e1e2e",
      "editor.foreground": "#cdd6f4",
      "editor.lineHighlightBackground": "#313244",
      "editor.lineHighlightBorder": "#31324400",
      "editorLineNumber.foreground": "#45475a",
      "editorLineNumber.activeForeground": "#bac2de",
      "editor.selectionBackground": "#45475a88",
      "editor.selectionHighlightBackground": "#45475a44",
      "editor.wordHighlightBackground": "#45475a55",
      "editorCursor.foreground": "#f5c2e7",
      "editorCursor.background": "#1e1e2e",
      "editor.findMatchBackground": "#f9e2af44",
      "editor.findMatchHighlightBackground": "#f9e2af22",
      "editor.findMatchBorder": "#f9e2af88",
      "editorWidget.background": "#181825",
      "editorWidget.border": "#313244",
      "editorWidget.foreground": "#cdd6f4",
      "input.background": "#313244",
      "input.foreground": "#cdd6f4",
      "input.border": "#45475a",
      "inputOption.activeBorder": "#cba6f7",
      "inputOption.activeBackground": "#cba6f722",
      "inputOption.activeForeground": "#cdd6f4",
      "list.activeSelectionBackground": "#313244",
      "list.activeSelectionForeground": "#cdd6f4",
      "list.hoverBackground": "#28283d",
      "editorGutter.background": "#1e1e2e",
      "editorIndentGuide.background": "#313244",
      "editorIndentGuide.activeBackground": "#45475a",
      "editorBracketMatch.background": "#45475a55",
      "editorBracketMatch.border": "#94e2d5",
      "minimap.background": "#1e1e2e",
      "minimap.selectionHighlight": "#45475a88",
      "minimapSlider.background": "#45475a44",
      "minimapSlider.hoverBackground": "#585b7066",
      "minimapSlider.activeBackground": "#7f849c66",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#45475a55",
      "scrollbarSlider.hoverBackground": "#585b7088",
      "scrollbarSlider.activeBackground": "#7f849c88",
      "editorOverviewRuler.border": "#00000000",
      "editorOverviewRuler.findMatchForeground": "#f9e2af88",
      "peekViewEditor.background": "#181825",
      "peekViewResult.background": "#11111b",
      "peekViewTitle.background": "#181825",
      "peekViewResult.selectionBackground": "#313244",
      focusBorder: "#cba6f755",
      "badge.background": "#313244",
      "badge.foreground": "#cdd6f4",
    },
  });

  // ── Create editor (no model yet — tabs will supply models) ──
  window.editor = monaco.editor.create(document.getElementById("editor"), {
    model: null,
    theme: "catppuccin-mocha",
    automaticLayout: true,
    fontSize: editorFontSize,
    fontFamily:
      "'Dank Mono','Cascadia Code','Fira Code',Consolas,'Courier New',monospace",
    lineHeight: 38,
    padding: { top: 20, bottom: 20 },

    // Minimap
    minimap: {
      enabled: true,
      autohide: true,
      renderCharacters: false,
      scale: 1,
    },

    // Wrapping & scrolling
    wordWrap: wordWrapEnabled ? "on" : "off",
    smoothScrolling: true,

    // Cursor
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    cursorWidth: 2,

    // Selection & highlights
    roundedSelection: true,
    renderLineHighlight: "all",
    overviewRulerBorder: false,
    occurrencesHighlight: "singleFile",

    // Brackets & pairs
    matchBrackets: "always",
    bracketPairColorization: {
      enabled: true,
      independentColorPoolPerBracketType: true,
    },
    autoClosingBrackets: "languageDefined",
    autoClosingQuotes: "languageDefined",
    autoClosingDelete: "always",
    autoSurround: "languageDefined",

    // Indentation guides
    guides: {
      bracketPairs: true,
      bracketPairsHorizontal: true,
      indentation: true,
      highlightActiveIndentation: true,
    },

    // Folding
    folding: true,
    foldingHighlight: true,
    showFoldingControls: "mouseover",
    foldingStrategy: "auto",

    // Sticky scroll (shows current scope at top like VS Code)
    stickyScroll: { enabled: true, maxLineCount: 5 },

    // Auto-indent
    autoIndent: "full",

    // Multi-cursor
    multiCursorModifier: "ctrlCmd",

    // Suggestions & IntelliSense  (Phase 4 — production-quality config)
    quickSuggestions: { other: true, comments: true, strings: true },
    quickSuggestionsDelay: 0, // instant — no typing lag
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: "on",
    acceptSuggestionOnCommitCharacter: true,
    tabCompletion: "on",
    wordBasedSuggestions: "allDocuments",
    wordBasedSuggestionsOnlySameLanguage: false,
    parameterHints: { enabled: true, cycle: true },
    inlayHints: { enabled: "on" },
    linkedEditing: true, // auto-rename matched HTML tags
    suggest: {
      showKeywords: true,
      showSnippets: true,
      showClasses: true,
      showFunctions: true,
      showVariables: true,
      showModules: true,
      showProperties: true,
      showMethods: true,
      showColors: true,
      showFiles: true,
      showValues: true,
      showEnums: true,
      showReferences: true,
      showOperators: true,
      showWords: true,
      showUsers: true,
      filterGraceful: true,
      localityBonus: true,
      preview: true,
      previewMode: "subwordSmart",
      showStatusBar: true,
      insertMode: "insert",
      snippetsPreventQuickSuggestions: false, // snippets don't block other completions
      shareSuggestSelections: true,
    },
    hover: { enabled: true, delay: 200, above: false },
    inlineSuggest: { enabled: true, mode: "prefix" },
    codeActionsOnSave: { "source.fixAll": "explicit" },

    // Render settings
    renderWhitespace: "selection",
    fontLigatures: true,
    letterSpacing: 0.3,
    lineNumbers: "on",
    lineDecorationsWidth: 6,

    // Scrollbar
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
      useShadows: false,
    },

    // Accessibility
    accessibilitySupport: "off",
  });

  // ── Register shortcuts inside Monaco ────────────────────────
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
    actions.saveFile(),
  );
  window.editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS,
    () => actions.saveAsFile(),
  );
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () =>
    actions.newFile(),
  );
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT, () =>
    actions.newFile(),
  );
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
    const t = TabManager.getActive();
    if (t) TabManager.close(t.id);
  });
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, () =>
    actions.openFile(),
  );
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () =>
    actions.duplicateLine(),
  );
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () =>
    toggleSidebar(),
  );
  // Ctrl+G → go to line (Monaco built-in)
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () =>
    window.editor.trigger("kbd", "editor.action.gotoLine", null),
  );
  // Ctrl+P → quick file open
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () =>
    QuickOpen.toggle(),
  );
  // Alt+Z → zen mode
  window.editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () =>
    toggleZenMode(),
  );
  // Ctrl+Shift+Z → zen mode (alternative)
  window.editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
    () => toggleZenMode(),
  );

  // Tab navigation inside Monaco
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Tab, () => {
    const idx = TabManager.tabs.findIndex((t) => t.id === TabManager.activeId);
    const next = TabManager.tabs[(idx + 1) % TabManager.tabs.length];
    if (next) TabManager.activate(next.id);
  });
  window.editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Tab,
    () => {
      const idx = TabManager.tabs.findIndex(
        (t) => t.id === TabManager.activeId,
      );
      const len = TabManager.tabs.length;
      const prev = TabManager.tabs[(idx - 1 + len) % len];
      if (prev) TabManager.activate(prev.id);
    },
  );

  // ── Editor event listeners ───────────────────────────────────
  let _rafCursor = null;
  window.editor.onDidChangeCursorPosition((e) => {
    cancelAnimationFrame(_rafCursor);
    _rafCursor = requestAnimationFrame(() => {
      const el = document.getElementById("cursorPosition");
      if (el)
        el.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });
  });

  // ── Start model lifecycle manager ───────────────────────────────
  if (typeof ModelManager !== "undefined") ModelManager.start();

  // ── Crash recovery check (before session restore) ───────────────
  // Returns latest snapshot if previous exit was abnormal; null otherwise.
  const _crashSnap =
    typeof CrashRecovery !== "undefined" ? CrashRecovery.checkCrash() : null;

  // Shared display-init function called after any session restore path
  async function _finishInit() {
    window.editor.updateOptions({
      fontSize: editorFontSize,
      wordWrap: wordWrapEnabled ? "on" : "off",
    });
    updateZoomStatus();
    updateWrapStatus();
    updateStatusBar();
    updateTitleBar();
    updateBreadcrumb();
    updateCounts();
    renderRecentFiles();
    window.editor.focus();
  }

  if (_crashSnap && typeof CrashRecovery !== "undefined") {
    // Show recovery dialog; defer display-init until user responds
    CrashRecovery.showRecoveryDialog(
      _crashSnap,
      async (snap) => {
        await CrashRecovery.restoreSnapshot(snap);
        await _finishInit();
      },
      async () => {
        // User chose fresh start — run normal session restore
        const ok = await restoreSessionState();
        if (!ok) {
          const t = TabManager.create();
          TabManager.activate(t.id);
        }
        await _finishInit();
      },
    );
  } else {
    // Normal startup path
    const restored = await restoreSessionState();
    if (!restored) {
      const tab = TabManager.create();
      TabManager.activate(tab.id);
    }
    await _finishInit();
  }

  // ── Start performance monitoring ──────────────────────────────────
  if (typeof PerformanceMonitor !== "undefined") {
    PerformanceMonitor.start((warn) => {
      showToast(warn.message, "warning", 4500);
    });
  }

  // ── Start crash-recovery auto-snapshot timer ──────────────────────
  if (typeof CrashRecovery !== "undefined") CrashRecovery.start();

  // ── Mark clean exit on window close ──────────────────────────────
  window.addEventListener("beforeunload", () => {
    if (typeof CrashRecovery !== "undefined") CrashRecovery.markCleanExit();
  });

  // Ctrl+Shift+X → Extension Marketplace
  window.editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyX,
    () => {
      if (typeof Marketplace !== "undefined") Marketplace.toggle();
    },
  );

  // Notify feature modules that Monaco is ready so they can register addCommand shortcuts
  document.dispatchEvent(new CustomEvent("monaco-ready"));
});
