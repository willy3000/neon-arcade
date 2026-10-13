'use strict';
// Real-Chromium checks of how the game behaves when something goes wrong or when only a controller is in hand:
// messages raised outside a run are actually shown, a fault inside a frame does not freeze the game, and a controller
// can reach every control it needs, including the text fields of the lobby. Web build, no desktop shell required.
//   node blackout/tests/resilience.cjs      (npm run test:resilience)
const { chromium } = require('playwright'), http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), errors = [];
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; } fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data); }); });
let browser, passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('PASS', name); }
const ready = async (page, url) => { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.getElementById('loading')?.hidden && window.BPApp, null, { timeout: 30000 }); };
const mode = (page, m) => page.waitForFunction((x) => BPApp.snapshot().mode === x, m, { timeout: 10000 });
// What a player would actually see: the element is laid out, opaque and inside the window.
const shown = (page, id) => page.evaluate((i) => { const el = document.getElementById(i), r = el.getBoundingClientRect(); return el.offsetParent !== null || getComputedStyle(el).position === 'fixed' ? Number(getComputedStyle(el).opacity) > .9 && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight : false; }, id);
const save = (extra = {}) => JSON.stringify({ version: 3, drill: true, credits: 0, settings: { flash: true, volume: 0 }, ...extra });
const padStub = () => { window.__pad = { id: 'QA Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; navigator.getGamepads = () => [window.__pad]; };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/blackout-protocol.html`;
  browser = await chromium.launch({ headless: true });
  const open = async (init, query = '') => { const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); await ctx.addInitScript(init || (() => { navigator.getGamepads = () => []; })); const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); await ready(page, url + query); return { ctx, page }; };

  await check('a message raised outside a run is shown: the armory says why a purchase was refused', async () => {
    const { ctx, page } = await open();
    await page.evaluate((s) => localStorage.setItem('blackout-protocol-progress', s), save());
    await ready(page, url);
    await page.click('#armory-button');
    await mode(page, 'armory');
    await page.locator('#armory-list .armory-item:not(.owned)').first().click();
    await page.locator('#armory-detail .ad-actions button').first().click(); // nothing can be afforded with an empty wallet
    await page.waitForFunction(() => document.getElementById('toast').textContent.length > 0);
    await page.waitForTimeout(400); // it fades in
    assert.equal(await shown(page, 'toast'), true, 'the reason must be visible on the armory screen, not only during a run');
    if (process.env.BP_SHOTS) await page.screenshot({ path: path.join(process.env.BP_SHOTS, 'armory-toast.png') });
    assert.equal(await page.evaluate(() => BPApp.snapshot().save.owned.weapons.length), 2, 'nothing was bought');
    await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('toast')).opacity) < .1, null, { timeout: 8000 });
    await ctx.close();
  });

  await check('a fault inside a frame does not freeze the game: the run is abandoned with a message and the next one plays', async () => {
    const { ctx, page } = await open(null, '?qa=1');
    const reported = [];
    page.on('console', (m) => { if (m.type() === 'error') reported.push(m.text()); });
    await page.click('#training');
    await mode(page, 'playing');
    await page.evaluate(() => { BPQA.sim().enemies = 5; }); // the simulation now throws on every step
    await page.waitForFunction(() => document.body.dataset.phase === 'menu', null, { timeout: 10000 }); // (the test hook itself cannot read a broken world)
    await page.waitForTimeout(400);
    assert.equal(await shown(page, 'toast'), true, 'the player is told what happened');
    if (process.env.BP_SHOTS) await page.screenshot({ path: path.join(process.env.BP_SHOTS, 'fault-toast.png') });
    assert.match(await page.textContent('#toast'), /SOMETHING WENT WRONG/);
    assert(reported.length > 0 && reported.length <= 20, 'the fault is reported to the console (and so to the desktop log), without flooding it');
    await page.click('#training');
    await mode(page, 'playing');
    const t = await page.evaluate(() => BPApp.snapshot().time);
    await page.waitForFunction((t0) => BPApp.snapshot().time > t0 + .5, t, { timeout: 5000 });
    await ctx.close();
  });

  await check('a controller alone reaches every lobby control and armory action, backs out with B, and cannot switch itself off', async () => {
    const { ctx, page } = await open(padStub);
    const tap = async (i) => { await page.evaluate((b) => { window.__pad.buttons[b] = { pressed: true, value: 1 }; }, i); await page.waitForTimeout(80); await page.evaluate((b) => { window.__pad.buttons[b] = { pressed: false, value: 0 }; }, i); await page.waitForTimeout(80); };
    const until = async (i, test, tries = 25) => { for (let n = 0; n < tries; n++) { if (await page.evaluate(test)) return; await tap(i); } assert(await page.evaluate(test), 'the controller never got there: ' + test); };
    await until(0, () => document.body.classList.contains('pad'));
    // Down from the campaign card lands on the card under it, and left of that is HOLDOUT: the focus follows the layout.
    await until(13, () => document.activeElement.id === 'training');
    await until(14, () => document.activeElement.id === 'holdout');
    await tap(0);
    await mode(page, 'lobby');
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'), true, 'the focused control is outlined');
    // Every control on the lobby screen can be walked to with the D-pad from where the focus starts - the callsign
    // field and both HOST / JOIN pairs included - and none of them is a dead end.
    const names = await page.evaluate(() => { const list = [...document.querySelectorAll('#lobby button,#lobby input[type="text"]'), document.getElementById('sound'), document.getElementById('settings-button')].filter((b) => b.offsetParent !== null && !b.disabled); list.forEach((el, i) => { el.dataset.nav = String(i); }); return list.map((el) => el.id || el.dataset.role + ' ' + el.dataset.link || el.className); });
    const at = () => page.evaluate(() => (document.activeElement?.dataset?.nav === undefined ? null : Number(document.activeElement.dataset.nav)));
    const start = await at(), edges = [];
    for (let i = 0; i < names.length; i++) { edges[i] = []; for (const b of [12, 13, 14, 15]) { await page.evaluate((n) => document.querySelector(`[data-nav="${n}"]`).focus(), i); await tap(b); edges[i].push(await at()); } }
    const seen = new Set([start]), queue = [start];
    while (queue.length) for (const to of edges[queue.shift()]) if (to !== null && !seen.has(to)) { seen.add(to); queue.push(to); }
    assert.deepEqual(names.filter((_, i) => !seen.has(i)), [], 'lobby controls a controller cannot reach');
    assert.deepEqual(names.filter((_, i) => edges[i].every((to) => to === i)), [], 'lobby controls a controller cannot leave');
    assert(names.includes('lobby-callsign') && names.includes('host online'), 'the callsign field and the online HOST button are among them');
    await tap(1); // B backs out to the main menu
    await mode(page, 'menu');
    // In the armory, right of the list are the selected item's actions, and each can be stepped to.
    await until(13, () => document.activeElement.id === 'training');
    await until(15, () => document.activeElement.id === 'armory-button');
    await tap(0);
    await mode(page, 'armory');
    await until(15, () => !!document.activeElement.closest('#armory-detail'));
    const actions = await page.evaluate(() => document.querySelectorAll('#armory-detail .ad-actions button').length);
    const visited = new Set();
    for (let i = 0; i < actions * 2; i++) { visited.add(await page.evaluate(() => [...document.querySelectorAll('#armory-detail .ad-actions button')].indexOf(document.activeElement))); await tap(13); }
    visited.delete(-1);
    assert.equal(visited.size, actions, `all ${actions} actions of an armory item can be reached`);
    // The controller cannot switch itself off in the settings.
    await page.evaluate(() => document.getElementById('settings-button').click());
    await page.evaluate(() => document.getElementById('gamepad').focus());
    await tap(0); await tap(15);
    assert.equal(await page.evaluate(() => document.getElementById('gamepad').checked), true, 'the Controller setting stays on when pressed with the controller');
    await tap(1);
    await page.waitForFunction(() => !document.getElementById('settings').open);
    await tap(1);
    await mode(page, 'menu');
    assert.equal(await page.evaluate(() => document.getElementById('quit-button').hidden), true, 'QUIT belongs to the desktop app and stays out of the browser build');
    await ctx.close();
  });

  assert.deepEqual(errors, [], 'uncaught page errors');
  console.log(`${passed} resilience checks passed.`);
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.close(); });
