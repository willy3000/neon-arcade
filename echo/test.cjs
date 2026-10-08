/* Dependency-free verification of mechanics, input, progress, audio, and rendering. */
const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
global.window = global;
require("./levels.js");
require("./physics.js");
const P = Echo.physics,
  levels = Echo.levels,
  routes = JSON.parse(fs.readFileSync(`${__dirname}/routes.json`, "utf8"));
function advance(s, seconds) {
  for (let i = 0; i < seconds * 120 && !s.won; i++) P.step(s);
}
function replay(level, route) {
  const s = P.create(level);
  let action = 0;
  while (!s.won && s.time < level.time) {
    if (
      action < route.actions.length &&
      s.time + 1e-7 >= route.actions[action].time
    ) {
      const a = route.actions[action++];
      assert.ok(P.fire(s, a.frequency, a.strength, a.aim));
    }
    P.step(s);
  }
  return s;
}
for (const [index, l] of levels.entries()) {
  const s = replay(l, routes[index]);
  assert.ok(
    s.won && s.fragments.size === l.fragments.length,
    `Chamber ${index + 1} completes with every fragment`,
  );
  assert.ok(s.time <= l.time && s.pulses <= l.budget);
}
const heavy = (f) => {
  const s = P.create(levels[2]);
  P.fire(s, f, 1.4);
  advance(s, 0.6);
  return Math.abs(s.crates[0].vx);
};
assert.ok(
  heavy("LOW") > heavy("HIGH") * 5,
  "LOW pushes heavy cargo much harder",
);
const mid = P.create(levels[4]);
P.fire(mid, "HIGH", 1);
advance(mid, 1);
assert.equal(mid.switches.A, undefined);
P.fire(mid, "MID", 1);
advance(mid, 1);
assert.equal(mid.switches.A, true, "MID activates switches");
const glass = P.create(levels[3]);
P.fire(glass, "MID", 1.4);
advance(glass, 1);
assert.equal(glass.broken.size, 0);
assert.equal(glass.crystal.charged, false);
P.fire(glass, "HIGH", 1.4);
advance(glass, 1);
assert.equal(glass.broken.size, 1);
assert.equal(
  glass.crystal.charged,
  true,
  "HIGH wakes crystal and shatters glass",
);
const mirror = P.create(levels[9]);
P.fire(mirror, "HIGH", 1.4, 0);
let reflected = false;
for (let i = 0; i < 180 && !mirror.won; i++) {
  P.step(mirror);
  reflected ||= mirror.events.some((e) => e.type === "reflection");
}
assert.ok(
  reflected && mirror.won,
  "Angled mirror carries an otherwise blocked wave to the crystal",
);
const wrong = P.create(levels[6]);
P.fire(wrong, "LOW", 1.4);
advance(wrong, 1.5);
assert.equal(
  wrong.crystal.vx,
  0,
  "Wrong-frequency relay does not extend range",
);
const chain = P.create(levels[8]);
P.fire(chain, "HIGH", 1.4);
const nodes = new Set();
for (let i = 0; i < 360 && !chain.won; i++) {
  P.step(chain);
  for (const e of chain.events)
    if (e.type === "resonance") nodes.add(e.x + "," + e.y);
  assert.ok(chain.waves.length <= P.MAX_WAVES);
}
assert.equal(nodes.size, 2);
assert.ok(chain.won, "Two-relay chain navigates the corner");
const drain = P.create(levels[0]);
drain.energy = 0;
assert.equal(P.fire(drain, "MID"), false);
assert.equal(drain.pulses, 0);
advance(drain, 2);
assert.ok(drain.energy >= 39);
assert.equal(
  P.fire(drain, "MID"),
  true,
  "Energy recovers without deadlocking puzzle",
);
const blocked = P.create(levels[0]);
blocked.level = {
  ...blocked.level,
  walls: [...blocked.level.walls, { x: 200, y: 24, w: 8, h: 552 }],
};
blocked.crystal.x = 180;
blocked.crystal.vx = 380;
advance(blocked, 1);
assert.ok(
  blocked.crystal.x <= 187,
  "Thin obstacles cannot be tunneled through",
);
console.log(
  "PASS: all 12 three-star routes, LOW cargo, MID switches, HIGH crystal/glass, reflection, resonance chain, wave limits, energy regeneration, thin-wall safety.",
);

