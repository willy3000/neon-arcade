// Animated characters. The simulation decides what a character is doing; this turns that into skeletal animation,
// lean, squash, cloth and weapon trails so the body always shows the physics.
import * as THREE from '../vendor/three.bundle.min.js';
import { load, instance, textures } from './assets.js';
import { Ribbon } from './vfx.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);

export const HERO_VIEW = {
  vyx: { weapons: ['Knife', 'Knife_Offhand'], hidden: ['1H_Crossbow', '2H_Crossbow', 'Throwable', 'Rogue_Cape'], idle: 'Idle', run: 'Running_A', scale: 0.84, cloth: { color: 0xd63a2f, length: 1.7, width: 0.3, bone: 'chest', back: 0.18, up: 0.42 }, trail: 0x8ff6ff },
  sera: { weapons: ['2H_Staff'], hidden: ['Spellbook', 'Spellbook_open', '1H_Wand'], idle: 'Idle', run: 'Running_B', scale: 0.84, cloth: { color: 0xf2b53a, length: 1.25, width: 0.24, bone: 'hips', back: 0.2, up: 0.2 }, trail: 0xffc266 },
  bragg: { weapons: ['2H_Axe'], hidden: ['1H_Axe', '1H_Axe_Offhand', 'Mug'], shield: 'Barbarian_Round_Shield', idle: '2H_Melee_Idle', run: 'Running_A', scale: 0.95, cloth: { color: 0x3f9a58, length: 1.1, width: 0.36, bone: 'hips', back: 0.22, up: 0.25 }, trail: 0xfff1c9 },
};

const clipSets = new Map();
let serial = 0;
async function clips(path) {
  if (!clipSets.has(path)) clipSets.set(path, load(path).then(g => new Map(g.animations.map(c => [c.name, c]))));
  return clipSets.get(path);
}

class Rig {
  constructor(gltf, clipMap, scale) {
    this.root = new THREE.Group(); this.tilt = new THREE.Group(); this.turn = new THREE.Group(); this.model = instance(gltf);
    this.pivot = 0.95 * scale / 0.84; this.tilt.position.y = this.pivot; this.turn.position.y = -this.pivot; this.model.scale.setScalar(scale);
    this.root.add(this.tilt); this.tilt.add(this.turn); this.turn.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model); this.clips = clipMap; this.actions = new Map(); this.current = null; this.key = null;
    this.materials = []; this.model.traverse(o => { if (o.isMesh) this.materials.push(o.material); });
    this.yaw = Math.PI / 2; this.lean = 0; this.roll = 0; this.squash = 0; this.flash = 0; this.tint = null;
    this.bones = {}; this.model.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
  }
  node(name) { return this.model.getObjectByName(name); }
  // Plays a clip. Pass `time` to drive the clip position directly from simulation time instead of letting it run.
  play(name, o = {}) {
    const clip = this.clips.get(name); if (!clip) return;
    let a = this.actions.get(name); if (!a) { a = this.mixer.clipAction(clip); this.actions.set(name, a); }
    const key = name + '|' + (o.key ?? '');
    if (this.key !== key) {
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setLoop(o.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = true; a.play();
      if (this.current && this.current !== a) a.crossFadeFrom(this.current, o.fade ?? 0.12, false);
      this.current = a; this.key = key;
    }
    if (o.time !== undefined) { a.timeScale = 0; a.time = o.wrap ? ((o.time % clip.duration) + clip.duration) % clip.duration : clamp(o.time, 0, clip.duration - 0.001); } else a.timeScale = o.rate ?? 1;
  }
  pose(dt, yaw, lean, roll = 0, speed = 16) {
    this.yaw += wrap(yaw - this.yaw) * Math.min(1, dt * speed); this.lean += (lean - this.lean) * Math.min(1, dt * 14); this.roll += (roll - this.roll) * Math.min(1, dt * 12);
    this.turn.rotation.y = this.yaw; this.tilt.rotation.z = this.lean; this.tilt.rotation.x = this.roll;
    this.squash = Math.max(0, this.squash - dt * 5); const s = Math.sin(this.squash * Math.PI) * 0.16 * this.squash;
    this.tilt.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6);
    this.mixer.update(dt);
    if (this.flash > 0 || this.glow) { this.flash = Math.max(0, this.flash - dt * 6); const f = this.flash, g = this.glow || [0, 0, 0]; for (const m of this.materials) m.emissive?.setRGB(g[0] + f, g[1] + f, g[2] + f); this.wasGlow = true; }
    else if (this.wasGlow) { this.wasGlow = false; for (const m of this.materials) m.emissive?.setRGB(0, 0, 0); }
  }
  worldOf(bone, out) { return bone.getWorldPosition(out); }
}

