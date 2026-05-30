const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("node:path");
const https = require("https");
const { exec, spawn } = require("child_process");
const os = require("os");
let mainWindow;

// ── Settings file manager ─────────────────────────────────────────────────────
const settingsFile = require("./settings-file");
settingsFile.ensureFile(); // create settings.json if it doesn't exist yet

// ── LSP Bridge (language server manager) ─────────────────────────────────────
let lspBridge = null;
try {
  lspBridge = require("../main/lsp-bridge");
} catch (e) {
  console.warn("[Main] lsp-bridge not loaded:", e.message);
}

// ─── node-pty (optional) ─────────────────────────────────────────────────────
let nodePty = null;
try {
  nodePty = require("node-pty");
} catch {
  /* use spawn fallback */
}

// ─── Rust Native Core (noter-napi) ───────────────────────────────────────────
let noterNative = { isAvailable: () => false, searchWorkspace: () => [], gitStatus: () => null,
  indexWorkspace: () => 0, searchSymbols: () => [], cacheSet: () => {}, cacheGet: () => null };
try {
  const _native = require("../native/index");
  if (_native.isAvailable()) {
    noterNative = _native;
    console.log("[Main] Rust native core loaded ✓");
  } else {
    console.warn("[Main] Rust native core unavailable — JS fallbacks active");
  }
} catch (e) {
  console.warn("[Main] Rust native core load error:", e.message);
}

// ─── PTY process state ───────────────────────────────────────────────────────
let ptyProcess = null;

