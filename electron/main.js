'use strict';
// Blackout Protocol loads its atlases/audio with XHR and explicitly refuses to run from a
// file:// URL (see blackout/game.js, the 'CANNOT RUN FROM A LOCAL FILE' loaderror message).
// Chromium blocks those local XHR reads under file://, so this shell serves the unmodified
// game over a loopback HTTP server instead of using win.loadFile()/file://.
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Host, DEFAULT_PORT } = require('./net/host.js');
const { Guest } = require('./net/guest.js');

// Everything is resolved from this file's own location (inside app.asar once packaged), never from the working
// directory: Steam, a shortcut and a double click each start the game with a different one.
const GAME_ROOT = path.join(__dirname, '..');
const windowed = process.argv.includes('--windowed') || process.env.BP_WINDOWED === '1';
const ENTRY = 'blackout-protocol.html';
// The only things the local server hands out: the page itself and the game's own folder.
const SERVED_DIR = path.join(GAME_ROOT, 'blackout') + path.sep;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

// What the page may load and talk to. Scripts, styles, fonts, pictures and sound come only from the game's own files
// (Phaser turns pictures into blob: addresses and the item icons are data: pictures; the interface sets inline styles).
// The one thing that leaves the machine is the co-op connection: a WebSocket to the online relay.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "media-src 'self' blob:", "font-src 'self'", "connect-src 'self' ws: wss:", "object-src 'none'", "base-uri 'none'",
  "form-action 'self'", "frame-src 'none'", "frame-ancestors 'none'",
].join('; ');

// The credit links in the settings dialog. They open in the player's own browser; nothing else may leave the window.
const EXTERNAL_LINKS = new Set(['https://opengameart.org', 'https://creativecommons.org', 'https://kenney.nl']);

// Automated runs keep their save, cache and one-copy-at-a-time lock apart from the player's own with
// --user-data-dir=<folder>. It has to be settled before anything asks where userData is.
{
  const flag = '--user-data-dir=', given = process.argv.find((a) => a.startsWith(flag));
  if (given && given.length > flag.length) app.setPath('userData', path.resolve(given.slice(flag.length)));
}

let server;
let origin = '';
let mainWindow;
const host = new Host();
const guest = new Guest();

// ---------- diagnostics ----------
// Problems are written to a small log in userData (it starts again when it grows past half a megabyte). It holds
// timestamps and error text only; nothing personal and no network addresses.
const LOG_LIMIT = 512 * 1024;
let logged = 0;
function logFile() {
  return path.join(app.getPath('userData'), 'logs', 'blackout.log');
}
function log(kind, detail) {
  const line = `${new Date().toISOString()} [${kind}] ${String(detail).slice(0, 4000)}\n`;
  if (!app.isPackaged) process.stderr.write(line);
  if (++logged > 500) return; // a fault that repeats every frame must not fill the disk
  try {
    const file = logFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try { if (fs.statSync(file).size > LOG_LIMIT) fs.renameSync(file, file + '.old'); } catch { /* no log yet */ }
    fs.appendFileSync(file, line);
  } catch { /* a log that cannot be written must never take the game down with it */ }
}
const describe = (err) => (err && (err.stack || err.message)) || String(err);
// Something the game cannot start or carry on without. The player is told what happened and where the log is, and the
// process ends, rather than leaving a window that never appears while still holding the one-copy lock.
function fatal(what, err) {
  log('fatal', `${what}: ${describe(err)}`);
  try {
    dialog.showErrorBox('Blackout Protocol', `${what}\n\n${(err && err.message) || err || ''}\n\nDetails were saved to:\n${logFile()}`);
  } catch { /* no display to show it on */ }
  app.exit(1);
}
// Once the window is up, an error in this process (a socket callback, a save write) is logged and the game carries on;
// before that there is nothing to carry on with.
process.on('uncaughtException', (err) => {
  if (mainWindow) log('uncaughtException', describe(err));
  else fatal('Blackout Protocol could not start.', err);
});
process.on('unhandledRejection', (reason) => log('unhandledRejection', describe(reason)));

// ---------- save data ----------
// Save data lives in userData as a flat {key: string} JSON file instead of the renderer's localStorage,
// because localStorage is scoped to the page's origin and startLocalServer() below binds a fresh random
// port every launch - a new origin each time, which silently wiped progress. A file keyed by app.getPath
// survives that. Writes are atomic (temp file + rename) so a crash mid-save can't corrupt it, and the save
// it replaces is kept beside it as a spare.
const STORE_KEY = /^[a-z][a-z0-9-]{0,63}$/;
const STORE_VALUE_LIMIT = 1024 * 1024;
let store = null;
function storeFile() {
  return path.join(app.getPath('userData'), 'save-store.json');
}
function parseStore(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not a save store');
  const out = {};
  for (const [key, value] of Object.entries(data)) if (STORE_KEY.test(key) && typeof value === 'string') out[key] = value;
  return out;
}
// Read once and kept in memory. A save that exists but cannot be read is set aside rather than overwritten, and the
// spare from the write before it is used instead.
function readStore() {
  if (store) return store;
  const file = storeFile();
  if (!fs.existsSync(file)) { store = {}; return store; }
  try {
    store = parseStore(file);
  } catch (err) {
    log('save', `save-store.json could not be read (${err.message}); trying the spare copy`);
    try { fs.copyFileSync(file, file + '.unreadable'); } catch { /* best effort */ }
    try { store = parseStore(file + '.bak'); } catch { store = {}; }
  }
  return store;
}
function writeStore(data) {
  const file = storeFile();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data));
  try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch { /* the spare is a convenience */ }
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

