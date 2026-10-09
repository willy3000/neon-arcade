// Character kits: attack data and abilities. `impact` is the measured moment each clip swings (tools/analyze-clips.mjs);
// the renderer plays the clip so that moment lands exactly on `hitAt`, which is when the hitbox opens.
import { emit, phaseDash, tech } from './player.js';
import { spawnProjectile, damageEnemy, damageSolid, hitProp, electrify, breakSolid } from './combat.js';
import { addSolid, zoneAt, raycast, clearLine, blocked } from './world.js';

const slice = { clip: '1H_Melee_Attack_Slice_Horizontal', impact: 0.25 }, diagonal = { clip: '1H_Melee_Attack_Slice_Diagonal', impact: 0.38 };

function throwBlades(sim, p, a, inp) {
  const tilt = inp.my * 0.28;
  for (const spread of [-0.13, 0, 0.13]) {
    const angle = tilt + spread, speed = 33;
    spawnProjectile(sim, { owner: 'player', kind: 'kinetic', look: 'blade', x: p.x + p.facing * 0.7, y: p.y + 1.15, vx: p.facing * Math.cos(angle) * speed, vy: Math.sin(angle) * speed, dmg: 9, r: 0.3, life: 0.5, pierce: 1, kb: [3, 2] });
  }
}

function bolt(dmg, big) {
  return (sim, p, a, inp) => spawnProjectile(sim, { owner: 'player', kind: 'fire', look: 'bolt', x: p.x + p.facing * 0.8, y: p.y + 1.2, vx: p.facing * 27, vy: inp.my * 6, dmg, r: big ? 0.36 : 0.26, life: 0.42, kb: big ? [7, 3] : [3, 1] });
}
function fireball(dmg, radius, speed, size) {
  return (sim, p, a, inp) => spawnProjectile(sim, { owner: 'player', kind: 'fire', look: 'fireball', x: p.x + p.facing * 0.9, y: p.y + 1.3, vx: p.facing * speed, vy: 2.5 + inp.my * 7, gravity: 6, dmg: dmg * a.power, r: size * (1 + a.charge * 0.3), life: 1.7, explode: radius * (1 + a.charge * 0.35), explodeOnExpire: true, heavy: true });
}

function conjureIce(sim, p) {
  const air = !p.onGround, w = 3.3, h = 0.42;
  let x = p.x + p.facing * (air ? 0.9 : 2.5) - w / 2, y = air ? p.y - 0.2 - h : p.y + 2.1;
  if (blocked(sim.world, { x, y, w, h })) { x = p.x - w / 2; y = p.y - 0.25 - h; }
  const mine = sim.world.solids.filter(s => s.temp && !s.dead && s.conjured);
  if (mine.length >= 2) breakSolid(sim, mine[0]);
  const s = addSolid(sim.world, { x, y, w, h, kind: 'ice', material: 'ice', oneWay: true, temp: true, ttl: 6, hp: 30, conjured: true });
  emit(sim, 'iceForm', { id: s.id, x: x + w / 2, y: y + h, w });
  for (const e of sim.enemies) if (!e.dead && Math.abs(e.x - (x + w / 2)) < 2.8 && Math.abs(e.y + e.h / 2 - (y + h)) < 2.4) damageEnemy(sim, e, { dmg: 6, kind: 'ice', kb: [0, 0], x: p.x, stop: 0.02 });
  const zone = zoneAt(sim.world, 'water', x + w / 2, y) || zoneAt(sim.world, 'water', x + w / 2, y - 1);
  if (zone) emit(sim, 'frost', { x: x + w / 2, y: zone.y + zone.h });
}

