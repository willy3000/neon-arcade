// Plays Chapter 1 start to finish with each hero using the simple bot, proving the authored route, the arenas,
// the boss and the grapple finale can all be completed. Run: node wildfall/tests/playthrough.test.mjs [hero] [--log]
import assert from 'node:assert/strict';
import { createSim } from '../sim/index.js';
import { build } from '../levels/chapter1.js';
import { runRoute } from './bot.mjs';

const mover = (sim, id) => sim.world.solids.find(s => (id ? s.id === id : s.move && Math.abs(s.y + s.h - 11) < 0.1));
const bridge = sim => mover(sim), lift = sim => sim.world.solids.find(s => s.move && Math.abs(s.y + s.h - 19) < 0.1);
export const ROUTE = [
  { x: 11.5, y: 0, name: 'crash site' }, { x: 15, y: 1.8, name: 'stone step' }, { x: 20, y: 0 }, { x: 28.5, y: 0, name: 'first gap' }, { x: 36, y: 0 }, { x: 40.5, y: 3.6, name: 'terrace' },
  { x: 51.6, y: 3.6, name: 'chimney floor' }, { x: 56.5, y: 11, name: 'chimney top', limit: 45 }, { x: 62, y: 11 }, { x: 77, y: 11, name: 'checkpoint a' },
  { x: 79.3, y: 11, tol: 0.5, name: 'bridge edge' },
  sim => ({ x: 79.3, y: 11, wait: true, until: s => bridge(s).x < 82.5, name: 'wait for platform' }),
  sim => ({ x: bridge(sim).x + 1.75, y: 11, until: s => s.player.ground === bridge(s), name: 'board platform', limit: 20 }),
  sim => ({ x: bridge(sim).x + 2.4, y: 11, ride: true, wait: true, until: s => bridge(s).x > 89.6, name: 'ride platform', limit: 20 }),
  { x: 98, y: 11, name: 'mid island' }, { x: 104.5, y: 13 }, { x: 109.5, y: 15 }, { x: 113.5, y: 15, name: 'before arch' }, { x: 125, y: 15, slide: true, name: 'slide arch' },
  { x: 135, y: 15, name: 'enter court' }, { x: 144, y: 15, until: s => s.cleared.has('courtyard'), limit: 200, name: 'gate court' }, { x: 162.5, y: 15, name: 'checkpoint b' },
  { x: 167.1, y: 15, tol: 0.6, air: true, until: s => s.player.vy > 12, name: 'step onto the bloom', limit: 15 }, { x: 171.5, y: 20.5, name: 'first bloom', limit: 25 }, { x: 173.4, y: 20.5, tol: 0.35 },
  sim => ({ x: 173.4, y: 20.5, wait: true, until: s => lift(s).x < 176.2 && lift(s).vx <= 0, name: 'wait for lift' }),
  sim => ({ x: lift(sim).x + 1.4, y: 19, walkOff: true, until: s => s.player.ground === lift(s), name: 'drop to lift', limit: 15 }),
  sim => ({ x: lift(sim).x + 2.2, y: 19, ride: true, wait: true, until: s => lift(s).x > 181.2, name: 'ride lift', limit: 20 }),
  { x: 186.2, y: 21, name: 'far ledge', limit: 15 }, { x: 188.6, y: 21, air: true, until: s => s.player.vy > 12, name: 'step onto the second bloom', limit: 15 }, { x: 194, y: 27, name: 'second bloom', limit: 25 },
  { x: 200, y: 27 }, { x: 211, y: 27, name: 'past the bulwark', limit: 120 }, { x: 221.5, y: 27 }, { x: 234.5, y: 26, name: 'flooded hall', limit: 120 }, { x: 238.2, y: 27 }, { x: 246.5, y: 27, name: 'barricade', limit: 90 }, { x: 248, y: 27, name: 'checkpoint c' },
  { x: 259, y: 27, name: 'enter boss' }, { x: 268, y: 27, until: s => s.cleared.has('warden'), limit: 400, name: 'the gatewarden' },
  { x: 288.6, y: 27, until: s => s.gear.grapple, name: 'grapple launcher', limit: 30 }, { x: 322, y: 24, swing: true, until: s => s.player.onGround && s.player.x > 319, limit: 90, name: 'sky-bridge' }, { x: 337.5, y: 24, name: 'the gate' },
];

const heroes = process.argv[2] && !process.argv[2].startsWith('-') ? [process.argv[2]] : ['vyx', 'sera', 'bragg'], log = process.argv.includes('--log');
for (const hero of heroes) {
  const sim = createSim(build(), hero, { difficulty: 'story' }); let lastGoal = -1;
  const result = runRoute(sim, ROUTE, { timeout: 900, onTick: s => { if (log) for (const ev of s.events.splice(0)) if (['checkpoint', 'arenaStart', 'arenaClear', 'bossPhase', 'pit', 'death', 'pickup', 'gear', 'complete'].includes(ev.type) && ev.kind !== 'mote' && ev.kind !== 'heal') console.log(`   ${s.stats.time.toFixed(1)}s ${ev.type} ${ev.id || ev.kind || ev.phase || ''} @ ${s.player.x.toFixed(0)},${s.player.y.toFixed(0)} hp ${s.player.hp.toFixed(0)}`); else if (!log) s.events.length = 0; } });
  console.log(`${hero}: ${result.ok && sim.ended ? 'COMPLETED' : 'FAILED'} in ${result.time.toFixed(1)}s of game time — kills ${sim.stats.kills}, hits taken ${sim.stats.hurt}, hp ${sim.player.hp.toFixed(0)}/${sim.player.maxHp}, techniques ${sim.stats.tech}${result.reason ? ' — ' + result.reason : ''}`);
  assert(result.ok && sim.ended, `${hero} could not finish Chapter 1: ${result.reason || 'route ended before the gate'}`);
  assert(sim.gear.grapple, 'grapple launcher earned'); assert(sim.cleared.has('courtyard') && sim.cleared.has('warden'));
}
console.log(`Chapter 1 completed by ${heroes.join(', ')} with the route bot.`);
