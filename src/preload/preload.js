const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Window controls ──────────────────────────────────────────
  minimize:  () => ipcRenderer.send("window-minimize"),
  maximize:  () => ipcRenderer.send("window-maximize"),
  close:     () => ipcRenderer.send("window-close"),
  quit:      () => ipcRenderer.send("quit-app"),

  // ── File operations ──────────────────────────────────────────
  openFile:       ()              => ipcRenderer.invoke("open-file"),
  openFileByPath: (filePath)      => ipcRenderer.invoke("open-file-by-path", filePath),
  saveFile:       (data)          => ipcRenderer.invoke("save-file", data),
  saveAsFile:     (content)       => ipcRenderer.invoke("save-as-file", content),

  // ── Folder / Explorer ────────────────────────────────────────
  openFolder:     ()              => ipcRenderer.invoke("open-folder"),
  readDirectory:  (dirPath)       => ipcRenderer.invoke("read-directory", dirPath),

  // ── Workspace ────────────────────────────────────────────────
  saveWorkspace:  (data)          => ipcRenderer.invoke("save-workspace", data),
  openWorkspace:  ()              => ipcRenderer.invoke("open-workspace"),

  // ── External links ───────────────────────────────────────────
  openExternal:   (url)           => ipcRenderer.invoke("open-external", url),

  // ── Terminal (legacy exec) ────────────────────────────────────
  terminalExec:   (command)       => ipcRenderer.invoke("terminal-exec", command),
  terminalGetCwd: ()              => ipcRenderer.invoke("terminal-get-cwd"),
  terminalSetCwd: (dir)           => ipcRenderer.invoke("terminal-set-cwd", dir),

  // ── PTY Terminal (xterm.js) ───────────────────────────────────
  ptyCreate:  (opts)  => ipcRenderer.invoke("pty-create", opts),
  ptyWrite:   (data)  => ipcRenderer.send("pty-write", data),
  ptyResize:  (opts)  => ipcRenderer.invoke("pty-resize", opts),
  ptyKill:    ()      => ipcRenderer.invoke("pty-kill"),
  onPtyData:  (cb)    => ipcRenderer.on("pty-data",  (_e, d) => cb(d)),
  onPtyExit:  (cb)    => ipcRenderer.on("pty-exit",  (_e, c) => cb(c)),
  offPtyData: ()      => ipcRenderer.removeAllListeners("pty-data"),
  offPtyExit: ()      => ipcRenderer.removeAllListeners("pty-exit"),

  // ── Global Search ────────────────────────────────────────────
  globalSearch:          (opts)   => ipcRenderer.invoke("global-search", opts),

  // ── Project Structure ────────────────────────────────────────
  createProjectStructure: (opts)  => ipcRenderer.invoke("create-project-structure", opts),

  // ── Extension Marketplace ────────────────────────────────────
  marketplaceFetchRegistry: ()          => ipcRenderer.invoke("marketplace-fetch-registry"),
  marketplaceGetInstalled:  ()          => ipcRenderer.invoke("marketplace-get-installed"),
  marketplaceInstall:       (meta)      => ipcRenderer.invoke("marketplace-install", meta),
  marketplaceUninstall:     (id)        => ipcRenderer.invoke("marketplace-uninstall", id),
  marketplaceToggle:        (opts)      => ipcRenderer.invoke("marketplace-toggle", opts),
  marketplaceGetSettings:   ()          => ipcRenderer.invoke("marketplace-get-settings"),
  marketplaceSaveSettings:  (settings)  => ipcRenderer.invoke("marketplace-save-settings", settings),

  // ── File System Operations ───────────────────────────────────
  fsRename:      (oldPath, newPath) => ipcRenderer.invoke("fs-rename", oldPath, newPath),
  fsDelete:      (filePath)         => ipcRenderer.invoke("fs-delete", filePath),
  fsNewFile:     (dirPath, name)    => ipcRenderer.invoke("fs-new-file", dirPath, name),
  fsNewFolder:   (dirPath, name)    => ipcRenderer.invoke("fs-new-folder", dirPath, name),
  fsDuplicate:   (srcPath, dest)    => ipcRenderer.invoke("fs-duplicate", srcPath, dest),
  shellReveal:   (filePath)         => ipcRenderer.invoke("shell-reveal", filePath),

  // ── File Watcher ─────────────────────────────────────────────
  watchFile:   (filePath) => ipcRenderer.invoke("watch-file", filePath),
  unwatchFile: (filePath) => ipcRenderer.invoke("unwatch-file", filePath),
  onFileExternalChange:  (cb) => ipcRenderer.on("file-externally-changed", (_e, fp) => cb(fp)),
  offFileExternalChange: (cb) => ipcRenderer.removeAllListeners("file-externally-changed"),

  // ── Quick Open — workspace file listing ──────────────────────
  listWorkspaceFiles: (rootPath) => ipcRenderer.invoke("list-workspace-files", rootPath),

  // ── Workspace Metadata (noter.workspace inside workspace folder) ──
  workspaceReadMeta:     (folderPath)        => ipcRenderer.invoke("workspace-read-meta", folderPath),
  workspaceWriteMeta:    (folderPath, data)  => ipcRenderer.invoke("workspace-write-meta", folderPath, data),

  // ── Recent Workspaces (stored in %APPDATA%/Noter/) ────────────
  getRecentWorkspaces:   ()                  => ipcRenderer.invoke("get-recent-workspaces"),
  addRecentWorkspace:    (entry)             => ipcRenderer.invoke("add-recent-workspace", entry),
  removeRecentWorkspace: (workspacePath)     => ipcRenderer.invoke("remove-recent-workspace", workspacePath),
  clearRecentWorkspaces: ()                  => ipcRenderer.invoke("clear-recent-workspaces"),

  // ── Workspace folder watcher (Phase 4 — explorer auto-refresh) ──
  watchWorkspace:     (folderPath) => ipcRenderer.invoke("watch-workspace", folderPath),
  unwatchWorkspace:   (folderPath) => ipcRenderer.invoke("unwatch-workspace", folderPath),
  onWorkspaceChange:  (cb) => ipcRenderer.on("workspace-changed", (_e, data) => cb(data)),
  offWorkspaceChange: ()   => ipcRenderer.removeAllListeners("workspace-changed"),

  // ── Read file content (IntelliSense workspace indexer) ──────────
  readFileContent: (filePath) => ipcRenderer.invoke("read-file-content", filePath),

  // ── Performance diagnostics ──────────────────────────────────────
  getProcessMemory: ()      => ipcRenderer.invoke("get-process-memory"),
  readGitignore:    (dir)   => ipcRenderer.invoke("read-gitignore", dir),
  reloadWindow:     ()      => ipcRenderer.invoke("reload-window"),

  // ── Crash recovery (file-system level backup) ──────────────────
  crashBackupRead:  ()      => ipcRenderer.invoke("crash-backup-read"),
  crashBackupWrite: (data)  => ipcRenderer.invoke("crash-backup-write", data),
  crashBackupClear: ()      => ipcRenderer.invoke("crash-backup-clear"),

  // ── Language Server Protocol (LSP) bridge ────────────────────
  lspStart:    (serverId)                    => ipcRenderer.invoke("lsp:start", serverId),
  lspStop:     (serverId)                    => ipcRenderer.invoke("lsp:stop", serverId),
  lspRequest:  (serverId, method, params)    => ipcRenderer.invoke("lsp:request", { serverId, method, params }),
  lspNotify:   (serverId, method, params)    => ipcRenderer.send("lsp:notify", { serverId, method, params }),
  lspStatus:   ()                            => ipcRenderer.invoke("lsp:status"),
  lspDetect:   ()                            => ipcRenderer.invoke("lsp:detect"),
  // Events from server → renderer
  onLspMessage:       (cb) => ipcRenderer.on("lsp:message",       (_e, d) => cb(d)),
  onLspServerStatus:  (cb) => ipcRenderer.on("lsp:server-status", (_e, d) => cb(d)),
  offLspMessage:      ()   => ipcRenderer.removeAllListeners("lsp:message"),
  offLspServerStatus: ()   => ipcRenderer.removeAllListeners("lsp:server-status"),

  // ── Rust Native Core ─────────────────────────────────────────────
  nativeGitStatus:      (repoPath)             => ipcRenderer.invoke("native-git-status", repoPath),
  nativeIndexWorkspace: (root, dbPath)         => ipcRenderer.invoke("native-index-workspace", { root, dbPath }),
  nativeSearchSymbols:  (dbPath, query)        => ipcRenderer.invoke("native-search-symbols", { dbPath, query }),
  nativeCacheSet:       (dbPath, ns, key, val) => ipcRenderer.invoke("native-cache-set", { dbPath, namespace: ns, key, value: val }),
  nativeCacheGet:       (dbPath, ns, key)      => ipcRenderer.invoke("native-cache-get", { dbPath, namespace: ns, key }),

  // ── Settings JSON ─────────────────────────────────────────────
  // VS Code-style settings.json — read, write, watch for changes.
  settingsJsonRead:         ()      => ipcRenderer.invoke("settings-json:read"),
  settingsJsonReadRaw:      ()      => ipcRenderer.invoke("settings-json:read-raw"),
  settingsJsonWriteRaw:     (text)  => ipcRenderer.invoke("settings-json:write-raw", text),
  settingsJsonGetPath:      ()      => ipcRenderer.invoke("settings-json:get-path"),
  settingsJsonGetDefaults:  ()      => ipcRenderer.invoke("settings-json:get-defaults"),
  onSettingsJsonChanged:    (cb)    => ipcRenderer.on("settings-json:changed", (_e, s) => cb(s)),
  offSettingsJsonChanged:   ()      => ipcRenderer.removeAllListeners("settings-json:changed"),
});

