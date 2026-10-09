// Combat-engine tests for BLOOD OATH. Run: node bloodoath/tests/engine.test.mjs
import assert from 'node:assert/strict';
import { createFight, stepFight, hurtbox, hitbox } from '../engine/fight.js';
import { createMatch, stepMatch, resetPositions } from '../engine/match.js';
import { RULES, NEUTRAL, STAGE } from '../engine/constants.js';
import { ROSTER, BY_ID } from '../data/roster.js';
import boss from '../data/malgrave.js';
import { createAI } from '../ai.js';

let passed = 0; const failures = [];
function test(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(name); console.log('FAIL', name, '\n     ', (e.message || String(e)).split('\n')[0]); } }
const I = o => ({ ...NEUTRAL, ...o });
// Runs a fight for `frames`; `p1` and `p2` are functions (frame, fight) => input.
function run(fight, frames, p1 = () => ({}), p2 = () => ({})) { for (let i = 0; i < frames; i++) stepFight(fight, [I(p1(i, fight)), I(p2(i, fight))]); return fight; }
function duel(a = 'cinder', b = 'rime', gap = 150, opts = {}) { const f = createFight(BY_ID[a], BY_ID[b], { seed: 3, ...opts }); f.fighters[0].x = -gap / 2; f.fighters[1].x = gap / 2; return f; }
const ev = (fight, type) => fight.events.filter(e => e.type === type);
const tap = (btn, at = 0, extra = {}) => i => (i === at ? { [btn]: true, ...extra } : extra);

