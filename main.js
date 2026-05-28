const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs   = require("fs");
const path = require("node:path");
const { exec } = require("child_process");
const os   = require("os");
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
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

// ─── File Filters ────────────────────────────────────────────────────────────
const FILE_FILTERS = [
  {
    name: "All Supported Files",
    extensions: [
      "txt","js","mjs","ts","jsx","tsx","html","htm","css","scss","less",
      "json","jsonc","md","markdown","py","rb","php","java","c","h","cpp",
      "cc","cs","go","rs","sh","bash","xml","svg","yaml","yml","sql",
    ],
  },
  { name: "Text Files", extensions: ["txt"] },
  { name: "JavaScript / TypeScript", extensions: ["js","ts","jsx","tsx","mjs"] },
  { name: "Web Files", extensions: ["html","htm","css","scss","less"] },
  { name: "Data / Config", extensions: ["json","jsonc","xml","yaml","yml","sql"] },
  { name: "Markdown", extensions: ["md","markdown"] },
  { name: "Python", extensions: ["py"] },
  { name: "All Files", extensions: ["*"] },
];

// ─── File Operations ─────────────────────────────────────────────────────────
ipcMain.handle("open-file", async () => {
  mainWindow.setAlwaysOnTop(false);
  let result;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: FILE_FILTERS,
    });
  } finally {
    mainWindow.setAlwaysOnTop(true);
  }
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { filePath, content };
  } catch {
    return null;
  }
});

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
  mainWindow.setAlwaysOnTop(false);
  let result;
  try {
    result = await dialog.showSaveDialog(mainWindow, {
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
  } finally {
    mainWindow.setAlwaysOnTop(true);
  }
  if (result.canceled) return null;
  try {
    fs.writeFileSync(result.filePath, content, "utf8");
    return result.filePath;
  } catch {
    return null;
  }
});

// ─── Folder / Explorer ────────────────────────────────────────────────────────
ipcMain.handle("open-folder", async () => {
  mainWindow.setAlwaysOnTop(false);
  let result;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Open Folder",
    });
  } finally {
    mainWindow.setAlwaysOnTop(true);
  }
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("read-directory", async (e, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => !entry.name.startsWith(".") || entry.name === ".env")
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        type: entry.isDirectory() ? "directory" : "file",
      }))
      .sort((a, b) => {
        if (a.type !== b.type)
          return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  } catch {
    return null;
  }
});

// ─── Workspace ────────────────────────────────────────────────────────────────
ipcMain.handle("save-workspace", async (e, data) => {
  mainWindow.setAlwaysOnTop(false);
  let result;
  try {
    result = await dialog.showSaveDialog(mainWindow, {
      title: "Save Workspace",
      defaultPath: "workspace.noterws",
      filters: [{ name: "Noter Workspace", extensions: ["noterws"] }],
    });
  } finally {
    mainWindow.setAlwaysOnTop(true);
  }
  if (result.canceled) return null;
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), "utf8");
    return result.filePath;
  } catch {
    return null;
  }
});

ipcMain.handle("open-workspace", async () => {
  mainWindow.setAlwaysOnTop(false);
  let result;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Noter Workspace", extensions: ["noterws"] }],
      title: "Open Workspace",
    });
  } finally {
    mainWindow.setAlwaysOnTop(true);
  }
  if (result.canceled) return null;
  try {
    const raw = fs.readFileSync(result.filePaths[0], "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
});

// ─── External Links ──────────────────────────────────────────────────────────
ipcMain.handle("open-external", async (e, url) => {
  await shell.openExternal(url);
});

// ─── Terminal ─────────────────────────────────────────────────────────────────
let terminalCwd = os.homedir();

