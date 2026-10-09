// Damage, hit resolution, projectiles, explosions and the elemental interaction rules shared by every character and enemy.
import { COMBAT, PHYS, DIFFICULTY } from '../config.js';
import { emit, tech, refill, releaseGrapple, startDive } from './player.js';
import { boxOverlap, bodyBox, circleBox, raycast, zoneAt, clamp, sign } from './world.js';

// How strongly each kind of hit affects each breakable material. A missing entry means no effect.
export const MATERIALS = {
  wood: { blade: 1, heavy: 2, slam: 3, charge: 3, kinetic: 1.5, fire: 2.5, explosion: 4, lightning: 0.6 },
  stone: { heavy: 0.5, slam: 3, charge: 3, explosion: 3, kinetic: 0.6 },
  ice: { blade: 1, heavy: 2, slam: 3, charge: 3, kinetic: 1.5, fire: 8, explosion: 4 },
};
// What each kind of hit does to a living target on top of its damage.
const ELEMENT = { fire: 'fire', explosion: 'fire', ice: 'ice', lightning: 'lightning' };

export function damageSolid(sim, s, kind, amount) {
  if (!s || s.dead || !s.hp) return false;
  const mult = MATERIALS[s.material]?.[kind]; if (!mult) return false;
  s.hp -= amount * mult; if (kind === 'fire' && s.material === 'wood') s.burning = 1.6;
  emit(sim, 'solidHit', { id: s.id, x: s.x + s.w / 2, y: s.y + s.h / 2, material: s.material });
  if (s.hp <= 0) breakSolid(sim, s);
  return true;
}
export function breakSolid(sim, s) {
  if (s.dead) return; s.dead = true;
  for (const b of [sim.player, ...sim.enemies]) if (b.ground === s) { b.ground = null; b.onGround = false; }
  emit(sim, 'break', { id: s.id, x: s.x + s.w / 2, y: s.y + s.h / 2, w: s.w, h: s.h, material: s.material });
}

export function applyElement(sim, e, element, power = 1) {
  if (element === 'fire') { if (e.frozen > 0) { e.frozen = 0; e.wet = 4; emit(sim, 'thaw', { x: e.x, y: e.y + e.h / 2 }); } else { e.burn = 3; e.chill = 0; } }
  else if (element === 'ice') { e.burn = 0; e.chill += power * (e.wet > 0 ? 2 : 1); if (e.chill >= 1) { e.chill = 0; e.frozen = e.def.boss ? 0.9 : 2.6; e.vx = 0; emit(sim, 'freeze', { x: e.x, y: e.y + e.h / 2 }); } }
  else if (element === 'lightning') e.shock = 0.45;
}

export function killEnemy(sim, e, hit) {
  if (e.dead) return; e.dead = true; e.deadT = 0; e.hp = 0; e.guarding = false; sim.stats.kills++;
  if (sim.player.rope?.target === e) releaseGrapple(sim, false);
  emit(sim, 'enemyDead', { id: e.id, type: e.type, x: e.x, y: e.y + e.h / 2, boss: !!e.def.boss, group: e.group });
  if (e.def.explodes) e.fuse = Math.min(e.fuse > 0 ? e.fuse : 9, 0.3);
  else { const n = e.def.boss ? 14 : 2 + (sim.combo.count > 6 ? 1 : 0); for (let i = 0; i < n; i++) sim.pickups.push({ kind: sim.player.hp < sim.player.maxHp * 0.5 && i === 0 ? 'heal' : 'mote', x: e.x, y: e.y + e.h * 0.6, vx: (sim.rand() - 0.5) * 9, vy: 5 + sim.rand() * 6, t: 0, loose: true }); }
}

