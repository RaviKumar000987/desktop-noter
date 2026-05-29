// ═══════════════════════════════════════════════════════════════
//  CONTEXT MENU — context-menu.js
//  Right-click menus for explorer: file, folder, workspace root,
//  and empty space. Also provides inline rename + input dialogs.
//
//  Deps: app.js globals — TabManager, explorerState, basename,
//        openFileFromExplorer, refreshExplorer, showToast,
//        actions, getLang, SplitEditor, TerminalPanel
// ═══════════════════════════════════════════════════════════════

// ── Custom input dialog (replaces native prompt) ───────────────
function inputDialog(title, placeholder = "", defaultValue = "") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "input-dialog-overlay";

    const box = document.createElement("div");
    box.className = "input-dialog-box";
    box.innerHTML = `
      <div class="input-dialog-title">${title}</div>
      <input class="input-dialog-field" type="text"
             placeholder="${placeholder}" autocomplete="off" spellcheck="false" />
      <div class="input-dialog-actions">
        <button class="input-dialog-btn">Cancel</button>
        <button class="input-dialog-btn primary">Create</button>
      </div>`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const field = box.querySelector(".input-dialog-field");
    const [cancelBtn, okBtn] = box.querySelectorAll(".input-dialog-btn");

    if (defaultValue) field.value = defaultValue;
    requestAnimationFrame(() => {
      field.focus();
      field.select();
    });

    function done(val) {
      overlay.remove();
      resolve(val || null);
    }

    okBtn.addEventListener("click", () => done(field.value.trim()));
    cancelBtn.addEventListener("click", () => done(null));
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) done(null);
    });
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        done(field.value.trim());
      }
      if (e.key === "Escape") done(null);
    });
  });
}

// ── Confirm dialog ─────────────────────────────────────────────
function confirmDialog(message, okLabel = "Delete") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "input-dialog-overlay";

    const box = document.createElement("div");
    box.className = "input-dialog-box confirm-dialog-box";
    box.innerHTML = `
      <div class="input-dialog-title">${message}</div>
      <div class="input-dialog-actions">
        <button class="input-dialog-btn">Cancel</button>
        <button class="input-dialog-btn danger">${okLabel}</button>
      </div>`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const [cancelBtn, okBtn] = box.querySelectorAll(".input-dialog-btn");

    requestAnimationFrame(() => okBtn.focus());
    function done(val) {
      overlay.remove();
      resolve(val);
    }

    okBtn.addEventListener("click", () => done(true));
    cancelBtn.addEventListener("click", () => done(false));
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) done(false);
    });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        done(false);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
//  CONTEXT MENU SINGLETON
// ═══════════════════════════════════════════════════════════════
const ContextMenu = (() => {
  let menuEl = null;

  function ensureEl() {
    if (menuEl) return menuEl;
    menuEl = document.createElement("div");
    menuEl.id = "ctx-menu";
    menuEl.className = "ctx-menu";
    document.body.appendChild(menuEl);
    return menuEl;
  }

  function hide() {
    if (menuEl) menuEl.style.display = "none";
  }

  function show(items, x, y) {
    const el = ensureEl();
    el.innerHTML = "";

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement("div");
        sep.className = "ctx-sep";
        el.appendChild(sep);
        continue;
      }
      const row = document.createElement("div");
      row.className =
        "ctx-item" +
        (item.disabled ? " ctx-disabled" : "") +
        (item.danger ? " ctx-danger" : "");
      row.innerHTML =
        `<span class="ctx-icon">${item.icon || ""}</span>` +
        `<span class="ctx-label">${item.label}</span>` +
        (item.shortcut
          ? `<span class="ctx-shortcut">${item.shortcut}</span>`
          : "");

      if (!item.disabled && item.action) {
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          hide();
          item.action();
        });
        row.addEventListener("mouseenter", () => {
          el.querySelectorAll(".ctx-item").forEach((r) =>
            r.classList.remove("ctx-focused"),
          );
          row.classList.add("ctx-focused");
        });
      }
      el.appendChild(row);
    }

    // Position off-screen first to measure height
    el.style.left = "-9999px";
    el.style.top = "-9999px";
    el.style.display = "block";

    requestAnimationFrame(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      el.style.left = Math.min(x, vw - w - 6) + "px";
      el.style.top = Math.min(y, vh - h - 6) + "px";
    });
  }

  // Close on click outside / Escape
  document.addEventListener("mousedown", (e) => {
    if (menuEl && menuEl.style.display === "block" && !menuEl.contains(e.target)) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuEl && menuEl.style.display === "block") hide();
  });
  document.addEventListener("contextmenu", (e) => {
    if (menuEl && menuEl.style.display === "block" && !menuEl.contains(e.target)) hide();
  });

  return { show, hide };
})();

