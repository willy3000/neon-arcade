'use strict';
// Exercises host.js/guest.js directly over 127.0.0.1 - no Electron, no IPC, just the socket framing/handshake.
const assert = require('node:assert/strict');
const net = require('node:net');
const { Host, MAX_LINE } = require('./host.js');
const { Guest } = require('./guest.js');

(async () => {
  // A real host always has at least one IPv4 address to show in its lobby.
  const probe = new Host();
  assert.ok(probe.localAddresses().length >= 1, 'localAddresses() should find at least one IPv4 address');

  const host = new Host();
  const port = await host.start(0); // 0 = OS-assigned free port, avoids clashing with a real running host
  assert.ok(port > 0);

  const received = { host: [], guest: [] };
  host.onMessage = (msg) => received.host.push(msg);

  const guest = new Guest();
  guest.onMessage = (msg) => received.guest.push(msg);
  await guest.connect('127.0.0.1', port);

  guest.send({ type: 'hello', name: 'Guest' });
  host.send({ type: 'start', mission: 'holdout', seed: 42 });
  host.send({ type: 'snapshot', payload: { player: { x: 1, y: 2 }, enemies: [] } });
  guest.send({ type: 'input', input: { mx: 1, fire: true } });

  await new Promise((r) => setTimeout(r, 200));

  assert.equal(received.host.length, 2, 'host should have received hello + input');
  assert.ok(received.host.every((m) => m.from === received.host[0].from && m.from > 0), 'every message says which guest it came from');
  assert.equal(received.host[0].type, 'hello');
  assert.equal(received.host[1].type, 'input');
  assert.equal(received.guest.length, 2, 'guest should have received start + snapshot');
  assert.equal(received.guest[0].mission, 'holdout');
  assert.deepEqual(received.guest[1].payload.enemies, []);

  // A second connection attempt while a guest is already present must be rejected (two-player co-op is the default).
  const second = new Guest();
  let secondClosed = false;
  second.onClose = () => { secondClosed = true; };
  await second.connect('127.0.0.1', port);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(secondClosed, true, 'a second guest connection should be closed immediately');

  // Guest disconnect should notify the host exactly once, without the host crashing or needing a restart.
  let guestLeft = 0;
  host.onGuestLeft = () => { guestLeft++; };
  guest.disconnect();
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(guestLeft, 1);

  // Whatever is on the other end of the socket is not necessarily a copy of the game. Lines that are not JSON objects
  // are skipped without an error (this used to throw on a bare "null"), and the real message after them still arrives.
  const raw = (port) => new Promise((resolve, reject) => { const s = net.createConnection({ host: '127.0.0.1', port }, () => resolve(s)); s.on('error', reject); });
  received.host.length = 0;
  const stranger = await raw(port);
  stranger.on('error', () => {});
  stranger.write('null\n[1,2]\n42\n"hello"\n{not json\n\n{"type":"chat","text":"still here"}\n');
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(received.host.map(({ from, ...m }) => m), [{ type: 'chat', text: 'still here' }], 'only the one well-formed object should have been delivered');

  // A connection that pours in data without ever ending a line is cut off instead of being buffered without limit,
  // and the host is free to take a real guest afterwards.
  let cut = false;
  stranger.on('close', () => { cut = true; });
  const flood = 'x'.repeat(256 * 1024);
  for (let i = 0; i < 6 && !cut; i++) { stranger.write(flood); await new Promise((r) => setTimeout(r, 50)); }
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(cut, true, `a line longer than ${MAX_LINE} bytes should get the connection closed`);
  const again = new Guest();
  await again.connect('127.0.0.1', port);
  again.send({ type: 'hello', name: 'Again' });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(received.host.at(-1).type, 'hello', 'the host accepts a new guest after dropping a bad connection');
  again.disconnect();
  await new Promise((r) => setTimeout(r, 150));

  // A four-player squad: with the limit raised, three guests are connected at once. Each one's messages arrive
  // tagged with its own number, the host can answer one of them or all of them, and a fourth caller is turned away.
  host.setMax(3);
  received.host.length = 0;
  const left = [];
  host.onGuestLeft = (id) => left.push(id);
  const squad = [new Guest(), new Guest(), new Guest()], heard = [[], [], []];
  for (const [i, g] of squad.entries()) { g.onMessage = (m) => heard[i].push(m); await g.connect('127.0.0.1', port); g.send({ type: 'hello', name: 'G' + i }); await new Promise((r) => setTimeout(r, 60)); }
  const ids = received.host.map((m) => m.from);
  assert.equal(new Set(ids).size, 3, 'three guests, three different numbers');
  // A guest cannot pass itself off as another: whatever it puts in "from" is replaced.
  squad[2].send({ type: 'chat', from: ids[0], text: 'spoof' });
  host.send({ type: 'lobby', seat: 1 }, ids[1]);
  host.send({ type: 'chat', text: 'all' });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(received.host.at(-1).from, ids[2], '"from" is set by the host, not by the guest');
  assert.deepEqual(heard.map((h) => h.map((m) => m.type)), [['chat'], ['lobby', 'chat'], ['chat']], 'a message with "to" reaches that guest only; one without reaches everyone');
  const fourth = new Guest();
  let fourthClosed = false;
  fourth.onClose = () => { fourthClosed = true; };
  await fourth.connect('127.0.0.1', port);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(fourthClosed, true, 'a fourth guest is turned away');
  host.drop(ids[1]);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(left, [ids[1]], 'dropping one guest reports that guest, and leaves the others connected');
  squad[0].send({ type: 'chat', text: 'still in' });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(received.host.at(-1).text, 'still in');
  for (const g of squad) g.disconnect();

  // Nothing listening: the attempt fails with an error the lobby can report, rather than hanging.
  host.stop();
  await new Promise((r) => setTimeout(r, 100));
  await assert.rejects(new Guest().connect('127.0.0.1', port), 'connecting to a closed port should be refused');

  console.log('8 net framing checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });
