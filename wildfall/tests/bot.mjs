// A simple player that reads the simulation and presses buttons, used to prove routes are completable by every hero.
// It is deliberately unskilled: it runs at the next waypoint, jumps when it must, and swings at whatever is in reach.
import { step, NEUTRAL } from '../sim/index.js';
import { groundBelow, wallAt, clearLine } from '../sim/world.js';
import { findGrappleTarget } from '../sim/player.js';

export function createBot() { return { jumpHeld: false, was: {}, stuckT: 0, lastX: 0, swingT: 0, grapple: false, attackT: 0 }; }

// Returns the input for this tick while heading for `goal` ({ x, y, ... }).
export function think(sim, bot, goal) {
  const p = sim.player, w = sim.world, dt = sim.dt, dx = goal.x - p.x, dy = goal.y - p.y, dir = Math.sign(dx) || p.facing, inp = { ...NEUTRAL };
  const press = name => { inp[name] = true; };
  const foes = sim.enemies.filter(e => !e.dead && e.spawnT <= 0 && e.type !== 'dummy' && Math.abs(e.y - p.y) < 6 && Math.abs(e.x - p.x) < 16 && (e.alert || Math.abs(e.x - p.x) < 7));
  const foe = foes.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  bot.attackT -= dt;

  // Breakable obstacles in the way get hit until they give.
  const want = foe && !goal.ignoreFoes && Math.abs(foe.x - p.x) < 9 ? Math.sign(foe.x - p.x) || dir : dir;
  const block = w.solids.find(s => s.hp && !s.dead && !s.temp && Math.abs(s.x + s.w / 2 - (p.x + want * 1.2)) < 1.6 && s.y < p.y + 1.5 && s.y + s.h > p.y + 0.5);
  if (block && Math.sign(block.x + block.w / 2 - p.x) === want && (want !== dir || Math.abs(dx) > 1)) { inp.mx = want * 0.3; if (bot.attackT <= 0) { if (sim.charId === 'vyx' && block.material === 'stone') { inp.heavyHeld = (bot.charge = (bot.charge || 0) + dt) < 1; if (bot.charge === dt) press('heavy'); if (!inp.heavyHeld) { bot.charge = 0; bot.attackT = 0.6; } } else { press(sim.charId === 'bragg' || block.material === 'stone' ? 'heavy' : 'attack'); bot.attackT = sim.charId === 'bragg' ? 0.8 : 0.5; } } return inp; }

  // Fighting takes priority when something hostile is close or an arena has locked.
  if (foe && (sim.arenaBounds || Math.abs(foe.x - p.x) < 9) && !goal.ignoreFoes) {
    const fx = foe.x - p.x, afx = Math.abs(fx), threat = foe.state === 'attack' && foe.attack && foe.stateT > foe.attack.windup - 0.3 && foe.stateT < foe.attack.windup + foe.attack.active + 0.1, reach = sim.charId === 'sera' ? 8 : 2.3 + foe.hw;
    inp.mx = afx > reach * 0.8 ? Math.sign(fx) : sim.charId === 'sera' && afx < 3.5 ? -Math.sign(fx) : 0;
    if (Math.sign(fx) !== p.facing && afx < reach && !inp.mx) inp.mx = Math.sign(fx) * 0.5;
    const safe = d => !!groundBelow(w, p.x + d * 3.5, p.y, 2);
    if (threat && afx < (foe.def.boss ? 7 : 3.4)) { // get out of the way, but never off the island
      const away = -Math.sign(fx) || 1; inp.mx = safe(away) ? away : 0;
      if (p.onGround && p.dashCd <= 0 && inp.mx) press('dash'); else if (p.onGround) press('jump'); inp.jumpHeld = true; return inp;
    }
    if (foe.def.fly && sim.charId === 'sera') { // bolts fly level, so answer a flyer with lightning or an upward shot
      inp.mx = afx > 7 ? Math.sign(fx) : Math.sign(fx) !== p.facing ? Math.sign(fx) * 0.4 : 0; if (inp.mx && p.onGround && !safe(Math.sign(inp.mx))) inp.mx = 0;
      if (!(p.cooldowns.ability2 > 0) && afx < 9) press('ability2'); else if (bot.attackT <= 0 && afx < 9) { inp.my = foe.y > p.y + 1 ? 1 : 0; press('attack'); bot.attackT = 0.2; }
      return inp;
    }
    if (foe.fuse > 0 && afx < 4) { inp.mx = -Math.sign(fx); if (p.dashCd <= 0) press('dash'); return inp; }
    for (const pr of sim.projectiles) if (pr.owner === 'enemy' && pr.look === 'shock' && Math.abs(pr.x - p.x) < 2.6 && p.onGround) { press('jump'); inp.jumpHeld = true; }
    if (afx <= reach && Math.abs(foe.y - p.y) < 2.5 && bot.attackT <= 0) {
      if (foe.guarding && sim.charId === 'sera') { press(p.cooldowns.ability2 > 0 ? 'heavy' : 'ability2'); bot.attackT = 0.6; } // a shield stops bolts; lightning and blasts do not care
      else if (foe.guarding && p.onGround) { press('jump'); inp.jumpHeld = true; bot.diveAt = sim.time + 0.3; }
      else if (foe.def.fly && p.onGround) { press('jump'); inp.jumpHeld = true; press('attack'); bot.attackT = 0.14; }
      else { press(sim.time % 3 < 0.6 && !foe.def.boss ? 'heavy' : 'attack'); bot.attackT = 0.14; if (sim.charId === 'sera' && p.onGround) inp.my = foe.y < p.y - 0.5 ? -1 : foe.y > p.y + 1 ? 1 : 0; } // bolts can be angled up or down
    }
    if (foe.def.fly && foe.y > p.y + 1.5 && p.onGround && afx < 3) { press('jump'); inp.jumpHeld = true; }
    if (bot.diveAt && sim.time >= bot.diveAt && !p.onGround) { inp.my = -1; press('attack'); bot.diveAt = 0; }
    if (!p.onGround && foe.y > p.y - 1) { if (bot.attackT <= 0) { press('attack'); bot.attackT = 0.16; } inp.jumpHeld = p.vy > 0; }
    if (sim.charId === 'sera' && foes.length > 1 && !(p.cooldowns.ability2 > 0)) press('ability2');
    if (p.onGround && wallAt(w, p, Math.sign(inp.mx || 1)) && inp.mx) { press('jump'); inp.jumpHeld = true; }
    if (p.onGround && inp.mx && !inp.dash && !groundBelow(w, p.x + Math.sign(inp.mx) * (p.hw + 0.7), p.y, 1.6)) inp.mx = 0; // never back off a ledge mid-fight
    return inp;
  }

  // Grapple routes: latch, swing forward, let go on the way up.
  if (goal.swing && sim.gear.grapple) {
    inp.mx = dir; const target = findGrappleTarget(sim, { mx: dir, my: 1, aimX: dir * 0.5, aimY: 0.86 });
    if (p.mode === 'grapple' && bot.swingT > 1 && Math.abs(p.vx) < 0.6 && p.y < goal.y) { bot.swingT += dt; inp.grappleHeld = p.y < goal.y - 1.4; inp.my = 1; if (!inp.grappleHeld) { press('jump'); inp.jumpHeld = true; } return inp; } // pinned under a ledge: reel up, then hop off the rope
    if (p.mode === 'grapple') { // pump with the swing, then let go while rising toward the goal
      bot.swingT += dt; const rising = p.vy > 2.5 && Math.sign(p.vx) === dir && p.x * dir > p.rope.ax * dir + 0.6 && Math.abs(p.vx) > 4;
      inp.mx = Math.abs(p.vx) > 0.8 ? Math.sign(p.vx) : dir; inp.grappleHeld = !(rising && bot.swingT > 0.35); inp.aimX = dir * 0.5; inp.aimY = 0.86; return inp;
    }
    bot.swingT = 0; inp.aimX = dir * 0.5; inp.aimY = 0.86;
    if (p.rope) { inp.grappleHeld = true; return inp; }
    if (p.onGround) { if (!groundBelow(w, p.x + dir * 0.8, p.y, 1.5) || target) { press('jump'); inp.jumpHeld = true; } return inp; }
    inp.jumpHeld = p.vy > 0; if (target && target.target.x > p.x - 1 === dir > 0 && p.vy < 9) { press('grapple'); inp.grappleHeld = true; } else if (p.vy < -6 && p.airJumps > 0 && !target) { press('jump'); inp.jumpHeld = true; }
    return inp;
  }

  if (Math.abs(dx) > 0.35) inp.mx = dir;
  const ahead = groundBelow(w, p.x + dir * (p.hw + 0.5), p.y, 1.2), wall = wallAt(w, p, dir, 0.25), needUp = dy > 0.5;
  if (goal.wait && Math.abs(dx) < 0.6 && p.onGround) { inp.mx = 0; return inp; }
  if (p.onGround) {
    const edge = !ahead && Math.abs(dx) > 1, low = goal.slide && Math.abs(dx) > 1 && Math.abs(p.vx) > 5;
    if (low) { inp.my = -1; press('dash'); }
    else if (goal.drop && Math.abs(dx) < 0.5) { inp.my = -1; press('jump'); }
    else if (goal.walkOff) { /* step off the edge without jumping */ }
    else if ((needUp && Math.abs(dx) < (goal.reach ?? 6.5)) || edge || wall) { if (!(goal.ride && p.ground?.move && !edge)) { press('jump'); inp.jumpHeld = true; } }
  } else {
    if (goal.walkOff) { inp.my = -1; return inp; }
    inp.jumpHeld = p.vy > 0 || sim.charId === 'sera';
    const falling = p.vy < 1.5, short = p.y < goal.y + 0.4 || !groundBelow(w, p.x + dir * 1.5, p.y, 30);
    if (wall && needUp && p.vy < 6) { press('jump'); inp.jumpHeld = true; }
    else if (falling && short && p.airJumps > 0 && p.mode === 'normal') { press('jump'); inp.jumpHeld = true; }
    else if (falling && short && p.airJumps === 0 && p.airDashes > 0 && p.dashCd <= 0 && Math.abs(dx) > 2 && p.vy < -3) { press('dash'); inp.my = needUp ? 1 : 0; }
  }
  return inp;
}