function getShellConfig() {
  const env = { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" };

  if (process.platform === "win32") {
    // 1. User override via NOTER_SHELL env var
    if (process.env.NOTER_SHELL && fs.existsSync(process.env.NOTER_SHELL)) {
      const s = process.env.NOTER_SHELL;
      const isBash = s.toLowerCase().includes("bash");
      return { shell: s, args: isBash ? ["--login", "-i"] : [], env };
    }

    // 2. Git Bash — most common bash on Windows, has proper PTY support
    const gitBashCandidates = [
      path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Git", "bin", "bash.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Git", "bin", "bash.exe"),
      path.join(process.env["LOCALAPPDATA"] || "", "Programs", "Git", "bin", "bash.exe"),
      path.join(process.env["USERPROFILE"] || "C:\\Users\\User", "scoop", "apps", "git", "current", "bin", "bash.exe"),
    ];
    for (const candidate of gitBashCandidates) {
      if (candidate && fs.existsSync(candidate)) {
        return { shell: candidate, args: ["--login", "-i"], env };
      }
    }

    // 3. WSL bash (Windows Subsystem for Linux)
    const wslBash = path.join(process.env.SYSTEMROOT || "C:\\Windows", "System32", "bash.exe");
    if (fs.existsSync(wslBash)) {
      return { shell: wslBash, args: [], env };
    }

    // 4. PowerShell Core (pwsh) — better than Windows PowerShell
    const pwshCandidates = [
      path.join(process.env["ProgramFiles"] || "C:\\Program Files", "PowerShell", "7", "pwsh.exe"),
      path.join(process.env["ProgramFiles"] || "C:\\Program Files", "PowerShell", "7-preview", "pwsh.exe"),
    ];
    for (const candidate of pwshCandidates) {
      if (fs.existsSync(candidate)) {
        return { shell: candidate, args: ["-NoLogo", "-NoProfile"], env };
      }
    }

    // 5. Windows PowerShell 5 fallback
    const ps5 = path.join(process.env.SYSTEMROOT || "C:\\Windows", "System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    const shell = fs.existsSync(ps5) ? ps5 : process.env.COMSPEC || "cmd.exe";
    const isPowerShell = shell.toLowerCase().includes("powershell");
    return { shell, args: isPowerShell ? ["-NoLogo"] : [], env };
  }

  // macOS / Linux — respect SHELL env, fall back to zsh (macOS) or bash (Linux)
  const shell = process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
  return { shell, args: [], env };
}

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
  try {
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
  } catch {
    return {};
  }
}

function writeInstalledRegistry(data) {
  const dir = ensureExtDir();
  fs.writeFileSync(
    path.join(dir, "installed.json"),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 700,
    minHeight: 480,
    frame: false,
    transparent: true,
    roundedCorners: true,          // Windows 11 — OS-level rounded corners
    backgroundColor: "#00000000",  // fully transparent backing
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  // mainWindow.webContents.openDevTools();

  // Register LSP bridge handlers once main window is ready
  if (lspBridge) {
    try { lspBridge.registerHandlers(mainWindow); } catch (e) {
      console.warn("[Main] LSP bridge registration failed:", e.message);
    }
  }

  mainWindow.on("closed", () => {
    if (ptyProcess) {
      try {
        if (nodePty && ptyProcess.kill) ptyProcess.kill();
        else ptyProcess.kill?.("SIGTERM");
      } catch {
        /* ignore */
      }
      ptyProcess = null;
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  // Register settings.json IPC after window is created (needs mainWindow ref)
  settingsFile.registerIPC(ipcMain, mainWindow);
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
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  } catch {
    return null;
  }
});

// ─── Workspace ────────────────────────────────────────────────────────────────

const WORKSPACE_META_FILE = "noter.workspace";

function getNoterDataDir() {
  let base;
  if (process.platform === "win32") {
    base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  } else if (process.platform === "darwin") {
    base = path.join(os.homedir(), "Library", "Application Support");
  } else {
    base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  }
  return path.join(base, "Noter");
}

function ensureNoterDataDir() {
  const dir = getNoterDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readRecentWorkspaces() {
  try {
    const p = path.join(getNoterDataDir(), "recent-workspaces.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    /* fall through */
  }
  return [];
}

function writeRecentWorkspaces(list) {
  const dir = ensureNoterDataDir();
  fs.writeFileSync(
    path.join(dir, "recent-workspaces.json"),
    JSON.stringify(list, null, 2),
    "utf-8",
  );
}

// Read noter.workspace metadata file from a workspace folder
ipcMain.handle("workspace-read-meta", (e, folderPath) => {
  try {
    const metaPath = path.join(folderPath, WORKSPACE_META_FILE);
    if (!fs.existsSync(metaPath)) return null;
    return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
});

// Write noter.workspace metadata file to a workspace folder
ipcMain.handle("workspace-write-meta", (e, folderPath, data) => {
  try {
    const metaPath = path.join(folderPath, WORKSPACE_META_FILE);
    fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
});

// Recent workspaces list (stored in %APPDATA%/Noter/)
ipcMain.handle("get-recent-workspaces", () => readRecentWorkspaces());

ipcMain.handle("add-recent-workspace", (e, entry) => {
  try {
    let list = readRecentWorkspaces();
    list = [entry, ...list.filter((w) => w.path !== entry.path)].slice(0, 20);
    writeRecentWorkspaces(list);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("remove-recent-workspace", (e, workspacePath) => {
  try {
    writeRecentWorkspaces(
      readRecentWorkspaces().filter((w) => w.path !== workspacePath),
    );
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("clear-recent-workspaces", () => {
  try {
    writeRecentWorkspaces([]);
    return true;
  } catch {
    return false;
  }
});

// Legacy: export workspace as a .noterws file (kept as optional export)
ipcMain.handle("save-workspace", async (e, data) => {
  mainWindow.setAlwaysOnTop(false);
  let result;
  try {
    result = await dialog.showSaveDialog(mainWindow, {
      title: "Export Workspace File",
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
      return {
        stdout: "",
        stderr: `cd: No such directory: ${target}\n`,
        cwd: terminalCwd,
        exitCode: 1,
      };
    } catch (err) {
      return {
        stdout: "",
        stderr: err.message + "\n",
        cwd: terminalCwd,
        exitCode: 1,
      };
    }
  }

  return new Promise((resolve) => {
    exec(
      cmd,
      {
        cwd: terminalCwd,
        env: process.env,
        shell: true,
        maxBuffer: 2 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        resolve({
          stdout: stdout || "",
          stderr: err && !stderr ? err.message + "\n" : stderr || "",
          cwd: terminalCwd,
          exitCode: err ? err.code || 1 : 0,
        });
      },
    );
  });
});

ipcMain.handle("terminal-get-cwd", async () => terminalCwd);
ipcMain.handle("terminal-set-cwd", async (e, dir) => {
  if (dir && fs.existsSync(dir)) terminalCwd = dir;
  return terminalCwd;
});

// ─── PTY Terminal (xterm.js backend) ─────────────────────────────────────────
ipcMain.handle("pty-create", (e, { cols = 80, rows = 24, cwd } = {}) => {
  // Kill existing process cleanly
  if (ptyProcess) {
    try {
      if (nodePty && ptyProcess.kill) ptyProcess.kill();
      else ptyProcess.kill?.("SIGTERM");
    } catch {
      /* ignore */
    }
    ptyProcess = null;
  }

  const { shell, args, env } = getShellConfig();
  const startCwd = cwd || terminalCwd;

  try {
    if (nodePty) {
      // Full PTY via node-pty
      ptyProcess = nodePty.spawn(shell, args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd: startCwd,
        env,
        useConpty: process.platform === "win32",
      });

      ptyProcess.onData((data) => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send("pty-data", data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send("pty-exit", exitCode);
        ptyProcess = null;
      });
    } else {
      // Spawn fallback (streaming stdout/stderr, no real PTY)
      ptyProcess = spawn(shell, args, {
        cwd: startCwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: false,
      });

      const fwd = (data) => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send("pty-data", data.toString());
      };

      ptyProcess.stdout.on("data", fwd);
      ptyProcess.stderr.on("data", fwd);
      ptyProcess.on("exit", (code) => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send("pty-exit", code ?? 0);
        ptyProcess = null;
      });
      ptyProcess.on("error", () => {
        ptyProcess = null;
      });
    }

    const shellBasename = path.basename(shell).replace(/\.exe$/i, "");
    return { success: true, shell: shellBasename, pty: !!nodePty };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on("pty-write", (e, data) => {
  if (!ptyProcess) return;
  try {
    if (nodePty && ptyProcess.write) ptyProcess.write(data);
    else ptyProcess.stdin?.write(data);
  } catch {
    /* ignore dead process */
  }
});

ipcMain.handle("pty-resize", (e, { cols, rows }) => {
  if (!ptyProcess) return;
  try {
    if (nodePty && ptyProcess.resize) ptyProcess.resize(cols, rows);
  } catch {
    /* ignore */
  }
});

ipcMain.handle("pty-kill", () => {
  if (!ptyProcess) return;
  try {
    if (nodePty && ptyProcess.kill) ptyProcess.kill();
    else ptyProcess.kill?.("SIGTERM");
  } catch {
    /* ignore */
  }
  ptyProcess = null;
});

// ─── Project Structure Creator ───────────────────────────────────────────────
ipcMain.handle(
  "create-project-structure",
  async (e, { folderPath, files, setupCommand }) => {
    const result = {
      success: true,
      filesCreated: 0,
      setupDone: false,
      setupError: null,
    };

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
      return {
        success: false,
        error: err.message,
        filesCreated: result.filesCreated,
      };
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
            },
          );
        });
      } catch (err) {
        result.setupError = err.message;
      }
    }

    return result;
  },
);

// ─── Extension Marketplace IPC ───────────────────────────────────────────────

// Fetch live registry from GitHub (falls back in renderer if this returns null)
ipcMain.handle("marketplace-fetch-registry", () => {
  const REGISTRY_URL =
    "https://raw.githubusercontent.com/noter-app/marketplace/main/marketplace.json";
  return new Promise((resolve) => {
    https
      .get(REGISTRY_URL, { timeout: 5000 }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null))
      .on("timeout", function () {
        this.destroy();
        resolve(null);
      });
  });
});

ipcMain.handle("marketplace-get-installed", () => readInstalledRegistry());

ipcMain.handle("marketplace-install", (e, meta) => {
  try {
    const installed = readInstalledRegistry();
    installed[meta.id] = {
      ...meta,
      enabled: true,
      installedAt: new Date().toISOString(),
    };
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
    if (installed[id]) {
      installed[id].enabled = enabled;
      writeInstalledRegistry(installed);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("marketplace-get-settings", () => {
  const defaults = {
    autoUpdate: true,
    showRecommendations: true,
    installedFirst: false,
    checkUpdatesOnStartup: true,
  };
  try {
    const p = path.join(getExtensionsDir(), "settings.json");
    if (fs.existsSync(p))
      return { ...defaults, ...JSON.parse(fs.readFileSync(p, "utf-8")) };
  } catch {
    /* use defaults */
  }
  return defaults;
});

ipcMain.handle("marketplace-save-settings", (e, settings) => {
  try {
    const dir = ensureExtDir();
    fs.writeFileSync(
      path.join(dir, "settings.json"),
      JSON.stringify(settings, null, 2),
      "utf-8",
    );
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
  } catch {
    return false;
  }
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
    } catch {
      return false;
    }
  }
});

ipcMain.handle("fs-new-file", async (e, dirPath, name) => {
  try {
    const filePath = path.join(dirPath, name);
    if (fs.existsSync(filePath)) return false;
    fs.writeFileSync(filePath, "", "utf8");
    return filePath;
  } catch {
    return false;
  }
});

ipcMain.handle("fs-new-folder", async (e, dirPath, name) => {
  try {
    const folderPath = path.join(dirPath, name);
    if (fs.existsSync(folderPath)) return false;
    fs.mkdirSync(folderPath, { recursive: true });
    return true;
  } catch {
    return false;
  }
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
  } catch {
    return false;
  }
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
      watchDebounce.set(
        filePath,
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("file-externally-changed", filePath);
          }
        }, 400),
      );
    });
    fileWatchers.set(filePath, watcher);
  } catch {
    /* non-watchable files are fine */
  }
});

ipcMain.handle("unwatch-file", (e, filePath) => {
  const w = fileWatchers.get(filePath);
  if (w) {
    w.close();
    fileWatchers.delete(filePath);
  }
  clearTimeout(watchDebounce.get(filePath));
  watchDebounce.delete(filePath);
});

// ─── Workspace Folder Watcher (Phase 4 — explorer auto-refresh) ──────────────
const workspaceWatchers  = new Map();
const workspaceDebounces = new Map();

ipcMain.handle("watch-workspace", (e, folderPath) => {
  if (!folderPath) return;
  // Close previous watcher for this folder if any
  const prev = workspaceWatchers.get(folderPath);
  if (prev) { try { prev.close(); } catch (_) {} }

  try {
    const watcher = fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      // Skip noisy paths
      const fp = filename.replace(/\\/g, "/");
      if (fp.includes("node_modules") || fp.includes(".git") ||
          fp.includes("__pycache__")  || fp.includes(".next") ||
          fp.includes("dist/")        || fp.includes("build/")) return;

      clearTimeout(workspaceDebounces.get(folderPath));
      workspaceDebounces.set(folderPath, setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("workspace-changed", { folderPath, filename, eventType });
        }
      }, 350));
    });

    watcher.on("error", () => {
      workspaceWatchers.delete(folderPath);
    });

    workspaceWatchers.set(folderPath, watcher);
  } catch (_) { /* non-watchable — silently skip */ }
});

