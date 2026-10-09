// The renderer: owns the three.js scene, follows the simulation, and turns its events into effects.
import * as THREE from '../vendor/three.bundle.min.js';
import { Scenery, BIOMES } from './scenery.js';
import { HeroView, EnemyView, enemyAssets } from './actors.js';
import { Effects, Ribbon } from './vfx.js';
import { loadAll, buildTextures, textures } from './assets.js';
import { CHARACTERS, CHARACTER_ORDER, GRAPPLE } from '../config.js';
import { ENEMIES } from '../sim/enemies.js';
import { findGrappleTarget } from '../sim/player.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const HIT_COLORS = { blade: [0xffffff, 0x9ff3ff], heavy: [0xffd27a, 0xffffff], slam: [0xe8d2a0, 0xfff1c9], charge: [0xffd27a, 0xffffff], kinetic: [0x7ff4ff, 0xffffff], fire: [0xff8a2a, 0xffd24a], explosion: [0xff8a2a, 0xffd24a], ice: [0xbfeaff, 0x6fc8ff], lightning: [0xaad4ff, 0xffffff], hex: [0xc77dff, 0xff7de9] };
const STAGE = { id: 'stage', biome: 'ruins', bounds: { x: -30, y: -4, w: 60, h: 30 }, killY: -12, solids: [{ id: 'stage', x: -9, y: -5, w: 18, h: 5, kind: 'island' }], anchors: [], zones: [], props: [], pickups: [], checkpoints: [], tablets: [],
  deco: [{ model: 'dungeon/wall_arched', x: 0, y: 0, z: -3, scale: 1.5 }, { model: 'dungeon/pillar_decorated', x: -5.2, y: 0, z: -2.4 }, { model: 'dungeon/pillar_decorated', x: 5.2, y: 0, z: -2.4 }, { model: 'dungeon/banner_patternA_red', x: -3.4, y: 0, z: -2.7 }, { model: 'dungeon/banner_patternB_blue', x: 3.4, y: 0, z: -2.7 }, { model: 'dungeon/torch_lit', x: -6.6, y: 1.2, z: -1.8 }, { model: 'dungeon/torch_lit', x: 6.6, y: 1.2, z: -1.8 }] };

