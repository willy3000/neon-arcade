// The computer opponent. It sees the fight through a delay (its reaction time), never sees the other player's buttons, and
// decides what to do with dice weighted by a behaviour profile. It produces the same kind of input a controller does.
import { NEUTRAL, RULES, rng } from './engine/constants.js';

// Per difficulty: reaction delay in frames, and how reliably it blocks, guesses high/low, punishes and anti-airs.
const LEVELS = [
  { react: 22, block: 0.22, read: 0.4, punish: 0.2, antiAir: 0.12, combo: 1, pace: 0.5 },
  { react: 15, block: 0.48, read: 0.6, punish: 0.5, antiAir: 0.4, combo: 2, pace: 0.75 },
  { react: 11, block: 0.7, read: 0.8, punish: 0.78, antiAir: 0.66, combo: 3, pace: 1 },
  { react: 8, block: 0.86, read: 0.92, punish: 0.94, antiAir: 0.86, combo: 3, pace: 1.2 },
];
const PROFILES = {
  aggressive: { approach: 0.85, zone: 0.25, throwRate: 0.22, mix: 0.4, retreat: 0.05 },
  defensive: { approach: 0.35, zone: 0.4, throwRate: 0.3, mix: 0.25, retreat: 0.25 },
  ranged: { approach: 0.2, zone: 0.9, throwRate: 0.1, mix: 0.2, retreat: 0.45 },
  balanced: { approach: 0.55, zone: 0.5, throwRate: 0.18, mix: 0.32, retreat: 0.15 },
  boss: { approach: 0.7, zone: 0.6, throwRate: 0.15, mix: 0.4, retreat: 0.05 },
};
const BUTTON = id => (id === 'throw' ? 'T' : id === 'super' ? 'S' : id.slice(-1));
const DIR = id => (id.startsWith('2') ? 'down' : id.startsWith('6') ? 'fwd' : id.startsWith('4') ? 'back' : null);

