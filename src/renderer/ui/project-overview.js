// ═══════════════════════════════════════════════════════════════
//  PROJECT OVERVIEW PANEL — project-overview.js   (Phase 1.5)
//  Rust-powered project intelligence: framework, architecture,
//  dependency graph, project map — auto-scanned on workspace open.
// ═══════════════════════════════════════════════════════════════

const ProjectOverview = (() => {
  const $ = (id) => document.getElementById(id);

  let _workspaceRoot = null;
  let _lastScan = null;
  let _scanning = false;

  // ── Category metadata ──────────────────────────────────────────────
  const CATEGORY_COLORS = {
    UI:       "#61afef",
    Backend:  "#98c379",
    ORM:      "#c678dd",
    Auth:     "#e5c07b",
    Database: "#56b6c2",
    Testing:  "#e06c75",
    Build:    "#d19a66",
    Runtime:  "#abb2bf",
    Other:    "#5c6370",
  };

  const ARCH_BADGE_COLOR = {
    "MVC":              "#98c379",
    "Layered":          "#61afef",
    "Clean Architecture":"#c678dd",
    "Hexagonal":        "#d19a66",
    "Monolith":         "#e5c07b",
    "Microservice":     "#56b6c2",
    "Next.js":          "#e06c75",
    "SPA Frontend":     "#61afef",
    "Library":          "#abb2bf",
    "Unknown":          "#5c6370",
  };

  const MODULE_ICONS = {
    lock:      `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11 6V4a3 3 0 0 0-6 0v2H3v9h10V6h-2zm-4-2a1 1 0 0 1 2 0v2H7V4zm1 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>`,
    database:  `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><ellipse cx="8" cy="4" rx="6" ry="2.5"/><path d="M2 4v3c0 1.38 2.69 2.5 6 2.5S14 8.38 14 7V4c0 1.38-2.69 2.5-6 2.5S2 5.38 2 4z"/><path d="M2 7v3c0 1.38 2.69 2.5 6 2.5S14 11.38 14 10V7c0 1.38-2.69 2.5-6 2.5S2 8.38 2 7z"/></svg>`,
    globe:     `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2c-1.5 2-2.5 3.7-2.5 6s1 4 2.5 6m0-12c1.5 2 2.5 3.7 2.5 6s-1 4-2.5 6M2 8h12" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`,
    layout:    `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="1" y="1" width="14" height="4" rx="1"/><rect x="1" y="7" width="6" height="8" rx="1"/><rect x="9" y="7" width="6" height="8" rx="1"/></svg>`,
    tool:      `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11.7 1.3a.5.5 0 0 0-.7 0L9 3.3 6.7 1a.5.5 0 0 0-.7 0l-1 1a.5.5 0 0 0 0 .7L7.3 5 5 7.3a2.5 2.5 0 1 0 3.5 3.5L11 8.5l.3.3a.5.5 0 0 0 .7 0l1-1a.5.5 0 0 0 0-.7L12 7.3 14 5.3a.5.5 0 0 0 0-.7l-2.3-3.3z"/></svg>`,
    settings:  `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm5.3-1.3-.7-.4V6.7l.7-.4A1 1 0 0 0 13.7 5L13 3.7a1 1 0 0 0-1.3-.3l-.7.4-1.1-.6V2.5a1 1 0 0 0-1-1H7.1a1 1 0 0 0-1 1v.7L5 3.8l-.7-.4A1 1 0 0 0 3 3.7L2.3 5a1 1 0 0 0 .4 1.3l.7.4v1.6l-.7.4A1 1 0 0 0 2.3 10L3 11.3a1 1 0 0 0 1.3.4l.7-.4 1.1.6v.7a1 1 0 0 0 1 1h1.8a1 1 0 0 0 1-1v-.7l1.1-.6.7.4a1 1 0 0 0 1.3-.4L13.7 10a1 1 0 0 0-.4-1.3z"/></svg>`,
    beaker:    `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M10 1H6v6L2 14h12L10 7V1zm-1 1h2v6.3l2.6 4.7H2.4L5 8.3V2H6v5h3V2z"/></svg>`,
    package:   `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1 L15 4.5 V11.5 L8 15 L1 11.5 V4.5 Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M1 4.5L8 8M8 8L15 4.5M8 8V15" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`,
    "file-text":`<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4 1h6l4 4v10H2V1h2zm5 0v4h4L9 1zM5 8h6M5 11h4" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`,
  };

  // ── DOM refs ──────────────────────────────────────────────────────
  function el(id) { return $(id); }

  // ── Public API ────────────────────────────────────────────────────

  function show() {
    el("project-overview-panel").style.display = "flex";
    el("project-overview-panel").style.flexDirection = "column";

    // Pick up folder opened before this panel was first shown
    if (!_workspaceRoot && window.currentFolderPath) {
      _workspaceRoot = window.currentFolderPath;
    }

    if (!_workspaceRoot) {
      showEmpty("Open a folder to see project intelligence");
    } else if (_lastScan) {
      renderScan(_lastScan);
    } else if (!_scanning) {
      triggerScan(_workspaceRoot);
    }
  }

  function hide() {
    el("project-overview-panel").style.display = "none";
  }

  // Called by app.js when a folder is opened / workspace changes
  function onWorkspaceOpen(root) {
    _workspaceRoot = root;
    _lastScan = null;
    // Auto-scan in the background — don't block UI
    triggerScan(root);
  }

  // ── Scan ──────────────────────────────────────────────────────────

  async function triggerScan(root) {
    if (_scanning) return;
    _scanning = true;

    showLoading();

    try {
      const result = await window.noter.project.scan({ workspaceRoot: root });
      _scanning = false;

      if (!result || !result.success) {
        showEmpty(result?.error?.includes("unavailable")
          ? "Rust engine not built yet\nRun: cargo build -p noter-napi"
          : "Scan failed — check console");
        return;
      }

      _lastScan = result;
      window.lastProjectScan = result; // shared with ai-chat.js for project context
      renderScan(result);
    } catch (err) {
      _scanning = false;
      showEmpty("Scan failed: " + (err?.message || "unknown error"));
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  function renderScan(data) {
    showContent();

    // Overview section: languages + frameworks
    const overviewBody = el("po-overview-body");
    overviewBody.innerHTML = "";

    // Languages row
    if (data.languages?.length) {
      const langRow = mkRow("Languages", data.languages.map(l =>
        mkBadge(l, "#abb2bf")
      ).join(""));
      overviewBody.appendChild(langRow);
    }

    // Frameworks grouped by category
    const byCategory = {};
    for (const fw of (data.frameworks || [])) {
      const cat = fw.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(fw);
    }
    for (const [cat, fws] of Object.entries(byCategory)) {
      const color = CATEGORY_COLORS[cat] || "#abb2bf";
      const badges = fws.map(fw => {
        const tip = fw.version ? `${fw.name} ${fw.version}` : fw.name;
        return mkBadge(fw.name, color, tip);
      }).join("");
      overviewBody.appendChild(mkRow(cat, badges));
    }

    // Architecture section
    const archBody = el("po-arch-body");
    archBody.innerHTML = "";
    const arch = data.architecture;
    if (arch) {
      const color = ARCH_BADGE_COLOR[arch.pattern] || "#5c6370";
      const confBar = `<div class="po-conf-bar" style="--conf:${arch.confidence}%;--color:${color}"></div>`;
      const evidenceHtml = arch.evidence?.length
        ? `<div class="po-evidence">${arch.evidence.map(e => `<span class="po-ev-chip">${e}</span>`).join("")}</div>`
        : "";
      archBody.innerHTML = `
        <div class="po-arch-row">
          ${mkBadge(arch.pattern, color)}
          <span class="po-conf-label">${arch.confidence}% confidence</span>
        </div>
        ${confBar}
        ${evidenceHtml}
      `;
    }

    // Project Map section
    const mapBody = el("po-map-body");
    mapBody.innerHTML = "";
    const modules = data.projectMap?.modules || [];
    for (const mod of modules) {
      if (!mod.files?.length) continue;
      const icon = MODULE_ICONS[mod.icon] || MODULE_ICONS["file-text"];
      const item = document.createElement("div");
      item.className = "po-map-module";
      item.innerHTML = `
        <div class="po-map-module-header" data-collapsed="true">
          <span class="po-map-icon">${icon}</span>
          <span class="po-map-name">${mod.name}</span>
          <span class="po-map-count">${mod.files.length}</span>
          <span class="po-map-arrow">›</span>
        </div>
        <div class="po-map-files" style="display:none">
          ${mod.files.slice(0, 20).map(f => `<div class="po-map-file" title="${f}">${basename(f)}</div>`).join("")}
          ${mod.files.length > 20 ? `<div class="po-map-file po-map-more">+${mod.files.length - 20} more</div>` : ""}
        </div>
      `;
      // Collapse/expand
      item.querySelector(".po-map-module-header").addEventListener("click", function() {
        const files = item.querySelector(".po-map-files");
        const arrow = item.querySelector(".po-map-arrow");
        const collapsed = this.dataset.collapsed === "true";
        files.style.display = collapsed ? "block" : "none";
        arrow.textContent = collapsed ? "⌄" : "›";
        this.dataset.collapsed = String(!collapsed);
      });
      mapBody.appendChild(item);
    }
    if (!modules.length) {
      mapBody.innerHTML = '<div class="po-empty-modules">No modules detected</div>';
    }

    // Footer
    const footer = el("po-footer");
    footer.innerHTML = data.scanDurationMs
      ? `<span class="po-scan-time">Scanned in ${data.scanDurationMs}ms</span>`
      : "";
  }

  // ── State helpers ─────────────────────────────────────────────────

  function showLoading() {
    el("po-loading").style.display = "flex";
    el("po-empty").style.display = "none";
    el("po-content").style.display = "none";
  }

  function showEmpty(msg = "Open a folder to see project intelligence") {
    el("po-loading").style.display = "none";
    el("po-empty").style.display = "flex";
    el("po-content").style.display = "none";
    el("po-empty").querySelector("p").innerHTML = msg.replace("\n", "<br>");
  }

  function showContent() {
    el("po-loading").style.display = "none";
    el("po-empty").style.display = "none";
    el("po-content").style.display = "flex";
    el("po-content").style.flexDirection = "column";
  }

  // ── HTML builders ─────────────────────────────────────────────────

  function mkBadge(label, color, title = "") {
    const tip = title ? ` title="${title}"` : "";
    return `<span class="po-badge"${tip} style="--badge-color:${color}">${label}</span>`;
  }

  function mkRow(label, badgesHtml) {
    const row = document.createElement("div");
    row.className = "po-overview-row";
    row.innerHTML = `
      <span class="po-row-label">${label}</span>
      <span class="po-row-badges">${badgesHtml}</span>
    `;
    return row;
  }

  function basename(path) {
    return path.replace(/\\/g, "/").split("/").pop() || path;
  }

  // ── Auto-scan when workspace opens ────────────────────────────────
  // app.js dispatches "workspace-opened" on document (not window) with detail.path
  document.addEventListener("workspace-opened", (e) => {
    const root = e.detail?.path;
    if (root) onWorkspaceOpen(root);
  });

  return { show, hide, onWorkspaceOpen, triggerScan };
})();

// ── Activity Bar integration ───────────────────────────────────────────────────
// Runs after activity-bar.js DOMContentLoaded binding
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("ab-project");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const ab = window.ActivityBar;

    const isVisible = document.getElementById("project-overview-panel")?.style.display !== "none";
    const isSidebarVisible = document.getElementById("sidebar") &&
      !document.getElementById("sidebar").classList.contains("hidden");

    if (isVisible && isSidebarVisible) {
      // Second click — collapse
      document.getElementById("sidebar")?.classList.add("hidden");
      document.getElementById("resize-handle")?.classList.add("hidden");
      btn.classList.remove("ab-active");
      ProjectOverview.hide();
      window.sidebarVisible = false;
    } else {
      // Show sidebar with project panel
      _showProjectPanel();
    }
  });
});

function _showProjectPanel() {
  const sidebar = document.getElementById("sidebar");
  const resizeHandle = document.getElementById("resize-handle");

  // Hide every other sidebar panel
  ["explorer-content", "no-folder-msg", "search-panel", "code-graph-panel"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Show sidebar + project panel
  sidebar?.classList.remove("hidden");
  resizeHandle?.classList.remove("hidden");
  window.sidebarVisible = true;

  // Update sidebar title
  const title = sidebar?.querySelector(".sidebar-title");
  if (title) title.textContent = "PROJECT";

  // Deactivate other ab buttons
  document.querySelectorAll(".ab-btn").forEach(b => b.classList.remove("ab-active"));
  document.getElementById("ab-project")?.classList.add("ab-active");

  ProjectOverview.show();

  window.dispatchEvent(new CustomEvent("sidebar-shown"));
}

// Expose globally for command palette / menu integration
window.ProjectOverview = ProjectOverview;