// ── window.noter — Rust engine gateway ────────────────────────────────────────
// All Rust ↔ Electron IPC lives here. Namespaces are locked — never add flat
// methods to this object. Every method maps to a typed IPC contract in
// noter-core-api/src/ipc/*.rs and its TypeScript mirror in src/shared/ipc-types.ts
//
// Namespaces reserved (stubs filled in as phases ship):
//   noter.lsp.*       Phase 1 — Language servers
//   noter.search.*    Phase 1 — Symbol + text search
//   noter.index.*     Phase 1 — Workspace indexing
//   noter.git.*       Phase 3 — Git engine
//   noter.graph.*     Phase 2 — Code / dependency graph
//   noter.ai.*        Phase 2 — AI context engine
//   noter.workspace.* Phase 1.5 — Project intelligence
//   noter.runtime.*   Phase 0.5 — Service health
//
contextBridge.exposeInMainWorld("noter", {

  // ── LSP — Language server lifecycle & protocol ──────────────────────────
  lsp: {
    start:   (req)                   => ipcRenderer.invoke("noter:lsp:start",    req),
    stop:    (req)                   => ipcRenderer.invoke("noter:lsp:stop",     req),
    request: (serverId, method, p)   => ipcRenderer.invoke("noter:lsp:request",  { serverId, method, params: p }),
    notify:  (serverId, method, p)   => ipcRenderer.send(  "noter:lsp:notify",   { serverId, method, params: p }),
    status:  ()                      => ipcRenderer.invoke("noter:lsp:status"),
    detect:  ()                      => ipcRenderer.invoke("noter:lsp:detect"),

    onMessage:      (cb) => ipcRenderer.on("noter:lsp:message",        (_e, d) => cb(d)),
    onServerStatus: (cb) => ipcRenderer.on("noter:lsp:server-status",  (_e, d) => cb(d)),
    offMessage:     ()   => ipcRenderer.removeAllListeners("noter:lsp:message"),
    offServerStatus:()   => ipcRenderer.removeAllListeners("noter:lsp:server-status"),
  },

  // ── Search — symbol search + workspace text search ──────────────────────
  search: {
    symbols: (req) => ipcRenderer.invoke("noter:search:symbols", req),
    text:    (req) => ipcRenderer.invoke("noter:search:text",    req),
  },

  // ── Index — workspace indexing ──────────────────────────────────────────
  index: {
    workspace:      (req) => ipcRenderer.invoke("noter:index:workspace", req),
    onProgress:     (cb)  => ipcRenderer.on("noter:index:progress",  (_e, d) => cb(d)),
    onComplete:     (cb)  => ipcRenderer.on("noter:index:complete",  (_e, d) => cb(d)),
    offProgress:    ()    => ipcRenderer.removeAllListeners("noter:index:progress"),
    offComplete:    ()    => ipcRenderer.removeAllListeners("noter:index:complete"),
  },

  // ── Runtime — service health (Phase 0.5) ───────────────────────────────
  runtime: {
    serviceStates:        ()    => ipcRenderer.invoke("noter:runtime:states"),
    onServiceStateChange: (cb)  => ipcRenderer.on("noter:runtime:state-changed", (_e, d) => cb(d)),
    offServiceStateChange:()    => ipcRenderer.removeAllListeners("noter:runtime:state-changed"),
  },

  // ── Git — Rust git engine (Phase 3) ────────────────────────────────────
  git: {
    status:   (req) => ipcRenderer.invoke("noter:git:status",   req),
    diff:     (req) => ipcRenderer.invoke("noter:git:diff",     req),
    log:      (req) => ipcRenderer.invoke("noter:git:log",      req),
    branches: (req) => ipcRenderer.invoke("noter:git:branches", req),
  },

  // ── Graph — code / dependency graph (Phase 2) ──────────────────────────
  graph: {
    referencesTo:   (req) => ipcRenderer.invoke("noter:graph:refs-to",   req),
    referencesFrom: (req) => ipcRenderer.invoke("noter:graph:refs-from", req),
    impact:         (req) => ipcRenderer.invoke("noter:graph:impact",    req),
  },

  // ── AI — context engine (Phase 2) ──────────────────────────────────────
  ai: {
    context:    (req) => ipcRenderer.invoke("noter:ai:context",    req),
    embeddings: (req) => ipcRenderer.invoke("noter:ai:embeddings", req),
    query:      (req) => ipcRenderer.invoke("noter:ai:query",      req),
  },

  // ── Workspace — project intelligence (Phase 1.5) ───────────────────────
  workspace: {
    scan:       (req) => ipcRenderer.invoke("noter:workspace:scan",    req),
    projectMap: (req) => ipcRenderer.invoke("noter:workspace:map",     req),
    memory:     (req) => ipcRenderer.invoke("noter:workspace:memory",  req),
  },
});
