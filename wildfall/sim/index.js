// The simulation: a deterministic fixed-step world with no rendering or browser dependencies, so it runs the same in tests.
import { DT, PHYS, DIFFICULTY } from '../config.js';
import { createWorld, stepMovers, rng, boxOverlap, bodyBox, groundBelow, zoneAt } from './world.js';
import { createPlayer, stepPlayer, emit } from './player.js';
import { stepActions, stepProjectiles, stepProps, damageEnemy, damageSolid, damagePlayer, begin, activate } from './combat.js';
import { stepEnemies, spawnEnemy } from './enemies.js';
import { KITS } from './characters.js';

export const NEUTRAL = Object.freeze({ mx: 0, my: 0, jump: false, jumpHeld: false, dash: false, slide: false, attack: false, heavy: false, heavyHeld: false, grapple: false, grappleHeld: false, ability1: false, ability1Held: false, ability2: false, ability2Held: false, interact: false });
const EDGES = ['jump', 'dash', 'slide', 'attack', 'heavy', 'grapple', 'ability1', 'ability2', 'interact'];
const PROP_SIZE = { barrel: [0.95, 1.15], pylon: [1, 2.6], crate: [1.1, 1.1] };

export function createSim(level, charId, opts = {}) {
  const world = createWorld(level), cp = (level.checkpoints || []).find(c => c.id === opts.checkpoint), start = cp || level.spawn;
  const sim = {
    level, world, dt: DT, time: 0, events: [], enemies: [], projectiles: [], props: [], pickups: [], charId, kit: KITS[charId], player: createPlayer(charId, start.x, start.y),
    gear: { ...level.gear, ...opts.gear }, flags: { ...opts.flags }, cleared: new Set(opts.cleared), collected: new Set(opts.collected), checkpoint: cp ? cp.id : null,
    stats: { kills: 0, damage: 0, tech: 0, hurt: 0, motes: 0, time: 0, ...opts.stats }, combo: { count: 0, t: 0, best: 0 }, hitstop: 0, slowmo: 0, rand: rng(opts.seed ?? 20261009),
    difficulty: DIFFICULTY[opts.difficulty] ? opts.difficulty : 'standard', hooks: { damageEnemy, damageSolid, begin }, nextId: 1, ended: false, cinematic: false, pending: {}, near: null, arenaBounds: null,
  };
  for (const def of level.props || []) { const [w, h] = PROP_SIZE[def.type] || [1, 1]; sim.props.push({ w, h, fuse: -1, hp: 18, active: false, accepts: [], ...def, x: def.x - (def.w ?? w) / 2 }); }
  for (const def of level.pickups || []) sim.pickups.push({ ...def, t: 0, taken: sim.collected.has(def.id) });
  for (const def of level.enemies || []) if (!cp || def.x > cp.x - 3) spawnEnemy(sim, def.type, def.x, def.y, def);
  sim.checkpoints = (level.checkpoints || []).map(c => ({ ...c }));
  sim.triggers = (level.triggers || []).map(t => ({ ...t, done: false, inside: false }));
  sim.tablets = (level.tablets || []).map(t => ({ ...t, read: sim.collected.has(t.id) }));
  sim.arenas = (level.arenas || []).map(def => ({ def, state: sim.cleared.has(def.id) ? 'cleared' : 'idle', wave: -1, timer: 0 }));
  for (const prop of sim.props) if (prop.flag && sim.flags[prop.flag]) { activate(sim, prop); }
  level.init?.(sim);
  sim.events.length = 0;
  return sim;
}

export function snapshot(sim) {
  return { checkpoint: sim.checkpoint, cleared: [...sim.cleared], collected: [...sim.collected], gear: { ...sim.gear }, flags: { ...sim.flags }, stats: { ...sim.stats } };
}

const gates = (sim, ids, open) => { for (const s of sim.world.solids) if (ids.includes(s.id)) s.open = open; };

