// Enemy roster and behaviour. Every attack is a windup the player can read, an active window, and a recovery to punish.
import { PHYS, COMBAT, DIFFICULTY } from '../config.js';
import { emit } from './player.js';
import { damagePlayer, spawnProjectile, explode, killEnemy } from './combat.js';
import { moveBody, groundBelow, clearLine, boxOverlap, bodyBox, zoneAt, blocked, approach, sign, clamp } from './world.js';

const strike = (clip, impact, windup, active, recover, box, dmg, kb, extra = {}) => ({ clip, impact, windup, active, recover, box, dmg, kb, ...extra });
const groundWave = (speed, dmg) => (sim, e) => { for (const dir of [-1, 1]) spawnProjectile(sim, { owner: 'enemy', kind: 'slam', look: 'shock', source: e, x: e.x + dir * (e.hw + 0.4), y: e.y + 0.5, vx: dir * speed, vy: 0, dmg, r: 0.55, life: 1.15 }); emit(sim, 'slam', { x: e.x + e.facing * 2, y: e.y, r: 2.4, enemy: true }); };

export const ENEMIES = {
  minion: {
    name: 'Bonewalker', model: 'minion', weapon: 'Skeleton_Blade', scale: 0.8, hp: 36, hw: 0.42, h: 1.7, speed: 3.3, sight: 12, range: 1.9, poise: 8, cooldown: [0.5, 1.1], think: melee,
    attacks: [strike('1H_Melee_Attack_Slice_Diagonal', 0.38, 0.52, 0.12, 0.55, [1.2, 0.3, 2.2, 1.5], 12, [7, 5], { reach: 2.1, lunge: 3 })],
  },
  hunter: {
    name: 'Ridge Hunter', model: 'rogue', weapon: 'Skeleton_Blade', scale: 0.82, hp: 44, hw: 0.42, h: 1.72, speed: 5.8, sight: 14, range: 2, poise: 10, cooldown: [0.35, 0.8], think: melee, evasive: true,
    attacks: [strike('1H_Melee_Attack_Slice_Horizontal', 0.25, 0.34, 0.1, 0.42, [1.2, 0.3, 2.3, 1.5], 10, [6, 4], { reach: 2.2, lunge: 5 }),
      strike('1H_Melee_Attack_Jump_Chop', 0.73, 0.78, 0.16, 0.55, [0.9, -0.2, 2.6, 2.2], 16, [8, 6], { reach: 9, minReach: 4, leapAt: 0.3, leap: 12.5, air: 0.55 })],
  },
  caster: {
    name: 'Hexcaster', model: 'mage', weapon: 'Skeleton_Staff', scale: 0.8, hp: 32, hw: 0.42, h: 1.7, speed: 2.6, sight: 15, range: 12, poise: 6, cooldown: [1.6, 2.4], think: caster,
    attacks: [strike('Spellcast_Raise', 1.0, 0.8, 0, 0.5, null, 0, null, { reach: 13, fire: (sim, e) => { const p = sim.player, x = e.x + e.facing * 0.5, y = e.y + 1.7, a = Math.atan2(p.y + 1 - y, p.x - x); spawnProjectile(sim, { owner: 'enemy', kind: 'hex', look: 'hex', source: e, x, y, vx: Math.cos(a) * 8.5, vy: Math.sin(a) * 8.5, dmg: 12, r: 0.32, life: 4.2, homing: 1.1 }); emit(sim, 'enemyShot', { x, y }); } })],
  },
  bulwark: {
    name: 'Gate Bulwark', model: 'warrior', weapon: 'Skeleton_Axe', scale: 0.92, hp: 85, hw: 0.5, h: 1.9, speed: 2.3, sight: 11, range: 2.3, poise: 30, weight: 0.55, cooldown: [0.9, 1.5], think: melee, guard: true, guardHp: 40, heavy: true,
    attacks: [strike('2H_Melee_Attack_Chop', 0.82, 0.88, 0.14, 1.0, [1.5, 0, 2.8, 2.8], 22, [9, 8], { reach: 2.7, lunge: 2 })],
  },
  wraith: {
    name: 'Sky Wraith', model: 'mage', scale: 0.62, tint: 0x7fd8ff, hp: 24, hw: 0.4, h: 1.3, speed: 5.5, sight: 15, poise: 5, cooldown: [1.4, 2.2], think: wraith, fly: true, anchor: true,
    attacks: [strike('Spellcast_Shoot', 0.08, 0.62, 0.55, 0.6, [0, -0.2, 1.4, 1.6], 12, [7, 5], { swoop: 15 })],
  },
  ember: {
    name: 'Emberhusk', model: 'minion', scale: 0.66, tint: 0xff8a3c, hp: 18, hw: 0.36, h: 1.35, speed: 6.6, sight: 13, range: 2.3, poise: 4, cooldown: [0, 0], think: ember, explodes: true, reckless: true, attacks: [],
  },
  dummy: { name: 'Training Husk', model: 'minion', scale: 0.8, hp: 160, hw: 0.42, h: 1.7, speed: 0, sight: 0, poise: 8, cooldown: [9, 9], attacks: [], think: (sim, e) => { e.want = 0; e.hp = Math.min(e.maxHp, e.hp + 25 * sim.dt); } },
  warden: {
    name: 'The Gatewarden', model: 'warrior', weapon: 'Skeleton_Axe', scale: 2.05, hp: 620, hw: 1.0, h: 3.9, speed: 2.9, sight: 40, range: 4.4, poise: 110, weight: 1, cooldown: [1.0, 1.3], think: warden, boss: true, heavy: true,
    attacks: {
      cleave: strike('2H_Melee_Attack_Slice', 0.38, 0.72, 0.14, 0.75, [2.4, 0, 5.4, 3], 20, [11, 7], { lunge: 4 }),
      crush: strike('2H_Melee_Attack_Chop', 0.82, 0.98, 0.14, 1.15, [2.5, 0, 3.8, 4.6], 26, [8, 12], { fire: groundWave(11, 14) }),
      leap: strike('1H_Melee_Attack_Jump_Chop', 0.73, 1.0, 0.2, 1.25, [0, 0, 6.2, 2.4], 24, [10, 10], { leapAt: 0.38, leap: 17, air: 0.62, fire: groundWave(12, 14) }),
      spin: strike('2H_Melee_Attack_Spin', 0.62, 0.85, 1.5, 1.35, [0, 0, 6.4, 2.8], 15, [9, 6], { lunge: 6.5, repeat: 0.42 }),
    },
  },
};

