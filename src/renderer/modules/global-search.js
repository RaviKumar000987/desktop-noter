// ═══════════════════════════════════════════════════════════════
//  GLOBAL SEARCH — global-search.js
//  Open  : Ctrl + Shift + F
//  Deps  : app.js (explorerState, TabManager, getLang, basename,
//                  showToast, toggleSidebar, sidebarVisible)
//          preload.js  (electronAPI.globalSearch)
// ═══════════════════════════════════════════════════════════════

const GlobalSearch = (() => {
  let visible     = false;
  let caseSens    = false;
  let useRegex    = false;
  let searchTimer = null;

  const $  = (id) => document.getElementById(id);
  const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // ── Highlight matches in a line ───────────────────────────────
  function highlight(line, q, cs, rx) {
    try {
      const flags = cs ? "g" : "gi";
      const pat   = new RegExp(rx ? q : q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), flags);
      return esc(line).replace(pat, m => `<mark class="gs-mark">${esc(m)}</mark>`);
    } catch {
      return esc(line);
    }
  }

  // ── Render results ─────────────────────────────────────────
  function renderResults(results, query) {
    const container = $("gs-results");
    if (!container) return;
    container.innerHTML = "";

    if (!results || results.length === 0) {
      container.innerHTML = `<div class="gs-empty">${query ? "No results found" : "Type to search across all files…"}</div>`;
      $("gs-stats").textContent = "";
      return;
    }

    // Group by file
    const byFile = {};
    results.forEach(r => (byFile[r.file] = byFile[r.file] || []).push(r));

    Object.entries(byFile).forEach(([filePath, matches]) => {
      const group  = document.createElement("div");
      group.className = "gs-file-group";

      const header = document.createElement("div");
      header.className = "gs-file-header";
      header.title     = filePath;
      header.innerHTML =
        `<span class="gs-file-name">${esc(basename(filePath))}</span>` +
        `<span class="gs-match-count">${matches.length}</span>`;
      group.appendChild(header);

      matches.forEach(m => {
        const row = document.createElement("div");
        row.className = "gs-match-row";
        row.innerHTML =
          `<span class="gs-lineno">${m.lineNumber}</span>` +
          `<span class="gs-line-text">${highlight(m.line.trimStart(), query, caseSens, useRegex)}</span>`;
        row.addEventListener("click", () => jumpTo(m.file, m.lineNumber));
        group.appendChild(row);
      });

      container.appendChild(group);
    });

    const totalFiles = Object.keys(byFile).length;
    $("gs-stats").textContent =
      `${results.length} result${results.length !== 1 ? "s" : ""} in ${totalFiles} file${totalFiles !== 1 ? "s" : ""}`;
  }

  // ── Jump to a specific file + line ───────────────────────────
  async function jumpTo(filePath, lineNumber) {
    let tab = TabManager.tabs.find(t => t.filePath === filePath);
    if (!tab) {
      const file = await window.electronAPI.openFileByPath(filePath);
      if (!file) { showToast("Cannot open: " + basename(filePath), "error"); return; }
      tab = TabManager.create(file.filePath, file.content, getLang(file.filePath));
    }
    TabManager.activate(tab.id);

    setTimeout(() => {
      if (window.editor) {
        window.editor.revealLineInCenter(lineNumber);
        window.editor.setPosition({ lineNumber, column: 1 });
        window.editor.focus();
      }
    }, 60);
  }

  // ── Trigger search ─────────────────────────────────────────
  function doSearch() {
    const query = ($("gs-input")?.value || "").trim();
    const root  = explorerState?.rootPath;

    if (!query) { renderResults([], ""); return; }
    if (!root) {
      const c = $("gs-results");
      if (c) c.innerHTML = `<div class="gs-empty">Open a folder first to search files</div>`;
      $("gs-stats").textContent = "";
      return;
    }

    if ($("gs-results")) $("gs-results").innerHTML = `<div class="gs-empty">Searching…</div>`;
    $("gs-stats").textContent = "";

    window.electronAPI
      .globalSearch({ query, rootPath: root, caseSensitive: caseSens, useRegex })
      .then(results  => renderResults(results, query))
      .catch(() => {
        const c = $("gs-results");
        if (c) c.innerHTML = `<div class="gs-empty">Search error — check console</div>`;
      });
  }

  // ── Show (switch sidebar to search mode) ───────────────────
  function show() {
    if (!sidebarVisible) toggleSidebar(true);

    visible = true;
    document.getElementById("sidebar")?.classList.add("search-mode");

    const title = $("sidebar-title");
    if (title) title.textContent = "SEARCH";

    $("gs-search-btn")?.classList.add("gs-active");

    setTimeout(() => {
      $("gs-input")?.focus();
      $("gs-input")?.select();
    }, 40);
  }

  // ── Hide (restore explorer) ────────────────────────────────
  function hide() {
    visible = false;
    document.getElementById("sidebar")?.classList.remove("search-mode");

    const title = $("sidebar-title");
    if (title) title.textContent = "EXPLORER";

    $("gs-search-btn")?.classList.remove("gs-active");
    window.editor?.focus();
  }

  function toggle() { visible ? hide() : show(); }

  // ── Wire up panel events ──────────────────────────────────
  $("gs-input")?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 320);
  });
  $("gs-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter")  { clearTimeout(searchTimer); doSearch(); }
    if (e.key === "Escape") { hide(); }
  });

  $("gs-case-btn")?.addEventListener("click", () => {
    caseSens = !caseSens;
    $("gs-case-btn")?.classList.toggle("gs-opt-on", caseSens);
    doSearch();
  });
  $("gs-regex-btn")?.addEventListener("click", () => {
    useRegex = !useRegex;
    $("gs-regex-btn")?.classList.toggle("gs-opt-on", useRegex);
    doSearch();
  });

  // Search icon in sidebar header
  $("gs-search-btn")?.addEventListener("click", toggle);

  // ── Document-level shortcut ──────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault(); show();
    }
  });

  // ── Monaco shortcut ──────────────────────────────────────
  document.addEventListener("monaco-ready", () => {
    window.editor?.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => show()
    );
  });

  return { show, hide, toggle };
})();
