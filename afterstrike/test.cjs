const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path"),
  { performance } = require("node:perf_hooks");
global.window = global;
for (const n of ["config", "physics", "combat", "echo", "ai", "simulation"])
  require("./" + n + ".js");
const A = Afterstrike,
  P = A.physics,
  C = A.combat,
  E = A.echo,
  S = A.simulation,
  F = A.GAME_FEEL;
const make = () => {
  const s = S.create();
  s.scene = {
    ...s.scene,
    encounters: [],
    pad: null,
    door: null,
    relics: [],
    exit: 9999,
  };
  s.encounters = [];
  s.gates = [];
  return s;
};
const step = (s, a = {}, n = 1) => {
  for (let i = 0; i < n; i++) S.step(s, a);
};
const start = performance.now();
for (const route of require("./routes.json")) {
  const s = S.create({ weapon: route.weapon });
  for (const run of route.runs) {
    if (run.upgrade) assert(S.choose(s, run.upgrade));
    else step(s, run.actions, run.frames);
  }
  assert(s.won && !s.failed, "Complete run with " + route.weapon);
  assert.equal(s.kills, route.kills);
  assert(s.syncs > 0, "Echo actually contributes to combat");
  assert(s.history.count <= E.CAP && s.echoes.length <= F.maxEchoes);
}
console.log(
  "PASS: three complete action-only weapon runs, upgrades, echo relay and Titan victory.",
);
let s = make(),
  h = s.player;
step(s, {}, 2);
const near = A.ai.create({ type: "scavenger", x: 125 }, "near"),
  far = A.ai.create({ type: "scavenger", x: 500 }, "far");
s.enemies = [near, far];
C.begin(s, h, "light");
C.update(s, h, 0.03);
assert.equal(near.hp, 75);
C.update(s, h, 0.03);
assert.equal(near.hp, 53);
C.update(s, h, 0.04);
assert.equal(near.hp, 53);
assert.equal(far.hp, 75);
C.update(s, h, 0.3);
C.begin(s, h, "light");
assert.equal(h.action.step, 1);
h.action = null;
h.comboTime = 0;
C.begin(s, h, "light");
assert.equal(h.action.step, 0);
s = make();
h = s.player;
h.special = 29;
assert(!C.begin(s, h, "special"));
h.special = 70;
assert(C.begin(s, h, "special"));
assert.equal(h.special, 40);
h.action = null;
assert(!C.begin(s, h, "ultimate"));
h.ultimate = 100;
C.begin(s, h, "ultimate");
assert.equal(h.ultimate, 0);
s = make();
h = s.player;
C.begin(s, h, "parry");
assert(!C.hurt(s, 20, { x: 100 }));
assert.equal(h.hp, 100);
assert.equal(s.parries, 1);
h.action = null;
assert(C.hurt(s, 20, { x: 100 }));
assert(!C.hurt(s, 20, { x: 100 }));
assert.equal(h.hp, 80);
s = make();
step(s, { right: true }, 300);
assert(s.player.vx <= F.speed + 0.01);
const jump = (hold) => {
  const s = make();
  step(s, {}, 2);
  step(s, { jump: true, jumpPressed: true });
  let min = s.player.y;
  for (let i = 0; i < 100; i++) {
    step(s, { jump: hold });
    min = Math.min(min, s.player.y);
  }
  return min;
};
assert(jump(true) < jump(false) - 30);
s = make();
h = s.player;
h.coyote = 0.08;
h.grounded = false;
step(s, { jump: true, jumpPressed: true });
assert(h.vy < -500);
step(s, { jump: true }, 8);
step(s, { jump: true, jumpPressed: true });
assert.equal(h.jumps, 2);
const vy = h.vy;
step(s, { jump: true, jumpPressed: true });
assert(h.vy > vy, "No third jump");
s = make();
s.scene.terrain.push({ x: 250, y: -500, w: 8, h: 1010 });
step(s, { right: true, dash: true }, 200);
assert(s.player.x + s.player.w <= 250 + 0.01);
s = make();
s.player.x = 250;
s.player.y = 400;
S.anchor(s);
assert(s.player.anchor);
step(s, { right: true, jump: true }, 30);
S.anchor(s);
assert(s.player.snapWindow > 0 && !s.player.anchor);
step(s, { right: true, dash: true });
assert(Math.abs(s.player.vx) > F.dashSpeed, "Momentum snap");
s = make();
h = s.player;
for (let i = 0; i < 100; i++) {
  h.x = 72 + i;
  E.record(s);
}
const before = h.energy;
assert(E.summon(s));
assert.equal(h.energy, before - F.echoCost);
const echo = s.echoes[0],
  first = echo.track[0];