// A light strip of cloth simulated as a hanging chain, so scarves and sashes follow every jump, dash and swing.
class Cloth {
  constructor(scene, o) {
    this.o = o; this.n = 9; this.p = Array.from({ length: this.n }, () => new THREE.Vector3()); this.q = Array.from({ length: this.n }, () => new THREE.Vector3());
    this.ribbon = new Ribbon(scene, this.n, o.color, false, 12); this.started = false;
  }
  update(dt, anchor, facing, floor, time) {
    const { p, q, n, o } = this, seg = o.length / (n - 1);
    if (!this.started || p[0].distanceTo(anchor) > 6) { for (let i = 0; i < n; i++) { p[i].set(anchor.x - facing * seg * i, anchor.y, anchor.z); q[i].copy(p[i]); } this.started = true; }
    p[0].copy(anchor);
    for (let i = 1; i < n; i++) {
      V.copy(p[i]).sub(q[i]).multiplyScalar(0.94); q[i].copy(p[i]);
      p[i].add(V); p[i].y -= 15 * dt * dt; p[i].x += (-facing * 2.2 + Math.sin(time * 5 + i) * 1.2) * dt * dt * 4; p[i].z += (anchor.z - 0.25 - p[i].z) * 0.2;
    }
    for (let k = 0; k < 3; k++) for (let i = 1; i < n; i++) { V.copy(p[i]).sub(p[i - 1]); const d = V.length() || 1e-4; p[i].addScaledVector(V, -(d - seg) / d); if (p[i].y < floor + 0.06) p[i].y = floor + 0.06; }
    this.ribbon.setLine(p.map((v, i) => [v.x, v.y, 1]), o.width, anchor.z - 0.22, true);
  }
  hide() { this.ribbon.clear(); this.started = false; }
  dispose(scene) { scene.remove(this.ribbon.mesh); }
}

export class HeroView {
  static async create(scene, charId, char) {
    const view = HERO_VIEW[charId], [gltf, clipMap] = await Promise.all([load(char.model), clips('characters/hero-anims.glb')]);
    return new HeroView(scene, charId, char, view, gltf, clipMap);
  }
  constructor(scene, charId, char, view, gltf, clipMap) {
    this.scene = scene; this.id = charId; this.char = char; this.view = view; this.rig = new Rig(gltf, clipMap, view.scale); scene.add(this.rig.root);
    for (const name of view.hidden) { const n = this.rig.node(name); if (n) n.visible = false; }
    this.shield = view.shield ? this.rig.node(view.shield) : null; if (this.shield) this.shield.visible = false;
    this.weapon = this.rig.node(view.weapons[0]); this.tip = new THREE.Vector3(0, 0.8, 0);
    if (this.weapon?.geometry) { // the far end of the weapon mesh is where the trail is drawn from
      this.weapon.geometry.computeBoundingBox(); const b = this.weapon.geometry.boundingBox, size = b.getSize(new THREE.Vector3()), axis = size.x > size.y ? (size.x > size.z ? 'x' : 'z') : size.y > size.z ? 'y' : 'z';
      this.tip.set(0, 0, 0); this.tip[axis] = Math.abs(b.max[axis]) > Math.abs(b.min[axis]) ? b.max[axis] : b.min[axis];
    }
    this.cloth = new Cloth(scene, view.cloth); this.trail = new Ribbon(scene, 12, view.trail); this.trail.bright = 1.8; this.samples = [];
    this.streak = new Ribbon(scene, 14, char.color); this.streak.bright = 1.2; this.path = [];
    this.hand = new THREE.Vector3(); this.wasGround = true; this.chargeGlow = 0;
  }
  // Where the grapple rope leaves the body.
  handPosition() { const b = this.rig.bones.handslotr; return b ? b.getWorldPosition(this.hand) : this.hand.set(this.rig.root.position.x, this.rig.root.position.y + 1.3, 0); }

