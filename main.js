const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs     = require("fs");
const path   = require("node:path");
const https  = require("https");
const { exec } = require("child_process");
const os     = require("os");
let mainWindow;

// ─── Extension Marketplace helpers ───────────────────────────────────────────
function getExtensionsDir() {
  let base;
  if (process.platform === "win32") {
    base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  } else if (process.platform === "darwin") {
    base = path.join(os.homedir(), "Library", "Application Support");
  } else {
    base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  }
  return path.join(base, "Noter", "extensions");
}

function ensureExtDir() {
  const dir = getExtensionsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readInstalledRegistry() {
  const p = path.join(getExtensionsDir(), "installed.json");
  try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {}; }
  catch { return {}; }
}

function writeInstalledRegistry(data) {
  const dir = ensureExtDir();
  fs.writeFileSync(path.join(dir, "installed.json"), JSON.stringify(data, null, 2), "utf-8");
}

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

// ─── Extension Marketplace IPC ───────────────────────────────────────────────

// Fetch live registry from GitHub (falls back in renderer if this returns null)
ipcMain.handle("marketplace-fetch-registry", () => {
  const REGISTRY_URL = "https://raw.githubusercontent.com/noter-app/marketplace/main/marketplace.json";
  return new Promise((resolve) => {
    https.get(REGISTRY_URL, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on("error", () => resolve(null))
      .on("timeout", function() { this.destroy(); resolve(null); });
  });
});

ipcMain.handle("marketplace-get-installed", () => readInstalledRegistry());

ipcMain.handle("marketplace-install", (e, meta) => {
  try {
    const installed = readInstalledRegistry();
    installed[meta.id] = { ...meta, enabled: true, installedAt: new Date().toISOString() };
    writeInstalledRegistry(installed);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("marketplace-uninstall", (e, id) => {
  try {
    const installed = readInstalledRegistry();
    delete installed[id];
    writeInstalledRegistry(installed);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("marketplace-toggle", (e, { id, enabled }) => {
  try {
    const installed = readInstalledRegistry();
    if (installed[id]) { installed[id].enabled = enabled; writeInstalledRegistry(installed); }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("marketplace-get-settings", () => {
  const defaults = { autoUpdate: true, showRecommendations: true, installedFirst: false, checkUpdatesOnStartup: true };
  try {
    const p = path.join(getExtensionsDir(), "settings.json");
    if (fs.existsSync(p)) return { ...defaults, ...JSON.parse(fs.readFileSync(p, "utf-8")) };
  } catch { /* use defaults */ }
  return defaults;
});

ipcMain.handle("marketplace-save-settings", (e, settings) => {
  try {
    const dir = ensureExtDir();
    fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify(settings, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── File System Operations ───────────────────────────────────────────────────

ipcMain.handle("fs-rename", async (e, oldPath, newPath) => {
  try {
    await fs.promises.rename(oldPath, newPath);
    return true;
  } catch { return false; }
});

ipcMain.handle("fs-delete", async (e, filePath) => {
  try {
    await shell.trashItem(filePath);
    return true;
  } catch {
    // Fallback for items that can't be trashed
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch { return false; }
  }
});

ipcMain.handle("fs-new-file", async (e, dirPath, name) => {
  try {
    const filePath = path.join(dirPath, name);
    if (fs.existsSync(filePath)) return false;
    fs.writeFileSync(filePath, "", "utf8");
    return filePath;
  } catch { return false; }
});

ipcMain.handle("fs-new-folder", async (e, dirPath, name) => {
  try {
    const folderPath = path.join(dirPath, name);
    if (fs.existsSync(folderPath)) return false;
    fs.mkdirSync(folderPath, { recursive: true });
    return true;
  } catch { return false; }
});

ipcMain.handle("fs-duplicate", async (e, srcPath, destPath) => {
  try {
    // Find a unique destination path
    let finalDest = destPath;
    let counter = 1;
    while (fs.existsSync(finalDest)) {
      const ext = path.extname(destPath);
      const base = destPath.slice(0, -ext.length || undefined);
      finalDest = `${base} (${counter})${ext}`;
      counter++;
    }
    fs.copyFileSync(srcPath, finalDest);
    return path.basename(finalDest);
  } catch { return false; }
});

ipcMain.handle("shell-reveal", async (e, filePath) => {
  shell.showItemInFolder(filePath);
});

// ─── File Watcher ─────────────────────────────────────────────────────────────
const fileWatchers = new Map();
const watchDebounce = new Map();

ipcMain.handle("watch-file", (e, filePath) => {
  if (fileWatchers.has(filePath)) return;
  try {
    const watcher = fs.watch(filePath, (eventType) => {
      if (eventType !== "change") return;
      // Debounce to avoid duplicate events
      clearTimeout(watchDebounce.get(filePath));
      watchDebounce.set(filePath, setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("file-externally-changed", filePath);
        }
      }, 400));
    });
    fileWatchers.set(filePath, watcher);
  } catch { /* non-watchable files are fine */ }
});

ipcMain.handle("unwatch-file", (e, filePath) => {
  const w = fileWatchers.get(filePath);
  if (w) { w.close(); fileWatchers.delete(filePath); }
  clearTimeout(watchDebounce.get(filePath));
  watchDebounce.delete(filePath);
});

// ─── Workspace Files Listing (for Quick Open / Ctrl+P) ───────────────────────
ipcMain.handle("list-workspace-files", async (e, rootPath) => {
  if (!rootPath) return [];
  const SKIP_DIRS = new Set(["node_modules",".git","dist","build",".next","out","coverage",".cache","__pycache__","venv",".venv","target"]);
  const TEXT_EXTS = new Set([
    "txt","js","mjs","cjs","ts","jsx","tsx","html","htm","css","scss","less",
    "json","jsonc","md","markdown","py","rb","php","java","c","h","cpp","cc",
    "cs","go","rs","sh","bash","xml","svg","yaml","yml","sql","env","toml",
    "ini","cfg","conf","lock","gitignore","editorconfig","prettierrc","eslintrc",
  ]);
  const files = [];

  async function walk(dir, depth) {
    if (depth > 10 || files.length >= 2000) return;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= 2000) break;
        if (entry.name.startsWith(".") && entry.name !== ".env" && entry.name !== ".gitignore") continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
        } else {
          const ext = (entry.name.split(".").pop() || "").toLowerCase();
          if (TEXT_EXTS.has(ext) || !entry.name.includes(".")) {
            files.push(full);
          }
        }
      }
    } catch { /* skip unreadable */ }
  }

  await walk(rootPath, 0);
  return files;
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
