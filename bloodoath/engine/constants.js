// Shared rules of the fight. Distances are stage pixels (the stage is 1280 wide), times are frames at 60 per second.
export const FPS = 60;
export const STAGE = { left: -600, right: 600, maxGap: 860 };
export const RULES = {
  gravity: 0.95, maxHealth: 1000, meterMax: 300, bar: 100,
  exCost: 100, superCost: 200, breakerCost: 200,
  prejump: 4, landing: 3, landingAttack: 6,
  dashWindow: 12, // frames allowed between the two taps of a dash
  buffer: 7, // how long a button press waits for the fighter to become able to act
  throwRange: 92, throwStartup: 6, throwTech: 9, throwProtect: 8, throwDamage: 110,
  chip: 0.16, // share of a special's damage that gets through a block
  perfectGuard: 5, // block pressed this many frames or fewer before impact
  counterDamage: 1.2, counterStun: 6,
  scaling: [1, 1, 0.86, 0.76, 0.66, 0.56, 0.48, 0.42, 0.36, 0.32, 0.28], minScale: 0.25,
  stunDecayAfter: 6, // from this hit of a combo on, each hit stuns one frame less
  juggleMax: 6, // juggle points a combo may spend on an airborne opponent
  knockdown: 34, getup: 18, wakeInvuln: 6,
  freezeProof: 300, // frames after a freeze during which the fighter cannot be frozen again
  meterHit: 0.11, meterTaken: 0.07, meterBlocked: 0.04, meterWhiff: 3,
  roundIntro: 100, koFreeze: 110, roundOutro: 150,
};
export const BUTTONS = ['L', 'M', 'H', 'S', 'B', 'T', 'X', 'D']; // light, medium, heavy, special, block, throw, enhance, dash
export const NEUTRAL = Object.freeze({ left: false, right: false, up: false, down: false, L: false, M: false, H: false, S: false, B: false, T: false, X: false, D: false });
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
// Deterministic random numbers so a replay of the same inputs gives the same fight.
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
