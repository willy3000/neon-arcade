// The combat engine: two fighters, their moves, hit detection, blocking, throws, projectiles, combos and meter.
// Nothing here knows about drawing or sound; it only emits events. One call to stepFight is exactly one frame.
import { RULES, STAGE, BUTTONS, NEUTRAL, clamp, sign, rng } from './constants.js';

const emit = (fight, type, data) => fight.events.push({ type, ...data });
const GROUND_FREE = new Set(['idle', 'walk', 'crouch', 'block']);
const grounded = f => f.y <= 0 && f.state !== 'air' && f.state !== 'airhit';
const crouched = f => f.state === 'crouch' || (f.state === 'block' && f.low) || (f.state === 'blockstun' && f.low) || (f.state === 'attack' && !!f.move?.crouch) || (f.state === 'hitstun' && f.low);

export function createFighter(def, side, x) {
  return {
    def, id: def.id, side, x, y: 0, vx: 0, vy: 0, push: 0, facing: side === 0 ? 1 : -1, state: 'idle', t: 0, hp: def.health, meter: 0, move: null, mf: 0, connected: false, seg: -1, used: null,
    stun: 0, low: false, combo: { hits: 0, damage: 0, juggle: 0, froze: false, ground: false, wall: false }, buf: Object.fromEntries(BUTTONS.map(b => [b, 99])), prev: { ...NEUTRAL }, inp: { ...NEUTRAL },
    tapF: 0, tapB: 0, wantDash: 0, blockAge: 99, airUsed: false, airSpecial: false, inv: 0, throwInv: 0, armor: def.ward?.max ?? 0, wardT: 0, status: { burn: 0, bleed: 0, bleedT: 0, chill: 0, freezeProof: 0 },
    grab: null, ko: false, heat: 0, dir: 0, lastDamage: 0, flash: 0,
  };
}

export function createFight(defA, defB, opts = {}) {
  const fight = { fighters: [createFighter(defA, 0, -170), createFighter(defB, 1, 170)], projectiles: [], objects: [], frame: 0, hitstop: 0, superFreeze: 0, cine: null, events: [], rand: rng(opts.seed ?? 7), opts, over: null, nextId: 1 };
  return fight;
}

// A move as it will actually be performed: the enhanced version overlays its changes on the base data.
function resolve(def, id, ex) { const m = def.moves[id]; if (!m) return null; return ex && m.ex ? { ...m, ...m.ex, id, enhanced: true } : { ...m, id }; }
const total = m => m.startup + m.active + m.recovery;
export const hurtbox = f => { const b = f.def.box, h = f.state === 'knockdown' ? 40 : crouched(f) ? b.crouch : f.state === 'air' || f.state === 'airhit' ? b.h * 0.82 : b.h, lift = f.state === 'air' || f.state === 'airhit' ? b.h * 0.1 : 0; return { x: f.x - b.w / 2, y: f.y + lift, w: b.w, h }; };
export const hitbox = (f, box) => ({ x: f.facing > 0 ? f.x + box[0] : f.x - box[0] - box[2], y: f.y + box[1], w: box[2], h: box[3] });
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const strikeInvuln = f => f.inv > 0 || f.state === 'knockdown' || f.state === 'getup' || f.state === 'ko' || f.state === 'cine' || f.state === 'thrown' || f.state === 'intro' || f.state === 'win' || (f.state === 'attack' && f.move?.invuln && f.mf >= f.move.invuln[0] && f.mf <= f.move.invuln[1]) || (f.state === 'dash' && f.dashInv > 0);

function setState(f, state) { f.state = state; f.t = 0; if (state !== 'attack') { f.move = null; } if (state === 'idle' || state === 'crouch' || state === 'walk') f.low = state === 'crouch'; }
function gain(fight, f, amount) { if (!fight.over) f.meter = clamp(f.meter + amount, 0, RULES.meterMax); }

function startMove(fight, f, o, id, ex) {
  const m = resolve(f.def, id, ex); if (!m) return false;
  if (m.limit && fight.projectiles.some(p => p.owner === f.side && p.kind === m.limit)) return false;
  if (m.heat && f.heat + m.heat > 100) { emit(fight, 'overheat', { side: f.side }); return false; }
  const cost = m.kind === 'super' ? RULES.superCost : m.enhanced ? RULES.exCost : m.cost || 0;
  if (f.meter < cost) return false;
  f.meter -= cost; if (m.heat) f.heat += m.heat;
  if (f.state === 'attack' && f.used) f.used.add(f.move.id); else f.used = new Set();
  f.state = 'attack'; f.t = 0; f.move = m; f.mf = 0; f.connected = false; f.blockedHit = false; f.whiffed = true; f.seg = -1; f.armorHits = undefined; f.fired = new Set(); f.dir = f.inp.fwd ? 1 : f.inp.back ? -1 : f.inp.up ? 2 : 0;
  if (grounded(f)) { f.vx = 0; if (o && !m.keepFacing) f.facing = sign(o.x - f.x) || f.facing; }
  if (m.air) { if (m.kind === 'special') f.airSpecial = true; else f.airUsed = true; }
  for (const b of m.uses || []) f.buf[b] = 99;
  if (m.kind !== 'normal' && m.kind !== 'throw') gain(fight, f, RULES.meterWhiff);
  if (m.kind === 'super') { fight.superFreeze = 42; emit(fight, 'super', { side: f.side, name: m.name, x: f.x, y: f.y + 110 }); }
  emit(fight, 'move', { side: f.side, id, kind: m.kind, name: m.name, sfx: m.sfx, ex: !!m.enhanced, x: f.x, y: f.y });
  return true;
}