export function damageEnemy(sim, e, hit) {
  if (e.dead || e.spawnT > 0 || e.iframes > 0) return 'miss';
  const p = sim.player, dir = sign(e.x - (hit.x ?? p.x)) || p.facing;
  let dmg = hit.dmg * (hit.owner !== 'world' && p.counterT > 0 ? COMBAT.counterBonus : 1);
  const front = sign((hit.x ?? p.x) - e.x) === e.facing;
  if (e.guarding && front && !hit.guardBreak && !hit.fromAbove && hit.kind !== 'lightning') {
    e.guardHp -= dmg; e.vx = dir * 2.5; sim.hitstop = Math.max(sim.hitstop, 0.05);
    emit(sim, 'blocked', { x: e.x - dir * 0.6, y: e.y + e.h * 0.6 });
    if (e.guardHp <= 0) { e.guarding = false; e.stun = 2; e.guardHp = e.def.guardHp; emit(sim, 'guardBreak', { x: e.x, y: e.y + e.h * 0.6 }); }
    return 'blocked';
  }
  if (hit.guardBreak && e.guarding) { e.guarding = false; e.stun = Math.max(e.stun, 1.6); e.guardHp = e.def.guardHp; emit(sim, 'guardBreak', { x: e.x, y: e.y + e.h * 0.6 }); }
  if (e.frozen > 0 && (hit.heavy || hit.kind === 'slam' || hit.kind === 'explosion')) { dmg *= COMBAT.shatterBonus; e.frozen = 0; emit(sim, 'shatter', { x: e.x, y: e.y + e.h / 2 }); }
  if (hit.kind === 'lightning' && e.wet > 0) dmg *= COMBAT.wetLightning;
  e.hp -= dmg; e.flash = 0.14; e.alert = true; sim.stats.damage += dmg;
  if (!hit.noCombo) { sim.combo.count++; sim.combo.t = COMBAT.comboWindow; sim.combo.best = Math.max(sim.combo.best, sim.combo.count); }
  sim.hitstop = Math.max(sim.hitstop, hit.stop ?? 0.03);
  const kb = hit.kb || [0, 0], weight = e.def.weight || 0;
  e.poise -= dmg * (hit.heavy ? 1.7 : 1);
  if (e.def.boss) { if (e.poise <= 0) { e.poise = e.def.poise; e.stun = 2.4; e.state = 'stagger'; e.stateT = 0; emit(sim, 'bossStagger', { x: e.x, y: e.y + e.h }); } }
  else if (e.poise <= 0 || hit.launch || e.frozen > 0) {
    e.poise = e.def.poise; e.hurt = hit.launch ? 0.6 : 0.34; e.state = 'hurt'; e.stateT = 0; e.hits = (e.hits || 0) + 1; e.hitsT = 1.6;
    if (e.frozen <= 0) { e.vx = dir * kb[0] * (1 - weight); if (kb[1]) { e.vy = kb[1] * (1 - weight * 0.6); e.onGround = false; e.launched = kb[1] > 9; } }
  } else e.vx += dir * kb[0] * 0.2;
  const element = hit.element || ELEMENT[hit.kind]; if (element) applyElement(sim, e, element, hit.chill ?? 1);
  if (e.hp <= 0) killEnemy(sim, e, hit);
  return 'hit';
}

