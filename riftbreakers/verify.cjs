/* Deterministic playthrough driver: action packets only, no teleports or modified health. */
const fs = require("node:fs"),
  assert = require("node:assert/strict");
global.window = global;
for (const n of ["levels", "physics", "combat", "ai", "simulation"])
  require("./" + n + ".js");
const R = Rift,
  P = R.physics;
function controller(s, h) {
  const a = { jump: true };
  if (h.hp <= 0) return a;
  const allies = s.heroes.find((x) => x !== h);
  if (allies.hp <= 0) {
    a.left = h.x > allies.x + 20;
    a.right = h.x < allies.x - 20;
    return a;
  }
  const live = s.enemies
    .filter((e) => e.hp > 0)
    .sort((a, b) => P.dist(h, a) - P.dist(h, b));
  const e = live[0];
  let target =
    e && P.dist(h, e) < 800
      ? e.x
      : s.generatorReady
        ? s.generator.x
        : s.level.width - 130;
  let dx = target - h.x;
  a.left = dx < -55;
  a.right = dx > 55;
  if (e && P.dist(h, e) < 150) {
    if (!h.action && h.facing !== (dx > 0 ? 1 : -1)) {
      a.left = dx < 0;
      a.right = dx > 0;
    }
    if (!h.action) {
      a.heavy = e.type === "guard" || s.time % 2 < 0.8;
      a.light = !a.heavy;
      if (h.energy >= 35 && (live.length > 1 || e.boss)) a.special = true;
      if (h.ultimate >= 100) a.ultimate = true;
    }
  }
  if (
    s.generatorReady &&
    s.generator.hp > 0 &&
    P.dist(h, s.generator) < 145 &&
    !h.action
  ) {
    if (h.facing !== (s.generator.x > h.x ? 1 : -1)) {
      a.left = s.generator.x < h.x;
      a.right = s.generator.x > h.x;
    }
    a.heavy = true;
  }
  if (s.generator.hp <= 0) {
    target = s.level.exit;
    dx = target - h.x;
    a.right = dx > 12;
    a.left = dx < -40;
  }
  const terrain = P.solids(s),
    feet = h.y + h.h,
    front = h.x + h.w / 2 + Math.sign(dx) * 42;
  const support = terrain.some(
    (t) => front >= t.x && front <= t.x + t.w && Math.abs(t.y - feet) < 12,
  );
  const wall = terrain.some(
    (t) =>
      t.x < h.x + h.w + 42 &&
      t.x + t.w > h.x - 42 &&
      t.y < feet - 4 &&
      t.y > h.y - 130,
  );
  const warning = s.warnings.find(
    (z) =>
      z.t < 0.25 &&
      z.t > -0.1 &&
      P.overlap({ ...h, y: h.y - 10, h: h.h + 20 }, z),
  );
  const trap = s.level.traps.some(
    (t) =>
      Math.abs(t.x + t.w / 2 - h.x) < 100 &&
      (s.time + t.phase) % t.period < t.warning + t.active,
  );
  if (
    h.grounded &&
    (warning ||
      trap ||
      !support ||
      wall ||
      (e && e.y < h.y - 70 && Math.abs(dx) < 150))
  )
    a.jumpPressed = true;
  if (
    !h.grounded &&
    h.vy > 60 &&
    h.jumps < 2 &&
    (!support || (e && e.y < h.y - 35))
  )
    a.jumpPressed = true;
  if (warning && h.dashCooldown <= 0) a.dash = true;
  if (!support && !h.grounded && h.dashCooldown <= 0 && h.vy > 0) a.dash = true;
  if (s.fusion >= 100) a.fusion = true;
  return a;
}
function solve(level, mode) {
  const s = R.simulation.create(level, mode),
    runs = [];
  let frames = 0,
    previous = "";
  while (!s.won && !s.failed && s.time < 360 && frames < 90000) {
    const actions = { blaze: controller(s, s.heroes[0]) };
    if (mode === "coop") actions.volt = controller(s, s.heroes[1]);
    const key = JSON.stringify(actions);
    if (key === previous) runs[runs.length - 1].frames++;
    else {
      runs.push({ frames: 1, actions });
      previous = key;
    }
    R.simulation.step(s, actions);
    frames++;
  }
  return {
    won: s.won,
    failed: s.failed,
    time: s.time,
    score: s.score,
    kills: s.kills,
    damage: s.damage,
    checkpoint: s.checkpointIndex,
    heroes: s.heroes.map((h) => ({
      x: Math.round(h.x),
      y: Math.round(h.y),
      hp: h.hp,
    })),
    boss: s.enemies.find((e) => e.boss)?.hp,
    waves: s.waves,
    actions: runs,
  };
}
if (require.main === module) {
  const mode = process.argv.includes("--coop") ? "coop" : "solo",
    routes = [];
  for (const l of R.levels) {
    const r = solve(l, mode);
    routes.push(r);
    console.log(
      (r.won ? "PASS" : "FAIL") +
        " " +
        (l.id + 1) +
        " " +
        l.name +
        " " +
        r.time.toFixed(1) +
        "s " +
        JSON.stringify({ ...r, actions: undefined }),
    );
  }
  fs.writeFileSync(
    __dirname + "/" + mode + "-routes.json",
    JSON.stringify(routes, null, 2),
  );
  assert(
    routes.every((r) => r.won),
    "All nine levels must have real-action completions in " + mode,
  );
}
module.exports = { controller, solve };