// ---- Input ---------------------------------------------------------------------------------------------------------------
function readInput(f, raw, frozen) {
  const i = f.inp = { ...raw, fwd: f.facing > 0 ? raw.right : raw.left, back: f.facing > 0 ? raw.left : raw.right };
  for (const b of BUTTONS) f.buf[b] = raw[b] && !f.prev[b] ? 0 : f.buf[b] + (frozen ? 0 : 1); // a press made during hitstop waits, unaged, for the freeze to end
  f.blockAge = raw.B && !f.prev.B ? 0 : f.blockAge + 1;
  // Double-tap a direction to dash, or hold the dash button.
  const fwdEdge = i.fwd && !(f.facing > 0 ? f.prev.right : f.prev.left), backEdge = i.back && !(f.facing > 0 ? f.prev.left : f.prev.right);
  f.tapF--; f.tapB--; f.wantDash = 0;
  if (fwdEdge) { if (f.tapF > 0) f.wantDash = 1; f.tapF = RULES.dashWindow; f.tapB = 0; }
  if (backEdge) { if (f.tapB > 0) f.wantDash = -1; f.tapB = RULES.dashWindow; f.tapF = 0; }
  if (f.buf.D === 0) f.wantDash = i.back ? -1 : 1;
  f.prev = { ...raw };
}
const pressed = (f, b, window = RULES.buffer) => f.buf[b] <= window;
const use = (f, ...bs) => { for (const b of bs) f.buf[b] = 99; };

// Works out which move the held direction and pressed button ask for.
function chooseAttack(fight, f, o, air) {
  const d = f.def.moves, i = f.inp;
  if (pressed(f, 'S') && pressed(f, 'H', 4) && d.super && !air && f.meter >= RULES.superCost) { use(f, 'S', 'H'); return ['super', false]; }
  if (pressed(f, 'S')) {
    const id = air ? 'jS' : i.down ? '2S' : i.fwd ? '6S' : i.back ? '4S' : '5S';
    const pick = d[id] ? id : !air && d['5S'] ? '5S' : null;
    if (pick && !(air && f.airSpecial)) { use(f, 'S'); return [pick, i.X && !!d[pick].ex && f.meter >= RULES.exCost]; }
  }
  if (!air && (pressed(f, 'T') || (pressed(f, 'L', 2) && pressed(f, 'M', 2)))) { use(f, 'T', 'L', 'M'); return ['throw', false]; }
  for (const b of ['H', 'M', 'L']) {
    if (!pressed(f, b)) continue;
    const id = air ? 'j' + b : i.down ? '2' + b : i.fwd && d['6' + b] ? '6' + b : i.back && d['4' + b] ? '4' + b : '5' + b;
    if (d[id] && !(air && f.airUsed)) { use(f, b); return [id, false]; }
  }
  return null;
}

function think(fight, f, o) {
  const i = f.inp, d = f.def;
  if (fight.over || f.state === 'intro' || f.state === 'win' || f.state === 'ko') return;
  // Oath Break: spend meter to burst out of a combo.
  if ((f.state === 'hitstun' || f.state === 'airhit') && i.B && i.X && f.meter >= RULES.breakerCost && !f.grabbed && f.state !== 'frozen' && d.moves.breaker && f.combo.hits >= 2) {
    f.meter -= RULES.breakerCost; f.y = Math.max(f.y, 0); f.vy = 0; endCombo(fight, f); f.state = 'attack'; f.t = 0; f.move = resolve(d, 'breaker'); f.mf = 0; f.connected = false; f.seg = -1; f.fired = new Set(); f.used = new Set(); emit(fight, 'breaker', { side: f.side, x: f.x, y: f.y + 100 }); return;
  }
  if (GROUND_FREE.has(f.state)) {
    f.facing = sign(o.x - f.x) || f.facing; i.fwd = f.facing > 0 ? i.right : i.left; i.back = f.facing > 0 ? i.left : i.right;
    const pick = chooseAttack(fight, f, o, false);
    if (pick && startMove(fight, f, o, pick[0], pick[1])) return;
    if (f.wantDash && f.state !== 'block') { f.state = 'dash'; f.t = 0; f.dashDir = f.wantDash; const dd = f.wantDash > 0 ? d.dashF : d.dashB; f.dashInv = dd.inv || 0; emit(fight, 'dash', { side: f.side, dir: f.wantDash, x: f.x }); return; }
    if (i.B) { if (f.state !== 'block') setState(f, 'block'); f.low = i.down; f.vx = 0; return; }
    if (f.state === 'block') setState(f, 'idle');
    if (i.up) { setState(f, 'prejump'); f.jumpDir = i.fwd ? 1 : i.back ? -1 : 0; f.vx = 0; return; }
    if (i.down) { if (f.state !== 'crouch') setState(f, 'crouch'); f.vx = 0; return; }
    const slow = f.status.chill > 0 ? 0.7 : 1;
    if (i.fwd !== i.back) { if (f.state !== 'walk') setState(f, 'walk'); f.walkDir = i.fwd ? 1 : -1; f.vx = f.facing * (i.fwd ? d.walkF : -d.walkB) * slow; } else { if (f.state !== 'idle') setState(f, 'idle'); f.vx = 0; }
  } else if (f.state === 'air') {
    const pick = chooseAttack(fight, f, o, true); if (pick) startMove(fight, f, o, pick[0], pick[1]);
  } else if (f.state === 'attack') {
    // Cancels: a move that connected may flow into the next strength, a special, a super, a jump or a dash, as its data allows.
    const m = f.move, c = m.cancel, window = f.mf >= m.startup && f.mf < m.startup + m.active + Math.min(m.recovery, m.cancelLate ?? 8);
    if (m.follow && f.mf >= m.follow.from && f.mf < m.startup + m.active) for (const b of ['H', 'M', 'L', 'S']) if (m.follow[b] && pressed(f, b)) { use(f, b); if (startMove(fight, f, o, m.follow[b], false)) return; } // stances that branch into an attack
    if (m.feint && f.mf < m.startup - 3 && pressed(f, 'B', 2)) { use(f, 'B'); f.mf = total(m) - 8; emit(fight, 'feint', { side: f.side }); return; }
    if (!c || !f.connected || !window) return;
    const air = !grounded(f);
    if (c.includes('super') && pressed(f, 'S') && pressed(f, 'H', 4) && d.super && f.meter >= RULES.superCost && !air) { use(f, 'S', 'H'); startMove(fight, f, o, 'super', false); return; }
    if (c.includes('special') && pressed(f, 'S')) { const id = air ? 'jS' : i.down ? '2S' : i.fwd ? '6S' : i.back ? '4S' : '5S'; if (d.moves[id] && id !== m.id && !(air && f.airSpecial)) { use(f, 'S'); if (startMove(fight, f, o, id, i.X && !!d.moves[id].ex && f.meter >= RULES.exCost)) return; } }
    for (const b of ['M', 'H']) if (c.includes(b) && pressed(f, b)) { const id = air ? 'j' + b : i.down ? '2' + b : i.fwd && d.moves['6' + b] ? '6' + b : '5' + b; if (d.moves[id] && id !== m.id && !f.used.has(id)) { use(f, b); if (startMove(fight, f, o, id, false)) return; } }
    if (c.includes('jump') && i.up && !air && !f.blockedHit) { setState(f, 'prejump'); f.jumpDir = i.fwd ? 1 : i.back ? -1 : 0; return; }
    if (c.includes('dash') && f.wantDash > 0 && !air) { f.state = 'dash'; f.t = 0; f.move = null; f.dashDir = 1; f.dashInv = 0; emit(fight, 'dash', { side: f.side, dir: 1, x: f.x }); }
  }
}

