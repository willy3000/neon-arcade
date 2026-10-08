/* UI/progression tests with browser APIs mocked; route replay uses real physics. */
const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const elements = new Map(),
  listeners = {},
  store = new Map();
let frame,
  clock = 0;
function element(id) {
  if (!elements.has(id))
    elements.set(id, {
      hidden: false,
      textContent: "",
      children: [],
      tagName: "BUTTON",
      classList: { add() {}, remove() {}, toggle() {} },
      style: { setProperty() {} },
      setAttribute() {},
      focus() {},
      append(...items) {
        this.children.push(...items);
      },
      replaceChildren() {
        this.children = [];
      },
    });
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
    createElement: () => element("generated-" + elements.size),
    addEventListener: (n, f) => (listeners["document:" + n] = f),
    hidden: false,
  },
  localStorage: {
    getItem: (k) => store.get(k),
    setItem: (k, v) => store.set(k, v),
  },
  requestAnimationFrame: (f) => (frame = f),
  addEventListener: (n, f) => (listeners[n] = f),
};
env.window = env;
vm.createContext(env);
for (const file of ["levels.js", "physics.js"])
  vm.runInContext(fs.readFileSync(`${__dirname}/${file}`, "utf8"), env);
env.Heist.renderer = {
  reset() {},
  resize() {},
  update() {},
  draw() {},
  burst() {},
  impact() {},
};
env.Heist.audio = {
  muted: false,
  unlock() {},
  play() {},
  toggle() {
    this.muted = !this.muted;
  },
};
for (const file of ["game.js", "input.js"])
  vm.runInContext(fs.readFileSync(`${__dirname}/${file}`, "utf8"), env);
const H = env.Heist,
  g = H.game,
  p = H.physics;
const tick = (n = 1) => {
  for (let i = 0; i < n; i++) {
    clock += 1000 / 120;
    frame(clock);
  }
};
const key = (k) =>
  listeners.keydown({
    key: k,
    repeat: false,
    target: { tagName: "BODY" },
    preventDefault() {},
  });
tick();
g.start(1);
assert.equal(g.state, "menu", "Locked room cannot start");
element("play").onclick();
assert.equal(g.state, "playing");
assert.equal(g.simulation.level.id, 0);
key("q");
assert.equal(g.simulation.gravity, 3);
key("e");
assert.equal(g.simulation.gravity, 0);
tick(10);
key(" ");
const pausedTime = g.simulation.time;
tick(120);
assert.equal(g.state, "paused");
assert.equal(g.simulation.time, pausedTime);
key(" ");
tick(5);
assert.ok(g.simulation.time > pausedTime);
env.document.hidden = true;
listeners["document:visibilitychange"]();
assert.equal(g.state, "paused");
env.document.hidden = false;
g.restart();
assert.equal(g.simulation.rotations, 0);
assert.equal(g.simulation.time, 0);
g.simulation.dead = true;
g.simulation.events = ["death"];
tick(2);
assert.equal(g.state, "dying");
tick(60);
assert.equal(g.state, "playing");
assert.equal(g.simulation.dead, false);
const routes = JSON.parse(fs.readFileSync(`${__dirname}/routes.json`, "utf8"));
for (let index = 0; index < 12; index++) {
  g.start(index);
  assert.equal(g.simulation.level.id, index, "Sequential unlock");
  const s = g.simulation;
  for (const action of routes[index].actions) {
    if (action === 2) {
      p.rotate(s, 1);
      p.rotate(s, 1);
    } else if (action) p.rotate(s, action);
    for (let i = 0; i < 48 && !s.won && !s.dead; i++) p.step(s);
  }
  assert.ok(
    s.won && !s.dead,
    `Room ${index + 1} route wins with current physics`,
  );
  tick(2);
  assert.equal(g.state, "complete");
  assert.ok(JSON.parse(store.get("gravity-heist-progress"))[index].stars >= 1);
  if (index === 11) {
    element("modal-primary").onclick();
    assert.equal(g.state, "finished");
  }
}
g.select();
assert.equal(element("level-grid").children.length, 12);
assert.ok(element("level-grid").children.every((b) => !b.disabled));
g.start(0);
g.simulation.core = true;
g.simulation.x = 850;
g.simulation.y = 550;
tick(2);
assert.equal(g.state, "complete");
assert.equal(JSON.parse(store.get("gravity-heist-progress"))[0].stars, 3);
const timed = p.create(H.levels[9]);
timed.switches.A = true;
timed.timers.A = 0;
timed.x = 398;
timed.y = 300;
timed.gravity = 3;
p.step(timed);
assert.equal(
  p.doorOpen(timed, timed.level.doors[0]),
  false,
  "Expired timed gate does not reopen on contact",
);
console.log(
  "PASS: controls, locked levels, pause/resume, hidden-tab pause, restart, hazard reboot, all 12 route replays, sequential unlock, local saves, stars, final completion, timed door lock.",
);

// Execute the actual rendering module at desktop and narrow mobile dimensions.
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
let viewport = { width: 960, height: 600 };
element("world").getContext = () => ctx;
element("world").getBoundingClientRect = () => viewport;
env.matchMedia = () => ({ matches: false });
env.devicePixelRatio = 2;
vm.runInContext(fs.readFileSync(`${__dirname}/render.js`, "utf8"), env);
for (const size of [
  { width: 960, height: 600 },
  { width: 360, height: 400 },
]) {
  viewport = size;
  H.renderer.resize();
  assert.equal(element("world").width, size.width * 2);
  for (const l of H.levels) {
    const s = p.create(l);
    H.renderer.update(s, 1 / 60);
    H.renderer.draw(s, 1);
    s.core = true;
    s.dead = true;
    H.renderer.burst(s.x, s.y, "#69f5ef");
    H.renderer.impact();
    H.renderer.update(s, 1 / 60);
    H.renderer.draw(s, 2);
  }
}
const electric = p.create(H.levels[11]);
electric.x = 840;
electric.y = 564;
p.step(electric);
assert.ok(electric.dead, "Electric floor reaches the robot");
console.log(
  "PASS: renderer executes for every room at desktop/mobile sizes and high DPI; electric floor is lethal.",
);

const coreRoutes = JSON.parse(
  fs.readFileSync(`${__dirname}/core-routes.json`, "utf8"),
);
for (const [index, route] of coreRoutes.entries()) {
  const s = p.create(H.levels[index]);
  for (const action of route.actions) {
    if (action === 2) {
      p.rotate(s, 1);
      p.rotate(s, 1);
    } else if (action) p.rotate(s, action);
    for (let i = 0; i < 48 && !s.won && !s.dead; i++) p.step(s);
  }
  assert.ok(
    s.won && s.core && !s.dead,
    `Room ${index + 1}: core can be stolen before escape`,
  );
  assert.ok(
    s.time <= s.level.time && s.rotations <= s.level.rotations,
    `Room ${index + 1}: three stars are attainable`,
  );
}
console.log(
  "PASS: optional core and all three stars attainable in every room (36 / 36 stars).",
);