assert(Object.isFrozen(echo.track) && Object.isFrozen(first));
h.x = 900;
s.scene.terrain = [];
const energy = h.energy;
E.playback(s);
assert.equal(echo.x, first.x, "Echo remains reconciled after terrain changes");
assert.equal(h.energy, energy, "Echo does not spend player resources");
E.clear(s);
assert(!s.echoes.length && !s.history.count);
s = make();
h = s.player;
h.action = {
  kind: "light",
  id: 77,
  t: 0.08,
  start: 0.055,
  active: 0.1,
  recovery: 0.14,
  step: 0,
  weapon: "blade",
};
h.state = "attack-active";
for (let i = 0; i < 60; i++) E.record(s);
const target = A.ai.create({ type: "scavenger", x: 125 }, "target");
s.enemies = [target];
E.summon(s);
E.playback(s);
const hp = target.hp;
E.playback(s);
assert.equal(target.hp, hp, "Replay has one hit per swing");
assert(hp < 75);
assert.equal(s.kills, 0);
s = make();
h = s.player;
h.action = {
  kind: "dash",
  id: 3,
  t: 0.08,
  start: 0,
  active: 0.17,
  weapon: "blade",
};
for (let i = 0; i < 60; i++) E.record(s);
E.summon(s);
s.projectiles = [{ x: 80, y: 470, w: 12, h: 8, life: 3 }];
E.playback(s);
assert.equal(s.projectiles[0].life, 0);
assert.equal(s.intercepts, 1);
s = make();
const foe = A.ai.create({ type: "scavenger", x: 140 }, "sync");
foe.hp = foe.maxHp = 200;
s.enemies = [foe];
C.damage(s, foe, 20, s.player, "light");
s.time = 0.08;
const actor = { ...s.player, x: 190, echo: true, id: "echo-a" };
C.damage(s, foe, 20, actor, "light");
assert.equal(s.syncs, 1);
assert(s.events.some((e) => e.type === "sync" && e.text === "PERFECT SYNC"));
C.damage(s, foe, 20, actor, "launcher", true);
assert(foe.vy < -400);
s.echoes = [actor];
const special = s.player.special;
assert(C.collapse(s));
assert.equal(s.player.special, special - 20);
assert.equal(s.echoes.length, 0);
s = make();
const guard = A.ai.create({ type: "bulwark", x: 125 }, "armor");
s.enemies = [guard];
C.damage(s, guard, 50, { ...s.player, weapon: "gauntlets" }, "heavy");
assert(guard.armor < 4);
s = make();
const titan = A.ai.titan();
s.enemies = [titan];
titan.hp = titan.maxHp * 0.4;
A.ai.boss(s, titan, F.dt);
assert.equal(titan.phase, 2);
assert(s.scene.terrain.some((t) => t.x === 475 && t.y === 402));
for (const type of Object.keys(A.ai.roles)) {
  s = make();
  const e = A.ai.create({ type, x: 130 }, "enemy");
  s.enemies = [e];
  e.cool = 0;
  A.ai.update(s, e, F.dt);
  assert.equal(e.state, "windup");
  assert.equal(s.player.hp, 100);
}
// Real UI/input in a deterministic DOM mock, including gamepad edge handling.
const source = (n) => fs.readFileSync(path.join(__dirname, n + ".js"), "utf8");
function harness(saved = new Map()) {
  const elements = new Map(),
    listeners = new Map();
  let tick,
    pads = [];
  const el = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        id,
        tagName: "BUTTON",
        hidden: false,
        dataset: {},
        style: { setProperty() {} },
        children: [],
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {},
        setPointerCapture() {},
        getClientRects: () => [{}],
        getBoundingClientRect: () => ({ width: 360, height: 440 }),
        focus() {
          doc.activeElement = this;
        },
        append(...x) {
          this.children.push(...x);
        },
        replaceChildren() {
          this.children = [];
        },
        addEventListener: (n, f) => listeners.set(id + ":" + n, f),
      });
    return elements.get(id);
  };
  const buttons = [
    "left",
    "right",
    "jump",
    "light",
    "heavy",
    "dash",
    "echo",
    "parry",
    "anchor",
    "collapse",
    "special",
    "ultimate",
    "heal",
    "nextWeapon",
  ].map((name) => {
    const b = el("touch-" + name);
    b.dataset.action = name;
    return b;
  });
  const doc = {
    body: { classList: { toggle() {} } },
    getElementById: el,
    createElement: () => el("new" + elements.size),
    querySelectorAll: (q) => (q === "[data-action]" ? buttons : []),
    addEventListener: (n, f) => listeners.set("doc:" + n, f),
    hidden: false,
  };
  const win = {
    Afterstrike: {},
    addEventListener: (n, f) => listeners.set("win:" + n, f),
  };
  const c = vm.createContext({
    window: win,
    Afterstrike: win.Afterstrike,
    document: doc,
    console,
    Set,
    Map,
    Math,
    JSON,
    Number,
    Date,
    matchMedia: () => ({ matches: false }),
    devicePixelRatio: 3,
    navigator: { getGamepads: () => pads },
    localStorage: {
      getItem: (k) => saved.get(k) || null,
      setItem: (k, v) => saved.set(k, v),
    },
    requestAnimationFrame: (f) => (tick = f),
  });
  for (const n of [
    "config",
    "physics",
    "combat",
    "echo",
    "ai",
    "simulation",
    "save",
  ])
    vm.runInContext(source(n), c);
  c.Afterstrike.renderer = {
    resize() {},
    reset() {},
    event() {},
    update() {},
    draw() {},
    drawCover() {},
  };
  c.Afterstrike.audio = {
    unlock() {},
    sync() {},
    event() {},
    update() {},
    pause() {},
  };
  for (const n of ["game", "input"]) vm.runInContext(source(n), c);
  const key = (k, type = "keydown", repeat = false) =>
    listeners.get("win:" + type)({
      key: k,
      target: { tagName: "BODY" },
      repeat,
      preventDefault() {},
    });
  return {
    c,
    g: c.Afterstrike.game,
    input: c.Afterstrike.input,
    el,
    listeners,
    doc,
    saved,
    key,
    tick: (now) => tick(now),
    pads: (p) => (pads = p),
  };
}
let u = harness();
u.g.start();
assert.equal(u.g.state, "playing");
u.key("d");
u.key("j");
let a = u.input.sample();
assert(a.right && a.light);
assert(!u.input.sample().light);
u.g.pause();
const time = u.g.simulation.time;
u.tick(1000);
assert.equal(u.g.simulation.time, time);
u.g.pause();
u.doc.hidden = true;
u.listeners.get("doc:visibilitychange")();
assert.equal(u.g.state, "paused");
u.g.restart();
u.listeners.get("touch-right:pointerdown")({
  button: 0,
  pointerId: 1,
  preventDefault() {},
});
u.listeners.get("touch-jump:pointerdown")({
  button: 0,
  pointerId: 2,
  preventDefault() {},
});
a = u.input.sample();
assert(a.right && a.jumpPressed);
u.listeners.get("touch-right:pointercancel")({ pointerId: 1 });
assert(!u.input.sample().right);
u.input.clear();
u.listeners.get("touch-heavy:pointerdown")({
  button: 0,
  pointerId: 3,
  preventDefault() {},
});
a = u.input.sample();
u.c.Afterstrike.simulation.step(u.g.simulation, a);
assert(u.g.simulation.player.chargeHeld);
u.listeners.get("touch-heavy:pointercancel")({ pointerId: 3 });
assert(!u.g.simulation.player.chargeHeld);
const pad = {
  mapping: "standard",
  axes: [0.8, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
};
pad.buttons[2].pressed = true;
u.pads([pad]);
u.input.pollGamepad();
a = u.input.sample();
assert(a.right && a.light);
u.input.pollGamepad();
assert(!u.input.sample().light);
pad.buttons[9].pressed = true;
u.input.pollGamepad();
assert.equal(u.g.state, "paused");
pad.buttons[9].pressed = false;
u.input.pollGamepad();
pad.buttons[9].pressed = true;
u.input.pollGamepad();
assert.equal(u.g.state, "playing");
u.pads([]);
u.input.clear();
u.g.start();
u.g.simulation.seed = 12345;
const route = require("./routes.json")[0];
let now = 1000;
for (const run of route.runs) {
  if (run.upgrade) {
    assert.equal(u.g.state, "upgrade");
    const offered = u.g.simulation.offers.findIndex(
      (m) => m.id === run.upgrade,
    );
    assert(offered >= 0);
    u.el("after-upgrade-cards").children[offered].onclick();
  } else {
    for (let f = 0; f < run.frames; f++)
      u.c.Afterstrike.simulation.step(u.g.simulation, run.actions);
    if (
      u.g.simulation.transition ||
      u.g.simulation.won ||
      u.g.simulation.failed
    )
      u.tick((now += 20));
  }
}
assert.equal(u.g.state, "victory");
const saved = JSON.parse(u.saved.get("afterstrike-progress"));
assert(
  saved.bossWins === 1 &&
    saved.weapons.includes("chain") &&
    saved.mutations.length === 2,
);
const reload = harness(u.saved);
assert(reload.c.Afterstrike.save.progress.bossWins === 1);
const ctx = new Proxy(
  {},
  {
    get: (_, k) =>
      k === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => {},
    set: () => true,
  },
);
u.el("after-world").getContext = () => ctx;
u.el("after-cover").getContext = () => ctx;
for (const n of ["assets/rig", "effects", "render"])
  vm.runInContext(source(n), u.c);
u.c.Afterstrike.renderer.resize();
assert.equal(u.el("after-world").width, 540, "Medium quality caps DPR at 1.5");
for (const quality of ["low", "medium", "high"]) {
  u.c.Afterstrike.save.settings.quality = quality;
  u.c.Afterstrike.renderer.resize();
  for (let i = 0; i < 4; i++) {
    const scene = u.c.Afterstrike.simulation.create({ practice: i === 3 });
    if (i < 3) u.c.Afterstrike.simulation.enter(scene, i);
    for (const e of [
      { type: "afterstorm", x: 300, y: 440, r: 280 },
      { type: "sync", x: 400, y: 300 },
      { type: "boss-death", x: 700, y: 400 },
    ])
      u.c.Afterstrike.renderer.event(e);
    u.c.Afterstrike.renderer.update(0.02, scene);
    u.c.Afterstrike.renderer.draw(scene, 2);
    u.c.Afterstrike.renderer.drawCover(2);
    assert(u.c.Afterstrike.effects.active <= 360);
  }
}
console.log(
  "PASS: combat timing, resources, parry, immunity, movement, thin walls, anchor/snap, immutable reconciled echoes, one hit per swing, intercept, sync, collapse, armor, boss phases, enemy telegraphs, keyboard/touch/gamepad, pause, mutation UI, victory, save reload and all render qualities.",
);
console.log(
  "Automated suite elapsed " +
    (performance.now() - start).toFixed(0) +
    "ms (Node CPU evidence, not rendered FPS).",
);

// Web Audio lifecycle, channel mute, voice caps and cleanup using production code.
let audioStarts = 0,
  resumes = 0,
  oscillators = [],
  gains = [];
class MockAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
    MockAudioContext.instance = this;
  }
  resume() {
    resumes++;
    this.state = "running";
    return Promise.resolve();
  }
  createGain() {
    const node = {
      last: 0,
      gain: {
        setValueAtTime(v) {
          node.last = v;
        },
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      disconnect() {},
    };
    gains.push(node);
    return node;
  }
  createOscillator() {
    const o = {
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      disconnect() {},
      start() {
        audioStarts++;
      },
      stop() {},
    };
    oscillators.push(o);
    return o;
  }
}
u.c.window.AudioContext = MockAudioContext;
vm.runInContext(source("audio"), u.c);
const audio = u.c.Afterstrike.audio;
audio.event({ type: "light", weapon: "blade" });
assert.equal(audioStarts, 0);
audio.unlock();
MockAudioContext.instance.state = "suspended";
audio.unlock();
assert.equal(resumes, 1);
for (let i = 0; i < 40; i++) audio.event({ type: "light", weapon: "blade" });
assert.equal(audio.voices, 20);
assert.equal(audioStarts, 20);
oscillators.forEach((o) => o.onended());
assert.equal(audio.voices, 0);
u.c.Afterstrike.save.settings.sfx = 0;
audio.sync();
assert(gains.slice(1, 5).every((g) => g.last === 0));
audio.pause();
assert.equal(gains[0].last, 0);
console.log(
  "PASS: gesture-only audio unlock, suspension recovery, channel mute, pause, voice cap and oscillator cleanup.",
);
