// CINDER — The Ash Wraith. Fast pressure: a quick fireball, a chain that drags the opponent in, and a teleport that is punishable if read.
import { fighter, normal, special } from './common.js';

const burn = { burn: 110 };
export default fighter({
  id: 'cinder', name: 'CINDER', title: 'The Ash Wraith', style: 'Rushdown', difficulty: 2, accent: '#ff6a2a',
  blurb: 'A masked infernal assassin. Stays in your face with fast strings, a dragging chain and a teleport.',
  health: 950, walkF: 5, walkB: 3.7, jump: { vy: 18, vx: 5.6 }, dashF: { frames: 15, speed: 12.5 }, dashB: { frames: 17, speed: 10.5, inv: 7 }, box: { w: 62, h: 198, crouch: 126 },
  rig: { scale: 1.14, leg: 92, torso: 64, arm: 74, head: 27, chest: 46, waist: 32 },
  poses: {
    stance: { hip: [0, 0.9], lean: 16, head: -8, fa: [0.6, 0], ba: [-0.1, -0.15], ff: [0.3, 0], bf: [-0.3, 0], wp: 70 },
    crouch: { hip: [0, 0.5], lean: 26, head: -16, fa: [0.5, 0.2], ba: [0, 0], ff: [0.42, 0], bf: [-0.38, 0], wp: 60 },
    win: { hip: [0, 0.96], lean: -6, head: -12, fa: [0.25, 1], ba: [-0.3, -0.2], ff: [0.22, 0], bf: [-0.22, 0], wp: 100 },
    intro: { hip: [0, 0.6], lean: 30, head: 20, fa: [0.3, -0.5], ba: [-0.2, -0.5], ff: [0.36, 0], bf: [-0.34, 0], wp: -40 },
  },
  ai: { profile: 'aggressive', pokes: ['5M', '2M', '5L'], antiAir: '2H', projectile: '5S', gapCloser: '6S', reversal: '2S', mixup: ['6H', '2L', 'throw', '4S'] },
  moves: {
    '5L': normal('L', 'Hook Jab', [5, 3, 8], 'mid', 32, [24, 100, 118, 50], { wind: { fa: [0.3, 0.1], lean: 10 }, hit: { hip: [10, 0.88], lean: 20, fa: [0.85, 0.1], ba: [-0.35, -0.1], wp: 35 } }, { cancel: ['M', 'H', 'special', 'super'], fx: 'slash', sfx: 'swingL' }),
    '5M': normal('M', 'Ember Slash', [8, 4, 13], 'mid', 58, [24, 72, 150, 72], { wind: { lean: 4, fa: [0.1, 0.45], ba: [0.4, 0], wp: 150 }, hit: { hip: [14, 0.8], lean: 24, fa: [0.95, -0.05], ba: [-0.5, 0.2], wp: -20, ff: [0.5, 0] } }, { cancel: ['H', 'special', 'super'], fx: 'slash', sfx: 'swingM' }),
    '5H': normal('H', 'Chain Lash', [13, 5, 22], 'mid', 92, [30, 50, 170, 104], { wind: { hip: [-8, 0.86], lean: -10, fa: [-0.3, 0.85], ba: [0.4, 0.1], wp: 160 }, hit: { hip: [22, 0.74], lean: 34, fa: [1, -0.2], ba: [-0.6, 0.3], ff: [0.62, 0], wp: -30 } }, { cancel: ['special', 'super'], fx: 'slash', sfx: 'swingH', status: burn }),
    '2L': normal('L', 'Ankle Kick', [6, 3, 9], 'low', 28, [18, 0, 100, 42], { hit: { hip: [-4, 0.5], lean: 6, ff: [0.95, 0.06], fa: [0.2, 0.3], ba: [-0.3, 0.1] } }, { crouch: true, cancel: ['M', 'H', 'special'], sfx: 'swingL' }),
    '2M': normal('M', 'Low Reap', [9, 4, 16], 'low', 52, [18, 0, 150, 52], { wind: { hip: [0, 0.5], lean: 20, fa: [0.2, 0.2], wp: 120 }, hit: { hip: [10, 0.46], lean: 36, fa: [1, -0.45], ba: [-0.4, 0.2], wp: -10, ff: [0.6, 0] } }, { crouch: true, cancel: ['special', 'super'], fx: 'slash', sfx: 'swingM' }),
    '2H': normal('H', 'Rising Cinder', [9, 5, 26], 'mid', 84, [6, 70, 92, 156], { wind: { hip: [0, 0.5], lean: 26, fa: [0.3, -0.5], wp: -60 }, hit: { hip: [8, 1], lean: -8, head: -14, fa: [0.45, 0.95], ba: [-0.5, -0.2], ff: [0.3, 0.12], bf: [-0.2, 0], wp: 95 } }, { launch: [2.5, 17], cancel: ['jump', 'special', 'super'], fx: 'fire', sfx: 'swingH', status: burn }),
    '6H': normal('H', 'Headsman', [22, 4, 20], 'overhead', 86, [18, 40, 140, 150], { wind: { hip: [0, 0.98], lean: -12, fa: [0, 1], ba: [0.2, 0.7], wp: 120, ff: [0.3, 0.1] }, hit: { hip: [18, 0.7], lean: 38, fa: [0.9, -0.4], ba: [0.6, -0.5], wp: -50, ff: [0.6, 0] } }, { fx: 'slash', sfx: 'swingH', feint: true }),
    jL: normal('L', 'Air Jab', [5, 8, 6], 'overhead', 34, [10, 70, 130, 70], { hit: { lean: 14, fa: [0.95, -0.1], ff: [0.3, 0.35], bf: [-0.3, 0.4], wp: 0 } }, { air: true, cancel: ['M', 'H'], fx: 'slash', sfx: 'swingL' }),
    jM: normal('M', 'Wraith Kick', [7, 6, 8], 'overhead', 56, [10, 0, 112, 84], { hit: { lean: 20, ff: [0.9, 0.25], bf: [-0.2, 0.5], fa: [0.2, 0.5], ba: [-0.5, 0.5] } }, { air: true, cancel: ['H', 'special'], sfx: 'swingM' }),
    jH: normal('H', 'Falling Edge', [9, 6, 10], 'overhead', 80, [0, -20, 124, 124], { wind: { fa: [0.1, 1], wp: 120 }, hit: { lean: 36, fa: [0.8, -0.6], ba: [0.5, -0.6], wp: -70, ff: [0.1, 0.5], bf: [-0.4, 0.5] } }, { air: true, bounce: 'ground', cancel: ['special'], fx: 'slash', sfx: 'swingH' }),
    '5S': special('Ember Shot', [14, 1, 27], { cmd: 'S', note: 'Fast fireball. One on screen at a time.', limit: 'ember', sfx: 'fireCast', anim: { wind: { hip: [-8, 0.84], lean: 2, fa: [0.1, 0.3], ba: [-0.6, 0.2] }, hit: { hip: [12, 0.8], lean: 22, ba: [0.95, 0.1], fa: [0.3, -0.2] } },
      events: [{ f: 14, type: 'projectile', def: { kind: 'ember', look: 'fire', speed: 11.5, w: 46, h: 30, y: 122, damage: 62, hitstun: 18, blockstun: 14, level: 'mid', life: 100, status: burn, fx: 'fire', pushHit: 5 }, ex: { speed: 15, hits: 2, damage: 48, knockdown: true } }], ex: { startup: 11 } }),
    '6S': special('Scorching Chain', [17, 5, 28], { cmd: '→ + S', note: 'Long chain thrust that drags the opponent in. Very unsafe if blocked.', box: [56, 96, 304, 38], damage: 70, pull: 105, hitstun: 36, blockstun: 16, status: burn, fx: 'fire', sfx: 'chain', chainFx: true, cancel: ['super'],
      anim: { wind: { hip: [-10, 0.86], lean: -6, fa: [-0.4, 0.5], wp: 170 }, hit: { hip: [24, 0.76], lean: 30, fa: [1, 0.1], wp: 5, ff: [0.6, 0] } }, ex: { startup: 13, armor: { from: 1, to: 13, hits: 1 } } }),
    '4S': special('Hellstep', [14, 1, 15], { cmd: '← + S', note: 'Teleport behind the opponent. Hold ← to retreat or ↑ to appear above. Punishable on arrival.', invuln: [6, 15], vanish: [7, 13], keepFacing: true, sfx: 'teleport', level: 'mid',
      anim: { keys: [[0, {}], [6, { hip: [0, 0.6], lean: 30, fa: [0.2, -0.2] }], [14, { hip: [0, 0.68], lean: 22, fa: [0.3, 0.3] }], [30, {}]] }, events: [{ f: 14, type: 'teleport', look: 'fire' }],
      ex: { active: 4, recovery: 16, box: [6, 40, 108, 124], damage: 70, launch: [3, 13], fx: 'fire' } }),
    '2S': special('Flame Burst', [9, 6, 30], { cmd: '↓ + S', note: 'Close eruption that launches. A strong answer to pressure, but slow to recover.', box: [-34, 0, 156, 176], damage: 88, launch: [4, 15], status: burn, fx: 'fire', sfx: 'fireBurst', cancel: ['super'], events: [{ f: 9, type: 'fx', look: 'flamePillar' }],
      anim: { wind: { hip: [0, 0.5], lean: 30, fa: [0.2, -0.4], ba: [0.1, -0.4] }, hit: { hip: [0, 0.98], lean: -6, fa: [0.5, 0.9], ba: [-0.5, 0.9], ff: [0.4, 0], bf: [-0.4, 0] } }, ex: { invuln: [1, 12] } }),
    jS: special('Ashfall', [10, 26, 4], { cmd: 'S in the air', note: 'Diving kick. Bounces an airborne opponent off the ground.', air: true, hang: false, box: [0, -24, 84, 104], damage: 76, hitstun: 22, bounce: 'ground', landLag: 16, motion: [[1, 9, 1, 3], [10, 40, 13, -17]], fx: 'fire', sfx: 'dive', status: burn,
      anim: { wind: { lean: -10, ff: [0.2, 0.5], bf: [-0.1, 0.5], fa: [0.2, 0.7] }, hit: { lean: 40, ff: [0.9, 0], bf: [-0.1, 0.5], fa: [-0.3, 0.6], ba: [-0.6, 0.4] } } }),
    super: { kind: 'super', name: 'Inferno Break', cmd: 'H + S (2 bars)', note: 'Invulnerable lunge. On hit, a storm of fire.', level: 'mid', startup: 9, active: 8, recovery: 34, invuln: [1, 16], motion: [[9, 17, 26]], box: [16, 40, 156, 136], damage: 40, hitstun: 30, blockstun: 22, pushBlock: 4, hitstop: 12, heavy: true, fx: 'fire', sfx: 'superHit', passThrough: false,
      anim: { wind: { hip: [-12, 0.7], lean: 10, fa: [-0.3, 0.2], ba: [-0.5, 0.4] }, hit: { hip: [30, 0.74], lean: 36, fa: [1, 0.1], ff: [0.7, 0], wp: 0 } },
      cine: { frames: 96, gap: 120, fx: 'fire', launch: [9, 13], hits: [[16, 50, 'fire'], [28, 50, 'slash'], [40, 50, 'fire'], [52, 50, 'slash'], [80, 130, 'fire']],
        keys: [[0, { hip: [20, 0.76], lean: 30, fa: [1, 0.1], wp: 0 }], [16, { hip: [10, 0.8], lean: 20, fa: [0.9, -0.3], wp: -40 }], [28, { hip: [16, 0.84], lean: 10, fa: [0.7, 0.7], wp: 110 }], [40, { hip: [12, 0.7], lean: 34, fa: [1, -0.2], wp: -20 }], [52, { hip: [0, 0.9], lean: -8, fa: [0.4, 0.9], wp: 120 }], [66, { hip: [-20, 0.6], lean: 20, fa: [-0.2, 0.2], ba: [-0.5, 0.3] }], [80, { hip: [30, 0.9], lean: 30, fa: [1, 0.5], ba: [0.9, 0.3], wp: 40 }], [96, {}]] } },
  },
});
