// The movement controller: running, jumping, walls, slides, dashes, dives, ledges and the grapple.
import { PHYS, GRAPPLE, CHARACTERS } from '../config.js';
import { moveBody, wallAt, blocked, zoneAt, raycast, clamp, approach, sign, lerp, wrapAngle } from './world.js';

export const emit = (sim, type, data) => sim.events.push({ type, ...data });

export function createPlayer(charId, x, y) {
  const c = CHARACTERS[charId];
  return {
    char: c, x, y, vx: 0, vy: 0, hw: c.hw, h: c.h, facing: 1, mode: 'normal', modeT: 0, onGround: false, ground: null, wall: 0, hp: c.maxHp, maxHp: c.maxHp,
    coyote: 0, jumpBuffer: 0, dashBuffer: 0, airJumps: c.airJumps, airDashes: c.airDashes, dashCd: 0, wallLock: 0, wallCoyote: 0, lastWall: 0, wallRunLeft: c.wallRunTime, backRunReady: true,
    iframes: 0, hitstun: 0, dropTimer: 0, airTime: 0, jumping: false, gliding: false, wallSliding: false, landLock: 0, landT: 9, flow: 0, flowT: 0, rope: null, lastRelease: 9,
    action: null, buffered: null, bufferT: 0, chain: null, chainT: 9, charging: -1, cooldowns: {}, counterT: 0, dashAge: 9, shield: false, shieldT: 0, leaping: false,
    dead: false, safeX: x, safeY: y, speedPeak: 0, groundT: 0,
  };
}

export function tech(sim, name) {
  const p = sim.player;
  p.flow = Math.min(PHYS.flowMax, p.flow + 1); p.flowT = PHYS.flowTime; sim.stats.tech++;
  emit(sim, 'tech', { name, flow: p.flow });
}
export function refill(p) { p.airJumps = p.char.airJumps; p.airDashes = p.char.airDashes; p.wallRunLeft = p.char.wallRunTime; p.backRunReady = true; }
const runCap = p => p.char.runSpeed * (1 + p.flow * PHYS.flowSpeed);
const canCancel = p => !p.action || p.action.t >= p.action.def.cancel;
const stand = (sim, p) => { if (p.h === p.char.h) return true; if (blocked(sim.world, { x: p.x - p.hw, y: p.y + 0.02, w: p.hw * 2, h: p.char.h - 0.04 })) return false; p.h = p.char.h; return true; };

function setMode(p, mode) { p.mode = mode; p.modeT = 0; }

function jump(sim, speed, kind) {
  const p = sim.player, g = p.ground;
  p.vy = speed + (g ? Math.max(0, g.vy * 0.6) : 0); if (g) p.vx += g.vx; // moving platforms hand over their momentum
  p.jumping = true; p.onGround = false; p.ground = null; p.coyote = 0; p.jumpBuffer = 0; p.wallCoyote = 0;
  emit(sim, 'jump', { kind });
}

function settle(sim, r, wasGround, impact, inp) {
  const p = sim.player;
  if (r.down) {
    // Sky blooms sit flush with the ground, so look for one under the feet rather than trusting which solid stopped the fall.
    const s = sim.world.solids.find(b => b.bounce && !b.dead && p.x > b.x - 0.15 && p.x < b.x + b.w + 0.15 && Math.abs(b.y + b.h - p.y) < 0.03) || r.ground;
    if (s.bounce) {
      const dive = p.mode === 'dive';
      p.vy = s.bounce * (inp.jumpHeld ? PHYS.bounceHoldBonus : 1) * (dive ? 1.22 : 1); p.onGround = false; p.ground = null; p.jumping = false; refill(p);
      if (dive) setMode(p, 'normal');
      emit(sim, 'bounce', { x: p.x, y: p.y, solid: s.id }); if (dive || p.flow > 0) tech(sim, dive ? 'dive bounce' : 'bounce chain');
      return;
    }
    if (!wasGround) { emit(sim, 'land', { speed: -impact, x: p.x, y: p.y, material: s.kind }); p.landT = 0; if (p.leaping) { p.leaping = false; p.slamLanded = true; } }
    p.onGround = true; p.ground = s; p.vy = 0; p.coyote = PHYS.coyote; p.jumping = false; p.airTime = 0; refill(p);
    if (!s.move && !s.temp && !s.hp && !zoneAt(sim.world, 'hazard', p.x, p.y + 0.3)) { p.safeX = clamp(p.x, s.x + p.hw + 0.3, s.x + s.w - p.hw - 0.3); p.safeY = s.y + s.h; }
  } else { p.onGround = false; p.ground = null; p.airTime += sim.dt; }
}

