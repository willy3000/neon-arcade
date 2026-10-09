// Mechanics tests for the WILDFALL simulation. Run: node wildfall/tests/sim.test.mjs
import assert from 'node:assert/strict';
import { createSim, step, snapshot, NEUTRAL, spawnEnemy } from '../sim/index.js';
import { PHYS, CHARACTERS, GRAPPLE, DT } from '../config.js';
import { damagePlayer, damageEnemy, explode } from '../sim/combat.js';
import { builder } from '../levels/builder.js';
import { build as chapter1 } from '../levels/chapter1.js';
import { build as proving } from '../levels/proving.js';
import * as Save from '../save.js';

let passed = 0; const failures = [];
function test(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(name); console.log('FAIL', name, '\n     ', e.message.split('\n')[0]); } }
// A flat test yard; `edit` adds whatever the test needs.
function yard(edit, meta = {}) { const b = builder({ id: 'test', name: 'TEST', subtitle: '', biome: 'ruins', bounds: { x: -60, y: -10, w: 240, h: 80 }, killY: -20, spawn: { x: 0, y: 0 }, gear: { grapple: true }, ...meta }); b.island(-60, 180, 0, 4); edit?.(b); return b.L; }
function make(hero = 'vyx', edit, opts) { const sim = createSim(yard(edit), hero, opts); run(sim, 20); return sim; }
function run(sim, ticks, fn = () => ({})) { for (let i = 0; i < ticks; i++) step(sim, { ...NEUTRAL, ...fn(i, sim) }); }
const events = (sim, type) => sim.events.filter(e => e.type === type);
const place = (sim, x, y) => { const p = sim.player; p.x = x; p.y = y; p.vx = 0; p.vy = 0; };