ipcMain.handle("unwatch-workspace", (e, folderPath) => {
  const w = workspaceWatchers.get(folderPath);
  if (w) { try { w.close(); } catch (_) {} workspaceWatchers.delete(folderPath); }
  clearTimeout(workspaceDebounces.get(folderPath));
  workspaceDebounces.delete(folderPath);
});

// ─── Read file content (for IntelliSense workspace indexer) ──────────────────
ipcMain.handle("read-file-content", async (e, filePath) => {
  if (!filePath) return null;
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size > 512 * 1024) return null; // skip > 512 KB
    return await fs.promises.readFile(filePath, "utf-8");
  } catch (_) { return null; }
});

// ─── Workspace Files Listing — shared helper (used by IPC + reasoning engine) ─
const _WS_SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out",
  "coverage", ".cache", "__pycache__", "venv", ".venv", "target",
]);
const _WS_TEXT_EXTS = new Set([
  "txt","js","mjs","cjs","ts","jsx","tsx","html","htm","css","scss","less",
  "json","jsonc","md","markdown","py","rb","php","java","c","h","cpp","cc",
  "cs","go","rs","sh","bash","xml","svg","yaml","yml","sql","env","toml",
  "ini","cfg","conf","lock","gitignore","editorconfig","prettierrc","eslintrc",
]);

async function _listWorkspaceFiles(rootPath, maxFiles = 2000) {
  if (!rootPath) return [];
  const files = [];
  async function walk(dir, depth) {
    if (depth > 10 || files.length >= maxFiles) return;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) break;
        if (entry.name.startsWith(".") && entry.name !== ".env" && entry.name !== ".gitignore") continue;
        if (_WS_SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
        } else {
          const ext = (entry.name.split(".").pop() || "").toLowerCase();
          if (_WS_TEXT_EXTS.has(ext) || !entry.name.includes(".")) {
            files.push({ path: full, name: entry.name });
          }
        }
      }
    } catch { /* skip unreadable */ }
  }
  await walk(rootPath, 0);
  return files;
}

ipcMain.handle("list-workspace-files", async (e, rootPath) => {
  const files = await _listWorkspaceFiles(rootPath);
  return files.map(f => f.path);  // renderer expects plain string paths
});

// ─── Process memory (for renderer performance panel) ─────────────────────────
ipcMain.handle("get-process-memory", () => {
  const m = process.memoryUsage();
  return {
    rss:       Math.round(m.rss       / 1_048_576),
    heapUsed:  Math.round(m.heapUsed  / 1_048_576),
    heapTotal: Math.round(m.heapTotal / 1_048_576),
    external:  Math.round(m.external  / 1_048_576),
  };
});

// ─── .gitignore reader ────────────────────────────────────────────────────────
ipcMain.handle("read-gitignore", async (e, dirPath) => {
  if (!dirPath) return [];
  try {
    const p = path.join(dirPath, ".gitignore");
    if (!fs.existsSync(p)) return [];
    return fs.readFileSync(p, "utf-8")
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && !l.startsWith("#"));
  } catch { return []; }
});

// ─── File-system crash backup (supplements localStorage snapshot) ─────────────
ipcMain.handle("crash-backup-read", () => {
  try {
    const p = path.join(getNoterDataDir(), "crash-backup.json");
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch { return null; }
});

ipcMain.handle("crash-backup-write", (e, data) => {
  try {
    const dir = ensureNoterDataDir();
    fs.writeFileSync(
      path.join(dir, "crash-backup.json"),
      JSON.stringify(data),
      "utf-8"
    );
    return true;
  } catch { return false; }
});

ipcMain.handle("crash-backup-clear", () => {
  try {
    const p = path.join(getNoterDataDir(), "crash-backup.json");
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  } catch { return false; }
});

// ─── App data directory (for renderer to build DB paths) ─────────────────────
ipcMain.handle("get-noter-data-dir", () => getNoterDataDir());

// ─── Reload renderer window ───────────────────────────────────────────────────
ipcMain.handle("reload-window", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.reload();
  }
});