// ═══════════════════════════════════════════════════════════════
//  EXPLORER RIGHT-CLICK HANDLERS
// ═══════════════════════════════════════════════════════════════

// ── Inline rename ─────────────────────────────────────────────
async function inlineRenameRow(row, oldPath) {
  const nameEl = row.querySelector(".explorer-name");
  if (!nameEl) return;
  const oldName = nameEl.textContent;

  const input = document.createElement("input");
  input.className = "explorer-rename-input";
  input.value = oldName;
  nameEl.replaceWith(input);
  input.focus();

  // Select name without extension
  const dotIdx = oldName.lastIndexOf(".");
  const isFolder = !!row.querySelector(".explorer-toggle");
  if (dotIdx > 0 && !isFolder) {
    input.setSelectionRange(0, dotIdx);
  } else {
    input.select();
  }

  let committed = false;
  async function commit() {
    if (committed) return;
    committed = true;
    const newName = input.value.trim();
    if (!newName || newName === oldName) {
      input.replaceWith(nameEl);
      return;
    }
    const sep = oldPath.includes("\\") ? "\\" : "/";
    const dir = oldPath.substring(0, oldPath.lastIndexOf(sep) + 1);
    const newPath = dir + newName;

    const ok = await window.electronAPI.fsRename(oldPath, newPath);
    if (ok) {
      // Update any open tabs that pointed to this path
      TabManager.tabs.forEach((t) => {
        if (t.filePath === oldPath) {
          t.filePath = newPath;
          t.title = basename(newPath);
          t.language = getLang(newPath);
          monaco.editor.setModelLanguage(t.model, t.language);
        } else if (t.filePath && t.filePath.startsWith(oldPath + sep)) {
          t.filePath = newPath + t.filePath.slice(oldPath.length);
          t.title = basename(t.filePath);
        }
      });
      renderTabs();
      updateStatusBar();
      updateTitleBar();
      refreshExplorer();
      showToast("Renamed to " + newName, "success");
    } else {
      input.replaceWith(nameEl);
      showToast("Rename failed", "error");
    }
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      committed = true;
      input.replaceWith(nameEl);
    }
  });
}

// ── Delete item ───────────────────────────────────────────────
async function deleteExplorerItem(filePath, isFolder) {
  const name = basename(filePath);
  const msg = isFolder
    ? `Move "<b>${name}</b>" and all its contents to Trash?`
    : `Move "<b>${name}</b>" to Trash?`;

  const confirmed = await confirmDialog(msg, "Move to Trash");
  if (!confirmed) return;

  const ok = await window.electronAPI.fsDelete(filePath);
  if (ok) {
    const sep = filePath.includes("\\") ? "\\" : "/";
    // Close any affected tabs
    [...TabManager.tabs].forEach((t) => {
      if (
        t.filePath === filePath ||
        (isFolder && t.filePath?.startsWith(filePath + sep))
      ) {
        TabManager.close(t.id, true);
      }
    });
    refreshExplorer();
    showToast("Moved to Trash: " + name, "success");
  } else {
    showToast("Delete failed — file may be in use", "error");
  }
}

// ── Duplicate file ────────────────────────────────────────────
async function duplicateExplorerFile(filePath) {
  const name = basename(filePath);
  const sep = filePath.includes("\\") ? "\\" : "/";
  const dir = filePath.substring(0, filePath.lastIndexOf(sep));
  const ext = name.includes(".") ? "." + name.split(".").pop() : "";
  const base = ext ? name.slice(0, -ext.length) : name;
  const destName = base + " copy" + ext;
  const destPath = dir + sep + destName;

  const newName = await window.electronAPI.fsDuplicate(filePath, destPath);
  if (newName) {
    refreshExplorer();
    showToast("Duplicated: " + newName, "success");
  } else {
    showToast("Duplicate failed", "error");
  }
}