export function damagePlayer(sim, hit) {
  const p = sim.player; if (p.dead || sim.ended || sim.cinematic) return 'miss';
  if (p.iframes > 0) {
    if (p.dashAge < COMBAT.perfectDodge + 0.14) { p.dashAge = 9; p.counterT = COMBAT.counterTime; p.dashCd = 0; sim.slowmo = 0.4; emit(sim, 'perfectDodge', { x: p.x, y: p.y + 1 }); tech(sim, 'perfect dodge'); }
    return 'miss';
  }
  const dir = sign(p.x - (hit.x ?? p.x)) || -p.facing;
  if (p.shield && sign((hit.x ?? p.x) - p.x) === p.facing && !hit.unblockable) {
    if (p.shieldT < 0.2) {
      sim.hitstop = Math.max(sim.hitstop, 0.1); emit(sim, 'parry', { x: p.x + p.facing * 0.7, y: p.y + 1.1 }); tech(sim, 'parry');
      if (hit.source && !hit.source.dead) { hit.source.stun = Math.max(hit.source.stun, 1.5); hit.source.poise = 0; hit.source.state = 'hurt'; hit.source.hurt = 0.5; }
      return 'parry';
    }
    p.hp -= hit.dmg * 0.12 * DIFFICULTY[sim.difficulty].enemyDamage; p.vx = dir * 2; emit(sim, 'shieldHit', { x: p.x + p.facing * 0.7, y: p.y + 1.1 });
    if (p.hp > 0) return 'blocked';
  } else {
    p.hp -= hit.dmg * DIFFICULTY[sim.difficulty].enemyDamage; sim.stats.hurt++;
    const kb = hit.kb || [7, 7]; p.vx = dir * kb[0]; p.vy = kb[1]; p.onGround = false; p.ground = null; p.jumping = false; p.hitstun = 0.24; p.iframes = COMBAT.hurtIframes;
    p.action = null; p.charging = -1; p.shield = false; if (p.rope) { p.rope = null; } if (p.mode !== 'normal') { p.mode = 'normal'; p.modeT = 0; } p.h = p.char.h;
    sim.combo.count = 0; if (p.flow) { p.flow = 0; emit(sim, 'flowLost', {}); }
    sim.hitstop = Math.max(sim.hitstop, 0.07); emit(sim, 'hurt', { dmg: hit.dmg, x: p.x, y: p.y + 1 });
  }
  if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deadT = 0; p.shield = false; emit(sim, 'death', {}); }
  return 'hit';
}

export function spawnProjectile(sim, def) { const pr = { life: 3, r: 0.25, gravity: 0, pierce: 0, hit: new Set(), age: 0, id: sim.nextId++, ...def }; sim.projectiles.push(pr); return pr; }

export function explode(sim, x, y, r, dmg, kind = 'explosion', owner = 'player') {
  emit(sim, 'explosion', { x, y, r, kind });
  for (const e of sim.enemies) if (!e.dead && circleBox(x, y, r, bodyBox(e))) damageEnemy(sim, e, { dmg, kind, kb: [8, 11], launch: true, guardBreak: true, heavy: true, x, owner, stop: 0.06 });
  const p = sim.player;
  if (owner !== 'player' && circleBox(x, y, r * 0.85, bodyBox(p))) damagePlayer(sim, { dmg: dmg * (owner === 'world' ? 0.45 : 1), x, kb: [9, 10], kind });
  for (const s of sim.world.solids) if (s.hp && !s.dead && circleBox(x, y, r, s)) { damageSolid(sim, s, 'explosion', dmg); if (kind === 'fire' || kind === 'explosion') damageSolid(sim, s, 'fire', dmg * 0.5); }
  for (const prop of sim.props) if (!prop.dead && circleBox(x, y, r, prop)) hitProp(sim, prop, 'explosion', dmg);
  for (const pr of sim.projectiles) if (pr.owner === 'enemy' && Math.hypot(pr.x - x, pr.y - y) < r) pr.life = 0;
}

export function activate(sim, prop) {
  if (prop.active) return; prop.active = true;
  for (const id of prop.targets || []) for (const s of sim.world.solids) if (s.id === id) { if (s.gate) s.open = true; if (s.move?.trigger) s.move.active = true; if (s.hidden) { s.hidden = false; s.dead = false; } }
  emit(sim, 'mechanism', { id: prop.id, x: prop.x + prop.w / 2, y: prop.y + prop.h / 2, targets: prop.targets || [] });
  if (prop.flag) sim.flags[prop.flag] = true;
}

export function hitProp(sim, prop, kind, dmg) {
  if (prop.dead) return;
  if (prop.type === 'barrel') { if (prop.fuse < 0) { prop.fuse = kind === 'fire' || kind === 'explosion' || kind === 'lightning' ? 0.14 : 0.7; emit(sim, 'barrelLit', { x: prop.x + prop.w / 2, y: prop.y + prop.h }); } }
  else if (prop.type === 'pylon') { if (prop.accepts.includes(kind)) activate(sim, prop); else emit(sim, 'pylonReject', { x: prop.x + prop.w / 2, y: prop.y + prop.h }); }
  else if (prop.type === 'crate') { prop.hp -= dmg; emit(sim, 'solidHit', { x: prop.x + prop.w / 2, y: prop.y + prop.h / 2, material: 'wood' }); if (prop.hp <= 0) { prop.dead = true; emit(sim, 'break', { x: prop.x + prop.w / 2, y: prop.y + prop.h / 2, w: prop.w, h: prop.h, material: 'wood', prop: prop.id }); for (let i = 0; i < 3; i++) sim.pickups.push({ kind: 'mote', x: prop.x + prop.w / 2, y: prop.y + 0.6, vx: (sim.rand() - 0.5) * 7, vy: 5 + sim.rand() * 5, t: 0, loose: true }); } }
}

