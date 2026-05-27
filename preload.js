const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Window controls
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  quit: () => ipcRenderer.send("quit-app"),

  // File operations
  openFile: () => ipcRenderer.invoke("open-file"),
  openFileByPath: (filePath) =>
    ipcRenderer.invoke("open-file-by-path", filePath),
  saveFile: (data) => ipcRenderer.invoke("save-file", data),
  saveAsFile: (content) => ipcRenderer.invoke("save-as-file", content),

  // External links
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
