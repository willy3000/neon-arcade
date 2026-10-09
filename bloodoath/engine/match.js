// A match: rounds, the clock, knockouts, time-outs and who has won. It drives the combat engine one frame at a time.
import { RULES, NEUTRAL } from './constants.js';
import { createFight, stepFight } from './fight.js';

export function createMatch(defA, defB, opts = {}) {
  const match = { defs: [defA, defB], opts: { roundsToWin: 2, time: 99, ...opts }, round: 0, wins: [0, 0], phase: 'intro', t: 0, timer: 0, fight: null, events: [], result: null, meter: [0, 0], frame: 0, stats: [{ damage: 0, maxCombo: 0, perfect: 0 }, { damage: 0, maxCombo: 0, perfect: 0 }] };
  startRound(match); return match;
}

export function startRound(match) {
  const o = match.opts; match.round++; match.phase = o.training ? 'fight' : 'intro'; match.t = 0; match.timer = o.time > 0 && !o.training ? o.time * 60 : Infinity;
  match.fight = createFight(match.defs[0], match.defs[1], { ...o, seed: (o.seed ?? 11) + match.round * 101 });
  match.fight.fighters.forEach((f, i) => { f.meter = o.training ? RULES.meterMax : match.meter[i]; f.state = o.training ? 'idle' : 'intro'; if (o.handicap?.[i]) f.hp = Math.round(f.def.health * o.handicap[i]); });
  match.events.push({ type: 'roundStart', round: match.round });
}

// Training: put both fighters back where they started with full health.
export function resetPositions(match, spot = 'middle') {
  const [a, b] = match.fight.fighters, base = spot === 'left' ? -430 : spot === 'right' ? 430 : 0;
  match.fight.projectiles = []; match.fight.objects = []; match.fight.cine = null; match.fight.hitstop = 0; match.fight.superFreeze = 0;
  for (const [f, x] of [[a, base - 150], [b, base + 150]]) { Object.assign(f, { x, y: 0, vx: 0, vy: 0, push: 0, state: 'idle', t: 0, move: null, hp: f.def.health, stun: 0, grabbed: false, grab: null, inv: 0, ko: false, heat: 0, combo: { hits: 0, damage: 0, juggle: 0, froze: false, ground: false, wall: false }, status: { burn: 0, bleed: 0, bleedT: 0, chill: 0, freezeProof: 0 } }); }
  a.facing = 1; b.facing = -1;
}

function finishRound(match, winner) {
  const o = match.opts, f = match.fight.fighters;
  match.meter = f.map(x => x.meter);
  if (winner === -1) { match.wins[0]++; match.wins[1]++; } else match.wins[winner]++;
  // If a draw would hand both players the match, neither gets the point and a deciding round is played.
  if (match.wins[0] >= o.roundsToWin && match.wins[1] >= o.roundsToWin) { match.wins[0]--; match.wins[1]--; }
  match.roundWinner = winner; match.phase = 'outro'; match.t = 0;
  if (winner >= 0) { const w = f[winner]; if (w.state !== 'ko' && w.y <= 0) { w.state = 'win'; w.t = 0; w.move = null; w.vx = 0; } }
  match.events.push({ type: 'roundEnd', winner, wins: [...match.wins], perfect: winner >= 0 && f[winner].hp >= f[winner].def.health, timeout: match.timer <= 0 });
}

export function stepMatch(match, inputs) {
  const o = match.opts, fight = match.fight; match.frame++; match.t++;
  const from = fight.events.length;
  if (match.phase === 'intro') {
    stepFight(fight, [NEUTRAL, NEUTRAL]);
    if (match.t === 20) match.events.push({ type: 'announce', text: match.wins[0] === o.roundsToWin - 1 && match.wins[1] === o.roundsToWin - 1 ? 'FINAL ROUND' : 'ROUND ' + match.round, voice: 'round' });
    if (match.t === RULES.roundIntro - 24) match.events.push({ type: 'announce', text: 'FIGHT', voice: 'fight' });
    if (match.t >= RULES.roundIntro) { match.phase = 'fight'; match.t = 0; for (const f of fight.fighters) { f.state = 'idle'; f.t = 0; } }
  } else if (match.phase === 'fight') {
    stepFight(fight, inputs);
    if (!fight.superFreeze && !fight.cine && !fight.hitstop && match.timer !== Infinity) match.timer--;
    if (fight.over) { match.phase = 'ko'; match.t = 0; match.events.push({ type: 'announce', text: fight.over.winner === -1 ? 'DOUBLE K.O.' : 'K.O.', voice: 'ko' }); }
    else if (match.timer <= 0) { const [a, b] = fight.fighters, ra = a.hp / a.def.health, rb = b.hp / b.def.health; fight.over = { winner: ra === rb ? -1 : ra > rb ? 0 : 1, frame: fight.frame, timeout: true }; match.events.push({ type: 'announce', text: 'TIME', voice: 'time' }); finishRound(match, fight.over.winner); }
  } else if (match.phase === 'ko') {
    if (match.t % 2 === 0 || match.t > 50) stepFight(fight, [NEUTRAL, NEUTRAL]); // the knockout plays out in slow motion
    if (match.t >= RULES.koFreeze && fight.fighters.every(f => f.y <= 0 || f.state === 'ko')) finishRound(match, fight.over.winner);
  } else if (match.phase === 'outro') {
    stepFight(fight, [NEUTRAL, NEUTRAL]);
    if (match.t >= RULES.roundOutro) {
      const w = match.wins.findIndex(n => n >= o.roundsToWin);
      if (w >= 0) { match.phase = 'done'; match.result = { winner: w, wins: [...match.wins], rounds: match.round, stats: match.stats }; match.events.push({ type: 'matchEnd', winner: w }); } else startRound(match);
    }
  }
  for (let i = from; i < fight.events.length; i++) { const e = fight.events[i]; if (e.type === 'hit' && !e.cine) match.stats[e.side].damage += e.damage; if (e.type === 'comboEnd') match.stats[1 - e.side].maxCombo = Math.max(match.stats[1 - e.side].maxCombo, e.hits); if (e.type === 'block' && e.perfect) match.stats[e.side].perfect++; }
  if (match.fight === fight) { match.events.push(...fight.events.splice(0)); }
}