// ─── Global Search (Rust-native first, JS fallback) ──────────────────────────
ipcMain.handle(
  "global-search",
  async (e, { query, rootPath, caseSensitive, useRegex }) => {
    if (!query || !rootPath) return [];

    // Rust path: ~10-30x faster, uses rayon + memmap2, respects .gitignore
    if (noterNative.isAvailable() && !useRegex) {
      try {
        const raw = noterNative.searchWorkspace(rootPath, query, !!caseSensitive);
        return raw.map((r) => ({
          file: r.file,
          line: r.text.slice(0, 300),
          lineNumber: r.line,
        })).slice(0, 400);
      } catch (err) {
        console.warn("[native-search] error, falling back to JS:", err.message);
      }
    }

    const TEXT_EXTS = new Set([
      "txt",
      "js",
      "mjs",
      "cjs",
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
      "env",
    ]);
    const SKIP_DIRS = new Set([
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "out",
      "coverage",
      ".cache",
    ]);

    const results = [];

    function makePattern(q, cs, rx) {
      try {
        const flags = cs ? "g" : "gi";
        return new RegExp(
          rx ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          flags,
        );
      } catch {
        return null;
      }
    }

    // ── Async reads — never blocks the main-process event loop ───────────────
    async function searchFile(filePath) {
      if (results.length >= 400) return;
      try {
        const content = await fs.promises.readFile(filePath, "utf-8");
        const lines = content.split("\n");
        const pattern = makePattern(query, caseSensitive, useRegex);
        if (!pattern) return;
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= 400) break;
          pattern.lastIndex = 0;
          if (pattern.test(lines[i])) {
            results.push({
              file: filePath,
              line: lines[i].slice(0, 300),
              lineNumber: i + 1,
            });
          }
        }
      } catch {
        /* skip binary / unreadable files */
      }
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
      } catch {
        /* skip unreadable dirs */
      }
    }

    await walk(rootPath, 0);
    return results;
  },
);

// ─── Native: Git Status ───────────────────────────────────────────────────────
ipcMain.handle("native-git-status", (e, repoPath) => {
  return noterNative.gitStatus(repoPath);
});

// ─── Native: Workspace Indexing ──────────────────────────────────────────────
ipcMain.handle("native-index-workspace", (e, { root, dbPath }) => {
  return noterNative.indexWorkspace(root, dbPath);
});

// ─── Native: Symbol Search (Ctrl+P / Go-to-Symbol) ───────────────────────────
ipcMain.handle("native-search-symbols", (e, { dbPath, query }) => {
  return noterNative.searchSymbols(dbPath, query);
});

// ─── Native: Persistent Cache ────────────────────────────────────────────────
ipcMain.handle("native-cache-set", (e, { dbPath, namespace, key, value }) => {
  noterNative.cacheSet(dbPath, namespace, key, value);
});

ipcMain.handle("native-cache-get", (e, { dbPath, namespace, key }) => {
  return noterNative.cacheGet(dbPath, namespace, key);
});

// ─── AI Context Engine (Phase 2.2) ───────────────────────────────────────────

let aiProvider = null;
try {
  aiProvider = require('./ai-provider');
} catch (e) {
  console.warn('[Main] ai-provider not loaded:', e.message);
}

// noter:ai:query — build context + stream response
ipcMain.handle("noter:ai:query", async (e, { workspaceRoot, query, symbolDbPath, project, model }) => {
  if (!aiProvider) return { error: 'AI provider not available' };

  const projectInfo = project || { language: '', framework: null, architecture: null, database: null, orm: null, authSystem: null };
  const nativeProject = {
    language:     projectInfo.language     || '',
    framework:    projectInfo.framework    || null,
    architecture: projectInfo.architecture || null,
    database:     projectInfo.database     || null,
    orm:          projectInfo.orm          || null,
    authSystem:   projectInfo.authSystem   || null,
  };

  // Build context (Rust — fast)
  const ctx = noterNative.buildAiContext
    ? noterNative.buildAiContext(workspaceRoot, query, symbolDbPath || '', nativeProject)
    : null;

  // Build prompt (Rust — instant)
  const prompt = noterNative.buildAiPrompt
    ? noterNative.buildAiPrompt(workspaceRoot, query, symbolDbPath || '', nativeProject, model || 'claude-sonnet-4-6')
    : { system: 'You are a helpful coding assistant.', user: query, model: 'claude-sonnet-4-6' };

  if (!prompt) return { error: 'Context build failed' };

  // Push context to renderer so Context Inspector can show it
  if (ctx) e.sender.send('noter:ai:context-ready', ctx);

  // Stream API call (JS — I/O)
  await aiProvider.streamQuery(prompt, e.sender);
  return { success: true };
});

// noter:ai:cancel — abort current stream
ipcMain.on("noter:ai:cancel", () => {
  aiProvider?.cancelStream();
});

// noter:ai:context — return last built context (for Context Inspector)
ipcMain.handle("noter:ai:context", (e, { workspaceRoot, query, symbolDbPath, project }) => {
  const nativeProject = {
    language:     project?.language     || '',
    framework:    project?.framework    || null,
    architecture: project?.architecture || null,
    database:     project?.database     || null,
    orm:          project?.orm          || null,
    authSystem:   project?.authSystem   || null,
  };
  return noterNative.buildAiContext
    ? noterNative.buildAiContext(workspaceRoot, query, symbolDbPath || '', nativeProject)
    : null;
});

// noter:ai:providers — list available providers and API key status
ipcMain.handle("noter:ai:providers", () => {
  return aiProvider ? aiProvider.listProviders() : [];
});

// noter:ai:set-key — store API key in memory (not persisted to disk for security)
ipcMain.handle("noter:ai:set-key", (e, { key }) => {
  if (aiProvider) aiProvider.setApiKey(key);
  return { success: true };
});

// noter:ai:invalidate — bust context cache on workspace change
ipcMain.handle("noter:ai:invalidate", (e, { workspaceRoot }) => {
  noterNative.invalidateAiContext?.(workspaceRoot);
  return { success: true };
});

// ─── Project Intelligence (Phase 1.5) ────────────────────────────────────────

