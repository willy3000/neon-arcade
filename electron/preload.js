'use strict';
// Exposes a narrow, JSON-only LAN co-op API to the renderer. contextIsolation is on and nodeIntegration is off
// (see main.js), so this is the game's only path to the net/os modules used by electron/net/host.js and guest.js.
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

contextBridge.exposeInMainWorld('BPNet', {
  available: true,
  // Optional relay address for online co-op, for running against a relay without editing blackout/online-config.js.
  relayUrl: (() => { try { return process.env.BP_RELAY_URL || ''; } catch { return ''; } })(),

  listLocalAddresses: () => ipcRenderer.invoke('net:listAddresses'),

  hostStart: (port) => ipcRenderer.invoke('net:hostStart', port),
  hostStop: () => ipcRenderer.invoke('net:hostStop'),
  hostSend: (msg) => ipcRenderer.invoke('net:hostSend', msg),
  // One event channel per role, carrying whatever {type,...} message the host/guest socket produced -
  // including synthetic ones this process adds itself: guestJoined, guestLeft, hostClosed.
  onHostEvent: (cb) => { ipcRenderer.on('net:hostEvent', (_e, data) => cb(data)); },

  guestConnect: (host, port) => ipcRenderer.invoke('net:guestConnect', host, port),
  guestDisconnect: () => ipcRenderer.invoke('net:guestDisconnect'),
  guestSend: (msg) => ipcRenderer.invoke('net:guestSend', msg),
  onGuestEvent: (cb) => { ipcRenderer.on('net:guestEvent', (_e, data) => cb(data)); },
});