function stepRules(sim, inp) {
  const p = sim.player, dt = sim.dt, w = sim.world, body = bodyBox(p);
  // Falling out of the world costs a little health and returns the character to the last safe ground.
  if (p.y < w.killY && !p.dead) {
    if (!zoneAt(w, 'mercy', p.safeX, p.safeY + 0.5)) p.hp -= PHYS.pitDamage * Math.min(1, DIFFICULTY[sim.difficulty].enemyDamage);
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deadT = 0; emit(sim, 'death', { pit: true }); }
    else { p.x = p.safeX; p.y = p.safeY; p.vx = 0; p.vy = 0; p.mode = 'normal'; p.rope = null; p.action = null; p.h = p.char.h; p.iframes = 1.3; p.flow = 0; emit(sim, 'pit', { x: p.x, y: p.y }); }
  }
  if (p.dead) { p.deadT += dt; return; }
  for (const z of w.zones) {
    if (z.off || !boxOverlap(body, z)) continue;
    if (z.type === 'hazard') damagePlayer(sim, { dmg: z.dmg || 14, x: p.x - p.facing, kb: [6, 13], unblockable: true });
    else if (z.type === 'wind') { p.vx += (z.fx || 0) * dt; p.vy += (z.fy || 0) * dt; }
  }

  for (const pk of sim.pickups) {
    if (pk.taken || (pk.when && !sim.flags[pk.when])) continue; pk.t += dt;
    if (pk.loose) {
      pk.vy -= 32 * dt; pk.x += pk.vx * dt; pk.y += pk.vy * dt; pk.vx *= 1 - 2 * dt;
      const g = groundBelow(w, pk.x, pk.y + 0.4, 0.9); if (g && pk.vy < 0) { pk.y = g.y + g.h + 0.35; pk.vy = 0; }
      const dx = p.x - pk.x, dy = p.y + 1 - pk.y, d = Math.hypot(dx, dy);
      if (pk.t > 0.4 && d < 5) { pk.x += (dx / d) * 16 * dt; pk.y += (dy / d) * 16 * dt; pk.vy = 0; }
      if (pk.t > 12 || pk.y < w.killY) pk.taken = true;
    }
    if (Math.abs(p.x - pk.x) < p.hw + 0.55 && pk.y > p.y - 0.4 && pk.y < p.y + p.h + 0.4 && (!pk.loose || pk.t > 0.3)) {
      pk.taken = true;
      if (pk.kind === 'mote') sim.stats.motes++;
      else if (pk.kind === 'heal') p.hp = Math.min(p.maxHp, p.hp + 14);
      else if (pk.kind === 'heart') p.hp = p.maxHp;
      else if (pk.kind === 'gear') sim.gear[pk.gear] = true;
      if (pk.id) sim.collected.add(pk.id);
      emit(sim, 'pickup', { kind: pk.kind, id: pk.id, gear: pk.gear, x: pk.x, y: pk.y });
    }
  }
  if (sim.pickups.length > 60) sim.pickups = sim.pickups.filter(pk => !pk.taken || pk.id);

  for (const c of sim.checkpoints) if (sim.checkpoint !== c.id && Math.abs(p.x - c.x) < 1.6 && Math.abs(p.y - c.y) < 2.5 && p.onGround) { sim.checkpoint = c.id; p.hp = p.maxHp; emit(sim, 'checkpoint', { id: c.id, x: c.x, y: c.y, name: c.name }); }

  for (const t of sim.triggers) {
    const inside = boxOverlap(body, t) && (!t.when || sim.flags[t.when]) && (!t.unless || !sim.flags[t.unless]) && (!t.needs || sim.gear[t.needs]);
    if (inside && !t.inside && !t.done) {
      if (t.once !== false) t.done = true;
      if (t.type === 'complete') { sim.ended = true; emit(sim, 'complete', {}); }
      else if (t.type === 'flag') sim.flags[t.flag] = true;
      else emit(sim, t.type, { ...t });
    }
    if (!inside && t.inside && t.type === 'hint') emit(sim, 'hintEnd', { key: t.key });
    t.inside = inside;
  }

  sim.near = null;
  for (const t of sim.tablets) if (Math.abs(p.x - t.x) < 1.7 && Math.abs(p.y - t.y) < 2.2) { sim.near = t; if (inp.interact) { t.read = true; sim.collected.add(t.id); emit(sim, 'tablet', { id: t.id, title: t.title, text: t.text }); } }

  for (const ar of sim.arenas) {
    const d = ar.def;
    if (ar.state === 'idle' && boxOverlap(body, d.trigger)) {
      ar.state = 'active'; ar.wave = -1; ar.timer = 0.7; gates(sim, d.gates, false); sim.arenaBounds = d.bounds;
      for (const e of sim.enemies) if (e.group === d.id) e.alert = true;
      emit(sim, 'arenaStart', { id: d.id, boss: !!d.boss, name: d.name });
    } else if (ar.state === 'active' && !sim.enemies.some(e => !e.dead && (e.group === d.id || e.group === d.id + '-adds'))) {
      ar.timer -= dt;
      if (ar.timer <= 0) {
        ar.wave++;
        if (ar.wave >= d.waves.length) { ar.state = 'cleared'; sim.cleared.add(d.id); gates(sim, d.gates, true); sim.arenaBounds = null; emit(sim, 'arenaClear', { id: d.id, boss: !!d.boss }); }
        else { for (const s of d.waves[ar.wave]) spawnEnemy(sim, s.type, s.x, s.y, { spawn: true, alert: true, group: d.id }); ar.timer = 0.9; emit(sim, 'wave', { id: d.id, wave: ar.wave + 1, of: d.waves.length }); }
      }
    }
  }
}

// Advances the world by one fixed tick. `inp` uses the NEUTRAL shape; edge fields are true only on the tick they were pressed.
export function step(sim, inp) {
  if (EDGES.some(k => sim.pending[k])) { inp = { ...inp }; for (const k of EDGES) if (sim.pending[k]) inp[k] = true; }
  if (sim.hitstop > 0) { sim.hitstop -= sim.dt; for (const k of EDGES) if (inp[k]) sim.pending[k] = true; return; } // presses during a freeze are kept, not lost
  sim.pending = {};
  if (sim.cinematic || sim.ended) inp = NEUTRAL;
  const from = sim.events.length;
  sim.time += sim.dt; if (!sim.ended) sim.stats.time += sim.dt;
  stepMovers(sim.world, [sim.player, ...sim.enemies], sim.dt);
  for (const a of sim.world.anchors) if (a.solid) { const s = sim.world.solids.find(s => s.id === a.solid); if (s) { a.x = s.x + a.ox; a.y = s.y + a.oy; a.off = !!s.dead; } }
  stepPlayer(sim, inp); stepActions(sim, inp); stepEnemies(sim); stepProjectiles(sim); stepProps(sim); stepRules(sim, inp);
  if (sim.level.onEvent) for (let i = from; i < sim.events.length; i++) sim.level.onEvent(sim, sim.events[i]);
}

export { spawnEnemy, emit };
