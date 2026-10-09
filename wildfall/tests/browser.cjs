// Real-browser checks for WILDFALL: loads the page in Chromium, plays with real key presses and reads the game state back.
// Run: node wildfall/tests/browser.cjs [--production]   (--production tests the built dist/ folder)
'use strict';
const { chromium } = require('playwright'), http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), site = process.argv.includes('--production') ? path.join(root, 'dist') : root, qa = path.join(root, 'wildfall/qa');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  let file; try { file = path.resolve(site, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); } catch { res.writeHead(400).end(); return; }
  if (file === site) file = path.join(site, 'index.html'); if (!file.startsWith(site + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data); });
});
const results = [], errors = [], missing = []; let browser, dump = async () => '';
async function check(name, fn) { try { await fn(); } catch (e) { console.log('FAIL', name, '\n     state: ' + await dump().catch(() => 'unavailable')); throw e; } results.push(name); console.log('PASS', name); }

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`, url = base + '/wildfall.html';
  // Ask for the real GPU; headless Chromium otherwise falls back to software rendering, which is far too slow to judge frame rate.
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage(); fs.mkdirSync(qa, { recursive: true });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400 && !r.url().includes('favicon')) missing.push(r.url()); });
  const snap = () => page.evaluate(() => window.WF.snapshot()), wait = ms => page.waitForTimeout(ms), shot = name => page.screenshot({ path: path.join(qa, name + '.png') });
  dump = () => page.evaluate(() => JSON.stringify({ ...window.WF.snapshot(), screen: document.body.dataset.screen, wfState: window.WF.state, held: [...window.WF.input.held], enabled: window.WF.input.enabled, focus: document.activeElement?.id }));
  const ready = async () => { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.body.dataset.screen === 'title', null, { timeout: 60000 }); };
  const start = async (level, hero) => {
    await page.click(level === 'proving' ? '#proving' : '#new-game'); await page.click(`[data-hero="${hero}"]`); await page.click('#select-go');
    await page.waitForFunction(() => ['cards', 'play'].includes(window.WF.state), null, { timeout: 60000 }); if (await page.locator('#cards').isVisible()) await page.click('#card-skip');
    await page.waitForFunction(() => window.WF.state === 'play'); await wait(400);
  };
  const place = (x, y) => page.evaluate(([x, y]) => { const p = window.WF.sim.player; p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.mode = 'normal'; p.rope = null; window.WF.renderer.snapCamera(window.WF.sim); }, [x, y]);
  const toTitle = async () => { await page.keyboard.press('Escape'); await page.click('#quit'); await page.waitForFunction(() => document.body.dataset.screen === 'title', null, { timeout: 60000 }); };

  await check('title loads every asset, shows the campaign and the proving grounds, and reports the renderer', async () => {
    await ready(); assert(await page.locator('#new-game').isVisible()); assert(await page.locator('#proving').isVisible());
    const gl = await page.evaluate(() => { const g = window.WF.renderer.gl.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; }); console.log('     renderer: ' + gl);
    await wait(800); await shot('title');
  });
  await check('hero select offers three heroes and remembers the choice', async () => {
    await page.click('#new-game'); assert.equal(await page.locator('.hero').count(), 3); await page.click('[data-hero="bragg"]'); assert.equal(await page.locator('#select-go-label').innerText(), 'PLAY AS BRAGG');
    await page.mouse.move(683, 120); await page.keyboard.press('ArrowLeft'); await page.waitForFunction(() => document.getElementById('select-go-label').textContent === 'PLAY AS SERA', null, { timeout: 3000 }); await wait(900); await shot('select'); await page.click('#select-back');
  });
  await check('real keys run, jump, double jump and air-dash', async () => {
    await start('proving', 'vyx'); const a = await snap(); await page.keyboard.down('KeyD'); await page.waitForFunction(x => window.WF.snapshot().x > x + 4, a.x);
    await page.keyboard.down('Space'); await page.waitForFunction(() => window.WF.snapshot().y > 1.6); await page.keyboard.up('Space'); // a held press jumps high; a tap is deliberately short
    await page.keyboard.down('Space'); await page.waitForFunction(() => window.WF.snapshot().y > 3.6); await page.keyboard.up('Space');
    await page.keyboard.press('ShiftLeft'); await page.waitForFunction(() => window.WF.snapshot().mode === 'dash'); await page.keyboard.up('KeyD'); await page.waitForFunction(() => window.WF.snapshot().onGround); assert((await snap()).x > a.x + 8);
  });
  await check('melee combo damages a training husk and builds a combo with real keys', async () => {
    await place(7.6, 0); await wait(300); for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyJ'); await wait(170); } await wait(200);
    const dealt = await page.evaluate(() => window.WF.sim.stats.damage); assert(dealt >= 25, `damage dealt ${dealt}`); assert((await page.evaluate(() => window.WF.sim.combo.best)) >= 3); await shot('combat');
  });
  await check('grapple latches, swings and releases with a real key held', async () => {
    await place(71, 10); await wait(300); await page.keyboard.down('KeyD'); await wait(450); await page.keyboard.press('Space'); await wait(140); await page.keyboard.down('KeyL');
    await page.waitForFunction(() => window.WF.snapshot().mode === 'grapple', null, { timeout: 5000 }); await wait(500); await shot('swing'); const mid = await snap(); assert(Math.hypot(mid.vx, mid.vy) > 6, 'swinging with speed');
    await page.keyboard.up('KeyL'); await page.waitForFunction(() => window.WF.snapshot().mode !== 'grapple'); await page.keyboard.up('KeyD'); await wait(1500);
  });
  await check('wall-run engages on a marked wall', async () => {
    await place(44, 10); await wait(300); await page.keyboard.down('KeyD'); await wait(480); await page.keyboard.press('Space'); await page.waitForFunction(() => window.WF.snapshot().mode === 'backrun', null, { timeout: 4000 }); await shot('wallrun'); await page.keyboard.up('KeyD'); await wait(1200);
  });
  await check('pause freezes the simulation and resume continues it', async () => {
    await place(0, 0); await wait(300); await page.keyboard.press('Escape'); assert.equal((await snap()).state, 'paused'); const t = (await snap()).time; await wait(500); assert.equal((await snap()).time, t);
    await page.click('#resume'); await wait(300); assert((await snap()).time > t); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); assert.equal((await snap()).state, 'paused'); await page.click('#resume');
  });
  await check('the three heroes play differently in the browser', async () => {
    await toTitle(); await start('proving', 'sera'); await place(0, 14); await page.keyboard.down('Space'); await wait(900); const glide = (await snap()).vy; await page.keyboard.up('Space'); assert(glide > -5 && glide < 0, `Sera glides at ${glide}`);
    await page.waitForFunction(() => window.WF.snapshot().onGround); await page.keyboard.press('KeyQ'); await wait(500); assert(await page.evaluate(() => window.WF.sim.world.solids.some(s => s.kind === 'ice' && !s.dead)), 'ice platform conjured'); await shot('sera');
    await toTitle(); await start('proving', 'bragg'); const b = await snap(); assert.equal(b.hp, 140); await page.keyboard.press('KeyE'); await page.waitForFunction(() => window.WF.snapshot().y > 5, null, { timeout: 4000 }); await shot('bragg'); await page.waitForFunction(() => window.WF.snapshot().onGround);
  });
  await check('a controller drives movement, jumping and the grapple', async () => {
    await page.evaluate(() => { const pad = { id: 'Test Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; window.__pad = pad; navigator.getGamepads = () => [pad, null, null, null]; });
    const axes = a => page.evaluate(a => { window.__pad.axes = a; }, a), hold = (i, on) => page.evaluate(([i, on]) => { window.__pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }, [i, on]);
    await place(66, 10); await wait(400); const x0 = (await snap()).x; await axes([1, 0, 0, 0]); await page.waitForFunction(x => window.WF.snapshot().x > x + 3, x0); assert.equal(await page.evaluate(() => window.WF.input.device), 'pad');
    await hold(0, true); await page.waitForFunction(() => window.WF.snapshot().y > 10.8); await hold(0, false); await axes([0, 0, 0, 0]); await page.waitForFunction(() => window.WF.snapshot().onGround);
    await place(74.5, 10); await wait(300); await axes([1, 0, 0.5, -0.86]); await wait(280); await hold(0, true); await wait(260); await hold(0, false); await hold(7, true); await page.waitForFunction(() => window.WF.snapshot().mode === 'grapple', null, { timeout: 5000 }); await hold(7, false); await axes([0, 0, 0, 0]);
    assert((await page.locator('#abilities .ability[data-slot="grapple"] kbd').innerText()) === 'RT', 'HUD shows controller labels'); await page.evaluate(() => { navigator.getGamepads = () => [null, null, null, null]; }); await wait(1500);
  });
  await check('campaign: intro cards, a checkpoint save, and CONTINUE after reloading the page', async () => {
    await toTitle(); await page.click('#new-game'); await page.click('[data-hero="vyx"]'); await page.click('#select-go'); await page.waitForFunction(() => window.WF.state === 'cards', null, { timeout: 60000 }); await wait(700); await shot('intro');
    await page.click('#card-next'); await page.click('#card-next'); await page.click('#card-next'); await page.waitForFunction(() => window.WF.state === 'play'); await wait(600); await shot('chapter1');
    await place(76, 11); await page.keyboard.down('KeyD'); await page.waitForFunction(() => window.WF.snapshot().checkpoint === 'a', null, { timeout: 5000 }); await page.keyboard.up('KeyD');
    await ready(); assert(await page.locator('#continue').isVisible(), 'continue offered'); await page.click('#continue'); await page.waitForFunction(() => window.WF.state === 'play', null, { timeout: 60000 }); const s = await snap(); assert.equal(s.checkpoint, 'a'); assert(Math.abs(s.x - 77) < 1 && Math.abs(s.y - 11) < 0.5, `resumed at ${s.x},${s.y}`);
  });
  await check('defeat returns the hero to the last checkpoint with full health', async () => {
    await page.evaluate(() => { const p = window.WF.sim.player; p.hp = 1; p.iframes = 0; p.x = 90; p.y = -60; }); // drop into the void with a sliver of health
    await page.waitForFunction(() => window.WF.sim.player.dead, null, { timeout: 5000 }); await page.waitForFunction(() => { const s = window.WF.snapshot(); return !window.WF.sim.player.dead && s.hp === 100 && Math.abs(s.x - 77) < 1; }, null, { timeout: 8000 });
    assert.equal((await snap()).checkpoint, 'a'); assert.equal(await page.evaluate(() => window.WF.sim.stats.deaths), 1);
  });
  await check('the first fight and the gate court run in the browser without errors', async () => {
    await place(134, 15); await page.waitForFunction(() => window.WF.sim.enemies.filter(e => e.group === 'courtyard').length === 3, null, { timeout: 8000 }); await wait(1200); await shot('gate-court');
    for (let i = 0; i < 14; i++) { await page.keyboard.press('KeyJ'); await wait(160); } await wait(400); assert((await snap()).hp > 0);
  });
  await check('settings persist and a corrupt save does not block play', async () => {
    await page.keyboard.press('Escape'); await page.click('#pause-settings'); await page.selectOption('#difficulty', 'story'); await page.locator('#reducedFlash').check(); await page.locator('#settings .settings-foot .primary').click();
    assert.equal(await page.evaluate(() => window.WF.save.settings.difficulty), 'story'); await ready(); assert.equal(await page.evaluate(() => window.WF.save.settings.difficulty), 'story'); assert.equal(await page.evaluate(() => window.WF.save.settings.reducedFlash), true);
    await page.evaluate(() => localStorage.setItem('wildfall-save', '{not json')); await ready(); assert(!(await page.locator('#continue').isVisible())); assert(await page.locator('#new-game').isVisible());
  });
  await check('small screens keep the menus inside the viewport', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await wait(500); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot('small-screen'); await page.setViewportSize({ width: 1366, height: 768 });
  });
  await check('the arcade library lists WILDFALL', async () => {
    const lib = await context.newPage(); await lib.goto(base); assert.equal(await lib.locator('.game-link[href="wildfall.html"]').count(), 1); assert.equal(await lib.locator('.game-card').count(), 8); await lib.screenshot({ path: path.join(qa, 'library.png') }); await lib.close();
  });

  // Frame rate while playing, on whatever this machine's browser gives us.
  await page.bringToFront(); await start('chapter1', 'vyx'); await place(140, 15); await wait(2500);
  const fps = await page.evaluate(() => new Promise(done => { const frames = []; let last = performance.now(); const tick = now => { frames.push(now - last); last = now; if (frames.length < 240) requestAnimationFrame(tick); else { frames.sort((a, b) => a - b); done({ median: Math.round(1000 / frames[120]), slowest5pct: Math.round(1000 / frames[228]) }); } }; requestAnimationFrame(tick); }));
  assert.deepEqual(errors, [], 'uncaught browser errors'); assert.deepEqual(missing, [], 'missing files');
  const report = { passed: results.length, results, fps, site: path.basename(site), note: 'Headless Chromium on this machine; not a guarantee for other hardware.' };
  fs.writeFileSync(path.join(qa, 'browser-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(fps)); console.log(`${results.length} real-browser checks passed.`);
})().catch(e => { console.error(e); if (errors.length) console.error('browser errors:', errors.slice(0, 5)); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.close(); });