// Lightning that touches water electrifies the whole pool.
export function electrify(sim, zone, dmg) {
  if (zone.live > 0) return; zone.live = 1.1; emit(sim, 'electrify', { x: zone.x, y: zone.y, w: zone.w, h: zone.h });
  for (const e of sim.enemies) if (!e.dead && zoneAt(sim.world, 'water', e.x, e.y + 0.2) === zone) { e.wet = 3; damageEnemy(sim, e, { dmg, kind: 'lightning', kb: [0, 6], stop: 0.02, x: e.x }); }
}

function impact(sim, pr, x, y, solid) {
  pr.life = 0;
  if (solid) damageSolid(sim, solid, pr.kind, pr.dmg);
  if (pr.explode) explode(sim, x, y, pr.explode, pr.dmg, pr.kind, pr.owner); else emit(sim, 'projectileHit', { x, y, kind: pr.kind });
  if (pr.kind === 'lightning') { const z = zoneAt(sim.world, 'water', x, y); if (z) electrify(sim, z, pr.dmg); }
}

export function stepProjectiles(sim) {
  const dt = sim.dt, p = sim.player;
  for (const pr of sim.projectiles) {
    if (pr.life <= 0) continue;
    pr.life -= dt; pr.age += dt;
    if (pr.homing && pr.owner === 'enemy') { const want = Math.atan2(p.y + 1 - pr.y, p.x - pr.x), have = Math.atan2(pr.vy, pr.vx), speed = Math.hypot(pr.vx, pr.vy), turn = clamp(Math.atan2(Math.sin(want - have), Math.cos(want - have)), -pr.homing * dt, pr.homing * dt); pr.vx = Math.cos(have + turn) * speed; pr.vy = Math.sin(have + turn) * speed; }
    pr.vy -= pr.gravity * dt;
    const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt, wall = raycast(sim.world, pr.x, pr.y, nx, ny);
    if (wall) { impact(sim, pr, wall.x, wall.y, wall.solid); continue; }
    pr.x = nx; pr.y = ny;
    if (pr.owner === 'player') {
      for (const e of sim.enemies) {
        if (e.dead || e.spawnT > 0 || pr.hit.has(e) || !circleBox(pr.x, pr.y, pr.r, bodyBox(e))) continue;
        pr.hit.add(e);
        if (pr.explode) { impact(sim, pr, pr.x, pr.y); break; }
        const res = damageEnemy(sim, e, { dmg: pr.dmg, kind: pr.kind, kb: pr.kb || [4, 2], stop: 0.02, x: pr.x - pr.vx, heavy: pr.heavy });
        emit(sim, 'hit', { x: pr.x, y: pr.y, kind: pr.kind, res });
        if (pr.pierce-- <= 0 || res === 'blocked') { pr.life = 0; break; }
      }
      if (pr.life > 0) for (const prop of sim.props) if (!prop.dead && circleBox(pr.x, pr.y, pr.r, prop)) { hitProp(sim, prop, pr.kind, pr.dmg); impact(sim, pr, pr.x, pr.y); break; }
    } else if (circleBox(pr.x, pr.y, pr.r, bodyBox(p))) {
      const res = damagePlayer(sim, { dmg: pr.dmg, x: pr.x - pr.vx, kb: [6, 6], kind: pr.kind, source: pr.source });
      if (res === 'parry') { pr.owner = 'player'; pr.vx *= -1.6; pr.vy *= -1.6; pr.dmg *= 2; pr.homing = 0; pr.life = 2.5; pr.hit.clear(); emit(sim, 'deflect', { x: pr.x, y: pr.y }); }
      else if (res !== 'miss') impact(sim, pr, pr.x, pr.y);
    }
    if (pr.life <= 0 && pr.explode && pr.explodeOnExpire) explode(sim, pr.x, pr.y, pr.explode, pr.dmg, pr.kind, pr.owner);
  }
  if (sim.projectiles.length > 40 || sim.projectiles.some(pr => pr.life <= 0)) sim.projectiles = sim.projectiles.filter(pr => pr.life > 0);
}

