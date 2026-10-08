// Run with node test.cjs. Exercise the real game through its public UI/input.
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map(), listeners = {}, storage = new Map();
const context = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
function element(id) {
  if (!elements.has(id)) elements.set(id, { hidden: false, textContent: '', classList: { add() {}, remove() {} }, setAttribute() {}, focus() {}, addEventListener(name, fn) { listeners[`${id}:${name}`] = fn; }, getContext: () => context, setPointerCapture() {} });
  return elements.get(id);
}
let nextFrame, now = 0;
let seed = 42;
const seededMath = Object.create(Math);
seededMath.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const sandbox = { console, Math: seededMath, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2,
  document: { getElementById: element, addEventListener(name, fn) { listeners[name] = fn; }, hidden: false },
  localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
  requestAnimationFrame: fn => { nextFrame = fn; },
  addEventListener: (name,fn) => { listeners[name] = fn; } };
sandbox.window = sandbox;
// Instrument only the test copy to arrange precise collision/pickup scenarios.
const source = readFileSync('game.js', 'utf8').replace(/\}\)\(\);\s*$/, `
  window.testGame = {
    get lives() { return lives; }, get effects() { return { ...effects }; },
    get score() { return score; }, get collected() { return collected; },
    get obstacleCount() { return obstacles.length; }, get blastCooldown() { return blastCooldown; },
    obstacle(dx, dy) { obstacles.push({ x: player.x + dx, y: player.y + dy, w: 20, h: 20, shape: 'bar' }); },
    quiet() { obstacles = []; orbs = []; powerups = []; spawnClock = orbClock = powerupClock = 9999; },
    collide() { obstacles.push({ x: player.x, y: player.y, w: 34, h: 34, shape: 'bar' }); },
    pickup(type) { powerups.push({ type, x: player.x, y: player.y, r: 15, speed: 0 }); },
    energy(offset = 0) { orbs.push({ x: player.x + offset, y: player.y - 40, r: 7, speed: 145 }); }
  };
})();`);
vm.runInNewContext(source, sandbox);
function tick(seconds) { for (let i = 0; i < seconds * 120; i++) { now += 1000 / 120; nextFrame(now); } }
function key(k) { listeners.keydown({ key: k, repeat: false, preventDefault() {} }); }
assert.equal(element('menu').hidden, false);
assert.equal(element('game').width, 2560);
element('play').onclick(); tick(.5);
assert.equal(element('hud').hidden, false);
assert.ok(Number(element('score').textContent) >= 5);
key('p'); const pausedScore = element('score').textContent; tick(1);
assert.equal(element('paused').hidden, false);
assert.equal(element('score').textContent, pausedScore);
element('resume').onclick(); tick(.5);
assert.ok(Number(element('score').textContent) > Number(pausedScore));
listeners.blur(); assert.equal(element('paused').hidden, false);
element('pause-home').onclick(); assert.equal(element('menu').hidden, false);
element('mute').onclick(); assert.equal(storage.get('neon-rush-muted'), 'true');
key(' '); assert.equal(element('menu').hidden, true);
// Hold still until a collision, verifying end screen, persistence, and restart.
for (let i = 0; i < 120 && element('end').hidden; i++) tick(1);
assert.equal(element('end').hidden, false);
assert.ok(Number(element('final-score').textContent) > 0);
assert.equal(Number(storage.get('neon-rush-best')), Number(element('final-best').textContent));
element('again').onclick(); assert.equal(element('score').textContent, '000000');
assert.equal(element('end').hidden, true);
sandbox.innerWidth = 390; sandbox.innerHeight = 844; listeners.resize(); tick(.5);
assert.equal(element('game').width, 780);
assert.equal(element('hud').hidden, false);
console.log('PASS: menu, start, score, pause/resume, focus pause, mute, collision, best persistence, restart, high-DPI mobile resize.');