// ---------- messages from the page ----------
// Only the game's own page, in the game's own window, may use any of these: a message from anywhere else is refused.
function fromGame(event) {
  const frame = event.senderFrame;
  return !!mainWindow && !!origin && event.sender === mainWindow.webContents && !!frame && frame === mainWindow.webContents.mainFrame && frame.url.startsWith(origin + '/');
}
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!fromGame(event)) throw new Error('refused');
    return fn(...args);
  });
}
function wireStore() {
  adoptEarlierSave();
  ipcMain.on('store:getItem', (event, key) => {
    const value = fromGame(event) && typeof key === 'string' && STORE_KEY.test(key) ? readStore()[key] : null;
    event.returnValue = typeof value === 'string' ? value : null;
  });
  ipcMain.on('store:setItem', (event, key, value) => {
    try {
      if (!fromGame(event) || typeof key !== 'string' || !STORE_KEY.test(key) || typeof value !== 'string' || value.length > STORE_VALUE_LIMIT) throw new Error('refused');
      const next = { ...readStore(), [key]: value };
      writeStore(next);
      store = next;
      event.returnValue = true;
    } catch (err) {
      log('save', `write failed: ${err.message}`);
      event.returnValue = false;
    }
  });
}

// LAN co-op IPC: the renderer (preload.js's window.BPNet) only ever sees plain JSON messages:
// hostStart/guestConnect open the socket, hostSend/guestSend write a {type,...} message to it, and
// the host/guestEvent channels deliver every message that arrives, plus synthetic connection-state ones.
const LAN_ADDRESS = /^[A-Za-z0-9.:-]{1,64}$/;
const lanPort = (port) => (Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : DEFAULT_PORT);
// A message is either an object or text the game has already serialised, and never larger than the sockets accept.
const sendable = (msg) => (typeof msg === 'string' ? msg.length <= Host.MAX_LINE : !!msg && typeof msg === 'object');
function wireNet() {
  handle('net:listAddresses', () => host.localAddresses());

  // Every message from a guest carries "from", the number host.js gave that connection; the game answers one guest
  // by passing it back as "to", or all of them by leaving it out.
  const guestId = (id) => (Number.isInteger(id) && id > 0 ? id : undefined);
  handle('net:hostStart', async (port, max) => {
    host.onMessage = (msg) => mainWindow?.webContents.send('net:hostEvent', msg);
    host.onGuestJoined = (msg) => mainWindow?.webContents.send('net:hostEvent', { ...msg, type: 'guestJoined' });
    host.onGuestLeft = (from) => mainWindow?.webContents.send('net:hostEvent', { type: 'guestLeft', from });
    host.stop(); // a lobby opened twice in a row must not leave the first one holding the port
    return host.start(lanPort(port), max);
  });
  handle('net:hostStop', () => host.stop());
  handle('net:hostSend', (msg, to) => { if (sendable(msg)) host.send(msg, guestId(to)); });
  handle('net:hostLimit', (max) => host.setMax(max));
  handle('net:hostKick', (id) => { if (guestId(id)) host.drop(id); });

  handle('net:guestConnect', async (ip, port) => {
    if (typeof ip !== 'string' || !LAN_ADDRESS.test(ip)) throw new Error('bad address');
    guest.onMessage = (msg) => mainWindow?.webContents.send('net:guestEvent', msg);
    guest.onClose = () => mainWindow?.webContents.send('net:guestEvent', { type: 'hostClosed' });
    await guest.connect(ip, lanPort(port));
  });
  handle('net:guestDisconnect', () => guest.disconnect());
  handle('net:guestSend', (msg) => { if (sendable(msg)) guest.send(msg); });
}
// QUIT on the main menu. Closing the window is what ends the game (see window-all-closed below).
function wireApp() {
  ipcMain.on('app:quit', (event) => { if (fromGame(event)) mainWindow?.close(); });
}

