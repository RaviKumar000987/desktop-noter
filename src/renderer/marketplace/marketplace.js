// ═══════════════════════════════════════════════════════════════
//  NOTER APP — marketplace.js
//  Extension Marketplace System — Version 1
//  Backend: GitHub (falls back to embedded registry)
// ═══════════════════════════════════════════════════════════════

// ── Embedded Extension Registry (V1) ───────────────────────────
const MARKETPLACE_REGISTRY = {
  version: "1.0.0",
  lastUpdated: "2026-05-28",
  marketplaceRepo: "https://github.com/noter-app/marketplace",
  extensions: [
    {
      id: "dsa-forge",
      name: "DSA Forge",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Complete DSA reference with 200+ optimized code snippets for competitive programming and interviews.",
      longDescription: "DSA Forge brings a comprehensive Data Structures & Algorithms reference directly into your editor. Featuring 200+ battle-tested code snippets covering arrays, linked lists, trees, graphs, dynamic programming patterns, sorting algorithms, binary search, and more. Built for interview prep and competitive programming.",
      version: "1.2.0",
      category: "Education",
      tags: ["algorithms", "data-structures", "snippets", "competitive-programming"],
      icon: "🧮",
      rating: 4.8,
      ratingCount: 1247,
      downloads: 8920,
      isOfficial: true,
      size: "2.1 MB",
      changelog: "v1.2.0 — Added graph algorithms, DP templates, string processing patterns\nv1.1.0 — BST and heap implementations with examples\nv1.0.0 — Initial release with 150+ snippets",
      featured: true,
      downloadUrl: null,
    },
    {
      id: "theme-studio",
      name: "Theme Studio",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Premium theme collection with 12 hand-crafted color schemes for the perfect coding environment.",
      longDescription: "Transform your editor with Theme Studio's curated collection of 12 professional color schemes. Each theme is carefully designed for eye comfort, readability, and aesthetic appeal across all file types. Includes Nord, Dracula, Solarized, Gruvbox, and exclusive NoteLab originals.",
      version: "2.0.1",
      category: "Themes",
      tags: ["themes", "colors", "ui", "dark-mode"],
      icon: "🎨",
      rating: 4.9,
      ratingCount: 3821,
      downloads: 24500,
      isOfficial: true,
      size: "0.8 MB",
      changelog: "v2.0.1 — Fixed contrast ratios for WCAG accessibility\nv2.0.0 — Added 4 new themes: Nord, Dracula, One Dark, Rosé Pine\nv1.5.0 — Added Solarized and Gruvbox themes",
      featured: true,
      downloadUrl: null,
    },
    {
      id: "git-insights",
      name: "Git Insights",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Powerful Git integration with inline blame, commit history, branch management, and diff viewer.",
      longDescription: "Git Insights supercharges your Git workflow with inline blame annotations showing who changed each line, a full commit history browser, interactive diff viewer, branch management panel, and stash management — all without leaving your editor.",
      version: "1.4.0",
      category: "Tools",
      tags: ["git", "version-control", "blame", "diff", "branches"],
      icon: "📊",
      rating: 4.7,
      ratingCount: 892,
      downloads: 5680,
      isOfficial: true,
      size: "3.2 MB",
      changelog: "v1.4.0 — Interactive diff viewer with word-level highlighting\nv1.3.0 — Branch management and merge conflict resolver\nv1.2.0 — Commit history browser with file tree",
      featured: true,
      downloadUrl: null,
    },
    {
      id: "react-snippets",
      name: "React Snippets",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "300+ React and JSX snippets including hooks, components, Next.js patterns, and TypeScript types.",
      longDescription: "Accelerate React development with 300+ production-ready snippets covering React hooks (useState, useEffect, useCallback, useMemo, useRef, custom hooks), functional components, class components, Context API, Next.js 14 app router patterns, and full TypeScript type annotations.",
      version: "3.1.0",
      category: "Tools",
      tags: ["react", "jsx", "nextjs", "snippets", "typescript", "hooks"],
      icon: "⚛",
      rating: 4.8,
      ratingCount: 2156,
      downloads: 14200,
      isOfficial: true,
      size: "1.4 MB",
      changelog: "v3.1.0 — Next.js 14 app router and Server Components\nv3.0.0 — Full TypeScript support with generics\nv2.5.0 — React 18 concurrent features and Suspense",
      featured: true,
      downloadUrl: null,
    },
    {
      id: "python-power",
      name: "Python Power",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Python snippets, docstring templates, and common patterns for data science and web development.",
      longDescription: "Python Power provides 250+ Python snippets covering data science (NumPy, Pandas, Matplotlib, scikit-learn), web development (FastAPI, Django, Flask, SQLAlchemy), async programming patterns, testing with pytest, and common algorithmic patterns with docstrings.",
      version: "1.8.0",
      category: "Education",
      tags: ["python", "snippets", "data-science", "django", "fastapi", "pytest"],
      icon: "🐍",
      rating: 4.6,
      ratingCount: 731,
      downloads: 4120,
      isOfficial: true,
      size: "1.9 MB",
      changelog: "v1.8.0 — FastAPI async patterns and Pydantic models\nv1.7.0 — Data science snippets: NumPy, Pandas, Matplotlib\nv1.6.0 — Django ORM and DRF serializer templates",
      featured: false,
      downloadUrl: null,
    },
    {
      id: "markdown-pro",
      name: "Markdown Pro",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Enhanced Markdown editing with live preview, table of contents, Mermaid diagrams, and export.",
      longDescription: "Markdown Pro elevates your documentation workflow with a real-time side-by-side preview, auto-generated table of contents, smart formatting shortcuts, Mermaid diagram rendering, GitHub Flavored Markdown support, and export to clean HTML.",
      version: "2.3.0",
      category: "Tools",
      tags: ["markdown", "preview", "documentation", "mermaid", "diagrams"],
      icon: "📝",
      rating: 4.7,
      ratingCount: 1043,
      downloads: 6890,
      isOfficial: true,
      size: "4.1 MB",
      changelog: "v2.3.0 — Mermaid diagram live rendering\nv2.2.0 — HTML export with CSS theming\nv2.1.0 — Auto table of contents sidebar",
      featured: false,
      downloadUrl: null,
    },
    {
      id: "code-runner",
      name: "Code Runner",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Run code snippets for 30+ languages directly in the integrated terminal with one click.",
      longDescription: "Code Runner adds a play button toolbar to your editor that executes the current file or selected code snippet in the integrated terminal. Supports 30+ languages with intelligent run commands, custom configurations, and output formatting.",
      version: "1.5.0",
      category: "Tools",
      tags: ["runner", "execute", "terminal", "multi-language", "productivity"],
      icon: "▶",
      rating: 4.5,
      ratingCount: 1892,
      downloads: 11340,
      isOfficial: true,
      size: "0.5 MB",
      changelog: "v1.5.0 — Added Julia, Kotlin, Dart, Zig support\nv1.4.0 — Custom run command configuration per language\nv1.3.0 — Output syntax highlighting",
      featured: false,
      downloadUrl: null,
    },
    {
      id: "file-icons-pro",
      name: "File Icons Pro",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "600+ beautiful file and folder icons for every language, framework, and file convention.",
      longDescription: "File Icons Pro provides 600+ meticulously designed icons for every file type, framework, and naming convention. Instantly recognise files with icons for React, Vue, Angular, Svelte, Django, Rails, Docker, Kubernetes, and dozens more. Includes unique folder icons for src, tests, assets, and more.",
      version: "4.2.0",
      category: "Themes",
      tags: ["icons", "themes", "file-types", "ui", "visual"],
      icon: "🗂",
      rating: 4.9,
      ratingCount: 4521,
      downloads: 31200,
      isOfficial: true,
      size: "12.5 MB",
      changelog: "v4.2.0 — Bun, Deno, Astro, SolidJS icons added\nv4.1.0 — 100 new framework-specific icons\nv4.0.0 — Complete icon set redesign with SVG",
      featured: false,
      downloadUrl: null,
    },
    {
      id: "json-wizard",
      name: "JSON Wizard",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Advanced JSON editor with schema validation, formatter, diff view, and JSONPath query tools.",
      longDescription: "JSON Wizard transforms your JSON editing experience with real-time JSON Schema validation, one-click formatting and minification, visual diff tool for comparing JSON objects, JSONPath query playground, and instant conversion to CSV and YAML formats.",
      version: "1.3.0",
      category: "Tools",
      tags: ["json", "schema", "validation", "formatter", "jsonpath"],
      icon: "🔮",
      rating: 4.6,
      ratingCount: 642,
      downloads: 3870,
      isOfficial: true,
      size: "1.1 MB",
      changelog: "v1.3.0 — JSONPath query playground panel\nv1.2.0 — YAML and CSV export support\nv1.1.0 — JSON Schema validation engine",
      featured: false,
      downloadUrl: null,
    },
    {
      id: "bracket-colors",
      name: "Bracket Colors",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Rainbow bracket colorization for deeply nested code with fully customizable color palettes.",
      longDescription: "Bracket Colors makes navigating deeply nested code effortless by colorizing matching bracket pairs in distinct, harmonious colors. Supports round (), square [], and curly {} brackets with customizable palettes that integrate with any editor theme.",
      version: "1.1.0",
      category: "Tools",
      tags: ["brackets", "colors", "readability", "ui", "syntax"],
      icon: "🌈",
      rating: 4.4,
      ratingCount: 2134,
      downloads: 9870,
      isOfficial: true,
      size: "0.3 MB",
      changelog: "v1.1.0 — Customizable color palettes with theme presets\nv1.0.1 — Major performance improvements for large files\nv1.0.0 — Initial release",
      featured: false,
      downloadUrl: null,
    },

    // ── NEW OFFICIAL EXTENSIONS (Phase 3) ────────────────────────

    {
      id: "prettier-pro",
      name: "Prettier Pro",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Format HTML, CSS, JS, TS, JSON, JSX on save or on demand. Configurable tab width, quotes, and semicolons.",
      longDescription: "Prettier Pro brings professional code formatting to your workflow. Format any document instantly with one command or enable Format on Save for automatic cleanup. Supports JS, TS, JSX, TSX, HTML, CSS, SCSS, JSON, and Markdown. Configurable options: tab width (2/4), single vs double quotes, semicolons on/off, trailing commas, print width. Integrates with the command palette and status bar.",
      version: "1.2.0",
      category: "Productivity",
      tags: ["formatter", "prettier", "code-style", "javascript", "typescript", "html", "css"],
      icon: "✨",
      rating: 4.9,
      ratingCount: 5234,
      downloads: 38100,
      isOfficial: true,
      size: "1.8 MB",
      changelog: "v1.2.0 — Format on Save toggle, status bar indicator\nv1.1.0 — SCSS, Less, Markdown formatting support\nv1.0.0 — Initial release: JS, TS, HTML, CSS, JSON",
      featured: true,
      downloadUrl: null,
    },

    {
      id: "error-lens",
      name: "Error Lens",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Inline error and warning messages directly in the editor with color-coded line highlights and icons.",
      longDescription: "Error Lens supercharges your diagnostic workflow by bringing error messages right where they occur. Instead of hovering over red underlines, see the full message inline at the end of the problematic line. Errors appear in red, warnings in yellow, hints in blue — all styled to match your current theme. Works with all Monaco language services: JS/TS, CSS, JSON, HTML.",
      version: "1.0.0",
      category: "Tools",
      tags: ["errors", "diagnostics", "linting", "warnings", "inline", "productivity"],
      icon: "🔴",
      rating: 4.8,
      ratingCount: 3102,
      downloads: 22400,
      isOfficial: true,
      size: "0.4 MB",
      changelog: "v1.0.0 — Initial release with Monaco marker integration",
      featured: true,
      downloadUrl: null,
    },

    {
      id: "live-preview",
      name: "Live Preview",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Instant side-by-side HTML preview that auto-refreshes as you type. Open in external browser too.",
      longDescription: "Live Preview opens a split panel beside your editor showing a live rendering of the active HTML file. The preview refreshes automatically as you type — no manual saves required. CSS and JS files in the same directory load correctly via the base path resolver. Supports open in external browser, responsive preview toggle (375px/768px/100%), and a refresh button for manual reload.",
      version: "1.1.0",
      category: "Tools",
      tags: ["html", "preview", "live-server", "browser", "frontend", "css", "web"],
      icon: "🌐",
      rating: 4.7,
      ratingCount: 1876,
      downloads: 13500,
      isOfficial: true,
      size: "0.6 MB",
      changelog: "v1.1.0 — Responsive preview breakpoints, open in browser\nv1.0.0 — Initial release with auto-refresh",
      featured: true,
      downloadUrl: null,
    },

    {
      id: "emmet-plus",
      name: "Emmet++",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Supercharged Emmet abbreviations for HTML, CSS, JSX with smart cursor placement and wrap features.",
      longDescription: "Emmet++ brings the full power of Emmet abbreviations to your editor. Type `ul>li*5` and Tab to expand to a full unordered list. CSS abbreviations like `m10` expand to `margin: 10px;`. JSX-aware so `div.container` expands to JSX class syntax. Includes 50+ common snippets for boilerplate patterns, quick input types, and table structures. Smart cursor placement moves you to the ideal edit position after expansion.",
      version: "2.0.0",
      category: "Productivity",
      tags: ["emmet", "html", "css", "jsx", "abbreviations", "snippets", "productivity"],
      icon: "⚡",
      rating: 4.8,
      ratingCount: 2890,
      downloads: 19700,
      isOfficial: true,
      size: "0.7 MB",
      changelog: "v2.0.0 — JSX-aware expansion, wrap with abbreviation\nv1.5.0 — CSS abbreviations complete overhaul\nv1.0.0 — Initial HTML abbreviation support",
      featured: false,
      downloadUrl: null,
    },

    {
      id: "node-toolkit",
      name: "Node Toolkit",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Run npm scripts, manage packages, view dependencies, and scaffold Express/Fastify projects.",
      longDescription: "Node Toolkit is your complete Node.js companion inside the editor. Open the Scripts Panel to see and run all package.json scripts with one click. The Dependencies view shows all installed packages with version info. Scaffold new Express, Fastify, or bare Node apps from built-in templates. Quickly run npm install, npm update, or audit without opening a separate terminal. Smart detection of the nearest package.json in the workspace.",
      version: "1.3.0",
      category: "Languages",
      tags: ["node", "npm", "package-json", "scripts", "express", "fastify", "dependencies"],
      icon: "⬢",
      rating: 4.6,
      ratingCount: 1204,
      downloads: 8900,
      isOfficial: true,
      size: "1.2 MB",
      changelog: "v1.3.0 — Dependency inspector with version comparison\nv1.2.0 — Express and Fastify project scaffolding\nv1.0.0 — npm script runner panel",
      featured: false,
      downloadUrl: null,
    },

    {
      id: "cpp-toolkit",
      name: "C/C++ Toolkit",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Compile and run C/C++ with GCC/G++, DSA templates, competitive coding helpers, and I/O test runner.",
      longDescription: "C/C++ Toolkit is built for competitive programmers and systems developers. Compile and run .c/.cpp files directly from the editor with GCC/G++. Includes 60+ DSA code templates: sorting algorithms, graph traversal, binary search, segment trees, Fenwick trees, and more. The Test Runner lets you paste custom input and see output side-by-side. Time complexity hints are shown for common algorithm patterns.",
      version: "1.4.0",
      category: "Languages",
      tags: ["c", "cpp", "gcc", "g++", "compile", "dsa", "competitive", "algorithms"],
      icon: "🔵",
      rating: 4.7,
      ratingCount: 987,
      downloads: 6780,
      isOfficial: true,
      size: "2.4 MB",
      changelog: "v1.4.0 — Test runner with custom input\nv1.3.0 — 40 DSA templates added\nv1.0.0 — GCC/G++ compile and run",
      featured: false,
      downloadUrl: null,
    },

    {
      id: "java-studio",
      name: "Java Studio",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Compile and run Java files, Maven/Gradle integration, Spring Boot templates, and Java snippets.",
      longDescription: "Java Studio turns the editor into a proper Java development environment. Compile single .java files or Maven/Gradle projects with keyboard shortcuts. Includes Spring Boot project scaffolding with REST controller templates. 80+ Java snippets cover collections, streams, lambdas, design patterns, and common algorithms. Maven wrapper commands are integrated into the scripts panel.",
      version: "1.1.0",
      category: "Languages",
      tags: ["java", "maven", "gradle", "spring-boot", "snippets", "compile"],
      icon: "☕",
      rating: 4.5,
      ratingCount: 743,
      downloads: 4320,
      isOfficial: true,
      size: "1.9 MB",
      changelog: "v1.1.0 — Spring Boot scaffolding templates\nv1.0.0 — javac compile/run, basic snippets",
      featured: false,
      downloadUrl: null,
    },

    {
      id: "dotnet-runner",
      name: ".NET Runner",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Build and run .NET projects, NuGet integration, ASP.NET templates, and C# code snippets.",
      longDescription: ".NET Runner provides first-class .NET support in the editor. Run `dotnet build`, `dotnet run`, and `dotnet test` with single key presses. The NuGet panel lets you search and add packages directly. ASP.NET Web API and console app templates are built-in. 70+ C# snippets cover LINQ, async/await, generics, records, pattern matching, and nullable reference types for .NET 6+.",
      version: "1.0.0",
      category: "Languages",
      tags: ["dotnet", "csharp", "nuget", "aspnet", "build", "run", "snippets"],
      icon: "💜",
      rating: 4.5,
      ratingCount: 521,
      downloads: 3100,
      isOfficial: true,
      size: "1.6 MB",
      changelog: "v1.0.0 — Initial release: dotnet run/build/test, C# snippets",
      featured: false,
      downloadUrl: null,
    },

    {
      id: "project-dashboard",
      name: "Project Dashboard",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Workspace overview panel: git status, open files, word counts, recently modified files, and quick actions.",
      longDescription: "Project Dashboard gives you a bird's-eye view of your workspace health. See git status at a glance — uncommitted changes, branch name, ahead/behind counts. The Files section shows all open tabs with word counts and modification status. Recently Modified lists files changed in the last hour. Quick Actions provide one-click access to common operations: format all, commit, push. Updates live as you work.",
      version: "1.0.0",
      category: "Productivity",
      tags: ["dashboard", "workspace", "git", "stats", "overview", "productivity"],
      icon: "📊",
      rating: 4.6,
      ratingCount: 892,
      downloads: 5600,
      isOfficial: true,
      size: "0.5 MB",
      changelog: "v1.0.0 — Initial release",
      featured: false,
      downloadUrl: null,
    },

    {
      id: "workspace-notes",
      name: "Workspace Notes",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Sticky notes, todo lists, and Markdown notes that persist per workspace.",
      longDescription: "Workspace Notes adds a floating notes panel to your IDE that persists notes per workspace directory. Create color-coded sticky notes for reminders, capture ideas in Markdown notes with live preview, and manage project-specific todo lists. Notes are saved automatically and survive restarts. Multiple notes, drag to reorder, collapse/expand, and a keyboard shortcut for quick access.",
      version: "1.0.0",
      category: "Productivity",
      tags: ["notes", "todo", "sticky", "markdown", "workspace", "reminders"],
      icon: "📝",
      rating: 4.5,
      ratingCount: 634,
      downloads: 4100,
      isOfficial: true,
      size: "0.4 MB",
      changelog: "v1.0.0 — Initial release: sticky notes, todos, Markdown notes",
      featured: false,
      downloadUrl: null,
    },

    {
      id: "electron-toolkit",
      name: "Electron Toolkit",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Electron IPC helpers, secure preload templates, contextBridge snippets, and project scaffolding.",
      longDescription: "Electron Toolkit is the official companion for Electron app developers. 90+ snippets cover IPC main/renderer patterns, contextBridge API, BrowserWindow configuration, menu creation, tray icons, native dialogs, auto-updater setup, and deep linking. Includes a secure Electron starter template with contextIsolation, preload isolation, and CSP headers pre-configured. Security warnings are shown for dangerous anti-patterns.",
      version: "1.0.0",
      category: "Tools",
      tags: ["electron", "ipc", "preload", "snippets", "desktop", "nodejs", "contextbridge"],
      icon: "⚛",
      rating: 4.8,
      ratingCount: 1123,
      downloads: 7800,
      isOfficial: true,
      size: "1.1 MB",
      changelog: "v1.0.0 — Initial release: IPC snippets, preload templates, scaffolding",
      featured: false,
      downloadUrl: null,
    },

    {
      id: "electron-security",
      name: "Electron Security Scanner",
      publisher: "NoteLab",
      publisherVerified: true,
      description: "Detect Electron security vulnerabilities: nodeIntegration, missing CSP, unsafe contextIsolation configs.",
      longDescription: "Electron Security Scanner audits your Electron app for common security vulnerabilities based on the official Electron Security checklist. Detects: nodeIntegration enabled, missing contextIsolation, no preload script, unsafe eval usage, missing CSP headers, webSecurity disabled, allowRunningInsecureContent enabled, and shell.openExternal with user-provided URLs. Shows an inline panel with issue severity, affected file, and one-click fix suggestions.",
      version: "1.0.0",
      category: "Security",
      tags: ["electron", "security", "audit", "csp", "nodeintegration", "vulnerabilities"],
      icon: "🔒",
      rating: 4.9,
      ratingCount: 456,
      downloads: 2900,
      isOfficial: true,
      size: "0.5 MB",
      changelog: "v1.0.0 — Initial release: 12 security checks from Electron security checklist",
      featured: false,
      downloadUrl: null,
    },
  ],
};

