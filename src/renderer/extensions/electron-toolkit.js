// ─── Electron Toolkit ────────────────────────────────────────────
(window._exts = window._exts || {})['electron-toolkit'] = (() => {
  'use strict';
  let _disposables = [];

  const SNIPS = [
    { label:'ipcMain',      detail:'ipcMain.handle',         insertText:"ipcMain.handle('${1:channel}', async (event, ${2:args}) => {\n  try {\n    ${3:// handler code}\n    return { success: true, data: ${4:result} };\n  } catch (err) {\n    return { success: false, error: err.message };\n  }\n});" },
    { label:'ipcRenderer',  detail:'ipcRenderer.invoke',     insertText:"const ${1:result} = await window.electronAPI.${2:channelName}(${3:args});" },
    { label:'contextBridge',detail:'contextBridge.exposeInMainWorld', insertText:"contextBridge.exposeInMainWorld('electronAPI', {\n  ${1:methodName}: (${2:args}) => ipcRenderer.invoke('${3:channel}', ${2:args}),\n});" },
    { label:'BrowserWindow',detail:'new BrowserWindow',      insertText:"const win = new BrowserWindow({\n  width: ${1:1280},\n  height: ${2:800},\n  frame: ${3:false},\n  webPreferences: {\n    preload: path.join(__dirname, 'preload.js'),\n    nodeIntegration: false,\n    contextIsolation: true,\n  },\n});\nwin.loadFile(path.join(__dirname, '${4:../renderer/index.html}'));" },
    { label:'dialog',       detail:'showOpenDialog',         insertText:"const result = await dialog.showOpenDialog(mainWindow, {\n  properties: ['${1:openFile}'],\n  filters: [{ name: '${2:Files}', extensions: ['${3:*}'] }],\n});\nif (!result.canceled) {\n  const filePath = result.filePaths[0];\n  ${4}\n}" },
    { label:'shell',        detail:'shell.openExternal',     insertText:"await shell.openExternal('${1:https://example.com}');" },
    { label:'app',          detail:'app.whenReady',          insertText:"app.whenReady().then(() => {\n  ${1:createWindow}();\n  app.on('activate', () => {\n    if (BrowserWindow.getAllWindows().length === 0) ${1:createWindow}();\n  });\n});\n\napp.on('window-all-closed', () => {\n  if (process.platform !== 'darwin') app.quit();\n});" },
    { label:'menu',         detail:'Menu.buildFromTemplate',  insertText:"const menu = Menu.buildFromTemplate([\n  {\n    label: '${1:File}',\n    submenu: [\n      { label: '${2:New}', accelerator: 'CmdOrCtrl+N', click: () => ${3} },\n      { type: 'separator' },\n      { role: 'quit' },\n    ],\n  },\n]);\nMenu.setApplicationMenu(menu);" },
    { label:'tray',         detail:'Tray icon setup',         insertText:"const tray = new Tray(path.join(__dirname, '${1:icon.png}'));\ntray.setToolTip('${2:My App}');\ntray.setContextMenu(Menu.buildFromTemplate([\n  { label: '${3:Show}', click: () => mainWindow.show() },\n  { label: 'Quit', role: 'quit' },\n]));" },
    { label:'autoUpdater',  detail:'autoUpdater setup',       insertText:"autoUpdater.checkForUpdatesAndNotify();\nautoUpdater.on('update-downloaded', () => {\n  dialog.showMessageBox({ type: 'info', message: 'Update ready', detail: 'Restart to apply' })\n    .then(() => autoUpdater.quitAndInstall());\n});" },
    { label:'preload',      detail:'Full preload template',   insertText:"const { contextBridge, ipcRenderer } = require('electron');\n\ncontextBridge.exposeInMainWorld('electronAPI', {\n  // File ops\n  openFile: () => ipcRenderer.invoke('open-file'),\n  saveFile: (data) => ipcRenderer.invoke('save-file', data),\n  // Window controls\n  minimize: () => ipcRenderer.send('window-minimize'),\n  maximize: () => ipcRenderer.send('window-maximize'),\n  close:    () => ipcRenderer.send('window-close'),\n});" },
    { label:'csp',          detail:'CSP meta tag (secure)',   insertText:'<meta http-equiv="Content-Security-Policy"\n  content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\';">' },
  ];

  function activate() {
    ['javascript','typescript'].forEach(lang => {
      _disposables.push(
        monaco.languages.registerCompletionItemProvider(lang, {
          provideCompletionItems(model, pos) {
            const word = model.getWordUntilPosition(pos);
            const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber, startColumn:word.startColumn, endColumn:word.endColumn };
            return { suggestions: SNIPS.map(s => ({ label:s.label, kind:monaco.languages.CompletionItemKind.Snippet, detail:'⚛ Electron — '+s.detail, insertText:s.insertText, insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range })) };
          },
        })
      );
    });
    _disposables.push(
      monaco.languages.registerCompletionItemProvider('html', {
        provideCompletionItems(model, pos) {
          const word = model.getWordUntilPosition(pos);
          const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber, startColumn:word.startColumn, endColumn:word.endColumn };
          return { suggestions: SNIPS.filter(s=>s.label==='csp').map(s => ({ label:s.label, kind:monaco.languages.CompletionItemKind.Snippet, detail:'⚛ Electron — '+s.detail, insertText:s.insertText, insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range })) };
        },
      })
    );
  }

  function deactivate() { _disposables.forEach(d=>d.dispose()); _disposables=[]; }

  function getQuickStart() {
    return {
      icon:'⚛', title:'Electron Toolkit', subtitle:'12 Electron IPC, preload, and security snippets',
      steps:[
        { title:'IPC Snippets', desc:'In a JS/TS file type <kbd>ipcMain</kbd> for a handler, <kbd>ipcRenderer</kbd> for invoke, <kbd>contextBridge</kbd> for the bridge template.' },
        { title:'Full Preload', desc:'Type <kbd>preload</kbd> and Tab for a complete, secure preload.js template with contextBridge and all common APIs.' },
        { title:'BrowserWindow', desc:'Type <kbd>BrowserWindow</kbd> for a secure window with preload and contextIsolation pre-configured.' },
      ],
      shortcuts:[], commands:[],
      tips:['All snippets follow the Electron Security Checklist — contextIsolation:true, nodeIntegration:false.','Use Electron Security Scanner (a separate extension) to audit your app.'],
    };
  }
  return { id:'electron-toolkit', activate, deactivate, getQuickStart, commands:[] };
})();