// Applies one attack hitbox for this tick. Everything the box touches reacts once per swing.
function strike(sim, a, d) {
  const p = sim.player, [fx, oy, w, h] = d.box, box = { x: p.x + p.facing * fx - w / 2, y: p.y + oy, w, h }, power = a.power || 1;
  let landed = false;
  for (const e of sim.enemies) {
    if (e.dead || e.spawnT > 0 || a.hit.has(e) || !boxOverlap(box, bodyBox(e))) continue;
    a.hit.add(e);
    const speedBonus = p.mode === 'grapple' ? 1 + Math.hypot(p.vx, p.vy) / 22 : 1;
    const res = damageEnemy(sim, e, { dmg: d.dmg * power * speedBonus, kind: d.kind, kb: d.kb, stop: d.stop, x: p.x, launch: d.launch, guardBreak: d.guardBreak || (a.power > 1.5 && d.heavy), heavy: d.heavy, element: d.element });
    emit(sim, 'hit', { x: clamp(e.x, box.x, box.x + w), y: e.y + e.h * 0.6, kind: d.kind, res, heavy: !!d.heavy });
    if (res === 'blocked') { p.vx = -p.facing * 5; a.blocked = true; } else if (res === 'hit') landed = true;
  }
  for (const prop of sim.props) if (!prop.dead && !a.hit.has(prop) && boxOverlap(box, prop)) { a.hit.add(prop); hitProp(sim, prop, d.kind, d.dmg * power); landed = true; }
  for (const s of sim.world.solids) if (s.hp && !s.dead && !a.hit.has(s) && boxOverlap(box, s)) { a.hit.add(s); damageSolid(sim, s, d.kind, d.dmg * power); }
  for (const pr of sim.projectiles) if (pr.owner === 'enemy' && pr.life > 0 && circleBox(pr.x, pr.y, pr.r + 0.2, box)) {
    pr.owner = 'player'; const speed = Math.hypot(pr.vx, pr.vy) * 1.7; pr.vx = p.facing * speed; pr.vy = 0.5; pr.dmg *= 1.8; pr.homing = 0; pr.life = 2.5; pr.hit.clear();
    emit(sim, 'deflect', { x: pr.x, y: pr.y }); tech(sim, 'deflect');
  }
  if (landed && !p.onGround && d.pop !== undefined) p.vy = Math.max(p.vy, d.pop);
  if (landed && p.mode === 'grapple' && !a.swingHit) { a.swingHit = true; tech(sim, 'swing strike'); }
}

export function begin(sim, id, power = 0) {
  const p = sim.player, def = sim.kit.attacks[id]; if (!def) return false;
  p.action = { id, def, t: 0, hit: new Set(), fired: false, power: 1 + power * (def.chargeScale ?? 0.8), charge: power };
  p.chain = id; p.buffered = null; if (def.start) def.start(sim, p, p.action);
  emit(sim, 'attack', { id, sfx: def.sfx, heavy: !!def.heavy });
  return true;
}

