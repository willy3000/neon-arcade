// Chooses the pose a fighter should be in on this frame. Attacks are driven by the move's own frame count, so the wind-up,
// the strike and the recovery always line up with the hitbox; everything else eases between named poses.
import { mix, over, sample, ease, lerp } from './rig.js';

const named = (P, p) => (typeof p === 'string' ? P[p] : p);

export function attackPose(P, m, mf) {
  const a = m.anim || {}, base = over(P.stance, m.air ? mix(P.rise, P.fall, 0.5) : m.crouch ? P.crouch : {});
  if (a.keys) return sample(a.keys, mf, base);
  const hit = over(base, named(P, a.hit) || {}), wind = a.wind ? over(base, named(P, a.wind)) : over(base, { fa: [(base.fa[0] - 0.3), base.fa[1] + 0.1], lean: base.lean - 6 }), rec = a.rec ? over(base, named(P, a.rec)) : null;
  const st = m.startup, act = m.active;
  if (mf < st) { const w = Math.max(1, Math.round(st * 0.62)); return mf <= w ? mix(base, wind, ease.out(mf / w)) : mix(wind, hit, ease.in((mf - w) / (st - w))); }
  if (mf < st + act) return rec ? mix(hit, rec, (mf - st) / act * 0.35) : hit;
  const r = (mf - st - act) / Math.max(1, m.recovery), follow = rec || hit;
  return r < 0.4 ? mix(hit, follow, r / 0.4) : mix(follow, base, ease.inOut((r - 0.4) / 0.6));
}

// The pose for a fighter this frame. `view` remembers how the last hit landed so reactions match it.
export function targetPose(f, fight, time, view) {
  const P = f.def.poses, S = P.stance, o = fight.fighters[1 - f.side], st = n => over(S, P[n]);
  switch (f.state) {
    case 'idle': { const b = Math.sin(time * 2.6 + f.side * 2); return over(S, { hip: [S.hip[0], S.hip[1] + b * 0.012], fa: [S.fa[0], S.fa[1] + b * 0.03], ba: [S.ba[0], S.ba[1] - b * 0.025], head: (S.head || 0) + b * 1.5 }); }
    case 'walk': { const ph = f.t * 0.22 * (f.walkDir || 1), sw = Math.sin(ph), c = Math.cos(ph); return over(S, { hip: [S.hip[0] + (f.walkDir > 0 ? 4 : -4), S.hip[1] + Math.abs(c) * 0.02], lean: (S.lean || 0) + (f.walkDir > 0 ? 4 : -6), ff: [S.ff[0] + sw * 0.24, Math.max(0, c * 0.12)], bf: [S.bf[0] - sw * 0.24, Math.max(0, -c * 0.12)], fa: [S.fa[0] - sw * 0.05, S.fa[1]], ba: [S.ba[0] + sw * 0.08, S.ba[1]] }); }
    case 'crouch': return st('crouch');
    case 'prejump': return st('prejump');
    case 'air': return mix(st('rise'), st('fall'), Math.max(0, Math.min(1, (4 - f.vy) / 12)));
    case 'land': return mix(st('land'), S, ease.out(Math.min(1, f.t / Math.max(1, f.stun))));
    case 'dash': return f.dashDir > 0 ? st('dashF') : st('dashB');
    case 'block': return st(f.low ? 'blockLow' : 'block');
    case 'blockstun': { const p = st(f.low ? 'blockLow' : 'block'), k = Math.max(0, 1 - f.t / 8); return over(p, { hip: [p.hip[0] - 12 * k, p.hip[1]], lean: p.lean - 8 * k }); }
    case 'hitstun': { const kind = f.low ? 'hitLow' : view.hitKind === 'gut' ? 'hitGut' : 'hitHigh', k = f.t / (f.t + f.stun + 0.01); return mix(st(kind), f.low ? st('crouch') : S, k < 0.55 ? 0 : ease.inOut((k - 0.55) / 0.45)); }
    case 'airhit': { const p = st('airhit'); return over(p, { rot: Math.max(-170, -30 - f.t * 7) * (f.vx * f.facing > 0.5 ? -0.4 : 1) }); }
    case 'ko': case 'knockdown': { const p = st('knockdown'), b = f.t < 8 ? Math.sin(f.t / 8 * Math.PI) * 0.1 : 0; return over(p, { hip: [p.hip[0], p.hip[1] + b] }); }
    case 'getup': return sample([[0, P.knockdown], [8, P.getup, 'out'], [18, {}, 'inOut']], f.t, S);
    case 'frozen': return st('frozen');
    case 'stagger': { const p = st('stagger'); return over(p, { lean: p.lean + Math.sin(f.t * 0.35) * 8, hip: [p.hip[0] + Math.sin(f.t * 0.35) * 6, p.hip[1]] }); }
    case 'throwing': { const g = f.grab; if (!g) return S; return sample([[0, P.grab], [g.at * 0.55, P.grabLift, 'out'], [g.at, g.back ? over(P.grabLift, { lean: -30, hip: [-20, 0.9] }) : P.grabSlam, 'in'], [g.total, {}, 'inOut']], f.t, S); }
    case 'thrown': { const g = o.grab, k = g ? Math.min(1, o.t / g.at) : 0; return over(st('thrown'), { y: Math.sin(k * Math.PI * 0.9) * 70, rot: -k * 60 }); }
    case 'attack': return attackPose(P, f.move, f.mf);
    case 'intro': return sample([[0, P.intro], [56, P.intro], [88, {}, 'inOut']], f.t, S);
    case 'win': { const b = Math.sin(time * 3) * 0.02; return mix(S, over(st('win'), { hip: [P.win.hip[0], P.win.hip[1] + b] }), ease.back(Math.min(1, f.t / 22))); }
    case 'cine': { const k = fight.cine; if (!k) return S; if (k.att === f) return sample(k.c.keys, k.t, S); const flip = Math.floor(k.t / 7) % 2; return over(st(flip ? 'hitGut' : 'hitHigh'), { hip: [(flip ? -14 : -6), 0.86], y: Math.abs(Math.sin(k.t * 0.5)) * 6 }); }
    default: return S;
  }
}

// Eases the drawn pose toward the target so transitions (turning, landing, recovering) get in-between frames.
export function animate(f, fight, time, view) {
  const target = targetPose(f, fight, time, view), snap = f.state === 'attack' || f.state === 'cine' || f.state === 'throwing' || f.state === 'thrown' || view.state !== f.state && (f.state === 'hitstun' || f.state === 'airhit' || f.state === 'blockstun' || f.state === 'frozen');
  const rate = snap ? 1 : f.state === 'idle' || f.state === 'walk' ? 0.34 : 0.5;
  view.pose = view.pose && rate < 1 ? mix(view.pose, target, rate) : target; view.state = f.state;
  return view.pose;
}