// ---- Frame advance -------------------------------------------------------------------------------------------------------
function land(fight, f, lag) { f.y = 0; f.vy = 0; f.vx = 0; f.airUsed = false; f.airSpecial = false; setState(f, 'land'); f.stun = lag; emit(fight, 'land', { side: f.side, x: f.x }); }
function endCombo(fight, f) { if (f.combo.hits > 0) emit(fight, 'comboEnd', { side: f.side, hits: f.combo.hits, damage: Math.round(f.combo.damage) }); if (f.combo.froze) f.status.freezeProof = RULES.freezeProof; f.combo = { hits: 0, damage: 0, juggle: 0, froze: false, ground: false, wall: false }; if (fight.opts.training && fight.opts.refill !== false) { f.hp = f.def.health; } }

function runEvents(fight, f, o) {
  const m = f.move;
  for (const e of m.events || []) {
    if (e.f !== f.mf || f.fired.has(e)) continue; f.fired.add(e);
    if (e.type === 'projectile') spawnProjectile(fight, f, { ...e.def, ...(m.enhanced && e.ex) });
    else if (e.type === 'teleport') {
      const to = e.to || (f.inp.up ? 'above' : f.inp.back ? 'away' : 'behind'), fromX = f.x, fromY = f.y; // decided by what is held when the teleport lands
      if (to === 'behind') { f.x = clamp(o.x + sign(o.x - f.x || f.facing) * (e.dist ?? 95), STAGE.left + 30, STAGE.right - 30); f.facing = sign(o.x - f.x) || f.facing; }
      else if (to === 'away') f.x = clamp(f.x - f.facing * (e.dist ? e.dist * 3 : 300), STAGE.left + 30, STAGE.right - 30);
      else if (to === 'above') { f.x = clamp(o.x - f.facing * 20, STAGE.left + 30, STAGE.right - 30); f.y = 210; f.vy = 0; f.facing = sign(o.x - f.x) || f.facing; }
      else if (to === 'forward') f.x = clamp(f.x + f.facing * e.dist, STAGE.left + 30, STAGE.right - 30);
      emit(fight, 'teleport', { side: f.side, fromX, fromY, x: f.x, y: f.y, look: e.look });
    } else if (e.type === 'object') spawnObject(fight, f, o, e.def);
    else if (e.type === 'fx') emit(fight, 'fx', { side: f.side, look: e.look, x: f.x + f.facing * (e.x || 0), y: f.y + (e.y || 0), dir: f.facing });
    else if (e.type === 'hop') { f.vy = e.vy; f.y = Math.max(f.y, 1); }
  }
}

