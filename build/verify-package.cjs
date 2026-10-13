'use strict';
// Checks the game as it was actually built (release/win-unpacked by default, or the folder given as an argument):
// that everything the game needs is inside it, that nothing meant to stay behind came along, that it holds no
// credentials, and that the exe carries the switches build/after-pack.cjs sets. Run by `npm run dist:win`,
// `npm run dist:steam` and `npm run verify:package`. It reads the build; it does not start the game
// (electron/net/packaged-smoke.cjs does that).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const { getCurrentFuseWire, FuseV1Options } = require('@electron/fuses');
// How a fuse reads inside the exe: the characters '0' (off) and '1' (on).
const FuseState = { DISABLE: 48, ENABLE: 49 };
const { NtExecutable, NtExecutableResource, Resource } = require('resedit');

const root = path.resolve(__dirname, '..');
const appDir = path.resolve(process.argv[2] || path.join(root, 'release', 'win-unpacked'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const exe = path.join(appDir, `${pkg.build.productName}.exe`);
const archive = path.join(appDir, 'resources', 'app.asar');
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';
let passed = 0;
const pass = (what) => { passed++; console.log('PASS', what); };

(async () => {
  assert(fs.existsSync(exe), `No game at ${exe}. Build it first: npm run dist:steam (or dist:win).`);

  // ---- how the game is packaged ----
  assert(fs.existsSync(archive), 'resources/app.asar is missing');
  assert(!fs.existsSync(path.join(appDir, 'resources', 'app')), 'the game must not ship as loose files in resources/app');
  assert(!fs.existsSync(archive + '.unpacked'), 'nothing should be unpacked beside app.asar');
  assert(!fs.existsSync(path.join(appDir, 'resources', 'app-update.yml')), 'no auto-update configuration should ship');
  const entries = asar.listPackage(archive).map((f) => f.replace(/\\/g, '/').replace(/^\//, ''));
  // The listing names folders as well as files; a folder is whatever some other entry sits inside.
  const folders = new Set(entries.flatMap((f) => f.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))));
  const files = entries.filter((f) => !folders.has(f));
  const read = (f) => asar.extractFile(archive, f.split('/').join(path.sep));
  pass(`the game ships as one archive, resources/app.asar (${files.length} files, ${mb(fs.statSync(archive).size)})`);

  // ---- nothing that should have stayed behind ----
  const forbidden = [/(^|\/)(tests|tools|qa|source|node_modules|\.git)\//, /\.map$/, /\.cjs$/, /\.py$/, /(^|\/)\.env/, /\.(pem|key|pfx|p12)$/];
  const strays = files.filter((f) => forbidden.some((r) => r.test(f)) || (/\.md$/.test(f) && f !== 'blackout/vendor/LICENSE.md'));
  assert.deepEqual(strays, [], 'development files inside the package');
  for (const f of files.filter((f) => /\.(js|css)$/.test(f))) assert(!/sourceMappingURL=/.test(read(f).toString('utf8')), `${f} points at a source map`);
  const inner = JSON.parse(read('package.json').toString('utf8'));
  assert.equal(inner.main, 'electron/main.js');
  for (const key of ['scripts', 'devDependencies', 'build']) assert(!(key in inner), `the packaged package.json still carries "${key}"`);
  assert.equal(inner.version, pkg.version);
  pass('no tests, tools, QA captures, asset sources, documents, source maps or dependencies were packaged');

  // ---- everything the game needs, identical to the source the tests ran against ----
  for (const f of files.filter((f) => f !== 'package.json')) {
    const source = path.join(root, f);
    assert(fs.existsSync(source), `${f} is in the package but not in the project`);
    // Text may be checked out with CRLF; the content has to match, whichever line ending the build picked up.
    const a = read(f), b = fs.readFileSync(source);
    assert(a.equals(b), `${f} in the package differs from the project's copy`);
  }
  const html = read('blackout-protocol.html').toString('utf8');
  const need = new Set(['electron/main.js', 'electron/preload.js', 'electron/net/host.js', 'electron/net/guest.js', 'electron/icon.png', 'blackout/vendor/LICENSE.md']);
  for (const m of html.matchAll(/(?:src|href)="(blackout\/[^"?#]+)"/g)) need.add(m[1]);
  const audio = read('blackout/audio.js').toString('utf8');
  for (const m of audio.match(/const files=\[([^\]]+)\]/)[1].replace(/^\s*\/\/.*$/gm, '').matchAll(/'([^']+)'/g)) need.add('blackout/assets/audio/' + m[1]);
  need.add(audio.match(/MUSIC='([^']+)'/)[1]);
  for (const sheet of ['blackout/style.css', 'blackout/fonts.css']) for (const m of read(sheet).toString('utf8').matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) if (!/^(data:|#|%23)/.test(m[1])) need.add('blackout/' + m[1]);
  // Every file of the game's own asset folders (pictures, atlases, sounds, typefaces, licences) has to be there.
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'source' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]));
  for (const f of walk(path.join(root, 'blackout', 'assets'))) need.add(path.relative(root, f).replace(/\\/g, '/'));
  const missing = [...need].filter((f) => !files.includes(f));
  assert.deepEqual(missing, [], 'files the game needs are missing from the package');
  pass(`all ${need.size} files the game refers to are in the package and match the project byte for byte`);

  // ---- no credentials, and no address the game is not meant to reach ----
  const secrets = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/, /\bsk-[A-Za-z0-9_-]{24,}/, /\bAIza[0-9A-Za-z_-]{35}\b/,
    /\b(?:api[_-]?key|client[_-]?secret|secret[_-]?key|password|passwd|auth[_-]?token|access[_-]?token)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i];
  const text = files.filter((f) => /\.(js|json|css|html|txt|md|svg)$/.test(f));
  const loose = fs.readdirSync(appDir).filter((f) => /\.(txt|json|yml|yaml|cfg|ini|env)$/i.test(f)).map((f) => path.join(appDir, f));
  const leaks = [];
  for (const [name, body] of [...text.map((f) => [f, read(f).toString('utf8')]), ...loose.map((f) => [path.basename(f), fs.readFileSync(f, 'utf8')])]) for (const r of secrets) { const m = r.exec(body); if (m) leaks.push(`${name}: ${m[0].slice(0, 40)}`); }
  assert.deepEqual(leaks, [], 'something that looks like a credential is in the package');
  const relay = /url:\s*'([^']*)'/.exec(read('blackout/online-config.js').toString('utf8'))?.[1] || '';
  assert(relay === '' || /^wss:\/\/[a-z0-9.-]+(:\d+)?(\/\S*)?$/i.test(relay), `the packaged relay address must be empty or wss:// (found "${relay}")`);
  const allowedHosts = new Set(['127.0.0.1', 'localhost', 'www.w3.org', 'opengameart.org', 'creativecommons.org', 'kenney.nl', ...(relay ? [new URL(relay).hostname] : [])]);
  const hosts = new Set();
  for (const f of text.filter((f) => f !== 'blackout/vendor/phaser.js' && f !== 'blackout/vendor/LICENSE.md' && !f.startsWith('blackout/assets/licenses/'))) for (const m of read(f).toString('utf8').matchAll(/\b(?:https?|wss?):\/\/([A-Za-z0-9.-]+)/g)) hosts.add(m[1].toLowerCase());
  const unexpected = [...hosts].filter((h) => !allowedHosts.has(h) && !/^(your-address|example\.com)$/.test(h));
  assert.deepEqual(unexpected, [], 'the game code names a network address that is not on the expected list');
  pass(`no credentials found; the only outside addresses in the game code are the relay (${relay || 'none set'}) and the three credit links`);

  // ---- the exe ----
  const wire = await getCurrentFuseWire(exe);
  const expected = { RunAsNode: FuseState.DISABLE, EnableNodeOptionsEnvironmentVariable: FuseState.DISABLE, EnableNodeCliInspectArguments: FuseState.DISABLE, EnableEmbeddedAsarIntegrityValidation: FuseState.ENABLE, OnlyLoadAppFromAsar: FuseState.ENABLE, GrantFileProtocolExtraPrivileges: FuseState.DISABLE };
  for (const [name, state] of Object.entries(expected)) assert.equal(wire[FuseV1Options[name]], state, `fuse ${name} is not ${state === FuseState.ENABLE ? 'on' : 'off'}`);
  pass('exe fuses: no run-as-Node, no NODE_OPTIONS, no --inspect, code only from app.asar, app.asar checksum enforced');
  const resources = NtExecutableResource.from(NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true }));
  const integrity = resources.entries.find((e) => e.type === 'INTEGRITY' && e.id === 'ELECTRONASAR');
  assert(integrity, 'the exe has no app.asar checksum embedded');
  const recorded = JSON.parse(Buffer.from(integrity.bin).toString('utf8'));
  assert(recorded.some((r) => /app\.asar$/i.test(r.file) && r.alg.toLowerCase() === 'sha256' && /^[0-9a-f]{64}$/i.test(r.value)), 'the embedded checksum does not describe resources/app.asar');
  // The checksum Electron compares at start-up is that of the archive's header (its table of files and their own checksums).
  const headerHash = sha(asar.getRawHeader(archive).headerString);
  assert(recorded.some((r) => r.value.toLowerCase() === headerHash), 'the checksum embedded in the exe is not the one of this app.asar');
  const version = Resource.VersionInfo.fromEntries(resources.entries)[0];
  const strings = version.getStringValues(version.getAllLanguagesForStringValues()[0]);
  assert.equal(strings.ProductName, pkg.build.productName);
  assert(strings.ProductVersion === pkg.version || strings.ProductVersion === pkg.version + '.0', `exe version ${strings.ProductVersion} is not ${pkg.version}`);
  pass(`exe is "${strings.ProductName}" ${strings.ProductVersion} by ${strings.CompanyName}, with the checksum of this app.asar embedded`);

  // ---- the folder around it ----
  for (const f of ['THIRD-PARTY-NOTICES.txt', 'licenses/fonts-OFL.txt', 'licenses/phaser-LICENSE.md', 'LICENSE.electron.txt', 'LICENSES.chromium.html']) assert(fs.existsSync(path.join(appDir, f)), `${f} is missing from the game folder`);
  const locales = fs.readdirSync(path.join(appDir, 'locales'));
  assert.deepEqual(locales, ['en-US.pak'], 'only the English Chromium locale should ship');
  const junk = walk(appDir).filter((f) => /\.(pdb|map|log|blockmap)$/i.test(f) || /(^|\\)(builder-debug\.yml|\.DS_Store)$/i.test(f));
  assert.deepEqual(junk, [], 'debug leftovers in the game folder');
  // One program: the game. No updater, installer helper or tool beside it.
  const programs = walk(appDir).filter((f) => /.(exe|bat|cmd|ps1|msi|scr|com)$/i.test(f)).map((f) => path.relative(appDir, f));
  assert.deepEqual(programs, [path.basename(exe)], 'the game folder should hold exactly one program');
  const total = walk(appDir).reduce((sum, f) => sum + fs.statSync(f).size, 0);
  pass(`licence notices are beside the exe; no debug leftovers; the whole game folder is ${mb(total)}`);

  console.log(`${passed} package checks passed for ${appDir}`);
})().catch((err) => { console.error('FAIL', err.message || err); process.exit(1); });