function gravity(sim, inp, scale = 1) {
  const p = sim.player; let g = PHYS.gravity * p.char.gravityScale * scale;
  if (p.vy < 0) g *= PHYS.fallMult; else if (p.jumping && !inp.jumpHeld) g *= PHYS.lowJumpMult;
  if (!p.onGround && Math.abs(p.vy) < PHYS.apexSpeed && inp.jumpHeld) g *= PHYS.apexMult;
  p.vy = Math.max(p.vy - g * sim.dt, -PHYS.maxFall);
}

// ---- Grapple -------------------------------------------------------------------------------------------------------------
const hand = p => [p.x, p.y + p.h * 0.75];
const anchorPos = t => (t.hp !== undefined ? [t.x, t.y + t.h * 0.6] : [t.x, t.y]);

export function findGrappleTarget(sim, inp) {
  const p = sim.player, c = p.char, [hx, hy] = hand(p);
  let ax = inp.aimX, ay = inp.aimY;
  if (ax === undefined || (!ax && !ay)) { if (inp.mx || inp.my > 0) { ax = inp.mx; ay = inp.my > 0 ? inp.my : inp.mx ? 0.45 : 1; } else { ax = p.facing * 0.55; ay = 0.83; } }
  const aim = Math.atan2(ay, ax); let best = null, bestScore = Infinity;
  const consider = (target, enemy) => {
    const [tx, ty] = anchorPos(target), d = Math.hypot(tx - hx, ty - hy);
    if (d > c.grappleRange || d < 1.2) return;
    const off = Math.abs(wrapAngle(Math.atan2(ty - hy, tx - hx) - aim));
    if (off > GRAPPLE.cone || raycast(sim.world, hx, hy, tx, ty, target.solidRef)) return;
    const score = off + d / c.grappleRange * 0.35 + (enemy ? 0.15 : 0);
    if (score < bestScore) { best = { target, enemy }; bestScore = score; }
  };
  for (const a of sim.world.anchors) if (!a.off) consider(a, false);
  for (const e of sim.enemies) if (!e.dead && e.spawnT <= 0 && (e.def.anchor || c.chainPull)) consider(e, true);
  return best;
}

function fireGrapple(sim, inp) {
  const p = sim.player, found = findGrappleTarget(sim, inp);
  if (!found) { emit(sim, 'grappleMiss', {}); return; }
  const [tx, ty] = anchorPos(found.target);
  p.rope = { target: found.target, enemy: found.enemy, state: 'fly', t: 0, len: 0, ax: tx, ay: ty, taut: false };
  if (tx !== p.x) p.facing = sign(tx - p.x);
  emit(sim, 'grappleFire', { x: tx, y: ty });
}

