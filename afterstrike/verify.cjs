const assert = require("node:assert/strict"),
  fs = require("node:fs");
global.window = global;
for (const n of ["config", "physics", "combat", "echo", "ai", "simulation"])
  require("./" + n + ".js");
const A = Afterstrike,
  P = A.physics;
function controller(s, plan) {
  const h = s.player,
    a = { jump: true },
    enemy = s.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => P.distance(h, a) - P.distance(h, b))[0];
  if (enemy && P.distance(h, enemy) < 550) {
    const dx = enemy.x - h.x;
    a.left = dx < -45;
    a.right = dx > 45;
    if (!h.action && P.distance(h, enemy) < 150) {
      if (h.facing !== Math.sign(dx)) {
        a.left = dx < 0;
        a.right = dx > 0;
      }
      a.light = true;
      if (enemy.type === "bulwark" || enemy.boss) a.heavy = true;
      if (h.special > 50) a.special = true;
      if (h.ultimate >= 100) a.ultimate = true;
    }
  } else a.right = true;
  if (s.stage === 0 && !s.relayOpen && h.x > 1135 && !enemy) {
    if (!plan.held) {
      const dx = 1210 - h.x;
      a.left = dx < -6;
      a.right = dx > 6;
      if (Math.abs(dx) < 8 && h.grounded) {
        plan.wait++;
        if (plan.wait > 240) {
          a.echo = true;
          plan.held = true;
        }
      }
    } else a.right = true;
  }
  const feet = h.y + h.h,
    front = h.x + h.w / 2 + (a.left ? -1 : 1) * 45,
    terrain = P.solids(s);
  const support = terrain.some(
    (t) => front >= t.x && front <= t.x + t.w && Math.abs(t.y - feet) < 12,
  );
  const wall = terrain.some(
    (t) =>
      t.x < h.x + h.w + 40 &&
      t.x + t.w > h.x - 40 &&
      t.y < feet - 5 &&
      t.y > h.y - 140,
  );
  const warning = s.warnings.some(
    (z) =>
      z.t < 0.25 && z.t > 0 && P.overlap({ ...h, y: h.y - 10, h: h.h + 20 }, z),
  );
  if (
    h.grounded &&
    (warning || !support || wall || (enemy && enemy.y < h.y - 70))
  )
    a.jumpPressed = true;
  if (!h.grounded && h.vy > 70 && h.jumps < 2 && !support) a.jumpPressed = true;
  if (warning && h.dashCooldown <= 0) a.parry = true;
  if (!support && !h.grounded && h.vy > 30 && h.dashCooldown <= 0)
    a.dash = true;
  if (
    enemy &&
    enemy.y > h.y + 90 &&
    P.distance(h, enemy) < 260 &&
    h.grounded &&
    h.y < 420 &&
    !plan.drop
  ) {
    const ledge = terrain.find(
      (t) => h.x + h.w > t.x && h.x < t.x + t.w && Math.abs(t.y - feet) < 10,
    );
    if (ledge) plan.drop = h.x - ledge.x < ledge.x + ledge.w - h.x ? -1 : 1;
  }
  if (plan.drop) {
    a.left = plan.drop < 0;
    a.right = plan.drop > 0;
    a.jumpPressed = false;
    a.dash = false;
    if (h.grounded && h.y > 420) plan.drop = 0;
  }
  if (enemy && s.history.count > 180 && s.echoCooldown <= 0 && h.energy >= 35)
    a.echo = true;
  return a;
}
function solve(weapon = "blade", seed = 12345) {
  const s = A.simulation.create({ weapon, seed }),
    runs = [];
  let frames = 0,
    key = "",
    plan = { held: false, wait: 0 };
  while (!s.won && !s.failed && s.time < 240 && frames < 60000) {
    if (s.transition) {
      const id = s.offers[0].id;
      A.simulation.choose(s, id);
      runs.push({ upgrade: id });
      key = "";
      plan = { held: false, wait: 0 };
    }
    const actions = controller(s, plan),
      next = JSON.stringify(actions);
    if (next === key) runs[runs.length - 1].frames++;
    else {
      runs.push({ frames: 1, actions });
      key = next;
    }
    A.simulation.step(s, actions);
    frames++;
  }
  return {
    won: s.won,
    failed: s.failed,
    time: s.time,
    stage: s.stage,
    kills: s.kills,
    syncs: s.syncs,
    hp: s.player.hp,
    x: s.player.x,
    y: s.player.y,
    relay: s.relayOpen,
    boss: s.enemies.find((e) => e.boss)?.hp,
    runs,
  };
}
if (require.main === module) {
  const routes = [];
  for (const weapon of Object.keys(A.weapons)) {
    const r = solve(weapon);
    routes.push({ weapon, ...r });
    console.log(weapon, JSON.stringify({ ...r, runs: undefined }));
  }
  fs.writeFileSync(__dirname + "/routes.json", JSON.stringify(routes, null, 2));
  assert(
    routes.every((r) => r.won),
    "All weapon runs must complete with actual actions",
  );
}
module.exports = { solve, controller };
