const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("node:path");
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "./preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadFile("./index.html");
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─── Window Controls ────────────────────────────────────────────────────────
ipcMain.on("window-minimize", () => mainWindow.minimize());

ipcMain.on("window-maximize", () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.on("window-close", () => mainWindow.close());

ipcMain.on("quit-app", () => app.quit());

// ─── File Operations ─────────────────────────────────────────────────────────
const FILE_FILTERS = [
  {
    name: "All Supported Files",
    extensions: [
      "txt",
      "js",
      "mjs",
      "ts",
      "jsx",
      "tsx",
      "html",
      "htm",
      "css",
      "scss",
      "less",
      "json",
      "jsonc",
      "md",
      "markdown",
      "py",
      "rb",
      "php",
      "java",
      "c",
      "h",
      "cpp",
      "cc",
      "cs",
      "go",
      "rs",
      "sh",
      "bash",
      "xml",
      "svg",
      "yaml",
      "yml",
      "sql",
    ],
  },
  { name: "Text Files", extensions: ["txt"] },
  {
    name: "JavaScript / TypeScript",
    extensions: ["js", "ts", "jsx", "tsx", "mjs"],
  },
  { name: "Web Files", extensions: ["html", "htm", "css", "scss", "less"] },
  {
    name: "Data / Config",
    extensions: ["json", "jsonc", "xml", "yaml", "yml", "sql"],
  },
  { name: "Markdown", extensions: ["md", "markdown"] },
  { name: "Python", extensions: ["py"] },
  { name: "All Files", extensions: ["*"] },
];

ipcMain.handle("open-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: FILE_FILTERS,
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, "utf-8");
  return { filePath, content };
});

// Open a specific file path (used by Recent Files)
ipcMain.handle("open-file-by-path", async (e, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { filePath, content };
  } catch {
    return null;
  }
});

ipcMain.handle("save-file", async (e, data) => {
  try {
    fs.writeFileSync(data.path, data.content, "utf8");
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("save-as-file", async (e, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save File",
    defaultPath: "untitled.txt",
    filters: [
      { name: "Text File", extensions: ["txt"] },
      { name: "JavaScript", extensions: ["js"] },
      { name: "TypeScript", extensions: ["ts"] },
      { name: "HTML", extensions: ["html"] },
      { name: "CSS", extensions: ["css"] },
      { name: "JSON", extensions: ["json"] },
      { name: "Markdown", extensions: ["md"] },
      { name: "Python", extensions: ["py"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled) return null;
  fs.writeFileSync(result.filePath, content, "utf8");
  return result.filePath;
});

// ─── Help → Documentation ─────────────────────────────────────────────────
ipcMain.handle("open-external", async (e, url) => {
  await shell.openExternal(url);
});