function attach(sim) {
  const p = sim.player, c = p.char, rope = p.rope, [hx, hy] = hand(p), d = Math.hypot(rope.ax - hx, rope.ay - hy);
  if (d > c.grappleRange * 1.2 || raycast(sim.world, hx, hy, rope.ax, rope.ay, rope.target.solidRef)) { p.rope = null; emit(sim, 'grappleMiss', {}); return; }
  if (rope.enemy && c.chainPull) { // Bragg drags light enemies to him and hauls himself into heavy ones
    const e = rope.target, dx = (e.x - p.x) / (d || 1), dy = (e.y - p.y) / (d || 1);
    p.rope = null; emit(sim, 'chainPull', { x: e.x, y: e.y + e.h * 0.5, heavy: !!e.def.heavy });
    if (e.def.heavy) { p.dash = { dx, dy, speed: 25, time: Math.min(0.32, d / 25), rush: true }; setMode(p, 'dash'); p.dashAge = 0; }
    else { e.vx = -dx * 21; e.vy = 7.5; e.onGround = false; e.stun = Math.max(e.stun, 0.9); e.pulled = 0.6; sim.hooks.damageEnemy(sim, e, { dmg: 6, kind: 'kinetic', kb: [0, 0], stop: 0.05, x: p.x }); }
    return;
  }
  rope.state = 'taut'; rope.len = clamp(d, GRAPPLE.minLength, c.grappleRange); rope.taut = true;
  if (!p.onGround) { if (p.lastRelease < 1.3) tech(sim, 'grapple chain'); refill(p); }
  if (p.h !== c.h) stand(sim, p);
  setMode(p, 'grapple'); p.groundT = 0; p.action = p.action?.def.air ? p.action : null;
  emit(sim, 'grappleAttach', { x: rope.ax, y: rope.ay });
}

export function releaseGrapple(sim, jumped) {
  const p = sim.player, c = p.char; if (!p.rope) return;
  if (p.mode === 'grapple') {
    const speed = Math.hypot(p.vx, p.vy), angle = Math.atan2(p.vy, Math.abs(p.vx));
    const perfect = speed >= c.perfectSpeed && angle >= GRAPPLE.perfectMin && angle <= GRAPPLE.perfectMax;
    const boost = c.releaseBoost * (perfect ? GRAPPLE.perfectBoost : 1);
    p.vx *= boost; p.vy *= boost; if (jumped) { p.vy += GRAPPLE.releaseJump; p.jumpBuffer = 0; }
    setMode(p, 'normal'); p.jumping = false; p.lastRelease = 0;
    emit(sim, 'grappleRelease', { perfect, speed: Math.hypot(p.vx, p.vy) }); if (perfect) tech(sim, 'perfect release');
  }
  p.rope = null;
}

function stepRope(sim, inp) {
  const p = sim.player, rope = p.rope, t = rope.target;
  if (t.dead || t.off) { releaseGrapple(sim, false); return; }
  [rope.ax, rope.ay] = anchorPos(t);
  if (rope.state === 'fly') {
    if (!inp.grappleHeld) { p.rope = null; return; }
    rope.t += sim.dt; const [hx, hy] = hand(p);
    if (rope.t * GRAPPLE.hookSpeed >= Math.hypot(rope.ax - hx, rope.ay - hy)) attach(sim);
  }
}