// ── Create new file in directory ──────────────────────────────
async function createNewFileInDir(dirPath) {
  const name = await inputDialog("New File", "filename.ext", "untitled.txt");
  if (!name) return;
  const newPath = await window.electronAPI.fsNewFile(dirPath, name);
  if (newPath) {
    refreshExplorer();
    setTimeout(() => openFileFromExplorer(newPath), 200);
  } else {
    showToast("Could not create file (may already exist)", "error");
  }
}

// ── Create new folder in directory ───────────────────────────
async function createNewFolderInDir(dirPath) {
  const name = await inputDialog("New Folder", "folder-name", "new-folder");
  if (!name) return;
  const ok = await window.electronAPI.fsNewFolder(dirPath, name);
  if (ok) {
    refreshExplorer();
    showToast("Created: " + name, "success");
  } else {
    showToast("Could not create folder (may already exist)", "error");
  }
}

// ── Copy path to clipboard ────────────────────────────────────
function copyPathToClipboard(filePath, relative = false) {
  let text = filePath;
  if (relative && explorerState.rootPath) {
    const root = explorerState.rootPath;
    text = filePath.startsWith(root)
      ? filePath.slice(root.length).replace(/^[/\\]/, "")
      : filePath;
  }
  navigator.clipboard.writeText(text).then(() => {
    showToast("Path copied to clipboard", "success", 1800);
  });
}

// ── Build file context menu ───────────────────────────────────
function showFileContextMenu(filePath, x, y, row) {
  const sep = filePath.includes("\\") ? "\\" : "/";
  const dir = filePath.substring(0, filePath.lastIndexOf(sep));

  ContextMenu.show(
    [
      {
        icon: "▶",
        label: "Open",
        action: () => openFileFromExplorer(filePath),
      },
      {
        icon: "⊟",
        label: "Open to Side",
        action: () => {
          openFileFromExplorer(filePath);
          setTimeout(() => SplitEditor?.open(), 80);
        },
      },
      { separator: true },
      {
        icon: "✎",
        label: "Rename",
        shortcut: "F2",
        action: () => inlineRenameRow(row, filePath),
      },
      {
        icon: "⊡",
        label: "Duplicate",
        action: () => duplicateExplorerFile(filePath),
      },
      {
        icon: "🗑",
        label: "Delete",
        danger: true,
        action: () => deleteExplorerItem(filePath, false),
      },
      { separator: true },
      {
        icon: "⊕",
        label: "New File Here",
        action: () => createNewFileInDir(dir),
      },
      {
        icon: "⊕",
        label: "New Folder Here",
        action: () => createNewFolderInDir(dir),
      },
      { separator: true },
      {
        icon: "⎘",
        label: "Copy Path",
        action: () => copyPathToClipboard(filePath),
      },
      {
        icon: "⎘",
        label: "Copy Relative Path",
        action: () => copyPathToClipboard(filePath, true),
      },
      {
        icon: "⊢",
        label: "Reveal in Explorer",
        action: () => window.electronAPI.shellReveal(filePath),
      },
      ...(isRunnable(filePath) ? [
        { separator: true },
        {
          icon: "▶",
          label: "Run File",
          shortcut: "Ctrl+Alt+N",
          action: () => {
            openFileFromExplorer(filePath).then ? openFileFromExplorer(filePath).then(() => {
              if (typeof ExtensionRuntime !== "undefined") ExtensionRuntime.runCurrentFile();
            }) : (() => {
              if (typeof ExtensionRuntime !== "undefined") ExtensionRuntime.runCurrentFile();
            })();
          },
        },
      ] : []),
    ],
    x,
    y,
  );
}

