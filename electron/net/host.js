'use strict';
// LAN host side: accepts exactly one guest connection (2-player v1), newline-delimited JSON framing.
const net = require('node:net');
const os = require('node:os');

const DEFAULT_PORT = 47321;

class Host {
  constructor() {
    this.server = null;
    this.socket = null;
    this.buffer = '';
    this.onMessage = null;
    this.onGuestJoined = null;
    this.onGuestLeft = null;
  }

  localAddresses() {
    const out = [];
    for (const ifaces of Object.values(os.networkInterfaces())) {
      for (const i of ifaces || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
    return out;
  }

  start(port = DEFAULT_PORT) {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        if (this.socket) { socket.end(); return; } // exactly one guest for v1
        this.socket = socket;
        this.buffer = '';
        socket.setEncoding('utf8');
        socket.on('data', (chunk) => this._onData(chunk));
        socket.on('close', () => { this.socket = null; this.onGuestLeft?.(); });
        socket.on('error', () => {});
      });
      this.server.on('error', reject);
      this.server.listen(port, '0.0.0.0', () => resolve(this.server.address().port));
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
      if (msg.type === 'hello') this.onGuestJoined?.(msg);
      this.onMessage?.(msg);
    }
  }

  // A message may arrive already serialised (the game does that for its large state updates).
  send(msg) { if (this.socket) this.socket.write((typeof msg === 'string' ? msg : JSON.stringify(msg)) + '\n'); }

  stop() {
    if (this.socket) this.socket.end();
    if (this.server) this.server.close();
    this.server = null;
    this.socket = null;
  }
}

module.exports = { Host, DEFAULT_PORT };