function swing(sim, inp) {
  const p = sim.player, c = p.char, rope = p.rope, dt = sim.dt, wasGround = p.onGround;
  if (rope.enemy) rope.target.stun = Math.max(rope.target.stun, 0.25);
  if (!inp.grappleHeld) return releaseGrapple(sim, false);
  if (p.jumpBuffer > 0) return releaseGrapple(sim, true);
  if (inp.my) { // reeling in conserves angular momentum, so shortening the rope speeds the swing up
    const old = rope.len; rope.len = clamp(rope.len - inp.my * c.reelSpeed * dt, GRAPPLE.minLength, c.grappleRange);
    if (rope.taut && rope.len < old) { const f = old / rope.len; p.vx *= f; p.vy *= f; }
  }
  // On the ground the rope is just a leash: run normally, so a latched character can still take a run-up off a ledge.
  if (p.onGround) p.vx = approach(p.vx, inp.mx * c.runSpeed, (inp.mx ? PHYS.groundAccel : PHYS.groundDecel) * dt);
  // In the air, pumping adds speed only up to the character's limit; reeling in and gravity can still take it higher.
  else if (inp.mx && !(Math.hypot(p.vx, p.vy) > c.swingMax && sign(p.vx) === sign(inp.mx))) p.vx += inp.mx * c.swingAccel * dt;
  if (Math.abs(p.vx) > 1.5) p.facing = sign(p.vx);
  p.vy = Math.max(p.vy - PHYS.gravity * c.gravityScale * dt, -PHYS.maxFall);
  const damp = 1 - GRAPPLE.damping * dt; p.vx *= damp; p.vy *= damp;
  const speed = Math.hypot(p.vx, p.vy); if (speed > 34) { p.vx *= 34 / speed; p.vy *= 34 / speed; }
  const impact = p.vy, r = moveBody(sim.world, p, p.vx * dt, p.vy * dt);
  if ((r.left && p.vx < 0) || (r.right && p.vx > 0)) p.vx = 0; if (r.up && p.vy > 0) p.vy = 0;
  let [hx, hy] = hand(p), rx = hx - rope.ax, ry = hy - rope.ay, d = Math.hypot(rx, ry);
  rope.taut = d >= rope.len - 0.01;
  if (d > rope.len) {
    const nx = rx / d, ny = ry / d, fix = d - rope.len;
    moveBody(sim.world, p, -nx * fix, -ny * fix);
    const out = p.vx * nx + p.vy * ny; if (out > 0) { p.vx -= out * nx; p.vy -= out * ny; }
  }
  settle(sim, r, wasGround, impact, inp);
  if (p.mode !== 'grapple') return;
  if (p.onGround) { p.groundT += dt; if (p.groundT > GRAPPLE.groundDetach && !inp.mx) releaseGrapple(sim, false); } else p.groundT = 0;
  p.speedPeak = Math.max(p.speedPeak, Math.hypot(p.vx, p.vy));
}

// ---- Dash, slide, dive ---------------------------------------------------------------------------------------------------
function startDash(sim, inp, override) {
  const p = sim.player, c = p.char;
  let dx = inp.mx, dy = p.onGround ? 0 : inp.my;
  if (!dx && !dy) dx = p.facing;
  const n = Math.hypot(dx, dy); dx /= n; dy /= n;
  p.dashBuffer = 0; p.dashCd = c.dashCooldown; p.dashAge = 0; if (!p.onGround) p.airDashes--; if (dx) p.facing = sign(dx);
  p.iframes = Math.max(p.iframes, c.dashIframes); p.action = null; p.charging = -1; stand(sim, p);
  if (c.blink && !override) { // Sera steps through space instead of travelling across it
    const fromX = p.x, fromY = p.y; moveBody(sim.world, p, dx * c.blink, dy * c.blink * 0.8);
    p.vy = Math.max(p.vy, dy > 0 ? 6 : 1.5); p.jumping = false; if (dx) p.vx = dx * Math.max(Math.abs(p.vx), c.runSpeed);
    emit(sim, 'blink', { fromX, fromY, x: p.x, y: p.y }); return;
  }
  const speed = override?.speed ?? clamp(Math.max(c.dashSpeed, Math.hypot(p.vx, p.vy) + c.dashBoost), c.dashSpeed, 30);
  p.dash = { dx, dy, speed, time: override?.time ?? c.dashTime, grounded: p.onGround, ...override }; setMode(p, 'dash');
  emit(sim, 'dash', { dx, dy, phase: !!override?.phase });
}
export const phaseDash = (sim, inp, def) => startDash(sim, inp, def);

