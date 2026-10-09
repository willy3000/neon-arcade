// Draws a fight: arena, shadows, both fighters, projectiles and every hit effect. It reads the engine's state and events and
// never changes them, so turning effects down in settings cannot alter a match.
import { solve, glow, line, inked, INK } from './rig.js';
import { drawFighter, SKINS } from './skins.js';
import { animate } from './anim.js';
import { drawArena, VIEW } from './arenas.js';
import { hurtbox, hitbox } from '../engine/fight.js';
import { STAGE } from '../engine/constants.js';

const { W, H, FLOOR } = VIEW, MAX_PARTICLES = 420;
const HIT = { blunt: ['#fff6c8', '#ffd24a'], slash: ['#ffffff', '#ffb3bd'], fire: ['#ffb347', '#ff5a1f'], ice: ['#e9fbff', '#8fe3ff'], heavy: ['#ffe9b0', '#ff9a3a'], rock: ['#d8c8b0', '#8a7a68'], burst: ['#bfe0ff', '#ffffff'], throw: ['#fff6c8', '#ffd24a'] };

export class FightView {
  constructor(canvas, settings) { this.canvas = canvas; this.g = canvas.getContext('2d'); this.settings = settings; this.reset(); }
  reset() { this.views = [{ trail: [] }, { trail: [] }]; this.p = []; this.rings = []; this.splats = []; this.texts = []; this.arcs = []; this.bolts = []; this.cam = { x: 0, zoom: 1 }; this.shake = 0; this.flash = 0; this.dark = 0; }
  resize() { const r = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr); }

  // ---- particles ----------------------------------------------------------------------------------------------------------
  add(type, x, y, vx, vy, life, size, color, grav = 0) { if (this.p.length >= MAX_PARTICLES) this.p.shift(); this.p.push({ type, x, y, vx, vy, life, max: life, size, color, grav }); }
  burst(type, x, y, n, speed, colors, o = {}) { for (let i = 0; i < n; i++) { const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2), s = speed * (0.4 + Math.random() * 0.9); this.add(type, x + (Math.random() - 0.5) * (o.jitter || 0), y + (Math.random() - 0.5) * (o.jitter || 0), Math.cos(a) * s, Math.sin(a) * s + (o.up || 0), (o.life ?? 22) * (0.6 + Math.random() * 0.7), (o.size ?? 5) * (0.6 + Math.random() * 0.8), colors[i % colors.length], o.grav ?? 0.5); } }
  ring(x, y, r, color, life = 14, width = 6) { this.rings.push({ x, y, r, color, life, max: life, width }); }
  text(x, y, text, color, size = 34) { this.texts.push({ x, y, text, color, size, life: 50, max: 50 }); }
  blood(x, y, dir, amount) {
    const level = this.settings.blood; if (level === 'off') return; const n = Math.round(amount * (level === 'reduced' ? 0.4 : 1));
    this.burst('drop', x, y, n, 7, ['#c0142c', '#8a0f20', '#e02a44'], { angle: dir > 0 ? 0.5 : Math.PI - 0.5, spread: 1.5, up: 3, grav: 0.55, life: 34, size: 5 });
  }

  // ---- events -------------------------------------------------------------------------------------------------------------
  handle(e, fight) {
    const s = this.settings, kick = v => { this.shake = Math.min(18, this.shake + v * s.shake); };
    switch (e.type) {
      case 'hit': {
        const c = HIT[e.fx] || HIT.blunt, big = e.heavy; this.views[e.victim].hitKind = e.y - fight.fighters[e.victim].y < 100 ? 'gut' : 'high';
        this.burst('spark', e.x, e.y, big ? 16 : 9, big ? 11 : 8, c, { life: 14, size: big ? 7 : 5, grav: 0.2 }); this.ring(e.x, e.y, big ? 70 : 42, c[0], big ? 14 : 10, big ? 8 : 5);
        if (e.fx === 'slash' || e.fx === 'blunt' || e.fx === 'heavy' || e.fx === 'throw') this.blood(e.x, e.y, e.dir, big ? 14 : 7);
        if (e.fx === 'fire') this.burst('ember', e.x, e.y, 14, 5, ['#ffb347', '#ff5a1f', '#ffe08a'], { up: 3, grav: -0.12, life: 30, size: 6 });
        if (e.fx === 'ice') this.burst('shard', e.x, e.y, 10, 8, ['#e9fbff', '#8fe3ff'], { life: 26, size: 8, grav: 0.45 });
        if (e.fx === 'heavy' || e.fx === 'rock') { this.burst('dust', e.x, e.y, 8, 4, ['#b8a890', '#8a7a68'], { life: 30, size: 16, grav: -0.02 }); }
        kick(big ? 9 : 4); if (e.cine) kick(5); if (big && !s.reducedFlash) this.flash = Math.max(this.flash, 0.22);
        if (e.counter) this.text(e.x, e.y + 70, 'COUNTER', '#ffd24a'); if (e.combo >= 3 && !e.cine) this.arcs.push({ combo: true });
        break;
      }
      case 'block': this.burst('spark', e.x, e.y, e.perfect ? 14 : 6, 7, e.perfect ? ['#ffffff', '#8fe3ff'] : ['#cfd8e6', '#8a98ad'], { life: 10, size: 4, grav: 0.1 }); this.ring(e.x, e.y, e.perfect ? 64 : 34, e.perfect ? '#bfe9ff' : '#aab6c8', 9, 4); if (e.perfect) this.text(e.x, e.y + 70, 'PERFECT', '#bfe9ff', 28); kick(e.heavy ? 3 : 1.5); break;
      case 'armor': { const ward = !!fight.fighters[e.side].def.ward; this.ring(e.x, e.y, 80, ward ? '#ff5a6e' : '#ffb347', 12, 7); this.text(e.x, e.y + 90, ward ? 'WARD' : 'ARMOUR', ward ? '#ff5a6e' : '#ffb347', 26); kick(4); break; }
      case 'ward': this.ring(e.x, e.y, 120, '#ff5a6e', 18, 5); break;
      case 'wardBreak': this.ring(e.x, e.y, 170, '#ffffff', 16, 10); this.burst('shard', e.x, e.y, 18, 10, ['#ff5a6e', '#ffd0d6'], { life: 28, size: 9, grav: 0.4 }); this.text(e.x, e.y + 100, 'WARD BROKEN', '#ffd0d6', 28); break;
      case 'rage': this.dark = 1; this.ring(e.x, e.y, 300, '#ff2a48', 30, 12); this.burst('ember', e.x, e.y, 40, 9, ['#ff2a48', '#ff8a3a', '#3a0a14'], { life: 40, size: 10, grav: -0.1 }); this.text(e.x, e.y + 130, 'THE OATH DEMANDS', '#ff5a6e', 36); kick(12); break;
      case 'counter': case 'parry': this.ring(e.x, e.y, 110, '#ffffff', 16, 9); this.burst('spark', e.x, e.y, 22, 12, ['#ffffff', '#ffd24a'], { life: 16, size: 6, grav: 0.1 }); this.text(e.x, e.y + 90, e.type === 'parry' ? 'PARRY' : 'COUNTER', '#ffffff'); if (!s.reducedFlash) this.flash = 0.35; kick(8); break;
      case 'tech': this.ring(e.x, e.y, 80, '#ffffff', 12, 6); this.text(e.x, e.y + 80, 'BREAK', '#ffffff', 28); break;
      case 'throw': this.ring(e.x, e.y, 50, '#ffd24a', 10, 5); break;
      case 'breaker': this.ring(e.x, e.y, 200, '#8fd0ff', 20, 12); this.burst('spark', e.x, e.y, 30, 14, ['#bfe0ff', '#ffffff'], { life: 20, size: 6, grav: 0 }); this.text(e.x, e.y + 110, 'OATH BREAK', '#bfe0ff'); kick(10); break;
      case 'ko': this.ring(e.x, e.y, 240, '#ffffff', 26, 14); if (!s.reducedFlash) this.flash = 0.7; kick(16); this.blood(e.x, e.y, 1, 24); break;
      case 'super': this.dark = 1; this.ring(e.x, e.y, 320, SKINS[fight.fighters[e.side].id].accent, 30, 10); kick(6); break;
      case 'cineStart': this.dark = 1; break;
      case 'knockdown': this.burst('dust', e.x, 6, 9, 3.5, ['#c8b8a0', '#8a7a68'], { angle: Math.PI / 2, spread: 3, life: 28, size: 15, grav: -0.02 }); kick(5); break;
      case 'land': this.burst('dust', e.x, 4, 4, 2, ['#c8b8a0'], { angle: Math.PI / 2, spread: 3, life: 18, size: 10, grav: -0.02 }); break;
      case 'jump': case 'dash': this.burst('dust', e.x, 4, 5, 2.6, ['#c8b8a0'], { angle: Math.PI / 2, spread: 3, life: 18, size: 11, grav: -0.02 }); break;
      case 'bounce': this.ring(e.x, e.y + 6, 90, '#ffe9b0', 12, 7); kick(7); break;
      case 'teleport': for (const [x, y] of [[e.fromX, e.fromY], [e.x, e.y]]) { this.burst('ember', x, y + 100, 16, 5, ['#ff6a2a', '#ffb347', '#3a2a2a'], { life: 26, size: 8, grav: -0.1 }); this.burst('dust', x, y + 80, 6, 2, ['#2a2030', '#4a3a4a'], { life: 26, size: 26, grav: -0.03 }); } break;
      case 'projectile': this.ring(e.x, e.y, 30, HIT[e.look === 'ice' ? 'ice' : e.look === 'arc' ? 'slash' : e.look === 'quake' ? 'rock' : 'fire'][0], 8, 4); break;
      case 'destroy': case 'clash': this.burst('spark', e.x, e.y, 10, 7, e.look === 'ice' ? HIT.ice : e.look === 'arc' ? HIT.slash : e.look === 'quake' ? HIT.rock : HIT.fire, { life: 14, size: 5, grav: 0.2 }); break;
      case 'freeze': this.burst('shard', e.x, e.y, 16, 6, HIT.ice, { life: 30, size: 9, grav: 0.3 }); this.ring(e.x, e.y, 90, '#bff1ff', 14, 7); break;
      case 'thaw': case 'shatter': this.burst('shard', e.x, e.y, 22, 10, HIT.ice, { life: 30, size: 10, grav: 0.5 }); this.ring(e.x, e.y, 110, '#e9fbff', 14, 8); break;
      case 'object': this.burst('shard', e.x, 90, 12, 5, HIT.ice, { life: 24, size: 8, grav: 0.2 }); break;
      case 'juggleLimit': this.text(e.x, e.y + 60, 'OUT', '#aab6c8', 24); break;
      case 'feint': this.text(fight.fighters[e.side].x, 230, 'FEINT', '#ffb3bd', 24); break;
      case 'overheat': this.text(fight.fighters[e.side].x, 230, 'OVERHEAT', '#ffb347', 24); break;
      case 'fx': {
        if (e.look === 'flamePillar') { for (let i = 0; i < 4; i++) this.burst('ember', e.x + (i - 1.5) * 34, 20 + i * 10, 12, 6, ['#ff5a1f', '#ffb347', '#ffe08a'], { angle: Math.PI / 2, spread: 0.7, up: 5, grav: -0.2, life: 30, size: 11 }); this.ring(e.x, 90, 130, '#ff8a3a', 14, 9); }
        else if (e.look === 'iceWarn') this.arcs.push({ warn: true, x: e.x, life: 20, max: 20 });
        else if (e.look === 'icePillar') { this.arcs.push({ pillar: true, x: e.x, life: 26, max: 26 }); this.burst('shard', e.x, 60, 18, 8, HIT.ice, { angle: Math.PI / 2, spread: 1.4, up: 5, life: 28, size: 9, grav: 0.4 }); }
        else if (e.look === 'frostWave') this.arcs.push({ wave: true, x: e.x, dir: e.dir, life: 26, max: 26 });
        else if (e.look === 'slam') { this.ring(e.x, 12, 130, '#ffe9b0', 14, 9); this.burst('dust', e.x, 8, 12, 5, ['#b8a890', '#8a7a68'], { angle: Math.PI / 2, spread: 2.6, life: 30, size: 18, grav: -0.02 }); this.burst('shard', e.x, 8, 8, 8, ['#8a7a68', '#5a4e42'], { angle: Math.PI / 2, spread: 1.6, up: 4, life: 30, size: 9, grav: 0.5 }); kick(8); }
        break;
      }
    }
  }

  // ---- frame --------------------------------------------------------------------------------------------------------------
  draw(fight, arena, time, opts = {}) {
    const g = this.g, k = this.canvas.width / W, [a, b] = fight.fighters, s = this.settings, cine = fight.cine;
    // camera: follows the midpoint, pulls in when the fighters are close and for cinematics
    const mid = cine ? (cine.att.x + cine.def.x) / 2 : (a.x + b.x) / 2, dist = Math.abs(a.x - b.x), zoomT = cine ? 1.34 : Math.max(0.94, Math.min(1.2, 1.3 - dist / 1500)), c = this.cam;
    c.zoom += (zoomT - c.zoom) * 0.08; const half = W / 2 / c.zoom, limit = Math.max(0, STAGE.right + 70 - half); c.x += (Math.max(-limit, Math.min(limit, mid)) - c.x) * 0.14;
    this.shake *= 0.86; const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, W, H);
    g.save(); g.translate(W / 2 + sx, FLOOR + sy); g.scale(c.zoom, c.zoom); g.translate(-W / 2, -FLOOR); drawArena(g, arena, time, c.x); g.restore();
    this.dark += (((fight.superFreeze > 0 || cine) ? 1 : 0) - this.dark) * 0.2; if (this.dark > 0.02) { g.fillStyle = `rgba(4,2,8,${this.dark * 0.62})`; g.fillRect(0, 0, W, H); }
    // world space from here: x to the right, y up, origin at stage centre on the floor
    g.save(); g.translate(W / 2 + sx, FLOOR + sy); g.scale(c.zoom, -c.zoom); g.translate(-c.x, 0);
    for (const sp of this.splats) { sp.life--; g.globalAlpha = Math.min(0.6, sp.life / 200); g.fillStyle = '#6a0c1a'; g.beginPath(); g.ellipse(sp.x, -8, sp.w, sp.w * 0.22, 0, 0, 7); g.fill(); } g.globalAlpha = 1; this.splats = this.splats.filter(sp => sp.life > 0);
    for (const f of fight.fighters) { const lift = Math.min(1, f.y / 260); g.fillStyle = `rgba(0,0,0,${0.42 - lift * 0.25})`; g.beginPath(); g.ellipse(f.x, -6, 62 - lift * 22, 13 - lift * 5, 0, 0, 7); g.fill(); }
    for (const ob of fight.objects) this.drawObject(g, ob, time);
    this.drawGround(g, time);
    const order = a.state === 'attack' || a.state === 'throwing' ? [b, a] : [a, b];
    for (const f of order) this.drawFighter(g, f, fight, time, arena);
    for (const p of fight.projectiles) this.drawProjectile(g, p, time);
    this.drawParticles(g);
    if (opts.hitboxes) this.drawBoxes(g, fight);
    g.restore();
    // floating words, drawn unflipped
    for (const t of this.texts) { t.life--; const u = 1 - t.life / t.max, x = W / 2 + sx + (t.x - c.x) * c.zoom, y = FLOOR - (t.y + u * 46) * c.zoom; g.globalAlpha = Math.min(1, t.life / 14); g.font = `900 ${t.size}px "Cinzel", Georgia, serif`; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = INK; g.strokeText(t.text, x, y); g.fillStyle = t.color; g.fillText(t.text, x, y); } g.globalAlpha = 1; this.texts = this.texts.filter(t => t.life > 0);
    if (cine || fight.superFreeze > 0) { g.fillStyle = '#000'; g.fillRect(0, 0, W, 56); g.fillRect(0, H - 56, W, 56); }
    if (this.flash > 0.01) { g.fillStyle = `rgba(255,255,255,${this.flash})`; g.fillRect(0, 0, W, H); this.flash *= 0.72; }
  }

  drawFighter(g, f, fight, time, arena) {
    const v = this.views[f.side], pose = animate(f, fight, time, v), R = f.def.rig, m = f.state === 'attack' ? f.move : null;
    const J = solve(R, pose, f.x, f.y, f.facing);
    const hidden = m && m.vanish && f.mf >= m.vanish[0] && f.mf <= m.vanish[1];
    // afterimages for dashes and evasive moves
    if (f.state === 'dash' || (m && (m.trail || m.kind === 'super') && f.mf < m.startup + m.active)) { v.trail.unshift({ J, a: 0.5 }); if (v.trail.length > 5) v.trail.pop(); } else if (v.trail.length) v.trail.pop();
    for (const t of v.trail.slice(1)) { g.globalAlpha = t.a * 0.5; t.a *= 0.7; drawFighter(g, f.id, t.J, R, { cloth: {} }, time, 'brightness(0.6) saturate(2)'); } g.globalAlpha = 1;
    if (hidden) return;
    if (f.inv > 0 && f.state === 'idle' && Math.floor(time * 30) % 2) g.globalAlpha = 0.6;
    let tint = null; if (f.flash > 0) tint = 'brightness(3) saturate(0.3)'; else if (f.state === 'frozen' || (fight.cine && fight.cine.def === f && fight.cine.c.freeze && fight.cine.t < 86)) tint = 'hue-rotate(170deg) saturate(0.7) brightness(1.5)'; else if (f.status.chill > 0) tint = 'saturate(0.6) brightness(1.15)';
    drawFighter(g, f.id, J, R, v, time, tint); g.globalAlpha = 1;
    const cx = f.x, cy = f.y + 110;
    if (m && m.chainFx && f.mf >= m.startup - 4 && f.mf < m.startup + m.active + 6) { const k = Math.min(1, (f.mf - m.startup + 5) / 5), end = [f.x + f.facing * (m.box[0] + m.box[2]) * k, f.y + m.box[1] + m.box[3] / 2]; line(g, J.haF, end, INK, 9); g.setLineDash([9, 6]); line(g, J.haF, end, '#aab2c0', 4); g.setLineDash([]); glow(g, end, 38, 'rgba(255,120,40,0.9)', 0.7); g.fillStyle = '#ffb347'; g.beginPath(); g.arc(end[0], end[1], 9, 0, 7); g.fill(); }
    // weapon and strike smears while a hitbox is live
    if (m && m.box && m.level !== 'throw' && f.mf >= m.startup && f.mf < m.startup + m.active && !m.chainFx) { const hb = hitbox(f, m.box), col = (HIT[m.fx] || HIT.blunt)[0], u = (f.mf - m.startup) / m.active; g.save(); g.globalAlpha = 0.5 * (1 - u * 0.6); g.globalCompositeOperation = 'lighter'; g.fillStyle = col; g.beginPath(); const x0 = f.facing > 0 ? hb.x : hb.x + hb.w, x1 = f.facing > 0 ? hb.x + hb.w : hb.x; g.moveTo(x0, hb.y + hb.h * 0.2); g.quadraticCurveTo(x1 + f.facing * 26, hb.y + hb.h * 0.5, x0, hb.y + hb.h * 0.8); g.quadraticCurveTo(x1 - f.facing * 20, hb.y + hb.h * 0.5, x0, hb.y + hb.h * 0.2); g.fill(); g.restore(); }
    if (m && m.stance && f.mf >= 3 && f.mf < m.startup + m.active) { const col = m.stance === 'ice' ? '#8fe3ff' : m.stance === 'blood' ? '#ff5a6e' : '#ffb347'; g.strokeStyle = col; g.lineWidth = 4; g.globalAlpha = 0.5 + Math.sin(time * 30) * 0.3; g.beginPath(); g.arc(cx + f.facing * 26, cy + 16, 58, -1.2, 1.2); g.stroke(); g.globalAlpha = 1; }
    if (f.armor > 0 && f.def.ward) { g.strokeStyle = '#ff5a6e'; g.lineWidth = 3; for (let i = 0; i < f.armor; i++) { g.globalAlpha = 0.45 + Math.sin(time * 4 + i) * 0.15; g.setLineDash([18, 12]); g.lineDashOffset = time * (i ? -40 : 40); g.beginPath(); g.ellipse(cx, cy + 10, 78 + i * 16, 136 + i * 14, 0, 0, 7); g.stroke(); } g.setLineDash([]); g.globalAlpha = 1; }
    if (m && m.armor && f.mf >= m.armor.from && f.mf <= m.armor.to) { g.strokeStyle = '#ffb347'; g.lineWidth = 3; g.globalAlpha = 0.6; g.beginPath(); g.ellipse(cx, cy, 64, 118, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
    // status dressing
    if (f.status.burn > 0 && Math.random() < 0.6) this.add('ember', cx + (Math.random() - 0.5) * 50, f.y + 40 + Math.random() * 130, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, 22, 7, Math.random() < 0.5 ? '#ff5a1f' : '#ffb347', -0.1);
    if (f.status.bleed > 0 && Math.random() < 0.08 * f.status.bleed && this.settings.blood !== 'off') this.add('drop', cx + (Math.random() - 0.5) * 30, f.y + 120, (Math.random() - 0.5), 0, 30, 4, '#c0142c', 0.5);
    if (f.state === 'frozen') { g.fillStyle = 'rgba(190,240,255,0.32)'; g.strokeStyle = '#e9fbff'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 52, f.y); g.lineTo(cx - 40, f.y + 190); g.lineTo(cx - 6, f.y + 226); g.lineTo(cx + 36, f.y + 196); g.lineTo(cx + 54, f.y); g.closePath(); g.fill(); g.stroke(); }
    if (f.state === 'attack' && m.kind === 'super' && f.mf < m.startup) glow(g, [cx, cy], 190, SKINS[f.id].accent, 0.5);
  }

  drawProjectile(g, p, time) {
    const d = p.dir, x = p.x, y = p.y;
    if (p.look === 'fire') { glow(g, [x, y], 60, 'rgba(255,120,40,0.9)', 0.8); g.fillStyle = '#ff5a1f'; g.beginPath(); g.ellipse(x - d * 12, y, 34, 15, 0, 0, 7); g.fill(); g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(x + d * 4, y, 13, 0, 7); g.fill(); if (Math.random() < 0.9) this.add('ember', x - d * 20, y + (Math.random() - 0.5) * 16, -d * 2, (Math.random() - 0.5) * 2, 16, 8, '#ff8a3a', -0.05); }
    else if (p.look === 'ice') { glow(g, [x, y], 54, 'rgba(150,230,255,0.9)', 0.6); g.beginPath(); g.moveTo(x + d * 40, y); g.lineTo(x - d * 20, y + 13); g.lineTo(x - d * 34, y); g.lineTo(x - d * 20, y - 13); g.closePath(); inked(g, '#d9f6ff', 4); line(g, [x - d * 20, y], [x + d * 30, y], '#ffffff', 2); if (Math.random() < 0.5) this.add('shard', x - d * 24, y, -d, (Math.random() - 0.5) * 2, 14, 5, '#bff1ff', 0.1); }
    else if (p.look === 'arc') { g.save(); g.translate(x, y); g.scale(d, 1); glow(g, [0, 0], 70, 'rgba(255,40,70,0.9)', 0.6); g.beginPath(); g.moveTo(6, 50); g.quadraticCurveTo(34, 0, 6, -50); g.quadraticCurveTo(16, 0, 6, 50); g.closePath(); inked(g, '#ff3a56', 4); g.restore(); }
    else if (p.look === 'quake') { for (let i = 0; i < 3; i++) { const h = 30 + i * 16 + Math.sin(time * 30 + i) * 6, bx = x - d * i * 24; g.beginPath(); g.moveTo(bx - 14, 0); g.lineTo(bx + d * 6, h); g.lineTo(bx + 16, 0); g.closePath(); inked(g, i ? '#7a6a58' : '#a8957c', 4); } if (Math.random() < 0.7) this.add('dust', x, 8, -d * 2, 2, 20, 16, '#a8957c', -0.02); }
    else { glow(g, [x, y], 50, 'rgba(200,120,255,0.9)', 0.7); g.fillStyle = '#c77dff'; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); }
  }
  drawObject(g, ob, time) {
    if (ob.type === 'decoy') { const x = ob.cx, a = Math.min(1, ob.t / 8) * (ob.life < 30 ? ob.life / 30 : 1); g.globalAlpha = a; glow(g, [x, 100], 110, 'rgba(150,230,255,0.9)', 0.35); g.beginPath(); g.moveTo(x - 30, 0); g.lineTo(x - 24, 120); g.lineTo(x - 6, 196); g.lineTo(x + 14, 150); g.lineTo(x + 30, 172); g.lineTo(x + 34, 0); g.closePath(); inked(g, 'rgba(190,240,255,0.72)', 4); line(g, [x - 8, 20], [x - 2, 170], '#ffffff', 2.5); line(g, [x + 16, 10], [x + 20, 140], '#e9fbff', 2); g.globalAlpha = 1; }
  }
  drawGround(g, time) { // telegraphs and eruptions that live on the floor
    for (const a of this.arcs) { if (a.combo) { a.life = 0; continue; } a.life--; const u = 1 - a.life / a.max;
      if (a.warn) { g.globalAlpha = 0.4 + Math.sin(time * 40) * 0.2; g.fillStyle = '#8fe3ff'; g.beginPath(); g.ellipse(a.x, -4, 62, 12, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
      if (a.pillar) { const h = 170 * Math.min(1, u * 4) * (a.life < 8 ? a.life / 8 : 1); for (const [dx, k] of [[-34, 0.7], [0, 1], [30, 0.8], [-12, 0.55]]) { g.beginPath(); g.moveTo(a.x + dx - 18, 0); g.lineTo(a.x + dx, h * k); g.lineTo(a.x + dx + 18, 0); g.closePath(); inked(g, 'rgba(200,244,255,0.85)', 4); } }
      if (a.wave) { const x = a.x + a.dir * u * 520; glow(g, [x, 40], 150, 'rgba(160,235,255,0.9)', 0.6); for (let i = 0; i < 5; i++) { const bx = x - a.dir * i * 44, h = (90 - i * 12) * (1 - u * 0.3); g.beginPath(); g.moveTo(bx - 16, 0); g.lineTo(bx + a.dir * 8, h); g.lineTo(bx + 16, 0); g.closePath(); inked(g, 'rgba(210,246,255,0.8)', 3); } }
    }
    this.arcs = this.arcs.filter(a => a.life > 0);
  }
  drawParticles(g) {
    for (const r of this.rings) { r.life--; const u = 1 - r.life / r.max; g.globalAlpha = (1 - u) * 0.9; g.strokeStyle = r.color; g.lineWidth = r.width * (1 - u * 0.6); g.beginPath(); g.arc(r.x, r.y, r.r * (0.25 + u * 0.75), 0, 7); g.stroke(); } this.rings = this.rings.filter(r => r.life > 0);
    for (const p of this.p) {
      p.life--; p.vy -= p.grav; p.x += p.vx; p.y += p.vy; const u = Math.max(0, p.life / p.max); g.globalAlpha = Math.min(1, u * 1.8);
      if (p.type === 'drop') { if (p.y <= 2) { p.life = 0; if (this.splats.length < 28) this.splats.push({ x: p.x, w: 8 + Math.random() * 14, life: 340 }); continue; } g.fillStyle = p.color; g.beginPath(); g.ellipse(p.x, p.y, p.size * 0.7, p.size * (1 + Math.min(1.5, Math.abs(p.vy) * 0.12)), 0, 0, 7); g.fill(); }
      else if (p.type === 'spark') { g.strokeStyle = p.color; g.lineWidth = p.size * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); g.stroke(); p.vx *= 0.9; p.vy *= 0.9; }
      else if (p.type === 'shard') { g.fillStyle = p.color; g.beginPath(); g.moveTo(p.x, p.y + p.size); g.lineTo(p.x + p.size * 0.5, p.y - p.size * 0.5); g.lineTo(p.x - p.size * 0.5, p.y - p.size * 0.4); g.fill(); if (p.y < 0) p.life = 0; }
      else if (p.type === 'dust') { g.globalAlpha *= 0.45; g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * (1.6 - u * 0.8), 0, 7); g.fill(); p.vx *= 0.93; p.vy *= 0.93; }
      else { g.globalCompositeOperation = 'lighter'; g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * u, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
    }
    g.globalAlpha = 1; this.p = this.p.filter(p => p.life > 0);
  }
  drawBoxes(g, fight) { // training display: green hurtboxes, red live hitboxes, blue projectiles
    g.lineWidth = 2;
    for (const f of fight.fighters) { const h = hurtbox(f); g.strokeStyle = '#3bd16f'; g.fillStyle = 'rgba(59,209,111,0.14)'; g.fillRect(h.x, h.y, h.w, h.h); g.strokeRect(h.x, h.y, h.w, h.h); const m = f.state === 'attack' ? f.move : null; if (m && m.box && f.mf >= m.startup && f.mf < m.startup + m.active) { const b = hitbox(f, m.box); g.strokeStyle = '#ff3b3b'; g.fillStyle = 'rgba(255,59,59,0.28)'; g.fillRect(b.x, b.y, b.w, b.h); g.strokeRect(b.x, b.y, b.w, b.h); } }
    for (const p of fight.projectiles) { g.strokeStyle = '#4aa8ff'; g.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); } for (const o of fight.objects) { g.strokeStyle = '#4aa8ff'; g.strokeRect(o.x, o.y, o.w, o.h); }
  }
}