function harness() {
  const elements = new Map(),
    listeners = {},
    storage = new Map();
  let frame,
    now = 0;
  function element(id) {
    if (!elements.has(id)) {
      const style = { setProperty() {} },
        attrs = {};
      elements.set(id, {
        id,
        hidden: false,
        textContent: "",
        tagName: id === "echo-world" ? "CANVAS" : "BUTTON",
        children: [],
        style,
        attrs,
        firstElementChild: { style: {} },
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute(k, v) {
          attrs[k] = v;
        },
        focus() {},
        append(...items) {
          this.children.push(...items);
        },
        replaceChildren() {
          this.children = [];
        },
        addEventListener(n, f) {
          listeners[`${id}:${n}`] = f;
        },
        setPointerCapture() {},
      });
    }
    return elements.get(id);
  }
  const env = {
    console,
    Math,
    Set,
    Number,
    JSON,
    navigator: { vibrate() {} },
    document: {
      getElementById: element,
      createElement: () => element("new-" + elements.size),
      addEventListener: (n, f) => (listeners["document:" + n] = f),
      hidden: false,
    },
    localStorage: {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
    },
    requestAnimationFrame: (f) => (frame = f),
    addEventListener: (n, f) => (listeners[n] = f),
  };
  env.window = env;
  vm.createContext(env);
  for (const file of ["levels.js", "physics.js"])
    vm.runInContext(fs.readFileSync(`${__dirname}/${file}`, "utf8"), env);
  env.Echo.renderer = {
    reset() {},
    resize() {},
    burst() {},
    update() {},
    draw() {},
    worldPoint: (x, y) => ({ x, y }),
  };
  env.Echo.audio = {
    muted: false,
    unlock() {},
    play() {},
    toggle() {
      this.muted = !this.muted;
    },
  };
  for (const file of ["game.js", "input.js"])
    vm.runInContext(fs.readFileSync(`${__dirname}/${file}`, "utf8"), env);
  function tick(count = 1) {
    for (let i = 0; i < count; i++) {
      now += 1000 / 120;
      frame(now);
    }
  }
  function key(key, type = "keydown") {
    listeners[type]({
      key,
      repeat: false,
      target: { tagName: "BODY" },
      preventDefault() {},
    });
  }
  function pointer(
    type,
    x = 130,
    y = 300,
    pointerType = "mouse",
    id = 1,
    target = "echo-world",
  ) {
    listeners[`${target}:${type}`]({
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType,
      button: 0,
      currentTarget: element(target),
      preventDefault() {},
    });
  }
  return { env, element, listeners, storage, tick, key, pointer };
}
const { env, element, listeners, storage, tick, key, pointer } = harness(),
  g = env.Echo.game;
tick();
g.start(1);
assert.equal(g.state, "menu");
element("echo-play").onclick();
assert.equal(g.state, "playing");
pointer("pointerdown");
pointer("pointerup");
assert.equal(g.simulation.pulses, 1);
assert.equal(g.simulation.waves[0].aim, null, "Click makes radial pulse");
g.restart();
pointer("pointerdown", 130, 300, "touch");
tick(145);
pointer("pointermove", 330, 300, "touch");
pointer("pointerup", 330, 300, "touch");
assert.equal(g.simulation.pulses, 1);
assert.equal(g.simulation.waves[0].aim, 0);
assert.equal(
  g.simulation.waves[0].strength,
  1.4,
  "Held touch drag makes a full-strength aimed wave",
);
g.restart();
pointer("pointerdown");
listeners["echo-world:pointercancel"]();
pointer("pointerup");
assert.equal(g.simulation.pulses, 0, "Canceled gesture does not fire");
pointer("pointerdown", 0, 0, "touch", 2, "echo-pulse");
pointer("pointerup", 0, 0, "touch", 2, "echo-pulse");
element("echo-pulse").onclick({ detail: 1 });
assert.equal(g.simulation.pulses, 1, "Touch button fires exactly once");
g.restart();
key("1");
assert.equal(g.simulation.frequency, "LOW");
key("2");
assert.equal(g.simulation.frequency, "MID");
key("3");
assert.equal(g.simulation.frequency, "HIGH");
key("ArrowUp");
assert.equal(env.Echo.input.aim, -Math.PI / 2);
key(" ");
tick(145);
key(" ", "keyup");
assert.equal(g.simulation.pulses, 1);
assert.equal(g.simulation.waves[0].aim, -Math.PI / 2);
key("c");
assert.equal(env.Echo.input.aim, null);
key(" ");
key("p");
assert.equal(g.state, "paused");
assert.equal(env.Echo.input.gesture.active, false);
const paused = g.simulation.time,
  energy = g.simulation.energy;