// Runs the bot through a list of waypoints. Returns { ok, reached, time, reason }.
export function runRoute(sim, route, { timeout = 60, onTick } = {}) {
  const bot = createBot(); let i = 0, goalT = 0;
  for (let t = 0; t < timeout * 120; t++) {
    if (i >= route.length) return { ok: true, reached: i, time: sim.stats.time };
    const goal = typeof route[i] === 'function' ? route[i](sim) : route[i], p = sim.player; // a function waypoint follows something that moves
    const done = goal.until ? goal.until(sim) : Math.abs(p.x - goal.x) < (goal.tol ?? 0.9) && Math.abs(p.y - goal.y) < (goal.tolY ?? 0.6) && (p.onGround || goal.air);
    if (done) { i++; goalT = 0; continue; }
    goalT += sim.dt; if (goalT > (goal.limit ?? 40)) return { ok: false, reached: i, time: sim.stats.time, reason: `stuck heading for waypoint ${i} (${goal.name || goal.x + ',' + goal.y}) at ${p.x.toFixed(1)},${p.y.toFixed(1)} hp ${p.hp.toFixed(0)}` };
    step(sim, think(sim, bot, goal)); onTick?.(sim);
    if (p.dead) return { ok: false, reached: i, time: sim.stats.time, reason: `died heading for waypoint ${i} (${goal.name || goal.x + ',' + goal.y}) at ${p.x.toFixed(1)},${p.y.toFixed(1)}` };
    if (sim.ended) return { ok: true, reached: route.length, time: sim.stats.time };
  }
  return { ok: false, reached: i, time: sim.stats.time, reason: 'timeout at waypoint ' + i };
}
