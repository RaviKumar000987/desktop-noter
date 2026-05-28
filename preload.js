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
});