// ---------- the local server ----------
function startLocalServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // The address changes with every launch, so anything Chromium kept from this one would only pile up unused.
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
      // Only this window's own requests are answered: the right method, and the address this server was given.
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
      if (req.headers.host !== `127.0.0.1:${server.address().port}`) { res.writeHead(403).end(); return; }
      let requestPath;
      try {
        requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch {
        res.writeHead(400).end();
        return;
      }
      const filePath = path.join(GAME_ROOT, requestPath === '/' ? ENTRY : requestPath);
      if (requestPath.includes('\0') || (filePath !== path.join(GAME_ROOT, ENTRY) && !filePath.startsWith(SERVED_DIR))) {
        res.writeHead(403).end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end();
          return;
        }
        res.setHeader('Content-Type', MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
        res.end(req.method === 'HEAD' ? undefined : data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

// ---------- the window ----------
const sameOrigin = (url) => { try { return new URL(url).origin === origin; } catch { return false; } };
// The window shows the game and nothing else. It cannot be steered to another address, cannot open further windows,
// and is granted no browser permissions beyond copying a lobby code to the clipboard.
function lockDown(contents) {
  contents.on('will-navigate', (event, url) => { if (!sameOrigin(url)) event.preventDefault(); });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (EXTERNAL_LINKS.has(target.origin)) shell.openExternal(target.href);
    } catch { /* not an address at all */ }
    return { action: 'deny' };
  });
}
function lockPermissions() {
  const allowed = (permission, url) => permission === 'clipboard-sanitized-write' && sameOrigin(url);
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => callback(allowed(permission, details.requestingUrl)));
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) => allowed(permission, requestingOrigin));
}

async function createWindow() {
  const port = await startLocalServer();
  origin = `http://127.0.0.1:${port}`;

  mainWindow = new BrowserWindow({
    // Opens full screen; F11 or Alt+Enter switches to a window of this size and back. Automated runs and development
    // can start in a window instead with --windowed (npm run start:windowed) or BP_WINDOWED=1.
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
      sandbox: true,
      webSecurity: true,
      // The released game has no developer tools to open.
      devTools: !app.isPackaged,
      spellcheck: false,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  Menu.setApplicationMenu(null);
  // Development only: 'electron . --credits=99999' (npm run start:rich) starts with a full wallet for testing the armory.
  const credits = !app.isPackaged && process.argv.map((a) => /^--credits=(\d+)$/.exec(a)).find(Boolean);
  // Development only as well: '--qa' gives the end-to-end tests a handle on the running simulation (window.BPQA).
  const qa = !app.isPackaged && process.argv.includes('--qa');
  // The opening (blackout/intro.js) is left out for anything driving the window through a debugging port, which is
  // how the end-to-end and packaged tests do it, and with --no-intro.
  // '--intro' plays it all the same (blackout/qa/intro-check.cjs measures it that way).
  const intro = process.argv.includes('--intro');
  const nointro = !intro && process.argv.some((a) => a === '--no-intro' || a.startsWith('--remote-debugging-port'));
  const query = [credits ? 'credits=' + credits[1] : '', qa ? 'qa' : '', intro ? 'intro' : '', nointro ? 'nointro' : ''].filter(Boolean).join('&');
  mainWindow.loadURL(`${origin}/${ENTRY}${query ? '?' + query : ''}`).catch(() => { /* reported by did-fail-load */ });

  mainWindow.on('closed', () => { mainWindow = null; });

  const contents = mainWindow.webContents;
  contents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  // The page failing to load, or its process dying, would otherwise leave a blank window with no explanation.
  contents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3) fatal('Blackout Protocol could not load its game files. Reinstalling the game should repair this.', new Error(`${description} (${code})`));
  });
  contents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return;
    log('render-process-gone', `${details.reason} (exit code ${details.exitCode})`);
    const again = dialog.showMessageBoxSync({
      type: 'error', title: 'Blackout Protocol', buttons: ['Restart the game', 'Quit'], defaultId: 0, cancelId: 1,
      message: 'Blackout Protocol stopped unexpectedly.',
      detail: `Progress up to your last checkpoint is saved.\n\nDetails were saved to:\n${logFile()}`,
    }) === 0;
    if (again) app.relaunch();
    app.exit(again ? 0 : 1);
  });
  mainWindow.on('unresponsive', () => log('window', 'unresponsive'));
  // Errors the page reports to its console are kept, so a problem a player runs into can be diagnosed afterwards.
  contents.on('console-message', (_event, level, message, line, source) => {
    if (level >= 3) log('page', `${message} (${String(source).replace(origin, '')}:${line})`);
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
  app.on('web-contents-created', (_event, contents) => lockDown(contents));
  app.on('child-process-gone', (_event, details) => { if (details.reason !== 'clean-exit') log('child-process-gone', `${details.type}: ${details.reason}`); });
  app.whenReady()
    .then(() => { lockPermissions(); wireNet(); wireStore(); wireApp(); return createWindow(); })
    .catch((err) => fatal('Blackout Protocol could not start.', err));
}

app.on('window-all-closed', () => {
  if (server) server.close();
  host.stop();
  guest.disconnect();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (app.isReady() && BrowserWindow.getAllWindows().length === 0) createWindow().catch((err) => fatal('Blackout Protocol could not start.', err));
});
