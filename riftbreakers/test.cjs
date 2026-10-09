const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
global.window = global;
for (const n of ["levels", "physics", "combat", "ai", "simulation"])
  require("./" + n + ".js");
const R = Rift,
  P = R.physics,
  C = R.combat,
  A = R.ai,
  S = R.simulation;
const quiet = {
  ...R.levels[0],
  waves: [],
  crates: [],
  traps: [],
  relics: [],
  anchors: [{ x: 230, y: 260 }],
  checkpoints: [300],
};
const make = () => S.create(quiet, "coop"),
  step = (s, a = {}, n = 1) => {
    for (let i = 0; i < n; i++) S.step(s, a);
  };
for (const mode of ["solo", "coop"])
  for (const [i, r] of require("./" + mode + "-routes.json").entries()) {
    const s = S.create(R.levels[i], mode);
    for (const run of r.actions) step(s, run.actions, run.frames);
    assert(s.won && !s.failed, "Campaign completion " + mode + " " + (i + 1));
    assert.equal(s.kills, r.kills);
  }
let s = make(),
  h = s.heroes[0];
step(s, {}, 2);
const near = A.enemy({ type: "grunt", x: h.x + 55, y: 516 }, "near"),
  far = A.enemy({ type: "grunt", x: 500, y: 516 }, "far");
