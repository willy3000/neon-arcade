/* Verify authored cooperative puzzles by driving real actions through real physics. */
const fs = require("node:fs"),
  assert = require("node:assert/strict");
global.window = global;
require("./levels.js");
require("./physics.js");
const P = Phasebound.physics;
const solo = process.argv.includes("--solo");
const both = (x) => ({ kai: x, luma: x + 30 });
const plans = [
  [both(995)],
  [both(995)],
  [{ kai: 388 }, { luma: 1020 }, { kai: 970 }],
  [{ kai: 504, push: true }, { interact: "kai" }, both(995)],
  [{ luma: 330 }, { interact: "luma" }, both(995)],
  [
    { luma: 555 },
    { interact: "luma" },
    { kai: 728 },
    { luma: 1020 },
    { kai: 970 },
  ],
  [{ luma: 345 }, { interact: "luma" }, both(995)],
  [
    { kai: 278 },
    { luma: 675 },
    { interact: "luma" },
    { kai: 828 },
    { luma: 1020 },
    { kai: 970 },
  ],
  [{ kai: 320, luma: 355 }, { interact: "kai" }, both(995)],
  [
    { kai: 265, luma: 300 },
    { interact: "kai" },
    { ferry: true },
    { kai: 735, luma: 765 },
    both(995),
  ],
  [
    { luma: 250 },
    { interact: "luma" },
    { kai: 550, luma: 575 },
    { interact: "kai" },
    both(995),
  ],
  [
    { luma: 280 },
    { interact: "luma" },
    { kai: 629, push: true },
    { interact: "kai" },
    { kai: 770, luma: 790 },
    { interact: "kai" },
    { luma: 900 },
    { interact: "luma" },
    { kai: 1010, luma: 1030 },
  ],
];
function controller(s, who, target, push = false) {
  const c = s[who];
  if (target === undefined || c.docked) return {};
  const cx = c.x + c.w / 2,
    d = target - cx,
    a = { left: d < -7, right: d > 7, jump: true, jumpPressed: false };
  if (c.grounded && Math.abs(d) > 7) {
    const sign = Math.sign(d),
      feet = c.y + c.h;
    const blocks = P.terrain(s, who).concat(
      who === "kai" && !push ? s.blocks : [],
    );
    const obstacle = blocks.some(
      (b) =>
        b.y < feet - 2 &&
        b.y > c.y - 100 &&
        b.y + b.h > c.y &&
        (sign > 0
          ? b.x >= c.x + c.w - 2 && b.x - c.x - c.w < 62
          : b.x + b.w <= c.x + 2 && c.x - b.x - b.w < 62),
    );
    const fx = cx + sign * 26,
      support = blocks.some(
        (b) => b.x <= fx && b.x + b.w >= fx && Math.abs(b.y - feet) < 8,
      );
    const collectible = s.level.crystals.some(
      (o, i) =>
        !s.collected.has(i) &&
        (o.owner === who || o.owner === "both") &&
        Math.abs(o.x - cx) < 45 &&
        o.y < c.y - 10 &&
        o.y > c.y - 85,
    );
    a.jumpPressed = obstacle || !support || collectible;
  }
  return a;
}
function solve(level) {
  const s = P.create(level),
    runs = [];
  let stage = 0,
    frames = 0,
    selected = "kai";
  while (!s.won && !s.dead && s.time < 150) {
    const command =
        plans[level.id][Math.min(stage, plans[level.id].length - 1)],
      actions = { kai: {}, luma: {} };
    if (command.ferry) {
      for (const who of ["kai", "luma"]) {
        const c = s[who],
          p = s.platforms[0];
        if (P.center(c).x > 650) actions[who] = {};
        else if (c.grounded && c.support === p.id) {
          actions[who] = p.x + p.w > 645 ? { right: true, jump: true } : {};
        } else if (c.grounded && P.center(c).x < 380 && p.x > 410)
          actions[who] = {};
        else actions[who] = controller(s, who, p.x + p.w / 2);
      }
      if (P.center(s.kai).x > 650 && P.center(s.luma).x > 650) stage++;
    } else if (command.interact) {
      const previous = plans[level.id][stage - 1] || {};
      for (const who of ["kai", "luma"])
        actions[who] = controller(s, who, previous[who], previous.push);
      if (s.kai.grounded && s.luma.grounded) {
        actions[command.interact].interact = true;
        stage++;
      }
    } else {
      for (const who of ["kai", "luma"])
        actions[who] = controller(s, who, command[who], command.push);
      if (
        ["kai", "luma"].every(
          (who) =>
            command[who] === undefined ||
            s[who].docked ||
            Math.abs(P.center(s[who]).x - command[who]) < 10,
        )
      ) {
        stage = Math.min(stage + 1, plans[level.id].length - 1);
      }
    }
    if (solo) {
      const other = selected === "kai" ? "luma" : "kai";
      const active = (a) => a.left || a.right || a.jumpPressed || a.interact;
      let next = selected;
      if (actions[other].interact) next = other;
      else if (!actions[selected].interact && s[selected].grounded) {
        if (!active(actions[selected]) && active(actions[other])) next = other;
        const direction = actions[selected].right
          ? 1
          : actions[selected].left
            ? -1
            : 0;
        if (
          s.tether &&
          direction &&
          direction * (s[selected].x - s[other].x) > 145 &&
          active(actions[other])
        )
          next = other;
      }
      if (next !== selected) {
        s[selected].vx = 0;
        selected = next;
      }
      actions[selected === "kai" ? "luma" : "kai"] = {};
    }
    const serialized = JSON.stringify({
      actions,
      selected: solo ? selected : null,
    });
    if (runs.length && runs[runs.length - 1].key === serialized)
      runs[runs.length - 1].frames++;
    else
      runs.push({
        frames: 1,
        actions,
        ...(solo ? { selected } : {}),
        key: serialized,
      });
    P.step(s, actions);
    frames++;
  }
  return {
    won: s.won,
    dead: s.dead,
    time: s.time,
    collected: s.collected.size,
    stage,
    kai: [Math.round(s.kai.x), Math.round(s.kai.y)],
    luma: [Math.round(s.luma.x), Math.round(s.luma.y)],
    actions: runs.map(({ key, ...run }) => run),
  };
}
const routes = [];
for (const l of Phasebound.levels) {
  const r = solve(l);
  routes.push(r);
  console.log(
    `${r.won ? "PASS" : "FAIL"} ${l.id + 1} ${l.name}: ${r.time.toFixed(1)}s / stage ${r.stage} / crystals ${r.collected}/${l.crystals.length} / K ${r.kai} L ${r.luma} ${r.dead ? "fell" : ""}`,
  );
}
fs.writeFileSync(
  `${__dirname}/${solo ? "solo-routes" : "routes"}.json`,
  JSON.stringify(routes, null, 2),
);
assert.ok(
  routes.every((r) => r.won),
  "All twelve levels must be completed by real player actions",
);

assert.ok(
  routes.every(
    (r, i) =>
      r.collected === Phasebound.levels[i].crystals.length &&
      r.time <= Phasebound.levels[i].time &&
      !r.dead,
  ),
  "Every level has a flawless three-star route",
);