let serial = 1;
export function spawnEnemy(sim, type, x, y, opts = {}) {
  const def = ENEMIES[type], hp = def.hp * DIFFICULTY[sim.difficulty].enemyHp;
  const e = {
    id: 'e' + serial++, type, def, x, y, vx: 0, vy: 0, hw: def.hw, h: def.h, facing: opts.facing || -1, hp, maxHp: hp, poise: def.poise, state: 'idle', stateT: 0, cd: 0.4 + sim.rand() * 0.6,
    onGround: false, ground: null, alert: !!opts.alert, home: x, homeY: y, spawnT: opts.spawn ? 1.0 : 0, hurt: 0, stun: 0, frozen: 0, burn: 0, chill: 0, wet: 0, shock: 0, flash: 0,
    guarding: !!def.guard, guardHp: def.guardHp || 0, dead: false, deadT: 0, group: opts.group, iframes: 0, fuse: -1, want: 0, phase: 1, blinkCd: 2, hits: 0, hitsT: 0, attack: null, launched: false,
  };
  sim.enemies.push(e);
  if (opts.spawn) emit(sim, 'enemySpawn', { id: e.id, x, y, type });
  return e;
}

const setState = (e, state) => { e.state = state; e.stateT = 0; };
function startAttack(sim, e, attack) {
  e.attack = attack; e.struck = false; e.fired = false; e.leapt = false; e.strikeT = 0; e.guarding = false; e.want = 0; setState(e, 'attack');
  emit(sim, 'telegraph', { id: e.id, x: e.x, y: e.y + e.h, time: attack.windup, boss: !!e.def.boss });
}

// Runs the current attack. Returns true while it is still in progress.
function runAttack(sim, e) {
  const a = e.attack, t = e.stateT, p = sim.player, dt = sim.dt;
  e.want = a.lunge && t >= a.windup - 0.08 && t < a.windup + a.active ? e.facing * a.lunge : 0;
  if (t < a.windup * 0.6 && !a.swoop) e.facing = sign(p.x - e.x) || e.facing; // tracks early, commits late
  if (a.leap && !e.leapt && t >= a.leapAt) { e.leapt = true; e.vx = clamp((p.x - e.x) / a.air, -12, 12); e.vy = a.leap; e.onGround = false; e.ground = null; }
  if (e.leapt && !e.onGround) e.want = e.vx;
  if (a.box && t >= a.windup && t <= a.windup + a.active) {
    if (a.repeat) { e.strikeT -= dt; if (e.strikeT <= 0) { e.struck = false; e.strikeT = a.repeat; } }
    const [fx, oy, w, h] = a.box, box = { x: e.x + e.facing * fx - w / 2, y: e.y + oy, w, h };
    if (!e.struck && boxOverlap(box, bodyBox(p))) { const res = damagePlayer(sim, { dmg: a.dmg, x: e.x, kb: a.kb, source: e }); if (res !== 'miss') e.struck = true; }
  }
  if (a.fire && !e.fired && t >= a.windup) { e.fired = true; a.fire(sim, e); }
  if (t >= a.windup + a.active + a.recover) { const [lo, hi] = e.def.cooldown; e.cd = (lo + sim.rand() * (hi - lo)) * (e.def.boss ? [1, 1, 0.75, 0.55][e.phase] : 1); e.attack = null; setState(e, 'chase'); return false; }
  return true;
}

