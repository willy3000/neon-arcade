const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const source = (n) => fs.readFileSync(path.join(__dirname, n + ".js"), "utf8");
global.window = global;
require("./levels.js");
require("./physics.js");
const B = Phasebound,
  P = B.physics,
  routes = require("./routes.json");
for (const [i, r] of routes.entries()) {
  const s = P.create(B.levels[i]);
  for (const run of r.actions)
    for (let f = 0; f < run.frames; f++) P.step(s, run.actions);
  assert(s.won && !s.dead, "Finish level " + (i + 1));
  assert.equal(s.collected.size, s.level.crystals.length);
  assert(s.time <= s.level.time && s.deaths === 0, "Three stars attainable");
}
for (const [i, r] of require("./solo-routes.json").entries()) {
  const s = P.create(B.levels[i]);
  let selected = "kai";
  for (const run of r.actions) {
    assert(
      !Object.values(
        run.actions[selected === "kai" ? "luma" : "kai"] || {},
      ).some(Boolean) || run.selected !== selected,
    );
    if (run.selected !== selected) {
      s[selected].vx = 0;
      selected = run.selected;
    }
    assert(
      !Object.values(
        run.actions[selected === "kai" ? "luma" : "kai"] || {},
      ).some(Boolean),
      "Only one character receives solo input",
    );
    for (let f = 0; f < run.frames; f++) P.step(s, run.actions);
  }
  assert(
    s.won &&
      !s.dead &&
      s.collected.size === s.level.crystals.length &&
      s.time <= s.level.time,
    "Solo completion " + (i + 1),
  );
}
const run = (s, a = {}, n = 120) => {
  for (let i = 0; i < n; i++) P.step(s, a);
};
assert(
  P.affects({ dimension: "kai" }, "kai") &&
    !P.affects({ dimension: "kai" }, "luma"),
);
assert(
  P.affects({ dimension: "luma" }, "luma") &&
    !P.affects({ dimension: "luma" }, "kai"),
);
assert(
  P.affects({ dimension: "veil" }, "kai") &&
    !P.affects({ dimension: "veil" }, "luma"),
);
let s = P.create(B.levels[0]);
run(s);
const oldL = s.luma.x;
run(s, { kai: { right: true } }, 80);
assert.equal(s.luma.x, oldL);
assert(s.kai.x > 180);
s = P.create(B.levels[0]);
run(s, { kai: { right: true }, luma: { right: true } }, 100);
assert(s.kai.x > 240 && s.luma.x > 300);
const jumpHeight = (held) => {
  const x = P.create(B.levels[0]);
  run(x, {}, 2);
  P.step(x, { kai: { jump: true, jumpPressed: true } });
  let min = x.kai.y;
  for (let n = 0; n < 80; n++) {
    P.step(x, { kai: { jump: held } });
    min = Math.min(min, x.kai.y);
  }
  return min;
};
assert(jumpHeight(true) < jumpHeight(false) - 35);
const thin = {
  ...B.levels[0],
  portals: { kai: [2000, 566], luma: [2100, 566] },
  walls: [
    ...B.levels[0].walls,
    { x: 250, y: 300, w: 6, h: 280, dimension: "kai" },
  ],
};
s = P.create(thin);
run(s, { kai: { right: true } }, 300);
assert(s.kai.x + s.kai.w <= 250 + 0.001);
const cy = P.create(B.levels[0]);
cy.kai.grounded = false;
cy.kai.coyote = 0.08;
P.step(cy, { kai: { jump: true, jumpPressed: true } });
assert(cy.kai.vy < -400, "Coyote jump");
const buffered = P.create(B.levels[0]);
buffered.kai.y = 548;
buffered.kai.vy = 300;
P.step(buffered, { kai: { jump: true, jumpPressed: true } });
run(buffered, { kai: { jump: true } }, 3);
assert(buffered.kai.vy < 0, "Buffered landing jump");
s = P.create(B.levels[4]);
s.luma.x = 319;
run(s, {}, 2);
P.step(s, { luma: { interact: true } });
assert(s.timers.B > 9);
assert(P.terrain(s, "kai").some((b) => b.id === "B"));
run(s, {}, 1201);
assert.equal(s.timers.B, 0);
assert(!P.terrain(s, "kai").some((b) => b.id === "B"));
s = P.create(B.levels[2]);
s.kai.x = 370;
run(s, {}, 3);
assert(s.plates.A);
assert(P.doorOpen(s, s.level.doors[0]));
s.kai.x = 200;
run(s, {}, 2);
assert(!s.plates.A);
s = P.create(B.levels[3]);
s.kai.x = 230;
run(s, {}, 2);
P.step(s, { kai: { interact: true } });
assert(s.blocks[0].anchored);
let bx = s.blocks[0].x;
run(s, { kai: { right: true } }, 60);
assert.equal(s.blocks[0].x, bx);
P.step(s, { kai: { interact: true } });
assert(!s.blocks[0].anchored);
run(s, { kai: { right: true } }, 60);
assert(s.blocks[0].x > bx);
s = P.create(B.levels[8]);
s.kai.x = 300;
s.luma.x = 340;
run(s, {}, 2);
P.step(s, { kai: { interact: true } });
assert(s.tether);
run(s, { kai: { left: true } }, 100);
assert(Math.hypot(s.kai.x - s.luma.x, s.kai.y - s.luma.y) <= P.TETHER + 0.001);
P.step(s, { kai: { interact: true } });
assert(!s.tether);
s = P.create(B.levels[9]);
s.kai.x = 720;
s.luma.x = 760;
s.tether = true;
run(s, {}, 2);
assert.equal(s.checkpointIndex, 0);
const cp = s.checkpoint;
s.kai.y = 730;
P.step(s);
assert(s.dead);
P.respawn(s);
assert.equal(s.kai.x, cp.kai.x);
assert(s.tether && !s.dead && s.deaths === 1);
s = P.create(B.levels[0]);
s.kai.x = 959;
run(s, {}, 2);
assert(s.kai.docked && !s.won);
s.luma.x = 1009;
run(s, {}, 2);
assert(s.won);
// DOM harness exercises production game state, save reload and input, without a browser.
function harness(saved = new Map()) {
  const elements = new Map(),
    listeners = new Map();
  let tick;
  const el = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        tagName: "BUTTON",
        hidden: false,
        dataset: {},
        style: { setProperty() {} },
        children: [],
        firstElementChild: { textContent: "" },
        classList: { add() {}, remove() {} },
        setAttribute() {},
        setPointerCapture() {},
        getBoundingClientRect() {
          return { width: 360, height: 440 };
        },
        focus() {
          doc.activeElement = this;
        },
        append(...x) {
          this.children.push(...x);
        },
        replaceChildren() {
          this.children = [];
        },
        addEventListener(n, f) {
          listeners.set(id + ":" + n, f);
        },
      });
    }
    return elements.get(id);
  };
  const doc = {
    body: { dataset: {} },
    hidden: false,
    getElementById: el,
    createElement: () => el("created" + elements.size),
    querySelectorAll: () => [],
    addEventListener: (n, f) => listeners.set("doc:" + n, f),
  };
  const win = { addEventListener: (n, f) => listeners.set("win:" + n, f) };
  const c = vm.createContext({
    window: win,
    document: doc,
    console,
    Set,
    Map,
    Math,
    JSON,
    Number,
    devicePixelRatio: 3,
    matchMedia: () => ({ matches: false }),
    localStorage: {
      getItem: (k) => saved.get(k) || null,
      setItem: (k, v) => saved.set(k, v),
    },
    requestAnimationFrame: (f) => (tick = f),
  });
  win.Phasebound = {};
  c.Phasebound = win.Phasebound;
  for (const n of ["levels", "physics"]) vm.runInContext(source(n), c);
  c.Phasebound = win.Phasebound;
  c.Phasebound.renderer = {
    reset() {},
    resize() {},
    update() {},
    draw() {},
    burst() {},
    impact() {},
  };
  c.Phasebound.audio = {
    unlock() {},
    play() {},
    update() {},
    mute() {},
    toggleMusic() {},
    muted: false,
    music: false,
  };
  vm.runInContext(source("game"), c);
  vm.runInContext(source("input"), c);
  const key = (k, type = "keydown") =>
    listeners.get("win:" + type)({
      key: k,
      target: { tagName: "BODY" },
      repeat: false,
      preventDefault() {},
    });
  return {
    c,
    g: c.Phasebound.game,
    input: c.Phasebound.input,
    key,
    el,
    listeners,
    doc,
    tick: (now) => tick(now),
    saved,
  };
}
let h = harness();
h.g.start(1);
assert.equal(h.g.state, "menu");
h.g.start(0);
h.key("d");
h.key("ArrowRight");
let a = h.input.sample();
assert(a.kai.right && a.luma.right);
h.key("w");
h.key("ArrowUp");
a = h.input.sample();
assert(a.kai.jumpPressed && a.luma.jumpPressed);
assert(!h.input.sample().kai.jumpPressed);
h.g.setMode("solo");
h.key("d");
a = h.input.sample();
assert(a.kai.right && !a.luma.right);
h.g.switchCharacter();
assert.equal(h.g.selected, "luma");
assert(!h.input.sample().luma.right);
h.listeners.get("phase-touch-right:pointerdown")({
  button: 0,
  pointerId: 1,
  preventDefault() {},
});
h.listeners.get("phase-touch-jump:pointerdown")({
  button: 0,
  pointerId: 2,
  preventDefault() {},
});
a = h.input.sample();
assert(a.luma.right && a.luma.jumpPressed && a.luma.jump);
h.listeners.get("phase-touch-right:pointercancel")({ pointerId: 1 });
assert(!h.input.sample().luma.right);
h.input.clear();
h.doc.hidden = true;
h.listeners.get("doc:visibilitychange")();
assert.equal(h.g.state, "paused");
const paused = h.g.simulation.time;
h.tick(1000);
assert.equal(h.g.simulation.time, paused);
h.g.pause();
assert.equal(h.g.state, "playing");
h.g.restart();
for (let i = 0; i < 5; i++) h.el("phase-hint").onclick();
assert.equal(h.el("phase-hint").textContent, "HINT 3 / 3");
let now = 1000;
for (let i = 0; i < 12; i++) {
  h.g.start(i);
  for (const r of routes[i].actions)
    for (let f = 0; f < r.frames; f++)
      h.c.Phasebound.physics.step(h.g.simulation, r.actions);
  h.tick((now += 20));
  assert.equal(h.g.state, "complete");
  assert.equal(JSON.parse(h.saved.get("phasebound-progress"))[i].stars, 3);
}
h.el("phase-modal-primary").onclick();
assert.equal(h.g.state, "finished");
const reload = harness(h.saved);
reload.g.start(11);
assert.equal(reload.g.state, "playing");
assert.equal(reload.g.mode, "solo");
// Run the real renderer through every scene at a narrow, high-DPI viewport.
const gradient = { addColorStop() {} },
  ctx = new Proxy(
    {},
    {
      get: (_, k) =>
        k === "createLinearGradient" || k === "createRadialGradient"
          ? () => gradient
          : () => {},
      set: () => true,
    },
  );
