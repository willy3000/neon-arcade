'use strict';
// Exposes a narrow, JSON-only LAN co-op API to the renderer. contextIsolation is on and nodeIntegration is off
// (see main.js), so this is the game's only path to the net/os modules used by electron/net/host.js and guest.js.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BPNet', {
  available: true,

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
