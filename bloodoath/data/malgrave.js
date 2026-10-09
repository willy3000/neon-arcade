// MALGRAVE — The Oathkeeper. The arcade boss; not selectable. He fights behind an Oath Ward: two charges that each soak a strike
// (half damage, no flinch) and grow back while he is left alone. Throws ignore the ward and a super shatters it. Below 40% health
// the ward refills at once and recharges much faster.
import { fighter, normal, special } from './common.js';

export default fighter({
  id: 'malgrave', name: 'MALGRAVE', title: 'The Oathkeeper', style: 'Boss', difficulty: 4, accent: '#c8243c', boss: true,
  blurb: 'The first to swear and the last still standing. His ward drinks the first blows of every exchange.',
  health: 1250, walkF: 3.8, walkB: 2.9, jump: { vy: 16.8, vx: 4.4 }, dashF: { frames: 18, speed: 10.5 }, dashB: { frames: 19, speed: 9, inv: 5 }, box: { w: 80, h: 226, crouch: 150 },
  rig: { scale: 1.28, leg: 84, torso: 76, arm: 84, head: 25, chest: 74, waist: 50, shoulder: 18, hipW: 10, hand: 11, bootLen: 25, limb: { thigh: [17, 14], shin: [14, 11], upper: [14, 12], fore: [13, 11] } },
  ward: { max: 2, every: 270, rage: 150, rageBelow: 0.4 },
  throwName: 'Broken Vow',
  poses: {
    stance: { hip: [0, 0.95], lean: 8, head: 2, fa: [0.42, 0.02], ba: [0.3, -0.3], ff: [0.32, 0], bf: [-0.3, 0], wp: 64 },
    crouch: { hip: [0, 0.6], lean: 20, head: -6, fa: [0.45, 0.2], ba: [0.3, -0.1], ff: [0.42, 0], bf: [-0.4, 0], wp: 50 },
    block: { hip: [-4, 0.95], lean: 0, head: 6, fa: [0.4, 0.2], ba: [0.45, 0.3], ff: [0.32, 0], bf: [-0.34, 0], wp: 96 },
    blockLow: { hip: [-4, 0.58], lean: 12, fa: [0.45, 0.1], ba: [0.45, 0.1], ff: [0.42, 0], bf: [-0.4, 0], wp: 100 },
    win: { hip: [0, 0.99], lean: -4, head: -8, fa: [0.3, 0.2], ba: [0.2, 0.1], ff: [0.26, 0], bf: [-0.26, 0], wp: -90 },
    intro: { hip: [0, 0.99], lean: 0, head: 8, fa: [0.25, 0.1], ba: [0.2, 0.05], ff: [0.24, 0], bf: [-0.24, 0], wp: -90 },
  },
  ai: { profile: 'boss', pokes: ['5M', '2M', '5L', '5H'], antiAir: '2H', projectile: '5S', gapCloser: '6S', reversal: '2S', mixup: ['6H', '2M', 'throw', '6S', '4S'] },
  moves: {
    '5L': normal('L', 'Pommel Strike', [7, 3, 11], 'mid', 44, [30, 112, 122, 56], { hit: { hip: [10, 0.95], lean: 18, ba: [1, 0.12], fa: [0.2, 0.2] } }, { cancel: ['M', 'H', 'special', 'super'], sfx: 'swingL' }),
    '5M': normal('M', 'Oath Cleave', [10, 4, 17], 'mid', 72, [30, 84, 214, 70], { wind: { fa: [0.05, 0.45], wp: 140 }, hit: { hip: [14, 0.92], lean: 20, fa: [0.9, 0], wp: 0 } }, { cancel: ['H', 'special', 'super'], fx: 'slash', sfx: 'swingM' }),
    '5H': normal('H', 'Judgement Arc', [16, 6, 27], 'mid', 126, [30, 46, 246, 136], { wind: { hip: [-10, 0.95], lean: -8, fa: [-0.3, 0.75], wp: 150 }, hit: { hip: [20, 0.86], lean: 26, fa: [0.95, -0.12], ba: [0.5, -0.2], wp: -12 } }, { cancel: ['super'], launch: [8, 8], fx: 'slash', sfx: 'swingH' }),
    '2L': normal('L', 'Greave Kick', [8, 3, 12], 'low', 36, [24, 0, 118, 46], { hit: { hip: [-4, 0.6], ff: [0.95, 0.05], lean: 8 } }, { crouch: true, cancel: ['M', 'special'], sfx: 'swingL' }),
    '2M': normal('M', 'Reaping Edge', [12, 5, 21], 'low', 68, [24, 0, 232, 52], { wind: { hip: [0, 0.6], lean: 16, fa: [0.1, 0.35], wp: 120 }, hit: { hip: [10, 0.56], lean: 34, fa: [0.92, -0.5], wp: -10 } }, { crouch: true, knockdown: true, fx: 'slash', sfx: 'swingM' }),
    '2H': normal('H', 'Ascension', [11, 5, 30], 'mid', 98, [6, 60, 150, 236], { wind: { hip: [0, 0.6], lean: 26, fa: [0.5, -0.5], wp: -50 }, hit: { hip: [6, 1], lean: -10, fa: [0.4, 0.95], wp: 84 } }, { launch: [2, 16], cancel: ['special', 'super'], fx: 'slash', sfx: 'swingH' }),
    '6H': normal('H', 'Sentence', [24, 5, 25], 'overhead', 108, [20, 20, 226, 226], { wind: { hip: [0, 0.99], lean: -14, fa: [0, 1], ba: [0.2, 0.9], wp: 100 }, hit: { hip: [20, 0.72], lean: 38, fa: [0.9, -0.42], ba: [0.7, -0.4], wp: -30 } }, { bounce: 'ground', launch: [2, 3], fx: 'slash', sfx: 'swingH' }),
    jL: normal('L', 'Knee', [7, 8, 6], 'overhead', 40, [10, 30, 110, 80], { hit: { lean: 16, ff: [0.6, 0.4], fa: [0.2, 0.5] } }, { air: true, cancel: ['M', 'H'], sfx: 'swingL' }),
    jM: normal('M', 'Sky Cleave', [9, 6, 10], 'overhead', 64, [0, 0, 190, 100], { wind: { fa: [0.1, 0.7], wp: 130 }, hit: { lean: 26, fa: [0.9, -0.2], wp: -20 } }, { air: true, fx: 'slash', sfx: 'swingM' }),
    jH: normal('H', 'Falling Verdict', [12, 6, 12], 'overhead', 96, [0, -40, 200, 180], { wind: { fa: [0, 1], wp: 110 }, hit: { lean: 36, fa: [0.8, -0.6], wp: -60 } }, { air: true, bounce: 'ground', fx: 'slash', sfx: 'swingH' }),
    '5S': special('Black Verdict', [20, 2, 28], { cmd: 'S', note: 'A slow, heavy bolt of oathfire.', limit: 'verdict', sfx: 'arcCast', anim: { wind: { hip: [-8, 0.95], lean: -4, fa: [-0.1, 0.6], wp: 130 }, hit: { hip: [14, 0.9], lean: 20, fa: [0.95, 0.1], wp: 8 } },
      events: [{ f: 20, type: 'projectile', def: { kind: 'verdict', look: 'void', speed: 10.5, w: 56, h: 44, x: 120, y: 124, damage: 68, hitstun: 20, blockstun: 15, level: 'mid', life: 110, fx: 'burst', pushHit: 6 }, ex: { speed: 14, hits: 2, damage: 50 } }] }),
    '6S': special('Sundering Step', [22, 5, 27], { cmd: '→ + S', note: 'A long lunge that launches. Very punishable if blocked.', motion: [[6, 22, 12]], trail: true, box: [20, 40, 236, 124], damage: 110, launch: [9, 8], hitstun: 26, blockstun: 16, fx: 'slash', sfx: 'swingH', cancel: ['super'],
      anim: { wind: { hip: [-10, 0.8], lean: 14, fa: [-0.3, 0.3], wp: 170 }, hit: { hip: [26, 0.78], lean: 34, fa: [1, 0.05], ff: [0.62, 0], wp: 2 } }, ex: { startup: 17 } }),
    '4S': special('Oathgate', [16, 1, 18], { cmd: '← + S', note: 'Vanish and step out behind the opponent.', invuln: [6, 17], vanish: [7, 15], keepFacing: true, sfx: 'teleport',
      anim: { keys: [[0, {}], [6, { hip: [0, 0.66], lean: 26, fa: [0.2, -0.2] }], [16, { hip: [0, 0.74], lean: 18, fa: [0.3, 0.2] }], [35, {}]] }, events: [{ f: 16, type: 'teleport', to: 'behind', look: 'fire' }] }),
    '2S': special('Oathfire', [10, 6, 32], { cmd: '↓ + S', note: 'An eruption around him. Launches; slow to recover.', box: [-40, 0, 176, 200], damage: 92, launch: [4, 15], status: { burn: 110 }, fx: 'fire', sfx: 'fireBurst', cancel: ['super'], events: [{ f: 10, type: 'fx', look: 'flamePillar' }],
      anim: { wind: { hip: [0, 0.6], lean: 26, fa: [0.3, -0.4], wp: -90 }, hit: { hip: [0, 0.99], lean: -6, fa: [0.3, 0.3], ba: [-0.5, 0.8], wp: -90 } }, ex: { invuln: [1, 12] } }),
    super: { kind: 'super', name: 'The Final Oath', cmd: 'H + S (2 bars)', note: 'Invulnerable charge into an execution.', level: 'mid', startup: 10, active: 8, recovery: 38, invuln: [1, 17], motion: [[10, 18, 24]], box: [16, 40, 220, 150], damage: 50, hitstun: 30, blockstun: 22, pushBlock: 4, hitstop: 12, heavy: true, fx: 'slash', sfx: 'superHit',
      anim: { wind: { hip: [-12, 0.8], lean: 12, fa: [-0.3, 0.3], wp: 170 }, hit: { hip: [28, 0.78], lean: 34, fa: [1, 0.05], ff: [0.66, 0], wp: 0 } },
      cine: { frames: 104, gap: 130, fx: 'slash', launch: [10, 14], hits: [[18, 60, 'slash'], [34, 60, 'slash'], [50, 60, 'fire'], [88, 170, 'slash']],
        keys: [[0, { hip: [20, 0.8], lean: 30, fa: [1, 0.05], wp: 0 }], [18, { hip: [10, 0.9], lean: 16, fa: [0.9, -0.3], wp: -30 }], [34, { hip: [14, 0.95], lean: 4, fa: [0.6, 0.8], wp: 110 }], [50, { hip: [16, 0.7], lean: 34, fa: [0.95, -0.3], wp: -20 }], [70, { hip: [-8, 0.99], lean: -16, fa: [0, 1], ba: [0.1, 0.95], wp: 100 }], [88, { hip: [26, 0.68], lean: 42, fa: [0.9, -0.5], ba: [0.7, -0.5], wp: -40 }], [104, {}]] } },
  },
});
