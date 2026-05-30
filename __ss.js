const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.whenReady().then(async () => {
  const w = new BrowserWindow({
    width: 1280, height: 800, show: true, frame: false,
    backgroundColor: '#111318',
    webPreferences: {
      preload: path.join(__dirname, 'src/preload/preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });
  w.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  w.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      const img = await w.webContents.capturePage();
      fs.writeFileSync(process.argv[1], img.toPNG());
      app.quit();
    }, 3500);
  });
});