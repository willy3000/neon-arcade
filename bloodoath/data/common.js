// Shared building blocks for fighter data: default body proportions, the poses every fighter has, and helpers that fill in
// sensible frame data so each move only has to state what makes it different.
export const BASE_RIG = { scale: 1, leg: 92, torso: 66, arm: 74, head: 27, shoulder: 13, hipW: 7, foot: 9, bootLen: 22, hand: 9, chest: 46, waist: 32, limb: { thigh: [14, 11], shin: [11, 8], upper: [10, 8.5], fore: [9.5, 8] } };

// Poses shared by all fighters. A fighter overrides any of these in its own `poses` to get its own stance and attitude.
export const BASE_POSES = {
  stance: { hip: [0, 0.9], lean: 10, head: -4, fa: [0.62, 0.12], ba: [0.25, -0.05], ff: [0.34, 0], bf: [-0.3, 0], wp: 55 },
  crouch: { hip: [0, 0.52], lean: 22, head: -14, fa: [0.5, 0.25], ba: [0.2, 0.1], ff: [0.4, 0], bf: [-0.36, 0], wp: 50 },
  block: { hip: [-5, 0.88], lean: -3, head: 6, fa: [0.34, 0.5], ba: [0.3, 0.28], ff: [0.3, 0], bf: [-0.34, 0], wp: 96 },
  blockLow: { hip: [-5, 0.5], lean: 12, head: 2, fa: [0.44, 0.34], ba: [0.34, 0.12], ff: [0.4, 0], bf: [-0.36, 0], wp: 100 },
  prejump: { hip: [0, 0.62], lean: 16, fa: [0.2, -0.4], ba: [-0.2, -0.5], ff: [0.3, 0], bf: [-0.28, 0] },
  rise: { hip: [0, 1], lean: 6, head: -10, fa: [0.4, 0.55], ba: [-0.25, 0.35], ff: [0.26, 0.4], bf: [-0.12, 0.26] },
  fall: { hip: [0, 1], lean: 2, head: 6, fa: [0.5, 0.75], ba: [-0.45, 0.6], ff: [0.3, 0.16], bf: [-0.3, 0.34] },
  land: { hip: [0, 0.6], lean: 20, fa: [0.4, -0.3], ba: [-0.1, -0.4], ff: [0.36, 0], bf: [-0.32, 0] },
  dashF: { hip: [20, 0.76], lean: 34, head: -18, fa: [0.2, -0.35], ba: [-0.75, 0.05], ff: [0.78, 0.04], bf: [-0.72, 0.1] },
  dashB: { hip: [-16, 0.86], lean: -14, head: 8, fa: [0.5, 0.3], ba: [0.2, 0.2], ff: [0.36, 0.14], bf: [-0.48, 0.02] },
  hitHigh: { hip: [-10, 0.9], lean: -26, head: -24, fa: [0.15, 0.5], ba: [-0.55, 0.3], ff: [0.3, 0], bf: [-0.38, 0], wp: 120 },
  hitGut: { hip: [-12, 0.8], lean: 36, head: 22, fa: [0.34, -0.35], ba: [0.18, -0.45], ff: [0.26, 0], bf: [-0.36, 0], wp: 10 },
  hitLow: { hip: [-10, 0.5], lean: -8, head: -18, fa: [0.2, 0.4], ba: [-0.4, 0.3], ff: [0.42, 0], bf: [-0.3, 0] },
  airhit: { hip: [0, 1], lean: -14, head: -20, fa: [-0.3, 0.75], ba: [-0.65, 0.4], ff: [0.5, 0.45], bf: [0.1, 0.62], wp: 140 },
  knockdown: { hip: [-10, 0.14], rot: -90, lean: 0, head: 10, fa: [0.3, -0.25], ba: [-0.25, -0.3], ff: [0.14, -0.8], bf: [-0.1, -0.74], wp: -20 },
  getup: { hip: [-4, 0.44], rot: -20, lean: 30, head: 10, fa: [0.4, -0.5], ba: [0.1, -0.55], ff: [0.36, 0], bf: [-0.3, 0] },
  thrown: { hip: [0, 0.96], lean: -22, head: -24, fa: [0.1, -0.55], ba: [-0.2, -0.5], ff: [0.12, 0.1], bf: [-0.1, 0.04], wp: -40 },
  frozen: { hip: [0, 0.92], lean: -2, head: -8, fa: [0.42, 0.62], ba: [-0.3, 0.5], ff: [0.32, 0], bf: [-0.3, 0], wp: 80 },
  stagger: { hip: [-6, 0.8], lean: 22, head: 26, fa: [0.25, -0.5], ba: [-0.1, -0.55], ff: [0.22, 0], bf: [-0.3, 0], wp: -30 },
  grab: { hip: [14, 0.84], lean: 20, fa: [0.9, 0.2], ba: [0.8, 0.0], ff: [0.5, 0], bf: [-0.34, 0] },
  grabLift: { hip: [-4, 0.92], lean: -14, fa: [0.6, 0.7], ba: [0.5, 0.55], ff: [0.3, 0], bf: [-0.3, 0] },
  grabSlam: { hip: [22, 0.66], lean: 44, head: 10, fa: [0.85, -0.45], ba: [0.7, -0.55], ff: [0.6, 0], bf: [-0.4, 0] },
  win: { hip: [0, 0.98], lean: -4, head: -10, fa: [0.2, 0.95], ba: [-0.2, -0.3], ff: [0.2, 0], bf: [-0.2, 0], wp: 90 },
  intro: { hip: [0, 0.96], lean: 0, head: 4, fa: [0.1, -0.6], ba: [-0.1, -0.6], ff: [0.16, 0], bf: [-0.16, 0], wp: -70 },
};

