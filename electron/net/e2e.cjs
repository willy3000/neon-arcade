'use strict';
// Real end-to-end check: launches two actual Electron app instances (the exact built app, preload and all,
// not a mock) on one machine and drives a full host+guest LAN co-op session through the real squad lobby UI.
// Needs the default LAN port free: quit any running copy of the game that is hosting before running this.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron: electron } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SAVE_KEY = 'blackout-protocol-progress';

// Each instance gets a folder of its own for its save, cache and one-copy-at-a-time lock (--user-data-dir, see
// electron/main.js), so two can run side by side and neither touches the save of a game installed on this machine.
// The save is written there before launch: the desktop app keeps it in a file, not in the page's localStorage.
const dirs = [];
async function bootWindow(save) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blackout-e2e-'));
  dirs.push(dir);
  fs.writeFileSync(path.join(dir, 'save-store.json'), JSON.stringify({ [SAVE_KEY]: JSON.stringify(save) }));
  // A shell that sets ELECTRON_RUN_AS_NODE (VS Code's terminal does) would start Electron as plain Node.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [path.join(ROOT, 'electron', 'main.js'), '--windowed', '--user-data-dir=' + dir], cwd: ROOT, env });
  const win = await app.firstWindow();
  const loaded = () => win.waitForFunction(() => document.getElementById('loading')?.hidden && window.BPApp, null, { timeout: 30000 });
  await loaded();
  return { app, win };
}
const cleanUp = () => { for (const dir of dirs) try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* still held by a closing process */ } };
const lobbyOf = (w) => w.win.evaluate(() => window.BPApp.snapshot().lobby);
const modeIs = (w, mode) => w.win.waitForFunction((m) => window.BPApp.snapshot().mode === m, mode, { timeout: 10000 });

