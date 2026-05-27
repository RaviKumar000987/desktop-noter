let currentFilePath = null;
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
    fontSize: 18,
    fontFamily: "Dank Mono",
    lineHeight: 38, // line gap
    padding: {
      top: 20,
      bottom: 20,
    },
    minimap: {
      enabled: true,
    },
    wordWrap: "on",
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