function advance(fight, f, o) {
  const d = f.def; f.t++;
  if (f.inv > 0) f.inv--; if (f.throwInv > 0) f.throwInv--; if (f.flash > 0) f.flash--; if (f.heat > 0) f.heat = Math.max(0, f.heat - 0.28);
  // A ward (the boss's defence) restores one charge at a time, and only while its owner is not being combo'd.
  if (d.ward?.rage && !f.raged && f.hp <= d.health * d.ward.rageBelow && !f.ko && !fight.over) { f.raged = true; f.armor = d.ward.max; f.wardT = 0; emit(fight, 'rage', { side: f.side, x: f.x, y: f.y + 120 }); }
  if (d.ward && f.armor < d.ward.max && f.combo.hits === 0 && !f.ko && !fight.over && ++f.wardT >= (f.raged ? d.ward.rage : d.ward.every)) { f.wardT = 0; f.armor++; emit(fight, 'ward', { side: f.side, x: f.x, y: f.y + 120 }); }
  const s = f.status; if (s.freezeProof > 0) s.freezeProof--; if (s.chill > 0) s.chill--;
  if (s.burn > 0) { s.burn--; if (s.burn % 12 === 0 && f.hp > 1 && !fight.over) { f.hp = Math.max(1, f.hp - 4); emit(fight, 'burnTick', { side: f.side, x: f.x, y: f.y + 110 }); } }
  if (s.bleedT > 0) { s.bleedT--; if (s.bleedT === 0) s.bleed = 0; else if (s.bleedT % 22 === 0 && f.hp > 1 && !fight.over) f.hp = Math.max(1, f.hp - s.bleed); }
  switch (f.state) {
    case 'prejump': if (f.t >= RULES.prejump) { f.state = 'air'; f.t = 0; f.vy = d.jump.vy; f.vx = f.facing * f.jumpDir * d.jump.vx; f.y = 0.01; emit(fight, 'jump', { side: f.side, x: f.x }); } break;
    case 'dash': { const dd = f.dashDir > 0 ? d.dashF : d.dashB, k = 1 - f.t / dd.frames; f.vx = f.facing * f.dashDir * dd.speed * (0.45 + k * 0.9); if (f.dashInv > 0) f.dashInv--; if (f.t >= dd.frames) { f.vx = 0; setState(f, 'idle'); } break; }
    case 'land': if (f.t >= f.stun) setState(f, 'idle'); break;
    case 'attack': {
      const m = f.move; f.mf++; runEvents(fight, f, o);
      if (m.motion) { let any = false; for (const [from, to, vx, vy] of m.motion) if (f.mf >= from && f.mf <= to) { f.vx = f.facing * vx; if (vy !== undefined) f.vy = vy; any = true; } if (!any && grounded(f)) f.vx *= 0.7; } else if (grounded(f)) f.vx *= 0.8;
      if (m.track && f.mf < m.startup) f.facing = sign(o.x - f.x) || f.facing;
      if (f.move && f.mf >= total(m)) { if (f.whiffed && m.kind !== 'throw') emit(fight, 'whiff', { side: f.side, id: m.id }); if (grounded(f)) { f.vx = 0; setState(f, f.inp.down && !m.kind.startsWith('s') ? 'crouch' : 'idle'); } else { f.state = 'air'; f.t = 0; f.move = null; } }
      break;
    }
    case 'hitstun': case 'blockstun': f.vx *= 0.84; if (--f.stun <= 0) { const wasBlock = f.state === 'blockstun'; f.vx = 0; if (!wasBlock) endCombo(fight, f); f.throwInv = RULES.throwProtect; setState(f, wasBlock && f.inp.B ? 'block' : 'idle'); if (wasBlock && f.inp.B) f.low = f.inp.down; } break;
    case 'frozen': f.vx = 0; if (--f.stun <= 0) { emit(fight, 'thaw', { side: f.side, x: f.x, y: f.y + 100 }); endCombo(fight, f); f.throwInv = RULES.throwProtect; setState(f, 'idle'); } break;
    case 'stagger': f.vx *= 0.8; if (--f.stun <= 0) { endCombo(fight, f); setState(f, 'idle'); } break;
    case 'knockdown': f.vx *= 0.8; if (f.ko) break; if (f.t >= RULES.knockdown) { setState(f, 'getup'); endCombo(fight, f); } break;
    case 'getup': if (f.t >= RULES.getup) { f.inv = RULES.wakeInvuln; f.throwInv = RULES.throwProtect + RULES.wakeInvuln; setState(f, 'idle'); } break;
    case 'throwing': {
      const g = f.grab; if (!g) { setState(f, 'idle'); break; }
      const v = g.victim; v.x = clamp(f.x + f.facing * g.hold, STAGE.left + 20, STAGE.right - 20); v.y = 0; v.vx = 0; v.vy = 0;
      if (!g.noTech && f.t <= RULES.throwTech && v.buf.T <= RULES.throwTech && v.buf.T < f.t + 3) { // the victim broke the throw
        f.grab = null; v.grabbed = false; for (const [who, dir] of [[f, -f.facing], [v, f.facing]]) { who.state = 'hitstun'; who.t = 0; who.move = null; who.stun = 16; who.vx = dir * 9; who.low = false; } use(v, 'T'); emit(fight, 'tech', { x: (f.x + v.x) / 2, y: 120 }); break;
      }
      if (f.t === g.at) {
        const dir = g.back ? -f.facing : f.facing; f.grab = null; v.grabbed = false; if (g.back) v.x = clamp(f.x - f.facing * 40, STAGE.left + 20, STAGE.right - 20);
        damage(fight, f, v, { damage: g.damage, launch: g.launch, knockdown: true, kind: 'throw', level: 'throw', hitstop: 10, fx: g.fx || 'blunt', heavy: true, meter: 12, dirOverride: dir }, false);
      }
      if (f.t >= g.total) { f.grab = null; setState(f, 'idle'); }
      break;
    }
    case 'thrown': if (!f.grabbed) setState(f, 'idle'); break;
    case 'win': case 'intro': f.vx = 0; break;
  }
  // Gravity and landing.
  if (f.y > 0 || f.vy > 0) {
    const hang = f.state === 'attack' && f.move.hang && f.mf < f.move.startup + f.move.active;
    if (!hang) f.vy -= RULES.gravity * (f.state === 'airhit' ? 0.92 + f.combo.juggle * 0.06 : 1);
    f.y += f.vy;
    if (f.y <= 0 && f.vy <= 0) {
      if (f.state === 'airhit' || f.ko) {
        if (f.pendingBounce && !f.ko) { f.pendingBounce = false; f.y = 0.01; f.vy = 11; f.vx *= 0.5; emit(fight, 'bounce', { x: f.x, y: 0 }); }
        else { f.y = 0; f.vy = 0; f.state = f.ko ? 'ko' : 'knockdown'; f.t = 0; f.move = null; f.inv = 0; emit(fight, 'knockdown', { side: f.side, x: f.x }); }
      } else if (f.state === 'attack') { const m = f.move; if (m.landCancel === false && f.mf < total(m)) { f.y = 0; f.vy = 0; } else land(fight, f, m.landLag ?? RULES.landingAttack); }
      else if (f.state !== 'thrown' && f.state !== 'cine') land(fight, f, RULES.landing);
    }
  }
  f.x += f.vx + f.push; f.push *= 0.7; if (Math.abs(f.push) < 0.3) f.push = 0;
  // Wall bounce for moves that ask for it.
  if (f.state === 'airhit' && f.wallBounce && (f.x <= STAGE.left + 30 || f.x >= STAGE.right - 30)) { f.wallBounce = false; f.vx = -f.vx * 0.55; f.vy = Math.max(f.vy, 9); emit(fight, 'bounce', { x: f.x, y: f.y + 90, wall: true }); }
  f.x = clamp(f.x, STAGE.left + 30, STAGE.right - 30);
}