function slam(sim) {
  const p = sim.player, c = p.char, r = c.diveRadius, kit = sim.kit, ground = p.ground;
  emit(sim, 'slam', { x: p.x, y: p.y, r, big: r > 3 });
  for (const e of sim.enemies) if (!e.dead && Math.abs(e.x - p.x) < r + e.hw && Math.abs(e.y - p.y) < 1.8) damageEnemy(sim, e, { dmg: c.diveDamage, kind: 'slam', kb: [6, 11], launch: true, heavy: true, guardBreak: true, x: p.x, stop: 0.07 });
  for (const s of sim.world.solids) if (s.hp && !s.dead && boxOverlap({ x: p.x - r, y: p.y - 1, w: r * 2, h: 2 }, s)) damageSolid(sim, s, 'slam', c.diveDamage * 2);
  for (const prop of sim.props) if (!prop.dead && Math.abs(prop.x + prop.w / 2 - p.x) < r + 0.5 && Math.abs(prop.y - p.y) < 2.2) hitProp(sim, prop, 'slam', c.diveDamage);
  if (kit.slamElement === 'fire') explode(sim, p.x, p.y + 0.4, 2.4, 14, 'fire', 'player');
  if (ground?.dead && c.bullRush) { p.mode = 'dive'; p.modeT = 0; p.landLock = 0; p.diveHit = new Set(); } // Bragg keeps falling through floors he breaks
}