function chainLightning(sim, p) {
  const segs = [], hit = new Set(), near = (x, y, range, forward) => {
    let best = null, bestD = range;
    for (const e of sim.enemies) { if (e.dead || e.spawnT > 0 || hit.has(e)) continue; const d = Math.hypot(e.x - x, e.y + e.h * 0.6 - y); if (d < bestD && (!forward || (e.x - p.x) * p.facing > -1.5) && clearLine(sim.world, x, y, e.x, e.y + e.h * 0.6)) { best = e; bestD = d; } }
    return best;
  };
  let from = [p.x + p.facing * 0.6, p.y + 1.3], target = near(from[0], from[1], 10.5, true), dmg = 22;
  const touchProps = (x, y) => { for (const prop of sim.props) if (!prop.dead && Math.hypot(prop.x + prop.w / 2 - x, prop.y + prop.h / 2 - y) < 2.4) { hitProp(sim, prop, 'lightning', dmg); segs.push([[x, y], [prop.x + prop.w / 2, prop.y + prop.h * 0.8]]); } };
  if (!target) {
    const end = [from[0] + p.facing * 8.5, from[1] - 0.3], wall = raycast(sim.world, from[0], from[1], end[0], end[1]), to = wall ? [wall.x, wall.y] : end;
    segs.push([from, to]); touchProps(to[0], to[1]); touchProps((from[0] + to[0]) / 2, to[1]);
    if (wall) damageSolid(sim, wall.solid, 'lightning', dmg);
    for (let step = 0; step <= 4; step++) { const z = zoneAt(sim.world, 'water', from[0] + (to[0] - from[0]) * step / 4, to[1] - 1.2) || zoneAt(sim.world, 'water', from[0] + (to[0] - from[0]) * step / 4, to[1]); if (z) { electrify(sim, z, dmg); break; } }
  }
  for (let jump = 0; jump < 5 && target; jump++) {
    hit.add(target); const to = [target.x, target.y + target.h * 0.6]; segs.push([from, to]);
    damageEnemy(sim, target, { dmg, kind: 'lightning', kb: [1.5, 3], x: from[0], stop: 0.03 });
    const zone = zoneAt(sim.world, 'water', target.x, target.y + 0.2); if (zone) electrify(sim, zone, dmg * 0.7);
    touchProps(to[0], to[1]); from = to; dmg *= 0.82; target = near(from[0], from[1], 6.5, false);
  }
  if (hit.size >= 3) tech(sim, 'chain reaction');
  emit(sim, 'lightning', { segs });
}

function shockwave(sim, p, a) {
  for (const dir of [p.facing]) spawnProjectile(sim, { owner: 'player', kind: 'slam', look: 'shock', x: p.x + dir * 1.6, y: p.y + 0.45, vx: dir * 14, vy: 0, dmg: 14 * a.power, r: 0.6, life: 0.55, pierce: 4, kb: [5, 9], heavy: true });
  emit(sim, 'slam', { x: p.x + p.facing * 2, y: p.y, r: 1.8 });
  for (const prop of sim.props) if (!prop.dead && Math.abs(prop.x + prop.w / 2 - (p.x + p.facing * 2)) < 2.6 && Math.abs(prop.y - p.y) < 2) hitProp(sim, prop, 'slam', 20);
}

export const KITS = {
  vyx: {
    groundChain: ['light1', 'light2', 'light3'], airChain: ['air1', 'air2', 'air3'], heavy: 'launcher', charged: 'lunge', airHeavy: 'spin',
    attacks: {
      light1: { ...slice, rate: 1.6, hitAt: 0.09, hitLen: 0.08, dur: 0.3, cancel: 0.17, box: [1.25, 0.3, 2.3, 1.6], dmg: 9, kb: [4, 0], stop: 0.035, lunge: 5, kind: 'blade', sfx: 'swing0' },
      light2: { ...diagonal, rate: 1.7, hitAt: 0.1, hitLen: 0.08, dur: 0.32, cancel: 0.18, box: [1.25, 0.3, 2.3, 1.7], dmg: 10, kb: [4, 0], stop: 0.035, lunge: 5, kind: 'blade', sfx: 'swing1' },
      light3: { clip: 'Dualwield_Melee_Attack_Stab', impact: 0.38, rate: 1.5, hitAt: 0.13, hitLen: 0.1, dur: 0.42, cancel: 0.3, box: [1.5, 0.3, 2.8, 1.5], dmg: 15, kb: [9, 4], stop: 0.06, lunge: 8, kind: 'blade', sfx: 'swing2' },
      launcher: { clip: 'Dualwield_Melee_Attack_Chop', impact: 0.55, rate: 1.9, hitAt: 0.16, hitLen: 0.1, dur: 0.46, cancel: 0.3, box: [1.1, 0.1, 2.3, 2.6], dmg: 14, kb: [1.5, 16.5], launch: true, rise: 15, stop: 0.07, heavy: true, kind: 'heavy', sfx: 'swingHeavy' },
      lunge: { clip: '1H_Melee_Attack_Stab', impact: 0.38, rate: 1.1, hitAt: 0.05, hitLen: 0.3, dur: 0.5, cancel: 0.4, box: [0.9, 0.2, 3.2, 1.6], dmg: 20, chargeScale: 1, kb: [10, 5], stop: 0.08, lunge: 24, lungeCharge: 0.45, heavy: true, kind: 'kinetic', sfx: 'dash' },
      air1: { ...slice, air: true, rate: 1.7, hitAt: 0.08, hitLen: 0.08, dur: 0.28, cancel: 0.16, box: [1.2, 0.1, 2.4, 2], dmg: 9, kb: [3, 3.5], pop: 4.5, hover: 2.5, stop: 0.035, kind: 'blade', sfx: 'swing0' },
      air2: { ...diagonal, air: true, rate: 1.8, hitAt: 0.09, hitLen: 0.08, dur: 0.28, cancel: 0.16, box: [1.2, 0.1, 2.4, 2], dmg: 10, kb: [3, 3.5], pop: 4.5, hover: 2.5, stop: 0.035, kind: 'blade', sfx: 'swing1' },
      air3: { clip: 'Dualwield_Melee_Attack_Slice', impact: 0.55, air: true, rate: 2, hitAt: 0.12, hitLen: 0.12, dur: 0.4, cancel: 0.28, box: [1.2, -0.1, 2.6, 2.3], dmg: 14, kb: [6, 9], pop: 6.5, hover: 2.5, stop: 0.06, kind: 'blade', sfx: 'swing2' },
      spin: { clip: '2H_Melee_Attack_Spinning', impact: 0.05, loop: true, air: true, rate: 1.6, hitAt: 0.05, hitLen: 0.42, hits: 3, dur: 0.52, cancel: 0.44, box: [0, -0.3, 3.6, 2.5], dmg: 7, kb: [1, 4.5], pop: 3.5, hover: 3.5, stop: 0.03, kind: 'blade', sfx: 'swing1' },
      blades: { ...slice, air: true, rate: 1.8, hitAt: 0.08, dur: 0.26, cancel: 0.16, hover: 2, moveScale: 0.7, fire: throwBlades, sfx: 'blade' },
    },
    abilities: {
      ability1: { id: 'blades', name: 'Kinetic Blades', cooldown: 2.8, use: (sim, p) => { p.action = null; sim.hooks.begin(sim, 'blades'); } },
      ability2: { id: 'phase', name: 'Phase Dash', cooldown: 5, use: (sim, p, inp) => { if (!p.onGround) p.airDashes++; phaseDash(sim, inp, { phase: true, speed: 36, time: 0.2, dmg: 20 }); p.iframes = Math.max(p.iframes, 0.36); } },
    },
  },
  sera: {
    groundChain: ['bolt1', 'bolt2', 'bolt3'], airChain: ['bolt1', 'bolt2', 'bolt3'], heavy: 'fireball', charged: 'meteor', airHeavy: 'fireball', slamElement: 'fire',
    attacks: {
      bolt1: { clip: 'Spellcast_Shoot', impact: 0.08, air: true, rate: 1.15, hitAt: 0.07, dur: 0.26, cancel: 0.15, moveScale: 0.65, hover: 3, fire: bolt(8), sfx: 'fire' },
      bolt2: { clip: 'Spellcast_Shoot', impact: 0.08, air: true, rate: 1.15, hitAt: 0.07, dur: 0.26, cancel: 0.15, moveScale: 0.65, hover: 3, fire: bolt(8), sfx: 'fire' },
      bolt3: { clip: '2H_Melee_Attack_Stab', impact: 0.38, air: true, rate: 1.8, hitAt: 0.12, dur: 0.4, cancel: 0.28, moveScale: 0.5, hover: 3, fire: bolt(15, true), sfx: 'fireball' },
      fireball: { clip: '2H_Melee_Attack_Slice', impact: 0.38, air: true, rate: 1.5, hitAt: 0.16, dur: 0.5, cancel: 0.38, moveScale: 0.35, hover: 2, fire: fireball(24, 2.4, 17, 0.42), sfx: 'fireball', heavy: true },
      meteor: { clip: '2H_Melee_Attack_Chop', impact: 0.82, air: true, rate: 2.2, hitAt: 0.2, dur: 0.6, cancel: 0.46, moveScale: 0.2, hover: 1.5, chargeScale: 0.7, fire: fireball(32, 3.1, 15, 0.58), sfx: 'fireball', heavy: true },
      iceCast: { clip: 'Spellcast_Raise', impact: 0.27, air: true, rate: 1.7, hitAt: 0.1, dur: 0.34, cancel: 0.2, moveScale: 0.5, hover: 0.5, fire: conjureIce, sfx: 'ice0' },
      stormCast: { clip: 'Spellcast_Shoot', impact: 0.08, air: true, rate: 1, hitAt: 0.08, dur: 0.36, cancel: 0.24, moveScale: 0.4, hover: 1.5, fire: chainLightning, sfx: 'zap0' },
    },
    abilities: {
      ability1: { id: 'ice', name: 'Ice Platform', cooldown: 2.2, use: (sim, p) => { p.action = null; sim.hooks.begin(sim, 'iceCast'); } },
      ability2: { id: 'lightning', name: 'Chain Lightning', cooldown: 4, use: (sim, p) => { p.action = null; sim.hooks.begin(sim, 'stormCast'); } },
    },
  },
  bragg: {
    groundChain: ['cleave', 'chop'], airChain: ['airCleave'], heavy: 'splitter', charged: 'cyclone', airHeavy: 'dive',
    attacks: {
      cleave: { clip: '2H_Melee_Attack_Slice', impact: 0.38, rate: 1.25, hitAt: 0.2, hitLen: 0.1, dur: 0.52, cancel: 0.36, box: [1.4, 0.2, 3, 1.9], dmg: 18, kb: [8, 3], stop: 0.06, lunge: 3, heavy: true, kind: 'heavy', sfx: 'swingHeavy' },
      chop: { clip: '2H_Melee_Attack_Chop', impact: 0.82, rate: 1.8, hitAt: 0.24, hitLen: 0.1, dur: 0.6, cancel: 0.44, box: [1.3, 0, 2.6, 2.9], dmg: 24, kb: [5, 8], stop: 0.08, lunge: 2, heavy: true, kind: 'heavy', sfx: 'swingHeavy' },
      splitter: { clip: '2H_Melee_Attack_Chop', impact: 0.82, rate: 1.5, hitAt: 0.32, hitLen: 0.1, dur: 0.75, cancel: 0.55, box: [1.5, 0, 3.2, 2.9], dmg: 30, kb: [6, 12], launch: true, guardBreak: true, stop: 0.1, heavy: true, kind: 'slam', fire: shockwave, sfx: 'slam' },
      cyclone: { clip: '2H_Melee_Attack_Spin', impact: 0.62, rate: 1.3, hitAt: 0.15, hitLen: 0.55, hits: 4, dur: 0.85, cancel: 0.7, box: [0, 0, 5.2, 2.2], dmg: 12, chargeScale: 0.7, kb: [1.5, 4.5], moveScale: 0.85, guardBreak: true, stop: 0.04, heavy: true, kind: 'heavy', sfx: 'swingHeavy' },
      airCleave: { clip: '2H_Melee_Attack_Slice', impact: 0.38, air: true, rate: 1.4, hitAt: 0.16, hitLen: 0.1, dur: 0.44, cancel: 0.32, box: [1.3, -0.2, 3, 2.3], dmg: 18, kb: [7, 5], pop: 3, hover: 5, stop: 0.06, heavy: true, kind: 'heavy', sfx: 'swingHeavy' },
    },
    abilities: {
      ability1: { id: 'shield', name: 'Bulwark', cooldown: 0.4, hold: true },
      ability2: {
        id: 'leap', name: 'Seismic Leap', cooldown: 4.5, use: (sim, p, inp) => {
          if (!p.onGround) return false;
          emit(sim, 'slam', { x: p.x, y: p.y, r: 2.8 });
          for (const e of sim.enemies) if (!e.dead && Math.abs(e.x - p.x) < 2.8 + e.hw && Math.abs(e.y - p.y) < 1.8) damageEnemy(sim, e, { dmg: 10, kind: 'slam', kb: [7, 8], launch: true, heavy: true, guardBreak: true, x: p.x });
          for (const prop of sim.props) if (!prop.dead && Math.abs(prop.x + prop.w / 2 - p.x) < 3.2 && Math.abs(prop.y - p.y) < 2.2) hitProp(sim, prop, 'slam', 20);
          p.action = null; p.vy = 25.5; p.vx = inp.mx * 8; p.onGround = false; p.ground = null; p.jumping = false; p.leaping = true;
        },
      },
    },
  },
};