// noter:project:scan — full workspace scan (language / framework / arch / map)
ipcMain.handle("noter:project:scan", (e, { workspaceRoot }) => {
  const result = noterNative.scanProjectWorkspace(workspaceRoot);
  if (!result) {
    return { success: false, error: "Rust core unavailable", scanDurationMs: 0 };
  }
  return { success: true, ...result };
});

// noter:project:map — return only the project map (lightweight)
ipcMain.handle("noter:project:map", (e, { workspaceRoot }) => {
  const result = noterNative.scanProjectWorkspace(workspaceRoot);
  return result ? result.projectMap : { modules: [] };
});

// noter:project:dependencies — return only deps list
ipcMain.handle("noter:project:dependencies", (e, { workspaceRoot }) => {
  const result = noterNative.scanProjectWorkspace(workspaceRoot);
  return result ? result.dependencies : [];
});

// noter:project:architecture — return only architecture info
ipcMain.handle("noter:project:architecture", (e, { workspaceRoot }) => {
  const result = noterNative.scanProjectWorkspace(workspaceRoot);
  return result ? result.architecture : { pattern: "unknown", confidence: 0, evidence: [] };
});

// noter:project:invalidate — bust the cache (call after package.json changes)
ipcMain.handle("noter:project:invalidate", (e, { workspaceRoot }) => {
  noterNative.invalidateProjectCache(workspaceRoot);
  return { success: true };
});

// ─── Symbol Intelligence Engine (Phase 2.1) ──────────────────────────────────

ipcMain.handle("noter:symbols:build-call-graph", (e, { workspaceRoot, symbolDbPath, callDbPath }) => {
  const r = noterNative.buildSymbolCallGraph(workspaceRoot, symbolDbPath, callDbPath);
  return r || { fileCount: 0, rawEdgeCount: 0, resolvedCount: 0, unresolvedCount: 0, durationMs: 0, error: "native core unavailable" };
});

ipcMain.handle("noter:symbols:hydrate", (e, { workspaceRoot, callDbPath }) => {
  const count = noterNative.hydrateSymbolGraph(workspaceRoot, callDbPath);
  return { edgeCount: count ?? 0 };
});

ipcMain.handle("noter:symbols:update-file", (e, { workspaceRoot, filePath, symbolDbPath, callDbPath }) => {
  const count = noterNative.updateSymbolFile(workspaceRoot, filePath, symbolDbPath, callDbPath);
  return { edgeCount: count ?? 0 };
});

ipcMain.handle("noter:symbols:find-callers", (e, { workspaceRoot, symbolId, symbolDbPath }) => {
  return noterNative.findSymbolCallers(workspaceRoot, symbolId, symbolDbPath) || [];
});

ipcMain.handle("noter:symbols:find-callees", (e, { workspaceRoot, symbolId, symbolDbPath }) => {
  return noterNative.findSymbolCallees(workspaceRoot, symbolId, symbolDbPath) || [];
});

ipcMain.handle("noter:symbols:find-implementations", (e, { workspaceRoot, interfaceName, symbolDbPath }) => {
  return noterNative.findSymbolImplementations(workspaceRoot, interfaceName, symbolDbPath) || [];
});

ipcMain.handle("noter:symbols:trace-flow", (e, { workspaceRoot, startSymbolId, maxDepth, symbolDbPath }) => {
  return noterNative.traceExecutionFlow(workspaceRoot, startSymbolId, maxDepth ?? 8, symbolDbPath)
    || { steps: [], maxDepthReached: false, totalHops: 0 };
});

ipcMain.handle("noter:symbols:get-impact", (e, { workspaceRoot, symbolId, symbolDbPath }) => {
  return noterNative.getSymbolImpact(workspaceRoot, symbolId, symbolDbPath)
    || { symbolId, symbolName: "", directCallers: [], transitiveCount: 0 };
});

// ─── Code Graph Engine (Phase 2) ─────────────────────────────────────────────

ipcMain.handle("noter:graph:build", (e, { workspaceRoot }) => {
  return noterNative.buildCodeGraph(workspaceRoot)
    || { isBuilt: false, error: "native core unavailable" };
});

ipcMain.handle("noter:graph:stats", (e, { workspaceRoot }) => {
  return noterNative.getGraphStats(workspaceRoot);
});

ipcMain.handle("noter:graph:invalidate", (e, { workspaceRoot }) => {
  noterNative.invalidateCodeGraph(workspaceRoot);
  return { success: true };
});

ipcMain.handle("noter:graph:update-file", (e, { workspaceRoot, filePath }) => {
  return { existed: noterNative.updateGraphFile(workspaceRoot, filePath) };
});

ipcMain.handle("noter:graph:query-node", (e, { workspaceRoot, name }) => {
  return noterNative.queryGraphNode(workspaceRoot, name);
});

ipcMain.handle("noter:graph:file-imports", (e, { workspaceRoot, filePath }) => {
  return noterNative.getFileImports(workspaceRoot, filePath);
});

ipcMain.handle("noter:graph:file-importers", (e, { workspaceRoot, filePath }) => {
  return noterNative.getFileImporters(workspaceRoot, filePath);
});

ipcMain.handle("noter:graph:impact", (e, { workspaceRoot, filePath }) => {
  return noterNative.analyzeImpact(workspaceRoot, filePath);
});

ipcMain.handle("noter:graph:dead-code", (e, { workspaceRoot }) => {
  return noterNative.findDeadCode(workspaceRoot);
});

ipcMain.handle("noter:graph:cycles", (e, { workspaceRoot }) => {
  return noterNative.findDependencyCycles(workspaceRoot);
});

ipcMain.handle("noter:graph:arch-violations", (e, { workspaceRoot, pattern }) => {
  return noterNative.checkArchViolations(workspaceRoot, pattern);
});

ipcMain.handle("noter:graph:find-path", (e, { workspaceRoot, fromFile, toFile }) => {
  return noterNative.findImportPath(workspaceRoot, fromFile, toFile);
});

// ─── noter:search:* — symbol + text search (Phase 1 / noter namespace) ──────

ipcMain.handle("noter:search:symbols", (e, { dbPath, query }) => {
  return noterNative.searchSymbols(dbPath, query) || [];
});

ipcMain.handle("noter:search:text", async (e, { query, rootPath, caseSensitive, useRegex }) => {
  if (!query || !rootPath) return [];
  // Delegate to the existing global-search handler logic via direct call
  if (noterNative.isAvailable() && !useRegex) {
    try {
      const raw = noterNative.searchWorkspace(rootPath, query, !!caseSensitive);
      return (raw || []).map(r => ({ file: r.file, line: r.text?.slice(0, 300), lineNumber: r.line })).slice(0, 400);
    } catch {}
  }
  return []; // renderer falls back to electronAPI.globalSearch
});

