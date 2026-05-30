// ─── File Icons Pro ──────────────────────────────────────────────
// Rich emoji file & folder icons in the explorer. Auto-applied via MutationObserver.

(window._exts = window._exts || {})['file-icons-pro'] = (() => {
  'use strict';

  let _observer = null;

  const FILE_ICONS = {
    js:'🟨',mjs:'🟨',cjs:'🟨',jsx:'🟦',ts:'🔷',tsx:'🔷',
    html:'🟧',htm:'🟧',css:'💠',scss:'🌸',less:'🟣',
    json:'💚',jsonc:'💚',yaml:'🧡',yml:'🧡',toml:'🟤',
    md:'📄',markdown:'📄',txt:'📝',
    py:'🐍',rb:'💎',php:'🐘',java:'☕',kt:'🟪',
    c:'🔵',h:'🔵',cpp:'🔷',cc:'🔷',cs:'💜',
    go:'🐹',rs:'🦀',swift:'🍊',dart:'🩵',
    sh:'🖥',bash:'🖥',zsh:'🖥',fish:'🐟',
    xml:'🔶',svg:'🎨',vue:'💚',
    sql:'🗄',graphql:'💗',gql:'💗',
    dockerfile:'🐳',env:'🔑',gitignore:'🔒',
    lock:'🔒',toml:'⚙',cfg:'⚙',conf:'⚙',ini:'⚙',
    zip:'📦',tar:'📦',gz:'📦',
    png:'🖼',jpg:'🖼',jpeg:'🖼',gif:'🖼',webp:'🖼',ico:'🖼',
    pdf:'📕',
    mp4:'🎬',mp3:'🎵',wav:'🎵',
  };

  const FOLDER_ICONS = {
    src:'📂', source:'📂', lib:'📚', libs:'📚',
    test:'🧪', tests:'🧪', '__tests__':'🧪', spec:'🧪',
    docs:'📖', doc:'📖', documentation:'📖',
    assets:'🗂', public:'🌐', static:'🌐',
    dist:'📦', build:'🏗', out:'📤', output:'📤',
    node_modules:'⬢', vendor:'📦',
    components:'🧩', views:'👁', pages:'📃',
    styles:'🎨', css:'🎨', scss:'🎨',
    utils:'🔧', helpers:'🔧', common:'🔧',
    config:'⚙', configs:'⚙', settings:'⚙',
    hooks:'🪝', store:'🗃', context:'🔗',
    api:'📡', services:'⚙', controllers:'🎮',
    models:'🗺', schemas:'📋', types:'📐',
    scripts:'📜', bin:'⚡', tools:'🛠',
  };

  function _iconForFile(filename) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    // Special files
    if (filename === 'Dockerfile') return '🐳';
    if (filename === '.env' || filename.startsWith('.env.')) return '🔑';
    if (filename === '.gitignore') return '🔒';
    if (filename === 'package.json') return '📦';
    if (filename === 'package-lock.json' || filename === 'yarn.lock') return '🔒';
    if (filename === 'README.md' || filename === 'readme.md') return '📘';
    if (filename === 'LICENSE' || filename === 'license') return '⚖';
    if (filename === 'Makefile' || filename === 'makefile') return '🔨';
    return FILE_ICONS[ext] || '📄';
  }

  function _iconForFolder(name) {
    return FOLDER_ICONS[name.toLowerCase()] || null;
  }

  function _patchRow(row) {
    const nameEl = row.querySelector('.explorer-name');
    if (!nameEl || row.dataset.iconPatched) return;

    const iconEl = row.querySelector('.explorer-file-icon');
    if (!iconEl) return;

    const name  = nameEl.textContent.trim();
    const isDir = !!row.querySelector('.explorer-toggle');

    if (isDir) {
      const folderIcon = _iconForFolder(name);
      if (folderIcon) iconEl.textContent = folderIcon;
    } else {
      iconEl.textContent = _iconForFile(name);
    }
    row.dataset.iconPatched = '1';
  }

  function _patchAll() {
    document.querySelectorAll('.explorer-row[data-path]').forEach(_patchRow);
  }

  function activate() {
    _patchAll();
    _observer = new MutationObserver(() => _patchAll());
    const tree = document.getElementById('explorer-tree');
    if (tree) _observer.observe(tree, { childList:true, subtree:true });
  }

  function deactivate() {
    _observer?.disconnect(); _observer = null;
    // Reset to default icons
    document.querySelectorAll('.explorer-row[data-icon-patched]').forEach(row => {
      delete row.dataset.iconPatched;
    });
  }

  function getQuickStart() {
    return {
      icon:'🗂', title:'File Icons Pro', subtitle:'Beautiful icons for every file type in the Explorer',
      steps:[
        { title:'Automatic — No Setup', desc:'File Icons Pro activates instantly. Every file in the Explorer gets a contextual icon based on its extension and filename.' },
        { title:'What\'s Included', desc:'JS 🟨, TS 🔷, Python 🐍, Rust 🦀, Go 🐹, Docker 🐳, JSON 💚, Markdown 📄, and 60+ more.' },
        { title:'Smart Folder Icons', desc:'Common folders like <code>src</code>, <code>tests</code>, <code>node_modules</code>, <code>dist</code>, and <code>public</code> get recognizable icons.' },
      ],
      shortcuts:[], commands:[],
      tips:['Icons update instantly when you create, rename, or move files.','Special files like Dockerfile, .env, package.json get dedicated icons.'],
    };
  }

  return {
    id:'file-icons-pro', activate, deactivate, getQuickStart,
    commands:[], toolbar:null,
  };
})();