// ── Category definitions ────────────────────────────────────────
const MP_CATEGORIES = [
  { id: "all",          label: "All",          icon: "⊞" },
  { id: "installed",    label: "Installed",    icon: "✓"  },
  { id: "featured",     label: "Featured",     icon: "★"  },
  { id: "Productivity", label: "Productivity", icon: "⚡" },
  { id: "Tools",        label: "Tools",        icon: "⚒" },
  { id: "Languages",    label: "Languages",    icon: "🗣" },
  { id: "Themes",       label: "Themes",       icon: "🎨" },
  { id: "Education",    label: "Education",    icon: "📚" },
  { id: "Security",     label: "Security",     icon: "🔒" },
];

// ═══════════════════════════════════════════════════════════════
//  MARKETPLACE MANAGER
// ═══════════════════════════════════════════════════════════════
const Marketplace = (() => {

  // ── State ─────────────────────────────────────────────────────
  let _initialized  = false;
  let _visible      = false;
  let _allExts      = [];
  let _installed    = {};   // { [id]: { ...meta, enabled, installedAt } }
  let _settings     = { autoUpdate: true, showRecommendations: true, installedFirst: false, checkUpdatesOnStartup: true };
  let _category     = "all";
  let _query        = "";
  let _selectedId   = null;
  let _installing   = new Set();
  let _uninstalling = new Set();
  let _domRefs      = {};

  // ── Helpers ──────────────────────────────────────────────────
  function _fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000)    return (n / 1000).toFixed(1) + "k";
    return String(n);
  }

  function _stars(rating) {
    const filled = Math.round(rating);
    let s = "";
    for (let i = 1; i <= 5; i++) {
      s += `<span class="${i <= filled ? "mp-star-on" : "mp-star-off"}">★</span>`;
    }
    return `<span class="mp-stars">${s}</span>`;
  }

  function _esc(s) {
    return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function _isInstalled(id) { return !!_installed[id]; }
  function _isEnabled(id)   { return _installed[id]?.enabled !== false; }

  // ── DOM builder ──────────────────────────────────────────────
  function _buildDOM() {
    const overlay = document.createElement("div");
    overlay.id = "mp-overlay";
    overlay.innerHTML = `
      <div id="mp-panel">

        <!-- Header -->
        <div id="mp-header">
          <div id="mp-logo">
            <span id="mp-logo-icon">🧩</span>
            <span id="mp-logo-text">Extension Marketplace</span>
          </div>
          <div id="mp-search-wrap">
            <span id="mp-search-icon">⌕</span>
            <input id="mp-search" type="text" placeholder="Search extensions…"
                   autocomplete="off" spellcheck="false" />
          </div>
          <div id="mp-header-right">
            <button class="mp-icon-btn" id="mp-settings-btn" title="Marketplace Settings">⚙</button>
            <button class="mp-icon-btn" id="mp-close-btn" title="Close Marketplace (Esc)">×</button>
          </div>
        </div>

        <!-- Category nav -->
        <div id="mp-nav"></div>

        <!-- Body -->
        <div id="mp-body">

          <!-- Main content -->
          <div id="mp-main">
            <div id="mp-loading">
              <div class="mp-spinner"></div>
              <span>Loading marketplace…</span>
            </div>
          </div>

          <!-- Extension detail pane -->
          <div id="mp-detail">
            <div id="mp-detail-header">
              <span class="mp-detail-header-title">Details</span>
              <button id="mp-detail-close" title="Close">×</button>
            </div>
            <div id="mp-detail-scroll">
              <div id="mp-detail-body"></div>
            </div>
          </div>

          <!-- Settings panel -->
          <div id="mp-settings-panel">
            <div id="mp-settings-header">
              Marketplace Settings
              <button id="mp-settings-close">×</button>
            </div>
            <div id="mp-settings-body"></div>
            <div id="mp-settings-footer">Noter Extension Marketplace · v1.0</div>
          </div>

        </div><!-- /mp-body -->
      </div><!-- /mp-panel -->
    `;

    document.body.appendChild(overlay);

    _domRefs = {
      overlay,
      panel:          overlay.querySelector("#mp-panel"),
      search:         overlay.querySelector("#mp-search"),
      nav:            overlay.querySelector("#mp-nav"),
      main:           overlay.querySelector("#mp-main"),
      detail:         overlay.querySelector("#mp-detail"),
      detailBody:     overlay.querySelector("#mp-detail-body"),
      settingsPanel:  overlay.querySelector("#mp-settings-panel"),
      settingsBody:   overlay.querySelector("#mp-settings-body"),
      settingsBtn:    overlay.querySelector("#mp-settings-btn"),
      closeBtn:       overlay.querySelector("#mp-close-btn"),
      detailClose:    overlay.querySelector("#mp-detail-close"),
      settingsClose:  overlay.querySelector("#mp-settings-close"),
    };
  }

  // ── Event binding ────────────────────────────────────────────
  function _bindEvents() {
    const r = _domRefs;

    // Close on backdrop click
    r.overlay.addEventListener("click", (e) => {
      if (e.target === r.overlay) _hide();
    });

    // Escape key
    document.addEventListener("keydown", (e) => {
      if (!_visible) return;
      if (e.key === "Escape") {
        if (r.settingsPanel.classList.contains("mp-settings-open")) {
          _closeSettings();
        } else if (r.detail.classList.contains("mp-detail-open")) {
          _closeDetail();
        } else {
          _hide();
        }
      }
    });

    // Header buttons
    r.closeBtn.addEventListener("click",    _hide);
    r.detailClose.addEventListener("click", _closeDetail);
    r.settingsClose.addEventListener("click", _closeSettings);
    r.settingsBtn.addEventListener("click", () => {
      if (r.settingsPanel.classList.contains("mp-settings-open")) {
        _closeSettings();
      } else {
        _closeDetail();
        _openSettings();
      }
    });

    // Search
    r.search.addEventListener("input", () => {
      _query = r.search.value.trim().toLowerCase();
      _renderMain();
    });

    // Event delegation on main list (install/uninstall/row clicks)
    r.main.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mp-action]");
      if (btn) {
        e.stopPropagation();
        const action = btn.dataset.mpAction;
        const id     = btn.dataset.mpId;
        if (action === "install")   _installExt(id);
        if (action === "uninstall") _uninstallExt(id);
        return;
      }
      const row = e.target.closest(".mp-ext-row, .mp-feat-card");
      if (row && row.dataset.mpId) _showDetail(row.dataset.mpId);
    });
  }

  // ── Registry loading ─────────────────────────────────────────
  async function _loadRegistry() {
    // Try to fetch live registry from GitHub via main process
    try {
      if (window.electronAPI?.marketplaceFetchRegistry) {
        const live = await window.electronAPI.marketplaceFetchRegistry();
        if (live && Array.isArray(live.extensions) && live.extensions.length > 0) {
          return live.extensions;
        }
      }
    } catch { /* fall through to embedded */ }
    return MARKETPLACE_REGISTRY.extensions;
  }

  async function _loadInstalled() {
    try {
      if (window.electronAPI?.marketplaceGetInstalled) {
        _installed = await window.electronAPI.marketplaceGetInstalled() || {};
      }
    } catch {
      _installed = {};
    }
  }

  async function _loadSettings() {
    try {
      if (window.electronAPI?.marketplaceGetSettings) {
        _settings = await window.electronAPI.marketplaceGetSettings();
      }
    } catch { /* use defaults */ }
  }

  // ── Init (lazy, first open) ──────────────────────────────────
  async function _init() {
    if (_initialized) return;
    _initialized = true;

    _buildDOM();
    _bindEvents();
    _renderNav();

    // Load data in parallel
    const [exts] = await Promise.all([
      _loadRegistry(),
      _loadInstalled(),
      _loadSettings(),
    ]);
    _allExts = exts;

    // Update nav counts
    _renderNav();
    _renderMain();

    // Check startup update notifications
    if (_settings.checkUpdatesOnStartup) _checkUpdates();
  }

  // ── Show / Hide ──────────────────────────────────────────────
  function _show() {
    _visible = true;
    _domRefs.overlay.classList.add("mp-visible");
    setTimeout(() => _domRefs.search?.focus(), 120);
  }

  function _hide() {
    _visible = false;
    _domRefs.overlay?.classList.remove("mp-visible");
    _closeDetail();
    _closeSettings();
  }

  // ── Nav render ───────────────────────────────────────────────
  function _renderNav() {
    const nav = _domRefs.nav;
    if (!nav) return;

    const installedCount = Object.keys(_installed).length;

    nav.innerHTML = MP_CATEGORIES.map(cat => {
      let count = null;
      if (cat.id === "all")       count = _allExts.length;
      if (cat.id === "installed") count = installedCount;
      if (cat.id === "featured")  count = _allExts.filter(e => e.featured).length;

      const badge = count !== null
        ? `<span class="mp-tab-count">${count}</span>`
        : "";

      return `<button class="mp-tab${_category === cat.id ? " mp-tab-active" : ""}"
                       data-cat="${cat.id}">
                ${cat.icon} ${cat.label}${badge}
              </button>`;
    }).join("");

    nav.querySelectorAll(".mp-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        _category = btn.dataset.cat;
        _query    = "";
        if (_domRefs.search) _domRefs.search.value = "";
        _closeDetail();
        _renderNav();
        _renderMain();
      });
    });
  }

  // ── Filtering ────────────────────────────────────────────────
  function _getFiltered() {
    let exts = [..._allExts];

    // Category filter
    if (_category === "installed") {
      exts = exts.filter(e => _isInstalled(e.id));
      if (_settings.installedFirst) {
        exts.sort((a, b) => {
          const aT = _installed[a.id]?.installedAt || "";
          const bT = _installed[b.id]?.installedAt || "";
          return bT.localeCompare(aT);
        });
      }
    } else if (_category === "featured") {
      exts = exts.filter(e => e.featured);
    } else if (_category !== "all") {
      exts = exts.filter(e => e.category === _category);
    } else if (_settings.installedFirst) {
      exts.sort((a, b) => {
        const aIn = _isInstalled(a.id) ? 0 : 1;
        const bIn = _isInstalled(b.id) ? 0 : 1;
        return aIn - bIn;
      });
    }

    // Search filter
    if (_query) {
      const q = _query;
      exts = exts.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.publisher.toLowerCase().includes(q) ||
        (e.tags || []).some(t => t.includes(q)) ||
        e.category.toLowerCase().includes(q)
      );
    }

    return exts;
  }

  // ── Main content render ──────────────────────────────────────
  function _renderMain() {
    const main = _domRefs.main;
    if (!main) return;

    const filtered = _getFiltered();
    const showFeatured = (_category === "all" || _category === "featured") && !_query;
    const featured     = _allExts.filter(e => e.featured);

    if (filtered.length === 0) {
      main.innerHTML = `
        <div id="mp-empty">
          <div class="mp-empty-icon">${_category === "installed" ? "📦" : "🔍"}</div>
          <div class="mp-empty-title">${_category === "installed" ? "No extensions installed" : "No extensions found"}</div>
          <div class="mp-empty-sub">${_category === "installed" ? "Browse the marketplace to find extensions" : "Try a different search term or category"}</div>
        </div>`;
      return;
    }

    let html = "";

    // Featured grid (only on All/Featured tabs when not searching)
    if (showFeatured && featured.length > 0) {
      html += `
        <div class="mp-section-header">
          <span class="mp-section-title">⭐ Featured</span>
        </div>
        <div id="mp-featured-grid">
          ${featured.map(_featCard).join("")}
        </div>`;
    }

    // Main list
    const listLabel = _category === "installed" ? "Installed Extensions"
                    : _category === "featured"  ? "Featured Extensions"
                    : _category === "all"        ? "All Extensions"
                    : _category + " Extensions";

    html += `
      <div class="mp-section-header">
        <span class="mp-section-title">${listLabel}</span>
        <span class="mp-section-count">${filtered.length} extension${filtered.length !== 1 ? "s" : ""}</span>
      </div>
      <div id="mp-ext-list">
        ${filtered.map(_extRow).join("")}
      </div>`;

    main.innerHTML = html;
  }

  // ── Featured card HTML ───────────────────────────────────────
  function _featCard(ext) {
    const inst    = _isInstalled(ext.id);
    const loading = _installing.has(ext.id);

    let btnClass = "mp-feat-btn";
    let btnText  = "Install";
    let btnAttr  = `data-mp-action="install" data-mp-id="${ext.id}"`;

    if (loading) {
      btnClass += " mp-installing";
      btnText = `<div class="mp-spinner" style="width:12px;height:12px;border-width:1.5px"></div> Installing…`;
      btnAttr = "";
    } else if (inst) {
      btnClass += " mp-installed";
      btnText = "✓ Installed";
      btnAttr = "";
    }

    return `
      <div class="mp-feat-card" data-mp-id="${ext.id}">
        <span class="mp-feat-icon">${ext.icon}</span>
        <div class="mp-feat-name">${_esc(ext.name)}</div>
        <div class="mp-feat-pub">${_esc(ext.publisher)}</div>
        <div class="mp-feat-rating">
          ${_stars(ext.rating)} ${ext.rating} · ${_fmt(ext.downloads)}↓
        </div>
        <button class="${btnClass}" ${btnAttr}>${btnText}</button>
      </div>`;
  }

  // ── Extension list row HTML ──────────────────────────────────
  function _extRow(ext) {
    const inst    = _isInstalled(ext.id);
    const loading = _installing.has(ext.id) || _uninstalling.has(ext.id);
    const active  = _selectedId === ext.id;

    let actionBtn;
    if (loading) {
      actionBtn = `<button class="mp-btn mp-btn-installing mp-btn-sm">
                     <div class="mp-spinner" style="width:11px;height:11px;border-width:1.5px"></div>
                     ${_installing.has(ext.id) ? "Installing…" : "Removing…"}
                   </button>`;
    } else if (inst) {
      actionBtn = `<button class="mp-btn mp-btn-installed mp-btn-sm">✓ Installed</button>`;
    } else {
      actionBtn = `<button class="mp-btn mp-btn-install mp-btn-sm"
                           data-mp-action="install" data-mp-id="${ext.id}">Install</button>`;
    }

    const officialBadge = ext.isOfficial
      ? `<span class="mp-badge mp-badge-official">✦ OFFICIAL</span>` : "";

    const installedBadge = inst
      ? `<span class="mp-badge mp-badge-installed">● INSTALLED</span>` : "";

    return `
      <div class="mp-ext-row${active ? " mp-row-active" : ""}" data-mp-id="${ext.id}">
        <div class="mp-ext-icon-wrap">${ext.icon}</div>
        <div class="mp-ext-info">
          <div class="mp-ext-name-row">
            <span class="mp-ext-name">${_esc(ext.name)}</span>
            <span class="mp-ext-version">v${_esc(ext.version)}</span>
            ${officialBadge}
            ${installedBadge}
          </div>
          <div class="mp-ext-desc">${_esc(ext.description)}</div>
          <div class="mp-ext-meta">
            ${_stars(ext.rating)} <span>${ext.rating} (${_fmt(ext.ratingCount)})</span>
            <span>·</span>
            <span>${_fmt(ext.downloads)}↓</span>
            <span>·</span>
            <span>${_esc(ext.size)}</span>
            <span>·</span>
            <span>${_esc(ext.category)}</span>
          </div>
        </div>
        <div class="mp-ext-action">${actionBtn}</div>
      </div>`;
  }

  // ── Detail pane ──────────────────────────────────────────────
  function _showDetail(id) {
    const ext = _allExts.find(e => e.id === id);
    if (!ext) return;

    _selectedId = id;
    _closeSettings();

    // Highlight active row
    document.querySelectorAll(".mp-ext-row, .mp-feat-card").forEach(el => {
      el.classList.toggle("mp-row-active", el.dataset.mpId === id);
    });

    _renderDetailContent(ext);
    _domRefs.detail.classList.add("mp-detail-open");
  }

  function _renderDetailContent(ext) {
    const inst    = _isInstalled(ext.id);
    const enabled = _isEnabled(ext.id);
    const loading = _installing.has(ext.id) || _uninstalling.has(ext.id);

    let primaryBtn;
    if (loading) {
      primaryBtn = `<button class="mp-btn mp-btn-installing" style="width:100%">
                      <div class="mp-spinner" style="width:13px;height:13px;border-width:1.5px"></div>
                      ${_installing.has(ext.id) ? "Installing…" : "Removing…"}
                    </button>`;
    } else if (!inst) {
      primaryBtn = `<button class="mp-btn mp-btn-install" style="width:100%"
                            data-mp-action="install" data-mp-id="${ext.id}">
                      Install Extension
                    </button>`;
    } else {
      primaryBtn = `<button class="mp-btn mp-btn-uninstall" style="width:100%"
                            data-mp-action="uninstall" data-mp-id="${ext.id}">
                      Uninstall
                    </button>`;
    }

    const toggleRow = inst ? `
      <div class="mp-d-toggle-row">
        <span class="mp-d-toggle-label">${enabled ? "Extension enabled" : "Extension disabled"}</span>
        <label class="mp-toggle">
          <input type="checkbox" id="mp-detail-toggle" ${enabled ? "checked" : ""}/>
          <span class="mp-toggle-track"></span>
        </label>
      </div>` : "";

    const officialBadge = ext.isOfficial
      ? `<span class="mp-badge mp-badge-official">✦ OFFICIAL</span>` : "";

    const catBadge = `<span class="mp-badge mp-badge-official" style="border-color:rgba(203,166,247,0.2);color:#cba6f7;background:rgba(203,166,247,0.08)">${_esc(ext.category)}</span>`;

    _domRefs.detailBody.innerHTML = `
      <div class="mp-d-hero">
        <div class="mp-d-icon">${ext.icon}</div>
        <div>
          <div class="mp-d-name">${_esc(ext.name)}</div>
          <div class="mp-d-pub">
            ${_esc(ext.publisher)}
            ${ext.publisherVerified ? `<span class="mp-d-pub-check" title="Verified Publisher">✦</span>` : ""}
          </div>
          <div class="mp-d-badges">${officialBadge} ${catBadge}</div>
        </div>
      </div>

      <div class="mp-d-desc">${_esc(ext.longDescription || ext.description)}</div>

      <div class="mp-d-stats">
        <div>
          <div class="mp-d-stat-label">Rating</div>
          <div class="mp-d-stat-value">${_stars(ext.rating)} ${ext.rating}</div>
        </div>
        <div>
          <div class="mp-d-stat-label">Reviews</div>
          <div class="mp-d-stat-value">${_fmt(ext.ratingCount)}</div>
        </div>
        <div>
          <div class="mp-d-stat-label">Downloads</div>
          <div class="mp-d-stat-value">${_fmt(ext.downloads)}</div>
        </div>
        <div>
          <div class="mp-d-stat-label">Size</div>
          <div class="mp-d-stat-value">${_esc(ext.size)}</div>
        </div>
      </div>

      <div>
        <div class="mp-d-section-title">Tags</div>
        <div class="mp-d-tags">
          ${(ext.tags || []).map(t => `<span class="mp-d-tag">#${_esc(t)}</span>`).join("")}
        </div>
      </div>

      <div>
        <div class="mp-d-section-title">Version ${_esc(ext.version)} · Changelog</div>
        <div class="mp-d-changelog">${_esc(ext.changelog)}</div>
      </div>

      <div class="mp-d-actions">
        ${toggleRow}
        ${primaryBtn}
      </div>
    `;

    // Wire detail install/uninstall buttons
    _domRefs.detailBody.querySelectorAll("[data-mp-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.mpAction;
        const id     = btn.dataset.mpId;
        if (action === "install")   _installExt(id);
        if (action === "uninstall") _uninstallExt(id);
      });
    });

    // Wire enable/disable toggle
    const toggle = _domRefs.detailBody.querySelector("#mp-detail-toggle");
    if (toggle) {
      toggle.addEventListener("change", () => _toggleEnable(ext.id, toggle.checked));
    }
  }

  function _closeDetail() {
    _selectedId = null;
    _domRefs.detail?.classList.remove("mp-detail-open");
    document.querySelectorAll(".mp-ext-row, .mp-feat-card").forEach(el => {
      el.classList.remove("mp-row-active");
    });
  }

  // ── Settings panel ───────────────────────────────────────────
  function _openSettings() {
    _renderSettings();
    _domRefs.settingsPanel.classList.add("mp-settings-open");
    _domRefs.settingsBtn.classList.add("mp-active");
  }

  function _closeSettings() {
    _domRefs.settingsPanel?.classList.remove("mp-settings-open");
    _domRefs.settingsBtn?.classList.remove("mp-active");
  }

  function _renderSettings() {
    const s = _settings;
    const items = [
      {
        key: "autoUpdate",
        label: "Auto-Update Extensions",
        sub: "Automatically install extension updates when available",
      },
      {
        key: "showRecommendations",
        label: "Show Recommendations",
        sub: "Display personalized extension recommendations",
      },
      {
        key: "installedFirst",
        label: "Show Installed First",
        sub: "Sort installed extensions to the top of the list",
      },
      {
        key: "checkUpdatesOnStartup",
        label: "Check Updates on Startup",
        sub: "Verify extension versions when the app launches",
      },
    ];

    _domRefs.settingsBody.innerHTML = items.map(item => `
      <div class="mp-settings-item">
        <div class="mp-settings-text">
          <div class="mp-settings-label">${_esc(item.label)}</div>
          <div class="mp-settings-sublabel">${_esc(item.sub)}</div>
        </div>
        <label class="mp-toggle">
          <input type="checkbox" data-key="${item.key}" ${s[item.key] ? "checked" : ""}/>
          <span class="mp-toggle-track"></span>
        </label>
      </div>`).join("");

    _domRefs.settingsBody.querySelectorAll("input[data-key]").forEach(inp => {
      inp.addEventListener("change", async () => {
        _settings[inp.dataset.key] = inp.checked;
        try {
          await window.electronAPI?.marketplaceSaveSettings?.(_settings);
        } catch { /* ignore */ }
      });
    });
  }

  // ── Install / Uninstall ──────────────────────────────────────
  async function _installExt(id) {
    if (_installing.has(id) || _isInstalled(id)) return;
    const ext = _allExts.find(e => e.id === id);
    if (!ext) return;

    _installing.add(id);
    _refreshRows(id);

    try {
      // Simulate brief install progress (V1 — no real download yet)
      await _delay(1200);

      if (window.electronAPI?.marketplaceInstall) {
        const result = await window.electronAPI.marketplaceInstall({
          id: ext.id, name: ext.name, publisher: ext.publisher,
          version: ext.version, category: ext.category, icon: ext.icon,
          description: ext.description, size: ext.size,
        });
        if (!result?.success) throw new Error(result?.error || "Install failed");
      }

      _installed[id] = {
        id: ext.id, name: ext.name, publisher: ext.publisher,
        version: ext.version, category: ext.category, icon: ext.icon,
        description: ext.description, size: ext.size,
        enabled: true,
        installedAt: new Date().toISOString(),
      };

      _installing.delete(id);
      _refreshRows(id);
      _renderNav();
      _showToast(`${ext.name} installed successfully`, "success");
      // Notify extension runtime — dispatches Quick Start panel
      setTimeout(() => {
        if (typeof ExtensionRuntime !== "undefined") ExtensionRuntime.refresh();
        document.dispatchEvent(new CustomEvent("extension-installed", { detail: { id: ext.id } }));
      }, 200);

    } catch (err) {
      _installing.delete(id);
      _refreshRows(id);
      _showToast(`Failed to install ${ext.name}: ${err.message}`, "error");
    }
  }

  async function _uninstallExt(id) {
    if (_uninstalling.has(id) || !_isInstalled(id)) return;
    const ext = _allExts.find(e => e.id === id);
    if (!ext) return;

    _uninstalling.add(id);
    _refreshRows(id);

    try {
      await _delay(700);

      if (window.electronAPI?.marketplaceUninstall) {
        const result = await window.electronAPI.marketplaceUninstall(id);
        if (!result?.success) throw new Error(result?.error || "Uninstall failed");
      }

      delete _installed[id];
      _uninstalling.delete(id);
      _closeDetail();
      _renderNav();
      _renderMain();
      _showToast(`${ext.name} uninstalled`, "info");
      setTimeout(() => {
        if (typeof ExtensionRuntime !== "undefined") ExtensionRuntime.refresh();
      }, 200);

    } catch (err) {
      _uninstalling.delete(id);
      _refreshRows(id);
      _showToast(`Failed to uninstall ${ext.name}: ${err.message}`, "error");
    }
  }

  async function _toggleEnable(id, enabled) {
    if (!_installed[id]) return;
    _installed[id].enabled = enabled;

    try {
      await window.electronAPI?.marketplaceToggle?.({ id, enabled });
    } catch { /* ignore */ }

    const ext = _allExts.find(e => e.id === id);
    const name = ext?.name || id;
    _showToast(`${name} ${enabled ? "enabled" : "disabled"}`, "info");
    _refreshRows(id);
  }

  // ── Partial re-render helpers ────────────────────────────────
  function _refreshRows(id) {
    // Re-render a single row without full page refresh for smoothness
    const ext = _allExts.find(e => e.id === id);
    if (!ext) return;

    // Update featured cards
    document.querySelectorAll(`.mp-feat-card[data-mp-id="${id}"]`).forEach(card => {
      const inst    = _isInstalled(id);
      const loading = _installing.has(id);
      const btn = card.querySelector(".mp-feat-btn");
      if (!btn) return;
      btn.className = "mp-feat-btn" + (loading ? " mp-installing" : inst ? " mp-installed" : "");
      btn.innerHTML = loading
        ? `<div class="mp-spinner" style="width:12px;height:12px;border-width:1.5px"></div> Installing…`
        : inst ? "✓ Installed" : "Install";
      btn.dataset.mpAction = inst || loading ? "" : "install";
      btn.dataset.mpId     = inst || loading ? "" : id;
    });

    // Update list rows
    document.querySelectorAll(`.mp-ext-row[data-mp-id="${id}"]`).forEach(row => {
      const inst    = _isInstalled(id);
      const loading = _installing.has(id) || _uninstalling.has(id);
      const actionDiv = row.querySelector(".mp-ext-action");
      if (!actionDiv) return;

      let html;
      if (loading) {
        html = `<button class="mp-btn mp-btn-installing mp-btn-sm">
                  <div class="mp-spinner" style="width:11px;height:11px;border-width:1.5px"></div>
                  ${_installing.has(id) ? "Installing…" : "Removing…"}
                </button>`;
      } else if (inst) {
        html = `<button class="mp-btn mp-btn-installed mp-btn-sm">✓ Installed</button>`;
      } else {
        html = `<button class="mp-btn mp-btn-install mp-btn-sm"
                        data-mp-action="install" data-mp-id="${id}">Install</button>`;
      }
      actionDiv.innerHTML = html;

      // Update installed badge
      const nameRow = row.querySelector(".mp-ext-name-row");
      if (nameRow) {
        const old = nameRow.querySelector(".mp-badge-installed");
        if (old) old.remove();
        if (inst) {
          const badge = document.createElement("span");
          badge.className = "mp-badge mp-badge-installed";
          badge.textContent = "● INSTALLED";
          nameRow.appendChild(badge);
        }
      }
    });

    // Re-render detail if open for this extension
    if (_selectedId === id) _renderDetailContent(ext);
  }

  // ── Update checker ───────────────────────────────────────────
  function _checkUpdates() {
    // V1: check if installed extension versions match registry (placeholder)
    // In a real implementation, this would compare versions and notify
  }

  // ── Toast ────────────────────────────────────────────────────
  function _showToast(message, type = "info") {
    if (typeof showToast === "function") {
      showToast(message, type);
    }
  }

  function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Status bar button ────────────────────────────────────────
  function _injectStatusBtn() {
    const statusRight = document.querySelector(".status-right");
    if (!statusRight || document.getElementById("mp-status-btn")) return;

    const btn = document.createElement("button");
    btn.id = "mp-status-btn";
    btn.title = "Extension Marketplace (Ctrl+Shift+X)";
    btn.innerHTML = `🧩 <span id="mp-status-count">0</span>`;
    btn.addEventListener("click", () => _api.toggle());
    statusRight.prepend(btn);
  }

  function _updateStatusCount() {
    const el = document.getElementById("mp-status-count");
    if (el) el.textContent = Object.keys(_installed).length;
  }

  // ── Public API ───────────────────────────────────────────────
  const _api = {
    async open() {
      if (!_initialized) {
        _buildDOM();
        _bindDOM_earlyShow();
        _show();
        await _init_full();
      } else {
        await _loadInstalled();
        _renderNav();
        _renderMain();
        _show();
      }
      _updateStatusCount();
    },

    close() { _hide(); },

    toggle() {
      if (_visible) _hide();
      else          _api.open();
    },
  };

  // Split init into two phases so the overlay shows immediately
  function _bindDOM_earlyShow() {
    const r = _domRefs;
    r.overlay.addEventListener("click", (e) => { if (e.target === r.overlay) _hide(); });
    r.closeBtn.addEventListener("click", _hide);
    r.detailClose.addEventListener("click",   _closeDetail);
    r.settingsClose.addEventListener("click", _closeSettings);
    r.settingsBtn.addEventListener("click", () => {
      r.settingsPanel.classList.contains("mp-settings-open") ? _closeSettings() : (_closeDetail(), _openSettings());
    });
    r.search.addEventListener("input", () => { _query = r.search.value.trim().toLowerCase(); _renderMain(); });
    r.main.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mp-action]");
      if (btn) { e.stopPropagation(); const {mpAction:a, mpId:id} = btn.dataset; if (a==="install") _installExt(id); if (a==="uninstall") _uninstallExt(id); return; }
      const row = e.target.closest(".mp-ext-row, .mp-feat-card");
      if (row?.dataset.mpId) _showDetail(row.dataset.mpId);
    });
    document.addEventListener("keydown", (e) => {
      if (!_visible) return;
      if (e.key !== "Escape") return;
      if (r.settingsPanel.classList.contains("mp-settings-open")) _closeSettings();
      else if (r.detail.classList.contains("mp-detail-open")) _closeDetail();
      else _hide();
    });
  }

  async function _init_full() {
    if (_initialized) return;
    _initialized = true;

    _renderNav();
    const [exts] = await Promise.all([_loadRegistry(), _loadInstalled(), _loadSettings()]);
    _allExts = exts;
    _renderNav();
    _renderMain();
    _updateStatusCount();
    if (_settings.checkUpdatesOnStartup) _checkUpdates();
  }

  // Self-init: inject status button after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _injectStatusBtn);
  } else {
    _injectStatusBtn();
  }

  return _api;
})();
window.Marketplace = Marketplace;
