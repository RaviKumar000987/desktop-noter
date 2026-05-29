// ─── Theme Studio ────────────────────────────────────────────────
// 8 premium Monaco themes with live preview and CSS variable overrides.

(window._exts = window._exts || {})['theme-studio'] = (() => {
  'use strict';

  let _ctx;

  const THEMES = [
    { id:'catppuccin-mocha', name:'Catppuccin Mocha', swatches:['#1e1e2e','#cba6f7','#89b4fa','#a6e3a1'] },
    { id:'vs-dark',          name:'VS Dark',          swatches:['#1e1e1e','#569cd6','#4ec9b0','#ce9178'] },
    { id:'hc-black',         name:'High Contrast',    swatches:['#000000','#ffffff','#ffff00','#1aebff'] },
    { id:'dracula',          name:'Dracula',          swatches:['#282a36','#ff79c6','#bd93f9','#50fa7b'] },
    { id:'nord',             name:'Nord',             swatches:['#2e3440','#81a1c1','#88c0d0','#a3be8c'] },
    { id:'one-dark-pro',     name:'One Dark Pro',     swatches:['#282c34','#61afef','#c678dd','#98c379'] },
    { id:'gruvbox-dark',     name:'Gruvbox Dark',     swatches:['#282828','#fb4934','#fabd2f','#b8bb26'] },
    { id:'github-dark',      name:'GitHub Dark',      swatches:['#0d1117','#58a6ff','#3fb950','#d29922'] },
  ];

  function _defineThemes() {
    // Dracula
    monaco.editor.defineTheme('dracula', {
      base:'vs-dark', inherit:true,
      rules:[
        {token:'comment',    foreground:'6272a4', fontStyle:'italic'},
        {token:'keyword',    foreground:'ff79c6'},
        {token:'string',     foreground:'f1fa8c'},
        {token:'number',     foreground:'bd93f9'},
        {token:'type',       foreground:'8be9fd'},
        {token:'function',   foreground:'50fa7b'},
        {token:'variable',   foreground:'f8f8f2'},
        {token:'operator',   foreground:'ff79c6'},
      ],
      colors:{
        'editor.background':'#282a36','editor.foreground':'#f8f8f2',
        'editorLineNumber.foreground':'#6272a4',
        'editor.lineHighlightBackground':'#44475a55',
        'editor.selectionBackground':'#44475a',
        'editorCursor.foreground':'#f8f8f2',
        'editor.findMatchBackground':'#ffb86c44',
      },
    });

    // Nord
    monaco.editor.defineTheme('nord', {
      base:'vs-dark', inherit:true,
      rules:[
        {token:'comment',    foreground:'4c566a', fontStyle:'italic'},
        {token:'keyword',    foreground:'81a1c1'},
        {token:'string',     foreground:'a3be8c'},
        {token:'number',     foreground:'b48ead'},
        {token:'type',       foreground:'8fbcbb'},
        {token:'function',   foreground:'88c0d0'},
      ],
      colors:{
        'editor.background':'#2e3440','editor.foreground':'#d8dee9',
        'editorLineNumber.foreground':'#4c566a',
        'editor.selectionBackground':'#434c5e',
        'editor.lineHighlightBackground':'#3b4252',
        'editorCursor.foreground':'#d8dee9',
      },
    });

    // One Dark Pro
    monaco.editor.defineTheme('one-dark-pro', {
      base:'vs-dark', inherit:true,
      rules:[
        {token:'comment',  foreground:'5c6370', fontStyle:'italic'},
        {token:'keyword',  foreground:'c678dd'},
        {token:'string',   foreground:'98c379'},
        {token:'number',   foreground:'d19a66'},
        {token:'function', foreground:'61afef'},
        {token:'type',     foreground:'e5c07b'},
        {token:'variable', foreground:'e06c75'},
      ],
      colors:{
        'editor.background':'#282c34','editor.foreground':'#abb2bf',
        'editorLineNumber.foreground':'#4b5263',
        'editor.selectionBackground':'#3e4452',
        'editorCursor.foreground':'#528bff',
      },
    });

    // Gruvbox
    monaco.editor.defineTheme('gruvbox-dark', {
      base:'vs-dark', inherit:true,
      rules:[
        {token:'comment',  foreground:'928374', fontStyle:'italic'},
        {token:'keyword',  foreground:'fb4934'},
        {token:'string',   foreground:'b8bb26'},
        {token:'number',   foreground:'d3869b'},
        {token:'function', foreground:'8ec07c'},
        {token:'type',     foreground:'fabd2f'},
      ],
      colors:{
        'editor.background':'#282828','editor.foreground':'#ebdbb2',
        'editorLineNumber.foreground':'#7c6f64',
        'editor.selectionBackground':'#504945',
        'editorCursor.foreground':'#ebdbb2',
      },
    });

    // GitHub Dark (already defined by app but re-register to be safe)
    monaco.editor.defineTheme('github-dark', {
      base:'vs-dark', inherit:true,
      rules:[
        {token:'comment',  foreground:'8b949e', fontStyle:'italic'},
        {token:'keyword',  foreground:'ff7b72'},
        {token:'string',   foreground:'a5d6ff'},
        {token:'number',   foreground:'79c0ff'},
        {token:'function', foreground:'d2a8ff'},
        {token:'type',     foreground:'ffa657'},
      ],
      colors:{
        'editor.background':'#0d1117','editor.foreground':'#c9d1d9',
        'editorLineNumber.foreground':'#6e7681',
        'editor.selectionBackground':'#3b5070',
        'editorCursor.foreground':'#c9d1d9',
      },
    });
  }

  function _applyTheme(themeId) {
    monaco.editor.setTheme(themeId);
    localStorage.setItem('noter-theme', themeId);
    const t = THEMES.find(t => t.id === themeId);
    _ctx?.updateStatus('ts-theme', `🎨 ${t?.name || themeId}`);
    _ctx?.toast(`Theme: ${t?.name || themeId}`, 'success', 1800);
  }

  function _openPanel() {
    const id = 'ext-theme-panel';
    document.getElementById(id)?.remove();
    const cur = localStorage.getItem('noter-theme') || 'catppuccin-mocha';

    const grid = THEMES.map(t => `
      <div class="ts-card ${t.id === cur ? 'active' : ''}" data-tid="${t.id}">
        <div class="ts-card-name">${t.name}</div>
        <div class="ts-swatches">
          ${t.swatches.map(c => `<div class="ts-sw" style="background:${c}"></div>`).join('')}
        </div>
      </div>`).join('');

    const panel = _ctx.openPanel(id, 'Theme Studio', `
      <div class="ts-grid">${grid}</div>
    `, { icon: '🎨' });

    panel.querySelectorAll('.ts-card').forEach(card => {
      card.addEventListener('click', () => {
        _applyTheme(card.dataset.tid);
        panel.querySelectorAll('.ts-card').forEach(c => c.classList.toggle('active', c.dataset.tid === card.dataset.tid));
      });
      card.addEventListener('mouseenter', () => monaco.editor.setTheme(card.dataset.tid));
      card.addEventListener('mouseleave', () => monaco.editor.setTheme(localStorage.getItem('noter-theme') || 'catppuccin-mocha'));
    });
  }

  function activate(ctx) {
    _ctx = ctx;
    _defineThemes();

    // Restore saved theme
    const saved = localStorage.getItem('noter-theme');
    if (saved && saved !== 'catppuccin-mocha') monaco.editor.setTheme(saved);

    ctx.addToolbarBtn({
      id:  'ext-theme-btn',
      icon: '🎨', label:'Theme',
      title:'Theme Studio — pick your editor theme',
      run:  _openPanel,
    });

    const cur = THEMES.find(t => t.id === (localStorage.getItem('noter-theme') || 'catppuccin-mocha'));
    ctx.addStatus('ts-theme', `🎨 ${cur?.name || 'Theme'}`, 'Theme Studio — change theme', _openPanel);
  }

  function deactivate() {
    document.getElementById('ext-theme-btn')?.remove();
    _ctx?.removeStatus('ts-theme');
  }

  function getQuickStart() {
    return {
      icon:'🎨', title:'Theme Studio', subtitle:'8 premium editor themes with live hover preview',
      steps:[
        { title:'Open Theme Picker', desc:'Click <strong>🎨 Theme</strong> in the toolbar or click the theme name in the status bar.' },
        { title:'Hover to Preview', desc:'Hover over any theme card to see a live preview in the editor. Click to apply and save.' },
        { title:'Auto-Saved', desc:'Your chosen theme is saved and restored automatically every time you open the app.' },
      ],
      shortcuts:[{ keys:'🎨 toolbar / status bar', desc:'Open theme picker' }],
      commands:[{ name:'theme.pick', desc:'Open theme picker panel' }],
      tips:['Hover over themes to preview before committing — the change reverts on mouse out.'],
      onStart: _openPanel,
    };
  }

  return {
    id:'theme-studio',
    activate, deactivate, getQuickStart,
    commands:[{ id:'theme.pick', label:'Theme Studio: Pick Theme', run:_openPanel }],
  };
})();
