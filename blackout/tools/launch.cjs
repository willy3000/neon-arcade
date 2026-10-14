'use strict';
// Starts the desktop app on a profile of its own, so trying things out never touches the player's real save.
//   node blackout/tools/launch.cjs test    a maxed-out profile (everything unlocked; see test-profile.cjs), kept in
//                                          "Blackout Protocol Test" next to the real save folder and reused each time
//   node blackout/tools/launch.cjs fresh   a brand-new player: an empty profile in a temporary folder, deleted on quit
// Anything after the mode is passed on to the app (for example --windowed).
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { spawn, execFileSync } = require('node:child_process');
const electron = require('electron'), root = path.join(__dirname, '..', '..');
const [mode = 'fresh', ...rest] = process.argv.slice(2);
const appData = process.env.APPDATA || path.join(os.homedir(), '.config');

let dir, cleanup = false;
if (mode === 'test') {
  dir = path.join(appData, 'Blackout Protocol Test');
  fs.mkdirSync(dir, { recursive: true });
  // Rebuilt from scratch each time, so it always has everything, including anything added to the game since.
  fs.rmSync(path.join(dir, 'save-store.json'), { force: true });
  fs.writeFileSync(path.join(dir, 'save-store.json'), '{}');
  execFileSync(process.execPath, [path.join(__dirname, 'test-profile.cjs'), 'apply', dir], { stdio: 'ignore' });
  fs.rmSync(path.join(dir, 'save-store.before-test-profile.json'), { force: true });
  console.log('Test profile (everything unlocked) in ' + dir + '. Your own save is not touched.');
} else if (mode === 'fresh') {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blackout-fresh-'));
  cleanup = true;
  console.log('First-time player profile in ' + dir + ' (deleted when the game closes).');
} else {
  console.error('Usage: node blackout/tools/launch.cjs test|fresh [app options]');
  process.exit(1);
}

// A shell started by an editor built on Electron (VS Code) can carry ELECTRON_RUN_AS_NODE, which would start the game as
// plain Node with no window; the game never wants it.
const env = { ...process.env };delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', '--user-data-dir=' + dir, ...rest], { cwd: root, stdio: 'inherit', env });
child.on('exit', (code) => {
  if (cleanup) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  process.exit(code ?? 0);
});