export class Renderer {
  constructor(canvas, settings) {
    this.settings = settings;
    const r = this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 1400);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.2); this.key = new THREE.DirectionalLight(0xffffff, 2.4); this.rim = new THREE.DirectionalLight(0x9fc8ff, 0.7);
    this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048); const sc = this.key.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 30; sc.bottom = -26; sc.near = 1; sc.far = 120; this.key.shadow.bias = -0.0006; this.key.shadow.normalBias = 0.04;
    this.rim.position.set(12, 10, -24); this.scene.add(this.hemi, this.key, this.key.target, this.rim);
    buildTextures();
    this.effects = new Effects(this.scene, settings.quality);
    this.rope = new Ribbon(this.scene, 12, 0xcdb58a, false, 15); this.hook = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), new THREE.MeshStandardMaterial({ color: 0xe9d39a, metalness: 0.7, roughness: 0.3, emissive: 0x5a4210 })); this.hook.visible = false; this.scene.add(this.hook);
    this.reticle = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color: 0xffe08a, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })); this.reticle.visible = false; this.scene.add(this.reticle);
    this.shots = new Map(); this.enemies = new Map(); this.pending = new Set(); this.motes = [];
    this.moteMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.13), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe08a).multiplyScalar(1.8), toneMapped: false }), 64); this.moteMesh.frustumCulled = false; this.scene.add(this.moteMesh);
    this.cam = { x: 0, y: 2, dist: 22, trauma: 0, vista: 0 }; this.time = 0; this.hero = null; this.scenery = null; this.stageHeroes = null; this.o = new THREE.Object3D();
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight, high = this.settings.quality !== 'low';
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1)); this.gl.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.gl.shadowMap.enabled = high; this.key.castShadow = high;
    this.effects.setScale(h * this.gl.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)));
    if (high && !this.composer) {
      this.composer = new THREE.EffectComposer(this.gl); this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
      this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.55, 1.3); this.composer.addPass(this.bloom); this.composer.addPass(new THREE.OutputPass());
    }
    if (this.composer) { this.composer.setPixelRatio(this.gl.getPixelRatio()); this.composer.setSize(w, h); }
  }

  async setLevel(level, onProgress) {
    this.clearActors(); this.scenery?.dispose(); this.scenery = new Scenery(this.scene, level);
    const B = this.biome = BIOMES[level.biome] || BIOMES.ruins;
    this.scene.fog = new THREE.Fog(B.fog, 46, 340); this.hemi.color.set(B.sky); this.hemi.groundColor.set(B.ground); this.key.color.set(B.key); this.key.intensity = B.keyPower;
    await this.scenery.build(onProgress);
  }
  clearActors() { for (const v of this.enemies.values()) v.dispose(); this.enemies.clear(); this.pending.clear(); for (const s of this.shots.values()) this.scene.remove(s); this.shots.clear(); this.hero?.dispose(); this.hero = null; if (this.stageHeroes) { for (const h of this.stageHeroes) h.view.dispose(); this.stageHeroes = null; } this.rope.clear(); this.hook.visible = false; this.reticle.visible = false; }
  async setHero(charId) { this.hero?.dispose(); this.hero = await HeroView.create(this.scene, charId, CHARACTERS[charId]); }
  preload(types, onProgress) { return loadAll(enemyAssets(types.map(t => ENEMIES[t])), onProgress); }

  // The title and character-select backdrop: the three heroes on a ruined terrace.
  async showStage(onProgress) {
    await this.setLevel(STAGE, onProgress);
    this.stageHeroes = await Promise.all(CHARACTER_ORDER.map(async (id, i) => {
      const c = CHARACTERS[id], view = await HeroView.create(this.scene, id, c), player = { char: c, x: (i - 1) * 3.4, y: 0, vx: 0, vy: 0, facing: i === 2 ? -1 : 1, yaw: (1 - i) * 0.32, onGround: true, mode: 'normal', hitstun: 0, landT: 9, iframes: 0, charging: -1, counterT: 0, dashAge: 9, modeT: 0 };
      return { view, sim: { player, kit: { attacks: {} }, stats: { time: 0 } } };
    }));
    this.cam.x = 0; this.cam.y = 1.4; this.cam.dist = 15; this.stageFocus = -1;
  }
  cheer(index) { const h = this.stageHeroes?.[index]; if (h) h.sim.player.action = { id: 'cheer', t: 0, def: { clip: 'Cheer', impact: 0, hitAt: 0, rate: 1, dur: 1.6 } }; }
  stageFrame(dt, focus) {
    this.time += dt; if (!this.stageHeroes) return;
    for (const h of this.stageHeroes) { const a = h.sim.player.action; if (a) { a.t += dt; if (a.t > a.def.dur) h.sim.player.action = null; } h.view.update(h.sim, dt, this.time); }
    // Title: heroes sit right of the menu. Select: the chosen hero stands above the cards.
    const pick = focus >= 0, tx = pick ? (focus - 1) * 3.4 : -4.6, dist = pick ? 9 : 13.5, c = this.cam, lookY = pick ? 0.35 : 1.5;
    c.x += (tx - c.x) * Math.min(1, dt * 3.5); c.dist += (dist - c.dist) * Math.min(1, dt * 3); c.y += (lookY - c.y) * Math.min(1, dt * 3);
    this.camera.position.set(c.x + Math.sin(this.time * 0.25) * 0.5, c.y + 0.8 + Math.sin(this.time * 0.4) * 0.12, c.dist); this.camera.lookAt(c.x, c.y, 0);
    this.light(c.x, 1.5); this.scenery.sync({ world: { solids: [] }, props: [], pickups: [], gear: {}, flags: {} }, dt, this.time, null); this.effects.update(dt); this.draw();
  }

  light(x, y) { this.key.position.set(x - 16, y + 28, 24); this.key.target.position.set(x, y, 0); }
  draw() { if (this.composer && this.settings.quality !== 'low') this.composer.render(); else this.gl.render(this.scene, this.camera); }
  shake(amount) { if (this.settings.shake > 0) this.cam.trauma = Math.min(1, this.cam.trauma + amount * this.settings.shake); }

  frame(sim, dt, input) {
    this.time += dt; const p = sim.player, t = this.time, fx = this.effects;
    // Enemies appear and disappear with the simulation.
    for (const e of sim.enemies) if (!this.enemies.has(e.id) && !this.pending.has(e.id)) { this.pending.add(e.id); EnemyView.create(this.scene, e).then(v => { this.pending.delete(e.id); if (sim.enemies.includes(e)) this.enemies.set(e.id, v); else v.dispose(); }); }
    for (const [id, v] of this.enemies) { if (!sim.enemies.includes(v.e)) { v.dispose(); this.enemies.delete(id); continue; } v.update(sim, dt, t); const e = v.e; if (!e.dead && e.burn > 0 && Math.random() < dt * 30) fx.glow.burst(e.x, e.y + e.h * 0.5, 0.3, { count: 1, speed: [1, 3], angle: Math.PI / 2, spread: 0.8, life: [0.3, 0.6], size: [0.25, 0.5], color: [0xff8a2a, 0xffd24a], gravity: -4, jitter: 0.8 }); }
    this.hero?.update(sim, dt, t);

    // Continuous movement effects.
    const speed = Math.hypot(p.vx, p.vy);
    if (p.mode === 'slide' || (p.wallSliding && Math.random() < 0.5)) fx.dust.burst(p.x - p.facing * 0.3 + (p.wallSliding ? p.wall * 0.4 : 0), p.y + (p.wallSliding ? 1 : 0.1), 0.4, { count: 1, speed: [0.5, 2], angle: Math.PI / 2, spread: 1.6, life: [0.3, 0.6], size: [0.3, 0.6], color: 0xd9cfb8, grow: 1.5, drag: 2 });
    if ((p.mode === 'backrun' || p.mode === 'wallrun') && Math.random() < 0.6) fx.glow.burst(p.x, p.y + 0.15, p.mode === 'backrun' ? -1.8 : 0.3, { count: 1, speed: [1, 3], spread: 3, life: [0.2, 0.4], size: [0.12, 0.25], color: this.biome.accent, bright: 1.6 });
    if (p.charging >= 0 && Math.random() < 0.7) { const a = Math.random() * 6.28, r = 1.6; fx.glow.one(p.x + Math.cos(a) * r, p.y + 1 + Math.sin(a) * r, 0.4, -Math.cos(a) * 5, -Math.sin(a) * 5, 0, 0.3, 0.2, p.char.color, 0, 0, 0, 1.8); }
    if (p.gliding && Math.random() < 0.5) fx.glow.burst(p.x, p.y + 0.2, 0.2, { count: 1, speed: [0.5, 1.5], angle: -Math.PI / 2, spread: 1, life: [0.3, 0.6], size: [0.1, 0.22], color: 0xffd98a, bright: 1.5, jitter: 0.8 });
    if (p.flow >= 3 && Math.random() < 0.3 + p.flow * 0.08) fx.glow.burst(p.x - p.facing * 0.2, p.y + 0.9, 0.2, { count: 1, speed: [0.3, 1.2], spread: 6, life: [0.3, 0.7], size: [0.1, 0.2], color: p.char.color, bright: 1.8, jitter: 1 });

    this.drawRope(sim); this.drawShots(sim, dt); this.drawMotes(sim, dt);
    const target = sim.gear.grapple && !p.rope && !p.dead ? findGrappleTarget(sim, input) : null;
    this.reticle.visible = !!target?.enemy; if (target?.enemy) { const e = target.target; this.reticle.position.set(e.x, e.y + e.h * 0.6, 0.6); this.reticle.scale.setScalar(2.2 + Math.sin(t * 9) * 0.25); }
    this.scenery.sync(sim, dt, t, target && !target.enemy ? target.target : p.rope && !p.rope.enemy ? p.rope.target : null);
    fx.update(dt);

    // Camera: leads the run, pulls back with speed and for fights, and never leaves the level.
    const c = this.cam, b = sim.level.bounds, arena = sim.arenaBounds && p.x > sim.arenaBounds[0] - 4 && p.x < sim.arenaBounds[1] + 4 ? sim.arenaBounds : null; c.vista = Math.max(0, c.vista - dt);
    let tx = p.x + p.facing * 2.2 + clamp(p.vx * 0.24, -4.5, 4.5), ty = p.y + 2.1 + clamp(p.vy * 0.09, -2.4, 1.8), dist = 18 + clamp(speed - 10, 0, 16) * 0.45 + (p.mode === 'grapple' ? 5 : 0);
    if (arena) { tx = tx * 0.45 + ((arena[0] + arena[1]) / 2) * 0.55; dist = Math.max(dist, 20 + (arena[1] - arena[0]) * 0.16); }
    if (c.vista > 0) { dist = 36; ty += 4; tx += 12; }
    const k = Math.min(1, dt * 5); c.x += (tx - c.x) * k; c.y += (ty - c.y) * Math.min(1, dt * (p.onGround ? 4 : 6)); c.dist += (dist - c.dist) * Math.min(1, dt * 2.2);
    c.x = clamp(c.x, b.x + 10, b.x + b.w - 10); c.trauma = Math.max(0, c.trauma - dt * 1.9);
    const s = c.trauma * c.trauma, sx = (Math.sin(t * 61) + Math.sin(t * 37.3)) * 0.35 * s, sy = (Math.sin(t * 53.7) + Math.sin(t * 29.1)) * 0.35 * s;
    this.camera.position.set(c.x + sx, c.y + 2.4 + sy, c.dist); this.camera.lookAt(c.x + sx * 0.5, c.y + 0.4 + sy * 0.5, 0);
    this.light(c.x, c.y); this.draw();
  }
  // Direction from the hero to the mouse cursor on the gameplay plane, used to aim the grapple.
  aim(sim, mouse) { const v = (this.aimRay ||= new THREE.Vector3()).set((mouse.x / window.innerWidth) * 2 - 1, -(mouse.y / window.innerHeight) * 2 + 1, 0.5).unproject(this.camera).sub(this.camera.position).normalize(), t = -this.camera.position.z / v.z, p = sim.player; return { x: this.camera.position.x + v.x * t - p.x, y: this.camera.position.y + v.y * t - (p.y + 1.3) }; }
  snapCamera(sim) { const p = sim.player; this.cam.x = p.x; this.cam.y = p.y + 2.1; this.cam.dist = 18; }

  drawRope(sim) {
    const p = sim.player, r = p.rope;
    if (!r || !this.hero) { this.rope.clear(); this.hook.visible = false; return; }
    const h = this.hero.handPosition(), d = Math.hypot(r.ax - h.x, r.ay - h.y) || 1;
    const reach = r.state === 'fly' ? Math.min(1, (r.t * GRAPPLE.hookSpeed) / d) : 1, ex = h.x + (r.ax - h.x) * reach, ey = h.y + (r.ay - h.y) * reach, sag = r.state === 'taut' && !r.taut ? Math.min(1.5, (r.len - d) * 0.6) : r.state === 'fly' ? 0.25 * (1 - reach) : 0, pts = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([h.x + (ex - h.x) * u, h.y + (ey - h.y) * u - Math.sin(u * Math.PI) * sag, 1]); }
    this.rope.setLine(pts, 0.085, 0.05); this.hook.visible = true; this.hook.position.set(ex, ey, 0.05); this.hook.rotation.z = Math.atan2(r.ay - h.y, r.ax - h.x) - Math.PI / 2;
  }

  drawShots(sim, dt) {
    const fx = this.effects, live = new Set();
    for (const pr of sim.projectiles) {
      live.add(pr.id); let m = this.shots.get(pr.id);
      if (!m) {
        const look = pr.look, mat = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.4), toneMapped: false });
        m = look === 'blade' ? new THREE.Mesh(new THREE.OctahedronGeometry(0.34), mat(0x7ff4ff)) : look === 'shock' ? new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.5, 5), mat(0xe8d2a0)) : new THREE.Mesh(new THREE.SphereGeometry(pr.r * (look === 'fireball' ? 1.15 : 0.9), 10, 8), mat(look === 'hex' ? 0xc77dff : 0xffa23c));
        if (look === 'blade') m.scale.set(1.6, 0.22, 0.5); if (look === 'bolt') m.scale.set(2.2, 0.7, 0.7);
        this.scene.add(m); this.shots.set(pr.id, m);
      }
      m.position.set(pr.x, pr.y, 0.2); m.rotation.z = pr.look === 'shock' ? (pr.vx > 0 ? -Math.PI / 2 : Math.PI / 2) : Math.atan2(pr.vy, pr.vx);
      const color = pr.look === 'hex' ? [0xc77dff, 0xff7de9] : pr.look === 'blade' ? [0x7ff4ff, 0xffffff] : pr.look === 'shock' ? [0xe8d2a0] : [0xff8a2a, 0xffd24a];
      if (pr.look === 'shock') fx.dust.burst(pr.x, pr.y - 0.3, 0.3, { count: 1, speed: [1, 3], angle: Math.PI / 2, spread: 1.2, life: [0.3, 0.5], size: [0.4, 0.8], color: 0xd9cfb8, grow: 1.2 });
      else fx.glow.burst(pr.x, pr.y, 0.2, { count: pr.look === 'fireball' ? 2 : 1, speed: [0.2, 1.5], spread: 6, life: [0.18, 0.4], size: [pr.r * 0.9, pr.r * 1.8], color, bright: 1.5 });
    }
    for (const [id, m] of this.shots) if (!live.has(id)) { this.scene.remove(m); m.geometry.dispose(); this.shots.delete(id); }
  }

  drawMotes(sim, dt) {
    let n = 0; const o = this.o;
    for (const pk of sim.pickups) { if (pk.taken || !pk.loose || n >= 64) continue; o.position.set(pk.x, pk.y, 0.2); o.rotation.set(this.time * 3 + n, this.time * 2, 0); o.scale.setScalar(pk.kind === 'heal' ? 1.7 : 1); o.updateMatrix(); this.moteMesh.setMatrixAt(n, o.matrix); this.moteMesh.setColorAt(n, new THREE.Color(pk.kind === 'heal' ? 0x7dffa0 : 0xffe08a)); n++; }
    this.moteMesh.count = n; this.moteMesh.instanceMatrix.needsUpdate = true; if (this.moteMesh.instanceColor) this.moteMesh.instanceColor.needsUpdate = true;
  }

  // Turns simulation events into particles, rings, debris, light and camera shake.
  handle(ev, sim) {
    const fx = this.effects, p = sim.player, flashOk = !this.settings.reducedFlash, dust = (x, y, n, o = {}) => fx.dust.burst(x, y, 0.4, { count: n, speed: [0.8, 3], angle: Math.PI / 2, spread: 2.6, life: [0.3, 0.7], size: [0.35, 0.8], color: 0xd9cfb8, grow: 1.6, drag: 2.5, ...o });
    switch (ev.type) {
      case 'jump':
        if (ev.kind === 'double') { fx.ring(p.x, p.y, 0, { color: p.char.color, from: 0.2, to: 1.5, life: 0.28, ground: true }); fx.glow.burst(p.x, p.y, 0, { count: 10, speed: [1, 4], angle: -Math.PI / 2, spread: 2.4, life: [0.2, 0.45], size: [0.12, 0.25], color: p.char.color, bright: 1.6 }); }
        else dust(p.x - (ev.dir || 0) * 0.4, p.y + (ev.kind === 'wall' ? 0.8 : 0.05), ev.kind === 'ground' ? 5 : 7); break;
      case 'land': { const n = Math.round(clamp(ev.speed / 3, 2, 14)); dust(ev.x, ev.y + 0.05, n, { spread: 3 }); if (ev.speed > 19 || ev.heavy) { fx.ring(ev.x, ev.y + 0.05, 0, { color: 0xe8dcc0, from: 0.3, to: ev.heavy ? 4 : 2.2, life: 0.3, ground: true, alpha: 0.6 }); this.shake(ev.heavy ? 0.5 : 0.18); } break; }
      case 'dash': fx.ring(p.x, p.y + 0.9, 0, { color: p.char.color, from: 0.3, to: ev.phase ? 2.6 : 1.6, life: 0.22 }); fx.glow.burst(p.x, p.y + 0.9, 0, { count: ev.phase ? 22 : 10, speed: [2, 7], angle: Math.atan2(-ev.dy, -ev.dx), spread: 0.9, life: [0.2, 0.4], size: [0.12, 0.3], color: [p.char.color, 0xffffff], bright: 1.7 }); break;
      case 'blink': for (const [x, y] of [[ev.fromX, ev.fromY], [ev.x, ev.y]]) { fx.ring(x, y + 0.9, 0, { color: 0xffc266, from: 0.2, to: 1.5, life: 0.25 }); fx.glow.burst(x, y + 0.9, 0, { count: 14, speed: [1, 5], spread: 6.3, life: [0.2, 0.5], size: [0.1, 0.26], color: [0xffc266, 0xffffff], bright: 1.8 }); } fx.bolt([ev.fromX, ev.fromY + 0.9], [ev.x, ev.y + 0.9], 0.12); break;
      case 'slide': dust(p.x, p.y + 0.05, 6); break;
      case 'mantle': dust(p.x + p.facing * 0.4, p.y + 1, 3); break;
      case 'bounce': { const v = this.scenery.solids.get(ev.solid); if (v) v.squash = 1; fx.glow.burst(ev.x, ev.y, 0, { count: 16, speed: [2, 7], angle: Math.PI / 2, spread: 2.2, life: [0.3, 0.7], size: [0.1, 0.24], color: [0xff8fc0, 0xfff0c0], gravity: 6, bright: 1.6 }); fx.ring(ev.x, ev.y, 0, { color: 0xff8fc0, from: 0.4, to: 2.4, life: 0.3, ground: true }); break; }
      case 'grappleAttach': fx.ring(ev.x, ev.y, 0.1, { color: 0xffe08a, from: 0.2, to: 1.5, life: 0.25 }); fx.glow.burst(ev.x, ev.y, 0.1, { count: 10, speed: [1, 5], spread: 6.3, life: [0.15, 0.35], size: [0.08, 0.2], color: [0xffe08a, 0xffffff], bright: 1.8 }); break;
      case 'grappleRelease': if (ev.perfect) { fx.ring(p.x, p.y + 1, 0, { color: 0xffe08a, from: 0.3, to: 3.2, life: 0.4, bright: 2 }); fx.glow.burst(p.x, p.y + 1, 0, { count: 26, speed: [2, 9], spread: 6.3, life: [0.3, 0.7], size: [0.1, 0.28], color: [0xffe08a, 0xffffff], bright: 2 }); } break;
      case 'chainPull': fx.bolt([p.x, p.y + 1.3], [ev.x, ev.y], 0.14); fx.ring(ev.x, ev.y, 0, { color: 0xbfd0d8, from: 0.2, to: 1.6, life: 0.25 }); break;
      case 'hit': {
        const colors = HIT_COLORS[ev.kind] || HIT_COLORS.blade, big = ev.heavy;
        if (ev.res === 'blocked') { fx.glow.burst(ev.x, ev.y, 0.4, { count: 12, speed: [3, 9], spread: 6.3, life: [0.15, 0.35], size: [0.06, 0.16], color: [0xffffff, 0xbfd0ff], gravity: 12, bright: 1.6 }); break; }
        fx.glow.burst(ev.x, ev.y, 0.4, { count: big ? 18 : 9, speed: [3, big ? 13 : 9], spread: 6.3, life: [0.14, 0.4], size: [0.08, big ? 0.34 : 0.22], color: colors, gravity: 8, bright: 1.9 });
        fx.ring(ev.x, ev.y, 0.3, { color: colors[0], from: 0.15, to: big ? 2 : 1.1, life: 0.2 }); if (flashOk) fx.flash(ev.x, ev.y, colors[0], big ? 26 : 12, 0.14); this.shake(big ? 0.3 : 0.12); break;
      }
      case 'blocked': fx.ring(ev.x, ev.y, 0.3, { color: 0xbfd0ff, from: 0.2, to: 1.3, life: 0.2 }); break;
      case 'guardBreak': fx.ring(ev.x, ev.y, 0.3, { color: 0xffd27a, from: 0.3, to: 3, life: 0.35, bright: 2 }); fx.chunks(ev.x, ev.y, 0, { count: 8, color: [0x8c8f98, 0x5a5d66], speed: [4, 10] }); this.shake(0.35); break;
      case 'parry': case 'deflect': fx.ring(ev.x, ev.y, 0.3, { color: 0xffffff, from: 0.2, to: 2.6, life: 0.3, bright: 2.4 }); fx.glow.burst(ev.x, ev.y, 0.4, { count: 20, speed: [4, 12], spread: 6.3, life: [0.2, 0.4], size: [0.08, 0.2], color: 0xffffff, bright: 2 }); this.shake(0.3); break;
      case 'shieldHit': fx.ring(ev.x, ev.y, 0.3, { color: 0x9fd0ff, from: 0.3, to: 1.4, life: 0.2 }); break;
      case 'perfectDodge': fx.ring(ev.x, ev.y, 0, { color: 0x7ff4ff, from: 0.4, to: 3.4, life: 0.45, bright: 2 }); break;
      case 'hurt': fx.glow.burst(ev.x, ev.y, 0.4, { count: 16, speed: [3, 10], spread: 6.3, life: [0.2, 0.5], size: [0.1, 0.3], color: [0xff4a3c, 0xffb0a0], bright: 1.6 }); this.shake(0.5); break;
      case 'explosion': {
        const r = ev.r, fire = ev.kind !== 'ice';
        fx.glow.burst(ev.x, ev.y, 0.2, { count: Math.round(22 * r), speed: [2, 5 * r], spread: 6.3, life: [0.25, 0.7], size: [0.3, 0.9], color: fire ? [0xff7a1a, 0xffc23a, 0xfff0b0] : [0xbfeaff, 0xffffff], drag: 3, bright: 1.7, depth: 1.5 });
        fx.dust.burst(ev.x, ev.y, 0.2, { count: Math.round(6 * r), speed: [1, 3 * r], spread: 6.3, life: [0.6, 1.3], size: [0.8, 1.6], color: [0x4a433c, 0x6a625a], grow: 1.8, drag: 2.2, gravity: -1.5 });
        fx.ring(ev.x, ev.y, 0.2, { color: 0xffd27a, from: 0.4, to: r * 1.25, life: 0.3, bright: 2 }); fx.chunks(ev.x, ev.y, 0, { count: Math.round(3 * r), color: [0x6a625a, 0x8f8676], speed: [5, 13] });
        if (flashOk) fx.flash(ev.x, ev.y, 0xffa23c, 70, 0.3); this.shake(0.3 + r * 0.12); break;
      }
      case 'slam': fx.ring(ev.x, ev.y + 0.08, 0, { color: ev.enemy ? 0xff8a6a : 0xfff1c9, from: 0.4, to: ev.r * 1.1, life: 0.34, ground: true, bright: 1.7 }); dust(ev.x, ev.y + 0.1, Math.round(6 + ev.r * 3), { speed: [2, 6], spread: 3 }); fx.chunks(ev.x, ev.y + 0.2, 0, { count: Math.round(3 + ev.r * 2), color: [0x8f8676, 0x736a5e], speed: [4, 10], w: ev.r }); this.shake(0.25 + ev.r * 0.09); break;
      case 'lightning': for (const [a, b] of ev.segs) { fx.bolt(a, b); fx.glow.burst(b[0], b[1], 0.4, { count: 10, speed: [2, 9], spread: 6.3, life: [0.12, 0.35], size: [0.08, 0.22], color: [0xaad4ff, 0xffffff], bright: 2.2 }); if (flashOk) fx.flash(b[0], b[1], 0x9fd0ff, 40, 0.16); } this.shake(0.22); break;
      case 'electrify': for (let i = 0; i < 4; i++) fx.bolt([ev.x + Math.random() * ev.w, ev.y + ev.h], [ev.x + Math.random() * ev.w, ev.y + ev.h + 0.2], 0.5); fx.glow.burst(ev.x + ev.w / 2, ev.y + ev.h, 0, { count: 40, speed: [1, 6], angle: Math.PI / 2, spread: 2, life: [0.2, 0.6], size: [0.08, 0.2], color: [0xaad4ff, 0xffffff], bright: 2.2, jitter: ev.w }); break;
      case 'iceForm': fx.glow.burst(ev.x, ev.y, 0, { count: 26, speed: [1, 6], spread: 6.3, life: [0.3, 0.7], size: [0.1, 0.3], color: [0xbfeaff, 0xffffff], bright: 1.6, jitter: ev.w * 0.8 }); fx.ring(ev.x, ev.y, 0, { color: 0xbfeaff, from: 0.3, to: ev.w * 0.8, life: 0.3, ground: true }); break;
      case 'freeze': case 'frost': fx.glow.burst(ev.x, ev.y, 0.3, { count: 18, speed: [1, 5], spread: 6.3, life: [0.3, 0.6], size: [0.1, 0.28], color: [0xbfeaff, 0xffffff], bright: 1.5 }); break;
      case 'shatter': fx.chunks(ev.x, ev.y, 0, { count: 14, color: [0xbfeaff, 0x8fd4ff], speed: [5, 13], spread: 6.3 }); fx.ring(ev.x, ev.y, 0.3, { color: 0xbfeaff, from: 0.3, to: 2.8, life: 0.3, bright: 2 }); this.shake(0.3); break;
      case 'thaw': fx.dust.burst(ev.x, ev.y, 0.3, { count: 10, speed: [1, 3], angle: Math.PI / 2, spread: 1.5, life: [0.5, 1], size: [0.5, 1], color: 0xf2f6fa, grow: 2, gravity: -2 }); break;
      case 'solidHit': fx.chunks(ev.x, ev.y, 0.5, { count: 3, color: ev.material === 'wood' ? [0x8a6238, 0x6b4a2e] : ev.material === 'ice' ? [0xbfeaff] : [0x8f8676], speed: [2, 6] }); break;
      case 'break': {
        const wood = ev.material === 'wood', ice = ev.material === 'ice';
        fx.chunks(ev.x, ev.y, 0, { count: Math.round(clamp(ev.w * ev.h * 4, 8, 34)), w: ev.w, h: ev.h, color: wood ? [0x8a6238, 0x6b4a2e, 0xa77a48] : ice ? [0xbfeaff, 0x8fd4ff, 0xffffff] : [0x8f8676, 0x736a5e, 0xa39a88], speed: [3, 11], spread: 6.3, size: [0.14, 0.42] });
        dust(ev.x, ev.y, Math.round(clamp(ev.w * ev.h * 2, 5, 16)), { jitter: Math.max(ev.w, ev.h), spread: 6.3 }); if (ev.id) this.scenery.breakSolid(ev.id); this.shake(ice ? 0.1 : 0.3); break;
      }
      case 'enemyDead': fx.chunks(ev.x, ev.y, 0, { count: ev.boss ? 34 : 9, color: [0xe8e2d0, 0xcfc8b4], speed: [3, ev.boss ? 16 : 9], spread: 6.3, size: ev.boss ? [0.2, 0.6] : [0.1, 0.28] }); fx.glow.burst(ev.x, ev.y, 0.3, { count: ev.boss ? 60 : 12, speed: [0.5, ev.boss ? 9 : 3], spread: 6.3, life: [0.5, 1.2], size: [0.14, 0.4], color: [0x8ff6c8, 0x59e0d0], gravity: -3, bright: 1.7 }); if (ev.boss) { fx.ring(ev.x, ev.y, 0, { color: 0x8ff6c8, from: 0.5, to: 12, life: 0.9, bright: 2 }); this.shake(1); } break;
      case 'enemySpawn': fx.ring(ev.x, ev.y + 0.06, 0, { color: 0xb26bff, from: 0.2, to: 1.8, life: 0.7, ground: true }); fx.glow.burst(ev.x, ev.y, 0, { count: 22, speed: [1, 5], angle: Math.PI / 2, spread: 0.9, life: [0.4, 0.9], size: [0.1, 0.26], color: [0xb26bff, 0x7dffcf], bright: 1.6 }); break;
      case 'enemyBlink': for (const [x, y] of [[ev.fromX, ev.fromY], [ev.x, ev.y]]) fx.glow.burst(x, y, 0.2, { count: 18, speed: [1, 5], spread: 6.3, life: [0.25, 0.55], size: [0.1, 0.28], color: [0xc77dff, 0xff7de9], bright: 1.7 }); break;
      case 'enemyShot': fx.ring(ev.x, ev.y, 0.2, { color: 0xc77dff, from: 0.2, to: 1.1, life: 0.2 }); break;
      case 'projectileHit': fx.glow.burst(ev.x, ev.y, 0.3, { count: 8, speed: [2, 7], spread: 6.3, life: [0.12, 0.3], size: [0.08, 0.2], color: HIT_COLORS[ev.kind] || 0xffffff, bright: 1.7 }); break;
      case 'barrelLit': fx.glow.burst(ev.x, ev.y, 0.3, { count: 8, speed: [2, 6], angle: Math.PI / 2, spread: 1.2, life: [0.2, 0.5], size: [0.08, 0.18], color: [0xffd24a, 0xff8a2a], gravity: 10, bright: 1.8 }); break;
      case 'mechanism': fx.ring(ev.x, ev.y + 1, 0, { color: this.biome.accent, from: 0.3, to: 4, life: 0.6, bright: 2.2 }); for (const id of ev.targets) { const s = sim.world.solids.find(s => s.id === id); if (s) fx.bolt([ev.x, ev.y + 1.5], [s.x + s.w / 2, s.y + s.h / 2], 0.5); } this.shake(0.25); break;
      case 'pylonReject': dust(ev.x, ev.y, 4); break;
      case 'pickup': fx.glow.burst(ev.x, ev.y, 0.3, { count: ev.kind === 'mote' ? 4 : 28, speed: [1, ev.kind === 'mote' ? 3 : 8], spread: 6.3, life: [0.25, 0.7], size: [0.08, 0.26], color: ev.kind === 'heart' || ev.kind === 'heal' ? [0x7dffa0, 0xffffff] : ev.kind === 'skyshard' ? [0x7df6ff, 0xffffff] : [0xffe08a, 0xffffff], bright: 1.8 }); if (ev.kind !== 'mote' && ev.kind !== 'heal') fx.ring(ev.x, ev.y, 0.2, { color: 0xffe08a, from: 0.3, to: 3, life: 0.45, bright: 2 }); break;
      case 'checkpoint': fx.ring(ev.x, ev.y + 0.1, -1.5, { color: this.biome.accent, from: 0.4, to: 4.5, life: 0.7, ground: true, bright: 2 }); fx.glow.burst(ev.x, ev.y, -1.6, { count: 40, speed: [2, 8], angle: Math.PI / 2, spread: 0.7, life: [0.5, 1.2], size: [0.1, 0.26], color: [this.biome.accent, 0xffffff], bright: 1.8 }); break;
      case 'pit': fx.ring(ev.x, ev.y + 1, 0, { color: 0xffffff, from: 0.3, to: 2.4, life: 0.4 }); break;
      case 'death': fx.glow.burst(p.x, p.y + 1, 0.3, { count: 40, speed: [2, 9], spread: 6.3, life: [0.5, 1.2], size: [0.12, 0.34], color: [p.char.color, 0xffffff], bright: 1.8 }); this.shake(0.8); break;
      case 'bossIntro': this.shake(0.5); break;
      case 'bossPhase': { const e = sim.enemies.find(e => e.id === ev.id); if (e) fx.ring(e.x, e.y + 2, 0, { color: 0xff4a3c, from: 0.5, to: 11, life: 0.8, bright: 2.2 }); this.shake(0.7); break; }
      case 'bossStagger': fx.ring(ev.x, ev.y - 1.5, 0, { color: 0xffe08a, from: 0.5, to: 6, life: 0.6, bright: 2.2 }); this.shake(0.5); break;
      case 'dialogue': if (ev.vista) this.cam.vista = 5; break;
    }
  }
}
