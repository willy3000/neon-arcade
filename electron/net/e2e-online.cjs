'use strict';
// Real end-to-end check of ONLINE co-op: starts the relay (server/relay.js) on a local port, launches two actual
// app instances pointed at it, and drives a host+guest session through the real lobby UI by room code.
// Set RELAY_TEST_LAG_MS to imitate a slow connection (it delays every forwarded message by that much, each way).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron: electron } = require('playwright');
const { createRelay } = require('../../server/relay.js');

const ROOT = path.join(__dirname, '..', '..');
const SAVE_KEY = 'blackout-protocol-progress';

// Each instance gets a folder of its own for its save, cache and one-copy-at-a-time lock (--user-data-dir, see
// electron/main.js), so two can run side by side and neither touches the save of a game installed on this machine.
// The save is written there before launch: the desktop app keeps it in a file, not in the page's localStorage.
const dirs = [];
async function bootWindow(save, relayUrl) {
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
  await win.goto(win.url().split('?')[0] + '?relay=' + encodeURIComponent(relayUrl));
  await loaded();
  return { app, win };
}
const cleanUp = () => { for (const dir of dirs) try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* still held by a closing process */ } };
const lobbyOf = (w) => w.win.evaluate(() => window.BPApp.snapshot().lobby);
const modeIs = (w, mode) => w.win.waitForFunction((m) => window.BPApp.snapshot().mode === m, mode, { timeout: 12000 });