// ---- Damage and reactions -------------------------------------------------------------------------------------------------
function damage(fight, att, def, hit, counter) {
  const c = def.combo, scale = hit.unscaled ? 1 : Math.max(RULES.minScale, RULES.scaling[Math.min(c.hits, RULES.scaling.length - 1)]), bleed = 1 + def.status.bleed * 0.06;
  const dealt = hit.damage * scale * (counter ? RULES.counterDamage : 1) * bleed * (fight.opts.damageScale ?? 1);
  const live = !fight.over || fight.over.frame === fight.frame; // a trade on the killing frame can still be a double knockout
  if (live) def.hp = Math.max(0, def.hp - dealt);
  c.hits++; c.damage += dealt; def.lastDamage = dealt; def.flash = 4; def.grabbed = false;
  gain(fight, att, dealt * RULES.meterHit + (hit.meter || 0)); gain(fight, def, dealt * RULES.meterTaken);
  const dir = hit.dirOverride ?? (sign(def.x - att.x) || att.facing), airborne = def.y > 0 || def.state === 'airhit' || def.state === 'air';
  const st = hit.status || {}; if (st.burn) def.status.burn = Math.max(def.status.burn, st.burn); if (st.bleed) { def.status.bleed = Math.min(3, def.status.bleed + st.bleed); def.status.bleedT = 300; } if (st.chill) def.status.chill = Math.max(def.status.chill, st.chill);
  const wasLow = crouched(def); def.move = null; def.vx = 0; def.low = wasLow && !airborne && !hit.launch;
  const stun = Math.max(8, (hit.hitstun || 14) - Math.max(0, c.hits - RULES.stunDecayAfter) + (counter ? RULES.counterStun : 0));
  if (def.hp <= 0 && live && !def.ko && !fight.opts.training) {
    def.ko = true; def.state = 'airhit'; def.t = 0; def.vx = dir * 7; def.vy = 12; def.y = Math.max(def.y, 1); fight.over = fight.over ? { winner: -1, frame: fight.frame } : { winner: att.side, frame: fight.frame }; emit(fight, 'ko', { side: def.side, x: def.x, y: def.y + 100 });
  } else if (def.hp <= 0 && fight.opts.training) def.hp = 1;
  if (!def.ko) {
    if (st.freeze && !c.froze && def.status.freezeProof <= 0 && !airborne) { c.froze = true; def.state = 'frozen'; def.t = 0; def.stun = st.freeze; emit(fight, 'freeze', { side: def.side, x: def.x, y: def.y + 100 }); }
    else if (hit.launch || hit.knockdown || airborne) {
      const [lx, ly] = hit.launch || (airborne ? [3.5, 8] : [5, 6]);
      if (airborne) c.juggle += hit.juggle ?? 1;
      def.state = 'airhit'; def.t = 0; def.vx = dir * Math.abs(lx) * (hit.launch && lx < 0 ? -1 : 1); def.vy = ly; def.y = Math.max(def.y, 1);
      def.pendingBounce = hit.bounce === 'ground' && !c.ground; if (def.pendingBounce) c.ground = true; def.wallBounce = hit.bounce === 'wall' && !c.wall; if (def.wallBounce) c.wall = true;
    } else if (hit.stagger) { def.state = 'stagger'; def.t = 0; def.stun = hit.stagger; }
    else { def.state = 'hitstun'; def.t = 0; def.stun = stun; def.vx = dir * (hit.pushHit ?? 6); if (hit.pull) def.x = clamp(att.x + att.facing * hit.pull, STAGE.left + 30, STAGE.right - 30); }
  }
  // In the corner the attacker is the one who slides back.
  if (!hit.projectile && !hit.launch && (def.x <= STAGE.left + 34 || def.x >= STAGE.right - 34)) att.push = -dir * (hit.pushHit ?? 6) * 0.8;
  fight.hitstop = Math.max(fight.hitstop, hit.hitstop ?? (hit.heavy ? 9 : 5) + (counter ? 3 : 0));
  emit(fight, 'hit', { side: att.side, victim: def.side, x: def.x - dir * 14, y: (hit.y ?? def.y + (def.low ? 80 : 125)), damage: dealt, heavy: !!hit.heavy, fx: hit.fx || 'blunt', counter, kind: hit.kind, level: hit.level, combo: c.hits, dir, status: st, launch: !!hit.launch });
  return dealt;
}

