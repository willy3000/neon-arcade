'use strict';
// Exercises host.js/guest.js directly over 127.0.0.1 - no Electron, no IPC, just the socket framing/handshake.
const assert = require('node:assert/strict');
const { Host } = require('./host.js');
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
  assert.equal(received.host[0].type, 'hello');
  assert.equal(received.host[1].type, 'input');
  assert.equal(received.guest.length, 2, 'guest should have received start + snapshot');
  assert.equal(received.guest[0].mission, 'holdout');
  assert.deepEqual(received.guest[1].payload.enemies, []);

  // A second connection attempt while a guest is already present must be rejected (exactly 2 players for v1).
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

  host.stop();
  console.log('4 net framing checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });
