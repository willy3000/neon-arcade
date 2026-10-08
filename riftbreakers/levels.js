/* Authored combat spaces, encounter compositions and traversal routes. */
window.Rift = window.Rift || {};
(() => {
  const floor = (x, w) => ({ x, y: 560, w, h: 100 });
  const platform = (x, y, w, h = 18) => ({ x, y, w, h });
  const enemy = (type, x, y = 518) => ({ type, x, y });
  const wave = (x, gate, enemies) => ({ x, gate, enemies });
  const crate = (x, y = 518, barrel = false) => ({
    x,
    y,
    w: 36,
    h: 42,
    barrel,
  });
  const anchor = (x, y = 270) => ({ x, y });
  const relic = (x, y = 430) => ({ x, y });
  const trap = (x, phase = 0, w = 90) => ({
    x,
    y: 548,
    w,
    h: 12,
    phase,
    period: 4.8,
    warning: 1.1,
    active: 1.0,
  });
  const levels = [
    {
      name: "First Contact",
      chapter: "CITY UNDER SIEGE",
      theme: "city",
      width: 1900,
      time: 150,
      tutorial:
        "F / K: slash. Tap again after contact to chain a combo. G / L: special. Clear the gate, then smash the rift generator.",
      terrain: [
        floor(0, 1900),
        platform(570, 465, 170),
        platform(1060, 430, 170),
      ],
      waves: [
        wave(280, 780, [enemy("grunt", 490), enemy("grunt", 650)]),
        wave(890, 1500, [
          enemy("grunt", 1080),
          enemy("sniper", 1230, 388),
          enemy("guard", 1400),
        ]),
      ],
      crates: [crate(330), crate(990), crate(1350, 518, true)],
      anchors: [anchor(830)],
      relics: [relic(650, 420), relic(1140, 385)],
      checkpoints: [850],
      traps: [],
      moving: [],
    },
    {
      name: "Skyline Riot",
      chapter: "CITY UNDER SIEGE",
      theme: "sky",
      width: 2300,
      time: 190,
      tutorial:
        "Jump twice to reach rooftops. Dash preserves momentum. Y / I attaches or releases a rift grapple; steer while swinging.",
      terrain: [
        floor(0, 850),
        floor(1050, 1250),
        platform(490, 450, 180),
        platform(1330, 455, 180),
        platform(1640, 390, 150),
      ],
      waves: [
        wave(220, 770, [
          enemy("hunter", 460),
          enemy("grunt", 610),
          enemy("sniper", 570, 408),
        ]),
        wave(1200, 2110, [
          enemy("hunter", 1430),
          enemy("bomber", 1710),
          enemy("guard", 1890),
          enemy("grunt", 2010),
        ]),
      ],
      crates: [crate(340), crate(1510, 518, true)],
      anchors: [anchor(950, 285), anchor(1570, 220)],
      relics: [relic(570, 400), relic(1710, 345)],
      checkpoints: [1130],
      traps: [trap(1810, 2)],
      moving: [
        { ...platform(900, 490, 120), axis: "x", range: 65, speed: 1.2 },
      ],
    },
    {
      name: "The Iron Warden",
      chapter: "CITY UNDER SIEGE",
      theme: "foundry",
      width: 1200,
      time: 180,
      boss: "warden",
      tutorial:
        "Watch the amber warning shapes. Jump shockwaves, dash through the charge, and punish the Warden while its core is exposed.",
      terrain: [
        floor(0, 1200),
        platform(180, 430, 135),
        platform(870, 430, 135),
      ],
      waves: [],
      crates: [crate(150), crate(990)],
      anchors: [anchor(380, 240), anchor(820, 240)],
      relics: [relic(240, 385)],
      checkpoints: [],
      traps: [],
      moving: [],
    },
    {
      name: "Chain Reaction",
      chapter: "THE BROKEN CORE",
      theme: "lab",
      width: 2400,
      time: 200,
      tutorial:
        "Grappels carry your swing momentum. Glowing red strips warn before firing. Heavy attacks break reinforced crates; barrels hurt enemies and allies.",
      terrain: [
        floor(0, 730),
        floor(980, 620),
        floor(1800, 600),
        platform(1280, 435, 150),
      ],
      waves: [
        wave(200, 670, [enemy("sniper", 480), enemy("bomber", 590)]),
        wave(1090, 1510, [enemy("guard", 1240), enemy("hunter", 1450)]),
        wave(1900, 2210, [enemy("bomber", 2040), enemy("grunt", 2140)]),
      ],
      crates: [crate(350), crate(1190, 518, true), crate(2110, 518, true)],
      anchors: [anchor(845, 250), anchor(1700, 245)],
      relics: [relic(845, 305), relic(1350, 390)],
      checkpoints: [1030, 1840],
      traps: [trap(1380), trap(1990, 2)],
      moving: [
        { ...platform(795, 485, 120), axis: "x", range: 60, speed: 0.9 },
        { ...platform(1640, 490, 120), axis: "x", range: 65, speed: 1.1 },
      ],
    },
    {
      name: "Two Against the Core",
      chapter: "THE BROKEN CORE",
      theme: "lab",
      width: 2150,
      time: 210,
      tutorial:
        "Volt's lightning stuns guards; Blaze's heavy strike breaks armor. Alternate hits for team bonuses. Both fusion keys unleash a full meter. Stand close to a downed ally to revive.",
      terrain: [
        floor(0, 2150),
        platform(600, 450, 190),
        platform(1310, 420, 170),
      ],
      waves: [
        wave(230, 920, [
          enemy("guard", 480),
          enemy("sentinel", 680),
          enemy("sniper", 740, 408),
        ]),
        wave(1080, 1900, [
          enemy("sentinel", 1370),
          enemy("guard", 1510),
          enemy("hunter", 1660),
          enemy("bomber", 1810),
        ]),
      ],
      crates: [crate(330, 518, true), crate(1140), crate(1580, 518, true)],
      anchors: [anchor(1030), anchor(1590, 240)],
      relics: [relic(690, 405), relic(1390, 375)],
      checkpoints: [1010],
      traps: [trap(1230, 1)],
      moving: [],
    },
    {
      name: "The Rift Serpent",
      chapter: "THE BROKEN CORE",
      theme: "rift",
      width: 1200,
      time: 210,
      boss: "serpent",
      tutorial:
        "The Serpent emerges where portals flare. Its beams mark a lane before firing. Swing above floor hazards, then strike the exposed head.",
      terrain: [
        floor(0, 1200),
        platform(230, 440, 140),
        platform(820, 440, 140),
      ],
      waves: [],
      crates: [crate(120), crate(1010)],
      anchors: [anchor(400, 220), anchor(800, 220)],
      relics: [relic(890, 395)],
      checkpoints: [],
      traps: [],
      moving: [],
    },
    {
      name: "Fracture Front",
      chapter: "THE FINAL BREACH",
      theme: "rift",
      width: 2550,
      time: 230,
      tutorial:
        "Unstable rifts bring enemies in waves. Swing-kicks strike during a fast grapple. Stay together: arena gates open only when the encounter is cleared.",
      terrain: [
        floor(0, 920),
        floor(1160, 1390),
        platform(450, 425, 160),
        platform(1540, 445, 170),
        platform(2070, 395, 170),
      ],
      waves: [
        wave(230, 820, [
          enemy("hunter", 420),
          enemy("sniper", 520, 383),
          enemy("sentinel", 740),
        ]),
        wave(1260, 1840, [
          enemy("bomber", 1420),
          enemy("hunter", 1630),
          enemy("guard", 1770),
        ]),
        wave(1930, 2340, [
          enemy("sentinel", 2120),
          enemy("sniper", 2150, 353),
          enemy("hunter", 2260),
        ]),
      ],
      crates: [crate(330), crate(1370, 518, true), crate(1960)],
      anchors: [anchor(1040, 240), anchor(1890, 235)],
      relics: [relic(520, 380), relic(2150, 350)],
      checkpoints: [1200, 1880],
      traps: [trap(1700, 2), trap(2000)],
      moving: [
        { ...platform(985, 475, 120), axis: "x", range: 75, speed: 1.1 },
      ],
    },
    {
      name: "Citadel Gauntlet",
      chapter: "THE FINAL BREACH",
      theme: "fortress",
      width: 2400,
      time: 250,
      tutorial:
        "Three sealed encounters guard the citadel. Save energy for elites, use barrels carefully, and revive before your teammate's rescue timer expires.",
      terrain: [
        floor(0, 2400),
        platform(500, 455, 150),
        platform(1190, 420, 160),
        platform(1840, 455, 170),
      ],
      waves: [
        wave(230, 850, [
          enemy("guard", 430),
          enemy("bomber", 580),
          enemy("hunter", 710),
        ]),
        wave(970, 1610, [
          enemy("sentinel", 1180),
          enemy("guard", 1320),
          enemy("sniper", 1260, 378),
          enemy("hunter", 1470),
        ]),
        wave(1720, 2220, [
          enemy("sentinel", 1840),
          enemy("bomber", 1990),
          enemy("hunter", 2120),
          enemy("grunt", 2180),
        ]),
      ],
      crates: [crate(310, 518, true), crate(1050), crate(1810, 518, true)],
      anchors: [anchor(920, 230), anchor(1650, 235)],
      relics: [relic(560, 410), relic(1260, 375), relic(1920, 410)],
      checkpoints: [900, 1660],
      traps: [trap(1380, 1), trap(2040, 3)],
      moving: [],
    },
    {
      name: "The Void Emperor",
      chapter: "THE FINAL BREACH",
      theme: "void",
      width: 1200,
      time: 300,
      boss: "emperor",
      tutorial:
        "Three phases. Read the Emperor's marked strikes, destroy summoned invaders, and grapple over unstable portals. Fusion weakens a boss; it never skips the fight.",
      terrain: [
        floor(0, 1200),
        platform(180, 440, 145),
        platform(865, 440, 145),
      ],
      waves: [],
      crates: [crate(110), crate(1040)],
      anchors: [anchor(370, 220), anchor(830, 220)],
      relics: [relic(245, 395), relic(930, 395)],
      checkpoints: [],
      traps: [],
      moving: [],
    },
  ];
  levels.forEach((l, id) => {
    l.id = id;
    l.generator = { x: l.width - 135, y: 490, w: 48, h: 70 };
    l.exit = l.width - 60;
  });
  Rift.levels = levels;
})();