function dash(sim, inp) {
  const p = sim.player, c = p.char, d = p.dash, wasGround = p.onGround;
  p.vx = d.dx * d.speed; p.vy = d.dy * d.speed;
  const r = moveBody(sim.world, p, p.vx * sim.dt, p.vy * sim.dt);
  if (r.wall && (c.bullRush || d.rush)) sim.hooks.damageSolid(sim, r.wall, 'charge', 60);
  const hitWall = (r.left || r.right) && d.dx, end = p.modeT >= d.time || hitWall || (r.up && d.dy > 0) || (r.down && d.dy < 0);
  let ground = r.ground;
  if (d.dy === 0) { const y = p.y, probe = moveBody(sim.world, p, 0, -0.06); ground = probe.ground; if (!ground) p.y = y; } // a level dash has no downward motion to find the floor with
  if (ground) { p.onGround = true; p.ground = ground; p.coyote = PHYS.coyote; refill(p); } else if (wasGround) { p.onGround = false; p.ground = null; }
  if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0 || d.grounded) && d.dy === 0 && !d.phase) { // dash-jump keeps the burst as a long leap
    setMode(p, 'normal'); p.vx = d.dx * Math.max(c.runSpeed, d.speed * 0.82); jump(sim, c.jumpSpeed * 0.92, 'dash'); tech(sim, 'dash jump'); return;
  }
  if (end) {
    const keep = d.phase ? 0.5 : c.dashKeep;
    p.vx = hitWall ? 0 : d.dx * Math.max(d.dx ? c.runSpeed : 0, d.speed * keep); p.vy = d.dy > 0 ? d.dy * d.speed * 0.42 : d.dy < 0 ? d.dy * d.speed * 0.6 : 0;
    p.jumping = false; setMode(p, 'normal');
  }
}

function startSlide(sim) {
  const p = sim.player, c = p.char;
  p.dashBuffer = 0; p.dashCd = c.dashCooldown * 0.6; p.action = null; p.charging = -1;
  p.h = PHYS.slideHeight; p.vx = p.facing * Math.max(Math.abs(p.vx), c.runSpeed) * PHYS.slideBoost; setMode(p, 'slide'); emit(sim, 'slide', {});
}

function slide(sim, inp) {
  const p = sim.player, c = p.char, wasGround = p.onGround, dt = sim.dt, low = c.runSpeed * 0.62;
  p.vx = approach(p.vx, p.facing * low, 8.5 * dt); gravity(sim, inp);
  const impact = p.vy, r = moveBody(sim.world, p, p.vx * dt, p.vy * dt);
  settle(sim, r, wasGround, impact, inp);
  const fast = Math.abs(p.vx) > c.runSpeed;
  if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0) && stand(sim, p)) { setMode(p, 'normal'); jump(sim, c.jumpSpeed, 'slide'); if (fast) tech(sim, 'slide jump'); return; }
  if (!p.onGround && stand(sim, p)) { setMode(p, 'normal'); return; }
  if ((r.left || r.right) && stand(sim, p)) { p.vx = 0; setMode(p, 'normal'); return; }
  if ((p.modeT >= PHYS.slideTime || (inp.mx && sign(inp.mx) !== p.facing)) && stand(sim, p)) setMode(p, 'normal');
}

export function startDive(sim) {
  const p = sim.player; if (p.onGround || p.mode === 'dive') return false;
  if (p.rope) releaseGrapple(sim, false);
  p.action = null; p.charging = -1; p.vx *= 0.25; p.vy = -p.char.diveSpeed; p.diveHit = new Set(); setMode(p, 'dive'); emit(sim, 'dive', {});
  return true;
}

function dive(sim, inp) {
  const p = sim.player, wasGround = p.onGround;
  p.vy = -p.char.diveSpeed; p.vx = approach(p.vx, 0, 20 * sim.dt);
  const r = moveBody(sim.world, p, p.vx * sim.dt, p.vy * sim.dt);
  settle(sim, r, wasGround, -p.char.diveSpeed, inp);
  if (p.onGround) { p.slamLanded = true; p.landLock = 0.2; setMode(p, 'normal'); }
}

