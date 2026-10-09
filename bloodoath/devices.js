// Input devices: two keyboard layouts and any number of gamepads. Each player is explicitly assigned one device, so a single
// controller can never drive both fighters. All mappings can be changed and are saved.
const ACTIONS = ['left', 'right', 'up', 'down', 'L', 'M', 'H', 'S', 'B', 'T', 'X', 'D'];
export const ACTION_NAMES = { left: 'Left', right: 'Right', up: 'Jump', down: 'Crouch', L: 'Light attack', M: 'Medium attack', H: 'Heavy attack', S: 'Special', B: 'Block', T: 'Throw', X: 'Enhance (hold)', D: 'Dash', start: 'Pause' };
export const DEFAULT_KEYS = {
  kb1: { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', L: 'KeyF', M: 'KeyG', H: 'KeyH', S: 'KeyT', B: 'KeyR', T: 'KeyY', X: 'KeyV', D: 'KeyC', start: 'Escape' },
  kb2: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', L: 'KeyJ', M: 'KeyK', H: 'KeyL', S: 'KeyI', B: 'KeyU', T: 'KeyO', X: 'KeyM', D: 'KeyN', start: 'Enter' },
};
// Standard-mapping button indices: south, east, west, north face buttons, shoulders, triggers.
export const DEFAULT_PAD = { L: 0, M: 1, H: 2, S: 3, B: 4, T: 5, D: 6, X: 7, start: 9 };
const PAD_LABELS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'D↑', 'D↓', 'D←', 'D→'];
const DEAD = 0.38;
export const keyLabel = code => code.replace(/^Key|^Digit/, '').replace('Arrow', '').replace('Numpad', 'Num ');
export const padLabel = i => PAD_LABELS[i] || 'B' + i;

