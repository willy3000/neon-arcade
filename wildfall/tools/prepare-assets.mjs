// Rebuilds wildfall/assets from the original CC0 packs. The packs themselves are not committed.
// Usage: node wildfall/tools/prepare-assets.mjs <downloads-dir>
// <downloads-dir> must contain the KayKit git clones and the unzipped Kenney packs listed in ASSET_MANIFEST.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('Pass the directory holding the downloaded packs.'); process.exit(1); }
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');
const heroDir = path.join(src, 'KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf');
const skelDir = path.join(src, 'KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons');
const dungeonDir = path.join(src, 'KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf');
const hexDir = path.join(src, 'KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf');
const kenney = path.join(src, 'kenney');

const HERO_CLIPS = ['Idle', '2H_Melee_Idle', 'Unarmed_Idle', 'Running_A', 'Running_B', 'Walking_A', 'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Dodge_Forward', 'Dodge_Backward',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin',
  '2H_Melee_Attack_Spinning', '2H_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab', 'Block', 'Blocking', 'Block_Hit', 'Block_Attack',
  'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long', 'Spellcasting', 'Throw', 'Hit_A', 'Hit_B', 'Death_A', 'Death_A_Pose', 'Death_B', 'Cheer', 'Interact', 'PickUp', 'Unarmed_Melee_Attack_Kick',
  'Use_Item', 'Sit_Floor_Pose', 'Lie_Pose'];
const SKELETON_CLIPS = ['Idle', 'Idle_Combat', 'Walking_A', 'Walking_D_Skeletons', 'Running_A', 'Running_C', 'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Dodge_Backward', '1H_Melee_Attack_Chop',
  '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin',
  '2H_Melee_Attack_Spinning', 'Block', 'Blocking', 'Block_Hit', 'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Summon', 'Spellcasting', 'Throw', 'Hit_A', 'Hit_B', 'Death_A', 'Death_A_Pose', 'Death_C_Skeletons',
  'Death_C_Pose', 'Skeletons_Awaken_Floor', 'Spawn_Air', 'Taunt', 'Cheer'];
const DUNGEON = ['pillar', 'pillar_decorated', 'column', 'wall', 'wall_half', 'wall_broken', 'wall_arched', 'wall_archedwindow_open', 'wall_cracked', 'wall_pillar', 'wall_gated', 'wall_doorway', 'rubble_large', 'rubble_half',
  'torch_lit', 'torch_mounted', 'barrel_large', 'barrel_small', 'barrel_small_stack', 'box_large', 'box_small', 'crates_stacked', 'chest', 'chest_gold', 'floor_tile_big_spikes', 'floor_tile_large', 'floor_tile_large_rocks',
  'floor_foundation_front', 'sword_shield_broken', 'sword_shield_gold', 'banner_patternA_red', 'banner_patternB_blue', 'banner_triple_yellow', 'banner_shield_red', 'banner_thin_white', 'coin', 'key', 'stairs',
  'barrier', 'barrier_column', 'keg', 'candle_triple'];
const HEX = { 'decoration/nature': ['tree_single_A', 'tree_single_B', 'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'trees_B_medium', 'trees_B_small', 'rock_single_A', 'rock_single_B', 'rock_single_C',
  'rock_single_D', 'rock_single_E', 'mountain_A', 'mountain_B', 'mountain_C', 'mountain_A_grass_trees', 'mountain_B_grass', 'hills_A_trees', 'hills_B', 'hill_single_A', 'hill_single_B', 'cloud_big', 'cloud_small'],
  'decoration/props': ['flag_red', 'flag_blue', 'tent', 'weaponrack', 'crate_A_big', 'barrel', 'target', 'ladder', 'resource_stone'],
  'buildings/neutral': ['building_destroyed', 'building_bridge_A', 'building_scaffolding', 'wall_straight', 'wall_straight_gate', 'wall_corner_A_outside'],
  'buildings/blue': ['building_castle_blue', 'building_tower_A_blue', 'building_tower_B_blue', 'building_church_blue', 'building_windmill_blue', 'building_watermill_blue'] };