// ---- Walls ---------------------------------------------------------------------------------------------------------------
function wallJump(sim) {
  const p = sim.player, c = p.char, dir = p.lastWall, chained = p.modeT < 0.9 && p.wallJumps > 0;
  p.vx = -dir * PHYS.wallJumpX; p.vy = c.wallJumpY; p.facing = -dir; p.wallLock = PHYS.wallJumpLock; p.jumping = true; p.jumpBuffer = 0; p.wallCoyote = 0;
  p.airDashes = c.airDashes; p.backRunReady = true; p.wallJumps = (p.wallJumps || 0) + 1; setMode(p, 'normal');
  emit(sim, 'jump', { kind: 'wall', dir }); if (chained) tech(sim, 'wall chain');
}

function wallRun(sim, inp) {
  const p = sim.player, c = p.char, dir = p.lastWall, dt = sim.dt;
  p.wallRunLeft -= dt; p.vx = 0; p.vy = c.wallRunSpeed * (1 - 0.6 * (1 - p.wallRunLeft / c.wallRunTime));
  if (p.jumpBuffer > 0) { wallJump(sim); p.vy = c.wallJumpY * 1.08; tech(sim, 'wall-run jump'); return; }
  const r = moveBody(sim.world, p, dir * 0.02, p.vy * dt);
  p.airTime += dt;
  if (!wallAt(sim.world, p, dir)) { p.vx = dir * 4.5; p.vy = Math.max(p.vy, 7); p.jumping = false; setMode(p, 'normal'); return; } // crest the top of the wall
  if (p.wallRunLeft <= 0 || r.up || sign(inp.mx) === -dir || inp.my < 0) { p.vy = Math.min(p.vy, 3); setMode(p, 'normal'); }
}

function backRun(sim, inp) {
  const p = sim.player, c = p.char, dt = sim.dt, dir = p.facing;
  p.vx = dir * Math.max(Math.abs(p.vx), c.runSpeed * 1.04); p.vy = Math.max(p.vy - PHYS.gravity * 0.15 * dt, -3.2);
  if (p.jumpBuffer > 0) { setMode(p, 'normal'); p.vy = c.jumpSpeed * 0.96; p.jumping = true; p.jumpBuffer = 0; emit(sim, 'jump', { kind: 'wallrun' }); tech(sim, 'wall-run jump'); return; }
  const r = moveBody(sim.world, p, p.vx * dt, p.vy * dt); p.airTime += dt;
  if (r.down) { settle(sim, r, false, p.vy, inp); setMode(p, 'normal'); return; }
  if (p.modeT >= c.backRunTime || r.left || r.right || sign(inp.mx) !== dir || inp.my < 0 || !zoneAt(sim.world, 'wallrun', p.x, p.y + p.h * 0.5)) { p.jumping = false; setMode(p, 'normal'); }
}

function mantle(sim) {
  const p = sim.player, m = p.mantle, t = p.modeT / PHYS.mantleTime;
  p.y = lerp(m.y0, m.y1, clamp(t / 0.6, 0, 1)); p.x = lerp(m.x0, m.x1, clamp((t - 0.4) / 0.6, 0, 1)); p.vx = 0; p.vy = 0;
  if (t >= 1) { p.x = m.x1; p.y = m.y1; p.vx = m.dir * 3; setMode(p, 'normal'); }
}

