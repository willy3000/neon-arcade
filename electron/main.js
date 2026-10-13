'use strict';
// Blackout Protocol loads its atlases/audio with XHR and explicitly refuses to run from a
// file:// URL (see blackout/game.js, the 'CANNOT RUN FROM A LOCAL FILE' loaderror message).
// Chromium blocks those local XHR reads under file://, so this shell serves the unmodified
// game over a loopback HTTP server instead of using win.loadFile()/file://.
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Host, DEFAULT_PORT } = require('./net/host.js');
const { Guest } = require('./net/guest.js');

const GAME_ROOT = path.join(__dirname, '..');
const windowed = process.argv.includes('--windowed') || process.env.BP_WINDOWED === '1';
const ENTRY = 'blackout-protocol.html';

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain', '.md': 'text/markdown',
};

let server;
let mainWindow;
const host = new Host();
const guest = new Guest();

// Save data lives in userData as a flat {key: string} JSON file instead of the renderer's localStorage,
// because localStorage is scoped to the page's origin and startLocalServer() below binds a fresh random
// port every launch - a new origin each time, which silently wiped progress. A file keyed by app.getPath
// survives that. Writes are atomic (temp file + rename) so a crash mid-save can't corrupt it.
function storeFile() {
  return path.join(app.getPath('userData'), 'save-store.json');
}
function readStore() {
  try {
    const data = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
    return (data && typeof data === 'object') ? data : {};
  } catch {
    return {};
  }
}
function writeStore(data) {
  const file = storeFile();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}
// Until it was packaged the game ran under its package name, so its save sat in "blackout-protocol-windows". The first
// time it starts under its proper name with no save of its own, it takes that one along.
function adoptEarlierSave() {
  const file = storeFile();
  const earlier = path.join(app.getPath('appData'), 'blackout-protocol-windows', 'save-store.json');
  try {
    if (fs.existsSync(file) || !fs.existsSync(earlier)) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(earlier, file);
  } catch { /* a missing or unreadable earlier save just means a fresh start */ }
}
function wireStore() {
  adoptEarlierSave();
  ipcMain.on('store:getItem', (event, key) => {
    const value = readStore()[key];
    event.returnValue = typeof value === 'string' ? value : null;
  });
  ipcMain.on('store:setItem', (event, key, value) => {
    try {
      const store = readStore();
      store[key] = value;
      writeStore(store);
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });
}

// LAN co-op IPC: the renderer (preload.js's window.BPNet) only ever sees plain JSON messages:
// hostStart/guestConnect open the socket, hostSend/guestSend write a {type,...} message to it, and
// the host/guestEvent channels deliver every message that arrives, plus synthetic connection-state ones.
function wireNet() {
  ipcMain.handle('net:listAddresses', () => host.localAddresses());

  ipcMain.handle('net:hostStart', async (_e, port) => {
    host.onMessage = (msg) => mainWindow?.webContents.send('net:hostEvent', msg);
    host.onGuestJoined = (msg) => mainWindow?.webContents.send('net:hostEvent', { ...msg, type: 'guestJoined' });
    host.onGuestLeft = () => mainWindow?.webContents.send('net:hostEvent', { type: 'guestLeft' });
    return host.start(port || DEFAULT_PORT);
  });
  ipcMain.handle('net:hostStop', () => host.stop());
  ipcMain.handle('net:hostSend', (_e, msg) => host.send(msg));

  ipcMain.handle('net:guestConnect', async (_e, ip, port) => {
    guest.onMessage = (msg) => mainWindow?.webContents.send('net:guestEvent', msg);
    guest.onClose = () => mainWindow?.webContents.send('net:guestEvent', { type: 'hostClosed' });
    await guest.connect(ip, port || DEFAULT_PORT);
  });
  ipcMain.handle('net:guestDisconnect', () => guest.disconnect());
  ipcMain.handle('net:guestSend', (_e, msg) => guest.send(msg));
}

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
    // Opens full screen; F11 switches to a window of this size and back. Automated runs and development can start in a
    // window instead with --windowed (npm run start:windowed) or BP_WINDOWED=1.
    fullscreen: !windowed,
    width: 1366,
    height: 768,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#151915',
    // The game's own emblem in the title bar and taskbar (the packaged .exe also carries build/icon.ico).
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  Menu.setApplicationMenu(null);
  // Development only: 'electron . --credits=99999' (npm run start:rich) starts with a full wallet for testing the armory.
  const credits = !app.isPackaged && process.argv.map((a) => /^--credits=(\d+)$/.exec(a)).find(Boolean);
  mainWindow.loadURL(`http://127.0.0.1:${port}/${ENTRY}${credits ? '?credits=' + credits[1] : ''}`);

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
}

// Without its own identity Windows files the window under Electron's taskbar entry and shows Electron's icon there.
if (process.platform === 'win32') app.setAppUserModelId('com.neonarcade.blackoutprotocol');

// One copy at a time: two would both write the same save file, and the second to close would undo the first's
// progress. Starting the game again brings the running window to the front instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(() => { wireNet(); wireStore(); createWindow(); });
}

app.on('window-all-closed', () => {
  if (server) server.close();
  host.stop();
  guest.disconnect();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
