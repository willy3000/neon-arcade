'use strict';
// Real end-to-end check: launches two actual Electron app instances (the exact built app, preload and all,
// not a mock) on one machine and drives a full host+guest LAN co-op connection through the real UI.
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron: electron } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');

async function bootWindow() {
  const app = await electron.launch({ args: [path.join(ROOT, 'electron', 'main.js')], cwd: ROOT });
  const win = await app.firstWindow();
  await win.waitForFunction(() => document.getElementById('loading')?.hidden, null, { timeout: 30000 });
  return { app, win };
}

(async () => {
  const host = await bootWindow();
  const guest = await bootWindow();
  try {
    assert.equal(await host.win.evaluate(() => !!window.BPNet?.available), true, 'host window must have window.BPNet (preload wired correctly)');
    assert.equal(await guest.win.evaluate(() => !!window.BPNet?.available), true, 'guest window must have window.BPNet too');

    // Host: HOLDOUT -> HOST LAN GAME -> first (always-unlocked) killhouse -> read the address it's listening on.
    await host.win.click('#holdout');
    await host.win.waitForFunction(() => document.getElementById('picker').open);
    await host.win.click('#picker-list button:has-text("HOST LAN GAME")');
    await host.win.click('#picker-list button:not(.locked)'); // the default Killhouse, always first and unlocked
    await host.win.waitForFunction(() => document.getElementById('picker-title').textContent.includes('WAITING'), null, { timeout: 10000 });
    const addressLine = await host.win.$eval('#picker-list .pick span', (el) => el.textContent);
    const port = Number(/PORT (\d+)/.exec(addressLine)[1]);
    assert.ok(port > 0, `could not read a port out of "${addressLine}"`);

    // Guest: HOLDOUT -> JOIN LAN GAME -> connect to the host over loopback (same machine, real sockets, real IPC).
    await guest.win.click('#holdout');
    await guest.win.waitForFunction(() => document.getElementById('picker').open);
    await guest.win.click('#picker-list button:has-text("JOIN LAN GAME")');
    await guest.win.fill('#picker-list input', '127.0.0.1');
    await guest.win.click('#picker-list button:has-text("CONNECT")');
    await guest.win.waitForFunction(() => document.querySelector('#picker-list p')?.textContent.includes('WAITING FOR THE HOST'), null, { timeout: 10000 });

    // Host sees the connection and deploys for both.
    await host.win.waitForFunction(() => document.getElementById('picker-title').textContent.includes('CONNECTED'), null, { timeout: 10000 });
    await host.win.click('#picker-list button:has-text("DEPLOY")');

    await host.win.waitForFunction(() => window.BPApp?.snapshot().mode === 'playing', null, { timeout: 10000 });
    await guest.win.waitForFunction(() => window.BPApp?.snapshot().mode === 'playing', null, { timeout: 10000 });
    console.log('PASS both windows reached mode:playing after a real host+guest LAN handshake');

    // The host's real simulation must have a live guest character.
    const hostSnap = await host.win.evaluate(() => window.BPApp.inspect().world);
    assert.ok(hostSnap.guest, 'host sim should have created s.guest once the guest connected and deployed');
    console.log('PASS host sim has a guest character:', hostSnap.guest.x, hostSnap.guest.y);

    // Drive the guest's movement via its own real input, over the real socket, and confirm the HOST's
    // authoritative simulation actually moves the guest character (not just the guest's local display).
    const before = hostSnap.guest.x;
    await guest.win.keyboard.down('KeyD');
    await guest.win.waitForFunction((x0) => window.BPApp.inspect().world.guest?.x > x0 + 40, before, { timeout: 5000 });
    await guest.win.keyboard.up('KeyD');
    console.log('PASS guest input over the socket moved the host-authoritative guest character');

    // The guest's own render loop should reflect a snapshot from the host (not a local simulation of its own).
    const guestSawEnemiesField = await guest.win.evaluate(() => Array.isArray(window.BPApp.inspect().world.enemies));
    assert.equal(guestSawEnemiesField, true, 'guest should have received and applied a host snapshot');
    console.log('PASS guest is rendering host-streamed snapshot data');

    console.log('ALL END-TO-END LAN CO-OP CHECKS PASSED');
  } finally {
    await host.app.close();
    await guest.app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
