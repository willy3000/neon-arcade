// The 2D skeleton every fighter is built on. A pose says where the hips, hands and feet should be; this file turns that into
// joint positions with two-bone inverse kinematics, blends between poses, and supplies the outlined shapes the skins draw with.
const RAD = Math.PI / 180;
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = { out: t => 1 - (1 - t) * (1 - t), in: t => t * t * t, inOut: t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)), back: t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2) };

// Pose fields. Arrays are [x, y]: hands in arm-lengths from the shoulder, feet in leg-lengths from the fighter's ground point.
export const DEFAULT_POSE = { hip: [0, 1], lean: 4, head: 0, fa: [0.55, 0.05], ba: [0.3, -0.25], ff: [0.22, 0], bf: [-0.22, 0], wp: 60, wb: 60, rot: 0, sq: 1, y: 0, fe: 1, be: 1, fk: 1, bk: 1 };
const VEC = ['hip', 'fa', 'ba', 'ff', 'bf'];
export function mix(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b; const out = {};
  for (const k of Object.keys(DEFAULT_POSE)) { const x = a[k] ?? DEFAULT_POSE[k], y = b[k] ?? DEFAULT_POSE[k]; out[k] = VEC.includes(k) ? [lerp(x[0], y[0], t), lerp(x[1], y[1], t)] : k === 'fe' || k === 'be' || k === 'fk' || k === 'bk' ? (t < 0.5 ? x : y) : lerp(x, y, t); }
  return out;
}
export const over = (base, changes) => ({ ...DEFAULT_POSE, ...base, ...changes });
// Samples a list of [frame, pose] keys.
export function sample(keys, frame, base) {
  if (frame <= keys[0][0]) return over(base, keys[0][1]);
  for (let i = 1; i < keys.length; i++) if (frame <= keys[i][0]) { const [f0, p0] = keys[i - 1], [f1, p1, e] = keys[i]; return mix(over(base, p0), over(base, p1), (ease[e] || ease.inOut)((frame - f0) / (f1 - f0))); }
  return over(base, keys[keys.length - 1][1]);
}

function ik(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.001; const max = l1 + l2 - 0.5, min = Math.abs(l1 - l2) + 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; } else if (d < min) { dx *= min / d; dy *= min / d; d = min; }
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))), base = Math.atan2(dy, dx);
  return [ax + Math.cos(base + bend * a) * l1, ay + Math.sin(base + bend * a) * l1, ax + dx, ay + dy];
}

// Turns a pose into joint positions. Coordinates are stage pixels with y up; `f` is the facing (1 right, -1 left).
export function solve(R, pose, x, y, f) {
  const p = { ...DEFAULT_POSE, ...pose }, s = R.scale, leg = R.leg * s, arm = R.arm * s, torso = R.torso * s * p.sq;
  const hipY = y + p.y + leg * 0.97 * p.hip[1] * p.sq, hipX = x + f * p.hip[0], lean = p.lean * RAD;
  const J = { f, hip: [hipX, hipY], neck: [hipX + f * Math.sin(lean) * torso, hipY + Math.cos(lean) * torso] };
  const ha = (p.lean + p.head) * RAD, hr = R.head * s; J.head = [J.neck[0] + f * Math.sin(ha) * hr * 0.95, J.neck[1] + Math.cos(ha) * hr * 0.95]; J.headAngle = ha; J.torsoAngle = lean;
  const sx = Math.cos(lean) * R.shoulder * s, sy = -Math.sin(lean) * R.shoulder * s;
  J.shF = [J.neck[0] + f * sx * 0.6, J.neck[1] + sy * 0.6 - 6 * s]; J.shB = [J.neck[0] - f * sx, J.neck[1] - sy - 6 * s];
  for (const [side, key, bend] of [['F', 'fa', p.fe], ['B', 'ba', p.be]]) { const sh = J['sh' + side], [ex, ey, hx, hy] = ik(sh[0], sh[1], sh[0] + f * p[key][0] * arm, sh[1] + p[key][1] * arm, arm * 0.5, arm * 0.5, -f * bend); J['el' + side] = [ex, ey]; J['ha' + side] = [hx, hy]; }
  J.hpF = [hipX + f * R.hipW * s, hipY]; J.hpB = [hipX - f * R.hipW * s, hipY];
  for (const [side, key, bend] of [['F', 'ff', p.fk], ['B', 'bf', p.bk]]) { const h = J['hp' + side], [kx, ky, fx, fy] = ik(h[0], h[1], x + f * p[key][0] * leg, y + p.y + p[key][1] * leg + R.foot * s, leg * 0.52, leg * 0.5, f * bend); J['kn' + side] = [kx, ky]; J['ft' + side] = [fx, fy]; J['air' + side] = p[key][1] > 0.04; }
  J.wp = p.wp * RAD; J.wb = p.wb * RAD; J.s = s;
  if (p.rot) { const c = Math.cos(p.rot * RAD * -f), sn = Math.sin(p.rot * RAD * -f), ox = hipX, oy = hipY; for (const k of Object.keys(J)) { const v = J[k]; if (Array.isArray(v)) { const dx = v[0] - ox, dy = v[1] - oy; v[0] = ox + dx * c - dy * sn; v[1] = oy + dx * sn + dy * c; } } J.rot = p.rot * RAD * -f; J.torsoAngle += p.rot * RAD; J.headAngle += p.rot * RAD; J.wp -= p.rot * RAD; J.wb -= p.rot * RAD; } else J.rot = 0;
  return J;
}

