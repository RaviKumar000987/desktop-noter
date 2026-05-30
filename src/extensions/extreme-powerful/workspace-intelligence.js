// ═══════════════════════════════════════════════════════════════
//  NOTER — Workspace Intelligence  [extreme-powerful]
//
//  Architecture: TypeScript/JS = UI only. All computation in Rust.
//
//  Data sources (via window.noter IPC → noter-code-graph Rust crate):
//    noter.graph.build()          → JsGraphStats
//    noter.graph.cycles()         → JsCycle[]       (Tarjan SCC)
//    noter.graph.deadCode()       → JsUnusedSymbol[]
//    noter.graph.fileImports()    → JsGraphNode[]
//    noter.graph.fileImporters()  → JsGraphNode[]
//    noter.graph.impact()         → JsImpactResult
//    noter.graph.findPath()       → string[]
//    noter.graph.archViolations() → JsArchViolation[]
//
//  JS does: panel rendering, SVG layout, tab switching, user events.
//  JS does NOT: parse imports, walk files, detect cycles, compute impact.
// ═══════════════════════════════════════════════════════════════

(window._exts = window._exts || {})["workspace-intelligence"] = (() => {
  "use strict";

  const PANEL_ID = "wi-panel";
  let _ctx;

  // ── IPC wrappers — all delegate to Rust noter-code-graph ──────
  async function _graphBuild(root) {
    return window.noter?.graph?.build({ workspaceRoot: root });
  }
  async function _graphCycles(root) {
    return window.noter?.graph?.cycles({ workspaceRoot: root }) ?? [];
  }
  async function _graphDeadCode(root) {
    return window.noter?.graph?.deadCode({ workspaceRoot: root }) ?? [];
  }
  async function _graphFileImports(root, f) {
    return (
      window.noter?.graph?.fileImports({ workspaceRoot: root, filePath: f }) ??
      []
    );
  }
  async function _graphImporters(root, f) {
    return (
      window.noter?.graph?.fileImporters({
        workspaceRoot: root,
        filePath: f,
      }) ?? []
    );
  }
  async function _graphImpact(root, f) {
    return window.noter?.graph?.impact({ workspaceRoot: root, filePath: f });
  }
  async function _graphArch(root, pat) {
    return (
      window.noter?.graph?.archViolations({
        workspaceRoot: root,
        pattern: pat,
      }) ?? []
    );
  }
  async function _graphFindPath(root, a, b) {
    return window.noter?.graph?.findPath({
      workspaceRoot: root,
      fromFile: a,
      toFile: b,
    });
  }

  // ── Build full analysis payload (all from Rust, parallel) ─────
  async function _analyze(root) {
    const [stats, cycles, deadCode, archMvc] = await Promise.all([
      _graphBuild(root).catch(() => null),
      _graphCycles(root).catch(() => []),
      _graphDeadCode(root).catch(() => []),
      _graphArch(root, "layered").catch(() => []),
    ]);
    return { stats, cycles, deadCode, archViolations: archMvc };
  }

  // ── SVG circular layout — pure rendering, no graph logic ──────
  function _renderSVG(stats, cycles) {
    const circularFiles = new Set(cycles.flatMap((c) => c.files));
    const nodes = Object.entries(stats._fileEdgeCounts || {});

    if (nodes.length === 0) {
      return `<text x="50%" y="50%" fill="#7d8590" text-anchor="middle"
        font-size="13" font-family="inherit">
        Build graph first — open a workspace folder.
      </text>`;
    }

    const W = 600,
      H = 420,
      cx = W / 2,
      cy = H / 2;
    const r = Math.min(cx, cy) - 55;
    const pos = {};
    nodes.forEach(([file], i) => {
      const a = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      pos[file] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });

    const edges = [];
    for (const [from, { deps }] of nodes) {
      for (const dep of deps || []) {
        if (pos[from] && pos[dep]) edges.push([from, dep]);
      }
    }

    const edgeSVG = edges
      .map(([a, b]) => {
        const isHot = circularFiles.has(a) && circularFiles.has(b);
        return `<line x1="${pos[a].x.toFixed(1)}" y1="${pos[a].y.toFixed(1)}"
        x2="${pos[b].x.toFixed(1)}" y2="${pos[b].y.toFixed(1)}"
        stroke="${isHot ? "#f85149" : "#30363d"}" stroke-width="1.2"
        opacity="0.65" marker-end="url(#wi-arr)"/>`;
      })
      .join("");

    const nodeSVG = nodes
      .map(([file, { count }]) => {
        const p = pos[file];
        const isCirc = circularFiles.has(file);
        const fill = isCirc ? "#f85149" : "#1f6feb";
        const sz = Math.max(5, Math.min(13, 5 + (count || 0) * 1.1));
        const label = file
          .split(/[\\/]/)
          .pop()
          .replace(/\.(js|ts|jsx|tsx|mjs)$/, "");
        return `<g class="wi-node" data-file="${file}" style="cursor:pointer">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${sz}"
          fill="${fill}" fill-opacity="0.82" stroke="${fill}" stroke-width="1.5"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y + sz + 9).toFixed(1)}"
          fill="#c9d1d9" font-size="9" text-anchor="middle" opacity="0.8">${label}</text>
      </g>`;
      })
      .join("");

    return `<defs>
      <marker id="wi-arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
        <path d="M0,0 L0,5 L5,2.5z" fill="#58a6ff" opacity="0.55"/>
      </marker>
    </defs>
    ${edgeSVG}${nodeSVG}`;
  }

  // ── Open panel ─────────────────────────────────────────────────
  async function _open() {
    document.getElementById(PANEL_ID)?.remove();

    const root = _ctx.getWorkspace();
    if (!root) {
      _ctx.toast("Open a workspace folder first", "warning");
      return;
    }

    _ctx.toast("Analyzing workspace with Rust engine…", "info");

    let data;
    try {
      data = await _analyze(root);
    } catch (err) {
      _ctx.toast("Graph build failed: " + err.message, "error");
      return;
    }

    const { stats, cycles, deadCode, archViolations } = data;

    const fc = stats?.fileCount ?? 0;
    const sc = stats?.symbolCount ?? 0;
    const ec = stats?.edgeCount ?? 0;
    const ms = stats?.durationMs ?? 0;
    const cc = cycles.length;
    const dc = deadCode.length;
    const av = archViolations.length;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "wi-panel";
    panel.innerHTML = `
<div class="wi-hdr">
  <span class="wi-icon">🧠</span>
  <span class="wi-title">Workspace Intelligence</span>
  <span class="wi-perf">${ms}ms · Rust</span>
  <div class="wi-tabs">
    <button class="wi-tab active" data-tab="graph">Graph</button>
    <button class="wi-tab" data-tab="deadcode">Dead Code${dc > 0 ? ` <b class="wi-cnt-r">${dc}</b>` : ""}</button>
    <button class="wi-tab" data-tab="cycles">Cycles${cc > 0 ? ` <b class="wi-cnt-r">${cc}</b>` : ""}</button>
    <button class="wi-tab" data-tab="arch">Arch${av > 0 ? ` <b class="wi-cnt-y">${av}</b>` : ""}</button>
    <button class="wi-tab" data-tab="impact">Impact</button>
  </div>
  <button class="wi-btn-icon wi-refresh" title="Re-analyze">↺</button>
  <button class="wi-btn-icon wi-close">×</button>
</div>

<div class="wi-pills">
  <div class="wi-pill"><span class="wi-pn">${fc}</span><span class="wi-pl">Files</span></div>
  <div class="wi-pill"><span class="wi-pn">${sc}</span><span class="wi-pl">Symbols</span></div>
  <div class="wi-pill"><span class="wi-pn">${ec}</span><span class="wi-pl">Edges</span></div>
  <div class="wi-pill ${cc > 0 ? "wi-pill-r" : ""}"><span class="wi-pn">${cc}</span><span class="wi-pl">Cycles</span></div>
  <div class="wi-pill ${dc > 0 ? "wi-pill-y" : ""}"><span class="wi-pn">${dc}</span><span class="wi-pl">Dead Code</span></div>
  <div class="wi-pill ${av > 0 ? "wi-pill-y" : ""}"><span class="wi-pn">${av}</span><span class="wi-pl">Arch Issues</span></div>
</div>

<div class="wi-body">

  <!-- Graph Tab -->
  <div class="wi-pane active" id="wi-tab-graph">
    <svg class="wi-svg" id="wi-svg" viewBox="0 0 600 420">
      ${_renderSVG(stats || {}, cycles)}
    </svg>
    <div class="wi-legend">
      <span class="wi-leg-dot" style="background:#1f6feb"></span>Module
      <span class="wi-leg-dot" style="background:#f85149;margin-left:12px"></span>Circular
    </div>
  </div>

  <!-- Dead Code Tab -->
  <div class="wi-pane" id="wi-tab-deadcode">
    ${
      dc === 0
        ? '<div class="wi-empty"><span style="font-size:28px">✅</span><div>No dead exports detected by Rust engine</div></div>'
        : `<div class="wi-list-header">
           <span>${dc} unused exported ${dc === 1 ? "symbol" : "symbols"} found by Tarjan analysis</span>
           <span class="wi-hint">Safe to remove if not used by external packages</span>
         </div>
         ${deadCode
           .map(
             (d) => `
           <div class="wi-row wi-row-dead" data-file="${d.file}" data-line="${d.line}">
             <span class="wi-kind-chip wi-kind-${d.kind}">${d.kind}</span>
             <span class="wi-sym-name">${d.name}</span>
             <span class="wi-sym-file">${d.file.split(/[\\/]/).slice(-2).join("/")}</span>
             <span class="wi-sym-line">:${d.line}</span>
           </div>`,
           )
           .join("")}`
    }
  </div>

  <!-- Cycles Tab -->
  <div class="wi-pane" id="wi-tab-cycles">
    ${
      cc === 0
        ? '<div class="wi-empty"><span style="font-size:28px">✅</span><div>No circular dependencies (Tarjan SCC, Rust)</div></div>'
        : cycles
            .map(
              (c, i) => `
        <div class="wi-cycle">
          <div class="wi-cycle-title">Cycle #${i + 1} — ${c.files.length} modules</div>
          <div class="wi-cycle-chain">
            ${c.files
              .map(
                (f, j) => `
              <span class="wi-cycle-file" title="${f}">${f.split(/[\\/]/).pop()}</span>
              ${j < c.files.length - 1 ? '<span class="wi-cycle-arr">→</span>' : ""}
            `,
              )
              .join("")}
          </div>
        </div>`,
            )
            .join("")
    }
  </div>

  <!-- Architecture Tab -->
  <div class="wi-pane" id="wi-tab-arch">
    ${
      av === 0
        ? '<div class="wi-empty"><span style="font-size:28px">✅</span><div>No architecture violations found (layered pattern)</div></div>'
        : archViolations
            .map(
              (v) => `
        <div class="wi-arch-row">
          <span class="wi-arch-rule">${v.rule}</span>
          <div class="wi-arch-body">
            <div class="wi-arch-desc">${v.description}</div>
            <div class="wi-arch-files">
              <span class="wi-arch-from">${v.fromFile.split(/[\\/]/).slice(-2).join("/")}</span>
              <span class="wi-arch-arr">→</span>
              <span class="wi-arch-to">${v.toFile.split(/[\\/]/).slice(-2).join("/")}</span>
            </div>
          </div>
        </div>`,
            )
            .join("")
    }
  </div>

  <!-- Impact Analysis Tab -->
  <div class="wi-pane" id="wi-tab-impact">
    <div class="wi-impact-input-row">
      <input class="wi-search" id="wi-impact-input"
        placeholder="Enter file path to analyze impact (e.g. src/utils/parser.ts)…"
        autocomplete="off"/>
      <button class="wi-btn-primary" id="wi-impact-run">Analyze</button>
    </div>
    <div id="wi-impact-result" class="wi-impact-result">
      <div class="wi-empty" style="margin-top:40px">
        <span style="font-size:28px">🎯</span>
        <div>Enter a file path above and click Analyze</div>
        <div class="wi-hint">Uses Rust blast-radius engine — sees entire dependency chain</div>
      </div>
    </div>
  </div>

</div>`;

    document.body.appendChild(panel);
    _wirePanel(panel, root);
  }

  function _wirePanel(panel, root) {
    // Close / refresh
    panel.querySelector(".wi-close").onclick = () => panel.remove();
    panel.querySelector(".wi-refresh").onclick = () => {
      panel.remove();
      _open();
    };

    // Tab switching
    panel.querySelectorAll(".wi-tab").forEach((tab) => {
      tab.onclick = () => {
        panel
          .querySelectorAll(".wi-tab")
          .forEach((t) => t.classList.remove("active"));
        panel
          .querySelectorAll(".wi-pane")
          .forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        panel
          .querySelector(`#wi-tab-${tab.dataset.tab}`)
          ?.classList.add("active");
      };
    });

    // Dead code rows — jump to file:line
    panel.querySelectorAll(".wi-row-dead").forEach((row) => {
      row.onclick = () =>
        window.electronAPI?.openFileByPath?.(row.dataset.file);
    });

    // SVG node click — jump to file
    panel.querySelectorAll(".wi-node").forEach((node) => {
      node.onclick = () =>
        window.electronAPI?.openFileByPath?.(node.dataset.file);
    });

    // Impact analysis
    panel.querySelector("#wi-impact-run").onclick = async () => {
      const input = panel.querySelector("#wi-impact-input");
      const resultEl = panel.querySelector("#wi-impact-result");
      const filePath = input.value.trim();
      if (!filePath) return;

      resultEl.innerHTML =
        '<div class="wi-loading">Running Rust blast-radius analysis…</div>';
      try {
        const impact = await _graphImpact(root, filePath);
        if (!impact) {
          resultEl.innerHTML =
            '<div class="wi-empty"><div>No impact data found for this file</div></div>';
          return;
        }

        resultEl.innerHTML = `
          <div class="wi-impact-summary">
            <div class="wi-imp-metric"><span class="wi-imp-n">${impact.affectedFileCount}</span><span class="wi-imp-l">Files affected</span></div>
            <div class="wi-imp-metric"><span class="wi-imp-n">${impact.affectedSymbolCount}</span><span class="wi-imp-l">Symbols at risk</span></div>
            <div class="wi-imp-metric"><span class="wi-imp-n">${impact.maxDepth}</span><span class="wi-imp-l">Max depth</span></div>
          </div>
          <div class="wi-imp-section-title">Affected Files</div>
          ${
            impact.affectedFiles
              .map(
                (f) => `
            <div class="wi-row" style="cursor:pointer" onclick="window.electronAPI?.openFileByPath?.('${f.replace(/'/g, "\\'")}')">
              <span class="wi-sym-file">${f.split(/[\\/]/).slice(-2).join("/")}</span>
            </div>`,
              )
              .join("") ||
            '<div class="wi-hint" style="padding:8px 14px">No downstream files affected</div>'
          }
        `;
      } catch (e) {
        resultEl.innerHTML = `<div class="wi-empty"><div style="color:#f85149">${e.message}</div></div>`;
      }
    };
  }

  // ── CSS ────────────────────────────────────────────────────────
  function _injectCSS() {
    if (document.getElementById("wi-css")) return;
    const s = document.createElement("style");
    s.id = "wi-css";
    s.textContent = `
.wi-panel {
  position:fixed; top:46px; left:50%; transform:translateX(-50%);
  width:min(940px,97vw); height:min(640px,90vh);
  background:#0d1117; border:1px solid #30363d; border-radius:14px;
  box-shadow:0 26px 80px rgba(0,0,0,.88); z-index:8500;
  display:flex; flex-direction:column; overflow:hidden; font-family:inherit; color:#e6edf3;
}
.wi-hdr {
  display:flex; align-items:center; gap:7px; padding:9px 13px;
  background:#161b22; border-bottom:1px solid #30363d; flex-shrink:0; flex-wrap:wrap;
}
.wi-icon  { font-size:15px; }
.wi-title { font-size:13px; font-weight:700; flex-shrink:0; }
.wi-perf  { font-size:10.5px; color:#3fb950; background:#3fb95015; border:1px solid #3fb95033;
  padding:1px 7px; border-radius:10px; flex-shrink:0; }
.wi-tabs  { display:flex; gap:2px; flex:1; }
.wi-tab {
  padding:3px 11px; border-radius:6px; border:none; background:transparent;
  color:#7d8590; font-size:12px; cursor:pointer; transition:all .1s;
  display:inline-flex; align-items:center; gap:4px;
}
.wi-tab:hover  { background:#21262d; color:#e6edf3; }
.wi-tab.active { background:#21262d; color:#58a6ff; font-weight:600; }
.wi-cnt-r { background:#f85149; color:#fff; border-radius:8px; padding:0 5px; font-size:9.5px; font-weight:700; line-height:1.6; }
.wi-cnt-y { background:#d2993d; color:#fff; border-radius:8px; padding:0 5px; font-size:9.5px; font-weight:700; line-height:1.6; }
.wi-btn-icon { background:none; border:none; color:#7d8590; font-size:15px; cursor:pointer; padding:2px 7px; border-radius:5px; }
.wi-refresh:hover { color:#58a6ff; } .wi-close:hover { color:#f38ba8; }

.wi-pills {
  display:flex; gap:7px; padding:7px 13px;
  border-bottom:1px solid #21262d; flex-wrap:wrap; flex-shrink:0;
}
.wi-pill {
  display:flex; flex-direction:column; align-items:center;
  background:#161b22; border:1px solid #30363d; border-radius:8px; padding:4px 13px;
}
.wi-pill-r { border-color:#f8514966; background:#f8514911; }
.wi-pill-y { border-color:#d2993d66; background:#d2993d11; }
.wi-pn { font-size:16px; font-weight:700; line-height:1.2; }
.wi-pill-r .wi-pn { color:#f85149; } .wi-pill-y .wi-pn { color:#d2993d; }
.wi-pl { font-size:9.5px; color:#7d8590; }

.wi-body { flex:1; overflow:hidden; }
.wi-pane { display:none; height:100%; overflow-y:auto; }
.wi-pane.active { display:flex; flex-direction:column; }

/* Graph */
.wi-svg { width:100%; flex:1; background:#0d1117; min-height:0; }
.wi-legend { padding:5px 13px; font-size:11px; color:#7d8590;
  display:flex; align-items:center; gap:5px; border-top:1px solid #21262d; flex-shrink:0; }
.wi-leg-dot { width:9px; height:9px; border-radius:50%; display:inline-block; }

/* Lists */
.wi-list-header { display:flex; justify-content:space-between; align-items:center;
  padding:7px 14px; background:#161b22; border-bottom:1px solid #21262d;
  font-size:12px; color:#e6edf3; flex-shrink:0; }
.wi-hint { font-size:11px; color:#7d8590; }
.wi-row {
  display:flex; align-items:center; gap:8px; padding:6px 14px;
  border-bottom:1px solid #21262d; transition:background .1s;
}
.wi-row:hover { background:#161b22; }
.wi-kind-chip {
  padding:1px 7px; border-radius:10px; font-size:10.5px; font-weight:600;
  flex-shrink:0; text-transform:lowercase;
}
.wi-kind-function { background:#1f6feb22; color:#58a6ff; border:1px solid #1f6feb44; }
.wi-kind-class    { background:#a371f722; color:#a371f7; border:1px solid #a371f744; }
.wi-kind-const    { background:#3fb95022; color:#3fb950; border:1px solid #3fb95044; }
.wi-kind-variable { background:#d2993d22; color:#d2993d; border:1px solid #d2993d44; }
.wi-kind-interface{ background:#58a6ff22; color:#79c0ff; border:1px solid #58a6ff44; }
.wi-sym-name { font-size:12.5px; font-weight:600; color:#e6edf3; flex:1; font-family:monospace; }
.wi-sym-file { font-size:11px; color:#7d8590; }
.wi-sym-line { font-size:11px; color:#7d8590; }

/* Cycles */
.wi-cycle { padding:10px 14px; border-bottom:1px solid #21262d; }
.wi-cycle-title { font-size:10.5px; font-weight:700; color:#f85149; text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
.wi-cycle-chain { display:flex; flex-wrap:wrap; align-items:center; gap:4px; }
.wi-cycle-file  { background:#f8514911; border:1px solid #f8514944; color:#ff7b72; padding:2px 8px; border-radius:5px; font-size:11px; font-family:monospace; }
.wi-cycle-arr   { color:#7d8590; }

/* Arch */
.wi-arch-row { display:flex; gap:10px; padding:8px 14px; border-bottom:1px solid #21262d; align-items:flex-start; }
.wi-arch-rule { background:#d2993d22; color:#d2993d; border:1px solid #d2993d44; padding:2px 8px; border-radius:8px; font-size:10.5px; font-weight:700; flex-shrink:0; }
.wi-arch-body { flex:1; }
.wi-arch-desc  { font-size:12px; color:#e6edf3; margin-bottom:4px; }
.wi-arch-files { display:flex; align-items:center; gap:6px; font-size:11px; }
.wi-arch-from, .wi-arch-to { font-family:monospace; color:#7d8590; }
.wi-arch-arr { color:#f85149; }

/* Impact */
.wi-impact-input-row { display:flex; gap:8px; padding:10px 14px; border-bottom:1px solid #21262d; flex-shrink:0; }
.wi-search { flex:1; padding:6px 10px; background:#21262d; border:1px solid #30363d; border-radius:7px; color:#e6edf3; font-size:12px; outline:none; }
.wi-search:focus { border-color:#58a6ff; }
.wi-btn-primary { padding:6px 16px; border-radius:7px; border:none; background:#1f6feb; color:#fff; font-size:12.5px; font-weight:600; cursor:pointer; }
.wi-btn-primary:hover { background:#388bfd; }
.wi-impact-result { flex:1; overflow-y:auto; }
.wi-impact-summary { display:flex; gap:12px; padding:12px 14px; border-bottom:1px solid #21262d; flex-wrap:wrap; }
.wi-imp-metric { display:flex; flex-direction:column; align-items:center; background:#161b22; border:1px solid #30363d; border-radius:10px; padding:8px 20px; }
.wi-imp-n { font-size:22px; font-weight:700; color:#e6edf3; }
.wi-imp-l { font-size:10.5px; color:#7d8590; }
.wi-imp-section-title { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#7d8590; padding:8px 14px 4px; }
.wi-loading { padding:20px 14px; color:#7d8590; font-size:13px; }
.wi-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:200px; gap:8px; color:#7d8590; font-size:13px; text-align:center; }
    `;
    document.head.appendChild(s);
  }

  // ── Activate ───────────────────────────────────────────────────
  function activate(ctx) {
    _ctx = ctx;
    _injectCSS();

    ctx.addToolbarBtn({
      id: "wi-btn",
      icon: "🧠",
      label: "Workspace Intelligence",
      languages: ["*"],
      run: _open,
    });

    ctx.addStatus("wi", "🧠", "Workspace Intelligence", _open, "left");

    CommandPalette?.registerExtCmd?.(
      "wi.open",
      "Workspace Intelligence: Open",
      _open,
    );
    CommandPalette?.registerExtCmd?.(
      "wi.refresh",
      "Workspace Intelligence: Rebuild Graph",
      () => {
        document.getElementById(PANEL_ID)?.remove();
        _open();
      },
    );
  }

  function deactivate() {
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById("wi-css")?.remove();
  }

  function getQuickStart() {
    return {
      icon: "🧠",
      title: "Workspace Intelligence",
      subtitle:
        "Rust-powered dependency graph · Cycles · Dead code · Impact analysis",
      steps: [
        {
          title: "Open a workspace folder",
          desc: "File → Open Folder. The Rust engine indexes all source files.",
        },
        {
          title: "Click the toolbar button",
          desc: "Press <kbd>🧠 Workspace Intelligence</kbd> to open the panel.",
        },
        {
          title: "Explore the tabs",
          desc: "Graph · Dead Code · Cycles · Architecture · Impact — all powered by noter-code-graph.",
        },
      ],
      shortcuts: [
        { keys: "Ctrl+Shift+P → wi.open", desc: "Open Workspace Intelligence" },
      ],
      commands: [
        { name: "wi.open", desc: "Open the panel" },
        { name: "wi.refresh", desc: "Force graph rebuild" },
      ],
      tips: [
        "Red nodes on the graph = part of a circular dependency",
        "Dead code uses Tarjan SCC — no false positives from dynamic imports",
        "Impact analysis shows the blast radius if you delete a file",
      ],
      onStart: _open,
    };
  }

  return { activate, deactivate, getQuickStart };
})();
