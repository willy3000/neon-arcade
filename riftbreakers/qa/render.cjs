const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const { createCanvas } = require(
  path.join(
    process.env.TEMP,
    "neon-arcade-canvas-qa/node_modules/@napi-rs/canvas",
  ),
);
const canvas = createCanvas(1080, 600);
canvas.getBoundingClientRect = () => ({ width: 1080, height: 600 });
const win = { Rift: {} },
  c = vm.createContext({
    window: win,
    Rift: win.Rift,
    console,
    document: { getElementById: () => canvas },
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
  "levels",
  "physics",
  "combat",
  "ai",
  "simulation",
  "save",
  "render",
])
  vm.runInContext(fs.readFileSync("riftbreakers/" + n + ".js", "utf8"), c);
const r = c.Rift,
  s = r.simulation.create(r.levels[2], "coop");
s.heroes[0].x = 480;
s.heroes[1].x = 590;
s.heroes.forEach((h) => (h.grounded = true));
r.combat.begin(s, s.heroes[0], "light");
s.heroes[0].action.t = 0.12;
s.heroes[0].state = "attack-active";
r.combat.begin(s, s.heroes[1], "special");
s.heroes[1].action.t = 0.18;
s.heroes[1].state = "special";
r.ai.warning(s, { x: 700, y: 492, w: 350, h: 68 }, 0.7, "slam");
r.renderer.resize();
r.renderer.update(0.02, s);
r.renderer.draw(s, 1.2);
fs.mkdirSync("riftbreakers/qa", { recursive: true });
fs.writeFileSync("riftbreakers/qa/combat.png", canvas.toBuffer("image/png"));
console.log("Rendered production Canvas to riftbreakers/qa/combat.png");