tick(120);
assert.equal(g.simulation.time, paused);
assert.equal(g.simulation.energy, energy);
key(" ", "keyup");
assert.equal(g.simulation.pulses, 1);
key("p");
assert.equal(g.state, "playing");
env.document.hidden = true;
listeners["document:visibilitychange"]();
assert.equal(g.state, "paused");
env.document.hidden = false;
g.restart();
assert.equal(g.simulation.pulses, 0);
assert.equal(g.simulation.energy, 100);
assert.equal(env.Echo.input.aim, null);
for (const [index, route] of routes.entries()) {
  g.start(index);
  assert.equal(g.simulation.level.id, index);
  const s = g.simulation;
  let action = 0;
  while (!s.won && s.time < levels[index].time) {
    if (
      action < route.actions.length &&
      s.time + 1e-7 >= route.actions[action].time
    ) {
      const a = route.actions[action++];
      env.Echo.physics.fire(s, a.frequency, a.strength, a.aim);
    }
    env.Echo.physics.step(s);
  }
  assert.ok(s.won);
  tick(2);
  assert.equal(g.state, "complete");
  const record = JSON.parse(storage.get("echo-forge-progress"))[index];
  assert.equal(record.stars, 3);
  assert.ok(record.time > 0 && record.pulses > 0);
  if (index === 11) {
    element("echo-modal-primary").onclick();
    assert.equal(g.state, "finished");
  }
}
g.select();
assert.equal(element("echo-level-grid").children.length, 12);
assert.ok(element("echo-level-grid").children.every((b) => !b.disabled));
vm.runInContext(fs.readFileSync(`${__dirname}/game.js`, "utf8"), env);
env.Echo.game.select();
assert.ok(
  element("echo-level-grid").children.every((b) => !b.disabled),
  "Saved unlocks survive reload",
);
console.log(
  "PASS: mouse clicks, touch drag/charge, touch button, canceled gestures, frequency and aiming keys, pause, hidden-tab handling, restart, saves/reload, 12 unlocks, 36 stars, completion screen.",
);

const context = new Proxy(
  {},
  {
    get: (_, k) =>
      k === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => {},
    set: () => true,
  },
);
let viewport = { left: 0, top: 0, width: 960, height: 600 };
element("echo-world").getContext = () => context;
element("echo-world").getBoundingClientRect = () => viewport;
env.matchMedia = () => ({ matches: false });
env.devicePixelRatio = 2;
vm.runInContext(fs.readFileSync(`${__dirname}/render.js`, "utf8"), env);
for (const size of [
  { left: 0, top: 0, width: 960, height: 600 },
  { left: 0, top: 0, width: 360, height: 350 },
]) {
  viewport = size;
  env.Echo.renderer.resize();
  assert.equal(element("echo-world").width, size.width * 2);
  for (const l of env.Echo.levels) {
    const s = env.Echo.physics.create(l);
    env.Echo.physics.fire(s, "HIGH", 1.4);
    for (let i = 0; i < 48; i++) env.Echo.physics.step(s);
    env.Echo.renderer.draw(s, 1, { active: true, start: 0, aim: 0 });
  }
  for (let i = 0; i < 100; i++)
    env.Echo.renderer.burst(100, 100, "#63ede7", 30);
  assert.ok(env.Echo.renderer.activeParticles <= 240);
  env.Echo.renderer.update(1);
  assert.equal(env.Echo.renderer.activeParticles, 0);
}
console.log(
  "PASS: every chamber renders at desktop/mobile dimensions, high-DPI sizing, charge/aim rendering, bounded reusable particle pool.",
);

let contexts = 0,
  resumes = 0,
  notes = [];
let audioContext;
class AudioContextMock {
  constructor() {
    contexts++;
    this.state = "suspended";
    this.currentTime = 0;
    this.destination = {};
    audioContext = this;
  }
  resume() {
    resumes++;
    this.state = "running";
    return Promise.resolve();
  }
  createOscillator() {
    return {
      connect() {},
      disconnect() {},
      frequency: {
        setValueAtTime(v) {
          notes.push(v);
        },
        exponentialRampToValueAtTime() {},
      },
      start() {},
      stop() {
        this.onended?.();
      },
    };
  }
  createGain() {
    return {
      connect() {},
      disconnect() {},
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
    };
  }
}
env.AudioContext = AudioContextMock;
vm.runInContext(fs.readFileSync(`${__dirname}/audio.js`, "utf8"), env);
env.Echo.audio.play("pulse");
assert.equal(
  contexts,
  0,
  "Audio does not autoplay or create a context before interaction",
);
env.Echo.audio.unlock();
for (const f of ["LOW", "MID", "HIGH"]) env.Echo.audio.play("pulse", f);
assert.ok(
  [130, 360, 780].every((pitch) => notes.includes(pitch)),
  "Frequencies synthesize distinct tones",
);
audioContext.state = "suspended";
const before = notes.length;
env.Echo.audio.play("pulse");
assert.equal(notes.length, before);
env.Echo.audio.unlock();
assert.equal(audioContext.state, "running");
assert.ok(resumes >= 2, "Suspended audio resumes on interaction");
env.Echo.audio.toggle();
env.Echo.audio.play("win");
assert.equal(notes.length, before);
assert.equal(storage.get("echo-forge-muted"), "true");
console.log(
  "PASS: audio unlock, separate frequency tones, suspension recovery, mute and preference persistence.",
);