export function createAI(level, def, seed = 1) {
  const L = LEVELS[Math.max(0, Math.min(3, level))], P = PROFILES[def.ai?.profile] || PROFILES.balanced, hints = def.ai || {}, rand = rng(seed * 7919 + level);
  const history = []; let plan = [], cool = 0, blocking = 0, blockLow = false;
  const chance = p => rand() < p, pick = list => list[Math.floor(rand() * list.length)];
  // One button press of a move, with its direction held, followed by a short wait.
  const press = (id, wait = 3, extra = {}) => { const d = DIR(id), step = { [BUTTON(id)]: true, ...extra }; if (d) step[d] = true; if (id === 'super') step.H = true; return [{ inp: step, frames: 2 }, { inp: d ? { [d]: true } : {}, frames: wait }]; };
  const hold = (inp, frames) => [{ inp, frames }];
  function combo(me) {
    const m = me.def.moves, steps = [...press('5L', 6)]; if (L.combo >= 2) steps.push(...press('5M', 9)); if (L.combo >= 3) steps.push(...press('5H', 12));
    if (L.combo >= 2 && me.meter >= RULES.superCost && chance(0.6)) steps.push(...press('super', 30)); else if (L.combo >= 2) steps.push(...press(hints.gapCloser && m[hints.gapCloser]?.box ? hints.gapCloser : hints.reversal && m[hints.reversal]?.box ? hints.reversal : '5S', 20));
    return steps;
  }
  function decide(fight, me, foe, seen) {
    const dist = Math.abs(foe.x - me.x), m = me.def.moves;
    // punish something that missed or was blocked
    if (seen.recovering && dist < 190 && chance(L.punish)) return combo(me);
    if (seen.airborne && dist < 200 && seen.vy < 4 && hints.antiAir && chance(L.antiAir)) return press(hints.antiAir, 16);
    if (seen.down) return dist > 150 ? hold({ fwd: true }, 14) : chance(P.throwRate * 1.5) ? [...hold({}, 18), ...press('throw', 10)] : [...hold({}, 14), ...press(pick(hints.mixup || ['5M']), 12)];
    if (dist > 330) {
      if (hints.projectile && chance(P.zone * L.pace * 0.7) && !fight.projectiles.some(p => p.owner === me.side)) return press(hints.projectile, 26);
      if (hints.trap && dist < 420 && chance(P.zone * 0.25)) return press(hints.trap, 30);
      if (chance(P.approach)) return chance(0.35) ? hold({ D: true, fwd: true }, 3).concat(hold({}, 12)) : chance(0.2) ? hold({ up: true, fwd: true }, 4).concat(hold({ fwd: true }, 30)) : hold({ fwd: true }, 16 + Math.floor(rand() * 16));
      return hold({}, 10 + Math.floor(rand() * 14));
    }
    if (dist > 165) { // mid range: pokes, a gap closer, or keep spacing
      if (hints.gapCloser && chance(0.12 * L.pace * P.approach)) return press(hints.gapCloser, 26);
      if (hints.projectile && chance(P.zone * 0.3 * L.pace) && !fight.projectiles.some(p => p.owner === me.side)) return press(hints.projectile, 24);
      if (chance(P.retreat)) return chance(0.4) ? hold({ D: true, back: true }, 3).concat(hold({}, 14)) : hold({ back: true }, 12);
      if (chance(0.3 * L.pace)) { const poke = pick(hints.pokes || ['5M']), reach = m[poke]?.box ? m[poke].box[0] + m[poke].box[2] : 120; return dist < reach + 26 ? press(poke, 14) : hold({ fwd: true }, 8); }
      return chance(P.approach) ? hold({ fwd: true }, 10 + Math.floor(rand() * 10)) : hold({}, 8 + Math.floor(rand() * 10));
    }
    // close range: strings, mix-ups, throws, or back off
    if (seen.blockingLong && chance(P.throwRate * 2)) return press(hints.grab && chance(0.5) ? hints.grab : 'throw', 14);
    if (chance(P.mix * L.pace * 0.5)) return press(pick(hints.mixup || ['6H', '2L', 'throw']), 16);
    if (chance(0.55 * L.pace)) return combo(me);
    if (chance(P.retreat + 0.1)) return hold({ D: true, back: true }, 3).concat(hold({}, 12));
    if (hints.counter && chance(0.06 * L.pace)) return press(hints.counter, 30);
    return hold({ B: chance(0.5) }, 10 + Math.floor(rand() * 10));
  }
  return function think(fight, side) {
    const me = fight.fighters[side], foe = fight.fighters[1 - side], fm = foe.state === 'attack' ? foe.move : null;
    history.push({ attacking: !!fm && foe.mf < fm.startup + fm.active && fm.level !== 'throw', level: fm?.level, reach: fm?.box ? fm.box[0] + fm.box[2] + 50 : 150, recovering: (!!fm && foe.mf >= fm.startup + fm.active) || foe.state === 'land' || foe.state === 'stagger', airborne: foe.y > 30, vy: foe.vy, down: foe.state === 'knockdown' || foe.state === 'getup', blockingLong: foe.state === 'block' && foe.t > 30, throwing: !!fm && fm.level === 'throw',
      shot: fight.projectiles.find(p => p.owner !== side && Math.sign(me.x - p.x) === Math.sign(p.vx) && Math.abs(me.x - p.x) < 300) ? fight.projectiles.find(p => p.owner !== side).def.level : null });
    if (history.length > 40) history.shift();
    const seen = history[Math.max(0, history.length - 1 - L.react)], dist = Math.abs(foe.x - me.x), out = { ...NEUTRAL }, free = ['idle', 'walk', 'crouch', 'block'].includes(me.state);
    const apply = inp => { for (const [k, v] of Object.entries(inp)) { if (k === 'fwd') out[me.facing > 0 ? 'right' : 'left'] = v; else if (k === 'back') out[me.facing > 0 ? 'left' : 'right'] = v; else out[k] = v; } };
    if (cool > 0) cool--;
    // defence comes first, and only while free to act
    if (free && (blocking > 0 || (seen.attacking && dist < seen.reach) || seen.shot)) {
      if (blocking <= 0) { if (seen.throwing) { plan = []; } else if (chance(L.block)) { blocking = 14 + Math.floor(rand() * 8); const low = (seen.shot || seen.level) === 'low', overhead = (seen.shot || seen.level) === 'overhead'; blockLow = chance(L.read) ? low : !overhead && chance(0.5); plan = []; } else blocking = -12; }
      if (blocking > 0) { blocking--; apply({ B: true, down: blockLow }); return out; }
    }
    if (blocking < 0) blocking++;
    if (me.state === 'thrown' && me.t < RULES.throwTech - 2 && chance(L.read * 0.25)) out.T = true; // sometimes breaks a throw
    if (!plan.length && free && cool <= 0) { plan = decide(fight, me, foe, seen); cool = Math.round((6 + rand() * 12) / L.pace); }
    if (plan.length) { const step = plan[0]; apply(step.inp); if (--step.frames <= 0) plan.shift(); }
    return out;
  };
}
