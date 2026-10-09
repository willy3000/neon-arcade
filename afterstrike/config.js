window.Afterstrike = window.Afterstrike || {};
(() => {
  const A = Afterstrike;
  A.GAME_FEEL = Object.freeze({
    dt: 1 / 120,
    speed: 320,
    groundAcceleration: 4200,
    airAcceleration: 2700,
    friction: 3400,
    gravity: 1700,
    jump: 650,
    maxFall: 900,
    coyote: 0.1,
    jumpBuffer: 0.13,
    attackBuffer: 0.18,
    dashSpeed: 820,
    dashTime: 0.17,
    dashCooldown: 0.55,
    parryWindow: 0.17,
    hitImmunity: 0.85,
    hitstop: 0.035,
    cameraDamping: 8,
    lookAhead: 85,
    echoSeconds: 3,
    echoCost: 35,
    echoCooldown: 4.5,
    maxEchoes: 2,
  });
  A.weapons = {
    blade: {
      name: "CHRONO BLADE",
      reach: 90,
      light: [22, 27, 37],
      start: 0.055,
      active: 0.1,
      recovery: 0.14,
      heavy: 60,
      color: "#ffa89b",
      stagger: 1,
    },
    gauntlets: {
      name: "RIFT GAUNTLETS",
      reach: 65,
      light: [30, 33, 44],
      start: 0.09,
      active: 0.1,
      recovery: 0.19,
      heavy: 80,
      color: "#ffd397",
      stagger: 3,
    },
    chain: {
      name: "PHANTOM CHAIN",
      reach: 150,
      light: [17, 21, 28],
      start: 0.08,
      active: 0.13,
      recovery: 0.17,
      heavy: 48,
      color: "#c4acf7",
      stagger: 1,
    },
  };
  A.mutations = [
    {
      id: "exposure",
      name: "DOUBLE EXPOSURE",
      text: "Echo Shift replays four seconds instead of three. More time to hold a relay or set up an ambush.",
    },
    {
      id: "kinetic",
      name: "KINETIC EDGE",
      text: "Dash attacks restore 12 echo energy on contact. Movement becomes your next replay.",
    },
    {
      id: "chorus",
      name: "PHANTOM CHORUS",
      text: "Perfect sync sends a small secondary shockwave into nearby enemies.",
    },
    {
      id: "gravity",
      name: "GRAVITY BREAK",
      text: "Air-heavy landings send a damaging ground wave in your facing direction.",
    },
    {
      id: "refund",
      name: "ECHO REFUND",
      text: "Synchronized eliminations restore 18 echo energy. Build around coordinated finishers.",
    },
    {
      id: "bloodless",
      name: "BLOODLESS MOMENT",
      text: "A successful parry slows all enemies for one second. Space to choose your counter.",
    },
  ];
  const floor = (x, w) => ({ x, y: 510, w, h: 90 }),
    platform = (x, y, w) => ({ x, y, w, h: 18 });
  A.scenes = [
    {
      name: "The Last Tram",
      subtitle: "THE FALLEN CITY / 01",
      width: 1800,
      terrain: [
        floor(0, 1800),
        platform(420, 408, 150),
        platform(685, 348, 135),
        platform(930, 406, 120),
      ],
      anchors: [{ x: 610, y: 210 }],
      encounters: [
        {
          x: 250,
          gate: 1090,
          variants: [
            [
              { type: "scavenger", x: 440 },
              { type: "gunner", x: 740, y: 302 },
              { type: "bulwark", x: 890 },
            ],
            [
              { type: "scavenger", x: 470 },
              { type: "lancer", x: 710 },
              { type: "gunner", x: 950, y: 360 },
            ],
          ],
        },
      ],
      pad: { x: 1190, y: 503, w: 72, h: 7 },
      door: { x: 1400, y: -600, w: 18, h: 1110 },
      relics: [
        { x: 750, y: 300 },
        { x: 1570, y: 464 },
      ],
      exit: 1720,
      story: "The tram timetable is still counting down. No trains remain.",
      tutorial:
        "A/D to move · SPACE to jump twice · J to slash · SHIFT to dash. E repeats your last three seconds.",
    },
    {
      name: "Transit Scar",
      subtitle: "THE FALLEN CITY / 02",
      width: 1640,
      terrain: [
        floor(0, 740),
        floor(985, 655),
        platform(380, 395, 150),
        platform(1110, 380, 170),
      ],
      anchors: [
        { x: 855, y: 205 },
        { x: 1340, y: 220 },
      ],
      encounters: [
        {
          x: 160,
          gate: 665,
          variants: [
            [
              { type: "lancer", x: 350 },
              { type: "hunter", x: 520 },
            ],
            [
              { type: "bulwark", x: 355 },
              { type: "scavenger", x: 580 },
            ],
          ],
        },
        {
          x: 1030,
          gate: 1450,
          variants: [
            [
              { type: "hunter", x: 1150 },
              { type: "gunner", x: 1190, y: 334 },
              { type: "scavenger", x: 1380 },
            ],
            [
              { type: "bulwark", x: 1160 },
              { type: "lancer", x: 1330 },
              { type: "gunner", x: 1240, y: 334 },
            ],
          ],
        },
      ],
      relics: [
        { x: 440, y: 346 },
        { x: 855, y: 280 },
      ],
      exit: 1570,
      story: "A child's chalk arrow points toward a sky that no longer exists.",
      tutorial:
        "Q anchors to a gold node. Hold toward it to pull, steer to swing, Q to release. Dash within a blink of release for MOMENTUM SNAP.",
    },
    {
      name: "Clockwork Heart",
      subtitle: "THE FALLEN CITY / GUARDIAN",
      width: 1100,
      terrain: [
        floor(0, 1100),
        platform(140, 390, 145),
        platform(830, 390, 145),
      ],
      anchors: [
        { x: 345, y: 195 },
        { x: 755, y: 195 },
      ],
      encounters: [],
      relics: [{ x: 210, y: 340 }],
      exit: 1040,
      boss: true,
      story: "The guardian is still protecting a city that died before it.",
      tutorial:
        "The Titan marks every strike. Parry with F; break the armored arms with gauntlets or heavy hits. Strike its core during recovery.",
    },
    {
      name: "Fracture Lab",
      subtitle: "PRACTICE / ALL WEAPONS",
      width: 1500,
      terrain: [
        floor(0, 1500),
        platform(400, 390, 150),
        platform(750, 325, 150),
        { x: 1120, y: 270, w: 24, h: 240 },
      ],
      anchors: [{ x: 655, y: 190 }],
      encounters: [],
      relics: [],
      exit: 1400,
      practice: true,
      story: "A controlled fracture. No consequences, only possibilities.",
      tutorial:
        "Practice: 1/2/3 switch weapons · J light · hold K to charge · F parry · E echo · C collapse · U ultimate · R resets the room.",
    },
  ];
})();