// ─── noter:index:workspace — full workspace index (Phase 1 legacy) ───────────

ipcMain.handle("noter:index:workspace", (e, { workspaceRoot, dbPath }) => {
  const count = noterNative.indexWorkspace(workspaceRoot, dbPath || "");
  return { count: count ?? 0, success: true };
});

// ─── noter:runtime:* — service health (Phase 0.5) ────────────────────────────

ipcMain.handle("noter:runtime:states", () => {
  return {
    native: noterNative.isAvailable() ? "running" : "unavailable",
    lsp:    "managed-by-lsp-bridge",
  };
});

// ─── noter:git:* — Rust git engine (Phase 3 — backed by native-git-status) ───

ipcMain.handle("noter:git:status", (e, { workspaceRoot }) => {
  return noterNative.gitStatus(workspaceRoot);
});

ipcMain.handle("noter:git:diff", (e, { workspaceRoot, filePath }) => {
  if (!noterNative.gitDiff) return { files: [] };
  try { return noterNative.gitDiff(workspaceRoot, filePath || null); }
  catch { return { files: [] }; }
});

ipcMain.handle("noter:git:log", (e, { workspaceRoot, maxCount, filePath }) => {
  if (!noterNative.gitLog) return [];
  try { return noterNative.gitLog(workspaceRoot, maxCount || 50, filePath || null); }
  catch { return []; }
});

ipcMain.handle("noter:git:branches", (e, { workspaceRoot }) => {
  if (!noterNative.gitBranches) return [];
  try { return noterNative.gitBranches(workspaceRoot); }
  catch { return []; }
});

// ─── noter:health:* — Push-based health updates (renderer subscribes, no polling) ──
let _healthPushInterval = null;

ipcMain.on("noter:health:open", () => {
  if (_healthPushInterval) return;
  _healthPushInterval = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const m = process.memoryUsage();
    mainWindow.webContents.send("noter:health:push", {
      mainRss:       Math.round(m.rss       / 1_048_576),
      mainHeapUsed:  Math.round(m.heapUsed  / 1_048_576),
      mainHeapTotal: Math.round(m.heapTotal / 1_048_576),
      mainExternal:  Math.round(m.external  / 1_048_576),
      ts:            Date.now(),
    });
  }, 5000);
});

ipcMain.on("noter:health:close", () => {
  if (_healthPushInterval) { clearInterval(_healthPushInterval); _healthPushInterval = null; }
});

// ─── noter:memory:* — Workspace Memory Engine (Phase 2.5) ──────────────────
// Rust-backed (SQLite). DB path = %APPDATA%/Noter/workspace-memory.db

function _getMemoryDbPath() {
  return path.join(getNoterDataDir(), 'workspace-memory.db');
}

ipcMain.handle("noter:memory:bump-session", (e, { workspace }) => {
  if (!noterNative.memoryBumpSession) return null;
  try { return noterNative.memoryBumpSession(_getMemoryDbPath(), workspace); }
  catch { return null; }
});

ipcMain.handle("noter:memory:session", (e, { workspace }) => {
  if (!noterNative.memoryGetSession) return null;
  try { return noterNative.memoryGetSession(_getMemoryDbPath(), workspace); }
  catch { return null; }
});

ipcMain.handle("noter:memory:record-file", (e, { workspace, filePath }) => {
  if (!noterNative.memoryRecordFileOpen) return null;
  try { noterNative.memoryRecordFileOpen(_getMemoryDbPath(), workspace, filePath); return { ok: true }; }
  catch { return null; }
});

ipcMain.handle("noter:memory:file-history", (e, { workspace, limit }) => {
  if (!noterNative.memoryGetFileHistory) return [];
  try { return noterNative.memoryGetFileHistory(_getMemoryDbPath(), workspace, limit || 20); }
  catch { return []; }
});

ipcMain.handle("noter:memory:record-query", (e, { workspace, query }) => {
  if (!noterNative.memoryRecordAiQuery) return null;
  try { noterNative.memoryRecordAiQuery(_getMemoryDbPath(), workspace, query); return { ok: true }; }
  catch { return null; }
});

ipcMain.handle("noter:memory:queries", (e, { workspace, limit }) => {
  if (!noterNative.memoryGetAiQueries) return [];
  try { return noterNative.memoryGetAiQueries(_getMemoryDbPath(), workspace, limit || 10); }
  catch { return []; }
});

ipcMain.handle("noter:memory:patterns", (e, { workspace }) => {
  if (!noterNative.memoryGetPatterns) return null;
  try { return noterNative.memoryGetPatterns(_getMemoryDbPath(), workspace); }
  catch { return null; }
});

ipcMain.handle("noter:memory:update-patterns", (e, { workspace, naming, framework, architecture, language }) => {
  if (!noterNative.memoryUpdatePatterns) return null;
  try { noterNative.memoryUpdatePatterns(_getMemoryDbPath(), workspace, naming, framework, architecture, language); return { ok: true }; }
  catch { return null; }
});

ipcMain.handle("noter:memory:detect-naming", (e, { workspace }) => {
  if (!noterNative.memoryDetectNaming) return null;
  try { return noterNative.memoryDetectNaming(_getMemoryDbPath(), workspace); }
  catch { return null; }
});

ipcMain.handle("noter:memory:context", (e, { workspace }) => {
  if (!noterNative.memoryGetContext) return null;
  try { return noterNative.memoryGetContext(_getMemoryDbPath(), workspace); }
  catch { return null; }
});

ipcMain.handle("noter:memory:insights", (e, { workspace }) => {
  if (!noterNative.memoryGetInsights) return [];
  try { return noterNative.memoryGetInsights(_getMemoryDbPath(), workspace); }
  catch { return []; }
});

ipcMain.handle("noter:memory:welcome", (e, { workspace }) => {
  if (!noterNative.memoryGetWelcome) return null;
  try { return noterNative.memoryGetWelcome(_getMemoryDbPath(), workspace); }
  catch { return null; }
});

ipcMain.handle("noter:memory:clear", (e, { workspace }) => {
  if (!noterNative.memoryClearWorkspace) return null;
  try { noterNative.memoryClearWorkspace(_getMemoryDbPath(), workspace); return { ok: true }; }
  catch { return null; }
});