function blocked(fight, att, def, hit) {
  const perfect = def.blockAge <= RULES.perfectGuard && def.state === 'block', chip = hit.kind === 'normal' || perfect ? 0 : hit.damage * RULES.chip, dir = sign(def.x - att.x) || att.facing;
  if (!fight.over) def.hp = Math.max(1, def.hp - chip);
  def.state = 'blockstun'; def.t = 0; def.stun = Math.max(4, (hit.blockstun || 10) - (perfect ? 5 : 0)); def.vx = dir * (hit.pushBlock ?? 5) * (perfect ? 0.5 : 1);
  if (!hit.projectile && (def.x <= STAGE.left + 34 || def.x >= STAGE.right - 34)) att.push = -dir * (hit.pushBlock ?? 5) * 0.9;
  gain(fight, att, hit.damage * RULES.meterBlocked); gain(fight, def, hit.damage * RULES.meterBlocked * (perfect ? 4 : 1));
  fight.hitstop = Math.max(fight.hitstop, perfect ? 7 : hit.heavy ? 6 : 4);
  emit(fight, 'block', { side: def.side, attacker: att.side, x: def.x - dir * 30, y: def.y + (def.low ? 70 : 125), heavy: !!hit.heavy, perfect, chip, fx: hit.fx });
}

// Decides what a strike does to its target. Returns 'hit', 'block', 'whiff', 'armor', 'counter' or 'parry'.
function strike(fight, att, def, hit) {
  if (strikeInvuln(def) || def.grabbed) return 'whiff';
  if ((def.state === 'airhit') && def.combo.juggle >= RULES.juggleMax) { def.inv = 30; emit(fight, 'juggleLimit', { side: def.side, x: def.x, y: def.y + 100 }); return 'whiff'; }
  if (hit.level === 'high' && crouched(def) && def.state !== 'hitstun') return 'whiff';
  const m = def.state === 'attack' ? def.move : null;
  if (m && m.counter && def.mf >= m.counter.from && def.mf <= m.counter.to && (m.counter.catches.includes(hit.level)) && (!hit.projectile || m.counter.projectiles)) {
    fight.hitstop = 12; emit(fight, m.counter.parry ? 'parry' : 'counter', { side: def.side, x: def.x + def.facing * 40, y: def.y + 120 }); gain(fight, def, 25);
    if (m.counter.parry) { if (!hit.projectile) { att.state = 'stagger'; att.t = 0; att.move = null; att.stun = m.counter.stagger; att.vx = 0; } def.vx = 0; setState(def, 'idle'); }
    else { def.facing = sign(att.x - def.x) || def.facing; def.move = resolve(def.def, m.counter.then); def.mf = 0; def.connected = false; def.seg = -1; def.fired = new Set(); def.inv = 10; }
    return 'counter';
  }
  if (def.armor > 0 && hit.kind === 'super') { def.armor = 0; def.wardT = 0; emit(fight, 'wardBreak', { side: def.side, x: def.x, y: def.y + 120 }); } // supers shatter a ward outright
  if (!hit.breaksArmor && (def.armor > 0 || (m && m.armor && def.mf >= m.armor.from && def.mf <= m.armor.to && (def.armorHits = def.armorHits ?? m.armor.hits) > 0))) {
    if (def.armor > 0) { def.armor--; def.wardT = 0; } else def.armorHits--;
    if (!fight.over) def.hp = Math.max(1, def.hp - hit.damage * 0.5); def.flash = 4; fight.hitstop = Math.max(fight.hitstop, 6); gain(fight, att, hit.damage * 0.05);
    emit(fight, 'armor', { side: def.side, x: def.x, y: def.y + 120 }); return 'armor';
  }
  const guarding = (def.state === 'block' || def.state === 'blockstun') && hit.level !== 'throw' && !hit.unblockable && sign(att.x - def.x || -def.facing) === def.facing;
  if (guarding && !((hit.level === 'low' && !def.low) || (hit.level === 'overhead' && def.low))) { blocked(fight, att, def, hit); return 'block'; }
  const counter = !!m && def.mf < m.startup + m.active && !hit.projectile;
  damage(fight, att, def, hit, counter); return 'hit';
}

function resolveAttack(fight, f, o) {
  if (f.state !== 'attack') return;
  const m = f.move, a0 = m.startup, a1 = m.startup + m.active;
  if (f.mf < a0 || f.mf >= a1) return;
  if (m.level === 'throw') {
    if (f.connected) return;
    const can = Math.abs(o.x - f.x) <= (m.range ?? RULES.throwRange) && o.y <= 0 && o.throwInv <= 0 && !o.grabbed && ['idle', 'walk', 'crouch', 'block', 'dash', 'land', 'prejump'].includes(o.state) && !(o.state === 'dash' && o.dashInv > 0);
    if (!can) return;
    f.connected = true; f.whiffed = false; o.state = 'thrown'; o.t = 0; o.move = null; o.grabbed = true; o.vx = 0; o.facing = -f.facing;
    f.state = 'throwing'; f.t = 0; f.grab = { victim: o, back: f.inp.back && !m.command, at: m.throwAt ?? 20, total: m.throwTotal ?? 40, hold: m.hold ?? 58, damage: m.damage, launch: m.launch || [7, 9], noTech: !!m.command, fx: m.fx }; f.move = null; f.throwAnim = m.id;
    emit(fight, 'throw', { side: f.side, x: f.x, y: f.y + 110, command: !!m.command }); return;
  }
  if (!m.box) return;
  const seg = m.hits > 1 ? Math.floor((f.mf - a0) / (m.active / m.hits)) : 0; if (seg <= f.seg) return;
  if (!overlap(hitbox(f, m.box), hurtbox(o))) {
    // Decoys and other summoned things can soak up a strike.
    for (const ob of fight.objects) if (ob.owner !== f.side && ob.solid && overlap(hitbox(f, m.box), ob)) { f.seg = seg; hitObject(fight, ob, f); }
    return;
  }
  const result = strike(fight, f, o, { ...m, y: clamp(f.y + m.box[1] + m.box[3] / 2, o.y + 40, o.y + 190) });
  if (result === 'whiff') return;
  f.seg = seg; f.whiffed = false; f.connected = result === 'hit' || result === 'block' || result === 'armor'; f.blockedHit = result === 'block';
  if (result === 'hit' && m.cine && !o.ko && fight.over === null) startCine(fight, f, o, m);
  if (result === 'hit' && m.selfLaunch) { f.vy = m.selfLaunch; f.y = Math.max(f.y, 1); }
}

