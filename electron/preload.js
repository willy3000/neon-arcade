'use strict';
// Exposes a narrow, JSON-only LAN co-op API to the renderer. contextIsolation is on, nodeIntegration is off and the
// page is sandboxed (see main.js), so this is the game's only path to the net/os modules used by electron/net/host.js
// and guest.js. main.js checks every call made through it: who sent it, and what it carries.
const { contextBridge, ipcRenderer } = require('electron');

// A synchronous, localStorage-shaped store backed by a file in userData (see main.js's wireStore) instead
// of the renderer's real localStorage, which is scoped to the page's origin - and that origin's port
// changes every launch (startLocalServer in main.js binds port 0), so localStorage looked empty each time.
// game.js picks this up automatically: it only uses window.localStorage when window.BPStore is absent.
contextBridge.exposeInMainWorld('BPStore', {
  getItem: (key) => ipcRenderer.sendSync('store:getItem', key),
  setItem: (key, value) => {
    if (!ipcRenderer.sendSync('store:setItem', key, value)) throw new Error('BPStore write failed');
  },
});

// What only the desktop app can do for the page. Its presence is also how the page knows it is running as an
// installed game rather than in a browser tab (game.js shows QUIT on the main menu only then).
contextBridge.exposeInMainWorld('BPDesktop', {
  quit: () => ipcRenderer.send('app:quit'),
});

contextBridge.exposeInMainWorld('BPNet', {
  available: true,
  // Optional relay address for online co-op, for running against a relay without editing blackout/online-config.js.
  relayUrl: (() => { try { return process.env.BP_RELAY_URL || ''; } catch { return ''; } })(),

  listLocalAddresses: () => ipcRenderer.invoke('net:listAddresses'),

  // "max" is how many guests may connect (1 for two-player co-op, up to 3 for a four-player squad); hostLimit changes
  // it while the lobby is open. hostSend reaches every guest, or only the one whose number is passed as "to" - the
  // number each of their messages arrives with as "from". hostKick ends that guest's connection.
  hostStart: (port, max) => ipcRenderer.invoke('net:hostStart', port, max),
  hostStop: () => ipcRenderer.invoke('net:hostStop'),
  hostSend: (msg, to) => ipcRenderer.invoke('net:hostSend', msg, to),
  hostLimit: (max) => ipcRenderer.invoke('net:hostLimit', max),
  hostKick: (id) => ipcRenderer.invoke('net:hostKick', id),
  // One event channel per role, carrying whatever {type,...} message the host/guest socket produced -
  // including synthetic ones this process adds itself: guestJoined, guestLeft, hostClosed.
  onHostEvent: (cb) => { ipcRenderer.on('net:hostEvent', (_e, data) => cb(data)); },

  guestConnect: (host, port) => ipcRenderer.invoke('net:guestConnect', host, port),
  guestDisconnect: () => ipcRenderer.invoke('net:guestDisconnect'),
  guestSend: (msg) => ipcRenderer.invoke('net:guestSend', msg),
  onGuestEvent: (cb) => { ipcRenderer.on('net:guestEvent', (_e, data) => cb(data)); },
});
