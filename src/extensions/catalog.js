// ═══════════════════════════════════════════════════════════════
//  NOTER APP — Extension Catalog  (extensions/catalog.js)
//  Single source of truth for all extension metadata + categories
//
//  Categories:
//    normal           — Lightweight utilities & cosmetic tools
//    powerful         — Language tools, productivity, compilers
//    extreme-powerful — Deep workspace intelligence & AI engines
// ═══════════════════════════════════════════════════════════════

window._extCatalog = (() => {
  'use strict';

  const CATEGORIES = {
    normal: {
      id:          'normal',
      label:       'Normal',
      icon:        '⚡',
      color:       '#3fb950',
      description: 'Lightweight utilities, cosmetic tools, and quality-of-life improvements.',
    },
    powerful: {
      id:          'powerful',
      label:       'Powerful',
      icon:        '🔥',
      color:       '#f78166',
      description: 'Language intelligence, productivity engines, and compiler integrations.',
    },
    'extreme-powerful': {
      id:          'extreme-powerful',
      label:       'Extreme Powerful',
      icon:        '🦀',
      color:       '#a371f7',
      description: 'Deep workspace intelligence, code graph analysis, and AI-powered engines.',
    },
  };

  // ── Extension metadata ─────────────────────────────────────────
  // Each entry: id, category, icon, name, tagline, permissions[]
  const EXTENSIONS = [

    // ── NORMAL ───────────────────────────────────────────────────
    {
      id: 'bracket-colors',    category: 'normal',
      icon: '🌈', name: 'Bracket Colors',
      tagline: 'Rainbow bracket pair colorization',
      permissions: [],
    },
    {
      id: 'file-icons-pro',    category: 'normal',
      icon: '🗂️', name: 'File Icons Pro',
      tagline: 'Rich file-type icons in the explorer',
      permissions: [],
    },
    {
      id: 'workspace-notes',   category: 'normal',
      icon: '📝', name: 'Workspace Notes',
      tagline: 'Color-coded sticky notes per workspace',
      permissions: ['workspace.read'],
    },
    {
      id: 'markdown-pro',      category: 'normal',
      icon: '📄', name: 'Markdown Pro',
      tagline: 'Live Markdown preview & formatting',
      permissions: ['workspace.read'],
    },
    {
      id: 'json-wizard',       category: 'normal',
      icon: '🔮', name: 'JSON Wizard',
      tagline: 'JSON formatting, validation & diff',
      permissions: [],
    },
    {
      id: 'theme-studio',      category: 'normal',
      icon: '🎨', name: 'Theme Studio',
      tagline: '12 premium hand-crafted color schemes',
      permissions: [],
    },
    {
      id: 'react-snippets',    category: 'normal',
      icon: '⚛️', name: 'React Snippets',
      tagline: '200+ React & hooks code snippets',
      permissions: [],
    },

    // ── POWERFUL ──────────────────────────────────────────────────
    {
      id: 'code-runner',       category: 'powerful',
      icon: '▶️', name: 'Code Runner',
      tagline: 'Run any file with one click — 12 languages',
      permissions: ['shell.execute'],
    },
    {
      id: 'error-lens',        category: 'powerful',
      icon: '🔍', name: 'Error Lens',
      tagline: 'Inline diagnostic messages beside each line',
      permissions: [],
    },
    {
      id: 'prettier-pro',      category: 'powerful',
      icon: '✨', name: 'Prettier Pro',
      tagline: 'Auto-format on save with opinionated rules',
      permissions: ['workspace.write'],
    },
    {
      id: 'git-insights',      category: 'powerful',
      icon: '🔀', name: 'Git Insights',
      tagline: 'Inline blame, history, diff viewer & branching',
      permissions: ['git.read'],
    },
    {
      id: 'live-preview',      category: 'powerful',
      icon: '🌐', name: 'Live Preview',
      tagline: 'Real-time HTML/CSS preview in split pane',
      permissions: ['workspace.read'],
    },
    {
      id: 'emmet-plus',        category: 'powerful',
      icon: '⚡', name: 'Emmet Plus',
      tagline: 'Full Emmet engine with Tab expansion',
      permissions: [],
    },
    {
      id: 'dsa-forge',         category: 'powerful',
      icon: '🧮', name: 'DSA Forge',
      tagline: '200+ optimized DSA snippets for interviews',
      permissions: [],
    },
    {
      id: 'project-dashboard', category: 'powerful',
      icon: '📊', name: 'Project Dashboard',
      tagline: 'Project stats, deps, scripts at a glance',
      permissions: ['workspace.read'],
    },
    {
      id: 'node-toolkit',      category: 'powerful',
      icon: '🟢', name: 'Node Toolkit',
      tagline: 'NPM scripts runner, package manager UI',
      permissions: ['workspace.read', 'shell.execute'],
    },
    {
      id: 'python-power',      category: 'powerful',
      icon: '🐍', name: 'Python Power',
      tagline: 'Linting, type hints, REPL, venv manager',
      permissions: ['shell.execute'],
    },
    {
      id: 'cpp-toolkit',       category: 'powerful',
      icon: '⚙️', name: 'C++ Toolkit',
      tagline: 'Build, debug & profile C/C++ projects',
      permissions: ['shell.execute'],
    },
    {
      id: 'java-studio',       category: 'powerful',
      icon: '☕', name: 'Java Studio',
      tagline: 'Compile, run & manage Java projects',
      permissions: ['shell.execute'],
    },
    {
      id: 'dotnet-runner',     category: 'powerful',
      icon: '🔷', name: '.NET Runner',
      tagline: 'Build and run .NET/C# projects inline',
      permissions: ['shell.execute'],
    },
    {
      id: 'electron-toolkit',  category: 'powerful',
      icon: '⚛️', name: 'Electron Toolkit',
      tagline: 'IPC inspector, DevTools bridge, hot-reload',
      permissions: ['workspace.read', 'shell.execute'],
    },
    {
      id: 'electron-security', category: 'powerful',
      icon: '🛡️', name: 'Electron Security',
      tagline: 'Static security scanner for Electron apps',
      permissions: ['workspace.read'],
    },
    {
      id: 'js-intellisense',   category: 'powerful',
      icon: '🟡', name: 'JS IntelliSense',
      tagline: 'Deep completions & hover docs for JavaScript',
      permissions: [],
    },
    {
      id: 'python-intellisense', category: 'powerful',
      icon: '🐍', name: 'Python IntelliSense',
      tagline: 'Type-aware completions for Python 3',
      permissions: [],
    },
    {
      id: 'cpp-intellisense',  category: 'powerful',
      icon: '⚙️', name: 'C++ IntelliSense',
      tagline: 'Clang-based completions for C/C++',
      permissions: [],
    },
    {
      id: 'java-intellisense', category: 'powerful',
      icon: '☕', name: 'Java IntelliSense',
      tagline: 'JDT-powered completions for Java',
      permissions: [],
    },
    {
      id: 'web-intellisense',  category: 'powerful',
      icon: '🌐', name: 'Web IntelliSense',
      tagline: 'HTML/CSS/Tailwind completions & hover docs',
      permissions: [],
    },

    // ── EXTREME POWERFUL ──────────────────────────────────────────
    {
      id: 'workspace-intelligence', category: 'extreme-powerful',
      icon: '🧠', name: 'Workspace Intelligence',
      tagline: 'Dependency graph, import chains, circular dep detection',
      permissions: ['workspace.read', 'graph.read', 'symbols.read'],
    },
    {
      id: 'codemap-x',         category: 'extreme-powerful',
      icon: '🗺️', name: 'CodeMap X',
      tagline: 'Visual code map — file tree, class hierarchy, jump nav',
      permissions: ['workspace.read', 'symbols.read'],
    },
    {
      id: 'workspace-health',  category: 'extreme-powerful',
      icon: '💊', name: 'Workspace Health',
      tagline: 'Health score, dead code, complexity, architecture smells',
      permissions: ['workspace.read', 'graph.read'],
    },
  ];

  // ── Lookup helpers ─────────────────────────────────────────────
  function getAll()          { return EXTENSIONS; }
  function getById(id)       { return EXTENSIONS.find(e => e.id === id) || null; }
  function getCategory(cat)  { return CATEGORIES[cat] || null; }
  function getAllCategories() { return Object.values(CATEGORIES); }

  function getByCategory(cat) {
    return EXTENSIONS.filter(e => e.category === cat);
  }

  function getCategoryOf(id) {
    const ext = getById(id);
    return ext ? CATEGORIES[ext.category] : null;
  }

  // Returns a badge element string for a given extension id
  function badgeHTML(id) {
    const cat = getCategoryOf(id);
    if (!cat) return '';
    return `<span class="ext-cat-badge ext-cat-${cat.id}" title="${cat.description}">`
         + `${cat.icon} ${cat.label}</span>`;
  }

  // Inject badge CSS once
  function injectBadgeCSS() {
    if (document.getElementById('ext-catalog-css')) return;
    const s = document.createElement('style');
    s.id = 'ext-catalog-css';
    s.textContent = `
.ext-cat-badge {
  display:inline-flex; align-items:center; gap:4px;
  padding:1px 8px; border-radius:20px; font-size:10.5px; font-weight:600;
  user-select:none; white-space:nowrap;
}
.ext-cat-normal           { background:#3fb95022; color:#3fb950; border:1px solid #3fb95044; }
.ext-cat-powerful         { background:#f7816622; color:#f78166; border:1px solid #f7816644; }
.ext-cat-extreme-powerful { background:#a371f722; color:#a371f7; border:1px solid #a371f744; }

.ext-cat-section-header {
  display:flex; align-items:center; gap:10px;
  padding:8px 14px 6px; margin:10px 0 4px;
  border-bottom:1px solid #21262d;
}
.ext-cat-section-icon  { font-size:15px; }
.ext-cat-section-label {
  font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em;
}
.ext-cat-section-count {
  margin-left:auto; font-size:10.5px; color:#7d8590;
  background:#21262d; padding:1px 7px; border-radius:10px;
}
    `;
    document.head.appendChild(s);
  }

  // ── Section HTML for marketplace / any panel ──────────────────
  function renderCategorySections(renderExtFn) {
    injectBadgeCSS();
    return Object.values(CATEGORIES).map(cat => {
      const exts = getByCategory(cat.id);
      const itemsHTML = exts.map(ext => renderExtFn(ext, cat)).join('');
      return `
        <div class="ext-cat-section-header">
          <span class="ext-cat-section-icon">${cat.icon}</span>
          <span class="ext-cat-section-label" style="color:${cat.color}">${cat.label}</span>
          <span class="ext-cat-section-count">${exts.length}</span>
        </div>
        ${itemsHTML}`;
    }).join('');
  }

  return {
    CATEGORIES,
    EXTENSIONS,
    getAll,
    getById,
    getCategory,
    getAllCategories,
    getByCategory,
    getCategoryOf,
    badgeHTML,
    injectBadgeCSS,
    renderCategorySections,
  };
})();