const game = sandbox.testGame;
element('again').onclick(); game.quiet();
assert.equal(game.lives, 5);
game.collide(); tick(1 / 60);
assert.equal(game.lives, 4); assert.equal(element('end').hidden, true);
game.collide(); tick(1 / 60); assert.equal(game.lives, 4, 'Recovery prevents repeated damage');
tick(1.6);
game.pickup('shield'); game.collide(); tick(1 / 60);
assert.equal(game.lives, 4, 'Same-step forcefield pickup blocks collision');
assert.ok(game.effects.shield > 7.9);
game.collide(); tick(1 / 60); assert.equal(game.lives, 4);
key('p'); const shieldTime = game.effects.shield; tick(2);
assert.equal(game.effects.shield, shieldTime, 'Pause freezes power-up timers');
element('resume').onclick();
game.pickup('shield'); tick(1 / 60); assert.ok(game.effects.shield > 7.9, 'Repeat pickup refreshes timer');
game.pickup('magnet'); game.pickup('double'); tick(1 / 60);
assert.ok(['shield', 'magnet', 'double'].every(type => game.effects[type] > 0), 'Different effects coexist');
const before = game.score; tick(.5); assert.ok(Math.abs(game.score - before - 12) < .3, 'Double survival score');
game.energy(120); tick(.7); assert.equal(game.collected, 1, 'Magnet pulls distant energy into collection');
tick(10.1); assert.ok(Object.values(game.effects).every(n => n === 0), 'Effects expire');
for (let remaining = 3; remaining >= 0; remaining--) {
  game.collide(); tick(1 / 60); assert.equal(game.lives, remaining);
  assert.equal(element('end').hidden, remaining > 0);
  if (remaining > 0) tick(1.6);
}
element('again').onclick(); assert.equal(game.lives, 5);
assert.ok(Object.values(game.effects).every(n => n === 0));
assert.equal(element('effect-shield').hidden, true);
assert.equal(element('lives').textContent, '♥♥♥♥♥');
game.quiet(); game.pickup('life'); tick(1 / 60);
assert.equal(game.lives, 5, 'Life pickups cannot exceed five lives');
assert.equal(element('announcement').textContent, 'LIVES FULL');
game.collide(); tick(1 / 60); assert.equal(game.lives, 4);
game.pickup('life'); tick(1 / 60);
assert.equal(game.lives, 5, 'Life pickup restores one heart');
assert.equal(element('lives').textContent, '♥♥♥♥♥');
assert.equal(element('announcement').textContent, '+1 LIFE');
assert.equal(game.effects.life, undefined, 'Instant life pickup has no effect timer');
console.log('PASS: life pickup restores health, updates HUD, respects five-life cap, and has no timed effect.');
console.log('PASS: five lives, recovery protection, forcefield pickup/refresh/expiry, paused timers, concurrent power-ups, double score, magnet collection, fifth-hit game over, restart resets.');

element('again').onclick(); game.quiet(); game.obstacle(0, -105);
key(' '); assert.equal(game.obstacleCount, 1, 'Cannot fire without a blaster pickup');
game.pickup('blaster'); tick(1 / 60);
assert.ok(game.effects.blaster > 11.9); assert.equal(element('fire').hidden, false);
game.obstacle(100, -105); // Edge intersects the blast, even with center outside radius.
game.obstacle(125, -105); // Outside blast.
game.obstacle(0, 25); // Behind the player.
key(' '); assert.equal(game.obstacleCount, 2, 'Space clears the blast circle including intersecting edges');
game.obstacle(0, -105); key(' ');
assert.equal(game.obstacleCount, 3, 'Recharge blocks rapid shots');
key('p'); const recharge = game.blastCooldown, duration = game.effects.blaster;
element('fire').onclick(); tick(1);
assert.equal(game.obstacleCount, 3, 'No shots while paused');
assert.equal(game.blastCooldown, recharge); assert.equal(game.effects.blaster, duration);
element('resume').onclick(); game.quiet(); tick(.6); game.obstacle(0, -105);
listeners['game:pointerdown']({ clientX: 195, pointerId: 1, button: 2 });
assert.equal(game.obstacleCount, 1, 'Right click does not shoot');
listeners['game:pointerdown']({ clientX: 195, pointerId: 1, button: 0 });
assert.equal(game.obstacleCount, 0, 'Left click shoots');
game.quiet(); tick(.6); game.obstacle(0, -105); element('fire').onclick();
assert.equal(game.obstacleCount, 0, 'Touch-accessible FIRE button shoots');
game.pickup('blaster'); tick(1 / 60); assert.ok(game.effects.blaster > 11.9, 'Pickup refreshes blaster duration');
game.quiet(); tick(12.1); game.obstacle(0, -105); key(' ');
assert.equal(game.obstacleCount, 1, 'Expired blaster cannot fire');
assert.equal(element('fire').hidden, true);
element('again').onclick(); assert.equal(game.blastCooldown, 0); assert.equal(game.effects.blaster, 0);
console.log('PASS: blaster pickup, blast radius/edges, forward-only destruction, recharge, pause, left click, Space, FIRE button, refresh, expiry, restart reset.');
