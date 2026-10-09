// How each fighter looks. Every skin draws its own parts over the shared skeleton, back to front, so silhouettes differ:
// Cinder is lean with horns and a trailing scarf, Rime broad with crystal shoulders, Vesper tall under a wide hat, Grit a wall of iron.
import { limb, disc, shape, line, glow, along, mid, inked, Cloth, INK } from './rig.js';

const boot = (ctx, J, side, c, len = 22, w) => { const a = J['ft' + side], f = J.f, s = J.s, tilt = J['air' + side] ? -0.5 : 0; shape(ctx, a, tilt, f, [[-9 * s, 5 * s], [-10 * s, -9 * s], [len * s, -9 * s], [(len + 4) * s, -4 * s], [12 * s, 4 * s], [5 * s, 7 * s]], c, w, true); };
function leg(ctx, J, side, R, thigh, shin, bootC, w) { const k = R.limb, s = J.s; limb(ctx, J['hp' + side], J['kn' + side], k.thigh[0] * s, k.thigh[1] * s, thigh, w); limb(ctx, J['kn' + side], J['ft' + side], k.shin[0] * s, k.shin[1] * s, shin, w); boot(ctx, J, side, bootC, R.bootLen, w); }
function arm(ctx, J, side, R, upper, fore, hand, w) { const k = R.limb, s = J.s; limb(ctx, J['sh' + side], J['el' + side], k.upper[0] * s, k.upper[1] * s, upper, w); limb(ctx, J['el' + side], J['ha' + side], k.fore[0] * s, k.fore[1] * s, fore, w); disc(ctx, J['ha' + side], R.hand * s, hand, w); }
// The trunk: a tapered block from hips to shoulders that leans with the spine.
function torso(ctx, J, R, fill, w) { const s = J.s, h = Math.hypot(J.neck[0] - J.hip[0], J.neck[1] - J.hip[1]); return shape(ctx, J.hip, J.torsoAngle, J.f, [[-R.waist * 0.5 * s, -8 * s], [R.waist * 0.5 * s, -8 * s], [R.chest * 0.52 * s, h * 0.62], [R.chest * 0.42 * s, h + 6 * s], [-R.chest * 0.5 * s, h + 6 * s], [-R.chest * 0.56 * s, h * 0.6]], fill, w, true); }
const forearmAngle = (J, side) => Math.atan2(J['ha' + side][1] - J['el' + side][1], J['ha' + side][0] - J['el' + side][0]);
const dirOf = (J, a) => [J.f * Math.cos(a), Math.sin(a)];
const ptAt = (o, J, a, d) => [o[0] + J.f * Math.cos(a) * d, o[1] + Math.sin(a) * d];
function cloth(view, key, n, seg) { view.cloth ||= {}; return (view.cloth[key] ||= new Cloth(n, seg)); }

