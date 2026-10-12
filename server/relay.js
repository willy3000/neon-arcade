'use strict';
// Blackout Protocol online co-op relay.
//
// Two players cannot normally reach each other across the internet (home routers refuse incoming connections), so both
// connect OUT to this service instead. A host asks for a room and gets a short code; a guest joins with that code; from
// then on every game message either sends is forwarded to the other. The relay never looks inside game messages and
// keeps nothing on disk. It needs one port and no database, and runs anywhere Node does.
//
// Wire format (WebSocket text frames):
//   control, client -> relay : {"t":"host","v":1}   {"t":"join","code":"K7QF2","v":1}   {"t":"ping","n":7}
//   control, relay -> client : {"t":"room","code":"K7QF2"}  {"t":"joined"}  {"t":"peer","on":true|false}
//                              {"t":"pong","n":7}  {"t":"error","code":"..."}
//   game messages            : any frame starting with ">" is passed to the other player untouched
const http = require('node:http');
const { WebSocketServer } = require('ws');

const PROTOCOL = 1;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I: codes get read out loud
const num = (name, fallback) => { const v = Number(process.env[name]); return Number.isFinite(v) && v >= 0 ? v : fallback; };

function createRelay(options = {}) {
  const cfg = {
    maxRooms: num('RELAY_MAX_ROOMS', 500),
    maxMessageBytes: num('RELAY_MAX_MESSAGE_BYTES', 256 * 1024),
    maxPerSecond: num('RELAY_MAX_MESSAGES_PER_SECOND', 150), // a client sends ~30/s as guest, ~25/s as host
    maxBacklogBytes: num('RELAY_MAX_BACKLOG_BYTES', 4 * 1024 * 1024),
    maxPerAddress: num('RELAY_MAX_CONNECTIONS_PER_ADDRESS', 8),
    maxJoinsPerMinute: num('RELAY_MAX_JOINS_PER_MINUTE', 30), // per address: stops room codes being guessed
    roomIdleMs: num('RELAY_ROOM_IDLE_MINUTES', 120) * 60000,
    heartbeatMs: num('RELAY_HEARTBEAT_SECONDS', 20) * 1000,
    trustProxy: process.env.RELAY_TRUST_PROXY === '1', // set when a platform's proxy sits in front (Render, Fly, Railway...)
    lagMs: num('RELAY_TEST_LAG_MS', 0), // testing only: delays every forwarded game message to imitate a slow link
    log: process.env.RELAY_QUIET === '1' ? () => {} : (...a) => console.log(new Date().toISOString(), ...a),
    ...options,
  };
  const rooms = new Map(); // code -> { code, host, guest, touched }
  const perAddress = new Map(); // address -> { open, joins, since }
  const started = Date.now();
  let forwarded = 0, bytes = 0;

  const server = http.createServer((req, res) => {
    // Hosting platforms poll this to decide whether the service is alive.
    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, service: 'blackout-relay', protocol: PROTOCOL, rooms: rooms.size, players: wss.clients.size, uptimeSeconds: Math.round((Date.now() - started) / 1000) }));
      return;
    }
    res.writeHead(426, { 'Content-Type': 'text/plain' }).end('This is a WebSocket game relay.');
  });
  const wss = new WebSocketServer({
    server,
    maxPayload: cfg.maxMessageBytes,
    // Game state is repetitive JSON and shrinks to a fraction of its size. Small control frames are left alone.
    perMessageDeflate: { threshold: 512, zlibDeflateOptions: { level: 3 }, concurrencyLimit: 16 },
  });

  const say = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const fail = (ws, code) => { say(ws, { t: 'error', code }); ws.close(1008, code); };
  const addressOf = (req) => (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
  function newCode() { for (let tries = 0; tries < 50; tries++) { let c = ''; for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; if (!rooms.has(c)) return c; } return null; }
  function closeRoom(room, why) {
    if (!rooms.delete(room.code)) return;
    for (const ws of [room.host, room.guest]) if (ws) { ws.room = null; if (ws.readyState === 1) ws.close(1000, why); }
    cfg.log('room closed', room.code, why);
  }
  function leave(ws) {
    const room = ws.room; if (!room) return; ws.room = null;
    if (room.host === ws) closeRoom(room, 'host-left'); // the host runs the game, so the room cannot outlive it
    else if (room.guest === ws) { room.guest = null; say(room.host, { t: 'peer', on: false }); cfg.log('guest left', room.code); }
  }

  wss.on('connection', (ws, req) => {
    const address = addressOf(req), seen = perAddress.get(address) || { open: 0, joins: 0, since: Date.now() };
    perAddress.set(address, seen);
    if (seen.open >= cfg.maxPerAddress) { fail(ws, 'too-many-connections'); return; }
    seen.open++; ws.alive = true; ws.room = null; ws.role = null; ws.budget = cfg.maxPerSecond; ws.budgetAt = Date.now();
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => {});
    ws.on('close', () => { seen.open--; leave(ws); });
    ws.on('message', (data, isBinary) => {
      // A refilling allowance per connection: generous for a real game, useless for flooding.
      const now = Date.now(); ws.budget = Math.min(cfg.maxPerSecond, ws.budget + (now - ws.budgetAt) / 1000 * cfg.maxPerSecond); ws.budgetAt = now;
      if (--ws.budget < 0) { fail(ws, 'too-fast'); return; }
      if (isBinary) { fail(ws, 'bad-message'); return; }
      // Game traffic: hand the frame to the other player as it is.
      if (data[0] === 0x3e /* ">" */) {
        const room = ws.room, peer = room && (room.host === ws ? room.guest : room.host);
        if (!peer || peer.readyState !== 1) return;
        // Someone whose connection cannot keep up would otherwise make this process hold their backlog in memory.
        if (peer.bufferedAmount > cfg.maxBacklogBytes) { fail(peer, 'too-slow'); return; }
        room.touched = now; forwarded++; bytes += data.length;
        if (cfg.lagMs) setTimeout(() => { if (peer.readyState === 1) peer.send(data, { binary: false }); }, cfg.lagMs); else peer.send(data, { binary: false });
        return;
      }
      let msg; try { msg = JSON.parse(data.toString()); } catch { fail(ws, 'bad-message'); return; }
      if (!msg || typeof msg !== 'object') { fail(ws, 'bad-message'); return; }
      if (msg.t === 'ping') { say(ws, { t: 'pong', n: msg.n }); return; }
      if (msg.t !== 'host' && msg.t !== 'join') { fail(ws, 'bad-message'); return; }
      if (ws.room) { fail(ws, 'already-in-a-room'); return; }
      if (msg.v !== PROTOCOL) { fail(ws, 'version'); return; } // the two copies of the game would not understand each other
      if (msg.t === 'host') {
        if (rooms.size >= cfg.maxRooms) { fail(ws, 'busy'); return; }
        const code = newCode(); if (!code) { fail(ws, 'busy'); return; }
        const room = { code, host: ws, guest: null, touched: now }; rooms.set(code, room); ws.room = room; ws.role = 'host';
        say(ws, { t: 'room', code }); cfg.log('room opened', code);
        return;
      }
      if (now - seen.since > 60000) { seen.since = now; seen.joins = 0; }
      if (++seen.joins > cfg.maxJoinsPerMinute) { fail(ws, 'too-many-attempts'); return; }
      const room = rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!room) { fail(ws, 'no-such-room'); return; }
      if (room.guest) { fail(ws, 'room-full'); return; }
      room.guest = ws; room.touched = now; ws.room = room; ws.role = 'guest';
      say(ws, { t: 'joined' }); say(room.host, { t: 'peer', on: true }); cfg.log('guest joined', room.code);
    });
  });

  // Connections that vanished without saying goodbye (laptop lid, dropped Wi-Fi) are found by the heartbeat, and rooms
  // nobody has used for a long time are cleared out.
  const sweep = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
    const now = Date.now();
    for (const room of rooms.values()) if (now - room.touched > cfg.roomIdleMs) closeRoom(room, 'idle');
    for (const [address, seen] of perAddress) if (!seen.open && now - seen.since > 120000) perAddress.delete(address);
  }, cfg.heartbeatMs);
  sweep.unref?.();

  return {
    server, wss, rooms, config: cfg,
    stats: () => ({ rooms: rooms.size, players: wss.clients.size, forwarded, bytes }),
    listen: (port = num('PORT', 8787), host = process.env.HOST || '0.0.0.0') => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server.address().port)); }),
    close: () => new Promise((resolve) => { clearInterval(sweep); for (const ws of wss.clients) ws.close(1001, 'relay-shutting-down'); wss.close(() => server.close(() => resolve())); setTimeout(() => { for (const ws of wss.clients) ws.terminate(); }, 500).unref?.(); }),
  };
}

if (require.main === module) {
  const relay = createRelay();
  relay.listen().then((port) => relay.config.log(`blackout relay listening on port ${port}`), (err) => { console.error('Could not start the relay:', err.message); process.exit(1); });
  // Platforms stop a service with SIGTERM before replacing it; players get a clean close instead of a hang.
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { relay.config.log('shutting down'); relay.close().then(() => process.exit(0)); });
}

module.exports = { createRelay, PROTOCOL };
