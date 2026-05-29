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
});