// destination name -> [pack, file stem]
const AUDIO = {
  step0: ['impact-sounds', 'footstep_grass_000'], step1: ['impact-sounds', 'footstep_grass_001'], step2: ['impact-sounds', 'footstep_grass_002'], step3: ['impact-sounds', 'footstep_grass_003'],
  stone0: ['impact-sounds', 'footstep_concrete_000'], stone1: ['impact-sounds', 'footstep_concrete_001'], stone2: ['impact-sounds', 'footstep_concrete_002'],
  land: ['impact-sounds', 'impactSoft_heavy_000'], landHeavy: ['impact-sounds', 'impactSoft_heavy_003'], jump: ['rpg-audio', 'cloth1'], doubleJump: ['digital-audio', 'phaseJump1'], dash: ['digital-audio', 'phaseJump3'],
  wallJump: ['rpg-audio', 'cloth3'], slide: ['rpg-audio', 'cloth4'], swing0: ['rpg-audio', 'knifeSlice'], swing1: ['rpg-audio', 'knifeSlice2'], swing2: ['rpg-audio', 'drawKnife2'], swingHeavy: ['rpg-audio', 'chop'],
  hit0: ['impact-sounds', 'impactPunch_medium_000'], hit1: ['impact-sounds', 'impactPunch_medium_002'], hit2: ['impact-sounds', 'impactPunch_heavy_001'], hitHeavy: ['impact-sounds', 'impactPunch_heavy_004'],
  armor: ['impact-sounds', 'impactPlate_heavy_001'], block: ['impact-sounds', 'impactMetal_heavy_002'], parry: ['impact-sounds', 'impactBell_heavy_001'], bone0: ['impact-sounds', 'impactWood_medium_000'],
  bone1: ['impact-sounds', 'impactWood_heavy_002'], breakStone: ['impact-sounds', 'impactMining_002'], breakWood: ['impact-sounds', 'impactPlank_medium_003'],
  grappleFire: ['rpg-audio', 'drawKnife1'], grappleAttach: ['rpg-audio', 'metalLatch'], rope0: ['rpg-audio', 'creak1'], rope1: ['rpg-audio', 'creak2'], rope2: ['rpg-audio', 'creak3'], grappleRelease: ['rpg-audio', 'cloth2'],
  fire: ['sci-fi-sounds', 'thrusterFire_001'], fireball: ['sci-fi-sounds', 'laserLarge_002'], explosion0: ['sci-fi-sounds', 'explosionCrunch_000'], explosion1: ['sci-fi-sounds', 'explosionCrunch_003'],
  boom: ['sci-fi-sounds', 'lowFrequency_explosion_000'], slam: ['sci-fi-sounds', 'lowFrequency_explosion_001'], ice0: ['impact-sounds', 'impactGlass_heavy_001'], ice1: ['impact-sounds', 'impactGlass_medium_002'],
  iceBreak: ['impact-sounds', 'impactGlass_heavy_004'], zap0: ['digital-audio', 'zap1'], zap1: ['digital-audio', 'zap2'], zapChain: ['digital-audio', 'zapThreeToneDown'], shield: ['sci-fi-sounds', 'forceField_001'],
  shieldHit: ['sci-fi-sounds', 'forceField_003'], blade: ['digital-audio', 'laser4'], bounce: ['digital-audio', 'phaseJump5'], pickup: ['rpg-audio', 'handleCoins'], shard: ['digital-audio', 'powerUp7'],
  heal: ['digital-audio', 'powerUp3'], checkpoint: ['music-jingles', 'jingles_STEEL07'], unlock: ['music-jingles', 'jingles_STEEL10'], victory: ['music-jingles', 'jingles_STEEL16'], defeat: ['music-jingles', 'jingles_STEEL05'],
  bossIntro: ['music-jingles', 'jingles_HIT09'], enemyCast: ['digital-audio', 'phaserUp3'], enemyShot: ['digital-audio', 'laser7'], telegraph: ['digital-audio', 'tone1'], hurt: ['impact-sounds', 'impactPunch_heavy_002'],
  uiMove: ['interface-sounds', 'tick_001'], uiSelect: ['interface-sounds', 'select_003'], uiConfirm: ['interface-sounds', 'confirmation_002'], uiBack: ['interface-sounds', 'back_002'],
  gate: ['rpg-audio', 'doorOpen_1'], chest: ['rpg-audio', 'metalPot1'], tablet: ['rpg-audio', 'bookOpen'], flow: ['digital-audio', 'threeTone1'], perfect: ['digital-audio', 'powerUp11'],
};