(async () => {
  const relay = createRelay({ log: () => {} });
  const port = await relay.listen(0, '127.0.0.1'), url = `ws://127.0.0.1:${port}`;
  const host = await bootWindow({ version: 3, drill: true, settings: { volume: 0, callsign: 'ROOK' } }, url);
  const guest = await bootWindow({ version: 3, drill: true, owned: { weapons: ['rifle', 'pistol', 'shotgun'], gear: [] }, loadout: { primary: 'shotgun', secondary: 'pistol' }, settings: { volume: 0, callsign: 'VIPER' } }, url);
  const faults = [];
  for (const w of [host, guest]) w.win.on('pageerror', (e) => faults.push(e.message));
  try {
    // Host: HOLDOUT -> ONLINE / HOST opens a lobby and is given a room code by the relay.
    await host.win.click('#holdout');
    await host.win.click('#op-peer [data-link="online"][data-role="host"]');
    await host.win.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.getElementById('lobby-link-value').textContent), null, { timeout: 10000 });
    const code = await host.win.textContent('#lobby-link-value');
    assert.equal(relay.stats().rooms, 1, 'the relay opened a room for the host');
    console.log('PASS the host opened an online lobby and got room code', code);

    // Guest: a wrong code is refused with a clear reason; the right one (typed in lower case) joins.
    await guest.win.click('#holdout');
    await guest.win.click('#op-peer [data-link="online"][data-role="guest"]');
    await modeIs(guest, 'lobby');
    await guest.win.fill('#lobby-ip', code === 'ZZZZZ' ? 'YYYYY' : 'ZZZZZ');
    await guest.win.click('#lobby-connect');
    await guest.win.waitForFunction(() => /NO LOBBY WITH THAT CODE/.test(document.getElementById('lobby-join-status').textContent), null, { timeout: 10000 });
    await guest.win.fill('#lobby-ip', code.toLowerCase());
    await guest.win.click('#lobby-connect');
    await guest.win.waitForFunction(() => window.BPApp.snapshot().lobby?.peer, null, { timeout: 10000 });
    await host.win.waitForFunction(() => window.BPApp.snapshot().lobby?.peer, null, { timeout: 10000 });
    assert.equal((await lobbyOf(host)).peer.name, 'VIPER');
    assert.equal((await lobbyOf(guest)).peer.name, 'ROOK');
    assert.equal((await lobbyOf(host)).peer.loadout.primary, 'shotgun');
    console.log('PASS a wrong code is refused, the right one joins, and each player sees the other');

    // The delay between the two players is measured and shown.
    await guest.win.waitForFunction(() => /PING \d+ MS/.test(document.getElementById('lobby-link-label').textContent), null, { timeout: 10000 });
    console.log('PASS the lobby shows the connection delay:', (await guest.win.textContent('#lobby-link-label')).replace(/.*· /, ''));

    // Lobby traffic works through the relay exactly as on a LAN: settings, chat, ready-up, deploy.
    await host.win.click('#lobby-difficulty button.story');
    await guest.win.waitForFunction(() => window.BPApp.snapshot().lobby.difficulty === 'story', null, { timeout: 5000 });
    await guest.win.fill('#lobby-chat', 'online and ready');
    await guest.win.press('#lobby-chat', 'Enter');
    await host.win.waitForFunction(() => document.getElementById('lobby-feed').textContent.includes('online and ready'), null, { timeout: 5000 });
    await guest.win.click('#lobby-go');
    await host.win.waitForFunction(() => !document.getElementById('lobby-go').disabled, null, { timeout: 5000 });
    await host.win.click('#lobby-go');
    await modeIs(host, 'playing');
    await modeIs(guest, 'playing');
    console.log('PASS lobby settings, chat, ready-up and deploy all work through the relay');

    // In the run: the host simulates the guest with the guest's own loadout, and the guest's real input drives it.
    const hostSnap = await host.win.evaluate(() => window.BPApp.inspect().world);
    assert.deepEqual(hostSnap.guest.slots, ['shotgun', 'pistol']);
    const before = hostSnap.guest.x;
    await guest.win.keyboard.down('KeyD');
    await host.win.waitForFunction((x0) => window.BPApp.inspect().world.guest?.x > x0 + 40, before, { timeout: 6000 });
    await guest.win.keyboard.up('KeyD');
    await guest.win.waitForFunction(() => window.BPApp.inspect().world.station && Array.isArray(window.BPApp.inspect().world.enemies), null, { timeout: 6000 });
    assert.match(await guest.win.textContent('#weapon-name'), /M870/);
    console.log('PASS the guest plays through the relay: its input moves it on the host, and it receives the host\'s world');

    // Where the guest sees itself must settle on where the host says it is.
    await guest.win.waitForTimeout(900);
    const [truth, shown] = [(await host.win.evaluate(() => window.BPApp.inspect().world.guest)), (await guest.win.evaluate(() => window.BPApp.inspect().world.guest))];
    const drift = Math.hypot(truth.x - shown.x, truth.y - shown.y);
    assert(drift < 6, `once at rest, the guest's own position matches the host's (off by ${drift.toFixed(1)}px)`);
    console.log('PASS at rest the guest sees itself where the host has it (off by', drift.toFixed(1) + 'px)');

    // The other machine is not trusted: a world update that is the wrong shape in every way is ignored piece by piece,
    // and the guest carries on drawing the last good one.
    await host.win.evaluate(() => window.BPOnline.hostSend({ type: 'snapshot', payload: { player: null, guest: { x: 'left', y: {} }, enemies: 5, projectiles: [null, 3], pickups: 'none', director: [], stats: null, time: 'soon', dead: 'yes', stage: 1.5, goal: {}, tags: {}, walls: [null, 7, { id: 'not-a-wall', deployed: true, x: 'x' }] } }));
    await guest.win.waitForTimeout(400);
    const kept = await guest.win.evaluate(() => { const w = window.BPApp.inspect().world; return { mode: window.BPApp.snapshot().mode, player: typeof w.player?.x, guest: typeof w.guest?.x, enemies: Array.isArray(w.enemies), time: typeof w.time, dead: w.dead, walls: w.walls.every((b) => b && Number.isFinite(b.x)) }; });
    assert.deepEqual(kept, { mode: 'playing', player: 'number', guest: 'number', enemies: true, time: 'number', dead: false, walls: true });
    assert.deepEqual(faults, [], 'no page error on either side');
    console.log('PASS a malformed world update is refused and the guest plays on');

    // The guest dropping out tells the host, who carries on alone; the room stays usable.
    await guest.win.keyboard.press('Escape');
    await modeIs(guest, 'paused');
    await guest.win.click('#exit');
    await host.win.waitForFunction(() => !window.BPApp.snapshot().lobby?.peer, null, { timeout: 6000 });
    assert.equal(await host.win.evaluate(() => window.BPApp.snapshot().mode), 'playing');
    assert.equal(relay.stats().rooms, 1);
    // And the host leaving closes the room on the relay.
    await host.win.keyboard.press('Escape');
    await modeIs(host, 'paused');
    await host.win.click('#exit');
    await modeIs(host, 'menu');
    for (let i = 0; i < 40 && relay.stats().rooms; i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(relay.stats().rooms, 0, 'the room is gone once the host leaves');
    console.log('PASS leaving is clean on both sides and the relay forgets the room');

    console.log('ALL END-TO-END ONLINE CO-OP CHECKS PASSED');
  } finally {
    await host.app.close();
    await guest.app.close();
    await relay.close();
    cleanUp();
  }
})().catch((e) => { console.error(e); process.exit(1); });