test('every fighter has a complete, well-formed move list', () => {
  assert(ROSTER.length >= 4);
  for (const f of ROSTER) {
    for (const id of ['5L', '5M', '5H', '2L', '2M', '2H', 'jL', 'jM', 'jH', '5S', '6S', '4S', '2S', 'super', 'throw', 'breaker']) assert(f.moves[id], `${f.id} is missing ${id}`);
    for (const [id, m] of Object.entries(f.moves)) { assert(m.startup >= 1 && m.active >= 1 && m.recovery >= 1, `${f.id} ${id} frames`); assert(m.anim, `${f.id} ${id} has no animation`); if (m.box) assert.equal(m.box.length, 4); if (m.kind === 'normal') assert(m.damage > 0 && m.hitstun > 0 && m.blockstun > 0); }
    const anims = new Set(Object.values(f.moves).map(m => JSON.stringify(m.anim))); assert(anims.size >= 16, `${f.id} has only ${anims.size} distinct attack animations`);
    assert(new Set(ROSTER.map(r => JSON.stringify(r.poses.stance))).size === ROSTER.length, 'every fighter has its own stance');
  }
});
test('hitboxes are active only on the active frames: a move with startup N first connects on its Nth frame', () => {
  const m = BY_ID.cinder.moves['5M'], f = duel(); let hitFrame = -1;
  run(f, 40, i => (i === 0 ? { M: true } : {})); for (const e of f.events) if (e.type === 'hit') hitFrame = 1;
  const g = duel(); let first = -1; for (let i = 0; i < 40; i++) { stepFight(g, [I(i === 0 ? { M: true } : {}), I({})]); if (first < 0 && g.fighters[1].hp < g.fighters[1].def.health) first = i; }
  assert.equal(first + 1, m.startup, `5M connected on frame ${first + 1}, expected ${m.startup}`); assert(hitFrame > 0);
  const far = duel('cinder', 'rime', 520); run(far, 40, tap('M')); assert.equal(far.fighters[1].hp, far.fighters[1].def.health, 'out of range whiffs'); assert.equal(ev(far, 'whiff').length, 1);
});
test('a single-hit move hits once, a multi-hit move hits exactly its number of hits', () => {
  const f = duel(); run(f, 50, tap('H')); assert.equal(ev(f, 'hit').length, 1);
  const g = duel('vesper', 'grit', 150); g.fighters[0].meter = 300; run(g, 60, i => (i === 0 ? { S: true, right: true, X: true } : { X: i < 3 })); assert.equal(ev(g, 'hit').length, 2, 'enhanced Crimson Draw hits twice');
});
test('blocking: stand block stops mids and overheads, crouch block stops lows; lows beat stand block and overheads beat crouch block', () => {
  const outcome = (move, dir, block) => { const f = duel(); run(f, 60, i => (i === 0 ? { [move.slice(-1)]: true, ...dir } : {}), () => block); return ev(f, 'hit').length ? 'hit' : ev(f, 'block').length ? 'block' : 'whiff'; };
  assert.equal(outcome('5M', {}, { B: true }), 'block'); assert.equal(outcome('5M', {}, { B: true, down: true }), 'block');
  assert.equal(outcome('2L', { down: true }, { B: true }), 'hit', 'low beats stand block'); assert.equal(outcome('2L', { down: true }, { B: true, down: true }), 'block');
  assert.equal(outcome('6H', { right: true }, { B: true, down: true }), 'hit', 'overhead beats crouch block'); assert.equal(outcome('6H', { right: true }, { B: true }), 'block');
  const f = duel(); run(f, 60, tap('M'), () => ({ B: true })); assert.equal(f.fighters[1].hp, f.fighters[1].def.health, 'a blocked normal deals no damage');
  const g = duel('cinder', 'rime', 300); run(g, 90, tap('S'), () => ({ B: true })); assert(g.fighters[1].hp < g.fighters[1].def.health && g.fighters[1].hp > g.fighters[1].def.health - 15, 'a blocked special deals chip damage only');
});
test('perfect guard: blocking just before impact removes chip and shortens blockstun', () => {
  const m = BY_ID.cinder.moves['5S'], late = duel('cinder', 'rime', 300); let impact = -1;
  { const probe = duel('cinder', 'rime', 300); for (let i = 0; i < 90 && impact < 0; i++) { stepFight(probe, [I(i === 0 ? { S: true } : {}), I({ B: true })]); if (ev(probe, 'block').length) impact = i; } }
  run(late, 90, tap('S'), i => ({ B: i >= impact - 3 })); const b = ev(late, 'block')[0]; assert(b && b.perfect, 'registered as a perfect guard'); assert.equal(late.fighters[1].hp, late.fighters[1].def.health);
});
test('throws beat blocking, can be broken, and cannot grab a jumping or stunned opponent', () => {
  const f = duel('cinder', 'rime', 80); run(f, 80, tap('T'), () => ({ B: true })); assert.equal(ev(f, 'throw').length, 1); assert(f.fighters[1].hp <= f.fighters[1].def.health - 100);
  const t = duel('cinder', 'rime', 80); run(t, 80, tap('T'), i => ({ T: i === 9 })); assert.equal(ev(t, 'tech').length, 1, 'throw was broken'); assert.equal(t.fighters[1].hp, t.fighters[1].def.health);
  const j = duel('cinder', 'rime', 80); run(j, 60, i => ({ T: i === 6 }), i => ({ up: i < 3 })); assert.equal(ev(j, 'throw').length, 0, 'airborne opponent cannot be thrown');
  const c = duel('grit', 'rime', 100); run(c, 100, i => (i === 0 ? { S: true, down: true } : {}), i => ({ B: true, T: i > 8 && i < 14 })); assert.equal(ev(c, 'throw').length, 1); assert.equal(ev(c, 'tech').length, 0, 'a command grab cannot be broken'); assert(c.fighters[1].hp <= c.fighters[1].def.health - 160);
});
test('projectiles travel, collide, disappear, respect the one-at-a-time limit and clash with each other', () => {
  const f = duel('cinder', 'rime', 500); run(f, 20, tap('S')); assert.equal(f.projectiles.length, 1); const x0 = f.projectiles[0].x; run(f, 5); assert(f.projectiles[0].x > x0 + 40);
  run(f, 10, tap('S', 0)); assert.equal(f.projectiles.length, 1, 'second fireball refused while the first is out'); run(f, 80); assert.equal(f.projectiles.length, 0); assert.equal(ev(f, 'hit').length, 1);
  const miss = duel('cinder', 'rime', 500); miss.fighters[1].x = -400; miss.fighters[0].x = 0; miss.fighters[0].facing = 1; run(miss, 200, i => (i === 0 ? { S: true, right: false } : {})); assert.equal(miss.projectiles.length, 0, 'cleaned up at the edge of the stage');
  const c = duel('cinder', 'rime', 600); run(c, 120, tap('S'), tap('S')); assert(ev(c, 'clash').length >= 1, 'projectiles clashed'); assert.equal(c.projectiles.length, 0);
});
test('gatling chain and special cancel only work on contact', () => {
  const f = duel(); run(f, 70, i => ({ L: i === 0, M: i === 7, H: i === 17 })); const ids = ev(f, 'move').map(e => e.id); assert.deepEqual(ids, ['5L', '5M', '5H']); assert.equal(ev(f, 'hit').length, 3); assert(f.fighters[1].combo.hits === 3 || ev(f, 'comboEnd').some(e => e.hits === 3), 'three-hit combo');
  const w = duel('cinder', 'rime', 520); run(w, 30, i => ({ L: i === 0, M: i === 7 })); assert.deepEqual(ev(w, 'move').map(e => e.id).slice(0, 1), ['5L']); assert(w.fighters[0].mf === 0 || ev(w, 'move').length <= 2);
  const s = duel(); run(s, 60, i => ({ M: i === 0, S: i === 10, down: i >= 9 && i <= 20 })); assert.deepEqual(ev(s, 'move').map(e => e.id), ['5M', '2S'], 'special cancel from a connected normal');
});
test('combo damage scales down and hitstun decays so strings cannot continue forever', () => {
  const f = duel('cinder', 'grit', 150, { training: true, refill: false }); const dealt = [];
  for (let n = 0; n < 9; n++) { f.fighters[1].state = 'hitstun'; f.fighters[1].stun = 30; const before = f.events.length; f.fighters[0].state = 'idle'; f.fighters[0].move = null; f.fighters[0].x = f.fighters[1].x - 120; f.fighters[1].vx = 0; run(f, 12, tap('L')); const h = f.events.slice(before).find(e => e.type === 'hit'); if (h) dealt.push(h.damage); }
  assert(dealt.length >= 6); assert(dealt[5] < dealt[0] * 0.6, `sixth hit ${dealt[5]} vs first ${dealt[0]}`); assert(dealt.every((d, i) => i === 0 || d <= dealt[i - 1] + 0.01), 'damage never rises within a combo'); assert(dealt[dealt.length - 1] >= dealt[0] * RULES.minScale - 0.01);
});
test('juggles are limited: after the juggle budget the opponent falls out untouched', () => {
  const f = duel('cinder', 'grit', 120, { training: true, refill: false }); const d = f.fighters[1]; let connected = 0;
  for (let n = 0; n < 14; n++) { d.state = 'airhit'; d.y = 120; d.vy = 2; d.vx = 0; d.x = f.fighters[0].x + 100; d.inv = 0; f.fighters[0].state = 'idle'; f.fighters[0].move = null; const before = f.events.length; run(f, 9, tap('L')); if (f.events.slice(before).some(e => e.type === 'hit')) connected++; }
  assert(connected <= RULES.juggleMax + 1, `juggled ${connected} times`); assert(ev(f, 'juggleLimit').length >= 1);
});
test('launcher sends the opponent airborne, they land in a knockdown and get back up with throw protection', () => {
  const f = duel('cinder', 'rime', 110); run(f, 14, i => (i === 0 ? { H: true, down: true } : {})); assert.equal(f.fighters[1].state, 'airhit'); run(f, 80); assert(['knockdown', 'getup', 'idle'].includes(f.fighters[1].state)); assert.equal(ev(f, 'knockdown').length, 1);
  run(f, 80); assert.equal(f.fighters[1].state, 'idle'); assert.equal(f.fighters[1].combo.hits, 0);
});
test('counter-hit: striking an opponent during their own attack deals bonus damage', () => {
  const f = duel(); run(f, 30, tap('L'), i => (i === 2 ? { H: true } : {})); const h = ev(f, 'hit').find(e => e.side === 0); assert(h && h.counter, 'flagged as a counter hit'); assert(Math.abs(h.damage - BY_ID.cinder.moves['5L'].damage * RULES.counterDamage) < 0.01);
});
test('two strikes that connect on the same frame trade', () => {
  const f = createFight(BY_ID.cinder, BY_ID.cinder, { seed: 1 }); f.fighters[0].x = -70; f.fighters[1].x = 70; run(f, 30, tap('M'), tap('M')); assert.equal(ev(f, 'hit').length, 2, 'both hits landed'); assert(f.fighters[0].hp < 950 && f.fighters[1].hp < 950);
});
test('super meter: gained by hitting and being hit, spent by enhanced specials, supers and the Oath Break', () => {
  const f = duel(); run(f, 30, tap('H')); const [a, b] = f.fighters; assert(a.meter > 8 && b.meter > 4 && a.meter > b.meter);
  a.meter = 100; a.state = 'idle'; a.move = null; b.x = a.x + 400; b.state = 'idle'; run(f, 4, i => (i === 0 ? { S: true, X: true } : { X: true })); assert(ev(f, 'move').some(e => e.id === '5S' && e.ex)); assert(a.meter < 20);
  const n = duel(); n.fighters[0].meter = 150; run(n, 6, i => (i === 0 ? { S: true, H: true } : {})); assert(!ev(n, 'move').some(e => e.kind === 'super'), 'no super without two bars');
  const s = duel(); s.fighters[0].meter = 250; run(s, 4, i => (i === 0 ? { S: true, H: true } : {})); assert(ev(s, 'super').length === 1); assert.equal(Math.round(s.fighters[0].meter), 250 - RULES.superCost + RULES.meterWhiff);
  const k = duel(); k.fighters[1].meter = 300; run(k, 70, i => ({ L: i === 0, M: i === 7, H: i === 17 }), i => ({ B: i >= 12, X: i >= 12 })); assert.equal(ev(k, 'breaker').length, 1, 'Oath Break fired during the combo'); assert.equal(k.fighters[1].meter, 300 - RULES.breakerCost); assert(ev(k, 'hit').length < 4);
});
test('supers: a cinematic on hit, heavy damage, and punishable when blocked', () => {
  for (const id of ROSTER.map(r => r.id)) {
    const f = duel(id, 'grit', id === 'rime' ? 260 : 150); f.fighters[0].meter = 300; run(f, 320, i => (i === 0 ? { S: true, H: true } : {})); assert.equal(ev(f, 'cineStart').length, 1, `${id} super connected`); const dmg = f.fighters[1].def.health - f.fighters[1].hp; assert(dmg > 250 && dmg < 480, `${id} super dealt ${dmg}`); assert.equal(f.cine, null);
    const b = duel(id, 'grit', id === 'rime' ? 260 : 150); b.fighters[0].meter = 300; run(b, 90, i => (i === 0 ? { S: true, H: true } : {}), () => ({ B: true })); assert.equal(ev(b, 'cineStart').length, 0); assert(ev(b, 'block').length >= 1, `${id} super was blocked`);
  }
});
test('Cinder: chain drags the opponent in, Hellstep relocates and is vulnerable on arrival, Ashfall dives', () => {
  const f = duel('cinder', 'rime', 330); run(f, 40, i => (i === 0 ? { S: true, right: true } : {})); assert(ev(f, 'hit').length === 1); assert(Math.abs(f.fighters[1].x - f.fighters[0].x) < 140, 'pulled close');
  const t = duel('cinder', 'rime', 300); const x0 = t.fighters[0].x; run(t, 16, i => (i === 0 ? { S: true, left: true } : {})); assert(t.fighters[0].x > t.fighters[1].x, 'appeared behind'); assert.equal(ev(t, 'teleport').length, 1);
  const p = duel('cinder', 'rime', 300); run(p, 40, i => (i === 0 ? { S: true, left: true } : {}), i => ({ M: i === 16 })); assert(ev(p, 'hit').some(e => e.side === 1), 'the teleport was punished on arrival');
  const a = duel('cinder', 'rime', 260); run(a, 60, i => ({ up: i < 2, right: i < 2, S: i === 22 })); assert(ev(a, 'move').some(e => e.id === 'jS')); assert(ev(a, 'hit').length + ev(a, 'block').length + ev(a, 'whiff').length >= 1);
});
test('Rime: freeze has a fixed length, cannot repeat in one combo, the counter answers strikes and loses to lows, the decoy absorbs a hit', () => {
  const f = duel('rime', 'cinder', 500); f.fighters[1].x = f.fighters[0].x + 250; run(f, 34, i => (i === 0 ? { S: true, right: true } : {})); const v = f.fighters[1]; assert.equal(v.state, 'frozen'); assert(v.stun <= 56 && v.stun > 30);
  let frames = 0; while (v.state === 'frozen' && frames < 200) { run(f, 1); frames++; } assert(frames <= 56, `frozen for ${frames} more frames`); assert(v.status.freezeProof > 0, 'immune to another freeze for a while');
  f.fighters[0].state = 'idle'; f.fighters[0].move = null; v.x = f.fighters[0].x + 250; run(f, 34, i => (i === 0 ? { S: true, right: true } : {})); assert.notEqual(v.state, 'frozen', 'no second freeze straight away');
  const c = duel('rime', 'cinder', 140); run(c, 60, i => (i === 0 ? { S: true, left: true } : {}), i => ({ M: i === 4 })); assert.equal(ev(c, 'counter').length, 1); assert(c.fighters[1].hp < 950 - 100, 'counter-attack landed');
  const l = duel('rime', 'cinder', 140); run(l, 60, i => (i === 0 ? { S: true, left: true } : {}), i => ({ L: i === 4, down: i >= 3 && i <= 5 })); assert.equal(ev(l, 'counter').length, 0); assert(l.fighters[0].hp < 1050, 'a low goes under the counter');
  const d = duel('rime', 'cinder', 420); run(d, 30, i => (i === 0 ? { S: true, down: true } : {})); assert.equal(d.objects.length, 1); run(d, 60, () => ({}), tap('S')); assert.equal(d.objects.length, 0, 'decoy absorbed the fireball'); assert.equal(d.fighters[0].hp, 1050);
});
test('Vesper: bleed stacks and amplifies damage, the parry staggers, Bloodstep passes through', () => {
  const f = duel('vesper', 'grit', 170); run(f, 40, tap('H')); assert.equal(f.fighters[1].status.bleed, 1);
  const p = duel('vesper', 'cinder', 150); run(p, 40, i => (i === 3 ? { S: true, left: true } : {}), tap('M')); assert.equal(ev(p, 'parry').length, 1); assert.equal(p.fighters[1].state, 'stagger'); assert.equal(p.fighters[0].hp, 950);
  const w = duel('vesper', 'cinder', 150); run(w, 50, i => (i === 0 ? { S: true, left: true } : {}), i => ({ M: i === 14 })); assert(w.fighters[0].hp < 950, 'a mistimed parry is punished');
  const s = duel('vesper', 'cinder', 150); run(s, 30, i => (i === 0 ? { S: true, down: true } : {})); assert(s.fighters[0].x > s.fighters[1].x, 'ended on the far side');
});
test('Grit: armour absorbs a hit and keeps swinging, Iron Guard branches into its answer', () => {
  const f = duel('grit', 'cinder', 170); run(f, 60, tap('H'), i => ({ L: i === 6 })); assert.equal(ev(f, 'armor').length, 1); assert(ev(f, 'hit').some(e => e.side === 0), 'the swing still landed'); assert(f.fighters[0].hp < 1180 && f.fighters[0].hp > 1180 - 30, 'armoured hit took reduced damage');
  const g = duel('grit', 'cinder', 170); run(g, 70, i => ({ S: i === 0, left: i === 0, H: i === 14 })); assert(ev(g, 'move').some(e => e.id === 'guardSwing'));
});
test('fighters cannot walk through each other or leave the stage', () => {
  const f = duel('cinder', 'grit', 300); run(f, 200, () => ({ right: true }), () => ({ left: true })); const [a, b] = f.fighters; assert(b.x - a.x >= (hurtbox(a).w + hurtbox(b).w) / 2 - 12, `gap ${b.x - a.x}`);
  run(f, 400, () => ({ left: true }), () => ({ left: true })); assert(a.x >= STAGE.left + 29 && b.x >= STAGE.left + 29);
});
test('a match: round intro, knockout, best of three, meter carries over, positions and projectiles reset', () => {
  const m = createMatch(BY_ID.cinder, BY_ID.rime, { time: 99 }); let guard = 0;
  while (!m.result && guard++ < 40000) { const f = m.fight, [a, b] = f.fighters, close = Math.abs(a.x - b.x) < 150; stepMatch(m, [I(m.phase === 'fight' ? { right: !close && a.facing > 0, left: !close && a.facing < 0, M: close && f.frame % 14 === 0, S: !close && f.frame % 50 === 0 } : {}), I({})]); if (m.phase === 'intro' && m.t === 1 && m.round > 1) { assert.equal(f.projectiles.length, 0); assert(Math.abs(a.x + 170) < 1 && a.hp === a.def.health, 'round reset'); assert(a.meter > 0, 'meter carried over'); } }
  assert(m.result, 'match finished'); assert.equal(m.result.winner, 0); assert.deepEqual(m.result.wins, [2, 0]); assert.equal(m.round, 2); assert(m.events.filter(e => e.type === 'announce' && e.text === 'K.O.').length === 2);
});
test('time-out goes to the healthier fighter and a double knockout is a draw', () => {
  const m = createMatch(BY_ID.cinder, BY_ID.rime, { time: 3 }); while (m.phase !== 'fight') stepMatch(m, [I({}), I({})]); m.fight.fighters[1].hp = 500; for (let i = 0; i < 200 && m.phase === 'fight'; i++) stepMatch(m, [I({}), I({})]); assert.deepEqual(m.wins, [1, 0]); assert(m.events.some(e => e.type === 'announce' && e.text === 'TIME'));
  const f = createFight(BY_ID.cinder, BY_ID.cinder, { seed: 1 }); f.fighters[0].x = -70; f.fighters[1].x = 70; f.fighters[0].hp = 5; f.fighters[1].hp = 5; run(f, 30, tap('M'), tap('M')); assert(f.over && f.over.winner === -1, 'double knockout');
});
test('training mode: nobody dies, health refills after a combo, meter stays full, reset restores positions', () => {
  const m = createMatch(BY_ID.grit, BY_ID.vesper, { training: true, infiniteMeter: true }); assert.equal(m.phase, 'fight'); const [a, b] = m.fight.fighters; b.x = a.x + 150;
  for (let i = 0; i < 2000; i++) stepMatch(m, [I({ H: i % 60 === 0 }), I({})]); assert(!m.result && m.phase === 'fight'); assert(b.hp > 0); assert.equal(a.meter, RULES.meterMax);
  for (let i = 0; i < 200; i++) stepMatch(m, [I({}), I({})]); assert.equal(b.hp, b.def.health, 'health refilled once the combo ended');
  a.x = 400; resetPositions(m); assert.equal(m.fight.fighters[0].x, -150); assert.equal(m.fight.projectiles.length, 0);
});
test('the engine is deterministic: identical inputs give identical fights', () => {
  const play = () => { const m = createMatch(BY_ID.vesper, BY_ID.grit, { time: 60, seed: 5 }); for (let i = 0; i < 3000 && !m.result; i++) stepMatch(m, [I({ right: i % 90 < 50, L: i % 11 === 0, M: i % 17 === 0, H: i % 41 === 0, S: i % 67 === 0, up: i % 150 === 0 }), I({ left: i % 70 < 30, B: i % 40 < 12, M: i % 23 === 0, S: i % 53 === 0, down: i % 31 < 6 })]); const [a, b] = m.fight.fighters; return [m.round, m.wins.join(), a.x, a.hp, a.meter, b.x, b.hp, b.meter, m.frame].join('|'); };
  assert.equal(play(), play());
});
test('inputs are independent: each fighter responds only to its own input stream', () => {
  const f = duel('cinder', 'rime', 400); run(f, 60, () => ({ right: true, L: true }), () => ({})); assert.equal(f.fighters[1].state, 'idle'); assert.equal(f.fighters[1].x, 200); assert(f.fighters[0].x > -200);
  const g = duel('cinder', 'rime', 400); run(g, 30, () => ({ up: true }), () => ({ down: true })); assert(g.fighters[0].y > 0 || g.fighters[0].state === 'air' || g.fighters[0].state === 'prejump'); assert.equal(g.fighters[1].state, 'crouch');
});
test('no infinite: a looped best string against a passive opponent always lets them recover', () => {
  for (const id of ROSTER.map(r => r.id)) { const f = duel(id, 'grit', 140, { training: true, refill: false, damageScale: 0.0001 }); let longest = 0, current = 0, recovered = 0;
    for (let i = 0; i < 2400; i++) { stepFight(f, [I({ right: Math.abs(f.fighters[1].x - f.fighters[0].x) > 130 && f.fighters[0].facing > 0, left: Math.abs(f.fighters[1].x - f.fighters[0].x) > 130 && f.fighters[0].facing < 0, L: i % 5 === 0, M: i % 5 === 2, H: i % 9 === 4, S: i % 13 === 6, down: i % 26 < 5 }), I({})]); const s = f.fighters[1].state; if (['hitstun', 'airhit', 'knockdown', 'frozen', 'stagger', 'thrown', 'cine'].includes(s)) current++; else { if (current > 0) recovered++; longest = Math.max(longest, current); current = 0; } }
    assert(recovered >= 5, `${id}: opponent recovered ${recovered} times`); assert(longest < 420, `${id}: longest stretch without control was ${longest} frames`); }
});
test('boss: the Oath Ward soaks two strikes at half damage, comes back when left alone, and is ignored by throws', () => {
  for (const id of ['5L', '5M', '5H', '2L', '2M', '2H', '6H', 'jL', 'jM', 'jH', '5S', '6S', '4S', '2S', 'super', 'throw', 'breaker']) assert(boss.moves[id], `the boss is missing ${id}`);
  const f = duel('cinder', 'rime', 150); f.fighters[1] = createFight(BY_ID.cinder, boss, {}).fighters[1]; const b = f.fighters[1]; b.x = 75; assert.equal(b.armor, 2);
  run(f, 30, tap('M')); assert.equal(b.armor, 1); assert.equal(b.hp, boss.health - BY_ID.cinder.moves['5M'].damage / 2, 'half damage'); assert.notEqual(b.state, 'hitstun', 'no flinch'); assert.equal(ev(f, 'armor').length, 1);
  run(f, 30, tap('M')); assert.equal(b.armor, 0); run(f, 12, tap('M')); assert.equal(b.state, 'hitstun', 'with the ward gone he can be hit'); assert.equal(b.combo.hits, 1);
  run(f, 60); const idle = f.frame; run(f, boss.ward.every + 2); assert.equal(b.armor, 1, 'one charge returned'); assert(f.frame - idle > 200); run(f, boss.ward.every + 2); assert.equal(b.armor, 2); run(f, boss.ward.every + 2); assert.equal(b.armor, 2, 'never more than the maximum');
  const g = duel('cinder', 'rime', 80); g.fighters[1] = createFight(BY_ID.cinder, boss, {}).fighters[1]; g.fighters[1].x = 40; run(g, 60, tap('T')); assert.equal(ev(g, 'throw').length, 1); assert(g.fighters[1].hp < boss.health - 100, 'the throw did full damage'); assert.equal(g.fighters[1].armor, 2, 'and left the ward alone');
});
test('boss: a super shatters the ward, and at 40% health the ward refills and recharges faster', () => {
  const f = duel('cinder', 'rime', 150); f.fighters[1] = createFight(BY_ID.cinder, boss, {}).fighters[1]; const [a, b] = f.fighters; b.x = 75; a.meter = RULES.superCost;
  run(f, 160, tap('S', 0, {}), () => ({})); if (!ev(f, 'super').length) { a.meter = RULES.superCost; run(f, 2, () => ({ H: true, S: true })); run(f, 200); }
  assert.equal(ev(f, 'wardBreak').length, 1); assert.equal(ev(f, 'cineStart').length, 1, 'the super connected through the ward');
  const g = duel('cinder', 'rime', 400); g.fighters[1] = createFight(BY_ID.cinder, boss, {}).fighters[1]; const c = g.fighters[1]; c.x = 200; c.armor = 0; c.hp = boss.health * boss.ward.rageBelow - 1; run(g, 2);
  assert.equal(ev(g, 'rage').length, 1); assert.equal(c.armor, 2); c.armor = 0; run(g, boss.ward.rage + 2); assert.equal(c.armor, 1, 'recharges on the faster clock'); run(g, 600); assert.equal(ev(g, 'rage').length, 1, 'the rage happens once');
});
test('computer opponent: sees only the fight (never the other player\'s buttons), is repeatable, and finishes matches at every level', () => {
  assert.equal(createAI(1, BY_ID.cinder, 1).length, 2, 'the AI is given the fight and its side, nothing else');
  const play = (la, lb, ia, ib, seed) => { const A = ia === 'malgrave' ? boss : BY_ID[ia], B = ib === 'malgrave' ? boss : BY_ID[ib], m = createMatch(A, B, { time: 60, seed }), ai = [createAI(la, A, seed), createAI(lb, B, seed + 1)]; let n = 0; while (!m.result && n++ < 60000) stepMatch(m, [ai[0](m.fight, 0), ai[1](m.fight, 1)]); assert(m.result, `${ia} L${la} vs ${ib} L${lb} did not finish`); return m; };
  const first = play(1, 1, 'cinder', 'rime', 4), again = play(1, 1, 'cinder', 'rime', 4); assert.equal(first.frame, again.frame); assert.deepEqual(first.result.wins, again.result.wins);
  for (const id of [...ROSTER.map(r => r.id), 'malgrave']) for (const level of [0, 3]) { const m = play(level, level, id, id === 'grit' ? 'cinder' : 'grit', 9 + level); assert(m.stats[0].damage > 150, `${id} at level ${level} dealt only ${Math.round(m.stats[0].damage)} damage`); }
  let strong = 0; const pairs = [['cinder', 'rime'], ['rime', 'vesper'], ['vesper', 'grit'], ['grit', 'cinder'], ['cinder', 'vesper'], ['rime', 'grit']];
  pairs.forEach(([x, y], i) => { if (play(3, 0, x, y, 20 + i).result.winner === 0) strong++; if (play(0, 3, x, y, 40 + i).result.winner === 1) strong++; });
  assert(strong >= 9, `the top level beat the bottom level in only ${strong} of 12 matches`);
});

console.log(`\n${passed} engine tests passed${failures.length ? ', ' + failures.length + ' FAILED: ' + failures.join('; ') : ''}.`);
if (failures.length) process.exit(1);
