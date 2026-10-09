// Real-browser checks for BLOOD OATH: loads the page in Chromium, plays with real key presses and with two SIMULATED controllers
// (navigator.getGamepads is replaced by a fake that the test drives), and reads the game state back.
// No physical controller is involved; see TEST_REPORT.md for what that does and does not prove.
// Run: node bloodoath/tests/browser.cjs [--production]   (--production tests the built dist/ folder)
'use strict';
const { chromium } = require('playwright'), http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), site = process.argv.includes('--production') ? path.join(root, 'dist') : root, qa = path.join(root, 'bloodoath/qa');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let file; try { file = path.resolve(site, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); } catch { res.writeHead(400).end(); return; }
  if (file === site) file = path.join(site, 'index.html'); if (!file.startsWith(site + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data); });
});
const results = [], errors = [], missing = []; let browser, dump = async () => '';
async function check(name, fn) { try { await fn(); } catch (e) { console.log('FAIL', name, '\n     state: ' + await dump().catch(() => 'unavailable')); throw e; } results.push(name); console.log('PASS', name); }
// A stand-in for the browser's Gamepad API: four slots the test can plug pads into, press buttons on and unplug.
const fakePads = () => {
  const pads = [null, null, null, null], blank = () => ({ pressed: false, value: 0, touched: false });
  window.__pad = {
    connect(i) { pads[i] = { index: i, id: `Test Pad ${i + 1} (STANDARD GAMEPAD Vendor: 0000 Product: 000${i})`, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, blank) }; },
    disconnect(i) { pads[i] = null; }, press(i, b, on) { if (pads[i]) pads[i].buttons[b] = { pressed: on, value: on ? 1 : 0, touched: on }; }, axis(i, a, v) { if (pads[i]) pads[i].axes[a] = v; },
    release(i) { if (pads[i]) { pads[i].buttons = Array.from({ length: 17 }, blank); pads[i].axes = [0, 0, 0, 0]; } },
  };
  Object.defineProperty(navigator, 'getGamepads', { value: () => pads.slice(), configurable: true });
};
const A = 0, B = 1, LB = 4, BACK = 8, START = 9; // standard mapping: A light attack / confirm, B medium / back, LB block

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`, url = base + '/blood-oath.html';
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }); await context.addInitScript(fakePads); const page = await context.newPage(); fs.mkdirSync(qa, { recursive: true });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400 && !r.url().includes('favicon')) missing.push(r.url()); });
  const snap = () => page.evaluate(() => window.BO.snapshot()), wait = ms => page.waitForTimeout(ms), shot = name => page.screenshot({ path: path.join(qa, name + '.png') });
  dump = () => page.evaluate(() => JSON.stringify(window.BO.snapshot()));
  const until = (fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout });
  const ready = async () => { await page.goto(url, { waitUntil: 'domcontentloaded' }); await until(() => window.BO && window.BO.screen === 'menu', null, 30000); };
  const key = async (code, hold = 70) => { await page.keyboard.down(code); await wait(hold); await page.keyboard.up(code); await wait(70); };
  const pad = {
    connect: i => page.evaluate(i => window.__pad.connect(i), i), disconnect: i => page.evaluate(i => window.__pad.disconnect(i), i), release: i => page.evaluate(i => window.__pad.release(i), i),
    press: (i, b, on = true) => page.evaluate(([i, b, on]) => window.__pad.press(i, b, on), [i, b, on]), axis: (i, a, v) => page.evaluate(([i, a, v]) => window.__pad.axis(i, a, v), [i, a, v]),
    async tap(i, b, hold = 70) { await this.press(i, b, true); await wait(hold); await this.press(i, b, false); await wait(70); },
  };
  const fighting = () => until(() => window.BO.screen === 'fight' && window.BO.match && window.BO.match.phase === 'fight');
  const place = (a, b) => page.evaluate(([a, b]) => { const f = window.BO.match.fight.fighters; Object.assign(f[0], { x: a, y: 0, vx: 0, vy: 0, facing: 1 }); Object.assign(f[1], { x: b, y: 0, vx: 0, vy: 0, facing: -1 }); }, [a, b]);
  // Both players confirm devices, pick the fighter under their cursor and take the first arena, using only their own controllers.
  const versusWithPads = async () => { await page.evaluate(() => { window.BO.session.chars = ['cinder', 'rime']; }); await page.click('[data-go="versus"]'); await until(() => window.BO.screen === 'devices'); await pad.tap(0, A); await until(() => window.BO.screen === 'select'); await pad.tap(0, A); await pad.tap(1, A); await until(() => window.BO.screen === 'arena'); await wait(150); await pad.tap(1, A); await fighting(); };
  // Ends the current round in player 1's favour: leaves player 2 staggered on one hit point and lands a light attack.
  const winRound = async press => { await fighting(); await wait(200); await place(-60, 60); await page.evaluate(() => { const f = window.BO.match.fight.fighters[1]; f.hp = 1; f.armor = 0; f.state = 'stagger'; f.stun = 90; f.t = 0; f.move = null; f.inv = 0; }); for (let i = 0; i < 12; i++) { await press(); if (await page.evaluate(() => window.BO.match.phase !== 'fight')) return; await place(-60, 60); await page.evaluate(() => { const f = window.BO.match.fight.fighters[1]; if (f.hp > 1) f.hp = 1; f.armor = 0; if (['idle', 'walk', 'crouch', 'block', 'blockstun'].includes(f.state)) { f.state = 'stagger'; f.stun = 90; f.t = 0; f.move = null; } }); } throw new Error('the round did not end'); };

  await check('boots to the menu with every sound loaded and no errors', async () => {
    await ready(); const s = await snap(); assert.equal(s.soundsFailed, 0); assert.equal(s.sounds, 45); assert.deepEqual(s.assigned, ['kb1', 'kb2']); await wait(600); await shot('menu');
    assert.equal(await page.locator('#menu-list button').count(), 7); for (const b of await page.locator('#menu-list button').all()) { const box = await b.boundingBox(); assert(box && box.y + box.height <= 768, 'every menu entry is on screen'); }
  });

  await check('keyboard: the menu, both select cursors and both fighters work from one keyboard', async () => {
    await key('KeyS'); await key('KeyF'); await until(() => window.BO.screen === 'devices'); assert.equal((await snap()).mode, 'versus'); await key('KeyF'); await until(() => window.BO.screen === 'select');
    await key('KeyD'); await key('ArrowDown'); let cur = await page.evaluate(() => [...window.BO.session.cursor]); assert.deepEqual(cur, [1, 3], 'each player moved only their own cursor'); await shot('select');
    await key('KeyF'); await key('KeyJ'); await until(() => window.BO.screen === 'arena'); await wait(150); await key('KeyF'); await fighting(); let s = await snap(); assert.deepEqual(s.p.map(p => p.id), ['rime', 'grit']);
    await place(-250, 250); await page.keyboard.down('KeyD'); await wait(400); await page.keyboard.up('KeyD'); let t = await snap(); assert(t.p[0].x > -245, 'WASD moved player 1'); assert.equal(t.p[1].x, 250, 'and did not move player 2');
    await page.keyboard.down('ArrowLeft'); await wait(400); await page.keyboard.up('ArrowLeft'); const u = await snap(); assert(u.p[1].x < 245, 'arrows moved player 2'); assert(Math.abs(u.p[0].x - t.p[0].x) < 1, 'and did not move player 1');
    await key('Escape'); await until(() => window.BO.screen === 'pause'); await page.click('#pause-quit'); await until(() => window.BO.screen === 'menu');
  });

  await check('two controllers: each wakes on its first press and is given to the next free player', async () => {
    await pad.connect(0); await pad.connect(1); await wait(200); assert.deepEqual((await snap()).assigned, ['pad:0', 'pad:1']);
    await page.click('[data-go="devices"]'); await until(() => window.BO.screen === 'devices'); assert.match(await page.locator('#slot-0').innerText(), /Controller 1/); assert.match(await page.locator('#slot-1').innerText(), /Controller 2/);
    await pad.press(1, 2, true); await wait(150); assert.match(await page.locator('#test-1').innerText(), /HEAVY/, 'the input test shows what player 2 holds'); assert.equal((await page.locator('#test-0').innerText()).trim(), '', 'and nothing under player 1'); await shot('controllers'); await pad.release(1);
  });

  await check('controller assignment is explicit: a device cannot be given to both players, and can be changed back', async () => {
    await page.click('#assign-0'); await wait(120); await pad.tap(1, A); await wait(150); assert.deepEqual((await snap()).assigned, ['pad:0', 'pad:1'], 'player 2\'s controller was refused for player 1');
    await key('KeyF'); await wait(150); assert.deepEqual((await snap()).assigned, ['kb1', 'pad:1']); await page.click('#assign-0'); await wait(120); await pad.tap(0, A); await wait(150); assert.deepEqual((await snap()).assigned, ['pad:0', 'pad:1']);
    await page.click('#devices-swap'); assert.deepEqual((await snap()).assigned, ['pad:1', 'pad:0']); await page.click('#devices-swap'); await page.click('#devices-done'); await until(() => window.BO.screen === 'menu');
  });

  await check('two controllers: versus is reachable and each controller moves only its own fighter', async () => {
    await versusWithPads(); let s = await snap(); assert.equal(s.mode, 'versus'); assert.deepEqual(s.p.map(p => p.id), ['cinder', 'rime']);
    await place(-250, 250); await pad.axis(0, 0, 1); await wait(400); await pad.axis(0, 0, 0); const a = await snap(); assert(a.p[0].x > -245, 'controller 1 moved player 1'); assert.equal(a.p[1].x, 250, 'and not player 2');
    await pad.press(1, 14, true); await wait(400); await pad.press(1, 14, false); const b = await snap(); assert(b.p[1].x < 245, 'controller 2 (d-pad) moved player 2'); assert(Math.abs(b.p[0].x - a.p[0].x) < 1, 'and not player 1');
    await page.keyboard.down('KeyD'); await page.keyboard.down('ArrowLeft'); await wait(300); await page.keyboard.up('KeyD'); await page.keyboard.up('ArrowLeft'); const c = await snap(); assert(Math.abs(c.p[0].x - b.p[0].x) < 1 && Math.abs(c.p[1].x - b.p[1].x) < 1, 'the keyboard no longer drives either fighter');
  });

  await check('two controllers: simultaneous presses give each fighter its own attack', async () => {
    await place(-300, 300); await wait(100); await pad.press(0, A, true); await pad.press(1, 2, true); await until(() => window.BO.match.fight.fighters.every(f => f.state === 'attack'), null, 3000);
    const moves = await page.evaluate(() => window.BO.match.fight.fighters.map(f => f.move.id)); assert.deepEqual(moves, ['5L', '5H']); await pad.release(0); await pad.release(1); await until(() => window.BO.match.fight.fighters.every(f => f.state === 'idle'), null, 5000);
  });

  await check('two controllers: a hit lands, and the other player can block it', async () => {
    await place(-60, 60); const hp = (await snap()).p[1].hp; await pad.tap(0, A); await until(h => window.BO.match.fight.fighters[1].hp < h, hp, 3000); await until(() => window.BO.match.fight.fighters.every(f => f.state === 'idle'), null, 5000);
    await place(-60, 60); const before = (await snap()).p[1].hp; await pad.press(1, LB, true); await wait(200); await pad.tap(0, A); await until(() => ['blockstun', 'block'].includes(window.BO.match.fight.fighters[1].state), null, 3000); await wait(400);
    assert.equal((await snap()).p[1].hp, before, 'a blocked normal does no damage'); await pad.release(1); await shot('versus-fight');
  });

  await check('pause from either controller freezes the fight; the same press does not reopen it', async () => {
    await pad.tap(1, START); await until(() => window.BO.screen === 'pause'); const f = (await snap()).frame; await wait(500); assert.equal((await snap()).frame, f, 'no frames pass while paused'); await shot('pause');
    await pad.tap(1, START); await wait(200); let s = await snap(); assert.equal(s.overlay, null, 'the pause menu closed and stayed closed'); await wait(300); assert((await snap()).frame > f, 'the fight resumed');
  });

  await check('unplugging a controller mid-fight pauses and names the player; plugging it back restores control', async () => {
    await pad.disconnect(1); await until(() => window.BO.screen === 'pause'); assert.match(await page.locator('#pause-kicker').innerText(), /PLAYER 2 CONTROLLER DISCONNECTED/); await shot('disconnected');
    await pad.connect(1); await wait(200); assert.deepEqual((await snap()).assigned, ['pad:0', 'pad:1'], 'the assignment survived the disconnect'); await pad.tap(0, A); await until(() => window.BO.screen === 'fight');
    await place(-250, 250); await pad.axis(1, 0, -1); await wait(400); await pad.axis(1, 0, 0); assert((await snap()).p[1].x < 245, 'controller 2 drives player 2 again');
  });

  await check('rounds, the match result, a rematch and switching characters all reset cleanly', async () => {
    await winRound(() => pad.tap(0, A)); await until(() => window.BO.match.round === 2 && window.BO.match.phase === 'fight', null, 25000); let s = await snap(); assert.deepEqual(s.wins, [1, 0]); assert.equal(s.p[1].hp, 1050, 'health is restored for round 2');
    await winRound(() => pad.tap(0, A)); await until(() => window.BO.screen === 'result', null, 25000); assert.match(await page.locator('#result-kicker').innerText(), /PLAYER 1 WINS/); assert.match(await page.locator('#result-title').innerText(), /CINDER WINS/); await shot('result');
    await pad.tap(1, A); await fighting(); s = await snap(); assert.deepEqual(s.wins, [0, 0]); assert.equal(s.round, 1); assert.deepEqual(s.p.map(p => p.hp), [950, 1050]); assert.equal(s.projectiles, 0); assert.equal(s.p[0].meter, 0, 'meter does not carry into a rematch');
    await pad.tap(0, START); await until(() => window.BO.screen === 'pause'); await page.click('#pause-select'); await until(() => window.BO.screen === 'devices'); assert.equal((await snap()).phase, undefined, 'the old match is gone'); await pad.tap(0, A); await until(() => window.BO.screen === 'select');
    await pad.axis(0, 0, 1); await wait(90); await pad.axis(0, 0, 0); await wait(90); await pad.axis(0, 0, 1); await wait(90); await pad.axis(0, 0, 0); await wait(90); await pad.tap(0, A); await pad.tap(1, A); await until(() => window.BO.screen === 'arena'); await wait(150); await pad.tap(0, A); await fighting();
    s = await snap(); assert.deepEqual(s.p.map(p => p.id), ['vesper', 'rime']); assert.deepEqual(s.wins, [0, 0]); await pad.tap(0, START); await until(() => window.BO.screen === 'pause'); await page.click('#pause-quit'); await until(() => window.BO.screen === 'menu');
  });

  await check('training: meter stays full, the dummy recovers, hitboxes toggle and positions reset', async () => {
    await page.click('[data-go="training"]'); await until(() => window.BO.screen === 'select'); await pad.tap(0, A); await wait(150); await pad.tap(0, A); await until(() => window.BO.screen === 'arena'); await wait(150); await pad.tap(0, A); await fighting();
    let s = await snap(); assert.equal(s.timer, Infinity, 'no round timer'); assert.deepEqual(s.p.map(p => p.meter), [300, 300]); await place(-60, 60); await pad.tap(0, A); await until(() => window.BO.match.fight.fighters[1].hp < 1050, null, 3000);
    await until(() => window.BO.match.fight.fighters[1].hp === 1050, null, 6000); assert.match(await page.locator('#tr-combo').innerText(), /Combo 1 hit ·/); assert.match(await page.locator('#tr-move').innerText(), /startup \d+ · active \d+ · recovery \d+/);
    await pad.tap(0, START); await until(() => window.BO.screen === 'pause'); assert(await page.locator('#tr-boxes').isVisible()); await page.click('#tr-boxes'); await page.click('#tr-dummy'); assert.match(await page.locator('#tr-dummy').innerText(), /CROUCHES/); await page.click('#resume'); await wait(400);
    assert.equal(await page.evaluate(() => window.BO.match.fight.fighters[1].state), 'crouch', 'the dummy obeys its setting'); assert.equal(await page.evaluate(() => window.BO.session.training.boxes), true); await shot('training');
    await place(-400, 100); await pad.tap(0, BACK); await wait(200); s = await snap(); assert.deepEqual(s.p.map(p => p.x), [-150, 150], 'BACK resets positions'); await pad.tap(0, START); await until(() => window.BO.screen === 'pause'); await page.click('#pause-quit'); await until(() => window.BO.screen === 'menu');
  });

  await check('arcade: three rivals, then the boss with his ward, then the ending, saved for the library', async () => {
    await page.evaluate(() => { window.BO.settings.rounds = 1; window.BO.session.chars = ['cinder', 'rime']; }); await page.click('[data-go="arcade"]'); await until(() => window.BO.screen === 'select'); await pad.tap(0, A); await until(() => window.BO.screen === 'story');
    for (let i = 0; i < 4; i++) {
      await pad.tap(0, A); await fighting(); const s = await snap(); assert.equal(s.mode, 'arcade');
      if (i === 3) { assert.equal(s.p[1].id, 'malgrave'); assert.equal(await page.evaluate(() => window.BO.match.fight.fighters[1].armor), 2, 'the boss starts warded'); await place(-60, 60); const hp = s.p[1].hp; await pad.tap(0, A); await until(() => window.BO.match.fight.fighters[1].armor === 1, null, 3000); const after = (await snap()).p[1]; assert(after.hp < hp && after.hp > hp - 30, 'the ward halves the hit'); assert.notEqual(after.state, 'hitstun', 'and he does not flinch'); await shot('boss'); }
      else assert.notEqual(s.p[1].id, 'cinder');
      await winRound(() => pad.tap(0, A)); await until(() => window.BO.screen === 'result', null, 25000); await pad.tap(0, A); await until(() => window.BO.screen === 'story', null, 8000);
    }
    assert.match(await page.locator('#story-kicker').innerText(), /ARCADE COMPLETE/); await shot('ending'); assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('blood-oath-save')).arcade.cinder), true); await pad.tap(0, A); await until(() => window.BO.screen === 'menu');
  });

  await check('the computer opponent plays a whole match on its own without stalling', async () => {
    await page.evaluate(() => { window.BO.settings.rounds = 1; window.BO.settings.time = 60; window.BO.session.chars = ['vesper', 'grit']; window.BO.session.kinds = ['cpu', 'cpu']; window.BO.session.arcade = null; window.BO.session.arenaIndex = 1; window.BO.startFight(); });
    await fighting(); await wait(4000); const s = await snap(); assert(s.p[0].hp < 1000 || s.p[1].hp < 1180, 'damage was dealt in the first seconds'); await until(() => window.BO.screen === 'result', null, 90000); await page.click('#result-menu'); await until(() => window.BO.screen === 'menu');
  });

  await check('settings: sliders work from a controller, remapping works, and everything survives a reload', async () => {
    await page.click('[data-go="settings"]'); await until(() => window.BO.screen === 'settings'); await page.focus('#s-music'); const v = Number(await page.inputValue('#s-music')); await pad.axis(0, 0, -1); await wait(90); await pad.axis(0, 0, 0); await wait(90); assert(Math.abs(Number(await page.inputValue('#s-music')) - (v - 0.05)) < 1e-6);
    await page.selectOption('#s-blood', 'off'); await page.check('#s-reducedFlash'); await page.locator('#remap button').nth(4).click(); await wait(100); await key('KeyQ'); assert.equal(await page.evaluate(() => window.BO.devices.keys.kb1.L), 'KeyQ'); assert.match(await page.locator('#remap button').nth(4).innerText(), /Q/);
    await page.click('#remap-tabs [data-dev="pad"]'); await page.locator('#remap button').nth(0).click(); await wait(100); await pad.tap(0, 5); assert.equal(await page.evaluate(() => window.BO.devices.padMap.L), 5, 'a controller button was rebound'); assert.equal(await page.evaluate(() => window.BO.devices.padMap.T), 0, 'and the clash was swapped rather than duplicated'); await shot('settings');
    await page.click('#settings-close'); await ready(); await pad.connect(0); await pad.connect(1); await wait(150); const s = await page.evaluate(() => ({ ...window.BO.settings, L: window.BO.devices.keys.kb1.L, padL: window.BO.devices.padMap.L })); assert.equal(s.blood, 'off'); assert.equal(s.reducedFlash, true); assert.equal(s.L, 'KeyQ'); assert.equal(s.padL, 5); assert(Math.abs(s.music - (v - 0.05)) < 1e-6);
    await page.click('[data-go="settings"]'); await page.click('#remap-reset'); await page.selectOption('#s-blood', 'full'); await page.uncheck('#s-reducedFlash'); await page.selectOption('#s-rounds', '2'); await page.selectOption('#s-time', '99'); assert.equal(await page.evaluate(() => window.BO.devices.padMap.L), 0); await page.click('#settings-close');
  });

  await check('the character guide lists every fighter\'s moves with frame data', async () => {
    await page.click('[data-go="guide"]'); await until(() => window.BO.screen === 'guide'); for (const name of ['CINDER', 'RIME', 'VESPER', 'GRIT']) { assert.match(await page.locator('#guide-name').innerText(), new RegExp(name, 'i')); assert(await page.locator('#guide-moves > div').count() >= 18); await pad.axis(0, 0, 1); await wait(90); await pad.axis(0, 0, 0); await wait(120); }
    await shot('guide'); await pad.tap(0, B); await until(() => window.BO.screen === 'menu');
  });

  await check('a fight holds a steady frame rate', async () => {
    await page.evaluate(() => { window.BO.session.chars = ['cinder', 'rime']; window.BO.session.kinds = ['cpu', 'cpu']; window.BO.session.arenaIndex = 2; window.BO.startFight(); }); await fighting(); await wait(1500);
    const fps = await page.evaluate(() => new Promise(done => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 >= 3000) done(n / 3); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); })); console.log('     measured ' + fps.toFixed(1) + ' frames per second at 1366×768'); assert(fps >= 50, `expected at least 50 fps, measured ${fps.toFixed(1)}`);
    await page.evaluate(() => window.BO.toMenu());
  });

  await check('small screens: the frame letterboxes with no sideways scrolling', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await wait(400); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); const box = await page.locator('#frame').boundingBox(); assert(box.width <= 390 && Math.abs(box.width / box.height - 16 / 9) < 0.02); await shot('small-screen'); await page.setViewportSize({ width: 1366, height: 768 });
  });

  await check('the arcade library lists BLOOD OATH first and shows arcade progress', async () => {
    await page.goto(base + '/index.html'); const card = page.locator('.game-card').first(); assert.equal(await card.locator('.game-link').getAttribute('href'), 'blood-oath.html'); assert.match(await card.locator('.game-best').innerText(), /ARCADE CLEARED WITH 1 OF 4/); await shot('library');
  });

  await check('blocked browser storage: the game still starts and plays', async () => {
    const isolated = await browser.newContext({ viewport: { width: 1280, height: 720 } }); await isolated.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
    const p = await isolated.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(url); await p.waitForFunction(() => window.BO && window.BO.screen === 'menu', null, { timeout: 30000 }); await p.click('[data-go="settings"]'); await p.selectOption('#s-blood', 'reduced'); await p.click('#settings-close'); assert.deepEqual(errs, []); await isolated.close();
  });

  assert.deepEqual(errors, [], 'no page errors'); assert.deepEqual(missing, [], 'no missing files');
  console.log(`\n${results.length} BLOOD OATH browser checks passed${site !== root ? ' against dist/' : ''}. Controllers were simulated, not physical.`);
  await browser.close(); server.close();
})().catch(async e => { console.error(e); if (errors.length) console.error('page errors:', errors); if (missing.length) console.error('missing:', missing); try { await browser?.close(); } catch { /* already closed */ } server.close(); process.exit(1); });
