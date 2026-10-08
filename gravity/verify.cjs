/* Dependency-free physics checks and route search through every real room. */
const fs = require("node:fs"),
  assert = require("node:assert/strict");
// The isolated CLI process can load browser modules directly for faster search.
global.window = global;
require("./levels.js");
require("./physics.js");
const { levels, physics: p } = global.Heist;
function copy(s) {
  return {
    ...s,
    switches: { ...s.switches },
    timers: { ...s.timers },
    contacts: new Set(s.contacts),
    events: [],
  };
}
function advance(s, action, steps = 48) {
  if (action === 2) {
    p.rotate(s, 1);
    p.rotate(s, 1);
  } else if (action) p.rotate(s, action);
  for (let i = 0; i < steps && !s.dead && !s.won; i++) p.step(s);
  return s;
}
function key(s) {
  return [
    Math.round(s.x / 18),
    Math.round(s.y / 18),
    Math.round(s.vx / 70),
    Math.round(s.vy / 70),
    s.gravity,
    s.core ? 1 : 0,
    ...s.level.switches.map((a) => (s.switches[a.id] ? 1 : 0)),
    ...s.level.switches.map((a) => Math.ceil((s.timers[a.id] || 0) / 2)),
    Math.floor(s.time % 7),
  ].join(",");
}
const requireCore = process.argv.includes("--cores");
function solve(l) {
  const initial = p.create(l),
    nodes = [{ s: initial, parent: -1, action: 0 }],
    seen = new Set([key(initial)]);
  let head = 0;
  while (head < nodes.length && nodes.length < 180000) {
    const index = head++,
      node = nodes[index];
    if (node.s.time > 45) continue;
    for (const action of [0, -1, 1, 2]) {
      const s = advance(copy(node.s), action);
      if (s.dead) continue;
      if (s.won && (!requireCore || s.core)) {
        const actions = [action];
        let n = index;
        while (nodes[n].parent >= 0) {
          actions.push(nodes[n].action);
          n = nodes[n].parent;
        }
        return {
          actions: actions.reverse(),
          time: s.time,
          rotations: s.rotations,
          core: s.core,
          nodes: nodes.length,
        };
      }
      if (s.won) continue;
      const k = key(s);
      if (!seen.has(k)) {
        seen.add(k);
        nodes.push({ s, parent: index, action });
      }
    }
  }
  return { failed: true, nodes: nodes.length };
}
assert.equal(levels.length, 12);
const s = p.create(levels[0]);
s.vx = 150;
s.vy = -100;
p.rotate(s, 1);
assert.equal(s.vx, 150);
assert.equal(s.vy, -100);
for (let i = 0; i < 1000; i++) p.step(s);
assert.ok(
  s.x >= 36 && s.x <= 924 && s.y >= 36 && s.y <= 564,
  "Boundary collisions contain robot",
);
const thin = {
  ...levels[0],
  exit: [900, 40],
  walls: [...levels[0].walls, { x: 300, y: 24, w: 8, h: 552 }],
};
const shot = p.create(thin);
shot.x = 280;
shot.y = 300;
shot.vx = 420;
shot.gravity = 3;
for (let i = 0; i < 240; i++) p.step(shot);
assert.ok(shot.x <= 288, "No tunneling through thin walls");
const results = [];
for (const l of levels) {
  const r = solve(l);
  results.push(r);
  console.log(
    `${r.failed ? "FAIL" : "PASS"} ${l.id + 1} ${l.name}: ${r.failed ? r.nodes + " search states" : r.time.toFixed(1) + "s / " + r.rotations + " rotations / " + r.nodes + " states"}`,
  );
  if (!r.failed) {
    const replay = p.create(l);
    for (const action of r.actions) advance(replay, action);
    assert.ok(
      replay.won && !replay.dead,
      "Solver route replays with actual physics",
    );
  }
}
fs.writeFileSync(
  `${__dirname}/${requireCore ? "core-routes" : "routes"}.json`,
  JSON.stringify(results, null, 2),
);
assert.ok(
  results.every((r) => !r.failed),
  "Every room must have a verified escape route",
);
console.log(
  "PASS: 12 handcrafted rooms solvable; recorded routes replay; velocity preserved; boundaries and thin-wall collisions safe.",
);
