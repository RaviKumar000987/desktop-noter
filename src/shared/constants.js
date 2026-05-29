// ═══════════════════════════════════════════════════════════════
//  SHARED CONSTANTS — src/shared/constants.js
//  Used by both main process and renderer (via contextBridge).
//  Import in main:    const C = require('../shared/constants');
//  Access in renderer: window.NOTER (exposed via preload if needed)
// ═══════════════════════════════════════════════════════════════

const NOTER = {
  APP_NAME:    'Noter',
  APP_VERSION: '2.0.0',

  // IPC channel names — keep in sync with preload.js and main.js
  IPC: {
    // File ops
    OPEN_FILE:        'open-file',
    SAVE_FILE:        'save-file',
    READ_DIR:         'read-directory',
    FS_RENAME:        'fs-rename',
    FS_DELETE:        'fs-delete',
    FS_MKDIR:         'fs-mkdir',
    FS_COPY:          'fs-copy',
    // Workspace
    SAVE_WORKSPACE:   'save-workspace',
    OPEN_WORKSPACE:   'open-workspace',
    GET_RECENT:       'get-recent-workspaces',
    // Terminal
    PTY_CREATE:       'pty-create',
    PTY_WRITE:        'pty-write',
    PTY_RESIZE:       'pty-resize',
    TERMINAL_EXEC:    'terminal-exec',
    // Search
    GLOBAL_SEARCH:    'global-search',
    // Marketplace
    MKT_FETCH:        'marketplace-fetch-registry',
    MKT_INSTALL:      'marketplace-install',
    MKT_UNINSTALL:    'marketplace-uninstall',
    // Window
    WIN_MINIMIZE:     'window-minimize',
    WIN_MAXIMIZE:     'window-maximize',
    WIN_CLOSE:        'window-close',
    WIN_QUIT:         'app-quit',
  },

  // Supported languages for Monaco
  LANGUAGES: {
    js:   'javascript', jsx:  'javascript', ts:   'typescript', tsx:  'typescript',
    py:   'python',     java: 'java',       c:    'c',          cpp:  'cpp',
    cs:   'csharp',     go:   'go',         rs:   'rust',       rb:   'ruby',
    php:  'php',        html: 'html',       css:  'css',        scss: 'scss',
    json: 'json',       md:   'markdown',   sh:   'shell',      yml:  'yaml',
    yaml: 'yaml',       xml:  'xml',        sql:  'sql',        kt:   'kotlin',
    swift:'swift',      lua:  'lua',
  },

  // Default editor settings (mirrors settings-manager.js SCHEMA_DEFAULTS)
  DEFAULTS: {
    FONT_SIZE:   18,
    FONT_FAMILY: 'Cascadia Code, Fira Code, Consolas',
    TAB_SIZE:    4,
    THEME:       'GitHub Dark',
  },

  // Paths (relative to main process __dirname = src/main/)
  PATHS: {
    PRELOAD:  '../preload/preload.js',
    RENDERER: '../renderer/index.html',
  },
};

// CommonJS export for main process
if (typeof module !== 'undefined') module.exports = NOTER;
// Browser global for renderer (loaded as <script>)
if (typeof window !== 'undefined') window.NOTER = NOTER;
