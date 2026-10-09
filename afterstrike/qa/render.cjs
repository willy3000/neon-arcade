const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const { createCanvas } = require(
  path.join(
    process.env.TEMP,
    "neon-arcade-canvas-qa/node_modules/@napi-rs/canvas",
  ),
);
const canvas = createCanvas(960, 540),
  cover = createCanvas(500, 600);
canvas.getBoundingClientRect = () => ({ width: 960, height: 540 });
cover.getBoundingClientRect = () => ({ width: 500, height: 600 });
const win = { Afterstrike: {} },
  c = vm.createContext({
    window: win,
    Afterstrike: win.Afterstrike,
    console,
    document: {
      getElementById: (id) => (id === "after-world" ? canvas : cover),
    },
    matchMedia: () => ({ matches: false }),
    devicePixelRatio: 1,
    localStorage: { getItem: () => null },
    Set,
    Map,
    Math,
    JSON,
    Number,
  });
for (const n of [
  "config",
  "physics",
  "combat",
  "echo",
  "ai",
  "simulation",
  "save",
  "assets/rig",
  "effects",
  "render",
])
  vm.runInContext(fs.readFileSync("afterstrike/" + n + ".js", "utf8"), c);
const a = c.Afterstrike,
  s = a.simulation.create();
s.player.x = 680;
s.player.y = 296;
s.player.grounded = true;
s.player.action = {
  kind: "light",
  step: 1,
  t: 0.12,
  start: 0.055,
  active: 0.1,
  weapon: "blade",
};
s.player.state = "attack-active";
s.enemies = [
  a.ai.create({ type: "gunner", x: 780, y: 302 }, "qa1"),
  a.ai.create({ type: "bulwark", x: 890 }, "qa2"),
];
s.enemies[0].state = "windup";
s.enemies[0].aim = { x: 700, y: 320 };
s.echoes = [
  {
    ...s.player,
    x: 720,
    y: 458,
    facing: -1,
    echo: true,
    fade: 0.8,
    weapon: "chain",
    action: null,
    state: "run",
    phase: 1.5,
    grounded: true,
  },
];
a.renderer.resize();
a.renderer.update(0.2, s);
a.renderer.draw(s, 1.5);
fs.mkdirSync("afterstrike/qa", { recursive: true });
fs.writeFileSync("afterstrike/qa/combat.png", canvas.toBuffer("image/png"));
a.renderer.drawCover(2);
fs.writeFileSync("afterstrike/qa/nyx-cover.png", cover.toBuffer("image/png"));
// Registration atlas of the production rig, including all three weapon assemblies.
const atlas = createCanvas(1440, 780),
  ctx = atlas.getContext("2d");
ctx.fillStyle = "#152b38";
ctx.fillRect(0, 0, 1440, 780);
const poses = ["idle", "run", "jump", "attack-active", "heavy", "parry"];
for (let row = 0; row < 3; row++)
  for (let col = 0; col < 6; col++) {
    const b = {
      ...a.physics.body(col * 240 + 85, row * 260 + 63),
      weapon: ["blade", "gauntlets", "chain"][row],
      state: poses[col],
      phase: 1.2,
      grounded: col < 2 || col > 2,
      hp: 100,
    };
    if (col >= 3)
      b.action = {
        kind: col === 3 ? "light" : col === 4 ? "heavy" : "parry",
        weapon: b.weapon,
        t: 0.12,
        start: 0.055,
        active: 0.1,
        step: 1,
      };
    a.rig.draw(ctx, b, 1.2, { glow: false });
    ctx.strokeStyle = "#6d879344";
    ctx.beginPath();
    ctx.moveTo(col * 240 + 10, row * 260 + 115);
    ctx.lineTo(col * 240 + 230, row * 260 + 115);
    ctx.stroke();
  }
fs.writeFileSync("afterstrike/qa/rig-atlas.png", atlas.toBuffer("image/png"));
console.log(
  "Actual Canvas renders written for Nyx, combat, and registered animation atlas.",
);
