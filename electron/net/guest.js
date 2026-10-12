'use strict';
// LAN guest side: connects to a host's IP:port, same newline-delimited JSON framing as host.js.
const net = require('node:net');

const CONNECT_TIMEOUT_MS = 6000;

class Guest {
  constructor() {
    this.socket = null;
    this.buffer = '';
    this.onMessage = null;
    this.onClose = null;
  }

  connect(host, port) {
    return new Promise((resolve, reject) => {
      let settled = false;
      // A wrong address on a LAN usually just never answers; give up well before the OS's own ~20s timeout.
      const timer = setTimeout(() => { if (!settled) { settled = true; socket.destroy(); reject(new Error('timed out')); } }, CONNECT_TIMEOUT_MS);
      const socket = net.createConnection({ host, port }, () => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;
        this.socket = socket;
        resolve();
      });
      this.buffer = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => this._onData(chunk));
      socket.on('close', () => { this.socket = null; this.onClose?.(); });
      socket.on('error', (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } });
    });
  }

  _onData(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      this.onMessage?.(msg);
    }
  }

  send(msg) { if (this.socket) this.socket.write(JSON.stringify(msg) + '\n'); }

  disconnect() { if (this.socket) this.socket.end(); this.socket = null; }
}

module.exports = { Guest };