// ---- Drawing primitives. Every shape is stroked with the outline colour first so characters keep a thick ink line. -----------
export const INK = '#0c0a10';
export function inked(ctx, fill, width = 5, ink = INK) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = width; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); }
// A limb segment: wider at one end than the other, with rounded ends.
export function limb(ctx, a, b, r1, r2, fill, width) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), n = ang + Math.PI / 2;
  ctx.beginPath(); ctx.arc(a[0], a[1], r1, n, n + Math.PI); ctx.arc(b[0], b[1], r2, n + Math.PI, n); ctx.closePath(); inked(ctx, fill, width);
}
export function disc(ctx, c, r, fill, width) { ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, Math.PI * 2); inked(ctx, fill, width); }
// A closed shape from points given relative to an origin, rotated by `angle` and mirrored by the facing.
export function shape(ctx, origin, angle, f, pts, fill, width, smooth) {
  const c = Math.cos(angle), s = Math.sin(angle), P = pts.map(([px, py]) => [origin[0] + f * (px * c + py * s), origin[1] + (-px * s + py * c)]);
  ctx.beginPath();
  if (smooth) { const n = P.length; ctx.moveTo((P[0][0] + P[n - 1][0]) / 2, (P[0][1] + P[n - 1][1]) / 2); for (let i = 0; i < n; i++) { const q = P[(i + 1) % n]; ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + q[0]) / 2, (P[i][1] + q[1]) / 2); } } else { ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); }
  ctx.closePath(); if (fill) inked(ctx, fill, width); return P;
}
export function line(ctx, a, b, color, width) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke(); }
export function glow(ctx, c, r, color, alpha = 0.6) { const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.globalAlpha *= alpha; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.fill(); ctx.restore(); }
export const along = (a, angle, d, f = 1) => [a[0] + f * Math.cos(angle) * d, a[1] + Math.sin(angle) * d];
export const mid = (a, b, t = 0.5) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// A strip of cloth that trails behind an anchor point: scarves, coat tails, capes.
export class Cloth {
  constructor(n, seg) { this.n = n; this.seg = seg; this.p = null; }
  update(anchor, f, droop = 0.55, lag = 0.42, wind = 0) {
    if (!this.p || Math.hypot(this.p[0][0] - anchor[0], this.p[0][1] - anchor[1]) > 260) this.p = Array.from({ length: this.n }, (_, i) => [anchor[0] - f * i * this.seg, anchor[1] - i * this.seg * 0.3]);
    this.p[0] = [...anchor];
    for (let i = 1; i < this.n; i++) { const a = this.p[i - 1], b = this.p[i], tx = a[0] - f * this.seg * (1 - droop * 0.6) + wind, ty = a[1] - this.seg * droop; b[0] += (tx - b[0]) * lag; b[1] += (ty - b[1]) * lag; const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; if (d > this.seg * 1.25) { b[0] = a[0] + dx / d * this.seg * 1.25; b[1] = a[1] + dy / d * this.seg * 1.25; } }
    return this.p;
  }
  draw(ctx, w0, w1, fill, width = 5) {
    const p = this.p; if (!p) return; const L = [], Rr = [];
    for (let i = 0; i < p.length; i++) { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2, w = lerp(w0, w1, i / (p.length - 1)); L.push([p[i][0] + Math.cos(ang) * w, p[i][1] + Math.sin(ang) * w]); Rr.unshift([p[i][0] - Math.cos(ang) * w, p[i][1] - Math.sin(ang) * w]); }
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (const q of L.concat(Rr)) ctx.lineTo(q[0], q[1]); ctx.closePath(); inked(ctx, fill, width);
  }
}
