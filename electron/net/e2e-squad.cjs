'use strict';
// Real end-to-end check of a LAN team deathmatch: three actual Electron app instances on one machine (a host and two
// guests) arrange themselves into Team Alpha and Team Delta, play with the whole kit, and are each paid on their own
// machine when it ends.
// Needs the default LAN port free: quit any running copy of the game that is hosting before running this.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron: electron } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SAVE_KEY = 'blackout-protocol-progress';

// Each instance gets a folder of its own for its save, cache and one-copy-at-a-time lock (see e2e.cjs). '--qa' is the
// development-only flag that gives a test a handle on the running simulation (window.BPQA).
const dirs = [], apps = [];
async function bootWindow(save) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blackout-squad-'));
  dirs.push(dir);
  fs.writeFileSync(path.join(dir, 'save-store.json'), JSON.stringify({ [SAVE_KEY]: JSON.stringify(save) }));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [path.join(ROOT, 'electron', 'main.js'), '--windowed', '--qa', '--user-data-dir=' + dir], cwd: ROOT, env });
  apps.push(app);
  const win = await app.firstWindow();
  await win.waitForFunction(() => document.getElementById('loading')?.hidden && window.BPApp && window.BPQA, null, { timeout: 30000 });
  return { app, win };
}
const cleanUp = () => { for (const dir of dirs) try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* still held by a closing process */ } };
const lobbyOf = (w) => w.win.evaluate(() => window.BPApp.snapshot().lobby);
const worldOf = (w) => w.win.evaluate(() => window.BPApp.inspect().world);
const saveOf = (w) => w.win.evaluate(() => window.BPApp.snapshot().save);
const modeIs = (w, mode) => w.win.waitForFunction((m) => window.BPApp.snapshot().mode === m, mode, { timeout: 15000 });
const seatsOf = (l) => l.squad.map((q) => (q ? (q.bot ? 'ai' : q.name) : '-'));
const save = (callsign, extra = {}) => ({ version: 3, drill: true, xp: 60000, settings: { volume: 0, music: false, voice: false, callsign, ...extra.settings }, owned: extra.owned, loadout: extra.loadout });