const DEFAULTS = {
  L: { hitstun: 15, blockstun: 11, pushHit: 4.5, pushBlock: 4, hitstop: 5 },
  M: { hitstun: 20, blockstun: 14, pushHit: 6, pushBlock: 5.5, hitstop: 7 },
  H: { hitstun: 25, blockstun: 18, pushHit: 8.5, pushBlock: 7.5, hitstop: 9, heavy: true },
};
// A normal attack. `frames` is [startup, active, recovery]; `box` is [forward, bottom, width, height] from the fighter's feet.
export const normal = (strength, name, frames, level, damage, box, anim, extra = {}) => ({ kind: 'normal', strength, name, startup: frames[0], active: frames[1], recovery: frames[2], level, damage, box, anim, fx: 'blunt', ...DEFAULTS[strength], ...extra });
export const special = (name, frames, extra) => ({ kind: 'special', name, startup: frames[0], active: frames[1], recovery: frames[2], level: 'mid', hitstun: 20, blockstun: 15, pushHit: 6, pushBlock: 6, hitstop: 8, heavy: true, ...extra });

// Moves every fighter has: a throw and the Oath Break combo escape.
export const universal = (throwName = 'Throw') => ({
  throw: { kind: 'throw', name: throwName, level: 'throw', startup: 6, active: 3, recovery: 24, damage: 110, launch: [7, 10], throwAt: 22, throwTotal: 44, anim: { wind: { hip: [4, 0.86], lean: 10, fa: [0.5, 0.3], ba: [0.4, 0.2] }, hit: 'grab' }, fx: 'blunt', sfx: 'grab' },
  breaker: { kind: 'special', name: 'Oath Break', level: 'mid', unblockable: true, unscaled: true, startup: 2, active: 6, recovery: 22, invuln: [0, 30], box: [-120, 0, 240, 230], damage: 0, launch: [10, 9], hitstop: 8, heavy: true, fx: 'burst', sfx: 'burst', anim: { wind: { hip: [0, 0.8], lean: 10, fa: [0.2, -0.2], ba: [-0.1, -0.3] }, hit: { hip: [0, 1], lean: -8, head: -16, fa: [0.7, 0.75], ba: [-0.7, 0.7], ff: [0.4, 0], bf: [-0.4, 0] } } },
});
export const fighter = def => ({ ...def, rig: { ...BASE_RIG, ...def.rig, limb: { ...BASE_RIG.limb, ...def.rig?.limb } }, poses: { ...BASE_POSES, ...def.poses }, moves: { ...universal(def.throwName), ...def.moves } });
