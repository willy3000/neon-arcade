/* Pure fixed-step physics and room interactions; also exercised by the solver. */
(() => {
  const H = Heist,
    DT = 1 / 120,
    R = 12;
  const directions = [
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
  ];
  const rectHit = (p, b, padding = 0) => {
    const x = Math.max(b.x, Math.min(p.x, b.x + b.w)),
      y = Math.max(b.y, Math.min(p.y, b.y + b.h));
    return (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + padding) ** 2;
  };
  function create(level) {
    return {
      level,
      x: level.spawn[0],
      y: level.spawn[1],
      vx: 0,
      vy: 0,
      r: R,
      gravity: 0,
      time: 0,
      rotations: 0,
      core: false,
      switches: {},
      timers: {},
      contacts: new Set(),
      dead: false,
      won: false,
      events: [],
    };
  }
  function rotate(s, dir) {
    if (s.dead || s.won) return;
    s.gravity = (s.gravity + dir + 4) % 4;
    s.rotations++;
    s.events.push("rotate");
  }
  function hazardAt(h, t) {
    const b = { ...h };
    if (h.axis) b[h.axis] += Math.sin(t * h.speed) * h.range;
    b.active = h.type !== "laser" || (t + (h.phase || 0)) % h.period < h.on;
    return b;
  }
  function doorOpen(s, d) {
    return d.ids.every((id) =>
      d.timed ? (s.timers[id] || 0) > 0 : !!s.switches[id],
    );
  }
  function resolve(s, b, axis) {
    if (!rectHit(s, b)) return;
    if (axis === "x") {
      s.x = s.vx > 0 ? b.x - s.r : b.x + b.w + s.r;
      s.vx = 0;
      s.vy *= b.magnetic ? 0.82 : Math.exp(-1.6 * DT);
    } else {
      s.y = s.vy > 0 ? b.y - s.r : b.y + b.h + s.r;
      s.vy = 0;
      s.vx *= b.magnetic ? 0.82 : Math.exp(-1.6 * DT);
    }
    if (b.magnetic && !s.contacts.has(b)) s.events.push("magnet");
    if (b.magnetic) s.contacts.add(b);
  }
  function step(s, dt = DT) {
    if (s.dead || s.won) return;
    s.events = [];
    s.time += dt;
    const previouslyOpen = new Set(
      s.level.doors.filter((d) => d.timed && doorOpen(s, d)),
    );
    for (const id of Object.keys(s.timers))
      s.timers[id] = Math.max(0, s.timers[id] - dt);
    // An open gate waits for a crossing robot to clear it; a closed gate stays locked.
    for (const d of previouslyOpen)
      if (rectHit(s, d))
        for (const id of d.ids)
          s.timers[id] = Math.max(s.timers[id] || 0, 0.05);
    let acceleration = 1000;
    if (s.level.zones.some((z) => rectHit(s, z))) acceleration *= 1.8;
    const [gx, gy] = directions[s.gravity];
    s.vx = (s.vx + gx * acceleration * dt) * Math.exp(-0.35 * dt);
    s.vy = (s.vy + gy * acceleration * dt) * Math.exp(-0.35 * dt);
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > 420) {
      s.vx *= 420 / speed;
      s.vy *= 420 / speed;
    }
    const solids = [
      ...s.level.walls,
      ...s.level.doors.filter((d) => !doorOpen(s, d)),
    ];
    const oldContacts = s.contacts;
    s.contacts = new Set();
    s.x += s.vx * dt;
    for (const b of solids) resolve(s, b, "x");
    s.y += s.vy * dt;
    for (const b of solids) resolve(s, b, "y");
    // A magnetic landing only produces feedback once, until the robot detaches.
    if ([...s.contacts].some((b) => oldContacts.has(b)))
      s.events = s.events.filter((e) => e !== "magnet");
    for (const h of s.level.hazards) {
      const b = hazardAt(h, s.time);
      if (
        b.active &&
        (b.r ? Math.hypot(s.x - b.x, s.y - b.y) < s.r + b.r : rectHit(s, b))
      ) {
        s.dead = true;
        s.events.push("death");
        return;
      }
    }
    for (const pad of s.level.switches)
      if (Math.hypot(s.x - pad.x, s.y - pad.y) < s.r + pad.r) {
        if (!s.switches[pad.id]) s.events.push("switch");
        s.switches[pad.id] = true;
        s.timers[pad.id] = 7;
      }
    if (
      !s.core &&
      Math.hypot(s.x - s.level.core[0], s.y - s.level.core[1]) < s.r + 14
    ) {
      s.core = true;
      s.events.push("core");
    }
    if (Math.hypot(s.x - s.level.exit[0], s.y - s.level.exit[1]) < s.r + 23) {
      s.won = true;
      s.events.push("win");
    }
  }
  H.physics = {
    DT,
    R,
    directions,
    create,
    rotate,
    step,
    rectHit,
    hazardAt,
    doorOpen,
  };
})();