function notice(sim, e) {
  if (e.alert) return true;
  const p = sim.player, dx = p.x - e.x;
  if (Math.abs(dx) < e.def.sight && Math.abs(p.y - e.y) < 6 && clearLine(sim.world, e.x, e.y + e.h * 0.8, p.x, p.y + 1)) { e.alert = true; e.cd = Math.max(e.cd, 0.45); emit(sim, 'alert', { id: e.id, x: e.x, y: e.y + e.h }); return true; }
  // Idle patrol around the spawn point.
  if (!e.def.fly) { e.patrolT = (e.patrolT || 0) - sim.dt; if (e.patrolT <= 0) { e.patrolT = 2 + sim.rand() * 2; e.patrolDir = e.x > e.home + 2 ? -1 : e.x < e.home - 2 ? 1 : sim.rand() < 0.5 ? -1 : 1; } const walking = e.patrolT > 1.6; e.facing = e.patrolDir; e.want = walking && canWalk(sim, e, e.patrolDir) ? e.patrolDir * e.def.speed * 0.4 : 0; }
  return false;
}
const canWalk = (sim, e, dir) => e.def.reckless || !!groundBelow(sim.world, e.x + dir * (e.hw + 0.35), e.y, 1.3);

function melee(sim, e) {
  if (e.state === 'attack' && runAttack(sim, e)) return;
  if (e.state === 'dodge') { if (e.stateT > 0.4) setState(e, 'chase'); return; }
  if (!notice(sim, e)) return;
  const p = sim.player, d = e.def, dx = p.x - e.x, adx = Math.abs(dx), dy = p.y - e.y;
  e.facing = sign(dx) || e.facing; if (d.guard) e.guarding = true;
  if (d.evasive && e.hits >= 2 && e.onGround) { e.hits = 0; e.vx = -e.facing * 10; e.vy = 5; e.onGround = false; e.iframes = 0.3; setState(e, 'dodge'); emit(sim, 'enemyDodge', { id: e.id }); return; }
  if (e.cd <= 0 && e.onGround && Math.abs(dy) < 2.4) {
    const options = d.attacks.filter(a => adx <= a.reach && adx >= (a.minReach || 0));
    if (options.length) { startAttack(sim, e, options[Math.floor(sim.rand() * options.length)]); return; }
  }
  e.want = adx > d.range * 0.7 && canWalk(sim, e, e.facing) ? e.facing * d.speed : 0;
}

function caster(sim, e) {
  if (e.state === 'attack' && runAttack(sim, e)) return;
  if (!notice(sim, e)) return;
  const p = sim.player, dx = p.x - e.x, adx = Math.abs(dx), away = -sign(dx) || 1;
  e.facing = sign(dx) || e.facing; e.blinkCd -= sim.dt;
  if (adx < 3.6 && e.blinkCd <= 0) { // slips away when cornered
    for (const dir of [away, -away]) {
      const nx = e.x + dir * 8.5, g = groundBelow(sim.world, nx, e.y + 1.5, 4);
      if (g && nx > g.x + 0.6 && nx < g.x + g.w - 0.6 && !blocked(sim.world, { x: nx - e.hw, y: g.y + g.h + 0.05, w: e.hw * 2, h: e.h })) {
        emit(sim, 'enemyBlink', { fromX: e.x, fromY: e.y + 1, x: nx, y: g.y + g.h + 1 }); e.x = nx; e.y = g.y + g.h; e.vx = 0; e.blinkCd = 5; e.cd = Math.max(e.cd, 0.7); return;
      }
    }
    e.blinkCd = 1.5;
  }
  if (e.cd <= 0 && adx < 13 && clearLine(sim.world, e.x, e.y + 1.7, p.x, p.y + 1)) { startAttack(sim, e, e.def.attacks[0]); return; }
  e.want = adx > 10 && canWalk(sim, e, e.facing) ? e.facing * e.def.speed : adx < 6 && canWalk(sim, e, away) ? away * e.def.speed : 0;
}