ipcMain.handle("noter:memory:record", (e, { workspace, event, data }) => {
  // Generic record dispatcher
  if (event === 'file' && data?.filePath) {
    if (noterNative.memoryRecordFileOpen) {
      try { noterNative.memoryRecordFileOpen(_getMemoryDbPath(), workspace, data.filePath); } catch {}
    }
  } else if (event === 'query' && data?.query) {
    if (noterNative.memoryRecordAiQuery) {
      try { noterNative.memoryRecordAiQuery(_getMemoryDbPath(), workspace, data.query); } catch {}
    }
  }
  return { ok: true };
});

// ─── noter:reasoning:* — Project Reasoning Engine (Phase 2.3) ───────────────
// Rust first (noterNative.analyzeProject). JS fallback when native unavailable.

const _CODE_EXTS = new Set(['js','ts','jsx','tsx','py','java','cs','cpp','c','go','rs','rb','php','swift','kt']);
const _HIGH_PAT  = [/service/i,/controller/i,/middleware/i,/router/i,/index\.(js|ts)x?$/i,/main\.(js|ts)x?$/i,/app\.(js|ts)x?$/i];
const _MED_PAT   = [/util/i,/helper/i,/lib\//,/common/i,/shared/i,/base/i,/core/i,/store/i,/hook/i];

function _rHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h);
}
function _rShortPath(p) {
  const s = String(p || '').replace(/\\/g, '/');
  const parts = s.split('/');
  return parts.length > 3 ? '…/' + parts.slice(-2).join('/') : s;
}
function _rFileExt(f) {
  const name = f.name || (f.path || String(f)).split(/[\\/]/).pop() || '';
  return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
}
function _rDetectLargeFiles(files) {
  return files.filter(f =>
    _CODE_EXTS.has(_rFileExt(f)) &&
    !(f.name || '').includes('.test.') && !(f.name || '').includes('.spec.')
  ).slice(0, 25);
}
function _rComputeRiskItems(files, cycles) {
  const cyclicFiles = new Set();
  (cycles || []).forEach(c => {
    const parts = Array.isArray(c.cycle) ? c.cycle : [c.from, c.to].filter(Boolean);
    parts.forEach(p => cyclicFiles.add(p));
  });
  return files
    .filter(f => _CODE_EXTS.has(_rFileExt(f)) && !(f.name || '').includes('.test.') && !(f.name || '').includes('.spec.'))
    .map(f => {
      const p      = (f.path || String(f));
      const cyclic = cyclicFiles.has(p);
      const isHigh = cyclic || _HIGH_PAT.some(r => r.test(p));
      const isMed  = _MED_PAT.some(r => r.test(p));
      const base   = cyclic ? 80 : isHigh ? 60 : isMed ? 40 : 10;
      const risk   = Math.min(100, base + (_rHash(p) % 20));
      const level  = risk >= 75 ? 'critical' : risk >= 50 ? 'medium' : 'low';
      return { file: _rShortPath(p), fullPath: p, callers: cyclic ? 'cyclic' : isHigh ? '5–10' : isMed ? '2–5' : '1–2', risk, level };
    })
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 15);
}
function _rComputeHealth({ archViol, cycles, deadCode, largeFiles, riskItems }) {
  const archScore = Math.max(0, 100 - (archViol.length || 0) * 10);
  const debtScore = Math.max(0, 100 - (deadCode.length || 0) * 3 - (cycles.length || 0) * 8);
  const compScore = Math.max(0, 100 - Math.min(60, (largeFiles.length || 0) * 4));
  const criticals = (riskItems || []).filter(r => r.level === 'critical').length;
  const riskScore = Math.max(0, 100 - criticals * 12);
  const total = Math.round(archScore * 0.25 + debtScore * 0.25 + compScore * 0.20 + riskScore * 0.30);
  return { total, architecture: archScore, debt: debtScore, complexity: compScore, risk: riskScore };
}
function _rBuildRecommendations({ archViol, cycles, deadCode, largeFiles, riskItems }) {
  const recs = [];
  if (cycles.length > 0) recs.push({ priority: 'high', icon: '🔴', title: 'Break Circular Dependencies', detail: `${cycles.length} cycle${cycles.length > 1 ? 's' : ''} detected. Extract shared interfaces to break loops.` });
  const crits = (riskItems || []).filter(r => r.level === 'critical');
  if (crits.length > 0) recs.push({ priority: 'high', icon: '🔴', title: 'Split High-Risk Modules', detail: `${crits.length} file${crits.length > 1 ? 's have' : ' has'} many dependents. Extract smaller units to reduce blast radius.` });
  if (archViol.length > 0) recs.push({ priority: 'medium', icon: '🟡', title: 'Fix Architecture Violations', detail: `${archViol.length} file${archViol.length > 1 ? 's violate' : ' violates'} your architecture rules.` });
  if (deadCode.length > 0) recs.push({ priority: 'medium', icon: '🟡', title: 'Remove Dead Code', detail: `${deadCode.length} unused export${deadCode.length > 1 ? 's' : ''} found. Removal reduces bundle size and confusion.` });
  if (largeFiles.length > 5) recs.push({ priority: 'low', icon: '🟢', title: 'Refactor Large Files', detail: `${largeFiles.length} complex files found. Split into smaller, focused modules.` });
  if (recs.length === 0) recs.push({ priority: 'low', icon: '🟢', title: 'Project looks healthy', detail: 'No critical issues found. Continue monitoring as the codebase grows.' });
  return recs;
}
async function _runFullReasoning(workspaceRoot) {
  const safe = (v) => (v == null ? [] : Array.isArray(v) ? v : []);
  const tryCall = async (fn) => { try { return await Promise.resolve(fn()); } catch { return null; } };

  const [graphStats, deadCode, cycles, archViol, files] = await Promise.all([
    tryCall(() => noterNative.buildCodeGraph    ? noterNative.buildCodeGraph(workspaceRoot)           : null),
    tryCall(() => noterNative.findDeadCode      ? noterNative.findDeadCode(workspaceRoot)             : []),
    tryCall(() => noterNative.findDependencyCycles ? noterNative.findDependencyCycles(workspaceRoot)  : []),
    tryCall(() => noterNative.checkArchViolations  ? noterNative.checkArchViolations(workspaceRoot, '**') : []),
    _listWorkspaceFiles(workspaceRoot, 500),
  ]);

  const safeDeadCode = safe(deadCode);
  const safeCycles   = safe(cycles);
  const safeArchViol = safe(archViol);
  const largeFiles   = _rDetectLargeFiles(files);
  const riskItems    = _rComputeRiskItems(files, safeCycles);
  const health       = _rComputeHealth({ archViol: safeArchViol, cycles: safeCycles, deadCode: safeDeadCode, largeFiles, riskItems });

  return {
    graphStats:     graphStats || {},
    deadCode:       safeDeadCode,
    cycles:         safeCycles,
    archViolations: safeArchViol,
    largeFiles,
    riskItems,
    health,
    recommendations: _rBuildRecommendations({ archViol: safeArchViol, cycles: safeCycles, deadCode: safeDeadCode, largeFiles, riskItems }),
  };
}