ipcMain.handle("terminal-exec", async (e, command) => {
  const cmd = (command || "").trim();
  if (!cmd) return { stdout: "", stderr: "", cwd: terminalCwd, exitCode: 0 };

  // Handle `cd` separately to persist the working directory
  const cdMatch = cmd.match(/^cd(?:\s+(.*))?$/i);
  if (cdMatch) {
    let target = (cdMatch[1] || "").trim().replace(/^["']|["']$/g, "");
    if (!target || target === "~") {
      terminalCwd = os.homedir();
      return { stdout: "", stderr: "", cwd: terminalCwd, exitCode: 0 };
    }
    try {
      const resolved = path.resolve(terminalCwd, target);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        terminalCwd = resolved;
        return { stdout: "", stderr: "", cwd: terminalCwd, exitCode: 0 };
      }
      return { stdout: "", stderr: `cd: No such directory: ${target}\n`, cwd: terminalCwd, exitCode: 1 };
    } catch (err) {
      return { stdout: "", stderr: err.message + "\n", cwd: terminalCwd, exitCode: 1 };
    }
  }

  return new Promise((resolve) => {
    exec(
      cmd,
      { cwd: terminalCwd, env: process.env, shell: true, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({
          stdout:   stdout || "",
          stderr:   err && !stderr ? err.message + "\n" : (stderr || ""),
          cwd:      terminalCwd,
          exitCode: err ? (err.code || 1) : 0,
        });
      }
    );
  });
});

ipcMain.handle("terminal-get-cwd", async () => terminalCwd);
ipcMain.handle("terminal-set-cwd", async (e, dir) => {
  if (dir && fs.existsSync(dir)) terminalCwd = dir;
  return terminalCwd;
});

// ─── Project Structure Creator ───────────────────────────────────────────────
ipcMain.handle("create-project-structure", async (e, { folderPath, files, setupCommand }) => {
  const result = { success: true, filesCreated: 0, setupDone: false, setupError: null };

  try {
    for (const file of files) {
      const relParts = file.path.split("/");
      const filePath = path.join(folderPath, ...relParts);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, file.content, "utf8");
        result.filesCreated++;
      }
    }
  } catch (err) {
    return { success: false, error: err.message, filesCreated: result.filesCreated };
  }

  if (setupCommand) {
    try {
      await new Promise((resolve) => {
        exec(
          setupCommand,
          { cwd: folderPath, env: process.env, shell: true, timeout: 60000 },
          (err, _stdout, stderr) => {
            if (err) result.setupError = stderr || err.message;
            else result.setupDone = true;
            resolve();
          }
        );
      });
    } catch (err) {
      result.setupError = err.message;
    }
  }

  return result;
});

// ─── Global Search ────────────────────────────────────────────────────────────
ipcMain.handle("global-search", async (e, { query, rootPath, caseSensitive, useRegex }) => {
  if (!query || !rootPath) return [];

  const TEXT_EXTS = new Set([
    "txt","js","mjs","cjs","ts","jsx","tsx","html","htm","css","scss","less",
    "json","jsonc","md","markdown","py","rb","php","java","c","h","cpp","cc",
    "cs","go","rs","sh","bash","xml","svg","yaml","yml","sql","env",
  ]);
  const SKIP_DIRS = new Set(["node_modules",".git","dist","build",".next","out","coverage",".cache"]);

  const results = [];

  function makePattern(q, cs, rx) {
    try {
      const flags = cs ? "g" : "gi";
      return new RegExp(rx ? q : q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), flags);
    } catch { return null; }
  }

  // ── Async reads — never blocks the main-process event loop ───────────────
  async function searchFile(filePath) {
    if (results.length >= 400) return;
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const lines   = content.split("\n");
      const pattern = makePattern(query, caseSensitive, useRegex);
      if (!pattern) return;
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= 400) break;
        pattern.lastIndex = 0;
        if (pattern.test(lines[i])) {
          results.push({ file: filePath, line: lines[i].slice(0, 300), lineNumber: i + 1 });
        }
      }
    } catch { /* skip binary / unreadable files */ }
  }

  async function walk(dir, depth) {
    if (depth > 12 || results.length >= 400) return;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= 400) break;
        if (entry.name.startsWith(".") && entry.name !== ".env") continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
        } else {
          const ext = (entry.name.split(".").pop() || "").toLowerCase();
          if (TEXT_EXTS.has(ext)) await searchFile(full);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  await walk(rootPath, 0);
  return results;
});