(async () => {
  const host = await bootWindow({ version: 3, drill: true, settings: { volume: 0, callsign: 'ROOK' } });
  const guest = await bootWindow({ version: 3, drill: true, owned: { weapons: ['rifle', 'pistol', 'shotgun'], gear: [] }, loadout: { primary: 'shotgun', secondary: 'pistol' }, settings: { volume: 0, callsign: 'VIPER' } });
  try {
    assert.equal(await host.win.evaluate(() => !!window.BPNet?.available), true, 'host window must have window.BPNet (preload wired correctly)');
    assert.equal(await guest.win.evaluate(() => !!window.BPNet?.available), true, 'guest window must have window.BPNet too');

    // Host: HOLDOUT -> HOST LAN GAME opens the squad lobby and starts listening.
    await host.win.click('#holdout');
    await host.win.click('#op-peer [data-link="lan"][data-role="host"]');
    await modeIs(host, 'lobby');
    const addressLine = await host.win.textContent('#lobby-link-label');
    assert.ok(Number(/PORT (\d+)/.exec(addressLine)?.[1]) > 0, `could not read a port out of "${addressLine}"`);
    assert.equal(await host.win.isDisabled('#lobby-go'), true, 'the host cannot deploy into an empty lobby');

    // Guest: HOLDOUT -> JOIN LAN GAME -> connect to the host over loopback (same machine, real sockets, real IPC).
    await guest.win.click('#holdout');
    await guest.win.click('#op-peer [data-link="lan"][data-role="guest"]');
    await modeIs(guest, 'lobby');
    await guest.win.fill('#lobby-ip', '127.0.0.1');
    await guest.win.click('#lobby-connect');
    await guest.win.waitForFunction(() => window.BPApp.snapshot().lobby?.peer, null, { timeout: 10000 });
    await host.win.waitForFunction(() => window.BPApp.snapshot().lobby?.peer, null, { timeout: 10000 });
    console.log('PASS both players are in the same lobby after a real host+guest LAN handshake');

    // Each side sees the other's callsign and loadout, not just a connection.
    const seenByHost = (await lobbyOf(host)).peer, seenByGuest = (await lobbyOf(guest)).peer;
    assert.equal(seenByHost.name, 'VIPER');
    assert.equal(seenByHost.loadout.primary, 'shotgun');
    assert.equal(seenByGuest.name, 'ROOK');
    assert.equal(await host.win.textContent('#op-peer .op-name'), 'VIPER', "the host's lobby shows the guest's operator card");
    assert.equal(await guest.win.textContent('#op-peer .op-name'), 'ROOK', "the guest's lobby shows the host's operator card");
    console.log('PASS each player sees the other operator, with their callsign and loadout');

    // The host's enemy pressure reaches the guest, and squad chat goes both ways.
    await host.win.click('#lobby-difficulty button.intense');
    await guest.win.waitForFunction(() => window.BPApp.snapshot().lobby.difficulty === 'intense', null, { timeout: 5000 });
    await guest.win.fill('#lobby-chat', 'ready when you are');
    await guest.win.press('#lobby-chat', 'Enter');
    await host.win.waitForFunction(() => document.getElementById('lobby-feed').textContent.includes('ready when you are'), null, { timeout: 5000 });
    console.log('PASS host settings and squad chat sync across the lobby');

    // Deploy stays locked until the guest readies up; then the host deploys for both after the countdown.
    assert.equal(await host.win.isDisabled('#lobby-go'), true, 'the host cannot deploy before the guest is ready');
    await guest.win.click('#lobby-go');
    await host.win.waitForFunction(() => !document.getElementById('lobby-go').disabled, null, { timeout: 5000 });
    await host.win.click('#lobby-go');
    await modeIs(host, 'playing');
    await modeIs(guest, 'playing');
    console.log('PASS both windows reached mode:playing after the guest readied up and the host deployed');

    // The host's real simulation must have a live guest character carrying the loadout the guest picked.
    const hostSnap = await host.win.evaluate(() => window.BPApp.inspect().world);
    assert.ok(hostSnap.guest, 'host sim should have created s.guest once the guest connected and deployed');
    assert.deepEqual(hostSnap.guest.slots, ['shotgun', 'pistol'], "the guest character should carry the guest's own guns");
    assert.equal(hostSnap.difficulty, 'intense');
    console.log('PASS host sim has a guest character with the guest loadout:', hostSnap.guest.slots.join(' + '));

    // Drive the guest's movement via its own real input, over the real socket, and confirm the HOST's
    // authoritative simulation actually moves the guest character (not just the guest's local display).
    const before = hostSnap.guest.x;
    await guest.win.keyboard.down('KeyD');
    await guest.win.waitForFunction((x0) => window.BPApp.inspect().world.guest?.x > x0 + 40, before, { timeout: 5000 });
    await guest.win.keyboard.up('KeyD');
    console.log('PASS guest input over the socket moved the host-authoritative guest character');

    // The guest's own render loop should reflect a snapshot from the host (not a local simulation of its own),
    // and its HUD should describe its own character rather than the host's.
    const guestSawEnemiesField = await guest.win.evaluate(() => Array.isArray(window.BPApp.inspect().world.enemies));
    assert.equal(guestSawEnemiesField, true, 'guest should have received and applied a host snapshot');
    assert.match(await guest.win.textContent('#weapon-name'), /M870/, "the guest's HUD should show the guest's own weapon");
    console.log('PASS guest is rendering host-streamed snapshot data with its own HUD');

    // The host walking away ends the session: the guest lands back in the lobby, ready to join again.
    await host.win.keyboard.press('Escape');
    await modeIs(host, 'paused');
    await host.win.click('#exit');
    await modeIs(guest, 'lobby');
    assert.equal((await lobbyOf(guest)).phase, 'joining');
    assert.equal(await host.win.evaluate(() => window.BPApp.snapshot().lobby), null, 'leaving for the main menu closes the host lobby');
    console.log('PASS the guest returns to the lobby when the host leaves');

    console.log('ALL END-TO-END LAN CO-OP CHECKS PASSED');
  } finally {
    await host.app.close();
    await guest.app.close();
    cleanUp();
  }
})().catch((e) => { console.error(e); process.exit(1); });