// The strike this fighter would land right now, if any; used so simultaneous hits trade instead of favouring one side.
function pendingStrike(f, o) { if (f.state !== 'attack') return null; const m = f.move; if (!m.box || m.level === 'throw' || f.mf < m.startup || f.mf >= m.startup + m.active || f.seg >= 0) return null; return overlap(hitbox(f, m.box), hurtbox(o)) ? m : null; }

// ---- Projectiles and summoned objects ---------------------------------------------------------------------------------------
function spawnProjectile(fight, f, def) {
  const p = { id: fight.nextId++, owner: f.side, kind: def.kind, look: def.look, x: f.x + f.facing * (def.x ?? 60), y: f.y + (def.y ?? 120), vx: f.facing * def.speed, vy: def.vy || 0, gravity: def.gravity || 0, w: def.w || 44, h: def.h || 30, life: def.life || 90, hits: def.hits || 1, gap: 0, t: 0, def, dir: f.facing };
  if (def.ground) p.y = (def.h || 30) / 2;
  fight.projectiles.push(p); emit(fight, 'projectile', { side: f.side, look: def.look, x: p.x, y: p.y, sfx: def.sfx });
}
function spawnObject(fight, f, o, def) {
  fight.objects = fight.objects.filter(ob => !(ob.owner === f.side && ob.type === def.type));
  const x = def.at === 'target' ? clamp(o.x, STAGE.left + 40, STAGE.right - 40) : clamp(f.x + f.facing * (def.x ?? 0), STAGE.left + 40, STAGE.right - 40);
  fight.objects.push({ id: fight.nextId++, owner: f.side, type: def.type, x: x - (def.w || 70) / 2, y: 0, w: def.w || 70, h: def.h || 180, cx: x, life: def.life, t: 0, def, solid: !!def.solid, facing: f.facing });
  emit(fight, 'object', { side: f.side, kind: def.type, x, y: 0 });
}
function hitObject(fight, ob, att) {
  ob.life = 0; emit(fight, 'shatter', { x: ob.cx, y: 100, kind: ob.type });
  const owner = fight.fighters[ob.owner], foe = fight.fighters[1 - ob.owner];
  if (ob.def.burst && Math.abs(foe.x - ob.cx) < ob.def.burst.range && !strikeInvuln(foe)) strike(fight, owner, foe, { ...ob.def.burst, projectile: true, kind: 'special' });
}
function stepProjectiles(fight) {
  const [a, b] = fight.fighters;
  for (const p of fight.projectiles) {
    if (p.life <= 0) continue; p.t++; p.life--; p.vy -= p.gravity; p.x += p.vx; p.y += p.vy; if (p.gap > 0) p.gap--;
    const box = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h }, foe = p.owner === 0 ? b : a, me = p.owner === 0 ? a : b;
    if (p.x < STAGE.left - 80 || p.x > STAGE.right + 80 || p.y < -20) { p.life = 0; continue; }
    for (const q of fight.projectiles) if (q !== p && q.life > 0 && q.owner !== p.owner && overlap(box, { x: q.x - q.w / 2, y: q.y - q.h / 2, w: q.w, h: q.h })) { p.hits--; q.hits--; if (q.hits <= 0) q.life = 0; emit(fight, 'clash', { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }); }
    for (const ob of fight.objects) if (ob.owner !== p.owner && ob.solid && ob.life > 0 && overlap(box, ob)) { p.hits = 0; hitObject(fight, ob, me); }
    if (p.hits <= 0) { p.life = 0; emit(fight, 'destroy', { x: p.x, y: p.y, look: p.look }); continue; }
    if (p.gap > 0 || p.t < (p.def.arm || 0) || !overlap(box, hurtbox(foe))) continue;
    const result = strike(fight, me, foe, { ...p.def, projectile: true, kind: 'special', y: clamp(p.y, foe.y + 40, foe.y + 180), fx: p.def.fx });
    if (result === 'whiff') continue;
    if (result === 'counter') { p.life = 0; continue; }
    p.hits--; p.gap = 8; if (p.hits <= 0) { p.life = 0; emit(fight, 'destroy', { x: p.x, y: p.y, look: p.look, hit: true }); }
  }
  if (fight.projectiles.some(p => p.life <= 0)) fight.projectiles = fight.projectiles.filter(p => p.life > 0);
  for (const ob of fight.objects) {
    if (ob.life <= 0) continue; ob.t++; ob.life--;
    const foe = fight.fighters[1 - ob.owner], owner = fight.fighters[ob.owner], z = ob.def.zone;
    if (z && ob.t >= (z.arm || 0) && ob.t % (z.every || 30) === 0 && Math.abs(foe.x - ob.cx) < ob.w / 2 + 20 && foe.y < (z.height ?? 60)) strike(fight, owner, foe, { ...z, projectile: true, kind: 'special' });
    if (ob.def.slow && Math.abs(foe.x - ob.cx) < ob.w / 2) foe.status.chill = Math.max(foe.status.chill, 8);
    if (ob.life <= 0) emit(fight, 'expire', { x: ob.cx, y: 80, kind: ob.type });
  }
  if (fight.objects.some(ob => ob.life <= 0)) fight.objects = fight.objects.filter(ob => ob.life > 0);
}

