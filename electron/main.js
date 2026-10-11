'use strict';
// Blackout Protocol loads its atlases/audio with XHR and explicitly refuses to run from a
// file:// URL (see blackout/game.js, the 'CANNOT RUN FROM A LOCAL FILE' loaderror message).
// Chromium blocks those local XHR reads under file://, so this shell serves the unmodified
// game over a loopback HTTP server instead of using win.loadFile()/file://.
const { app, BrowserWindow, Menu } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const GAME_ROOT = path.join(__dirname, '..');
const ENTRY = 'blackout-protocol.html';

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain', '.md': 'text/markdown',
};

let server;
let mainWindow;

function startLocalServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let requestPath;
      try {
        requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch {
        res.writeHead(400).end();
        return;
      }
      const filePath = path.join(GAME_ROOT, requestPath === '/' ? ENTRY : requestPath);
      if (!filePath.startsWith(GAME_ROOT + path.sep) && filePath !== GAME_ROOT) {
        res.writeHead(403).end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end();
          return;
        }
        res.setHeader('Content-Type', MIME_TYPES[path.extname(filePath)] || 'application/octet-stream');
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

async function createWindow() {
  const port = await startLocalServer();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#151915',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadURL(`http://127.0.0.1:${port}/${ENTRY}`);

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