export class Devices {
  constructor(saved = {}) {
    this.keys = { kb1: { ...DEFAULT_KEYS.kb1, ...saved.keys?.kb1 }, kb2: { ...DEFAULT_KEYS.kb2, ...saved.keys?.kb2 } }; this.padMap = { ...DEFAULT_PAD, ...saved.pad };
    this.held = new Set(); this.pressed = new Set(); this.pads = []; this.prevPad = new Map(); this.padTaps = new Map(); this.assigned = [null, null]; this.listening = null; this.onChange = null; this.known = new Set();
    addEventListener('keydown', e => {
      if (this.listening) { e.preventDefault(); if (!e.repeat) this.captured(e.code, 'key'); return; }
      if (e.repeat) return; const game = Object.values(this.keys.kb1).includes(e.code) || Object.values(this.keys.kb2).includes(e.code) || e.code.startsWith('Arrow') || e.code === 'Space';
      if (game) e.preventDefault(); // keep the page from scrolling under the fight; menus read these keys themselves
      if (!this.held.has(e.code)) this.pressed.add(e.code); this.held.add(e.code);
    }, { passive: false });
    addEventListener('keyup', e => this.held.delete(e.code)); addEventListener('blur', () => { this.held.clear(); this.pressed.clear(); });
  }
  get supported() { return typeof navigator.getGamepads === 'function'; }
  // Call once per rendered frame.
  poll() {
    let list = []; try { list = Array.from(navigator.getGamepads?.() || []).filter(p => p && p.connected && p.buttons.length >= 8); } catch { /* the browser may block the Gamepad API */ }
    this.pads = list; this.padTaps.clear();
    // Connections are noticed by comparing polls rather than trusting browser events, which not every browser fires.
    const now = new Set(list.map(p => p.index)), lost = [...this.known].filter(i => !now.has(i)), found = [...now].filter(i => !this.known.has(i)); this.known = now;
    for (const i of lost) { this.prevPad.delete(i); this.onChange?.('pad:' + i, null); } for (const i of found) this.onChange?.(null, 'pad:' + i);
    for (const p of list) {
      const now = p.buttons.map(b => b.pressed || b.value > 0.5), before = this.prevPad.get(p.index) || [], taps = new Set(); now.forEach((v, i) => { if (v && !before[i]) taps.add(i); });
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0, dir = { left: ax < -DEAD || !!now[14], right: ax > DEAD || !!now[15], up: ay < -0.55 || !!now[12], down: ay > DEAD || !!now[13] }, pd = before.dir || {};
      for (const d of Object.keys(dir)) if (dir[d] && !pd[d]) taps.add(d);
      now.dir = dir; this.prevPad.set(p.index, now); this.padTaps.set(p.index, taps);
      if (this.listening && this.listening.kind === 'pad') { const first = [...taps].find(t => typeof t === 'number'); if (first !== undefined) this.captured(first, 'pad'); }
    }
  }
  endFrame() { this.pressed.clear(); }
  list() { return ['kb1', 'kb2', ...this.pads.map(p => 'pad:' + p.index)]; }
  name(id) { if (!id) return 'None'; if (id === 'cpu') return 'CPU'; if (id === 'kb1') return 'Keyboard — WASD side'; if (id === 'kb2') return 'Keyboard — arrow side'; const p = this.pads.find(p => 'pad:' + p.index === id); return p ? `Controller ${p.index + 1} — ${p.id.replace(/\s*\(.*$/, '').slice(0, 26) || 'gamepad'}` : `Controller ${Number(id.slice(4)) + 1} (disconnected)`; }
  connected(id) { return id === 'cpu' || id === 'kb1' || id === 'kb2' || this.pads.some(p => 'pad:' + p.index === id); }
  // Any device on which a button was just pressed (used by the "press a button to join" screen).
  justPressed() { for (const id of ['kb1', 'kb2']) if (Object.values(this.keys[id]).some(c => this.pressed.has(c))) return id; for (const [index, taps] of this.padTaps) if ([...taps].some(t => typeof t === 'number')) return 'pad:' + index; return null; }
  // The fight input for one device.
  read(id) {
    const out = {}; for (const a of ACTIONS) out[a] = false;
    if (id === 'kb1' || id === 'kb2') { const k = this.keys[id]; for (const a of ACTIONS) out[a] = this.held.has(k[a]); }
    else if (id && id.startsWith('pad:')) { const now = this.prevPad.get(Number(id.slice(4))); if (now && this.pads.some(p => 'pad:' + p.index === id)) { Object.assign(out, now.dir); for (const a of ['L', 'M', 'H', 'S', 'B', 'T', 'X', 'D']) out[a] = !!now[this.padMap[a]]; } }
    return out;
  }
  // Menu input for one device: single presses only.
  menu(id) {
    const m = { left: false, right: false, up: false, down: false, ok: false, back: false, start: false, alt: false };
    if (id === 'kb1' || id === 'kb2') { const k = this.keys[id], t = c => this.pressed.has(c); Object.assign(m, { left: t(k.left), right: t(k.right), up: t(k.up), down: t(k.down), ok: t(k.L) || t(id === 'kb1' ? 'Space' : 'Enter'), back: t(k.M) || t(id === 'kb1' ? 'Escape' : 'Backspace'), start: t(k.start), alt: t(k.H) }); }
    else if (id && id.startsWith('pad:')) { const t = this.padTaps.get(Number(id.slice(4))); if (t) Object.assign(m, { left: t.has('left'), right: t.has('right'), up: t.has('up'), down: t.has('down'), ok: t.has(this.padMap.L), back: t.has(this.padMap.M), start: t.has(this.padMap.start), alt: t.has(this.padMap.H) }); }
    return m;
  }
  // Menu input from every device at once, for screens that are not per-player.
  menuAny() { const out = { left: false, right: false, up: false, down: false, ok: false, back: false, start: false, alt: false }; for (const id of this.list()) { const m = this.menu(id); for (const k of Object.keys(out)) out[k] ||= m[k]; } return out; }
  // Remapping: the next key or button pressed becomes the binding.
  listen(kind, device, action, done) { this.listening = { kind, device, action, done }; }
  captured(code, kind) { const l = this.listening; if (!l || l.kind !== kind) return; this.listening = null; if (kind === 'key') { if (code !== 'Escape' || l.action === 'start') { const map = this.keys[l.device], clash = Object.keys(map).find(a => map[a] === code); if (clash) map[clash] = map[l.action]; map[l.action] = code; } } else { const clash = Object.keys(this.padMap).find(a => this.padMap[a] === code); if (clash) this.padMap[clash] = this.padMap[l.action]; this.padMap[l.action] = code; } l.done?.(); }
  resetMaps() { this.keys = { kb1: { ...DEFAULT_KEYS.kb1 }, kb2: { ...DEFAULT_KEYS.kb2 } }; this.padMap = { ...DEFAULT_PAD }; }
  export() { return { keys: this.keys, pad: this.padMap }; }
  // What each device is holding right now, for the input-test screen.
  describe(id) { const r = this.read(id); return ACTIONS.filter(a => r[a]); }
}