h.el("phase-world").getContext = () => ctx;
vm.runInContext(source("render"), h.c);
h.c.Phasebound.renderer.resize();
assert.equal(h.el("phase-world").width, 720);
for (const l of h.c.Phasebound.levels) {
  const state = h.c.Phasebound.physics.create(l);
  state.tether = true;
  state.timers.B = 5;
  h.c.Phasebound.renderer.burst(300, 300, "#fff", 400);
  h.c.Phasebound.renderer.draw(state, 1, "kai");
  h.c.Phasebound.renderer.update(0.02);
}
console.log(
  "PHASEBOUND: all 12 three-star routes, dimensions, physics, mechanisms, checkpoints, keyboard/touch, pause, progression, persistence and rendering passed.",
);

// Production audio remains silent until a gesture unlocks it, saves preferences,
// resumes a suspended context, and restarts ambient notes after restarting a level.
let starts = 0,
  resumes = 0;
class AudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
    AudioContext.instance = this;
  }
  resume() {
    resumes++;
    this.state = "running";
    return Promise.resolve();
  }
  createOscillator() {
    return {
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      disconnect() {},
      start() {
        starts++;
      },
      stop() {
        this.onended();
      },
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      disconnect() {},
    };
  }
}
h.c.window.AudioContext = AudioContext;
vm.runInContext(source("audio"), h.c);
const audio = h.c.Phasebound.audio;
audio.play("jump");
assert.equal(starts, 0);
audio.unlock();
AudioContext.instance.state = "suspended";
audio.unlock();
assert.equal(resumes, 1);
audio.play("jump", "kai");
assert(starts > 0);
audio.toggleMusic();
audio.update(50);
const before = starts;
audio.update(0);
assert(starts > before, "Ambient music restarts with level time");
audio.mute();
const quiet = starts;
audio.play("win");
assert.equal(starts, quiet);
assert.equal(h.saved.get("phasebound-muted"), "true");
assert.equal(h.saved.get("phasebound-music"), "true");
console.log(
  "PASS: solo routes, buffered/coyote/variable jumps, thin-wall collision, audio lifecycle and preferences.",
);

assert(
  h.c.Phasebound.renderer.activeParticles <= 240,
  "Particle pool remains bounded",
);
vm.runInContext(source("audio"), h.c);
assert(
  h.c.Phasebound.audio.muted && h.c.Phasebound.audio.music,
  "Audio settings survive reload",
);
