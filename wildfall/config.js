// Every number that shapes how WILDFALL feels lives here. Units are metres and seconds on the 2D gameplay plane.
export const DT = 1 / 120;

export const PHYS = {
  gravity: 42,
  fallMult: 1.3, // extra gravity on the way down for a snappier arc
  lowJumpMult: 2.4, // extra gravity while rising with jump released (variable jump height)
  apexMult: 0.55, // lighter gravity near the apex while jump is held
  apexSpeed: 2.2,
  maxFall: 27,
  groundAccel: 95,
  groundDecel: 80,
  airAccel: 52,
  airDrag: 0.35, // per-second drag applied only to speed above the run cap
  momentumDecay: 5, // how fast over-cap ground speed bleeds off while the run direction is held
  coyote: 0.1,
  jumpBuffer: 0.13,
  actionBuffer: 0.22,
  wallSlide: 4.2,
  wallJumpX: 11.5,
  wallJumpLock: 0.13,
  wallCoyote: 0.09,
  mantleReach: 1.25,
  mantleTime: 0.17,
  slideTime: 0.6,
  slideBoost: 1.28,
  slideHeight: 0.9,
  bounceHoldBonus: 1.14,
  enemyBounce: 15.5,
  pitDamage: 12,
  flowTime: 4, // seconds a flow stack lasts
  flowMax: 6,
  flowSpeed: 0.02, // run-speed bonus per flow stack
};

export const GRAPPLE = {
  hookSpeed: 75,
  cone: 1.25, // radians either side of the aim direction that an anchor may sit in
  minLength: 2.2,
  damping: 0.025,
  perfectMin: 0.4, // release angle window above horizontal, radians
  perfectMax: 1.2,
  perfectBoost: 1.17,
  releaseJump: 4.5,
  groundDetach: 0.3,
};

// Shared defaults; each character overrides what makes it distinct.
const base = {
  hw: 0.42, h: 1.75, maxHp: 100,
  runSpeed: 9.2, jumpSpeed: 16.4, doubleJumpSpeed: 14.2, airJumps: 1, gravityScale: 1, wallJumpY: 15.2,
  dashSpeed: 21, dashBoost: 4, dashTime: 0.15, dashKeep: 0.62, dashCooldown: 0.32, airDashes: 1, dashIframes: 0,
  wallRunTime: 0, wallRunSpeed: 0, backRunTime: 0.55, glideFall: 0,
  grappleRange: 10.5, swingAccel: 13, swingMax: 17, reelSpeed: 3.6, releaseBoost: 1, perfectSpeed: 11,
  diveSpeed: 31, diveRadius: 2.2, diveDamage: 16, poise: 0,
};

export const CHARACTERS = {
  vyx: {
    ...base, id: 'vyx', name: 'VYX', title: 'THE KINETIC', tag: 'Advanced mobility', model: 'characters/vyx.glb', color: 0xe2483d,
    blurb: 'Grapple swing, momentum dash, wall-run and aerial blade combos.',
    runSpeed: 10.2, jumpSpeed: 16.6, dashKeep: 1, dashIframes: 0.15, dashCooldown: 0.28,
    wallRunTime: 0.62, wallRunSpeed: 11.5, backRunTime: 1.25,
    grappleRange: 12, swingAccel: 16, swingMax: 21, reelSpeed: 4.4, releaseBoost: 1.06,
    abilities: ['blades', 'phase'],
  },
  sera: {
    ...base, id: 'sera', name: 'SERA', title: 'THE ELEMENTALIST', tag: 'Elemental combos', model: 'characters/sera.glb', color: 0xf0b63c, maxHp: 85,
    blurb: 'Fireballs, ice platforms, chain lightning and aerial spellcasting.',
    runSpeed: 8.8, jumpSpeed: 16.2, gravityScale: 0.94, glideFall: 4.2, dashIframes: 0.2, blink: 4.6, dashCooldown: 0.55,
    grappleRange: 10, swingAccel: 11, backRunTime: 0.7,
    abilities: ['ice', 'lightning'],
  },
  bragg: {
    ...base, id: 'bragg', name: 'BRAGG', title: 'THE JUGGERNAUT', tag: 'Heavy impact', model: 'characters/bragg.glb', color: 0x58c46a, maxHp: 140, hw: 0.5, h: 1.85,
    blurb: 'Ground slams, shockwave jumps, a parrying shield and chain pulls.',
    runSpeed: 7.9, jumpSpeed: 15.9, doubleJumpSpeed: 11.5, gravityScale: 1.08, dashSpeed: 17, dashTime: 0.22, dashKeep: 0.75, dashCooldown: 0.6, bullRush: true,
    grappleRange: 8.5, swingAccel: 9, swingMax: 15, reelSpeed: 2.6, backRunTime: 0.45, chainPull: true,
    diveSpeed: 35, diveRadius: 3.6, diveDamage: 30, poise: 14,
    abilities: ['shield', 'leap'],
  },
};
export const CHARACTER_ORDER = ['vyx', 'sera', 'bragg'];

export const COMBAT = {
  comboWindow: 2.6,
  hurtIframes: 0.9,
  perfectDodge: 0.14, // seconds after a dash starts in which avoiding a hit counts as a perfect dodge
  counterTime: 2.2,
  counterBonus: 1.6,
  chargeMin: 0.32,
  chargeMax: 0.95,
  juggleGravity: 0.72,
  shatterBonus: 2,
  wetLightning: 1.8,
};

export const DIFFICULTY = {
  story: { label: 'Story', enemyDamage: 0.55, enemyHp: 0.8 },
  standard: { label: 'Standard', enemyDamage: 1, enemyHp: 1 },
  mastery: { label: 'Mastery', enemyDamage: 1.4, enemyHp: 1.2 },
};