// ---- Super cinematics -------------------------------------------------------------------------------------------------------
function startCine(fight, att, def, m) {
  const c = m.cine; fight.cine = { att, def, t: 0, c, name: m.name, scale: Math.max(0.5, RULES.scaling[Math.min(Math.max(0, def.combo.hits - 1), RULES.scaling.length - 1)]) }; // the cinematic is scaled once, by the combo that led into it
  att.state = 'cine'; att.move = null; att.vx = 0; att.vy = 0; att.y = 0; def.state = 'cine'; def.move = null; def.vx = 0; def.vy = 0; def.y = 0; def.grabbed = false;
  def.x = clamp(att.x + att.facing * (c.gap ?? 110), STAGE.left + 40, STAGE.right - 40); att.x = def.x - att.facing * (c.gap ?? 110); def.facing = -att.facing;
  fight.projectiles = fight.projectiles.filter(p => p.owner === att.side && false); emit(fight, 'cineStart', { side: att.side, name: m.name, x: (att.x + def.x) / 2 });
}
function stepCine(fight) {
  const k = fight.cine, { att, def, c } = k; k.t++;
  for (const [frame, dmg, fx] of c.hits) if (frame === k.t) {
    const dealt = dmg * k.scale;
    def.hp = Math.max(c.hits[c.hits.length - 1][0] === frame ? 0 : 1, def.hp - dealt); def.combo.damage += dealt; def.combo.hits++; def.flash = 4;
    emit(fight, 'hit', { side: att.side, victim: def.side, x: def.x, y: 60 + ((frame * 37) % 110), damage: dealt, heavy: true, fx: fx || c.fx || 'blunt', cine: true, combo: def.combo.hits, dir: att.facing, status: {} });
  }
  if (k.t >= c.frames) {
    fight.cine = null; att.state = 'idle'; att.t = 0;
    if (def.hp <= 0 && !fight.opts.training) { def.ko = true; fight.over = { winner: att.side, frame: fight.frame }; emit(fight, 'ko', { side: def.side, x: def.x, y: 100 }); } else if (def.hp <= 0) def.hp = 1;
    def.state = 'airhit'; def.t = 0; def.vx = att.facing * (c.launch?.[0] ?? 9); def.vy = c.launch?.[1] ?? 12; def.y = 1; def.combo.juggle = RULES.juggleMax; emit(fight, 'cineEnd', { side: att.side });
  }
}

// ---- One frame --------------------------------------------------------------------------------------------------------------
export function stepFight(fight, inputs) {
  const [a, b] = fight.fighters; fight.frame++;
  const frozen = fight.superFreeze > 0 || fight.hitstop > 0; readInput(a, inputs[0] || NEUTRAL, frozen); readInput(b, inputs[1] || NEUTRAL, frozen);
  if (fight.superFreeze > 0) { fight.superFreeze--; return; }
  if (fight.hitstop > 0) { fight.hitstop--; return; } // presses made during the freeze stay in the buffer
  if (fight.cine) { stepCine(fight); return; }
  // Alternate who acts first so neither player has a standing advantage in simultaneous situations.
  const order = fight.frame % 2 ? [a, b] : [b, a];
  for (const f of order) think(fight, f, f === a ? b : a);
  for (const f of order) advance(fight, f, f === a ? b : a);
  // Fighters cannot stand inside each other.
  const ha = hurtbox(a), hb = hurtbox(b);
  if (overlap(ha, hb) && !a.grabbed && !b.grabbed && a.state !== 'cine' && !(a.state === 'attack' && a.move.passThrough) && !(b.state === 'attack' && b.move.passThrough)) {
    const dir = sign(b.x - a.x) || 1, depth = (ha.w + hb.w) / 2 - Math.abs(b.x - a.x), share = Math.min(depth / 2, 9);
    a.x = clamp(a.x - dir * share, STAGE.left + 30, STAGE.right - 30); b.x = clamp(b.x + dir * share, STAGE.left + 30, STAGE.right - 30);
  }
  if (Math.abs(b.x - a.x) > STAGE.maxGap) { const mid = (a.x + b.x) / 2, dir = sign(b.x - a.x); a.x = mid - dir * STAGE.maxGap / 2; b.x = mid + dir * STAGE.maxGap / 2; }
  // Both attacks are judged against the same positions, so two strikes on the same frame trade.
  const trade = pendingStrike(b, a); resolveAttack(fight, a, b);
  if (trade && b.state !== 'attack' && !strikeInvuln(a) && a.state !== 'thrown') strike(fight, b, a, { ...trade, y: a.y + 120 }); else resolveAttack(fight, b, a);
  stepProjectiles(fight);
  for (const f of [a, b]) if (fight.opts.training && fight.opts.infiniteMeter) f.meter = RULES.meterMax;
}

export { resolve as resolveMove, total as moveTotal, crouched, grounded, strikeInvuln };
