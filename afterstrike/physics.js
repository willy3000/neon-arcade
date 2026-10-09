(() => {
  const A = Afterstrike,
    F = A.GAME_FEEL;
  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const distance = (a, b) =>
    Math.hypot(center(a).x - center(b).x, center(a).y - center(b).y);
  const solids = (s) => [
    ...s.scene.terrain,
    ...s.gates.filter((g) => !g.open),
    ...(s.scene.door && !s.relayOpen && !s.relayHeld ? [s.scene.door] : []),
  ];
  function move(s, b, dt) {
    const terrain = solids(s),
      oldGround = b.grounded,
      oldVy = b.vy;
    b.wall = 0;
    b.x += b.vx * dt;
    for (const t of terrain)
      if (overlap(b, t)) {
        // Forgive a few pixels of ledge clipping during a dash, without phasing walls.
        if (
          b.who === "nyx" &&
          b.action?.kind === "dash" &&
          b.y + b.h - t.y > 0 &&
          b.y + b.h - t.y <= 6 &&
          !terrain.some((o) => o !== t && overlap({ ...b, y: t.y - b.h }, o))
        )
          b.y = t.y - b.h;
        else {
          b.x = b.vx >= 0 ? t.x - b.w : t.x + t.w;
          b.wall = b.vx >= 0 ? 1 : -1;
          b.vx = 0;
        }
      }
    b.x = Math.max(0, Math.min(s.scene.width - b.w, b.x));
    b.grounded = false;
    b.y += b.vy * dt;
    for (const t of terrain)
      if (overlap(b, t)) {
        if (b.vy >= 0) {
          b.y = t.y - b.h;
          b.grounded = true;
        } else b.y = t.y + t.h;
        b.vy = 0;
      }
    if (b.y < -20) {
      b.y = -20;
      b.vy = Math.max(0, b.vy);
    }
    if (!oldGround && b.grounded && b.who === "nyx") {
      b.land = 0.14;
      b.landStrength = Math.min(1, oldVy / 850);
      s.events.push({
        type: "land",
        x: b.x + b.w / 2,
        y: b.y + b.h,
        strong: oldVy > 650,
      });
    }
  }
  function body(x = 72, y = 458) {
    return {
      who: "nyx",
      x,
      y,
      w: 32,
      h: 52,
      vx: 0,
      vy: 0,
      facing: 1,
      weapon: "blade",
      hp: 100,
      energy: 100,
      special: 70,
      ultimate: 0,
      grounded: false,
      coyote: 0,
      jumpBuffer: 0,
      jumps: 0,
      jumpCut: false,
      wall: 0,
      state: "idle",
      action: null,
      buffer: null,
      comboStep: 0,
      comboTime: 0,
      invulnerable: 0,
      stun: 0,
      dashCooldown: 0,
      anchor: null,
      snapWindow: 0,
      idle: 0,
      land: 0,
      foot: 0,
      charge: 0,
      chargeHeld: false,
      flash: 0,
      phase: 0,
    };
  }
  A.physics = { overlap, center, distance, solids, move, body };
})();
