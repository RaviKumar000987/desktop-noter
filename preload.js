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

  // ── Terminal ─────────────────────────────────────────────────
  terminalExec:   (command)       => ipcRenderer.invoke("terminal-exec", command),
  terminalGetCwd: ()              => ipcRenderer.invoke("terminal-get-cwd"),
  terminalSetCwd: (dir)           => ipcRenderer.invoke("terminal-set-cwd", dir),

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
});