s.enemies = [near, far];
assert(C.begin(s, h, "light"));
C.updateAction(s, h, 0.04, {});
assert.equal(near.hp, 80, "No startup hit");
C.updateAction(s, h, 0.03, {});
assert.equal(near.hp, 57);
C.updateAction(s, h, 0.04, {});
assert.equal(near.hp, 57, "One hit per swing");
assert.equal(far.hp, 80, "No out-of-range hit");
C.updateAction(s, h, 0.3, {});
assert.equal(h.action, null);
assert(C.begin(s, h, "light"));
assert.equal(h.action.step, 1);
h.action = null;
h.comboTime = 0;
C.begin(s, h, "light");
assert.equal(h.action.step, 0);
s = make();
h = s.heroes[0];
h.energy = 34;
assert(!C.begin(s, h, "special"));
assert.equal(h.energy, 34);
h.energy = 65;
assert(C.begin(s, h, "special"));
assert.equal(h.energy, 30);
h.action = null;
assert(!C.begin(s, h, "ultimate"));
h.ultimate = 100;
assert(C.begin(s, h, "ultimate"));
assert.equal(h.ultimate, 0);
s = make();
h = s.heroes[0];
assert(C.hurt(s, h, 15, { x: 0 }));
assert.equal(h.hp, 85);
assert(!C.hurt(s, h, 15, { x: 0 }));
h.invulnerable = 0;
h.stun = 0;
C.begin(s, h, "dash");
h.action.t = 0.1;
assert(!C.hurt(s, h, 15, { x: 0 }));
h.action.t = 0.19;
assert(C.hurt(s, h, 15, { x: 0 }));
s = make();
step(s, { blaze: { right: true } }, 300);
assert(s.heroes[0].vx <= 265 + 0.01, "Movement stays capped");
assert.equal(s.heroes[1].x, 125);
s = make();
step(s, {}, 2);
h = s.heroes[0];
step(s, { blaze: { jump: true, jumpPressed: true } });
assert(h.vy < 0 && h.jumps === 1);
step(s, { blaze: { jump: true } }, 8);
step(s, { blaze: { jump: true, jumpPressed: true } });
assert(h.jumps === 2 && h.vy < 0);
h.jumpBuffer = 0;
step(s, { blaze: { jump: true, jumpPressed: true } });
assert.equal(h.jumps, 2);
const thin = {
  ...quiet,
  terrain: [...quiet.terrain, { x: 250, y: 0, w: 8, h: 560 }],
};
s = S.create(thin, "coop");
step(s, { blaze: { right: true, dash: true } }, 150);
assert(s.heroes[0].x + s.heroes[0].w <= 250 + 0.01);
s = make();
h = s.heroes[0];
S.grapple(s, h);
assert(h.grapple);
step(s, { blaze: { right: true, jump: true } }, 80);
assert(
  h.grapple &&
    Math.hypot(P.center(h).x - h.grapple.x, P.center(h).y - h.grapple.y) <=
      h.grapple.length + 12,
);
S.grapple(s, h);
assert(!h.grapple);
s = make();
s.fusion = 100;
step(s, { blaze: { fusion: true } });
assert(!s.fusionAction);
step(s, { volt: { fusion: true } });
assert(s.fusionAction && s.fusion === 0);
s = make();
h = s.heroes[0];
C.hurt(s, h, 100, { x: 0 });
s.heroes[1].x = h.x + 30;
step(s, {}, 210);
assert(h.hp > 0, "Standing teammate revives");
s = S.create(quiet, "solo");
h = s.heroes[0];
C.hurt(s, h, 100, { x: 0 });
step(s, {}, 450);
assert(h.hp > 0, "Companion revives");
s = make();
s.heroes[0].x = 310;
s.heroes[1].x = 355;
step(s, {}, 3);
assert.equal(s.checkpointIndex, 0);
const cp = s.checkpoint;
s.heroes.forEach((h) => {
  h.hp = 0;
  h.downTimer = 0;
});
step(s);
assert(s.failed);
S.retry(s);
assert(!s.failed && s.heroes.every((h) => h.hp === 100));
assert.equal(s.heroes[0].x, cp.heroes[0].x);
for (const kind of ["warden", "serpent", "emperor"]) {
  s = make();
  s.level = { ...quiet, width: 1200 };
  const b = A.boss(kind);
  s.enemies = [b];
  b.hp = b.maxHp * 0.3;
  const patterns = new Set();
  for (let i = 0; i < 6000; i++) {
    A.updateBoss(s, b, P.DT);
    patterns.add(b.pattern);
  }
  assert(
    b.phase >= 2 && patterns.size >= 4,
    "Boss phases and pattern variety " + kind,
  );
}
for (const type of Object.keys(A.archetypes)) {
  s = make();
  h = s.heroes[0];
  const e = A.enemy({ type, x: 140, y: 518 }, "enemy");
  s.enemies = [e];
  e.cooldown = 0;
  A.updateEnemy(s, e, P.DT);
  assert.equal(e.state, "windup");
  assert.equal(h.hp, 100, "Enemy attack has startup " + type);
  C.damage(s, e, 10, { x: h.x, who: "blaze" }, "heavy");
  assert(e.stun > 0);
}
// Mocked DOM exercises the real UI and input without claiming a physical browser playtest.
function harness(saved = new Map()) {
  const elements = new Map(),
    listeners = new Map();
  let tick;
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
        getBoundingClientRect: () => ({ width: 360, height: 420 }),
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
  const touch = [
    "left",
    "right",
    "jump",
    "light",
    "heavy",
    "dash",
    "special",
    "ultimate",
    "grapple",
    "fusion",
  ].map((a) => {
    const e = el("touch-" + a);
    e.dataset.action = a;
    return e;
  });
  const doc = {
    body: { classList: { toggle() {} } },
    documentElement: { style: { setProperty() {} } },
    getElementById: el,
    createElement: () => el("new" + elements.size),
    querySelectorAll: (q) => (q.includes("[data-action]") ? touch : []),
    addEventListener: (n, f) => listeners.set("doc:" + n, f),
    hidden: false,
  };
  const win = {
    Rift: {},
    addEventListener: (n, f) => listeners.set("win:" + n, f),
  };
  const context = vm.createContext({
    window: win,
    Rift: win.Rift,
    document: doc,
    console,
    Set,
    Map,
    Math,
    JSON,
    Number,
    matchMedia: () => ({ matches: false }),
    devicePixelRatio: 3,
    location: { protocol: "file:" },
    navigator: {},
    localStorage: {
      getItem: (k) => saved.get(k) || null,
      setItem: (k, v) => saved.set(k, v),
    },
    requestAnimationFrame: (f) => (tick = f),
  });
  for (const n of ["levels", "physics", "combat", "ai", "simulation", "save"])
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, n + ".js"), "utf8"),
      context,
    );
  context.Rift.renderer = {
    reset() {},
    resize() {},
    update() {},
    draw() {},
    event() {},
  };
  context.Rift.audio = { unlock() {}, sync() {}, play() {}, update() {} };
  for (const n of ["game", "input"])
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, n + ".js"), "utf8"),
      context,
    );
  const key = (k, type = "keydown", repeat = false) =>
    listeners.get("win:" + type)({
      key: k,
      target: { tagName: "BODY" },
      repeat,
      preventDefault() {},
    });
  return {
    c: context,
    g: context.Rift.game,
    input: context.Rift.input,
    key,
    el,
    listeners,
    doc,
    saved,
    tick: (now) => tick(now),
  };
}
let u = harness();
u.g.start(1);
assert.equal(u.g.state, "menu");
u.g.start(0);
u.key("d");
u.key("ArrowRight");
u.key("f");
u.key("k");
let a = u.input.sample();
assert(a.blaze.right && a.volt.right && a.blaze.light && a.volt.light);
assert(
  !u.input.sample().blaze.light,
  "Holding attack cannot deal endless damage",
);
u.g.pause();
const time = u.g.simulation.time;
u.tick(1000);
assert.equal(u.g.simulation.time, time);
u.g.pause();
u.doc.hidden = true;
u.listeners.get("doc:visibilitychange")();
assert.equal(u.g.state, "paused");
u.g.restart();
u.c.Rift.save.settings.mode = "solo";
u.g.start(0);
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
assert(a.blaze.right && a.blaze.jumpPressed);
u.listeners.get("touch-right:pointercancel")({ pointerId: 1 });
assert(!u.input.sample().blaze.right);
u.g.switchHero();
assert.equal(u.g.simulation.selected, "volt");
assert(!u.input.sample().volt.right);
u.g.settings();
assert.equal(u.g.state, "settings");
u.el("rift-setting-shake").type = "range";
u.el("rift-setting-shake").value = "0";
u.el("rift-setting-shake").onchange();
assert.equal(u.c.Rift.save.settings.shake, 0);
u.c.Rift.save.settings.selected = "blaze";
let now = 1000;
for (let i = 0; i < 9; i++) {
  u.g.start(i);
  const route = require("./solo-routes.json")[i];
  for (const run of route.actions)
    for (let f = 0; f < run.frames; f++)
      u.c.Rift.simulation.step(u.g.simulation, run.actions);
  u.tick((now += 20));
  assert.equal(u.g.state, "complete");
  assert(JSON.parse(u.saved.get("riftbreakers-progress"))[i].stars >= 1);
}
u.el("rift-modal-primary").onclick();
assert.equal(u.g.state, "finished");
const reloaded = harness(u.saved);
reloaded.g.start(8);
assert.equal(reloaded.g.state, "playing");
assert.equal(reloaded.c.Rift.save.settings.shake, 0);
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
u.el("rift-world").getContext = () => ctx;
vm.runInContext(fs.readFileSync(__dirname + "/render.js", "utf8"), u.c);
u.c.Rift.renderer.resize();
assert.equal(u.el("rift-world").width, 720);
for (const l of u.c.Rift.levels) {
  const state = u.c.Rift.simulation.create(l);
  state.enemies.push(
    ...Object.keys(u.c.Rift.ai.archetypes).map((type, i) =>
      u.c.Rift.ai.enemy({ type, x: 100 + i * 70, y: 518 }, "draw" + i),
    ),
  );
  for (const e of [
    { type: "fire", x: 300, y: 500, radius: 100 },
    { type: "arc", x: 200, y: 200, to: { x: 400, y: 300 } },
    { type: "fusion-blast", x: 500, y: 500, radius: 400 },
  ])
    u.c.Rift.renderer.event(e);
  u.c.Rift.renderer.update(0.02, state);
  u.c.Rift.renderer.draw(state, 2);
  assert(u.c.Rift.renderer.activeParticles <= 420);
}
console.log(
  "PASS RIFTBREAKERS: all 18 solo/co-op campaign routes, combat timing/hitboxes, combos, resource costs, immunity, physics, grapple, fusion, human/AI revive, checkpoint restore, enemy telegraphs, boss phases, keyboard/touch, pause, saves, progression and renderer.",
);
let starts = 0,
  ends = [],
  lastGain = [],
  resumes = 0;
class AudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
    AudioContext.instance = this;
  }
  resume() {
    this.state = "running";
    resumes++;
    return Promise.resolve();
  }
  createGain() {
    const g = {
      value: 0,
      gain: {
        setValueAtTime(v) {
          g.value = v;
        },
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      disconnect() {},
    };
    lastGain.push(g);
    return g;
  }
  createOscillator() {
    const o = {
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      disconnect() {},
      start() {
        starts++;
      },
      stop() {},
    };
    ends.push(o);
    return o;
  }
}
u.c.window.AudioContext = AudioContext;
vm.runInContext(fs.readFileSync(__dirname + "/audio.js", "utf8"), u.c);
const audio = u.c.Rift.audio;
audio.play({ type: "light" });
assert.equal(starts, 0);
audio.unlock();
AudioContext.instance.state = "suspended";
audio.unlock();
assert.equal(resumes, 1);
for (let i = 0; i < 30; i++) audio.play({ type: "light" });
assert.equal(starts, 16);
ends.forEach((o) => o.onended());
u.c.Rift.save.settings.sfx = false;
audio.sync();
assert.equal(lastGain[0].value, 0);
console.log(
  "PASS: Web Audio autoplay lifecycle, suspension recovery, mute and voice cap.",
);
