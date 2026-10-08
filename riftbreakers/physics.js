/* Fixed-step kinematics. Gameplay bodies and contact resolution never depend on FX. */
(() => {
  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const center = (a) => ({ x: a.x + a.w / 2, y: a.y + a.h / 2 });
  const dist = (a, b) =>
    Math.hypot(center(a).x - center(b).x, center(a).y - center(b).y);
  function solids(s) {
    return [
      ...s.level.terrain,
      ...s.platforms,
      ...s.gates.filter((g) => !g.open),
      ...s.crates.filter((c) => c.hp > 0),
    ];
  }
  function move(s, b, dt, options = {}) {
    const terrain = solids(s),
      oldGround = b.grounded,
      oldVy = b.vy;
    b.wall = 0;
    if (b.support && b.grounded) {
      const p = s.platforms.find((p) => p.id === b.support);
      if (p) {
        b.x += p.dx;
        b.y += p.dy;
      }
    }
    b.x += b.vx * dt;
    for (const t of terrain)
      if (overlap(b, t)) {
        if (b.vx >= 0) {
          b.x = t.x - b.w;
          b.wall = 1;
        } else {
          b.x = t.x + t.w;
          b.wall = -1;
        }
        b.vx = 0;
      }
    b.x = Math.max(0, Math.min(s.level.width - b.w, b.x));
    b.grounded = false;
    b.support = null;
    b.y += b.vy * dt;
    for (const t of terrain)
      if (overlap(b, t)) {
        if (b.vy >= 0) {
          b.y = t.y - b.h;
          b.grounded = true;
          b.support = t.id || null;
        } else b.y = t.y + t.h;
        b.vy = 0;
      }
    if (!oldGround && b.grounded && oldVy > 180 && options.hero)
      s.events.push({
        type: "land",
        x: b.x + b.w / 2,
        y: b.y + b.h,
        who: b.who,
      });
  }
  function safePoint(s, x) {
    let best = null;
    for (const t of [...s.level.terrain, ...s.platforms]) {
      if (t.w < 55) continue;
      const px = Math.max(t.x + 18, Math.min(t.x + t.w - 44, x));
      const candidate = { x: px, y: t.y - 44, w: 26, h: 44 };
      if (solids(s).some((o) => overlap(candidate, o))) continue;
      const distance = Math.abs(px - x) + Math.abs(t.y - 560) * 0.5;
      if (!best || distance < best.distance) best = { ...candidate, distance };
    }
    return best || { x: 65, y: 516, w: 26, h: 44 };
  }
  Rift.physics = {
    DT: 1 / 120,
    overlap,
    center,
    dist,
    solids,
    move,
    safePoint,
  };
})();