const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file} is not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  return { json: JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')), bin: buf.subarray(20 + jsonLen + 8) };
}
function writeGlb(file, json, bin) {
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
  const header = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  jh.writeUInt32LE(text.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([header, jh, text, bh, bin]));
}
function floats(g, index) {
  const a = g.json.accessors[index], v = g.json.bufferViews[a.bufferView], off = g.bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
  return new Float32Array(g.bin.buffer.slice(off, off + a.count * TYPE_SIZE[a.type] * 4));
}
const REST = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
// Keeps the named clips, optionally removes meshes, drops tracks that never leave the rest pose, then compacts the binary.
function rewrite(g, { clips = [], meshes = true }) {
  const json = structuredClone(g.json);
  if (!meshes) {
    for (const n of json.nodes) { delete n.mesh; delete n.skin; }
    for (const key of ['meshes', 'skins', 'materials', 'textures', 'images', 'samplers']) delete json[key];
  }
  let dropped = 0, kept = 0;
  json.animations = (json.animations || []).filter(a => clips.includes(a.name)).map(a => {
    const channels = [], samplers = [];
    for (const c of a.channels) {
      const s = a.samplers[c.sampler], values = floats(g, s.output), width = TYPE_SIZE[json.accessors[s.output].type], rest = json.nodes[c.target.node][c.target.path] || REST[c.target.path];
      let constant = true;
      for (let i = 0; i < values.length && constant; i++) if (Math.abs(values[i] - rest[i % width]) > 1e-5) constant = false;
      if (constant) { dropped++; continue; }
      kept++; channels.push({ ...c, sampler: samplers.length }); samplers.push(s);
    }
    return { ...a, channels, samplers };
  });
  const missing = clips.filter(c => !json.animations.some(a => a.name === c));
  if (missing.length) throw new Error('Missing clips: ' + missing.join(', '));
  if (!json.animations.length) delete json.animations;
  const used = new Set();
  for (const m of json.meshes || []) for (const p of m.primitives) { Object.values(p.attributes).forEach(i => used.add(i)); if (p.indices !== undefined) used.add(p.indices); }
  for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) used.add(s.inverseBindMatrices);
  for (const a of json.animations || []) for (const s of a.samplers) { used.add(s.input); used.add(s.output); }
  const accMap = new Map(), viewMap = new Map(), views = [], chunks = []; let length = 0;
  const view = index => {
    if (!viewMap.has(index)) {
      const v = g.json.bufferViews[index], bytes = g.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), padding = (4 - (bytes.length % 4)) % 4;
      viewMap.set(index, views.length); views.push({ ...v, buffer: 0, byteOffset: length }); chunks.push(bytes, Buffer.alloc(padding)); length += bytes.length + padding;
    }
    return viewMap.get(index);
  };
  const accessors = [];
  [...used].sort((a, b) => a - b).forEach(i => { accMap.set(i, accessors.length); accessors.push({ ...g.json.accessors[i], bufferView: view(g.json.accessors[i].bufferView) }); });
  for (const m of json.meshes || []) for (const p of m.primitives) { for (const k of Object.keys(p.attributes)) p.attributes[k] = accMap.get(p.attributes[k]); if (p.indices !== undefined) p.indices = accMap.get(p.indices); }
  for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = accMap.get(s.inverseBindMatrices);
  for (const a of json.animations || []) a.samplers = a.samplers.map(s => ({ ...s, input: accMap.get(s.input), output: accMap.get(s.output) }));
  for (const image of json.images || []) if (image.bufferView !== undefined) image.bufferView = view(image.bufferView);
  json.accessors = accessors; json.bufferViews = views; json.buffers = [{ byteLength: length }];
  return { json, bin: Buffer.concat(chunks), dropped, kept };
}
const restPose = g => Object.fromEntries(g.json.skins[0].joints.map(j => { const n = g.json.nodes[j]; return [n.name, [...(n.translation || REST.translation), ...(n.rotation || REST.rotation), ...(n.scale || REST.scale)]]; }));
function assertSameRig(a, b, label) {
  const ra = restPose(a), rb = restPose(b); let worst = 0;
  for (const [name, values] of Object.entries(ra)) { if (!rb[name]) throw new Error(`${label}: joint ${name} missing`); values.forEach((v, i) => { worst = Math.max(worst, Math.abs(v - rb[name][i])); }); }
  if (worst > 1e-4) throw new Error(`${label}: rest poses differ by ${worst}`);
  return worst;
}

