// RIME — The Frostbound. Controls space: a slow ice lance, a ground eruption that freezes, a counter stance and an ice decoy.
import { fighter, normal, special } from './common.js';

const chill = { chill: 150 };
export default fighter({
  id: 'rime', name: 'RIME', title: 'The Frostbound', style: 'Zoning and counters', difficulty: 3, accent: '#8fe3ff',
  blurb: 'A disciplined ice warrior. Keeps opponents out, punishes mistakes and freezes whatever walks into the wrong spot.',
  health: 1050, walkF: 3.9, walkB: 3, jump: { vy: 17.2, vx: 4.7 }, dashF: { frames: 18, speed: 10.5 }, dashB: { frames: 19, speed: 9.5, inv: 6 }, box: { w: 70, h: 210, crouch: 136 },
  rig: { scale: 1.16, leg: 90, torso: 72, arm: 76, head: 27, chest: 62, waist: 42, shoulder: 15, hand: 10, limb: { thigh: [16, 13], shin: [13, 10], upper: [12, 10], fore: [13, 11] } },
  poses: {
    stance: { hip: [0, 0.93], lean: 4, head: 0, fa: [0.5, 0.3], ba: [0.3, 0.12], ff: [0.28, 0], bf: [-0.26, 0] },
    crouch: { hip: [0, 0.55], lean: 14, head: -8, fa: [0.45, 0.4], ba: [0.3, 0.25], ff: [0.38, 0], bf: [-0.34, 0] },
    block: { hip: [-4, 0.92], lean: -4, head: 4, fa: [0.3, 0.45], ba: [0.36, 0.3], ff: [0.28, 0], bf: [-0.28, 0] },
    win: { hip: [0, 0.98], lean: -4, head: -6, fa: [0.25, 0.05], ba: [0.3, -0.05], ff: [0.2, 0], bf: [-0.2, 0] },
    intro: { hip: [0, 0.5], lean: 20, head: 18, fa: [0.2, -0.5], ba: [0.1, -0.5], ff: [0.4, 0], bf: [-0.3, 0] },
  },
  ai: { profile: 'ranged', pokes: ['5M', '5H', '2L'], antiAir: '2H', projectile: '5S', trap: '6S', counter: '4S', reversal: '4S', mixup: ['6H', '2M', 'throw'] },
  moves: {
    '5L': normal('L', 'Frost Jab', [6, 3, 9], 'mid', 36, [24, 112, 116, 46], { hit: { hip: [8, 0.93], lean: 12, fa: [1, 0.22], ba: [0.1, 0.1] } }, { cancel: ['M', 'H', 'special', 'super'], fx: 'ice', sfx: 'swingL' }),
    '5M': normal('M', 'Shard Cross', [9, 4, 15], 'mid', 64, [24, 92, 134, 62], { wind: { lean: -4, fa: [0.2, 0.35], ba: [-0.2, 0.3] }, hit: { hip: [16, 0.88], lean: 22, ba: [1, 0.1], fa: [-0.2, 0.3], ff: [0.42, 0] } }, { cancel: ['H', 'special', 'super'], fx: 'ice', sfx: 'swingM' }),
    '5H': normal('H', 'Glacier Kick', [14, 5, 24], 'mid', 100, [24, 70, 150, 76], { wind: { hip: [-6, 0.95], lean: -8, ff: [0.2, 0.4], fa: [0.3, 0.4] }, hit: { hip: [10, 0.95], lean: -18, ff: [1.05, 0.72], fa: [0.2, 0.5], ba: [-0.5, 0.3] } }, { cancel: ['special', 'super'], sfx: 'swingH', status: chill }),
    '2L': normal('L', 'Shin Tap', [6, 3, 10], 'low', 30, [20, 0, 106, 42], { hit: { hip: [-4, 0.55], ff: [0.98, 0.05], lean: 4 } }, { crouch: true, cancel: ['M', 'H', 'special'], sfx: 'swingL' }),
    '2M': normal('M', 'Ice Sweep', [10, 5, 18], 'low', 56, [20, 0, 152, 46], { hit: { hip: [-6, 0.42], lean: -12, ff: [1.15, 0.03], fa: [-0.3, -0.2], ba: [-0.6, 0] } }, { crouch: true, knockdown: true, sfx: 'swingM' }),
    '2H': normal('H', 'Winter Rise', [10, 5, 28], 'mid', 90, [6, 60, 104, 176], { wind: { hip: [0, 0.55], lean: 24, fa: [0.3, -0.5] }, hit: { hip: [6, 1], lean: -10, fa: [0.4, 1], ba: [-0.4, -0.1], ff: [0.3, 0.08] } }, { launch: [2, 16.5], cancel: ['jump', 'special', 'super'], fx: 'ice', sfx: 'swingH' }),
    '6H': normal('H', 'Avalanche', [24, 4, 22], 'overhead', 92, [18, 40, 132, 156], { wind: { hip: [0, 0.98], lean: -14, fa: [0.1, 1], ba: [0, 0.95] }, hit: { hip: [16, 0.7], lean: 40, fa: [0.9, -0.3], ba: [0.85, -0.4] } }, { fx: 'ice', sfx: 'swingH' }),
    jL: normal('L', 'Air Jab', [6, 8, 6], 'overhead', 36, [10, 60, 120, 62], { hit: { lean: 10, fa: [1, -0.05] } }, { air: true, cancel: ['M', 'H'], fx: 'ice', sfx: 'swingL' }),
    jM: normal('M', 'Frost Knee', [8, 6, 8], 'overhead', 58, [10, 0, 118, 84], { hit: { lean: 16, ff: [0.85, 0.3], bf: [-0.3, 0.45] } }, { air: true, cancel: ['H'], sfx: 'swingM' }),
    jH: normal('H', 'Hailstone', [10, 6, 10], 'overhead', 84, [0, -20, 120, 124], { wind: { fa: [0.1, 1], ba: [0, 0.95] }, hit: { lean: 36, fa: [0.8, -0.6], ba: [0.75, -0.65] } }, { air: true, bounce: 'ground', fx: 'ice', sfx: 'swingH' }),
    '5S': special('Frost Lance', [18, 1, 28], { cmd: 'S', note: 'Slow ice projectile that chills. Enhanced: freezes briefly.', limit: 'lance', sfx: 'iceCast', anim: { wind: { hip: [-10, 0.92], lean: -8, fa: [-0.3, 0.4], ba: [0.4, 0.3] }, hit: { hip: [14, 0.9], lean: 20, fa: [1, 0.15], ba: [-0.4, 0.1] } },
      events: [{ f: 18, type: 'projectile', def: { kind: 'lance', look: 'ice', speed: 8.5, w: 62, h: 24, y: 126, damage: 58, hitstun: 20, blockstun: 15, level: 'mid', life: 130, status: chill, fx: 'ice', pushHit: 5 }, ex: { speed: 11.5, status: { chill: 150, freeze: 42 } } }], ex: { startup: 15 } }),
    '6S': special('Ice Prison', [24, 6, 30], { cmd: '→ + S', note: 'Ice erupts a short way ahead and freezes. A target cannot be frozen twice in one combo.', box: [190, 0, 120, 156], damage: 30, hitstun: 10, blockstun: 16, status: { freeze: 56 }, fx: 'ice', sfx: 'iceBurst', hitstop: 6,
      events: [{ f: 6, type: 'fx', look: 'iceWarn', x: 250 }, { f: 24, type: 'fx', look: 'icePillar', x: 250 }], anim: { wind: { hip: [0, 0.62], lean: 26, fa: [0.5, -0.6], ba: [0.3, -0.6] }, hit: { hip: [4, 0.58], lean: 30, fa: [0.62, -0.72], ba: [0.4, -0.7] } }, ex: { startup: 18, box: [120, 0, 230, 156] } }),
    '4S': special('Glacier Counter', [3, 20, 24], { cmd: '← + S', note: 'Stance that answers a high, mid or overhead strike. Loses to lows and throws.', counter: { from: 3, to: 22, catches: ['high', 'mid', 'overhead'], then: 'counterHit' }, sfx: 'stance', stance: 'ice',
      anim: { keys: [[0, {}], [3, { hip: [-4, 0.9], lean: -6, fa: [0.4, 0.35], ba: [0.42, 0.2] }], [23, { hip: [-4, 0.9], lean: -6, fa: [0.4, 0.35], ba: [0.42, 0.2] }], [47, {}]] } }),
    counterHit: special('Glacier Counter', [4, 4, 22], { hidden: true, box: [10, 40, 156, 136], damage: 120, launch: [6, 13], invuln: [0, 8], fx: 'ice', sfx: 'iceBurst', status: chill, anim: { hit: { hip: [14, 0.85], lean: 26, fa: [1, 0.2], ba: [0.9, 0] } } }),
    '2S': special('Frozen Echo', [12, 1, 20], { cmd: '↓ + S', note: 'Leaves an ice decoy and slides back. The decoy soaks one hit and shatters over anything close.', motion: [[12, 22, -9]], sfx: 'iceCast',
      events: [{ f: 12, type: 'object', def: { type: 'decoy', x: 24, w: 70, h: 190, life: 210, solid: true, burst: { range: 135, damage: 40, level: 'mid', hitstun: 18, blockstun: 12, status: chill, fx: 'ice' } } }],
      anim: { wind: { hip: [0, 0.8], lean: 10, fa: [0.5, 0.5], ba: [0.5, 0.2] }, hit: { hip: [-10, 0.9], lean: -10, fa: [0.6, 0.3], ba: [0.2, 0.2] } } }),
    super: { kind: 'super', name: 'Absolute Winter', cmd: 'H + S (2 bars)', note: 'A wave of frost along the ground. Jump it or block it.', level: 'mid', startup: 12, active: 20, recovery: 40, invuln: [1, 6], box: [40, 0, 520, 120], damage: 30, hitstun: 30, blockstun: 22, pushBlock: 5, hitstop: 12, heavy: true, fx: 'ice', sfx: 'superHit',
      events: [{ f: 12, type: 'fx', look: 'frostWave', x: 60 }], anim: { wind: { hip: [0, 0.98], lean: -12, fa: [0.2, 1], ba: [0.1, 0.95] }, hit: { hip: [10, 0.6], lean: 34, fa: [0.7, -0.7], ba: [0.6, -0.7] } },
      cine: { frames: 100, gap: 190, fx: 'ice', freeze: true, launch: [10, 13], hits: [[20, 40, 'ice'], [40, 40, 'ice'], [60, 60, 'ice'], [88, 150, 'ice']],
        keys: [[0, { hip: [10, 0.6], lean: 34, fa: [0.7, -0.7], ba: [0.6, -0.7] }], [20, { hip: [0, 0.96], lean: -6, fa: [0.6, 0.6], ba: [0.5, 0.5] }], [40, { hip: [0, 0.96], lean: -8, fa: [0.3, 0.9], ba: [0.3, 0.85] }], [60, { hip: [0, 0.9], lean: 4, fa: [0.5, 0.3], ba: [0.5, 0.2] }], [78, { hip: [-14, 0.8], lean: -10, fa: [-0.4, 0.3], ba: [0.3, 0.2] }], [88, { hip: [20, 0.86], lean: 28, fa: [1, 0.2], ba: [-0.4, 0.1] }], [100, {}]] } },
  },
});