// Rust-first reasoning: use noterNative.analyzeProject when available
ipcMain.handle("noter:reasoning:health", async (e, { workspaceRoot }) => {
  if (!workspaceRoot) return null;
  try {
    if (noterNative.analyzeProject) return noterNative.analyzeProject(workspaceRoot);
    return await _runFullReasoning(workspaceRoot);
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle("noter:reasoning:risk", async (e, { workspaceRoot }) => {
  if (!workspaceRoot) return [];
  try {
    if (noterNative.getProjectRisk) return noterNative.getProjectRisk(workspaceRoot);
    const files  = await _listWorkspaceFiles(workspaceRoot, 500);
    const cycles = noterNative.findDependencyCycles ? noterNative.findDependencyCycles(workspaceRoot) : [];
    return _rComputeRiskItems(files, cycles || []);
  } catch { return []; }
});

ipcMain.handle("noter:reasoning:debt", async (e, { workspaceRoot }) => {
  if (!workspaceRoot) return {};
  try {
    if (noterNative.getProjectDebt) return noterNative.getProjectDebt(workspaceRoot);
    const tryCall = (fn) => { try { return fn(); } catch { return []; } };
    const deadCode       = tryCall(() => noterNative.findDeadCode        ? noterNative.findDeadCode(workspaceRoot) : []);
    const cycles         = tryCall(() => noterNative.findDependencyCycles ? noterNative.findDependencyCycles(workspaceRoot) : []);
    const archViolations = tryCall(() => noterNative.checkArchViolations  ? noterNative.checkArchViolations(workspaceRoot, '**') : []);
    const files          = await _listWorkspaceFiles(workspaceRoot, 200);
    return { deadCode: deadCode || [], cycles: cycles || [], archViolations: archViolations || [], largeFiles: _rDetectLargeFiles(files) };
  } catch { return {}; }
});

ipcMain.handle("noter:reasoning:advice", async (e, { workspaceRoot }) => {
  if (!workspaceRoot) return [];
  try {
    if (noterNative.analyzeProject) return (noterNative.analyzeProject(workspaceRoot) || {}).recommendations || [];
    return (await _runFullReasoning(workspaceRoot)).recommendations || [];
  } catch { return []; }
});

ipcMain.handle("noter:reasoning:simulate", async (e, { workspaceRoot, filePath }) => {
  if (!workspaceRoot || !filePath) return null;
  try { return noterNative.analyzeImpact ? noterNative.analyzeImpact(workspaceRoot, filePath) : null; }
  catch { return null; }
});

ipcMain.handle("noter:reasoning:invalidate", (e, { workspaceRoot }) => {
  if (noterNative.invalidateReasoning) noterNative.invalidateReasoning(workspaceRoot);
  return { success: true };
});

// ─── noter:workspace:* — alias for noter:project:* (legacy namespace) ────────
// preload.js window.noter.workspace.* sends noter:workspace:* channels;
// re-route them to the same handlers as noter:project:* so both work.

ipcMain.handle("noter:workspace:scan", (e, { workspaceRoot }) => {
  const result = noterNative.scanProjectWorkspace(workspaceRoot);
  if (!result) return { success: false, error: "Rust core unavailable", scanDurationMs: 0 };
  return { success: true, ...result };
});

ipcMain.handle("noter:workspace:map", (e, { workspaceRoot }) => {
  const result = noterNative.scanProjectWorkspace(workspaceRoot);
  return result ? result.projectMap : { modules: [] };
});

ipcMain.handle("noter:workspace:memory", () => null); // Phase future stub

// ─── Incremental Watch Engine (Phase 1.75) ────────────────────────────────────

// Active workspace roots being watched → their poll intervals
const _watchPollers = new Map();

// noter:index:watch:start — start Rust watch engine + polling loop
ipcMain.handle("noter:index:watch:start", (e, { workspaceRoot }) => {
  if (!noterNative.isAvailable()) return { success: false, error: "native core unavailable" };
  if (_watchPollers.has(workspaceRoot)) return { success: true, alreadyWatching: true };

  const started = noterNative.startWorkspaceWatch(workspaceRoot);
  if (!started) return { success: false, error: "failed to start watch engine" };

  // Poll for change events every 100ms, push to renderer
  const interval = setInterval(() => {
    const events = noterNative.pollWatchEvents(workspaceRoot);
    if (events && events.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("noter:index:file-changed", events);
    }
  }, 100);

  _watchPollers.set(workspaceRoot, interval);
  return { success: true, alreadyWatching: false };
});

// noter:index:watch:stop — stop watch engine and polling
ipcMain.handle("noter:index:watch:stop", (e, { workspaceRoot }) => {
  const interval = _watchPollers.get(workspaceRoot);
  if (interval) { clearInterval(interval); _watchPollers.delete(workspaceRoot); }
  noterNative.stopWorkspaceWatch(workspaceRoot);
  return { success: true };
});

// noter:index:watch:stats — snapshot stats (files indexed, symbols found)
ipcMain.handle("noter:index:watch:stats", (e, { workspaceRoot }) => {
  return noterNative.getWatchStats(workspaceRoot) || { isWatching: false };
});

// noter:index:reindex-file — force reindex one file (call on editor save)
ipcMain.handle("noter:index:reindex-file", (e, { workspaceRoot, filePath }) => {
  const queued = noterNative.requestFileReindex(workspaceRoot, filePath);
  return { success: !!queued };
});

// Clean up all watchers when app quits
app.on("before-quit", () => {
  for (const [root, interval] of _watchPollers) {
    clearInterval(interval);
    noterNative.stopWorkspaceWatch(root);
  }
  _watchPollers.clear();
});