  update(sim, dt, time) {
    const p = sim.player, c = p.char, rig = this.rig, v = this.view, a = p.action, run = c.runSpeed, speed = Math.abs(p.vx);
    let lean = -clamp(p.vx / run, -1.4, 1.4) * 0.1, roll = 0, z = 0, yaw = p.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (p.dead) rig.play('Death_A', { loop: false, fade: 0.1 });
    else if (p.hitstun > 0) { rig.play('Hit_A', { loop: false, fade: 0.05 }); lean = p.facing * 0.25; }
    else if (p.mode === 'dive') { rig.play('Dualwield_Melee_Attack_Chop', { time: 0.5, fade: 0.06 }); lean = -p.facing * 2.3; }
    else if (a) { const d = a.def, t = d.impact + (a.t - d.hitAt) * d.rate; rig.play(d.clip, { time: t, wrap: !!d.loop, key: (a.serial ??= ++serial), fade: 0.05 }); if (!p.onGround && !d.loop) lean = -p.facing * 0.18; }
    else if (p.charging >= 0) { const d = sim.kit.attacks[sim.kit.charged]; rig.play(d.clip, { time: Math.max(0, d.impact - 0.3 - Math.sin(time * 30) * 0.012), fade: 0.12, key: 'charge' }); }
    else if (p.shield) rig.play('Blocking', { fade: 0.08 });
    else if (p.mode === 'dash') { rig.play('Dodge_Forward', { time: clamp(p.modeT / p.dash.time, 0, 1) * 0.36, fade: 0.04, key: 'dash' }); const ang = Math.atan2(p.dash.dy, Math.abs(p.dash.dx)); lean = -p.facing * (0.6 - ang * 0.9); }
    else if (p.mode === 'slide') { rig.play('Sit_Floor_Pose', { time: 0, fade: 0.07 }); lean = p.facing * 1.05; }
    else if (p.mode === 'grapple') { rig.play('Jump_Idle', { fade: 0.1 }); const r = p.rope; lean = -Math.atan2(r.ax - p.x, r.ay - (p.y + 1.3)) * 0.8; }
    else if (p.mode === 'wallrun') { rig.play(v.run, { rate: 1.7, fade: 0.06 }); lean = p.lastWall * 0.3; yaw = p.lastWall > 0 ? Math.PI * 0.82 : -Math.PI * 0.82; }
    else if (p.mode === 'backrun') { rig.play(v.run, { rate: 1.5, fade: 0.06 }); roll = 0.85; z = -1.7; lean = -p.facing * 0.2; }
    else if (p.mode === 'mantle') rig.play('Jump_Start', { time: 0.2 + (p.modeT / 0.17) * 0.3, fade: 0.05 });
    else if (!p.onGround) {
      if (p.wallSliding) { rig.play('Jump_Idle', { fade: 0.1 }); lean = -p.wall * 0.25; yaw = p.wall > 0 ? Math.PI * 0.75 : -Math.PI * 0.75; }
      else if (p.gliding) { rig.play('Spellcasting', { fade: 0.15 }); lean = -p.facing * 0.35; }
      else if (p.vy > 2) rig.play('Jump_Start', { time: 0.5, fade: 0.08, key: 'rise' });
      else rig.play('Jump_Idle', { fade: 0.16 });
      lean += -p.facing * clamp(p.vy / 40, -0.3, 0.3) * 0.5;
    } else if (p.landT < 0.16 && speed < 2) rig.play('Jump_Land', { time: 0.25 + p.landT * 1.6, fade: 0.05, key: 'land' });
    else if (speed > 0.6) rig.play(speed < run * 0.45 ? 'Walking_A' : v.run, { rate: clamp(speed / run, 0.55, 1.7) * (speed < run * 0.45 ? 1.6 : 1.15), fade: 0.12 });
    else rig.play(v.idle, { fade: 0.18 });

    if (p.onGround && !this.wasGround) rig.squash = 1; this.wasGround = p.onGround;
    rig.root.position.set(p.x, p.y, rig.root.position.z + (z - rig.root.position.z) * Math.min(1, dt * 12));
    rig.root.visible = !(p.iframes > 0 && p.hitstun <= 0 && p.dashAge > 0.4 && !p.dead && Math.floor(time * 24) % 2 === 0);
    if (this.shield) this.shield.visible = !!p.shield;
    if (p.yaw !== undefined) yaw = p.yaw; // title-screen heroes turn to face the camera
    this.chargeGlow += ((p.charging >= 0 ? Math.min(1, p.charging / 0.95) : 0) - this.chargeGlow) * Math.min(1, dt * 10);
    const cg = this.chargeGlow, cc = new THREE.Color(c.color); rig.glow = cg > 0.02 || p.counterT > 0 ? [cc.r * cg * 0.9 + (p.counterT > 0 ? 0.25 : 0), cc.g * cg * 0.9 + (p.counterT > 0 ? 0.2 : 0), cc.b * cg * 0.9] : null;
    rig.pose(dt, yaw, lean, roll);
    rig.root.updateMatrixWorld(true);

    // The rope arm reaches for the anchor while swinging.
    if (p.rope && rig.bones.upperarmr) {
      const arm = rig.bones.upperarmr; arm.getWorldPosition(V); V2.set(p.rope.ax - V.x, p.rope.ay - V.y, 0 - V.z).normalize();
      Q.setFromUnitVectors(UP, V2); arm.parent.getWorldQuaternion(Q2).invert(); arm.quaternion.copy(Q2.multiply(Q));
      if (rig.bones.lowerarmr) rig.bones.lowerarmr.quaternion.identity(); arm.updateMatrixWorld(true);
    }
    const bone = rig.bones[v.cloth.bone]; if (bone) { bone.getWorldPosition(V); V.x -= p.facing * v.cloth.back; V.y += v.cloth.up; this.cloth.update(Math.min(dt, 1 / 30), V, p.facing, p.onGround ? p.y : -999, time); }

    // Weapon trail while an attack is swinging.
    const swinging = a && a.def.box && a.t > a.def.hitAt - 0.09 && a.t < a.def.hitAt + (a.def.hitLen || 0) + 0.07;
    if (swinging && this.weapon) { const base = this.weapon.getWorldPosition(new THREE.Vector3()), tip = this.weapon.localToWorld(this.tip.clone()); tip.sub(base).multiplyScalar(1.5).add(base); this.samples.unshift([base.x, base.y, base.z, tip.x, tip.y, tip.z, 1]); }
    for (const s of this.samples) s[6] -= dt * 5.5; this.samples = this.samples.filter(s => s[6] > 0).slice(0, 12);
    if (this.samples.length > 1) this.trail.setEdges(this.samples); else this.trail.clear();
    // Speed streak behind dashes, launches and fast swings.
    const fast = p.mode === 'dash' || Math.hypot(p.vx, p.vy) > 17;
    if (fast) this.path.unshift([p.x, p.y + 0.95, 0.75]); for (const s of this.path) s[2] -= dt * 3.2; this.path = this.path.filter(s => s[2] > 0).slice(0, 14);
    if (this.path.length > 1) this.streak.setLine(this.path.map(s => [s[0], s[1], s[2] * 0.55]), 0.7, -0.3, true); else this.streak.clear();
  }
  dispose() { this.scene.remove(this.rig.root, this.trail.mesh, this.streak.mesh); this.cloth.dispose(this.scene); }
}

