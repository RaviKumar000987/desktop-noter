let currentFilePath = null;
let editorFontSize = 18;
let wordWrapEnabled = true;

require.config({
  paths: {
    vs: "./node_modules/monaco-editor/min/vs",
  },
});

const menuItems = document.querySelectorAll(".menu-item");
const closeAllMenus = () => {
  document.querySelectorAll(".dropdown").forEach((menu) => {
    menu.classList.remove("active");
  });
};

const actions = {
  newFile() {
    document.getElementById("newFile").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  openFile() {
    document.getElementById("openFile").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  saveFile() {
    document.getElementById("saveFile").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  saveAsFile() {
    document.getElementById("saveAsFile").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  undo() {
    document.getElementById("undoAction").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  redo() {
    document.getElementById("redoAction").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  cut() {
    document.getElementById("cutAction").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  copy() {
    document.getElementById("copyAction").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  paste() {
    document.getElementById("pasteAction").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  selectAll() {
    document.getElementById("selectAllAction").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  zoomIn() {
    document.getElementById("zoomIn").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  zoomOut() {
    document.getElementById("zoomOut").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },

  resetZoom() {
    document.getElementById("resetZoom").dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
      }),
    );
  },
};

menuItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.stopPropagation();
    const current = item.querySelector(".dropdown");
    const isOpen = current.classList.contains("active");
    closeAllMenus();
    if (!isOpen) {
      current.classList.add("active");
    }
  });
});
document.addEventListener("click", () => {
  closeAllMenus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllMenus();
  }
});

// monaco editor code
require(["vs/editor/editor.main"], function () {
  window.editor = monaco.editor.create(document.getElementById("editor"), {
    value: "",
    language: "plaintext",
    theme: "vs-dark",
    automaticLayout: true,
    fontSize: editorFontSize,
    fontFamily: "Dank Mono",
    lineHeight: 38, // line gap
    padding: {
      top: 20,
      bottom: 20,
    },
    minimap: {
      enabled: true,
    },
    wordWrap: wordWrapEnabled ? "on" : "off",
    smoothScrolling: true,
    overviewRulerBorder: false,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    renderLineHighlight: "none",
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    roundedSelection: true,
  });

  const wordCounter = document.getElementById("wordCount");
  editor.onDidChangeModelContent(() => {
    const text = window.editor.getValue();
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    wordCounter.textContent = `words: ${words.length}`;
  });

  editor.onDidChangeCursorPosition((e) => {
    const line = e.position.lineNumber;
    const column = e.position.column;
    document.getElementById("cursorPosition").textContent =
      `Ln ${line}, Col ${column}`;
  });
});

// menu ke sub-menus - new, open, save, save as, quit
// new file listener start
document.getElementById("newFile").addEventListener("click", () => {
  if (!window.editor) return;
  const text = window.editor.getValue();
  if (text.trim() != "") {
    const ok = confirm("create new file?");
    if (!ok) return;
  }
  window.editor.setValue("");
  window.editor.setPosition({
    lineNumber: 1,
    column: 1,
  });
  window.editor.focus();
  closeAllMenus();
});
// new file listener end

// open file listener start
document.getElementById("openFile").addEventListener("click", async () => {
  const file = await window.electronAPI.openFile();
  if (!file) return;
  window.editor.setValue(file.content);
  currentFilePath = file.filePath;
  closeAllMenus();
  window.editor.focus();
});
// open file listener end

// save file listener start
document.getElementById("saveFile").addEventListener("click", async () => {
  if (!currentFilePath) {
    alert("Open a file first!");
    return;
  }
  const content = window.editor.getValue();
  const saved = await window.electronAPI.saveFile({
    path: currentFilePath,
    content,
  });
  if (saved) {
    console.log("Saved!");
  }
  closeAllMenus();
});
// save file listener end

// save-as-file listener start
document.getElementById("saveAsFile").addEventListener("click", async () => {
  const content = window.editor.getValue();
  const filePath = await window.electronAPI.saveAsFile(content);
  if (!filePath) return;
  currentFilePath = filePath;
  closeAllMenus();
});
// save-as-file listener end

// quit app start
document.getElementById("quitApp").addEventListener("click", () => {
  window.electronAPI.quit();
});
// quit app end

// view -> zoom in start
document.getElementById("zoomIn").addEventListener("click", () => {
  if (!window.editor) return;
  editorFontSize += 2;
  window.editor.updateOptions({
    fontSize: editorFontSize,
  });
  closeAllMenus();
});
// view -> zoom in end

// view -> zoom out start
document.getElementById("zoomOut").addEventListener("click", () => {
  if (!window.editor) return;
  if (editorFontSize <= 10) {
    return;
  }
  editorFontSize -= 2;
  window.editor.updateOptions({
    fontSize: editorFontSize,
  });
  closeAllMenus();
});
// view -> zoom out end

// view -> reset zoom start
document.getElementById("resetZoom").addEventListener("click", () => {
  if (!window.editor) return;
  editorFontSize = 18;
  window.editor.updateOptions({
    fontSize: editorFontSize,
  });
  closeAllMenus();
});
// view -> reset zoom end

// view -> word wrap start
document.getElementById("wordWrap").addEventListener("click", () => {
  if (!window.editor) return;
  wordWrapEnabled = !wordWrapEnabled;
  window.editor.updateOptions({
    wordWrap: wordWrapEnabled ? "on" : "off",
  });
  closeAllMenus();
});
// view -> word wrap end

// help -> documentation start
document.getElementById("documentation").addEventListener("click", () => {
  window.electronAPI.openExternal(
    "https://github.com/RaviKumar000987/desktop-noter",
  );
  closeAllMenus();
});
// help -> documentation end

// help -> shortcuts start
document.getElementById("shortcuts").addEventListener("click", () => {
  alert(`
    Keyboard shortcuts
    --------------------------
    | Ctrl + N -> New File
    | Ctrl + o -> Open File
    | Ctrl + S -> Save File
    | Esc -> Close Menu
    | View -> Zoom In
    | View -> Zoom Out
    | View -> Reset Zoom
    `);
  closeAllMenus();
});
// help -> shortcuts end

// help -> about start
document.getElementById("aboutApp").addEventListener("click", () => {
  alert(`
   [[ Noter App! ]]

    Version 0.1.5
    Built with:
    1. Electron
    2. Monaco Editor
    3. HTML
    4. CSS
    5. Javascript

    Developer:
    Ravi Kumar - (Sparrow)
    [ Premium Desktop Editor App ]
    `);
  closeAllMenus();
});
// help -> about end

// edit menu -> submenu start
// undo start
document.getElementById("undoAction").addEventListener("click", () => {
  if (!window.editor) return;
  window.editor.trigger("keyboard", "undo", null);
  closeAllMenus();
});
// undo end

// redo start
document.getElementById("redoAction").addEventListener("click", () => {
  if (!window.editor) return;
  window.editor.trigger("keyboard", "redo", null);
  closeAllMenus();
});
// redo end

// cut start
document.getElementById("cutAction").addEventListener("click", () => {
  if (!window.editor) return;
  document.execCommand("copy");
  window.editor.trigger("keyboard", "deleteLeft", null);
  closeAllMenus();
});
// cut end

// copy start
document.getElementById("copyAction").addEventListener("click", () => {
  if (!window.editor) return;
  document.execCommand("copy");
  closeAllMenus();
});
// copy end

// paste start
document.getElementById("pasteAction").addEventListener("click", async () => {
  if (!window.editor) return;
  const text = await navigator.clipboard.readText();
  const selection = window.editor.getSelection();
  window.editor.executeEdits("", [
    {
      range: selection,
      text,
    },
  ]);
  closeAllMenus();
});
// paste end

// select all start
document.getElementById("selectAllAction").addEventListener("click", () => {
  if (!window.editor) return;
  window.editor.focus();
  window.editor.trigger("keyboard", "editor.action.selectAll", null);
  closeAllMenus();
});
// select all end
// edit menu -> submenu end

// minimize, maximize, close functions
document.getElementById("minimize").addEventListener("click", () => {
  window.electronAPI.minimize();
});

document.getElementById("maximize").addEventListener("click", () => {
  window.electronAPI.maximize();
});

document.getElementById("close").addEventListener("click", () => {
  window.electronAPI.close();
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "n") {
    e.preventDefault();
    actions.newFile();
  }

  if (e.ctrlKey && e.key === "o") {
    e.preventDefault();
    actions.openFile();
  }

  if (e.ctrlKey && e.key === "s" && !e.shiftKey) {
    e.preventDefault();
    actions.saveFile();
  }

  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    actions.saveAsFile();
  }

  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    actions.undo();
  }

  if (e.ctrlKey && e.key === "y") {
    e.preventDefault();
    actions.redo();
  }

  if (e.ctrlKey && e.key === "x") {
    e.preventDefault();
    actions.cut();
  }

  if (e.ctrlKey && e.key === "c") {
    e.preventDefault();
    actions.copy();
  }

  if (e.ctrlKey && e.key === "v") {
    e.preventDefault();
    actions.paste();
  }

  if (e.ctrlKey && e.key === "a") {
    e.preventDefault();
    actions.selectAll();
  }

  if (e.ctrlKey && e.key === "=") {
    e.preventDefault();
    actions.zoomIn();
  }

  if (e.ctrlKey && e.key === "-") {
    e.preventDefault();
    actions.zoomOut();
  }

  if (e.ctrlKey && e.key === "0") {
    e.preventDefault();
    actions.resetZoom();
  }
});
