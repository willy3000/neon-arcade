/* Deterministic, real-physics playthroughs; no teleporting or mocked interactions. */
const fs = require("node:fs"),
  assert = require("node:assert/strict");
global.window = global;
require("./levels.js");
require("./physics.js");
const P = Echo.physics;
const recipes = [
  ["HIGH"],
  ["HIGH"],
  ["HIGH", "LOW"],
  ["HIGH"],
  ["MID", "HIGH"],
  ["MID", "HIGH"],
  ["HIGH"],
  ["HIGH"],
  ["HIGH"],
  ["HIGH"],
  ["MID", "HIGH"],
  ["MID", "HIGH", "MID", "HIGH"],
];
function solve(level) {
  const frequencies = recipes[level.id],
    results = [];
  for (const interval of [1.8, 1.2, 2.4, 0.9, 3])
    for (const strength of [1.4, 1.1, 0.8]) {
      const s = P.create(level),
        actions = [];
      let next = 0,
        attempt = 0;
      while (!s.won && s.time < 65) {
        if (s.time >= next) {
          const f = frequencies[Math.min(attempt, frequencies.length - 1)];
          let aim = null;
          if (level.id === 7) aim = Math.atan2(300 - 430, 410 - 140);
          if (level.id >= 9) aim = 0;
          if (P.fire(s, f, strength, aim)) {
            actions.push({ time: s.time, frequency: f, strength, aim });
            attempt++;
          }
          next = s.time + interval;
        }
        P.step(s);
      }
      if (s.won)
        results.push({
          actions,
          time: s.time,
          pulses: s.pulses,
          fragments: s.fragments.size,
          stars:
            1 +
            (s.fragments.size === level.fragments.length ? 1 : 0) +
            (s.time <= level.time && s.pulses <= level.budget ? 1 : 0),
        });
    }
  results.sort(
    (a, b) => b.stars - a.stars || a.pulses - b.pulses || a.time - b.time,
  );
  return results[0] || { failed: true };
}
const routes = [];
for (const l of Echo.levels) {
  const result = solve(l);
  routes.push(result);
  console.log(
    `${result.failed ? "FAIL" : "PASS"} ${l.id + 1} ${l.name}: ${result.failed ? "No verified route" : result.time.toFixed(1) + "s / " + result.pulses + " pulses / " + result.stars + " stars"}`,
  );
}
fs.writeFileSync(`${__dirname}/routes.json`, JSON.stringify(routes, null, 2));
assert.ok(
  routes.every((r) => !r.failed),
  "Every authored chamber must be solvable",
);
assert.ok(
  routes.every((r) => r.stars === 3),
  "All 36 stars must be attainable",
);
console.log(
  "PASS: all 12 authored levels and all 36 stars verified with actual physics and sound propagation.",
);