function wraith(sim, e) {
  const p = sim.player, dt = sim.dt, a = e.def.attacks[0];
  if (e.state === 'attack') {
    const t = e.stateT;
    if (t < a.windup) { e.vx = approach(e.vx, 0, 30 * dt); e.vy = approach(e.vy, 1.5, 30 * dt); e.facing = sign(p.x - e.x) || e.facing; e.aim = Math.atan2(p.y + 0.9 - (e.y + 0.6), p.x - e.x); }
    else if (t < a.windup + a.active) { e.vx = Math.cos(e.aim) * a.swoop; e.vy = Math.sin(e.aim) * a.swoop; if (!e.struck && boxOverlap({ x: e.x - 0.7, y: e.y - 0.2, w: 1.4, h: 1.6 }, bodyBox(p))) { if (damagePlayer(sim, { dmg: a.dmg, x: e.x, kb: a.kb, source: e }) !== 'miss') e.struck = true; } }
    else if (t < a.windup + a.active + a.recover) { e.vx = approach(e.vx, 0, 25 * dt); e.vy = approach(e.vy, 6, 30 * dt); }
    else { e.cd = 1.4 + sim.rand() * 0.9; setState(e, 'chase'); }
    return;
  }
  if (!e.alert) { e.vx = approach(e.vx, 0, 10 * dt); e.vy = Math.sin(sim.time * 2 + e.home) * 0.6 + (e.homeY - e.y) * 2; notice(sim, e); return; }
  const side = e.x < p.x ? -1 : 1, tx = p.x + side * 5.5, ty = p.y + 4.2 + Math.sin(sim.time * 2.3 + e.home) * 0.5;
  e.facing = sign(p.x - e.x) || e.facing;
  e.vx = approach(e.vx, clamp((tx - e.x) * 2.2, -e.def.speed, e.def.speed), 18 * dt); e.vy = approach(e.vy, clamp((ty - e.y) * 2.2, -e.def.speed, e.def.speed), 18 * dt);
  if (e.cd <= 0 && Math.hypot(tx - e.x, ty - e.y) < 3 && clearLine(sim.world, e.x, e.y + 0.6, p.x, p.y + 0.9)) { e.struck = false; setState(e, 'attack'); emit(sim, 'telegraph', { id: e.id, x: e.x, y: e.y + e.h, time: a.windup }); }
}

function ember(sim, e) {
  if (e.fuse > 0) { e.want = 0; return; }
  if (!notice(sim, e)) return;
  const p = sim.player, dx = p.x - e.x;
  e.facing = sign(dx) || e.facing; e.want = e.facing * e.def.speed;
  if (Math.abs(dx) < e.def.range && Math.abs(p.y - e.y) < 2.2) { e.fuse = 0.8; e.want = 0; setState(e, 'fuse'); emit(sim, 'telegraph', { id: e.id, x: e.x, y: e.y + e.h, time: 0.8, fuse: true }); }
}

function warden(sim, e) {
  const p = sim.player, d = e.def, frac = e.hp / e.maxHp, phase = frac > 0.62 ? 1 : frac > 0.3 ? 2 : 3;
  if (e.state === 'idle') { if (!e.alert) return; setState(e, 'intro'); emit(sim, 'bossIntro', { id: e.id, name: d.name }); return; }
  if (e.state === 'intro') { e.iframes = 0.2; e.facing = sign(p.x - e.x) || e.facing; if (e.stateT > 2.1) setState(e, 'chase'); return; }
  if (e.state === 'stagger') { if (e.stun <= 0) setState(e, 'chase'); return; }
  if (e.state === 'attack' && runAttack(sim, e)) return;
  if (phase > e.phase) { // each new phase calls reinforcements, then fights harder
    e.phase = phase; e.attack = null; setState(e, 'summon'); e.summoned = false; emit(sim, 'bossPhase', { phase, id: e.id }); return;
  }
  if (e.state === 'summon') {
    e.iframes = 0.2; e.want = 0;
    if (!e.summoned && e.stateT > 1.1) { e.summoned = true; const types = e.phase === 2 ? ['minion', 'minion'] : ['hunter', 'ember', 'ember']; types.forEach((type, i) => { const x = clamp(e.x + (i % 2 ? 1 : -1) * (5 + i * 1.5), sim.arenaBounds?.[0] ?? e.x - 12, sim.arenaBounds?.[1] ?? e.x + 12); spawnEnemy(sim, type, x, e.y + 0.1, { spawn: true, alert: true, group: e.group + '-adds' }); }); }
    if (e.stateT > 2.2) setState(e, 'chase'); return;
  }
  const dx = p.x - e.x, adx = Math.abs(dx);
  e.facing = sign(dx) || e.facing;
  if (e.cd <= 0 && e.onGround) {
    const A = d.attacks, options = [];
    if (adx < 5) options.push(A.cleave, A.crush); else if (adx < 8) options.push(A.crush);
    if (phase >= 2 && adx > 5.5) options.push(A.leap, A.leap);
    if (phase >= 3 && adx < 9) options.push(A.spin);
    const pick = options.filter(a => a !== e.lastAttack || options.length === 1);
    if (pick.length) { const attack = pick[Math.floor(sim.rand() * pick.length)]; e.lastAttack = attack; startAttack(sim, e, attack); return; }
  }
  e.want = adx > d.range * 0.75 ? e.facing * d.speed * (phase === 3 ? 1.35 : 1) : 0;
}