fs.rmSync(out, { recursive: true, force: true });
const report = [];
function emit(name, g, options) { const r = rewrite(g, options); writeGlb(path.join(out, name), r.json, r.bin); report.push(`${name}: ${(r.bin.length / 1024).toFixed(0)} KB, ${r.json.animations?.length || 0} clips, ${r.kept} tracks kept, ${r.dropped} rest-pose tracks dropped`); }

// Heroes: one shared clip file (the rigs are identical) and three mesh-only files.
const heroes = { vyx: readGlb(path.join(heroDir, 'Rogue_Hooded.glb')), sera: readGlb(path.join(heroDir, 'Mage.glb')), bragg: readGlb(path.join(heroDir, 'Barbarian.glb')) };
for (const [id, g] of Object.entries(heroes)) report.push(`rig check ${id} vs sera: max rest-pose difference ${assertSameRig(heroes.sera, g, id).toExponential(1)}`);
emit('characters/hero-anims.glb', heroes.sera, { clips: HERO_CLIPS, meshes: false });
for (const [id, g] of Object.entries(heroes)) emit(`characters/${id}.glb`, g, {});

// Skeleton enemies: same approach with their own clip set.
const skeletons = { minion: 'Skeleton_Minion', rogue: 'Skeleton_Rogue', mage: 'Skeleton_Mage', warrior: 'Skeleton_Warrior' };
const skel = Object.fromEntries(Object.entries(skeletons).map(([id, file]) => [id, readGlb(path.join(skelDir, 'Characters/gltf', file + '.glb'))]));
for (const [id, g] of Object.entries(skel)) report.push(`rig check skeleton ${id} vs warrior: max rest-pose difference ${assertSameRig(skel.warrior, g, id).toExponential(1)}`);
emit('enemies/skeleton-anims.glb', skel.warrior, { clips: SKELETON_CLIPS, meshes: false });
for (const [id, g] of Object.entries(skel)) emit(`enemies/${id}.glb`, g, {});
for (const stem of ['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Staff']) for (const ext of ['.gltf', '.bin']) fs.copyFileSync(path.join(skelDir, 'Assets/gltf', stem + ext), path.join(out, 'enemies', stem + ext));
fs.copyFileSync(path.join(skelDir, 'Assets/gltf/skeleton_texture.png'), path.join(out, 'enemies/skeleton_texture.png'));

// Environment props.
fs.mkdirSync(path.join(out, 'env/dungeon'), { recursive: true }); fs.mkdirSync(path.join(out, 'env/hex'), { recursive: true });
for (const stem of DUNGEON) { const file = [stem + '.gltf.glb', stem + '.glb'].map(f => path.join(dungeonDir, f)).find(fs.existsSync); if (!file) throw new Error('Missing dungeon prop ' + stem); fs.copyFileSync(file, path.join(out, 'env/dungeon', stem + '.glb')); }
for (const [folder, stems] of Object.entries(HEX)) for (const stem of stems) for (const ext of ['.gltf', '.bin']) fs.copyFileSync(path.join(hexDir, folder, stem + ext), path.join(out, 'env/hex', stem + ext));
fs.copyFileSync(path.join(hexDir, 'decoration/nature/hexagons_medieval.png'), path.join(out, 'env/hex/hexagons_medieval.png'));

// Audio.
fs.mkdirSync(path.join(out, 'audio'), { recursive: true });
const index = new Map();
for (const pack of fs.readdirSync(kenney)) { const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ogg')) index.set(pack + '/' + e.name.slice(0, -4), p); } }; if (fs.statSync(path.join(kenney, pack)).isDirectory()) walk(path.join(kenney, pack)); }
for (const [name, [pack, stem]] of Object.entries(AUDIO)) { const file = index.get(pack + '/' + stem); if (!file) throw new Error(`Missing sound ${pack}/${stem}`); fs.copyFileSync(file, path.join(out, 'audio', name + '.ogg')); }

// Integrity list used by the tests.
const files = []; let total = 0;
const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else { const data = fs.readFileSync(p); total += data.length; files.push({ file: path.relative(out, p).replaceAll('\\', '/'), bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') }); } } };
walk(out); files.sort((a, b) => a.file.localeCompare(b.file));
fs.writeFileSync(path.join(out, 'integrity.json'), JSON.stringify({ files }, null, 1));
console.log(report.join('\n'));
console.log(`${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB written to wildfall/assets`);