(async () => {
  const host = await bootWindow(save('ROOK', { owned: { weapons: ['rifle', 'pistol'], gear: ['frag'], support: [], perks: [] }, loadout: { primary: 'rifle', secondary: 'pistol', lethal: 'frag' }, settings: { lobbyMode: 'tdm' } }));
  const one = await bootWindow(save('VIPER', { owned: { weapons: ['rifle', 'pistol', 'shotgun'], gear: ['frag', 'smoke'], support: ['recon'], perks: ['regen', 'scrounger'] }, loadout: { primary: 'shotgun', secondary: 'pistol', lethal: 'frag', tactical: 'smoke', support: 'recon', perks: ['regen', 'scrounger', null] } }));
  const two = await bootWindow(save('MAKO', { owned: { weapons: ['rifle', 'pistol', 'smg'], gear: ['frag'], support: [], perks: [] }, loadout: { primary: 'smg', secondary: 'pistol', lethal: 'frag' }, settings: { lobbyMode: 'tdm' } }));
  try {
    // Host: the lobby opens in team deathmatch as one player and seven AI. HOST A MATCH opens it to the LAN.
    await host.win.click('#holdout');
    await modeIs(host, 'lobby');
    await host.win.click('#teams [data-link="lan"][data-role="host"]');
    await host.win.waitForFunction(() => window.BPApp.snapshot().lobby?.role === 'host');
    const l = await lobbyOf(host);
    assert.equal(l.mode, 'tdm');
    assert.deepEqual(seatsOf(l), ['ROOK', 'ai', 'ai', 'ai', 'ai', 'ai', 'ai', 'ai']);
    assert.equal(await host.win.isDisabled('#lobby-go'), false, 'a host can start against AI with nobody else in the lobby');
    console.log('PASS the host opens a team deathmatch lobby: Alpha and Delta, four seats each, AI in every seat but their own');

    // One guest joins from a holdout lobby, the other from a team deathmatch one. Each is seated on the team with
    // fewer players, in place of an AI: the first on Delta, the second beside the host on Alpha.
    await one.win.click('#holdout');
    await one.win.click('#op-peer [data-link="lan"][data-role="guest"]');
    await modeIs(one, 'lobby');
    await one.win.fill('#lobby-ip', '127.0.0.1');
    await one.win.click('#lobby-connect');
    await one.win.waitForFunction(() => window.BPApp.snapshot().lobby?.mySeat >= 0, null, { timeout: 10000 });
    await two.win.click('#holdout');
    await two.win.click('#teams [data-link="lan"][data-role="guest"]');
    await modeIs(two, 'lobby');
    await two.win.fill('#lobby-ip', '127.0.0.1');
    await two.win.click('#lobby-connect');
    await two.win.waitForFunction(() => window.BPApp.snapshot().lobby?.mySeat >= 0, null, { timeout: 10000 });
    await host.win.waitForFunction(() => window.BPApp.snapshot().lobby.players === 3, null, { timeout: 10000 });
    assert.deepEqual(seatsOf(await lobbyOf(host)), ['ROOK', 'MAKO', 'ai', 'ai', 'VIPER', 'ai', 'ai', 'ai']);
    assert.equal((await lobbyOf(one)).mySeat, 4);
    assert.equal((await lobbyOf(two)).mySeat, 1);
    console.log('PASS two players join and are seated on the team with fewer players');

    // Players arrange themselves: MAKO moves across to Delta (taking an AI's seat, which swaps with them), and the
    // host clears the AI out, leaving ROOK alone on Alpha against VIPER and MAKO: one against two, first to five.
    await two.win.click('#teams [data-seat="5"]');
    await host.win.waitForFunction(() => window.BPApp.snapshot().lobby.squad[5]?.name === 'MAKO', null, { timeout: 5000 });
    for (const n of [1, 2, 3, 6, 7]) await host.win.click(`#teams [data-ai="${n}"]`);
    await host.win.click('#lobby-records [data-limit="5"]');
    const want = ['ROOK', '-', '-', '-', 'VIPER', 'MAKO', '-', '-'];
    for (const w of [host, one, two]) {
      await w.win.waitForFunction((s) => JSON.stringify(window.BPApp.snapshot().lobby.squad.map((q) => (q ? (q.bot ? 'ai' : q.name) : '-'))) === s && window.BPApp.snapshot().lobby.limit === 5, JSON.stringify(want), { timeout: 5000 });
    }
    assert.equal((await lobbyOf(two)).mySeat, 5);
    assert.equal((await lobbyOf(one)).squad[5].loadout.primary, 'smg', "one guest sees the other's guns");
    assert.equal(await two.win.locator('#teams .seat.me').count(), 1);
    assert.equal(await two.win.locator('#lobby-records [data-limit]:not([disabled])').count(), 0, 'only the host sets the rules');
    assert.equal(await one.win.locator('#teams [data-ai]').count(), 0, 'and only the host adds or removes AI');
    console.log('PASS players move between teams, the host removes the AI and sets five kills to win, and all three see the same lobby');

    // Chat from one guest reaches the other by name.
    await one.win.fill('#lobby-chat', 'two on one');
    await one.win.press('#lobby-chat', 'Enter');
    await two.win.waitForFunction(() => [...document.querySelectorAll('#lobby-feed p')].some((p) => p.textContent.includes('two on one') && p.textContent.includes('VIPER')), null, { timeout: 5000 });
    // The match starts once everyone who has joined is ready.
    assert.equal(await host.win.isDisabled('#lobby-go'), true, 'nobody is ready yet');
    await one.win.click('#lobby-go');
    await two.win.click('#lobby-go');
    await host.win.waitForFunction(() => !document.getElementById('lobby-go').disabled, null, { timeout: 5000 });
    await host.win.click('#lobby-go');
    for (const w of [host, one, two]) await modeIs(w, 'playing');
    console.log('PASS the host starts the match once both guests are ready, and all three windows are in it');

    // One roster on the host: ROOK for Alpha; VIPER and MAKO for Delta, each with their own guns, gadgets and perks.
    const sim = await worldOf(host);
    assert.equal(sim.tdm.limit, 5);
    assert.deepEqual([sim.player.team, ...sim.mates.map((m) => m.team)], [0, 1, 1]);
    assert.deepEqual(sim.mates.map((m) => [m.id, m.bot, m.slots[0], m.lethal, m.tactical]), [['guest', false, 'shotgun', 'frag', 'smoke'], ['m2', false, 'smg', 'frag', null]]);
    assert.deepEqual(sim.mates[0].ctx.perks, { regen: true, scrounger: true });
    assert.equal(sim.mates[0].ctx.support.key, 'recon');
    await one.win.waitForFunction(() => /M870/.test(document.getElementById('weapon-name').textContent), null, { timeout: 5000 });
    await two.win.waitForFunction(() => /MP7/.test(document.getElementById('weapon-name').textContent), null, { timeout: 5000 });
    assert.equal(await one.win.textContent('#score-us-name'), 'DELTA', "each player's scoreboard leads with their own team");
    assert.equal(await host.win.textContent('#score-us-name'), 'ALPHA');
    assert.equal(await one.win.isHidden('#support-row'), false, 'a guest has their own field support meter');
    console.log('PASS the match has every player on the team they chose, with their own loadout, perks and field support');

    // A guest has every move the host has: they walk, roll, throw their lethal and their tactical.
    const before = sim.mates[0];
    await one.win.keyboard.down('KeyS');
    await host.win.waitForFunction((y0) => Math.abs(window.BPApp.inspect().world.mates[0].y - y0) > 40, before.y, { timeout: 6000 });
    await one.win.keyboard.press('Space');
    await host.win.waitForFunction(() => window.BPApp.inspect().world.mates[0].state === 'roll', null, { timeout: 4000, polling: 10 });
    await one.win.keyboard.up('KeyS');
    await one.win.waitForTimeout(700);
    await one.win.keyboard.press('KeyG');
    await host.win.waitForFunction((n) => window.BPApp.inspect().world.mates[0].grenades === n - 1, before.grenades, { timeout: 4000 });
    await one.win.keyboard.press('KeyC');
    await host.win.waitForFunction((n) => window.BPApp.inspect().world.mates[0].tacticals === n - 1, before.tacticals, { timeout: 4000 });
    await one.win.waitForFunction((n) => window.BPApp.inspect().world.mates[0].grenades === n - 1, before.grenades, { timeout: 4000 });
    assert(Math.abs((await worldOf(host)).mates[1].x - sim.mates[1].x) < 12, "and the other guest's operator stayed where it was");
    console.log('PASS a guest walks, rolls and throws both gadgets through the host, as the host can');

    // A guest's own fire kills the host's operator: a point for Delta, a bounty for the guest who made it, and both
    // are told who got whom. The host's operator is stood in the open in front of MAKO first.
    await host.win.evaluate(() => {
      const s = window.BPQA.sim(), foe = s.player, me = s.mates[1];
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, q = { x: me.x + Math.cos(a) * 180, y: me.y + Math.sin(a) * 180 }; if (window.BPCore.clearAt(s, q.x, q.y, 22) && window.BPCore.lineOfSight(s, me, q)) { foe.x = q.x; foe.y = q.y; break; } }
      foe.iframes = 0; foe.vx = foe.vy = 0;
    });
    const aim = async () => {
      const at = await two.win.evaluate(() => { const s = window.BPQA.sim(), cam = window.BPQA.camera(), v = cam.worldView, foe = s.player; return { x: (foe.x - v.x) * cam.zoom, y: (foe.y - v.y) * cam.zoom }; });
      await two.win.mouse.move(at.x, at.y);
    };
    await two.win.waitForTimeout(300); await aim(); await two.win.waitForTimeout(400); await aim();
    await two.win.mouse.down();
    for (let i = 0; i < 40 && (await worldOf(host)).tdm.score[1] < 1; i++) { await aim(); await two.win.waitForTimeout(150); }
    await two.win.mouse.up();
    const hit = await worldOf(host);
    assert.deepEqual(hit.tdm.score, [0, 1], "MAKO's fire killed the host's operator");
    assert.equal(hit.tdm.board.m2.k, 1);
    assert(hit.mates[1].ctx.stats.credits > 0, 'and paid MAKO a bounty');
    await two.win.waitForFunction(() => /MAKO/.test(document.getElementById('killfeed').textContent) && /ROOK/.test(document.getElementById('killfeed').textContent), null, { timeout: 4000 });
    await host.win.waitForFunction(() => !window.BPApp.inspect().world.player.dead, null, { timeout: 12000 });
    console.log('PASS one player kills another: a point for their team, a bounty for them, and it is on the kill feed');

    // The match ends when Delta reaches five. Each player gets their own debrief and is paid on their own machine.
    await host.win.evaluate(() => { window.BPQA.sim().tdm.score[1] = 5; });
    for (const w of [host, one, two]) await modeIs(w, 'complete');
    assert.equal((await host.win.textContent('#ending-title')).trim(), 'DEFEAT.');
    assert.equal((await one.win.textContent('#ending-title')).trim(), 'VICTORY.');
    assert.equal((await two.win.textContent('#ending-title')).trim(), 'VICTORY.');
    assert.match(await two.win.textContent('#ending-eyebrow'), /TEAM DELTA/);
    assert.equal(await two.win.locator('#scoreboard > div:not(.head)').count(), 3, 'both teams are on the scoreboard');
    await two.win.waitForTimeout(600);
    const [hs, s1, s2] = [await saveOf(host), await saveOf(one), await saveOf(two)];
    assert(s2.credits > 0 && s2.stats.kills === 1, "MAKO's own save was paid for the kill: " + s2.credits + ' CR');
    assert.equal(s2.mastery.smg, 1, 'with the kill counted towards the gun that made it');
    assert(s1.credits > 0, 'VIPER was paid the win bonus: ' + s1.credits);
    assert(hs.credits > 0 && hs.credits < s2.credits, 'and the host, who lost, was paid less: ' + hs.credits);
    console.log('PASS the match ends for everyone at once, and each player is paid on their own machine: host ' + hs.credits + ', VIPER ' + s1.credits + ', MAKO ' + s2.credits + ' CR');

    // Everyone goes back to the same lobby, seats as they left them, and plays again. A guest who then drops out
    // mid-match is replaced by an AI on their team.
    await host.win.click('#ending-retry');
    await one.win.click('#ending-retry');
    await two.win.click('#ending-retry');
    for (const w of [host, one, two]) await modeIs(w, 'lobby');
    await host.win.waitForFunction(() => window.BPApp.snapshot().lobby.squad.filter((q) => q && !q.bot && !q.host).every((q) => !q.ready), null, { timeout: 5000 });
    assert.deepEqual(seatsOf(await lobbyOf(host)), want);
    await one.win.click('#lobby-go');
    await two.win.click('#lobby-go');
    await host.win.waitForFunction(() => !document.getElementById('lobby-go').disabled, null, { timeout: 5000 });
    await host.win.click('#lobby-go');
    for (const w of [host, one, two]) await modeIs(w, 'playing');
    await one.app.close();
    await host.win.waitForFunction(() => window.BPApp.inspect().world.mates[0].bot === true, null, { timeout: 10000 });
    assert.equal((await host.win.evaluate(() => window.BPApp.snapshot().mode)), 'playing');
    await two.win.waitForFunction(() => window.BPApp.inspect().world.mates[0].bot === true, null, { timeout: 10000 });
    console.log('PASS a rematch from the same lobby; a guest who leaves mid-match is replaced by an AI operator');

    // The host leaving ends it for the remaining guest, who lands back in the lobby.
    await host.win.keyboard.press('Escape');
    await modeIs(host, 'paused');
    await host.win.click('#exit');
    await modeIs(two, 'lobby');
    assert.equal((await lobbyOf(two)).phase, 'joining');
    console.log('PASS the remaining guest returns to the lobby when the host leaves');

    console.log('ALL END-TO-END LAN TEAM DEATHMATCH CHECKS PASSED');
  } finally {
    for (const app of apps) await app.close().catch(() => {});
    cleanUp();
  }
})().catch((e) => { console.error(e); process.exit(1); });