export function stepActions(sim, inp) {
  const p = sim.player, dt = sim.dt, kit = sim.kit;
  for (const k of Object.keys(p.cooldowns)) p.cooldowns[k] -= dt;
  p.chainT += dt; p.bufferT -= dt; if (p.bufferT <= 0) p.buffered = null;
  if (sim.combo.count) { sim.combo.t -= dt; if (sim.combo.t <= 0) { emit(sim, 'comboEnd', { count: sim.combo.count }); sim.combo.count = 0; } }
  if (p.slamLanded) slam(sim);
  if (p.dead || p.hitstun > 0) { p.action = null; p.charging = -1; p.shield = false; return; }
  const moving = ['mantle', 'dive', 'dash', 'slide', 'wallrun', 'backrun'].includes(p.mode);
  const buffer = (kind, power) => { p.buffered = kind; p.bufferPower = power || 0; p.bufferT = PHYS.actionBuffer; };

  // Dive: Bragg crushes straight through what he lands on, everyone else springs off it.
  if (p.mode === 'dive') for (const e of sim.enemies) {
    if (e.dead || e.spawnT > 0 || p.diveHit.has(e) || !boxOverlap({ x: p.x - p.hw - 0.3, y: p.y - 0.4, w: p.hw * 2 + 0.6, h: 1.2 }, bodyBox(e))) continue;
    p.diveHit.add(e); damageEnemy(sim, e, { dmg: p.char.diveDamage, kind: 'heavy', kb: [3, 4], heavy: true, fromAbove: true, guardBreak: true, x: p.x, stop: 0.08 });
    emit(sim, 'hit', { x: e.x, y: e.y + e.h, kind: 'heavy', res: 'hit', heavy: true });
    if (!p.char.bullRush) { p.vy = PHYS.enemyBounce; p.mode = 'normal'; p.modeT = 0; p.jumping = false; refill(p); tech(sim, 'pogo'); break; }
  }
  if (p.mode === 'dash' && (p.char.bullRush || p.dash.rush || p.dash.phase)) {
    p.dash.hit ||= new Set();
    for (const e of sim.enemies) if (!e.dead && e.spawnT <= 0 && !p.dash.hit.has(e) && boxOverlap({ x: p.x - p.hw - 0.4, y: p.y, w: p.hw * 2 + 0.8, h: p.h }, bodyBox(e))) {
      p.dash.hit.add(e); const phase = p.dash.phase;
      damageEnemy(sim, e, { dmg: phase ? p.dash.dmg : 14, kind: phase ? 'kinetic' : 'charge', kb: phase ? [2, 5] : [10, 6], heavy: !phase, guardBreak: !phase, x: p.x - p.dash.dx, stop: 0.05 });
      emit(sim, 'hit', { x: e.x, y: e.y + e.h * 0.6, kind: 'kinetic', res: 'hit', heavy: !phase });
    }
  }

  if (inp.attack) { if (!p.onGround && inp.my < 0 && !moving) { startDive(sim); return; } buffer('light'); }
  if (inp.heavy && p.charging < 0) { if (!p.onGround && kit.airHeavy === 'dive' && !moving) { startDive(sim); return; } p.charging = 0; }
  if (p.charging >= 0) {
    p.charging += dt;
    if (!inp.heavyHeld || p.charging > COMBAT.chargeMax + 0.5) { const held = p.charging; p.charging = -1; buffer(held >= COMBAT.chargeMin ? 'charged' : 'heavy', clamp((held - COMBAT.chargeMin) / (COMBAT.chargeMax - COMBAT.chargeMin), 0, 1)); }
  }
  for (const slot of ['ability1', 'ability2']) {
    const ab = kit.abilities[slot]; if (!ab) continue;
    if (ab.hold) {
      const want = inp[slot + 'Held'] && !(p.cooldowns[slot] > 0) && !p.action && !moving && p.mode !== 'grapple';
      if (want && !p.shield) { p.shield = true; p.shieldT = 0; p.charging = -1; emit(sim, 'shieldUp', {}); } else if (!want && p.shield) { p.shield = false; p.cooldowns[slot] = ab.cooldown; }
      if (p.shield) p.shieldT += dt;
    } else if (inp[slot]) buffer(slot);
  }

  const a = p.action;
  if (a) {
    const d = a.def; a.t += dt;
    a.lunge = d.lunge && p.onGround && a.t < d.hitAt + (d.hitLen || 0) ? d.lunge * (a.charge ? 1 + a.charge * (d.lungeCharge || 0) : 1) : undefined;
    if (d.box && a.t >= d.hitAt && a.t <= d.hitAt + d.hitLen) {
      if (d.hits > 1) { const index = Math.floor((a.t - d.hitAt) / (d.hitLen / d.hits)); if (index !== a.hitIndex) { a.hitIndex = index; a.hit.clear(); } }
      strike(sim, a, d);
    }
    if (d.fire && !a.fired && a.t >= d.hitAt) { a.fired = true; d.fire(sim, p, a, inp); }
    if (d.rise && !a.rose && a.t >= d.hitAt && a.hit.size && inp.jumpHeld && !a.blocked) { a.rose = true; p.vy = d.rise; p.onGround = false; p.ground = null; p.jumping = false; }
    if (a.t >= d.dur) { p.action = null; p.chainT = 0; }
  }

  if (p.buffered && !moving && p.landLock <= 0 && !p.shield && (!p.action || p.action.t >= p.action.def.cancel)) {
    const kind = p.buffered, air = !p.onGround;
    if (kind === 'light') {
      const chain = air ? kit.airChain : kit.groundChain, last = p.action?.id ?? (p.chainT < 0.4 ? p.chain : null), i = chain.indexOf(last);
      begin(sim, chain[i < 0 || i === chain.length - 1 ? 0 : i + 1]);
    } else if (kind === 'heavy' || kind === 'charged') {
      const id = air ? kit.airHeavy : kind === 'charged' ? kit.charged : kit.heavy;
      if (id === 'dive') { p.buffered = null; startDive(sim); } else begin(sim, id, kind === 'charged' ? p.bufferPower : 0);
    } else {
      const ab = kit.abilities[kind];
      if (ab && !(p.cooldowns[kind] > 0) && p.mode !== 'grapple' && ab.use(sim, p, inp) !== false) { p.cooldowns[kind] = ab.cooldown; p.buffered = null; emit(sim, 'ability', { slot: kind, id: ab.id }); }
      else if (ab && p.cooldowns[kind] > 0) p.buffered = null;
    }
  }
}

export function stepProps(sim) {
  const dt = sim.dt;
  for (const prop of sim.props) {
    if (prop.dead) continue;
    if (prop.type === 'barrel' && prop.fuse >= 0) { prop.fuse -= dt; if (prop.fuse <= 0) { prop.dead = true; explode(sim, prop.x + prop.w / 2, prop.y + prop.h / 2, 3.3, 42, 'fire', 'world'); } }
  }
  for (const s of sim.world.solids) {
    if (s.dead) continue;
    if (s.burning > 0) { s.burning -= dt; s.hp -= 45 * dt; if (s.hp <= 0) breakSolid(sim, s); }
    if (s.temp) { s.ttl -= dt; if (s.ttl <= 0) breakSolid(sim, s); }
  }
  for (const z of sim.world.zones) if (z.live > 0) z.live -= dt;
}