// ── Build folder context menu ─────────────────────────────────
function showFolderContextMenu(folderPath, x, y, row) {
  ContextMenu.show(
    [
      {
        icon: "⊕",
        label: "New File",
        action: () => createNewFileInDir(folderPath),
      },
      {
        icon: "⊕",
        label: "New Folder",
        action: () => createNewFolderInDir(folderPath),
      },
      { separator: true },
      {
        icon: "✎",
        label: "Rename",
        shortcut: "F2",
        action: () => inlineRenameRow(row, folderPath),
      },
      {
        icon: "🗑",
        label: "Delete",
        danger: true,
        action: () => deleteExplorerItem(folderPath, true),
      },
      { separator: true },
      {
        icon: "⎘",
        label: "Copy Path",
        action: () => copyPathToClipboard(folderPath),
      },
      {
        icon: "⊢",
        label: "Open in Terminal",
        action: () => {
          TerminalPanel.setCwd(folderPath);
          TerminalPanel.show();
        },
      },
      {
        icon: "⊢",
        label: "Reveal in Explorer",
        action: () => window.electronAPI.shellReveal(folderPath),
      },
      { separator: true },
      { icon: "↻", label: "Refresh", action: () => refreshExplorer() },
    ],
    x,
    y,
  );
}

// ── Remove current folder from workspace ─────────────────────
function removeFromWorkspace() {
  if (!explorerState.rootPath) return;
  explorerState.rootPath = null;
  explorerState.expandedPaths = new Set();

  const noFolderMsg     = document.getElementById("no-folder-msg");
  const explorerContent = document.getElementById("explorer-content");
  const explorerTree    = document.getElementById("explorer-tree");
  const folderNameEl    = document.getElementById("folder-name");

  if (noFolderMsg)     noFolderMsg.style.display     = "";
  if (explorerContent) explorerContent.style.display  = "none";
  if (explorerTree)    explorerTree.innerHTML          = "";
  if (folderNameEl)    folderNameEl.textContent        = "";

  showToast("Folder removed from workspace", "info", 2000);
  if (typeof saveSessionState === "function") saveSessionState();
}

// ── Build workspace / empty-space context menu ────────────────
function showWorkspaceContextMenu(x, y) {
  if (!explorerState.rootPath) {
    ContextMenu.show(
      [
        {
          icon: "📂",
          label: "Open Folder",
          action: () => actions.openFolder(),
        },
        { icon: "⊞", label: "New Workspace", action: () => createWorkspace() },
      ],
      x,
      y,
    );
    return;
  }
  ContextMenu.show(
    [
      {
        icon: "⊕",
        label: "New File",
        action: () => createNewFileInDir(explorerState.rootPath),
      },
      {
        icon: "⊕",
        label: "New Folder",
        action: () => createNewFolderInDir(explorerState.rootPath),
      },
      { separator: true },
      { icon: "↻", label: "Refresh Explorer", action: () => refreshExplorer() },
      {
        icon: "⊢",
        label: "Open in System Explorer",
        action: () => window.electronAPI.shellReveal(explorerState.rootPath),
      },
      {
        icon: "⊢",
        label: "Open in Terminal",
        action: () => {
          TerminalPanel.setCwd(explorerState.rootPath);
          TerminalPanel.show();
        },
      },
      { separator: true },
      { icon: "💾", label: "Save Workspace", action: () => saveWorkspace() },
      { separator: true },
      {
        icon: "⊗",
        label: "Remove from Workspace",
        danger: true,
        action: () => removeFromWorkspace(),
      },
    ],
    x,
    y,
  );
}

// ── File context menu — with Run Code + Format additions ──────
// (override to add extra items for runnable file types)
const RUNNABLE_EXTS = new Set(["js","ts","py","java","c","cpp","rs","go","sh","bash","jsx","tsx"]);

function isRunnable(filePath) {
  const ext = (filePath.split(".").pop() || "").toLowerCase();
  return RUNNABLE_EXTS.has(ext);
}

