'use strict';
// Starts the game as it was actually built - release/win-unpacked/Blackout Protocol.exe, or the folder given as the
// first argument (an installed copy, say) - and checks it the way a player's machine would meet it: launched from a
// path with spaces and non-English letters, from an unrelated working directory, with no project or developer tools
// beside it. It then drives the real window: loading, isolation from the web, a run, the controller reaching QUIT,
// saving, quitting, starting again, a second copy, a relay that is down, and a tampered archive.
//
// The released exe cannot be opened with --inspect (build/after-pack.cjs turns that off), which is how Playwright
// normally drives Electron, so this talks to the window over Chromium's own --remote-debugging-port instead.
//
//   node electron/net/packaged-smoke.cjs [folder] [--no-live-relay] [--no-tamper]
//
// --no-live-relay skips the one check that needs the internet (opening a lobby on the real relay);
// --no-tamper skips the check that copies the whole game (about 240 MB) to alter its archive.
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const EXE = `${pkg.build.productName}.exe`;
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const source = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(ROOT, 'release', 'win-unpacked'));
const SAVE_KEY = 'blackout-protocol-progress';
const shots = path.join(ROOT, 'release', 'smoke');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'BP smoke Ünïcødé 测试 '));
const running = new Set();
const results = [];
const note = (status, what) => { results.push([status, what]); console.log(status.padEnd(12), what); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const get = (url, headers = {}) => new Promise((resolve, reject) => { const u = new URL(url); http.get({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers }, (res) => { res.resume(); res.on('end', () => resolve(res)); }).on('error', reject); });
const exited = (game, ms) => Promise.race([game.done, sleep(ms).then(() => 'still running')]);
const profile = (name, save) => { const dir = path.join(scratch, name); fs.mkdirSync(dir, { recursive: true }); if (save) fs.writeFileSync(path.join(dir, 'save-store.json'), JSON.stringify({ [SAVE_KEY]: JSON.stringify(save) })); return dir; };
const savedIn = (dir) => JSON.parse(JSON.parse(fs.readFileSync(path.join(dir, 'save-store.json'), 'utf8'))[SAVE_KEY]);
const logOf = (dir) => { try { return fs.readFileSync(path.join(dir, 'logs', 'blackout.log'), 'utf8'); } catch { return ''; } };
const fresh = { version: 3, drill: true, settings: { volume: 0, callsign: 'ROOK' } };

// Starts one copy of the game. `attach` connects to its window; without it only the process is watched.
async function start(appDir, dir, { env = {}, attach = true } = {}) {
  const port = await freePort();
  const child = spawn(path.join(appDir, EXE), ['--windowed', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`], { cwd: os.tmpdir(), env: { ...process.env, ...env }, stdio: 'ignore' });
  const game = { child, dir, port, code: undefined };
  game.done = new Promise((resolve) => child.once('exit', (code) => { game.code = code; running.delete(game); resolve(code); }));
  running.add(game);
  if (!attach) return game;
  for (let i = 0; i < 150 && game.code === undefined; i++) { try { if ((await get(`http://127.0.0.1:${port}/json/version`)).statusCode === 200) break; } catch { /* not up yet */ } await sleep(200); }
  assert.equal(game.code, undefined, `the game exited at once (code ${game.code}) instead of opening its window`);
  game.browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  for (let i = 0; i < 100 && !game.browser.contexts()[0]?.pages().length; i++) await sleep(100);
  game.page = game.browser.contexts()[0].pages()[0];
  assert(game.page, 'the game opened no window');
  await loaded(game.page);
  return game;
}
const loaded = (page) => page.waitForFunction(() => document.getElementById('loading')?.hidden && window.BPApp, null, { timeout: 30000 });
const modeIs = (page, mode, timeout = 10000) => page.waitForFunction((m) => window.BPApp.snapshot().mode === m, mode, { timeout });
async function stop(game) {
  if (!game || game.code !== undefined) return;
  try { await game.browser?.close(); } catch { /* already gone */ }
  try { execFileSync('taskkill', ['/PID', String(game.child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* already gone */ }
  await exited(game, 5000);
}
// The player's way out: QUIT on the main menu, pressed twice.
async function quit(game) {
  await game.page.click('#quit-button');
  await game.page.waitForFunction(() => document.getElementById('quit-button').classList.contains('armed'));
  await game.page.click('#quit-button').catch(() => { /* the window may close under the click */ });
  return exited(game, 10000);
}

(async () => {
  assert(fs.existsSync(path.join(source, EXE)), `No game at ${source}. Build it first: npm run dist:steam`);
  fs.mkdirSync(shots, { recursive: true });
  // A folder junction gives the game a path with spaces and non-English letters without copying 240 MB.
  const appDir = path.join(scratch, 'Stëam Library (测试)', 'Blackout Protocol');
  fs.mkdirSync(path.dirname(appDir), { recursive: true });
  fs.symlinkSync(source, appDir, 'junction');

  // ---- 1. start-up, from an awkward path, in a hostile environment ----
  const dir = profile('Üser Dätä 用户', fresh);
  // A shell that sets these would turn an ordinary Electron exe into a Node.js interpreter, or inject options into it.
  let game = await start(appDir, dir, { env: { ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '--no-such-option' } });
  let page = game.page;
  note('PASSED', `starts from "${appDir}" with its data in "${dir}", from another working directory, ignoring ELECTRON_RUN_AS_NODE and NODE_OPTIONS`);

  // ---- 2. every file loads; nothing fails; the page is locked down ----
  // The first load is allowed to finish before anything is recorded: reloading while a typeface is still arriving
  // would count that interrupted download as a failure.
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForLoadState('networkidle');
  const problems = [], responses = [];
  page.on('pageerror', (e) => problems.push('error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => problems.push('request failed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  page.on('response', (r) => { responses.push(r); if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.reload();
  await loaded(page);
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  const origin = new URL(page.url()).origin;
  const doc = responses.find((r) => r.url().startsWith(origin + '/blackout-protocol.html'));
  const csp = (await doc.allHeaders())['content-security-policy'] || '';
  assert.match(csp, /default-src 'self'/); assert.match(csp, /script-src 'self'(;|$)/); assert.match(csp, /object-src 'none'/);
  // blob: and data: addresses are pictures and sound the page made itself out of files it had already loaded.
  const own = (u) => u.startsWith(origin + '/') || u.startsWith(`blob:${origin}/`) || u.startsWith('data:');
  assert(responses.every((r) => own(r.url())), 'start-up asked for something that is not one of the game\'s own files: ' + responses.map((r) => r.url()).filter((u) => !own(u)).join(', '));
  for (const face of ['700 20px "Barlow Condensed"', '400 12px "IBM Plex Mono"', '400 12px Inter']) assert.equal(await page.evaluate((f) => document.fonts.check(f), face), true, `typeface not loaded: ${face}`);
  assert.deepEqual(problems, [], 'problems while loading');
  note('PASSED', `loads ${responses.length} files from its own archive with no failed request, missing file or console error; typefaces loaded; nothing fetched from the network`);

  const world = await page.evaluate(() => ({ require: typeof require, process: typeof process, module: typeof module, net: !!window.BPNet?.available, store: typeof window.BPStore?.getItem, desktop: typeof window.BPDesktop?.quit, qa: typeof window.BPQA }));
  assert.deepEqual(world, { require: 'undefined', process: 'undefined', module: 'undefined', net: true, store: 'function', desktop: 'function', qa: 'undefined' });
  const pagesBefore = game.browser.contexts()[0].pages().length;
  assert.equal(await page.evaluate(() => window.open('https://example.com/') === null), true, 'window.open must be refused');
  assert.equal(game.browser.contexts()[0].pages().length, pagesBefore, 'no second window may open');
  // Steering the window elsewhere is tried in a copy of its own: the refused navigation leaves the test driver
  // waiting for a page load that never comes, so that window is not used again afterwards.
  {
    const probe = await start(appDir, profile('navigation', fresh));
    const home = probe.page.url();
    await probe.page.evaluate(() => { setTimeout(() => { location.href = 'https://example.com/'; }, 0); });
    await sleep(1500);
    const targets = await new Promise((resolve, reject) => http.get(`http://127.0.0.1:${probe.port}/json/list`, (res) => { let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => resolve(JSON.parse(body))); }).on('error', reject));
    await stop(probe);
    assert.deepEqual(targets.filter((x) => x.type === 'page').map((x) => x.url), [home], 'the window must not be steerable to another address');
  }
  assert.equal((await get(origin + '/blackout-protocol.html', { Host: 'evil.example' })).statusCode, 403, 'a request under another host name must be refused');
  for (const p of ['/package.json', '/electron/main.js', '/blackout/..%2fpackage.json', '/blackout/%2e%2e/electron/preload.js']) assert.notEqual((await get(origin + p)).statusCode, 200, `${p} must not be served`);
  assert.equal(await page.evaluate(() => fetch('https://example.com/', { mode: 'no-cors' }).then(() => 'reached', () => 'blocked')), 'blocked', 'the content policy must stop the page reaching other sites');
  assert.equal(await page.evaluate(() => { try { window.BPStore.setItem('__proto__', 'x'); return 'stored'; } catch { return 'refused'; } }), 'refused', 'the save store must refuse keys it does not know');
  problems.length = 0; // the two refused requests above are reported to the console, as they should be
  note('PASSED', 'page has no Node.js access, a content security policy, cannot open windows or leave for another address; the local server serves only the game\'s own files to its own window');

  // ---- 3. a run ----
  await page.screenshot({ path: path.join(shots, 'menu.png') });
  await page.click('#training');
  await modeIs(page, 'playing');
  const t0 = (await page.evaluate(() => window.BPApp.snapshot())).time;
  const x0 = (await page.evaluate(() => window.BPApp.snapshot())).x;
  await page.keyboard.down('KeyD');
  await page.waitForFunction((x) => window.BPApp.snapshot().x > x + 60, x0, { timeout: 5000 });
  await page.keyboard.up('KeyD');
  await sleep(2500);
  const run = await page.evaluate(() => window.BPApp.snapshot());
  assert(run.time > t0 + 1.5, 'the simulation must keep running');
  assert.equal(run.audioContext, 'running', 'sound must be available');
  assert(run.averageFps > 20, `frame rate is implausibly low (${run.averageFps})`);
  await page.screenshot({ path: path.join(shots, 'run.png') });
  await page.keyboard.press('Escape');
  await modeIs(page, 'paused');
  await page.click('#exit');
  await modeIs(page, 'menu');
  assert.deepEqual(problems, [], 'problems during the run');
  note('PASSED', `a training run starts, takes keyboard input, plays sound, pauses and returns to the menu (${Math.round(run.averageFps)} fps in a 1366x768 window on this machine; not a performance guarantee)`);

  // ---- 4. a setting is saved, QUIT closes the game cleanly, and the next start has the setting ----
  await page.click('#settings-button');
  await page.selectOption('#difficulty', 'story');
  await page.locator('#settings .primary').click();
  assert.equal(await quit(game), 0, 'QUIT pressed twice must end the game with exit code 0');
  assert.equal(savedIn(dir).settings.difficulty, 'story');
  assert(!fs.existsSync(path.join(dir, 'save-store.json.tmp')), 'no half-written save may be left behind');
  note('PASSED', 'QUIT on the main menu (pressed twice) closes the game with exit code 0 and the save is on disk');

  // ---- 5. the controller reaches QUIT; a second copy does not start; the log is clean ----
  game = await start(appDir, dir);
  page = game.page;
  assert.equal(await page.evaluate(() => window.BPApp.snapshot().save.settings.difficulty), 'story', 'the setting must survive a restart');
  const second = await start(appDir, dir, { attach: false });
  assert.equal(await exited(second, 10000), 0, 'a second copy must step aside');
  assert.equal(game.code, undefined, 'the first copy must keep running');
  note('PASSED', 'starting again restores the saved setting; a second copy exits and leaves the first running');

  await page.addInitScript(() => { window.__pad = { id: 'QA Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; navigator.getGamepads = () => [window.__pad]; });
  await page.reload();
  await loaded(page);
  const tap = async (i) => { await page.evaluate((b) => { window.__pad.buttons[b] = { pressed: true, value: 1 }; }, i); await sleep(90); await page.evaluate((b) => { window.__pad.buttons[b] = { pressed: false, value: 0 }; }, i); await sleep(90); };
  const tapUntil = async (i, test, tries = 12) => { for (let n = 0; n < tries; n++) { if (await page.evaluate(test)) return; await tap(i); } assert(await page.evaluate(test), 'the controller never got there'); };
  await tapUntil(0, () => document.body.classList.contains('pad'));
  await tapUntil(12, () => document.activeElement.id === 'quit-button');
  await tapUntil(0, () => document.getElementById('quit-button').classList.contains('armed'));
  await tap(0).catch(() => { /* the window closes under the button press */ });
  assert.equal(await exited(game, 10000), 0, 'a controller must be able to quit the game');
  // The log is where those sessions' problems would be. The requests this test provoked on purpose are in it (which
  // shows the log works); anything else is a failure.
  const log = logOf(dir), trouble = log.split('\n').filter((line) => /\[(fatal|page|uncaughtException|unhandledRejection|render-process-gone)\]/.test(line) && !line.includes('example.com'));
  assert(log.includes("[page] Refused to connect to 'https://example.com/'"), 'the refused request should have been logged');
  assert.deepEqual(trouble, [], 'the game logged a problem');
  note('PASSED', 'a controller alone can reach QUIT and close the game; three sessions left nothing in the log but the refusals this test provoked');

  // ---- 6. the relay is down ----
  const dead = await freePort();
  game = await start(appDir, profile('outage', fresh), { env: { BP_RELAY_URL: `ws://127.0.0.1:${dead}` } });
  page = game.page;
  await page.click('#holdout');
  await modeIs(page, 'lobby');
  await page.click('#op-peer [data-link="online"][data-role="host"]');
  await page.waitForFunction(() => /COULD NOT REACH THE ONLINE SERVICE/.test(document.getElementById('lobby-hint').textContent), null, { timeout: 15000 });
  await page.screenshot({ path: path.join(shots, 'relay-down.png') });
  // Leaving a hosted or joined lobby drops the player back into their own holdout lobby, not the main menu.
  await page.click('#lobby-leave');
  await page.waitForFunction(() => window.BPApp.snapshot().mode === 'lobby' && /MAIN MENU/.test(document.getElementById('lobby-leave').textContent), null, { timeout: 5000 });
  await page.click('#op-peer [data-link="online"][data-role="guest"]');
  await page.fill('#lobby-ip', 'ABCDE');
  await page.click('#lobby-connect');
  await page.waitForFunction(() => /COULD NOT REACH THE ONLINE SERVICE/.test(document.getElementById('lobby-join-status').textContent), null, { timeout: 15000 });
  await page.click('#lobby-leave');
  await page.waitForFunction(() => /MAIN MENU/.test(document.getElementById('lobby-leave').textContent), null, { timeout: 5000 });
  await page.click('#lobby-go');
  await modeIs(page, 'playing');
  await page.keyboard.press('Escape');
  await page.click('#exit');
  assert.equal(await quit(game), 0);
  note('PASSED', 'with the relay unreachable, hosting and joining online each say so, the menus stay usable, solo play still starts and the game still quits');

  // ---- 7. the real relay (needs the internet) ----
  if (flags.includes('--no-live-relay')) note('NOT RUN', 'opening a lobby on the real relay (skipped with --no-live-relay)');
  else {
    const host = await start(appDir, profile('live host', fresh));
    let guest;
    try {
      const relay = await host.page.evaluate(() => window.BPOnline.url);
      await host.page.click('#holdout');
      await host.page.click('#op-peer [data-link="online"][data-role="host"]');
      // A relay on a sleeping host can take most of a minute to wake.
      const opened = await host.page.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.getElementById('lobby-link-value').textContent) || /COULD NOT REACH|SERVICE IS FULL/.test(document.getElementById('lobby-hint').textContent), null, { timeout: 90000 }).then(() => host.page.textContent('#lobby-link-value'));
      if (!/^[A-Z0-9]{5}$/.test(opened)) note('NOT VERIFIED', `the relay at ${relay} could not be reached from this machine just now`);
      else {
        guest = await start(appDir, profile('live guest', { ...fresh, settings: { volume: 0, callsign: 'VIPER' } }));
        await guest.page.click('#holdout');
        await guest.page.click('#op-peer [data-link="online"][data-role="guest"]');
        await guest.page.fill('#lobby-ip', opened);
        await guest.page.click('#lobby-connect');
        await host.page.waitForFunction(() => window.BPApp.snapshot().lobby?.peer?.name === 'VIPER', null, { timeout: 30000 });
        await guest.page.waitForFunction(() => window.BPApp.snapshot().lobby?.peer?.name === 'ROOK', null, { timeout: 30000 });
        await guest.page.waitForFunction(() => window.BPApp.snapshot().lobby?.ping > 0, null, { timeout: 15000 });
        const ping = await guest.page.evaluate(() => window.BPApp.snapshot().lobby.ping);
        await guest.page.click('#lobby-go');
        await host.page.waitForFunction(() => !document.getElementById('lobby-go').disabled, null, { timeout: 10000 });
        await host.page.click('#lobby-go');
        await modeIs(host.page, 'playing', 15000);
        await modeIs(guest.page, 'playing', 15000);
        await guest.page.waitForFunction(() => window.BPApp.inspect().world.station && window.BPApp.inspect().world.time > 2, null, { timeout: 15000 });
        // The guest leaving is noticed by the host, who plays on alone.
        await guest.page.keyboard.press('Escape');
        await guest.page.click('#exit');
        await host.page.waitForFunction(() => !window.BPApp.snapshot().lobby?.peer, null, { timeout: 15000 });
        await host.page.keyboard.press('Escape');
        await host.page.click('#exit');
        note('PASSED', `two copies of the built game met through the real relay (${relay}), deployed into a shared run and parted cleanly; ${ping} ms between them from this machine`);
      }
    } finally { await stop(guest); await stop(host); }
  }

  // ---- 8. an altered archive ----
  if (flags.includes('--no-tamper')) note('NOT RUN', 'starting from an altered app.asar (skipped with --no-tamper)');
  else {
    const copy = path.join(scratch, 'tampered');
    fs.cpSync(source, copy, { recursive: true });
    const archive = path.join(copy, 'resources', 'app.asar'), bytes = fs.readFileSync(archive);
    const at = bytes.indexOf(Buffer.from('// Blackout Protocol loads its atlases'));
    assert(at > 0, 'could not find the main script inside app.asar');
    bytes[at + 3] ^= 0x20; // one letter of one comment in electron/main.js
    fs.writeFileSync(archive, bytes);
    const altered = await start(copy, profile('tampered profile'), { attach: false });
    const code = await exited(altered, 20000);
    await stop(altered);
    assert(code !== 'still running' && code !== 0, `a game whose archive was altered must refuse to start (it ${code === 0 ? 'exited normally' : 'kept running'})`);
    note('PASSED', `with one byte of app.asar changed the game refuses to start (exit code ${code})`);
  }

  const tally = (s) => results.filter((r) => r[0] === s).length;
  console.log(`\nPackaged build smoke test: ${tally('PASSED')} passed, ${tally('NOT RUN')} not run, ${tally('NOT VERIFIED')} not verified.  Build: ${source}`);
})().catch((err) => { console.error('FAILED', err); process.exitCode = 1; }).finally(async () => {
  for (const game of [...running]) await stop(game);
  // The junction is removed first and on its own, so that clearing the scratch folder can never reach into the build.
  for (const link of [path.join(scratch, 'Stëam Library (测试)', 'Blackout Protocol')]) try { fs.rmdirSync(link); } catch { /* never made */ }
  try { fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* a closing process still holds a file */ }
});
