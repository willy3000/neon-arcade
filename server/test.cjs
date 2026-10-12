'use strict';
// Exercises the relay over real WebSockets on a local port: room codes, forwarding, limits and clean-up.
// Needs Node 22+ for its built-in WebSocket client (the relay itself runs on Node 18+).
const assert = require('node:assert/strict');
const { createRelay } = require('./relay.js');

let passed = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`), inbox = [], waiting = [];
  const c = {
    ws, inbox, closed: null,
    open: new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('could not connect')); }),
    send: (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
    game: (m) => ws.send('>' + JSON.stringify(m)),
    // Resolves with the next message matching the test, whether it has already arrived or not.
    next: (test = () => true, ms = 2000) => new Promise((res, rej) => {
      const at = inbox.findIndex(test); if (at >= 0) { res(inbox.splice(at, 1)[0]); return; }
      const w = { test, res }; waiting.push(w); setTimeout(() => { const i = waiting.indexOf(w); if (i >= 0) { waiting.splice(i, 1); rej(new Error('timed out waiting for a message')); } }, ms);
    }),
    gone: new Promise((res) => { ws.onclose = (e) => { c.closed = e.reason || String(e.code); res(c.closed); }; }),
  };
  ws.onmessage = (e) => {
    const msg = e.data[0] === '>' ? { game: JSON.parse(e.data.slice(1)) } : JSON.parse(e.data), i = waiting.findIndex((w) => w.test(msg));
    if (i >= 0) waiting.splice(i, 1)[0].res(msg); else inbox.push(msg);
  };
  return c;
}
async function test(name, fn) { const relay = createRelay({ log: () => {} }); const port = await relay.listen(0, '127.0.0.1'); try { await fn(port, relay); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name); throw e; } finally { await relay.close(); } }
const pair = async (port) => {
  const host = client(port), guest = client(port); await host.open; await guest.open;
  host.send({ t: 'host', v: 1 }); const { code } = await host.next((m) => m.t === 'room');
  guest.send({ t: 'join', code, v: 1 }); await guest.next((m) => m.t === 'joined'); await host.next((m) => m.t === 'peer' && m.on);
  return { host, guest, code };
};

(async () => {
  await test('a host gets a five-character room code and a guest can join with it', async (port, relay) => {
    const { code } = await pair(port);
    assert.match(code, /^[A-HJ-NP-Z2-9]{5}$/, 'codes avoid look-alike characters');
    assert.equal(relay.stats().rooms, 1);
  });
  await test('game messages are forwarded both ways, untouched and in order', async (port) => {
    const { host, guest } = await pair(port);
    for (let i = 0; i < 20; i++) host.game({ type: 'snapshot', n: i, payload: { text: 'x'.repeat(2000) } });
    for (let i = 0; i < 20; i++) assert.equal((await guest.next((m) => m.game)).game.n, i);
    guest.game({ type: 'input', input: { mx: 1, fire: true } });
    assert.deepEqual((await host.next((m) => m.game)).game, { type: 'input', input: { mx: 1, fire: true } });
  });
  await test('codes are case-insensitive, and a wrong code or a full room is refused with a reason', async (port) => {
    const { code } = await pair(port);
    const wrong = client(port); await wrong.open; wrong.send({ t: 'join', code: 'ZZZZZ', v: 1 });
    assert.equal((await wrong.next((m) => m.t === 'error')).code, 'no-such-room');
    const third = client(port); await third.open; third.send({ t: 'join', code: code.toLowerCase(), v: 1 });
    assert.equal((await third.next((m) => m.t === 'error')).code, 'room-full', 'lower case found the room; it is simply full');
  });
  await test('a copy of the game speaking another protocol version is turned away', async (port) => {
    const old = client(port); await old.open; old.send({ t: 'host', v: 0 });
    assert.equal((await old.next((m) => m.t === 'error')).code, 'version');
  });
  await test('the guest leaving tells the host, and the room stays open for someone else', async (port, relay) => {
    const { host, guest, code } = await pair(port);
    guest.ws.close(); assert.equal((await host.next((m) => m.t === 'peer')).on, false);
    const again = client(port); await again.open; again.send({ t: 'join', code, v: 1 }); await again.next((m) => m.t === 'joined');
    assert.equal(relay.stats().rooms, 1);
  });
  await test('the host leaving closes the room and disconnects the guest', async (port, relay) => {
    const { host, guest } = await pair(port);
    host.ws.close(); assert.equal(await guest.gone, 'host-left');
    await wait(50); assert.equal(relay.stats().rooms, 0);
  });
  await test('ping is answered, so a client can measure its delay to the relay', async (port) => {
    const c = client(port); await c.open; c.send({ t: 'ping', n: 42 });
    assert.equal((await c.next((m) => m.t === 'pong')).n, 42);
  });
  await test('flooding, oversized and malformed messages get a client disconnected', async (port) => {
    const flood = client(port); await flood.open; for (let i = 0; i < 400; i++) flood.send({ t: 'ping', n: i });
    assert.equal(await flood.gone, 'too-fast');
    const big = client(port); await big.open; big.send('>' + 'x'.repeat(300 * 1024)); await big.gone; assert.ok(big.closed, 'a frame over the size limit closes the connection');
    const junk = client(port); await junk.open; junk.send('not json'); assert.equal(await junk.gone, 'bad-message');
  });
  await test('guessing room codes is rate limited per address', async (port) => {
    const guesser = createRelay({ log: () => {}, maxJoinsPerMinute: 5, maxPerAddress: 50 }), p = await guesser.listen(0, '127.0.0.1');
    try { let last = ''; for (let i = 0; i < 8; i++) { const c = client(p); await c.open; c.send({ t: 'join', code: 'AAAA' + i, v: 1 }); last = (await c.next((m) => m.t === 'error')).code; }
      assert.equal(last, 'too-many-attempts'); } finally { await guesser.close(); }
  });
  await test('the health check reports that the service is up', async (port) => {
    await pair(port);
    const body = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.equal(body.ok, true); assert.equal(body.rooms, 1); assert.equal(body.players, 2);
  });
  await test('a connection that goes silent is dropped by the heartbeat and its room cleaned up', async () => {
    const quick = createRelay({ log: () => {}, heartbeatMs: 80 }), p = await quick.listen(0, '127.0.0.1');
    try { const { host } = await pair(p); for (const ws of quick.wss.clients) ws.pong = () => {}; // stop the server noticing replies
      for (const ws of quick.wss.clients) ws.removeAllListeners('pong');
      await wait(400); assert.equal(quick.stats().players, 0, 'both silent connections were terminated'); assert.equal(quick.stats().rooms, 0); assert.ok(host.closed !== undefined);
    } finally { await quick.close(); }
  });
  console.log(`${passed} relay checks passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
