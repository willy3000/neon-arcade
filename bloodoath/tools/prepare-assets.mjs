// Copies the sounds and music BLOOD OATH uses out of the downloaded CC0 packs into bloodoath/assets.
// Usage: node bloodoath/tools/prepare-assets.mjs <downloads-dir>   (the folder holding kenney/ and music/; see ASSET_MANIFEST.md)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const src = process.argv[2]; if (!src || !fs.existsSync(src)) { console.error('Pass the directory holding the downloaded packs.'); process.exit(1); }
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');
export const SFX = {
  swingL: ['rpg-audio', 'knifeSlice'], swingM: ['rpg-audio', 'knifeSlice2'], swingH: ['rpg-audio', 'chop'], hitL: ['impact-sounds', 'impactPunch_medium_000'], hitM: ['impact-sounds', 'impactPunch_medium_003'], hitH: ['impact-sounds', 'impactPunch_heavy_001'],
  hitDeep: ['impact-sounds', 'impactPunch_heavy_004'], cut: ['impact-sounds', 'impactSoft_medium_001'], block: ['impact-sounds', 'impactMetal_light_001'], blockH: ['impact-sounds', 'impactMetal_heavy_002'], parry: ['impact-sounds', 'impactBell_heavy_001'],
  armor: ['impact-sounds', 'impactPlate_heavy_001'], fireCast: ['sci-fi-sounds', 'laserLarge_002'], fireBurst: ['sci-fi-sounds', 'explosionCrunch_000'], fireHit: ['sci-fi-sounds', 'thrusterFire_001'], iceCast: ['digital-audio', 'phaserDown2'],
  iceHit: ['impact-sounds', 'impactGlass_medium_002'], iceBurst: ['impact-sounds', 'impactGlass_heavy_001'], iceBreak: ['impact-sounds', 'impactGlass_heavy_004'], arcCast: ['digital-audio', 'laser4'], draw: ['rpg-audio', 'drawKnife1'], chain: ['rpg-audio', 'metalLatch'],
  teleport: ['digital-audio', 'phaseJump3'], dive: ['digital-audio', 'phaseJump1'], stance: ['sci-fi-sounds', 'forceField_001'], hammer: ['sci-fi-sounds', 'lowFrequency_explosion_001'], grab: ['rpg-audio', 'cloth2'], slam: ['impact-sounds', 'impactSoft_heavy_003'],
  superStart: ['digital-audio', 'powerUp11'], superHit: ['sci-fi-sounds', 'explosionCrunch_003'], burst: ['sci-fi-sounds', 'forceField_003'], ko: ['sci-fi-sounds', 'lowFrequency_explosion_000'], knockdown: ['impact-sounds', 'impactSoft_heavy_000'],
  land: ['impact-sounds', 'footstep_concrete_001'], jump: ['rpg-audio', 'cloth1'], dash: ['rpg-audio', 'cloth3'], round: ['music-jingles', 'jingles_HIT09'], fight: ['music-jingles', 'jingles_HIT03'], win: ['music-jingles', 'jingles_STEEL16'], lose: ['music-jingles', 'jingles_STEEL05'],
  uiMove: ['interface-sounds', 'tick_001'], uiOk: ['interface-sounds', 'select_003'], uiStart: ['interface-sounds', 'confirmation_002'], uiBack: ['interface-sounds', 'back_002'], uiNo: ['interface-sounds', 'error_004'],
};
const MUSIC = { 'battle-theme-a.mp3': 'battleThemeA.mp3', 'determined-pursuit.mp3': 'determined_pursuit.mp3', 'boss-battle-2.mp3': 'boss_battle_2_metal.mp3' };

fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'sfx'), { recursive: true }); fs.mkdirSync(path.join(out, 'music'), { recursive: true });
const index = new Map(), kenney = path.join(src, 'kenney');
for (const pack of fs.readdirSync(kenney)) { const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ogg')) index.set(pack + '/' + e.name.slice(0, -4), p); } }; if (fs.statSync(path.join(kenney, pack)).isDirectory()) walk(path.join(kenney, pack)); }
for (const [name, [pack, stem]] of Object.entries(SFX)) { const file = index.get(pack + '/' + stem); if (!file) throw new Error(`Missing sound ${pack}/${stem}`); fs.copyFileSync(file, path.join(out, 'sfx', name + '.ogg')); }
for (const [to, from] of Object.entries(MUSIC)) fs.copyFileSync(path.join(src, 'music', from), path.join(out, 'music', to));
const files = []; let total = 0;
for (const dir of ['sfx', 'music']) for (const name of fs.readdirSync(path.join(out, dir)).sort()) { const data = fs.readFileSync(path.join(out, dir, name)); total += data.length; files.push({ file: `${dir}/${name}`, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') }); }
fs.writeFileSync(path.join(out, 'integrity.json'), JSON.stringify({ files }, null, 1));
console.log(`${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB written to bloodoath/assets`);