const ENEMY_MODEL = { minion: 'enemies/minion.glb', rogue: 'enemies/rogue.glb', mage: 'enemies/mage.glb', warrior: 'enemies/warrior.glb' };
export const enemyAssets = types => ['enemies/skeleton-anims.glb', ...new Set(types.flatMap(t => [ENEMY_MODEL[t.model], t.weapon && `enemies/${t.weapon}.gltf`]).filter(Boolean))];

export class EnemyView {
  static async create(scene, e) {
    const d = e.def, [gltf, clipMap, weapon] = await Promise.all([load(ENEMY_MODEL[d.model]), clips('enemies/skeleton-anims.glb'), d.weapon ? load(`enemies/${d.weapon}.gltf`) : null]);
    return new EnemyView(scene, e, gltf, clipMap, weapon);
  }
  constructor(scene, e, gltf, clipMap, weapon) {
    const d = e.def; this.scene = scene; this.e = e; this.rig = new Rig(gltf, clipMap, d.scale); scene.add(this.rig.root);
    if (d.tint) for (const m of this.rig.materials) m.color.set(d.tint);
    if (weapon && this.rig.bones.handslotr) { const w = weapon.scene.clone(true); w.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.rig.bones.handslotr.add(w); }
    // Health bar and attack warning float above the head.
    this.bar = new THREE.Group(); const back = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.14), new THREE.MeshBasicMaterial({ color: 0x0c0f14, transparent: true, opacity: 0.7, depthTest: false }));
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.09), new THREE.MeshBasicMaterial({ color: 0xff5a4a, depthTest: false })); this.fill.position.z = 0.01; this.bar.add(back, this.fill); this.bar.renderOrder = 40; this.bar.visible = false; scene.add(this.bar);
    this.warn = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color: 0xff3b2e, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); this.warn.visible = false; scene.add(this.warn);
    this.ice = new THREE.Mesh(new THREE.BoxGeometry(d.hw * 2.6, d.h * 1.08, 1.4), new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x4fb4ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.5, roughness: 0.1, flatShading: true })); this.ice.visible = false; scene.add(this.ice);
    this.rig.yaw = e.facing > 0 ? Math.PI / 2 : -Math.PI / 2; this.seen = true;
  }
  update(sim, dt, time) {
    const e = this.e, d = e.def, rig = this.rig, a = e.attack, speed = Math.abs(e.vx);
    let lean = 0, fly = d.fly ? Math.sin(time * 3 + e.home) * 0.12 : 0;
    if (e.dead) rig.play(d.fly ? 'Death_A' : 'Death_C_Skeletons', { loop: false, fade: 0.08 });
    else if (e.spawnT > 0) rig.play(d.fly ? 'Spawn_Air' : 'Skeletons_Awaken_Floor', { time: (1 - e.spawnT) * (d.fly ? 1.25 : 2.25), fade: 0, key: 'spawn' });
    else if (e.frozen > 0) { if (rig.current) rig.current.timeScale = 0; }
    else if (e.state === 'stagger' || e.stun > 0) { rig.play('Hit_B', { rate: 0.45, fade: 0.1 }); lean = e.facing * 0.2; }
    else if (e.state === 'hurt' || e.shock > 0) rig.play(e.launched ? 'Hit_B' : 'Hit_A', { loop: false, fade: 0.04, key: e.hits });
    else if (e.state === 'attack' && a) { const t = e.stateT, time2 = t < a.windup ? a.impact * (t / a.windup) : a.impact + (t - a.windup); rig.play(a.clip, { time: time2, key: 'atk' + e.cd, fade: 0.1 }); if (a.swoop && t > a.windup) lean = -e.facing * 0.9; }
    else if (e.state === 'attack') rig.play('1H_Melee_Attack_Stab', { time: clamp(e.stateT, 0, 1.2), fade: 0.1, key: 'swoop' });
    else if (e.state === 'intro') rig.play('Taunt', { rate: 0.55, fade: 0.2 });
    else if (e.state === 'summon') rig.play('Spellcast_Summon', { rate: 1.9, fade: 0.2 });
    else if (e.state === 'dodge') rig.play('Dodge_Backward', { loop: false, fade: 0.04 });
    else if (e.state === 'fuse') rig.play('Spellcasting', { rate: 2.4, fade: 0.08 });
    else if (d.fly) rig.play('Jump_Idle', { fade: 0.2 });
    else if (!e.onGround) rig.play('Jump_Idle', { fade: 0.12 });
    else if (speed > 0.4) rig.play(e.guarding ? 'Walking_A' : speed > 4.4 ? 'Running_A' : d.model === 'minion' ? 'Walking_D_Skeletons' : 'Walking_A', { rate: clamp(speed / (speed > 4.4 ? 5.2 : 2.4), 0.6, 1.8), fade: 0.15 });
    else rig.play(e.guarding ? 'Blocking' : e.alert ? 'Idle_Combat' : 'Idle', { fade: 0.2 });

    // Warning glow: brightest just before the strike lands.
    const warn = !e.dead && ((e.state === 'attack' && a && e.stateT < a.windup) || e.fuse > 0) ? (e.fuse > 0 ? 1 - e.fuse / 0.8 : e.stateT / a.windup) : 0;
    const hot = e.fuse > 0 ? [1.6 * warn, 0.6 * warn, 0] : [1.1 * warn * warn, 0.08 * warn, 0.04 * warn], burn = e.burn > 0 ? 0.35 + Math.sin(time * 20) * 0.1 : 0;
    rig.glow = e.frozen > 0 ? [0.15, 0.5, 0.9] : warn > 0.02 || burn ? [hot[0] + burn, hot[1] + burn * 0.4, hot[2]] : d.boss && e.phase > 1 ? [0.18 * (e.phase - 1), 0.03, 0.02] : null;
    if (e.flash > 0) rig.flash = Math.max(rig.flash, e.flash * 6);
    rig.root.position.set(e.x, e.y + fly, d.fly ? 0.15 : 0); rig.root.visible = !(e.dead && e.deadT > 2.2 && Math.floor(time * 20) % 2);
    rig.pose(dt, e.facing > 0 ? Math.PI / 2 : -Math.PI / 2, lean + (e.launched ? e.facing * 0.5 : 0), 0, 12);
    this.warn.visible = warn > 0.05; if (this.warn.visible) { this.warn.position.set(e.x, e.y + e.h + 0.55, 0.5); this.warn.scale.setScalar((0.8 + warn * 1.8) * (d.boss ? 2 : 1)); this.warn.material.opacity = 0.35 + warn * 0.65; this.warn.material.color.set(e.fuse > 0 ? 0xff9a2e : 0xff3b2e); }
    const show = !e.dead && !d.boss && e.hp < e.maxHp - 0.5 && e.spawnT <= 0;
    this.bar.visible = show; if (show) { const f = clamp(e.hp / e.maxHp, 0, 1); this.bar.position.set(e.x, e.y + e.h + 0.28 + fly, 0.6); this.fill.scale.x = f; this.fill.position.x = -(1 - f) * 0.63; this.fill.material.color.set(e.frozen > 0 ? 0x7fd8ff : e.burn > 0 ? 0xffa23c : 0xff5a4a); }
    this.ice.visible = e.frozen > 0 && !e.dead; if (this.ice.visible) this.ice.position.set(e.x, e.y + e.h * 0.52, 0);
  }
  dispose() { this.scene.remove(this.rig.root, this.bar, this.warn, this.ice); }
}
