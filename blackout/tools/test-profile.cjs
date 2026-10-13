'use strict';
// A maxed-out profile for trying things out in the desktop app, and the way back from it.
//   node blackout/tools/test-profile.cjs apply     back up the real save, then give it rank 15, 250,000 credits,
//                                                  every gun, gadget, field support and perk, and every campaign operation finished
//                                                  (which unlocks every map). Settings, callsign, upgrades, mastery
//                                                  and records are left as they are.
//   node blackout/tools/test-profile.cjs restore   put the backed-up save back and remove the backup
//   node blackout/tools/test-profile.cjs status    say which of the two is in place
// The desktop app reads its save once at start-up and writes it back whenever something changes, so quit the game
// before running either command: a copy that is still open will overwrite the file with what it has in memory.
// Pass a folder as the last argument to work on a different profile (the app's own --user-data-dir).
const fs = require('node:fs'), path = require('node:path');
const World = require('../world.js'), Meta = require('../meta.js'), Save = require('../save.js');
const [action = 'status', dirArg] = process.argv.slice(2);
const dir = dirArg || path.join(process.env.APPDATA || '', 'Blackout Protocol');
const file = path.join(dir, 'save-store.json'), backup = path.join(dir, 'save-store.before-test-profile.json');
const RANK = 15, CREDITS = 250000;
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };

if (action === 'apply') {
  if (!fs.existsSync(dir)) { console.error('No save folder at ' + dir + ' (run the game once first).'); process.exit(1); }
  // The first backup is the real save. Applying twice must not replace it with an already-maxed one.
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, fs.existsSync(file) ? fs.readFileSync(file) : '{}');
  const store = read(file), save = Save.decode(store[Save.KEY] || '{}');
  save.credits = CREDITS;
  save.xp = Math.max(save.xp, Meta.need(RANK));
  save.owned = { weapons: Object.keys(World.weapons), gear: Object.keys(World.gear), support: Object.keys(World.support), perks: Object.keys(World.perks) };
  save.seen = [...save.owned.weapons, ...save.owned.gear, ...save.owned.support, ...save.owned.perks];
  for (const m of World.missions) {
    const done = Meta.mission(save, m.id);
    done.done = true;
    if (!done.medals.includes('complete')) done.medals.push('complete');
    if (!done.diffs.includes('standard')) done.diffs.push('standard');
  }
  save.run = null; save.drill = true; save.notice = '';
  fs.writeFileSync(file, JSON.stringify({ ...store, [Save.KEY]: JSON.stringify(save) }));
  const r = Meta.rankOf(save.xp);
  console.log(`Test profile written to ${file}\n  rank ${r.rank} (${r.title}), ${save.credits.toLocaleString('en-US')} CR, ${save.owned.weapons.length} guns, ${save.owned.gear.length} gadgets, ${save.owned.support.length} field support, ${save.owned.perks.length} perks, ${World.missions.length} operations done, ${World.holdoutMaps.length} maps open.\n  The real save is kept at ${backup}`);
} else if (action === 'restore') {
  if (!fs.existsSync(backup)) { console.error('No backup at ' + backup + ': the real save is already in place.'); process.exit(1); }
  fs.copyFileSync(backup, file); fs.rmSync(backup);
  console.log('Real save restored to ' + file);
} else {
  const s = Save.decode(read(file)[Save.KEY] || '{}');
  console.log(`${fs.existsSync(backup) ? 'TEST PROFILE in place (real save backed up)' : 'Real save in place'}: rank ${Meta.rankOf(s.xp).rank}, ${s.credits.toLocaleString('en-US')} CR, ${s.owned.weapons.length} guns, ${s.owned.gear.length} gadgets, ${World.missions.filter((m) => s.missions[m.id]?.done).length} operations done.`);
}
