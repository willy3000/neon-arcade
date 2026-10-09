// Keyboard, mouse and controller input, merged into the one input shape the simulation expects.
export const BINDINGS = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], jump: ['Space'], dash: ['ShiftLeft', 'ShiftRight'], slide: ['KeyC'],
  attack: ['KeyJ', 'Mouse0'], heavy: ['KeyK', 'KeyF'], grapple: ['KeyL', 'Mouse2'], ability1: ['KeyQ', 'KeyU'], ability2: ['KeyE', 'KeyI'], interact: ['KeyR', 'Enter'], pause: ['Escape', 'KeyP'],
};
// Controller layout (standard mapping). Sticks: left moves, right aims the grapple.
export const PAD = { jump: 'a', dash: 'b', attack: 'x', heavy: 'y', grapple: 'rt', ability1: 'lb', ability2: 'rb', slide: 'lt', interact: 'up', pause: 'start' };
const EDGES = ['jump', 'dash', 'slide', 'attack', 'heavy', 'grapple', 'ability1', 'ability2', 'interact', 'pause'];
const KEY_NAMES = { Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', Mouse0: 'LEFT CLICK', Mouse2: 'RIGHT CLICK', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Enter: 'ENTER', Escape: 'ESC' };
const keyName = code => KEY_NAMES[code] || code.replace(/^Key|^Digit/, '');

export class Input {
  constructor(target) {
    this.held = new Set(); this.pressed = new Set(); this.device = 'keyboard'; this.mouse = { x: 0, y: 0, moved: 0 }; this.padState = null; this.enabled = true; this.padOn = true;
    this.pad = globalThis.BPGamepad ? new globalThis.BPGamepad() : null;
    const down = code => { if (!this.held.has(code)) this.pressed.add(code); this.held.add(code); };
    addEventListener('keydown', e => { if (e.repeat) return; this.device = 'keyboard'; if (this.enabled && Object.values(BINDINGS).some(list => list.includes(e.code)) && !e.target.closest?.('input,select,textarea')) e.preventDefault(); down(e.code); }, { passive: false });
    addEventListener('keyup', e => this.held.delete(e.code));
    target.addEventListener('pointerdown', e => { this.device = 'keyboard'; this.mouse.moved = performance.now(); down('Mouse' + e.button); });
    addEventListener('pointerup', e => this.held.delete('Mouse' + e.button));
    addEventListener('pointermove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; if (Math.hypot(e.movementX, e.movementY) > 2) { this.mouse.moved = performance.now(); if (this.device === 'pad' && Math.hypot(e.movementX, e.movementY) > 6) this.device = 'keyboard'; } });
    target.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('blur', () => this.clear());
  }
  clear() { this.held.clear(); this.pressed.clear(); }
  get padName() { return this.pad && this.padOn ? this.pad.name : null; }
  // Call once per rendered frame before reading.
  poll() { this.padState = this.pad && this.padOn ? this.pad.poll() : null; if (this.padState?.active) this.device = 'pad'; }
  down(action) { return BINDINGS[action].some(c => this.held.has(c)) || !!(this.padState && PAD[action] && this.padState.down.has(PAD[action])); }
  tapped(action) { return BINDINGS[action].some(c => this.pressed.has(c)) || !!(this.padState && PAD[action] && this.padState.tap.has(PAD[action])); }
  // Menu navigation shared by keyboard and controller: returns { dx, dy, confirm, back }.
  menu() {
    const g = this.padState, stick = g ? [Math.abs(g.move.x) > 0.6 ? Math.sign(g.move.x) : 0, Math.abs(g.move.y) > 0.6 ? Math.sign(g.move.y) : 0] : [0, 0], tap = c => this.pressed.has(c), pt = n => !!g?.tap.has(n);
    const flick = [stick[0] !== this.lastStick?.[0] ? stick[0] : 0, stick[1] !== this.lastStick?.[1] ? stick[1] : 0]; this.lastStick = stick;
    return { dx: (tap('ArrowRight') || tap('KeyD') || pt('right') ? 1 : 0) - (tap('ArrowLeft') || tap('KeyA') || pt('left') ? 1 : 0) + flick[0], dy: (tap('ArrowDown') || tap('KeyS') || pt('down') ? 1 : 0) - (tap('ArrowUp') || tap('KeyW') || pt('up') ? 1 : 0) + flick[1], confirm: pt('a'), back: pt('b'), start: pt('start') };
  }
  // Builds the simulation input. `aim` is the direction from the hero to the mouse cursor in world space, if the mouse is in use.
  read(aim) {
    const g = this.padState, on = this.enabled, t = a => on && this.tapped(a), d = a => on && this.down(a);
    let mx = (d('right') ? 1 : 0) - (d('left') ? 1 : 0), my = (d('up') ? 1 : 0) - (d('down') ? 1 : 0), aimX, aimY;
    if (on && g && !mx && !my && g.move.len) { mx = Math.abs(g.move.x) > 0.3 ? Math.sign(g.move.x) * Math.min(1, Math.abs(g.move.x) * 1.25) : 0; my = Math.abs(g.move.y) > 0.45 ? -Math.sign(g.move.y) : 0; }
    if (this.device === 'pad' && g?.aim.len) { aimX = g.aim.x; aimY = -g.aim.y; } else if (this.device === 'keyboard' && aim && performance.now() - this.mouse.moved < 4000) { aimX = aim.x; aimY = aim.y; }
    const out = { mx, my, aimX, aimY, jumpHeld: d('jump'), heavyHeld: d('heavy'), grappleHeld: d('grapple'), ability1Held: d('ability1'), ability2Held: d('ability2') };
    for (const e of EDGES) out[e] = t(e);
    return out;
  }
  // After the first simulation tick of a frame, edges must not fire again.
  static sustain(inp) { const out = { ...inp }; for (const e of EDGES) out[e] = false; return out; }
  endFrame() { this.pressed.clear(); }
  label(action) {
    if (this.device === 'pad' && PAD[action]) return (globalThis.BPGamepad?.labels || {})[PAD[action]] || PAD[action].toUpperCase();
    if (this.device === 'pad' && ['left', 'right', 'up', 'down'].includes(action)) return 'L-STICK';
    return keyName(BINDINGS[action][0]);
  }
}