// ---- Default locomotion --------------------------------------------------------------------------------------------------
function normal(sim, inp) {
  const p = sim.player, c = p.char, w = sim.world, dt = sim.dt, wasGround = p.onGround, act = p.action;
  let mx = p.wallLock > 0 || p.landLock > 0 ? 0 : inp.mx;
  const scale = (act && p.onGround ? act.def.moveScale ?? 0.2 : 1) * (p.shield ? 0.4 : 1) * (p.charging >= 0 ? 0.55 : 1), cap = runCap(p) * scale;
  if (mx && !(act && act.t < act.def.cancel)) p.facing = sign(mx);
  if (act && act.lunge !== undefined) { p.vx = p.facing * act.lunge; mx = 0; }
  else if (p.onGround) {
    if (mx) p.vx = Math.abs(p.vx) > cap && sign(p.vx) === sign(mx) ? approach(p.vx, mx * cap, (scale < 1 ? PHYS.groundDecel : PHYS.momentumDecay) * dt) : approach(p.vx, mx * cap, PHYS.groundAccel * dt);
    else p.vx = approach(p.vx, 0, PHYS.groundDecel * dt);
  } else {
    if (mx && (sign(p.vx) !== sign(mx) || Math.abs(p.vx) < cap)) p.vx = approach(p.vx, mx * cap, PHYS.airAccel * dt);
    if (Math.abs(p.vx) > cap) p.vx -= (p.vx - sign(p.vx) * cap) * PHYS.airDrag * dt;
  }
  gravity(sim, inp);
  p.gliding = !!c.glideFall && !p.onGround && p.vy < 0 && inp.jumpHeld && p.airTime > 0.2 && !act;
  if (p.gliding) p.vy = Math.max(p.vy, -c.glideFall);
  if (act && !p.onGround && act.def.hover !== undefined && p.vy < 0) p.vy = Math.max(p.vy, -act.def.hover);
  if (p.shield && !p.onGround) p.vy = Math.max(p.vy, -9);

  // Walls: slide down them, kick off them, and (Vyx) run up them.
  p.wall = 0; p.wallSliding = false;
  if (!p.onGround) {
    const right = wallAt(w, p, 1), left = wallAt(w, p, -1);
    if (right || left) { p.lastWall = right && (mx > 0 || !left) ? 1 : -1; p.wallCoyote = PHYS.wallCoyote; }
    if ((right && mx > 0) || (left && mx < 0)) {
      p.wall = sign(mx);
      if (c.wallRunTime && p.wallRunLeft > 0.08 && !act && (inp.my > 0 || p.vy > 1.5)) { setMode(p, 'wallrun'); return; }
      if (p.vy < 0) { p.vy = Math.max(p.vy, -PHYS.wallSlide); p.wallSliding = true; }
    }
  } else p.wallJumps = 0;

  if (p.jumpBuffer > 0 && canCancel(p) && p.landLock <= 0) {
    if (inp.my < 0 && p.onGround && p.ground?.oneWay) { p.dropTimer = 0.24; p.jumpBuffer = 0; p.onGround = false; p.ground = null; }
    else if (p.onGround || p.coyote > 0) { p.action = null; jump(sim, c.jumpSpeed, 'ground'); }
    else if (p.wallCoyote > 0) { p.action = null; wallJump(sim); }
    else if (p.airJumps > 0) {
      p.airJumps--; p.vy = c.doubleJumpSpeed; p.jumping = true; p.jumpBuffer = 0; p.gliding = false;
      if (mx && sign(p.vx) !== sign(mx)) p.vx = mx * Math.min(cap, Math.abs(p.vx) + 2);
      emit(sim, 'jump', { kind: 'double', x: p.x, y: p.y });
    }
  }
  if (p.dashBuffer > 0 && p.dashCd <= 0 && canCancel(p) && p.landLock <= 0 && !p.shield) {
    if (p.onGround && (inp.my < 0 || inp.slide) && Math.abs(p.vx) > 2.5) { startSlide(sim); return; }
    if (p.onGround || p.airDashes > 0) { startDash(sim, inp); if (p.mode === 'dash') return; }
  }
  if (inp.slide && p.onGround && Math.abs(p.vx) > 2.5 && p.dashCd <= 0 && canCancel(p)) { startSlide(sim); return; }

  // The back-wall run: carry speed across marked walls while holding the run direction.
  if (!p.onGround && p.backRunReady && c.backRunTime > 0 && !act && mx && sign(mx) === sign(p.vx) && Math.abs(p.vx) >= 5 && inp.my >= 0 && p.vy < 9 && zoneAt(w, 'wallrun', p.x, p.y + p.h * 0.5)) {
    p.backRunReady = false; p.facing = sign(p.vx); p.vy = Math.max(p.vy, 3); setMode(p, 'backrun'); emit(sim, 'wallrun', {}); return;
  }

  const impact = p.vy, r = moveBody(w, p, p.vx * dt, p.vy * dt);
  if ((r.left && p.vx < 0) || (r.right && p.vx > 0)) p.vx = 0;
  if (r.up && p.vy > 0) p.vy = 0;
  settle(sim, r, wasGround, impact, inp);

  // Ledge recovery: a jump that falls just short still pulls the character up.
  if (!p.onGround && p.vy < 3.5 && p.wall && !act && p.mode === 'normal') {
    const s = wallAt(w, p, p.wall), rise = s ? s.y + s.h - p.y : 0;
    if (s && rise > 0.25 && rise <= PHYS.mantleReach) {
      const x1 = p.x + p.wall * (p.hw * 2 + 0.1), y1 = s.y + s.h;
      if (!blocked(w, { x: x1 - p.hw, y: y1 + 0.02, w: p.hw * 2, h: p.h - 0.1 }) && !blocked(w, { x: p.x - p.hw, y: y1 + 0.02, w: p.hw * 2, h: p.h - 0.1 })) {
        p.mantle = { x0: p.x, y0: p.y, x1, y1, dir: p.wall }; setMode(p, 'mantle'); refill(p); emit(sim, 'mantle', {});
      }
    }
  }
}