export const SKINS = {
  cinder: {
    accent: '#ff6a2a',
    draw(ctx, J, R, view, time) {
      const s = J.s, f = J.f, armor = '#2b2333', plate = '#3d3246', dark = '#1a151f', ember = '#ff6a2a', bone = '#d9cfc2', scarf = '#c2331f';
      // scarf tails trail from the neck
      const neckBack = [J.neck[0] - f * 10 * s, J.neck[1] + 4 * s];
      for (const [key, drop, col] of [['s1', 0.5, '#8f2416'], ['s2', 0.3, scarf]]) { const c = cloth(view, key, 7, 15 * s); c.update([neckBack[0], neckBack[1] - (key === 's1' ? 6 : 0) * s], f, drop, 0.4, Math.sin(time * 5 + (key === 's1' ? 1 : 0)) * 1.2); c.draw(ctx, 9 * s, 3 * s, col); }
      arm(ctx, J, 'B', R, dark, armor, dark); this.chain(ctx, J, time);
      leg(ctx, J, 'B', R, dark, dark, '#141018');
      torso(ctx, J, R, armor);
      // glowing cracks across the chest plate
      const up = (t, o) => [J.hip[0] + (J.neck[0] - J.hip[0]) * t + f * o * s, J.hip[1] + (J.neck[1] - J.hip[1]) * t];
      line(ctx, up(0.45, 8), up(0.7, 2), ember, 3 * s); line(ctx, up(0.7, 2), up(0.85, 12), ember, 3 * s); line(ctx, up(0.3, -4), up(0.45, 8), '#ffb347', 2 * s);
      shape(ctx, J.hip, J.torsoAngle, f, [[-17 * s, 2 * s], [18 * s, 2 * s], [14 * s, -20 * s], [0, -30 * s], [-12 * s, -18 * s]], plate, 5, false); // tasset
      leg(ctx, J, 'F', R, armor, plate, dark);
      disc(ctx, J.knF, 8 * s, plate);
      this.head(ctx, J, R, time);
      shape(ctx, J.shF, J.torsoAngle, f, [[-13 * s, -6 * s], [8 * s, -9 * s], [16 * s, 6 * s], [2 * s, 17 * s], [-12 * s, 9 * s]], plate, 5, true); // spiked shoulder
      arm(ctx, J, 'F', R, armor, plate, dark);
      this.blade(ctx, J, time);
    },
    head(ctx, J, R, time) {
      const s = J.s, f = J.f, a = J.headAngle, h = J.head, r = R.head * s;
      shape(ctx, h, a, f, [[-r * 0.95, -r * 0.5], [-r * 0.9, r * 0.75], [-r * 0.2, r * 1.05], [r * 0.6, r * 0.8], [r * 0.5, -r * 0.6], [-r * 0.2, -r * 0.95]], '#1a151f', 5, true); // hood
      shape(ctx, h, a, f, [[-r * 0.2, r * 0.9], [-r * 0.75, r * 1.85], [-r * 0.5, r * 0.75]], '#1a151f', 4); shape(ctx, h, a, f, [[r * 0.25, r * 0.85], [r * 0.2, r * 1.75], [r * 0.6, r * 0.6]], '#2b2333', 4); // horns
      shape(ctx, h, a, f, [[-r * 0.05, r * 0.6], [r * 0.9, r * 0.45], [r * 1.02, -r * 0.2], [r * 0.55, -r * 0.92], [0, -r * 0.6]], '#d9cfc2', 5, false); // mask
      const eye = [h[0] + f * (r * 0.52 * Math.cos(a) + r * 0.12 * Math.sin(a)), h[1] - r * 0.52 * Math.sin(a) + r * 0.12 * Math.cos(a)];
      shape(ctx, eye, a, f, [[-r * 0.3, r * 0.14], [r * 0.3, r * 0.02], [r * 0.24, -r * 0.14], [-r * 0.26, -r * 0.06]], '#120c0c', 0); glow(ctx, eye, r * 0.9, 'rgba(255,120,40,0.9)', 0.55 + Math.sin(time * 6) * 0.15);
      shape(ctx, eye, a, f, [[-r * 0.16, r * 0.06], [r * 0.2, 0], [r * 0.12, -r * 0.08], [-r * 0.12, -r * 0.03]], '#ffb347', 0);
      for (let i = 0; i < 3; i++) line(ctx, [h[0] + f * (r * (0.35 + i * 0.2)), h[1] - r * 0.45], [h[0] + f * (r * (0.38 + i * 0.2)), h[1] - r * 0.8], '#6b5f58', 2 * s); // teeth grille
    },
    blade(ctx, J, time) { // a hooked chain-blade in the lead hand
      const s = J.s, a = J.wp, h = J.haF, tip = ptAt(h, J, a, 44 * s), butt = ptAt(h, J, a + Math.PI, 14 * s);
      line(ctx, butt, tip, INK, 10 * s); line(ctx, butt, tip, '#6b4a3a', 5.5 * s);
      const P = [tip, ptAt(tip, J, a + 1.0, 26 * s), ptAt(tip, J, a + 1.9, 62 * s), ptAt(tip, J, a + 1.55, 30 * s)];
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.quadraticCurveTo(P[1][0], P[1][1], P[2][0], P[2][1]); ctx.quadraticCurveTo(P[3][0], P[3][1], P[0][0], P[0][1]); ctx.closePath(); inked(ctx, '#cfd3dc', 5);
      line(ctx, ptAt(tip, J, a + 1.3, 20 * s), ptAt(tip, J, a + 1.85, 50 * s), '#ff8a3a', 3 * s);
    },
    chain(ctx, J, time) { // the chain hangs from the lead hand to the rear one
      const a = J.haF, b = J.haB, m = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 26 * J.s - Math.sin(time * 4) * 3];
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); ctx.strokeStyle = INK; ctx.lineWidth = 6 * J.s; ctx.stroke(); ctx.strokeStyle = '#8a8f9c'; ctx.lineWidth = 2.5 * J.s; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    },
  },

  rime: {
    accent: '#8fe3ff',
    draw(ctx, J, R, view, time) {
      const s = J.s, f = J.f, steel = '#34506e', deep = '#1c2c42', ice = '#aeeaff', fur = '#e3edf5', frost = '#e9fbff';
      const cape = cloth(view, 'cape', 6, 20 * s); cape.update([J.neck[0] - f * 16 * s, J.neck[1] - 2 * s], f, 0.9, 0.3, Math.sin(time * 3) * 0.8); cape.draw(ctx, 16 * s, 24 * s, deep);
      arm(ctx, J, 'B', R, deep, '#5f86a8', ice); this.spike(ctx, J, 'B');
      leg(ctx, J, 'B', R, deep, deep, '#131d2c');
      torso(ctx, J, R, steel);
      const up = (t, o) => [J.hip[0] + (J.neck[0] - J.hip[0]) * t + f * o * s, J.hip[1] + (J.neck[1] - J.hip[1]) * t];
      shape(ctx, up(0.62, 6), J.torsoAngle, f, [[0, 14 * s], [12 * s, 0], [0, -16 * s], [-10 * s, 0]], ice, 4); glow(ctx, up(0.62, 6), 26 * s, 'rgba(140,230,255,0.8)', 0.35);
      shape(ctx, J.hip, J.torsoAngle, f, [[-22 * s, 4 * s], [23 * s, 4 * s], [20 * s, -14 * s], [6 * s, -34 * s], [-6 * s, -34 * s], [-19 * s, -14 * s]], deep, 5); // waist cloth
      leg(ctx, J, 'F', R, steel, '#5f86a8', deep);
      shape(ctx, J.knF, 0, f, [[-8 * s, -8 * s], [10 * s, -6 * s], [3 * s, 13 * s]], ice, 4);
      shape(ctx, J.neck, J.torsoAngle, f, [[-24 * s, -6 * s], [20 * s, -8 * s], [26 * s, 6 * s], [0, 13 * s], [-27 * s, 7 * s]], fur, 5, true); // fur collar
      // crystal pauldron sits behind the head so the mask stays readable
      shape(ctx, [J.shF[0] - f * 14 * s, J.shF[1] - 2 * s], J.torsoAngle, f, [[-16 * s, -8 * s], [14 * s, -10 * s], [18 * s, 4 * s], [2 * s, 22 * s], [-6 * s, 8 * s], [-18 * s, 16 * s]], ice, 5); line(ctx, [J.shF[0] - f * 12 * s, J.shF[1] + 16 * s], [J.shF[0] - f * 12 * s, J.shF[1] - 4 * s], frost, 2.5 * s);
      this.head(ctx, J, R, time);
      arm(ctx, J, 'F', R, steel, '#6d97bb', ice); this.spike(ctx, J, 'F');
    },
    head(ctx, J, R, time) {
      const s = J.s, f = J.f, a = J.headAngle, h = J.head, r = R.head * s;
      shape(ctx, h, a, f, [[-r * 0.95, -r * 0.7], [-r, r * 0.5], [-r * 0.3, r], [r * 0.5, r * 0.8], [r * 0.6, -r * 0.7], [-r * 0.2, -r]], '#1c2c42', 5, true); // cowl
      shape(ctx, h, a, f, [[-r * 0.15, r * 1.1], [r * 0.35, r * 1.55], [r * 0.5, r * 0.8], [r * 1.05, r * 0.25], [r * 0.85, -r * 0.55], [r * 0.3, -r * 1.05], [-r * 0.1, -r * 0.5], [r * 0.05, r * 0.2]], '#aeeaff', 5); // faceted mask
      line(ctx, [h[0] + f * r * 0.35, h[1] + r * 1.4], [h[0] + f * r * 0.42, h[1] - r * 0.9], '#e9fbff', 2 * s);
      const eye = [h[0] + f * (r * 0.55 * Math.cos(a) + r * 0.15 * Math.sin(a)), h[1] - r * 0.55 * Math.sin(a) + r * 0.15 * Math.cos(a)];
      shape(ctx, eye, a, f, [[-r * 0.32, r * 0.08], [r * 0.36, r * 0.05], [r * 0.32, -r * 0.08], [-r * 0.3, -r * 0.05]], '#06131f', 0); glow(ctx, eye, r * 0.8, 'rgba(180,240,255,0.9)', 0.45);
      shape(ctx, eye, a, f, [[-r * 0.2, r * 0.03], [r * 0.24, r * 0.02], [r * 0.2, -r * 0.04], [-r * 0.2, -r * 0.03]], '#ffffff', 0);
    },
    spike(ctx, J, side) { // an ice blade runs along each gauntlet and past the fist
      const s = J.s, a = forearmAngle(J, side), h = J['ha' + side], e = J['el' + side], base = mid(e, h, 0.35), n = a + Math.PI / 2 * J.f;
      const tip = [h[0] + Math.cos(a) * 22 * s, h[1] + Math.sin(a) * 22 * s], o = [Math.cos(n) * 7 * s, Math.sin(n) * 7 * s];
      ctx.beginPath(); ctx.moveTo(base[0] + o[0], base[1] + o[1]); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(h[0] - o[0] * 0.4, h[1] - o[1] * 0.4); ctx.closePath(); inked(ctx, side === 'F' ? '#d9f6ff' : '#8fd0ee', 4);
    },
  },

  vesper: {
    accent: '#e0243c',
    draw(ctx, J, R, view, time) {
      const s = J.s, f = J.f, coat = '#6a1424', coatD = '#4a0d19', black = '#17121a', skin = '#ead8cc', silver = '#e9e4ea';
      for (const [key, ox, col] of [['t1', -10, coatD], ['t2', 2, coat]]) { const c = cloth(view, key, 5, 19 * s); c.update([J.hip[0] + f * ox * s, J.hip[1] - 4 * s], f, 0.95, 0.36, Math.sin(time * 4 + ox) * 0.8); c.draw(ctx, 13 * s, 17 * s, col); }
      this.sword(ctx, J, 'B', true); arm(ctx, J, 'B', R, coatD, coatD, black);
      leg(ctx, J, 'B', R, black, black, '#0f0b11');
      torso(ctx, J, R, coat);
      const up = (t, o) => [J.hip[0] + (J.neck[0] - J.hip[0]) * t + f * o * s, J.hip[1] + (J.neck[1] - J.hip[1]) * t];
      line(ctx, up(0.1, 6), up(0.95, 10), '#d8b46a', 2.5 * s); for (let i = 0; i < 3; i++) disc(ctx, up(0.3 + i * 0.22, 9), 2.6 * s, '#d8b46a', 2); // gold buttons
      shape(ctx, J.hip, J.torsoAngle, f, [[-16 * s, 4 * s], [17 * s, 4 * s], [17 * s, -6 * s], [-16 * s, -6 * s]], '#b01830', 4); // sash
      leg(ctx, J, 'F', R, black, '#2a2030', black);
      shape(ctx, J.neck, J.torsoAngle, f, [[-12 * s, -4 * s], [14 * s, -6 * s], [20 * s, 12 * s], [4 * s, 6 * s], [-14 * s, 14 * s]], coatD, 4, true); // high collar
      this.head(ctx, J, R, view, time);
      arm(ctx, J, 'F', R, coat, coat, black); shape(ctx, J.haF, forearmAngle(J, 'F') - Math.PI / 2, 1, [[-9 * s, -6 * s], [9 * s, -6 * s], [11 * s, 6 * s], [-11 * s, 6 * s]], silver, 4); // cuff
      this.sword(ctx, J, 'F');
    },
    head(ctx, J, R, view, time) {
      const s = J.s, f = J.f, a = J.headAngle, h = J.head, r = R.head * s;
      const tail = cloth(view, 'hair', 6, 12 * s); tail.update([h[0] - f * r * 0.8, h[1] + r * 0.1], f, 0.6, 0.45, Math.sin(time * 5) * 0.8); tail.draw(ctx, 7 * s, 2 * s, '#f1edf2', 4);
      shape(ctx, h, a, f, [[-r * 0.85, -r * 0.55], [-r * 0.8, r * 0.6], [0, r * 0.95], [r * 0.75, r * 0.55], [r * 0.82, -r * 0.35], [r * 0.3, -r * 0.95], [-r * 0.4, -r * 0.85]], '#ead8cc', 5, true); // face
      shape(ctx, h, a, f, [[-r * 0.95, -r * 0.1], [-r * 0.85, r * 0.75], [-r * 0.1, r * 1.0], [r * 0.5, r * 0.75], [r * 0.1, r * 0.35], [-r * 0.5, r * 0.2]], '#f1edf2', 4, true); // hair
      const eye = [h[0] + f * (r * 0.42 * Math.cos(a)), h[1] - r * 0.42 * Math.sin(a) + r * 0.05];
      shape(ctx, eye, a, f, [[-r * 0.2, r * 0.1], [r * 0.24, r * 0.02], [-r * 0.16, -r * 0.06]], '#b01830', 2.5); line(ctx, [eye[0] - f * r * 0.3, eye[1] + r * 0.24], [eye[0] + f * r * 0.34, eye[1] + r * 0.12], INK, 3 * s);
      line(ctx, [h[0] + f * r * 0.35, h[1] - r * 0.52], [h[0] + f * r * 0.68, h[1] - r * 0.46], '#7a2a34', 2.5 * s); // thin smirk
      // wide-brimmed hat with a feather
      shape(ctx, [h[0], h[1] + r * 0.72], a, f, [[-r * 1.75, -r * 0.08], [r * 1.9, -r * 0.2], [r * 1.5, r * 0.14], [-r * 1.5, r * 0.2]], '#17121a', 5, true);
      shape(ctx, [h[0] - f * r * 0.05, h[1] + r * 0.85], a, f, [[-r * 0.8, 0], [r * 0.75, -r * 0.05], [r * 0.5, r * 0.7], [-r * 0.6, r * 0.75]], '#17121a', 5, true);
      shape(ctx, [h[0] - f * r * 0.05, h[1] + r * 0.98], a, f, [[-r * 0.78, 0], [r * 0.72, -r * 0.04], [r * 0.7, r * 0.14], [-r * 0.76, r * 0.18]], '#b01830', 3);
      shape(ctx, [h[0] - f * r * 0.5, h[1] + r * 1.2], a + 0.5 + Math.sin(time * 4) * 0.05, f, [[0, 0], [-r * 0.5, r * 0.8], [-r * 1.5, r * 1.1], [-r * 0.7, r * 0.3]], '#e0243c', 4, true);
    },
    sword(ctx, J, side, sheath) {
      const s = J.s;
      if (sheath) { const hp = [J.hip[0] - J.f * 8 * s, J.hip[1] + 2 * s]; line(ctx, hp, [hp[0] - J.f * 62 * s, hp[1] - 22 * s], INK, 10 * s); line(ctx, hp, [hp[0] - J.f * 62 * s, hp[1] - 22 * s], '#2a2030', 5 * s); return; }
      const a = J.wp, h = J.haF, tip = ptAt(h, J, a, 104 * s), guard = ptAt(h, J, a, 10 * s), n = a + Math.PI / 2;
      line(ctx, ptAt(h, J, a + Math.PI, 12 * s), guard, INK, 9 * s); line(ctx, ptAt(h, J, a + Math.PI, 12 * s), guard, '#3a2a30', 5 * s);
      ctx.beginPath(); const g1 = ptAt(guard, J, n, 4.5 * s), g2 = ptAt(guard, J, n + Math.PI, 4.5 * s); ctx.moveTo(g1[0], g1[1]); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(g2[0], g2[1]); ctx.closePath(); inked(ctx, '#f0f2f7', 4);
      line(ctx, guard, ptAt(guard, J, a, 80 * s), '#ff5a6e', 1.6 * s);
      line(ctx, ptAt(guard, J, n, 12 * s), ptAt(guard, J, n + Math.PI, 12 * s), INK, 8 * s); line(ctx, ptAt(guard, J, n, 12 * s), ptAt(guard, J, n + Math.PI, 12 * s), '#d8b46a', 4 * s);
    },
  },

  grit: {
    accent: '#ffb347',
    draw(ctx, J, R, view, time) {
      const s = J.s, f = J.f, iron = '#646b78', dark = '#2e323b', rust = '#a8552e', lightI = '#8d95a3';
      arm(ctx, J, 'B', R, dark, '#4a505c', dark);
      leg(ctx, J, 'B', R, dark, dark, '#1c1f25');
      torso(ctx, J, R, iron);
      const up = (t, o) => [J.hip[0] + (J.neck[0] - J.hip[0]) * t + f * o * s, J.hip[1] + (J.neck[1] - J.hip[1]) * t];
      shape(ctx, up(0.5, 6), J.torsoAngle, f, [[-22 * s, 26 * s], [30 * s, 22 * s], [26 * s, -22 * s], [-20 * s, -18 * s]], lightI, 5, true); // breastplate
      for (const [t, o] of [[0.72, 18], [0.72, -6], [0.3, 16], [0.3, -4]]) disc(ctx, up(t, o), 3.4 * s, dark, 2); // rivets
      line(ctx, up(0.2, -10), up(0.8, 24), rust, 3 * s);
      shape(ctx, J.hip, J.torsoAngle, f, [[-34 * s, 6 * s], [36 * s, 6 * s], [30 * s, -22 * s], [-28 * s, -22 * s]], dark, 5); shape(ctx, [J.hip[0] + f * 4 * s, J.hip[1] - 4 * s], J.torsoAngle, f, [[-9 * s, 8 * s], [9 * s, 8 * s], [9 * s, -8 * s], [-9 * s, -8 * s]], '#ffb347', 3); // belt and buckle
      leg(ctx, J, 'F', R, iron, lightI, dark); disc(ctx, J.knF, 12 * s, lightI);
      disc(ctx, [J.shF[0] - f * 16 * s, J.shF[1] - 6 * s], 24 * s, lightI); disc(ctx, [J.shF[0] - f * 14 * s, J.shF[1] - 4 * s], 8 * s, dark, 3); shape(ctx, [J.shF[0] - f * 22 * s, J.shF[1] + 12 * s], J.torsoAngle, f, [[-7 * s, 0], [7 * s, 0], [-2 * s, 20 * s]], iron, 4); // pauldron with a spike
      this.head(ctx, J, R, time);
      this.hammer(ctx, J);
      arm(ctx, J, 'F', R, iron, lightI, dark);
    },
    head(ctx, J, R, time) {
      const s = J.s, f = J.f, a = J.headAngle, h = J.head, r = R.head * s;
      shape(ctx, h, a, f, [[-r * 0.9, -r * 0.8], [-r * 0.95, r * 0.7], [-r * 0.5, r * 1.0], [r * 0.6, r * 1.0], [r * 1.0, r * 0.5], [r * 1.0, -r * 0.8], [0, -r * 1.05]], '#646b78', 5); // bucket helm
      shape(ctx, [h[0], h[1] + r * 0.95], a, f, [[-r * 0.2, 0], [r * 0.25, 0], [r * 0.05, r * 0.9]], '#a8552e', 4); // crest
      const slit = [h[0] + f * r * 0.4, h[1] + r * 0.12];
      shape(ctx, slit, a, f, [[-r * 0.5, r * 0.12], [r * 0.62, r * 0.12], [r * 0.62, -r * 0.1], [-r * 0.5, -r * 0.1]], '#0d0a08', 0); glow(ctx, [slit[0] + f * r * 0.15, slit[1]], r * 0.9, 'rgba(255,170,60,0.9)', 0.4 + Math.sin(time * 3) * 0.1);
      shape(ctx, [slit[0] + f * r * 0.12, slit[1]], a, f, [[-r * 0.3, r * 0.05], [r * 0.4, r * 0.05], [r * 0.4, -r * 0.04], [-r * 0.3, -r * 0.04]], '#ffb347', 0);
      for (let i = 0; i < 3; i++) line(ctx, [h[0] + f * r * (0.5 + i * 0.18), h[1] - r * 0.3], [h[0] + f * r * (0.5 + i * 0.18), h[1] - r * 0.75], '#2e323b', 2.5 * s); // breathing slots
    },
    hammer(ctx, J) {
      const s = J.s, a = J.wp, h = J.haF, butt = ptAt(h, J, a + Math.PI, 46 * s), top = ptAt(h, J, a, 78 * s), n = a + Math.PI / 2;
      line(ctx, butt, top, INK, 13 * s); line(ctx, butt, top, '#5b4634', 8 * s);
      const c = ptAt(top, J, a, 16 * s), P = [ptAt(ptAt(c, J, n, 42 * s), J, a, 24 * s), ptAt(ptAt(c, J, n + Math.PI, 42 * s), J, a, 24 * s), ptAt(ptAt(c, J, n + Math.PI, 42 * s), J, a + Math.PI, 24 * s), ptAt(ptAt(c, J, n, 42 * s), J, a + Math.PI, 24 * s)];
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (const q of P.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); inked(ctx, '#7c8492', 6);
      line(ctx, ptAt(c, J, n, 30 * s), ptAt(c, J, n + Math.PI, 30 * s), '#a8552e', 4 * s); line(ctx, P[0], P[1], '#aab2c0', 3 * s);
    },
  },

  // The boss: taller than anyone on the roster, crowned and cloaked, with a greatsword instead of a hammer.
  malgrave: {
    accent: '#c8243c',
    draw(ctx, J, R, view, time) {
      const s = J.s, f = J.f, plate = '#2b2733', dark = '#15121a', trim = '#b8923a', red = '#c8243c', light = '#48424f';
      const back = [J.neck[0] - f * 14 * s, J.neck[1] + 2 * s];
      for (const [key, drop, col, w] of [['c1', 0.78, '#4a0c18', 30], ['c2', 0.62, '#7d1424', 22]]) { const c = cloth(view, key, 8, 23 * s); c.update([back[0], back[1] - (key === 'c1' ? 8 : 0) * s], f, drop, 0.36, Math.sin(time * 3 + (key === 'c1' ? 1 : 0)) * 1.5); c.draw(ctx, w * s, 13 * s, col); }
      arm(ctx, J, 'B', R, dark, plate, dark);
      leg(ctx, J, 'B', R, dark, dark, '#0e0c12');
      torso(ctx, J, R, plate);
      const up = (t, o) => [J.hip[0] + (J.neck[0] - J.hip[0]) * t + f * o * s, J.hip[1] + (J.neck[1] - J.hip[1]) * t];
      shape(ctx, up(0.56, 5), J.torsoAngle, f, [[-20 * s, 24 * s], [26 * s, 22 * s], [18 * s, -14 * s], [2 * s, -26 * s], [-16 * s, -12 * s]], light, 5); // breastplate
      const sig = up(0.6, 6); glow(ctx, sig, 30 * s, 'rgba(230,40,70,0.9)', 0.5 + Math.sin(time * 2.4) * 0.15); line(ctx, up(0.74, 6), up(0.44, 6), red, 3.5 * s); line(ctx, up(0.64, -3), up(0.64, 15), red, 3.5 * s); // the oath sigil
      shape(ctx, J.hip, J.torsoAngle, f, [[-28 * s, 6 * s], [30 * s, 6 * s], [24 * s, -16 * s], [8 * s, -44 * s], [-4 * s, -18 * s], [-22 * s, -40 * s]], dark, 5); line(ctx, [J.hip[0] - f * 24 * s, J.hip[1] + 3 * s], [J.hip[0] + f * 26 * s, J.hip[1] + 3 * s], trim, 3 * s); // tassets and belt
      leg(ctx, J, 'F', R, plate, light, dark); disc(ctx, J.knF, 10 * s, trim, 4);
      this.head(ctx, J, R, time);
      for (const [o, r] of [[-20, 21], [-6, 15]]) shape(ctx, [J.shF[0] + f * o * s, J.shF[1] + 2 * s], J.torsoAngle, f, [[-r * s, -8 * s], [-r * 0.9 * s, 8 * s], [-r * 1.5 * s, 26 * s], [0, 14 * s], [r * s, 6 * s], [r * 0.8 * s, -10 * s]], o < -10 ? light : plate, 5); // layered, spiked pauldron
      this.sword(ctx, J, time);
      arm(ctx, J, 'F', R, plate, light, dark);
    },
    head(ctx, J, R, time) {
      const s = J.s, f = J.f, a = J.headAngle, h = J.head, r = R.head * s;
      shape(ctx, h, a, f, [[-r * 0.5, r * 0.7], [-r * 1.5, r * 1.3], [-r * 1.25, r * 2.5], [-r * 0.95, r * 1.5], [-r * 0.1, r * 0.95]], '#15121a', 4); shape(ctx, h, a, f, [[r * 0.2, r * 0.8], [r * 1.1, r * 1.4], [r * 1.0, r * 2.4], [r * 0.6, r * 1.5], [r * 0.6, r * 0.7]], '#2b2733', 4); // horns
      shape(ctx, h, a, f, [[-r * 0.9, -r * 0.7], [-r * 0.95, r * 0.6], [-r * 0.45, r * 1.0], [r * 0.55, r * 1.0], [r * 0.98, r * 0.45], [r * 0.9, -r * 0.5], [r * 0.3, -r * 1.15], [-r * 0.4, -r * 0.95]], '#2b2733', 5); // helm
      for (const x of [-0.5, 0, 0.5]) shape(ctx, [h[0] + f * x * r * Math.cos(a), h[1] + r * 0.95], a, f, [[-r * 0.2, 0], [r * 0.2, 0], [0, r * (x ? 0.55 : 0.85)]], '#b8923a', 3); // crown
      const slit = [h[0] + f * r * 0.42, h[1] + r * 0.14];
      shape(ctx, slit, a, f, [[-r * 0.45, r * 0.16], [r * 0.6, r * 0.04], [r * 0.6, -r * 0.12], [-r * 0.45, -r * 0.04]], '#07050a', 0); glow(ctx, [slit[0] + f * r * 0.1, slit[1]], r * 1.1, 'rgba(255,40,70,0.95)', 0.55 + Math.sin(time * 4) * 0.15);
      shape(ctx, [slit[0] + f * r * 0.1, slit[1]], a, f, [[-r * 0.28, r * 0.07], [r * 0.4, r * 0.01], [r * 0.4, -r * 0.06], [-r * 0.28, -r * 0.02]], '#ff5a6e', 0);
      line(ctx, [h[0] + f * r * 0.6, h[1] - r * 0.2], [h[0] + f * r * 0.5, h[1] - r * 0.95], '#15121a', 3 * s);
    },
    sword(ctx, J, time) {
      const s = J.s, a = J.wp, h = J.haF, n = a + Math.PI / 2, butt = ptAt(h, J, a + Math.PI, 26 * s), guard = ptAt(h, J, a, 20 * s), tip = ptAt(h, J, a, 142 * s), sh = ptAt(h, J, a, 122 * s);
      line(ctx, butt, guard, INK, 11 * s); line(ctx, butt, guard, '#3a2a22', 6 * s); disc(ctx, butt, 6 * s, '#b8923a', 3);
      const P = [ptAt(guard, J, n, 11 * s), ptAt(sh, J, n, 8 * s), tip, ptAt(sh, J, n + Math.PI, 8 * s), ptAt(guard, J, n + Math.PI, 11 * s)];
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (const q of P.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); inked(ctx, '#3d3846', 5);
      line(ctx, ptAt(guard, J, a, 6 * s), ptAt(h, J, a, 116 * s), '#c8243c', 3.5 * s); glow(ctx, ptAt(h, J, a, 80 * s), 44 * s, 'rgba(230,40,70,0.9)', 0.28 + Math.sin(time * 3) * 0.08);
      line(ctx, ptAt(guard, J, n, 24 * s), ptAt(guard, J, n + Math.PI, 24 * s), INK, 12 * s); line(ctx, ptAt(guard, J, n, 23 * s), ptAt(guard, J, n + Math.PI, 23 * s), '#b8923a', 6 * s);
    },
  },
};

// Draws one fighter. `tint` covers hit flashes and status effects without touching the skin code.
export function drawFighter(ctx, id, J, R, view, time, tint) {
  ctx.save(); if (tint && ctx.filter !== undefined) ctx.filter = tint;
  SKINS[id].draw(ctx, J, R, view, time); ctx.restore();
}