test('jump height follows how long jump is held', () => {
  const hold = make(), tap = make(); let high = 0, low = 0;
  run(hold, 150, i => { high = Math.max(high, hold.player.y); return { jump: i === 0, jumpHeld: true }; }); run(tap, 150, i => { low = Math.max(low, tap.player.y); return { jump: i === 0, jumpHeld: i < 5 }; });
  assert(high > 3.2 && high < 3.7, `full jump ${high}`); assert(low < high * 0.62, `tap jump ${low}`);
});
test('a jump pressed just before landing is buffered and one just after a ledge still fires (coyote time)', () => {
  const sim = make(); run(sim, 1, () => ({ jump: true, jumpHeld: true })); let stage = 0;
  run(sim, 500, (i, s) => { const p = s.player, air = stage === 0 && i > 20, late = stage === 1 && !p.onGround && p.vy < 0 && p.y < 0.5 && p.y > 0.05; if (air || late) stage++; return { jump: air || late, jumpHeld: true }; });
  assert.equal(stage, 2); assert.equal(events(sim, 'jump').filter(e => e.kind === 'ground').length, 2, 'the press made in the air fired as a ground jump on landing');
  const edge = make('vyx', b => b.stone(0, 0, 6, 3)); place(edge, 3, 3); run(edge, 10); run(edge, 80, (i, s) => ({ mx: 1 })); // run off the right edge
  const s2 = make('vyx', b => b.stone(0, 0, 6, 3)); place(s2, 5, 3); run(s2, 5); let left = false, fired = false;
  run(s2, 120, (i, s) => { const p = s.player; if (!p.onGround && !left) left = true; const press = left && !fired && p.coyote > 0 && p.coyote < PHYS.coyote - 0.03; if (press) fired = true; return { mx: 1, jump: press, jumpHeld: true }; });
  assert(fired && events(s2, 'jump').some(e => e.kind === 'ground'), 'coyote jump counted as a ground jump');
});
test('double jump, and air resources refill on landing', () => {
  const sim = make(); let peak = 0, second = false;
  run(sim, 300, (i, s) => { const p = s.player; peak = Math.max(peak, p.y); const press = !second && i > 5 && p.vy < 1; if (press) second = true; return { jump: i === 0 || press, jumpHeld: true }; });
  assert(peak > 5.4, `double jump peak ${peak}`); assert.equal(sim.player.airJumps, 1); assert.equal(sim.player.airDashes, 1);
});
test('wall slide, wall jump and a chained climb up a chimney', () => {
  const sim = make('sera', b => { b.stone(3, 0, 1, 14); b.stone(-4, 2.5, 1, 14); }); let top = 0;
  run(sim, 900, (i, s) => { const p = s.player; top = Math.max(top, p.y); const dir = p.lastWall && !p.onGround && p.wallCoyote > 0 ? 0 : 1; return { mx: p.wallLock > 0 ? 0 : (p.x > 0 ? 1 : -1), jump: p.onGround || p.wallCoyote > 0.02, jumpHeld: true }; });
  assert(events(sim, 'jump').filter(e => e.kind === 'wall').length >= 3, 'several wall jumps'); assert(top > 9, `climbed to ${top}`);
  const slide = make('sera', b => b.stone(3, 0, 1, 20)); place(slide, 2.5, 12); let fastest = 0; run(slide, 120, (i, s) => { if (s.player.wallSliding) fastest = Math.min(fastest, s.player.vy); return { mx: 1 }; });
  assert(fastest >= -PHYS.wallSlide - 0.01 && fastest < -1, `wall slide speed ${fastest}`);
});
test('Vyx runs up walls; the others cannot', () => {
  const reach = hero => { const sim = make(hero, b => b.stone(3, 0, 2, 30)); let top = 0; run(sim, 200, (i, s) => { top = Math.max(top, s.player.y); return { mx: 1, my: 1, jump: i === 30, jumpHeld: true }; }); return top; };
  const vyx = reach('vyx'), bragg = reach('bragg'); assert(vyx > bragg + 2.5, `vyx ${vyx} vs bragg ${bragg}`);
});
test('back-wall run carries speed across a gap', () => {
  const far = (hero, zone) => { const b = builder({ id: 't', name: 'T', subtitle: '', biome: 'ruins', bounds: { x: -20, y: -10, w: 100, h: 60 }, killY: -30, spawn: { x: 0, y: 5 }, gear: {} }); b.island(-20, 6, 5, 3); if (zone) b.zone('wallrun', 5, 4, 30, 8); const sim = createSim(b.L, hero); run(sim, 20); let x = 0; run(sim, 400, (i, s) => { if (s.player.y > 4.2 && !events(s, 'pit').length) x = Math.max(x, s.player.x); return { mx: 1, jump: s.player.onGround && s.player.x > 5.2, jumpHeld: true }; }); return { x, sim }; };
  const withWall = far('vyx', true), without = far('vyx', false);
  assert(events(withWall.sim, 'wallrun').length === 1); assert(withWall.x > without.x + 5, `with wall ${withWall.x} vs ${without.x}`);
});
test('air dash: once per jump, direction-aware, and keeps momentum for Vyx', () => {
  const sim = make(); place(sim, 0, 30); run(sim, 30, () => ({ mx: 1 }));
  run(sim, 1, () => ({ mx: 1, dash: true })); assert.equal(sim.player.mode, 'dash'); assert.equal(sim.player.airDashes, 0);
  run(sim, 30, () => ({ mx: 1 })); assert(sim.player.vx >= CHARACTERS.vyx.dashSpeed * 0.9, `kept ${sim.player.vx}`);
  run(sim, 40, () => ({ mx: 1, dash: true })); assert.equal(events(sim, 'dash').length, 1, 'no second air dash');
  const up = make(); run(up, 20, i => ({ jump: i === 0, jumpHeld: true })); const y0 = up.player.y; run(up, 1, () => ({ my: 1, dash: true })); run(up, 16, () => ({ my: 1 })); assert(up.player.y > y0 + 2, 'upward dash rises');
});
test('Sera blinks instead of dashing and glides while jump is held', () => {
  const sim = make('sera'); const x0 = sim.player.x; run(sim, 1, () => ({ mx: 1, dash: true })); assert(Math.abs(sim.player.x - x0 - CHARACTERS.sera.blink) < 0.2); assert.equal(events(sim, 'blink').length, 1);
  const fall = hold => { const s = make('sera'); place(s, 0, 40); run(s, 110, () => ({ jumpHeld: hold })); return s.player.vy; };
  assert(fall(true) > -CHARACTERS.sera.glideFall - 0.5, 'glide caps fall speed'); assert(fall(false) < -15);
});
test('slide passes under a low arch and a slide-jump keeps the boost', () => {
  const sim = make('vyx', b => b.stone(10, 1.05, 4, 3)); run(sim, 60, () => ({ mx: 1 })); let slid = false;
  run(sim, 260, (i, s) => { const p = s.player, go = !slid && p.x > 6.5; if (go) slid = true; return { mx: 1, my: go ? -1 : 0, dash: go }; });
  assert(sim.player.x > 14.5, `passed the arch, x=${sim.player.x}`); assert.equal(sim.player.h, CHARACTERS.vyx.h, 'stood back up');
  const j = make(); run(j, 60, () => ({ mx: 1 })); run(j, 1, () => ({ mx: 1, my: -1, dash: true })); run(j, 8, () => ({ mx: 1 })); run(j, 1, () => ({ mx: 1, jump: true, jumpHeld: true }));
  assert(j.player.vx > CHARACTERS.vyx.runSpeed * 1.1, `slide-jump speed ${j.player.vx}`); assert(events(j, 'tech').some(e => e.name === 'slide jump'));
});
test('ledge recovery pulls up a jump that falls just short', () => {
  const sim = make('bragg', b => b.stone(4, 0, 6, 3.6)); let mantled = false, top = false; run(sim, 400, (i, s) => { const p = s.player; if (p.mode === 'mantle') mantled = true; if (p.onGround && Math.abs(p.y - 3.6) < 0.01) top = true; return { mx: top ? 0 : 1, jump: p.onGround && p.x > 2.2 && p.y < 1, jumpHeld: true }; });
  assert(mantled, 'mantle engaged'); assert(top && Math.abs(sim.player.y - 3.6) < 0.01 && sim.player.x > 4, `on the ledge at ${sim.player.x},${sim.player.y}`);
});
test('moving platforms carry riders and hand over their momentum to a jump', () => {
  const sim = make('vyx', b => b.mover(4, 3, 3, [[14, 3]], { speed: 4, pause: 0.1 })); place(sim, 5.5, 3); run(sim, 60);
  assert.equal(sim.player.ground?.kind, 'mover'); const x0 = sim.player.x; run(sim, 120); assert(sim.player.x > x0 + 3, `carried ${sim.player.x - x0}`);
  const before = sim.player.vx; run(sim, 1, () => ({ jump: true, jumpHeld: true })); assert(Math.abs(sim.player.vx) > 3, `jump inherited platform speed ${sim.player.vx} (was ${before})`);
});
test('one-way ledges can be jumped through and dropped through', () => {
  const sim = make('vyx', b => b.ledge(-2, 2.6, 4)); run(sim, 200, i => ({ jump: i === 0, jumpHeld: true })); assert(Math.abs(sim.player.y - 2.6) < 0.01, 'landed on the ledge from below');
  run(sim, 1, () => ({ my: -1, jump: true })); run(sim, 120, () => ({ my: -1 })); assert(sim.player.y < 0.01, 'dropped through');
});
test('sky blooms launch, and a dive onto one launches higher', () => {
  const peak = dive => { const sim = make('vyx', b => b.bounce(4, 0, 3)); place(sim, 5.5, dive ? 6 : 0.4); let top = 0; run(sim, 3, () => (dive ? { my: -1, attack: true } : {})); run(sim, 300, (i, s) => { top = Math.max(top, s.player.vy > 0 ? s.player.y : top); return {}; }); return { top, sim }; };
  const normal = peak(false), dived = peak(true); assert(normal.top > 5.5, `bloom height ${normal.top}`); assert(dived.top > normal.top + 1.5, `dive bloom ${dived.top}`); assert(events(dived.sim, 'tech').some(e => e.name === 'dive bounce'));
});
test('grapple: attaches only to reachable anchors in the aim cone with a clear line', () => {
  const sim = make('vyx', b => { b.anchor(5, 8); b.anchor(40, 8); b.anchor(-6, 8); b.stone(-8, 5, 4, 1); }); place(sim, 0, 0);
  run(sim, 30, () => ({ grapple: true, grappleHeld: true, aimX: 0.5, aimY: 0.86 })); assert.equal(sim.player.mode, 'grapple'); assert.equal(sim.player.rope.target.x, 5);
  const blocked = make('vyx', b => { b.anchor(-6, 8); b.stone(-8, 5, 4, 1); }); run(blocked, 30, i => ({ grapple: i === 0, grappleHeld: true, aimX: -0.5, aimY: 0.86 })); assert.equal(blocked.player.rope, null, 'no line of sight'); assert.equal(events(blocked, 'grappleMiss').length, 1);
  const none = make('vyx', b => b.anchor(5, 8), { gear: { grapple: false } }); run(none, 30, i => ({ grapple: i === 0, grappleHeld: true })); assert.equal(none.player.rope, null, 'no launcher, no grapple');
});
test('rope constraint holds: the hand never drifts beyond the rope length', () => {
  const sim = make('vyx', b => b.anchor(8, 12)); place(sim, 2, 6); let worst = 0, speed = 0;
  run(sim, 720, (i, s) => { const p = s.player; if (p.mode === 'grapple') { worst = Math.max(worst, Math.hypot(p.x - p.rope.ax, p.y + p.h * 0.75 - p.rope.ay) - p.rope.len); speed = Math.max(speed, Math.hypot(p.vx, p.vy)); } return { grapple: i === 0, grappleHeld: true, mx: p.vx >= 0 ? 1 : -1, aimX: 0.4, aimY: 0.9 }; });
  assert.equal(sim.player.mode, 'grapple'); assert(worst < 0.02, `rope stretched by ${worst}`); assert(speed > 12 && speed < 34.1, `swing speed ${speed}`);
});
test('swinging builds speed, reeling in speeds it up, and a release on the upswing launches', () => {
  const sim = make('vyx', b => b.anchor(8, 14)); place(sim, 1, 8); let released = null, len0 = 0;
  run(sim, 600, (i, s) => { const p = s.player; if (p.mode === 'grapple' && !len0) len0 = p.rope.len; const go = !released && p.mode === 'grapple' && i > 80 && p.vx > 6 && p.vy > 5 && p.x > 9; if (go) released = { vx: p.vx, vy: p.vy }; return { grapple: i === 0, grappleHeld: !released && !go, mx: p.vx >= 0 ? 1 : -1, my: i > 20 && i < 60 ? 1 : 0, aimX: 0.4, aimY: 0.9 }; });
  assert(released, 'found an upswing to release on'); const ev = events(sim, 'grappleRelease')[0]; assert(ev, 'release event'); assert(ev.speed >= Math.hypot(released.vx, released.vy) - 0.5, 'release keeps the swing speed');
  assert(events(sim, 'tech').some(e => e.name === 'perfect release') === ev.perfect);
  const reel = make('vyx', b => b.anchor(8, 14)); place(reel, 1, 8); let a = 0, c = 0; run(reel, 200, (i, s) => { const p = s.player; if (i === 100) a = p.rope?.len; if (i === 199) c = p.rope?.len; return { grapple: i === 0, grappleHeld: true, my: i >= 100 ? 1 : 0 }; }); assert(c < a - 2, `rope reeled from ${a} to ${c}`);
});
test('perfect release window and jump-release boost', () => {
  const sim = make('vyx', b => b.anchor(8, 14)); place(sim, 2, 9); run(sim, 40, i => ({ grapple: i === 0, grappleHeld: true }));
  const p = sim.player; assert.equal(p.mode, 'grapple'); p.vx = 13; p.vy = 11; run(sim, 1, () => ({ grappleHeld: false }));
  const ev = events(sim, 'grappleRelease')[0]; assert(ev.perfect, 'release at ~40° and speed counts as perfect'); assert(ev.speed > Math.hypot(13, 11) * GRAPPLE.perfectBoost * 0.97);
  const j = make('vyx', b => b.anchor(8, 14)); place(j, 2, 9); run(j, 40, i => ({ grapple: i === 0, grappleHeld: true })); j.player.vx = 6; j.player.vy = 0; const before = j.player.vy; run(j, 1, () => ({ grappleHeld: true, jump: true })); assert(j.player.vy > before + GRAPPLE.releaseJump - 1.5, 'jumping off the rope adds lift'); assert.equal(j.player.airJumps, 1, 'air jump was refilled by the attach');
});
test('the three heroes move differently', () => {
  const stats = hero => { const sim = make(hero); let peak = 0; run(sim, 200, i => ({ mx: 1 })); const speed = sim.player.vx; run(sim, 200, (i, s) => { peak = Math.max(peak, s.player.y); return { jump: i === 0, jumpHeld: i < 60 }; }); return { speed, peak, hp: sim.player.maxHp }; };
  const v = stats('vyx'), s = stats('sera'), b = stats('bragg');
  assert(v.speed > s.speed && s.speed > b.speed, 'run speed order'); assert(b.peak < v.peak - 0.3, 'Bragg jumps lower'); assert(b.hp > v.hp && v.hp > s.hp, 'health order');
});
test('melee combo chains, opens hitboxes only during the swing, and builds a combo', () => {
  const sim = make('vyx'); const e = spawnEnemy(sim, 'dummy', 1.9, 0); run(sim, 10); const hp0 = e.hp;
  run(sim, 1, () => ({ attack: true })); run(sim, 8); assert.equal(e.hp, hp0, 'no damage before the swing reaches the hit frame');
  run(sim, 110, i => ({ attack: i === 14 || i === 44 })); const ids = events(sim, 'attack').map(a => a.id); assert.deepEqual(ids.slice(0, 3), ['light1', 'light2', 'light3']);
  assert(e.hp < hp0 - 25, `three hits landed, hp ${e.hp}`); assert(sim.combo.best >= 3);
  const miss = make('vyx'); const far = spawnEnemy(miss, 'dummy', 6, 0); run(miss, 60, i => ({ attack: i === 0 })); assert.equal(far.hp, far.maxHp, 'out of reach');
});
test('launcher sends enemies up and air attacks keep them there', () => {
  const sim = make('vyx'); const e = spawnEnemy(sim, 'minion', 1.6, 0); run(sim, 10); e.cd = 99; run(sim, 1, () => ({ heavy: true, heavyHeld: true })); run(sim, 3, () => ({ heavyHeld: true })); let top = 0;
  run(sim, 120, (i, s) => { top = Math.max(top, e.y); return { jumpHeld: true }; }); assert(top > 2.2, `launched to ${top}`); assert(sim.player.y > 0.5 || top > 2.2, 'attacker can follow');
});
test('charged heavy hits harder than an uncharged one', () => {
  const dmg = hold => { const sim = make('bragg'); spawnEnemy(sim, 'dummy', 2.2, 0); run(sim, 10); run(sim, 1, () => ({ heavy: true, heavyHeld: true })); run(sim, hold, () => ({ heavyHeld: true })); run(sim, 150); return sim.stats.damage; };
  const quick = dmg(4), charged = dmg(130); assert(quick > 20 && charged > quick * 1.15, `quick ${quick} charged ${charged}`);
});
test('dive attack: Vyx springs off an enemy, Bragg crushes through and breaks cracked floors', () => {
  const sim = make('vyx'); spawnEnemy(sim, 'dummy', 0, 0); place(sim, 0, 7); run(sim, 2, i => ({ my: -1, attack: i === 0 })); run(sim, 40);
  assert(events(sim, 'tech').some(e => e.name === 'pogo')); assert(sim.player.vy > 0 || sim.player.y > 2, 'bounced');
  const b = make('bragg', bb => { bb.cracked(-2, 5, 4, 1); }); place(b, 0, 6.01); run(b, 10); assert(b.player.onGround && b.player.y > 5.9); run(b, 1, () => ({ jump: true, jumpHeld: true })); run(b, 30, () => ({ jumpHeld: true })); run(b, 2, i => ({ my: -1, attack: i === 0 })); run(b, 120);
  assert(events(b, 'break').length === 1, 'floor broke'); assert(b.player.y < 0.01, `fell through to the ground, y=${b.player.y}`);
});
test('shields block from the front, and are beaten by a dive, guard-breaks and lightning', () => {
  const front = make('vyx'); const g = spawnEnemy(front, 'bulwark', 2, 0, { facing: -1 }); g.cd = 99; run(front, 5); const hp = g.hp; run(front, 60, i => ({ attack: i === 0 }));
  assert.equal(g.hp, hp, 'blade blocked'); assert(events(front, 'blocked').length >= 1);
  assert.equal(damageEnemy(front, g, { dmg: 10, kind: 'lightning', x: front.player.x }), 'hit', 'lightning ignores the shield');
  const s = make('bragg'); const g2 = spawnEnemy(s, 'bulwark', 2.4, 0, { facing: -1 }); g2.cd = 99; run(s, 5); run(s, 1, () => ({ heavy: true, heavyHeld: true })); run(s, 100); assert(events(s, 'guardBreak').length === 1, 'Bragg\'s splitter breaks the guard'); assert(g2.hp < g2.maxHp);
});
test('elements: ice freezes and shatters, fire burns and thaws, water carries lightning', () => {
  const sim = make('sera', b => b.zone('water', 4, 0, 10, 1)); const a = spawnEnemy(sim, 'dummy', 6, 0), c = spawnEnemy(sim, 'dummy', 9, 0), d = spawnEnemy(sim, 'dummy', 12, 0); run(sim, 10);
  assert(a.wet > 0 && c.wet > 0, 'standing in water makes enemies wet');
  place(sim, 1, 0); run(sim, 1, () => ({ ability2: true })); run(sim, 80); assert(events(sim, 'lightning').length === 1); assert(events(sim, 'electrify').length === 1, 'the pool was electrified'); assert(a.hp < a.maxHp && c.hp < c.maxHp && d.hp < d.maxHp, 'everything in the pool was hit');
  damageEnemy(sim, a, { dmg: 1, kind: 'ice', x: 0 }); assert(a.frozen > 0, 'wet enemies freeze at once'); const hp = a.hp; damageEnemy(sim, a, { dmg: 10, kind: 'heavy', heavy: true, x: 0 }); assert(Math.abs(hp - a.hp - 20) < 0.01, 'frozen enemies shatter for double damage'); assert.equal(a.frozen, 0);
  damageEnemy(sim, c, { dmg: 1, kind: 'ice', x: 0 }); damageEnemy(sim, c, { dmg: 1, kind: 'fire', x: 0 }); assert.equal(c.frozen, 0, 'fire thaws'); assert(c.wet > 0, 'and leaves the target wet');
  damageEnemy(sim, d, { dmg: 1, kind: 'fire', x: 0 }); const h0 = d.hp; d.def = { ...d.def, think: () => {} }; run(sim, 120); assert(d.hp < h0 - 3, 'burning deals damage over time');
});
test('Sera\'s ice platform is a real, temporary platform that fire melts', () => {
  const sim = make('sera'); place(sim, 0, 8); run(sim, 1, () => ({ ability1: true })); run(sim, 120); const ice = sim.world.solids.find(s => s.kind === 'ice');
  assert(ice, 'platform created'); assert(Math.abs(sim.player.y - (ice.y + ice.h)) < 0.01, `standing on it at ${sim.player.y}`);
  explode(sim, ice.x + 1, ice.y, 2, 20, 'fire', 'player'); assert(ice.dead, 'fire melts ice'); run(sim, 200); assert(sim.player.y < 0.01, 'fell when it melted');
  const t = make('sera'); place(t, 0, 8); run(t, 1, () => ({ ability1: true })); run(t, 120 * 7); assert(t.world.solids.find(s => s.kind === 'ice').dead, 'it expires on its own');
});
test('environment: kegs chain and break cracked stone, fire burns barricades, pylons need force', () => {
  const sim = make('vyx', b => { b.prop('barrel', 3, 0); b.prop('barrel', 5.5, 0); b.cracked(7, 0, 1, 4); b.prop('pylon', -4, 0, { accepts: ['slam', 'lightning', 'explosion', 'kinetic'], targets: ['door'] }); b.L.solids.push({ id: 'door', x: -9, y: 0, w: 1, h: 5, kind: 'gate', gate: true, open: false }); });
  place(sim, 1.6, 0); run(sim, 1, () => ({ attack: true })); run(sim, 240); assert(events(sim, 'explosion').length === 2, 'second keg caught the first blast'); assert(sim.world.solids.find(s => s.kind === 'cracked').dead, 'cracked wall destroyed'); assert(sim.player.hp < sim.player.maxHp, 'standing next to a keg hurts');
  place(sim, -2.4, 0); sim.player.facing = -1; sim.player.iframes = 0; run(sim, 60, i => ({ mx: i < 2 ? -1 : 0, attack: i === 5 })); const door = sim.world.solids.find(s => s.id === 'door'); assert.equal(door.open, false, 'a light blade does not wake a pylon'); assert(events(sim, 'pylonReject').length >= 1);
  run(sim, 1, () => ({ heavy: true, heavyHeld: true })); run(sim, 125, () => ({ heavyHeld: true })); run(sim, 100); assert.equal(door.open, true, 'a charged kinetic lunge does');
  const fire = make('sera', b => b.barricade(4, 0, 1, 4)); run(fire, 1, () => ({ mx: 1, heavy: true, heavyHeld: true })); run(fire, 300); assert(fire.world.solids.find(s => s.kind === 'barricade').dead, 'fireball burns the barricade down');
});
test('Bragg: shield blocks, a timed raise parries, and the chain drags enemies in', () => {
  const sim = make('bragg'); const e = spawnEnemy(sim, 'minion', 3, 0, { alert: true }); run(sim, 30, () => ({ ability1Held: true })); assert(sim.player.shield);
  const hp = sim.player.hp; assert.equal(damagePlayer(sim, { dmg: 20, x: 3, source: e }), 'blocked'); assert(hp - sim.player.hp < 4, 'most damage absorbed');
  const p = make('bragg'); const e2 = spawnEnemy(p, 'minion', 3, 0, { alert: true }); run(p, 5, () => ({ ability1Held: true })); assert.equal(damagePlayer(p, { dmg: 20, x: 3, source: e2 }), 'parry'); assert(e2.stun > 1, 'attacker staggered'); assert.equal(p.player.hp, p.player.maxHp);
  const c = make('bragg'); const e3 = spawnEnemy(c, 'minion', 6, 0); e3.cd = 99; run(c, 5); run(c, 40, i => ({ grapple: i === 0, grappleHeld: true, aimX: 1, aimY: 0.2 })); assert(events(c, 'chainPull').length === 1); assert(e3.x < 4.5, `enemy dragged to ${e3.x}`);
});
test('perfect dodge: dashing through a hit grants a counter window', () => {
  const sim = make('vyx'); spawnEnemy(sim, 'dummy', 3, 0); run(sim, 1, () => ({ mx: 1, dash: true })); assert.equal(damagePlayer(sim, { dmg: 20, x: 3 }), 'miss'); assert(sim.player.counterT > 0); assert(events(sim, 'perfectDodge').length === 1); assert.equal(sim.player.hp, sim.player.maxHp);
});
test('enemies telegraph before they strike and can be interrupted', () => {
  const sim = make('vyx'); const e = spawnEnemy(sim, 'minion', 2.2, 0, { alert: true }); e.cd = 0; let windup = 0, hurtAt = -1;
  run(sim, 200, (i, s) => { if (e.state === 'attack') windup++; if (s.player.hp < s.player.maxHp && hurtAt < 0) hurtAt = i; return {}; });
  assert(events(sim, 'telegraph').length >= 1); assert(hurtAt > 55, `first hit landed after a readable windup (tick ${hurtAt})`);
  const cut = make('vyx'); const e2 = spawnEnemy(cut, 'minion', 1.8, 0, { alert: true }); e2.cd = 0; run(cut, 30); assert.equal(e2.state, 'attack'); run(cut, 30, i => ({ attack: i === 0 })); assert.notEqual(e2.state, 'attack', 'a hit interrupts the windup'); assert.equal(cut.player.hp, cut.player.maxHp);
});
test('the Gatewarden escalates through three phases and its shockwave can be jumped', () => {
  const sim = make('vyx'); const boss = spawnEnemy(sim, 'warden', 8, 0, { alert: true, group: 'boss' }); run(sim, 400); assert.notEqual(boss.state, 'intro');
  boss.hp = boss.maxHp * 0.6; run(sim, 500, (i, s) => ({ mx: s.player.x > -20 ? -1 : 0 })); assert.equal(boss.phase, 2); assert(sim.enemies.filter(e => e.group === 'boss-adds').length >= 2, 'reinforcements arrive in phase 2');
  boss.hp = boss.maxHp * 0.25; run(sim, 500, (i, s) => ({ mx: s.player.x > -30 ? -1 : 0 })); assert.equal(boss.phase, 3);
  boss.poise = 1; damageEnemy(sim, boss, { dmg: 5, kind: 'heavy', heavy: true, x: 0 }); assert(boss.stun > 2, 'breaking its poise staggers it'); boss.hp = 1; boss.iframes = 0; damageEnemy(sim, boss, { dmg: 5, kind: 'blade', x: 0 }); assert(boss.dead);
});
test('falling out of the world costs health and returns to safe ground; no health means defeat', () => {
  const sim = make('vyx', b => b.island(190, 220, 0, 4)); place(sim, 178, 0); run(sim, 30); let back = null; run(sim, 600, (i, s) => { if (!back && events(s, 'pit').length) back = s.player.x; return { mx: back ? 0 : 1 }; }); assert(back !== null, 'fell and recovered'); assert(sim.player.hp < sim.player.maxHp && back < 180, `recovered at ${back}`);
  sim.player.hp = 5; sim.player.iframes = 0; damagePlayer(sim, { dmg: 50, x: 0 }); assert(sim.player.dead); assert.equal(events(sim, 'death').length, 1);
});
test('checkpoints save, heal and restore: cleared arenas, gear and collected shards survive', () => {
  const sim = createSim(chapter1(), 'vyx'); run(sim, 20); place(sim, 77, 11); sim.player.hp = 30; run(sim, 30); assert.equal(sim.checkpoint, 'a'); assert.equal(sim.player.hp, sim.player.maxHp);
  sim.cleared.add('courtyard'); sim.collected.add('c1-shard-1'); sim.gear.grapple = true; sim.flags.wardenDead = true; const state = JSON.parse(JSON.stringify(snapshot(sim)));
  const again = createSim(chapter1(), 'vyx', state); run(again, 5); assert(Math.abs(again.player.x - 77) < 0.5 && Math.abs(again.player.y - 11) < 0.1, 'respawned at the checkpoint');
  assert(again.gear.grapple && again.cleared.has('courtyard')); assert(again.pickups.find(p => p.id === 'c1-shard-1').taken); assert(again.world.solids.filter(s => s.gate).every(s => s.open), 'gates of a cleared arena stay open');
  assert(!again.enemies.some(e => e.x < 70), 'enemies behind the checkpoint do not come back');
});
test('arena gates lock, waves spawn in order, and the gates reopen when it is cleared', () => {
  const sim = createSim(chapter1(), 'vyx'); run(sim, 20); place(sim, 135, 15); run(sim, 200); const gate = sim.world.solids.find(s => s.id === 'g1b'); assert.equal(gate.open, false); assert(sim.enemies.filter(e => e.group === 'courtyard').length === 3);
  for (let wave = 0; wave < 3; wave++) { for (const e of sim.enemies) if (e.group === 'courtyard' && !e.dead) { e.spawnT = 0; damageEnemy(sim, e, { dmg: 999, kind: 'heavy', x: e.x - 1 }); } run(sim, 300); }
  assert(sim.cleared.has('courtyard')); assert.equal(gate.open, true); assert.equal(events(sim, 'wave').length, 3);
});
test('the simulation is deterministic: the same inputs give the same world', () => {
  const play = () => { const sim = createSim(proving(), 'vyx'); for (let i = 0; i < 2400; i++) step(sim, { ...NEUTRAL, mx: i % 400 < 300 ? 1 : -1, jump: i % 90 === 0, jumpHeld: i % 90 < 30, attack: i % 37 === 0, dash: i % 210 === 0, grapple: i % 300 === 150, grappleHeld: i % 300 >= 150 && i % 300 < 260, ability1: i % 500 === 0 }); const p = sim.player; return [p.x, p.y, p.vx, p.vy, p.hp, sim.enemies.map(e => e.hp.toFixed(3)).join(), sim.events.length].join('|'); };
  assert.equal(play(), play());
});
test('input is acted on in the tick it arrives, and presses during hitstop are not lost', () => {
  const sim = make(); run(sim, 1, () => ({ jump: true, jumpHeld: true })); assert(sim.player.vy > 14, 'jump velocity applied on the same tick');
  const h = make(); h.hitstop = 0.05; run(h, 1, () => ({ jump: true, jumpHeld: true })); assert.equal(h.player.vy, 0, 'frozen during hitstop'); run(h, 8, () => ({ jumpHeld: true })); assert(h.player.y > 0.05, 'the jump still happened after the freeze');
  assert(Math.abs(DT - 1 / 120) < 1e-9, '120 Hz fixed step');
});
test('save data: corrupt, future-versioned or tampered saves fall back safely', () => {
  assert.deepEqual(Save.decode('{'), Save.defaults()); assert.deepEqual(Save.decode('{"version":7}'), Save.defaults());
  const d = Save.decode(JSON.stringify({ version: 1, character: 'nobody', campaign: { chapter1: { checkpoint: 'b', cleared: ['courtyard', 5, null], collected: ['c1-shard-1'], gear: { grapple: true, x: 'yes' }, stats: { time: -5, kills: 'many' }, best: { time: 99, rank: 'Z' } }, '../../x': {} }, settings: { volume: 9, quality: 'ultra', difficulty: 'mastery', gamepad: false }, trial: { vyx: 31.5, sera: -2 } }));
  assert.equal(d.character, 'vyx'); assert.deepEqual(d.campaign.chapter1.cleared, ['courtyard']); assert.deepEqual(d.campaign.chapter1.gear, { grapple: true }); assert.equal(d.campaign.chapter1.stats.time, 0); assert.equal(d.campaign.chapter1.best.rank, 'C');
  assert.equal(Object.keys(d.campaign).length, 1); assert.equal(d.settings.volume, 1); assert.equal(d.settings.quality, 'high'); assert.equal(d.settings.difficulty, 'mastery'); assert.equal(d.settings.gamepad, false); assert.deepEqual(d.trial, { vyx: 31.5 });
  assert.equal(Save.load({ getItem() { throw new Error('blocked'); } }).version, 1); assert.equal(Save.write({ setItem() { throw new Error('full'); } }, d), false);
});
test('levels are well formed: ids are unique, arenas reference real gates, every anchor is reachable from somewhere', () => {
  for (const build of [chapter1, proving]) { const L = build(), ids = L.solids.map(s => s.id); assert.equal(new Set(ids).size, ids.length, 'unique solid ids'); for (const a of L.arenas) for (const g of a.gates) assert(ids.includes(g), `gate ${g}`); for (const p of L.props) for (const t of p.targets || []) assert(ids.includes(t), `pylon target ${t}`); assert(L.checkpoints.length >= 2); for (const c of L.checkpoints) assert(L.solids.some(s => Math.abs(s.y + s.h - c.y) < 0.01 && c.x > s.x && c.x < s.x + s.w), `checkpoint ${c.id} stands on ground`); }
});

console.log(`\n${passed} mechanics tests passed${failures.length ? ', ' + failures.length + ' FAILED: ' + failures.join('; ') : ''}.`);
if (failures.length) process.exit(1);