// ── Editor right-click context menu ───────────────────────────
function showEditorContextMenu(x, y) {
  const tab = TabManager.getActive();
  if (!window.editor) return;

  const hasSelection = !window.editor.getSelection().isEmpty();

  ContextMenu.show([
    {
      icon: "✂",
      label: "Cut",
      shortcut: "Ctrl+X",
      disabled: !hasSelection,
      action: () => window.editor.trigger("ctx","editor.action.clipboardCutAction",null),
    },
    {
      icon: "⎘",
      label: "Copy",
      shortcut: "Ctrl+C",
      action: () => window.editor.trigger("ctx","editor.action.clipboardCopyAction",null),
    },
    {
      icon: "⊕",
      label: "Paste",
      shortcut: "Ctrl+V",
      action: () => window.editor.trigger("ctx","editor.action.clipboardPasteAction",null),
    },
    { separator: true },
    {
      icon: "⌎",
      label: "Select All",
      shortcut: "Ctrl+A",
      action: () => {
        window.editor.setSelection(window.editor.getModel().getFullModelRange());
        window.editor.focus();
      },
    },
    { separator: true },
    {
      icon: "⌕",
      label: "Find",
      shortcut: "Ctrl+F",
      action: () => window.editor.trigger("ctx","actions.find",null),
    },
    {
      icon: "⌕",
      label: "Find & Replace",
      shortcut: "Ctrl+H",
      action: () => window.editor.trigger("ctx","editor.action.startFindReplaceAction",null),
    },
    { separator: true },
    {
      icon: "⊞",
      label: "Format Document",
      shortcut: "Shift+Alt+F",
      action: () => window.editor.trigger("ctx","editor.action.formatDocument",null),
    },
    {
      icon: "↩",
      label: "Comment / Uncomment",
      shortcut: "Ctrl+/",
      action: () => window.editor.trigger("ctx","editor.action.commentLine",null),
    },
    {
      icon: "⊡",
      label: "Rename Symbol",
      shortcut: "F2",
      action: () => window.editor.trigger("ctx","editor.action.rename",null),
    },
    { separator: true },
    ...(tab?.filePath && isRunnable(tab.filePath) ? [{
      icon: "▶",
      label: "Run File",
      shortcut: "Ctrl+Alt+N",
      action: () => {
        if (typeof ExtensionRuntime !== "undefined") ExtensionRuntime.runCurrentFile();
        else showToast("Code Runner not loaded", "error");
      },
    }] : []),
    ...(tab?.filePath ? [{
      icon: "⎘",
      label: "Copy File Path",
      action: () => navigator.clipboard.writeText(tab.filePath),
    }] : []),
    {
      icon: "⊟",
      label: "Open Split Editor",
      shortcut: "Ctrl+\\",
      action: () => { if (typeof SplitEditor !== "undefined") SplitEditor.toggle(); },
    },
  ], x, y);
}

// ── Wire up right-click on the full sidebar ───────────────────
(function () {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  sidebar.addEventListener("contextmenu", (e) => {
    if (e.target.closest("#search-panel")) return;
    e.preventDefault();
    e.stopPropagation();

    const row = e.target.closest(".explorer-row[data-path]");
    if (row) {
      const entryPath = row.dataset.path;
      const isFolder  = !!row.querySelector(".explorer-toggle");
      if (isFolder) showFolderContextMenu(entryPath, e.clientX, e.clientY, row);
      else          showFileContextMenu(entryPath, e.clientX, e.clientY, row);
    } else {
      showWorkspaceContextMenu(e.clientX, e.clientY);
    }
  });

  sidebar.addEventListener("keydown", (e) => {
    if (e.key !== "F2") return;
    const row = sidebar.querySelector(".explorer-row.active-file[data-path]");
    if (row) {
      e.preventDefault();
      inlineRenameRow(row, row.dataset.path);
    }
  });
}());

// ── Wire up right-click on the editor area ────────────────────
(function () {
  const editorArea = document.getElementById("editor-area");
  if (!editorArea) return;

  editorArea.addEventListener("contextmenu", (e) => {
    // Let Monaco handle right-clicks inside its own canvas/textarea
    const monacoEl = document.getElementById("editor");
    if (monacoEl && monacoEl.contains(e.target)) return;

    // Right-click on breadcrumb or toolbar → ignore
    if (e.target.closest("#editor-topbar") || e.target.closest("#ext-toolbar")) return;

    e.preventDefault();
    showEditorContextMenu(e.clientX, e.clientY);
  });
}());