export function stepPlayer(sim, inp) {
  const p = sim.player, dt = sim.dt;
  p.modeT += dt; p.dashCd -= dt; p.wallLock -= dt; p.wallCoyote -= dt; p.iframes -= dt; p.dropTimer -= dt; p.landLock -= dt; p.landT += dt; p.dashAge += dt; p.counterT -= dt; p.lastRelease += dt;
  if (!p.onGround) p.coyote -= dt;
  p.jumpBuffer = inp.jump ? PHYS.jumpBuffer : p.jumpBuffer - dt;
  p.dashBuffer = inp.dash ? 0.12 : p.dashBuffer - dt;
  if (p.flow > 0) { p.flowT -= dt; if (p.flowT <= 0) { p.flow = 0; emit(sim, 'flowLost', {}); } }
  p.slamLanded = false;
  if (p.dead) { p.vy = Math.max(p.vy - PHYS.gravity * dt, -PHYS.maxFall); p.vx = approach(p.vx, 0, 20 * dt); const r = moveBody(sim.world, p, p.vx * dt, p.vy * dt); if (r.down) p.vy = 0; return; }
  if (p.hitstun > 0) {
    p.hitstun -= dt; const wasGround = p.onGround; gravity(sim, inp); p.vx = approach(p.vx, 0, (p.onGround ? 30 : 4) * dt);
    const impact = p.vy, r = moveBody(sim.world, p, p.vx * dt, p.vy * dt); if (r.left || r.right) p.vx = 0; settle(sim, r, wasGround, impact, inp); return;
  }
  if (p.rope) stepRope(sim, inp);
  if (inp.grapple && !p.rope && sim.gear.grapple && p.mode !== 'mantle' && p.mode !== 'dive' && !p.shield) fireGrapple(sim, inp);
  switch (p.mode) {
    case 'grapple': swing(sim, inp); break;
    case 'dash': dash(sim, inp); break;
    case 'slide': slide(sim, inp); break;
    case 'dive': dive(sim, inp); break;
    case 'wallrun': wallRun(sim, inp); break;
    case 'backrun': backRun(sim, inp); break;
    case 'mantle': mantle(sim); break;
    default: normal(sim, inp);
  }
  p.speedPeak = Math.max(p.speedPeak, Math.abs(p.vx));
}