export function stepEnemies(sim) {
  const dt = sim.dt, w = sim.world;
  for (const e of sim.enemies) {
    e.stateT += dt; e.flash -= dt; e.iframes -= dt; e.cd -= dt;
    if (e.fuse > 0) { e.fuse -= dt; if (e.fuse <= 0) { const wasDead = e.dead; explode(sim, e.x, e.y + 0.7, wasDead ? 2.6 : 3.1, wasDead ? 30 : 50, 'fire', 'world'); if (!e.dead) killEnemy(sim, e, {}); e.fuse = -1; e.gone = true; } }
    if (e.dead) {
      e.deadT += dt; e.vy = Math.max(e.vy - PHYS.gravity * dt, -PHYS.maxFall); e.vx = approach(e.vx, 0, (e.onGround ? 14 : 2) * dt);
      const r = moveBody(w, e, e.vx * dt, e.vy * dt); if (r.down) { e.vy = 0; e.onGround = true; } continue;
    }
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    if (e.burn > 0) { e.burn -= dt; e.hp -= 5 * dt; if (e.hp <= 0) { killEnemy(sim, e, {}); continue; } }
    if (zoneAt(w, 'water', e.x, e.y + 0.2)) e.wet = 2.5; else if (e.wet > 0) e.wet -= dt;
    if (e.hitsT > 0) { e.hitsT -= dt; if (e.hitsT <= 0) e.hits = 0; }
    const held = e.frozen > 0 || e.stun > 0 || e.hurt > 0 || e.shock > 0;
    if (e.frozen > 0) e.frozen -= dt; if (e.stun > 0) e.stun -= dt; if (e.shock > 0) e.shock -= dt;
    if (e.hurt > 0) { e.hurt -= dt; if (e.hurt <= 0 && e.state === 'hurt') setState(e, 'chase'); }
    if (held) { e.want = 0; if (e.state === 'attack' && !e.def.boss) { e.attack = null; setState(e, 'hurt'); } }
    if (!held || (e.def.boss && e.frozen <= 0 && e.stun <= 0)) e.def.think(sim, e);
    if (e.def.fly) {
      if (held) { e.vx = approach(e.vx, 0, 12 * dt); e.vy = approach(e.vy, e.frozen > 0 ? -14 : 0, 20 * dt); }
      const r = moveBody(w, e, e.vx * dt, e.vy * dt); if (r.left || r.right) e.vx = 0; if (r.up || r.down) e.vy = 0;
    } else {
      const driven = !held && e.state !== 'dodge' && !(e.leapt && !e.onGround);
      if (driven && e.onGround) e.vx = approach(e.vx, e.want, 40 * dt); else if (e.onGround) e.vx = approach(e.vx, 0, 16 * dt);
      e.vy = Math.max(e.vy - PHYS.gravity * (e.launched ? COMBAT.juggleGravity : 1) * dt, -PHYS.maxFall);
      const r = moveBody(w, e, e.vx * dt, e.vy * dt);
      if ((r.left && e.vx < 0) || (r.right && e.vx > 0)) e.vx = e.launched ? -e.vx * 0.4 : 0;
      if (r.up) e.vy = Math.min(e.vy, 0);
      if (r.down) { if (!e.onGround && e.leapt) emit(sim, 'land', { speed: 20, x: e.x, y: e.y, enemy: true, heavy: !!e.def.boss }); e.vy = 0; e.onGround = true; e.ground = r.ground; e.launched = false; } else { e.onGround = false; e.ground = null; }
    }
    if (e.y < w.killY) killEnemy(sim, e, {});
  }
  if (sim.enemies.some(e => e.dead && (e.deadT > 3 || e.gone))) sim.enemies = sim.enemies.filter(e => !(e.dead && (e.deadT > 3 || e.gone)));
}
