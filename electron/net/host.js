'use strict';
// LAN host side: accepts one guest for two-player co-op, or up to three for a four-player squad. Newline-delimited JSON framing.
const net = require('node:net');
const os = require('node:os');

const DEFAULT_PORT = 47321;
const MAX_GUESTS = 7;
// The longest single message either side will accept or send. A full world update is a few tens of kilobytes; a
// connection that sends more than this without ending a line is not a copy of the game and is dropped.
const MAX_LINE = 1024 * 1024;

// Shared by host.js and guest.js: takes whatever has arrived, hands each complete line that holds a JSON object to
// onMessage, and returns what is left over. Anything that is not an object (a bare number, null, broken JSON) is skipped.
function readLines(buffer, chunk, onMessage) {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg && typeof msg === 'object' && !Array.isArray(msg)) onMessage(msg);
  }
  return buffer;
}

class Host {
  constructor() {
    this.server = null;
    // Every connected guest, by the number it was given when it connected (1, 2, 3...). Messages from a guest are
    // handed on with that number as "from", so the game knows whose they are.
    this.sockets = new Map();
    this.nextId = 1;
    this.max = 1;
    this.onMessage = null;
    this.onGuestJoined = null;
    this.onGuestLeft = null;
  }

  // The first guest, for callers written when there was only ever one.
  get socket() { return this.sockets.values().next().value || null; }

  localAddresses() {
    const out = [];
    for (const ifaces of Object.values(os.networkInterfaces())) {
      for (const i of ifaces || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
    return out;
  }

  // How many guests may be connected at once: one for two-player co-op, up to MAX_GUESTS for a four-player squad.
  // Lowering it turns new callers away; it does not drop anyone already connected (the game decides who leaves).
  setMax(max) { this.max = Number.isInteger(max) ? Math.max(1, Math.min(MAX_GUESTS, max)) : 1; }

  start(port = DEFAULT_PORT, max = 1) {
    this.setMax(max);
    return new Promise((resolve, reject) => {
      const server = this.server = net.createServer((socket) => {
        // A caller beyond the limit is turned away; it gets an error handler of its own so that a reset on its way
        // out cannot surface as an uncaught exception, and is cut off if it lingers.
        if (this.server !== server || this.sockets.size >= this.max) { socket.on('error', () => {}); socket.end(); setTimeout(() => socket.destroy(), 1000).unref(); return; }
        const id = this.nextId++;
        const peer = { socket, buffer: '' };
        this.sockets.set(id, peer);
        socket.setEncoding('utf8');
        socket.on('data', (chunk) => this._onData(id, peer, chunk));
        socket.on('close', () => { if (this.sockets.get(id) === peer) { this.sockets.delete(id); this.onGuestLeft?.(id); } });
        socket.on('error', () => {});
      });
      // Only a failure to open the port is the caller's to hear about; once listening, an error on one connection
      // attempt must not surface as an uncaught exception.
      server.once('error', reject);
      server.listen(port, '0.0.0.0', () => { server.removeListener('error', reject); server.on('error', () => {}); resolve(server.address().port); });
    });
  }

  _onData(id, peer, chunk) {
    if (this.sockets.get(id) !== peer) return;
    peer.buffer = readLines(peer.buffer, chunk, (msg) => {
      // "from" is ours to set: whatever a guest put there is overwritten.
      msg.from = id;
      if (msg.type === 'hello') this.onGuestJoined?.(msg);
      this.onMessage?.(msg);
    });
    if (peer.buffer.length > MAX_LINE) peer.socket.destroy();
  }

  // A message may arrive already serialised (the game does that for its large state updates). With "to" it goes to
  // that one guest, otherwise to all of them.
  send(msg, to) {
    const line = (typeof msg === 'string' ? msg : JSON.stringify(msg)) + '\n';
    for (const [id, peer] of this.sockets) if ((to == null || to === id) && !peer.socket.destroyed) peer.socket.write(line);
  }

  // Ends one guest's connection (a full lobby, or a mode with fewer seats). It hears about it as the host closing.
  drop(id) { const peer = this.sockets.get(id); if (peer) peer.socket.end(); }

  stop() {
    for (const peer of this.sockets.values()) peer.socket.end();
    if (this.server) this.server.close();
    this.server = null;
    this.sockets = new Map();
  }
}
Host.MAX_LINE = MAX_LINE;

module.exports = { Host, DEFAULT_PORT, MAX_LINE, MAX_GUESTS, readLines };
