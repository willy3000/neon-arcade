/* Pure 120 Hz platform simulation. Input is an external pair of action packets. */
(() => {
  const DT = 1 / 120,
    W = 22,
    H = 28,
    GRAVITY = 1450,
    SPEED = 230,
    JUMP = 520,
    TETHER = 220;
  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const center = (c) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });
  const close = (c, n, r) =>
    Math.hypot(center(c).x - n.x, center(c).y - n.y) < r;
  const affects = (b, who) =>
    b.dimension === "both" ||
    b.dimension === who ||
    (b.dimension === "veil" && who === "kai");
  function character(who, spawn) {
    return {
      who,
      x: spawn[0],
      y: spawn[1],
      w: W,
      h: H,
      vx: 0,
      vy: 0,
      grounded: false,
      coyote: 0,
      buffer: 0,
      jumpCut: false,
      support: null,
      docked: false,
      squash: 0,
      footClock: 0,
    };
  }
  function create(level) {
    const s = {
      level,
      time: 0,
      deaths: 0,
      kai: character("kai", level.spawn.kai),
      luma: character("luma", level.spawn.luma),
      blocks: level.blocks.map((b, i) => ({
        ...b,
        id: "block" + i,
        vx: 0,
        vy: 0,
        anchored: false,
        dimension: "kai",
      })),
      platforms: level.platforms.map((p, i) => ({
        ...p,
        id: "moving" + i,
        baseX: p.x,
        baseY: p.y,
        dx: 0,
        dy: 0,
      })),
      plates: {},
      latched: {},
      timers: {},
      tether: false,
      collected: new Set(),
      checkpoint: null,
      checkpointIndex: -1,
      events: [],
      won: false,
      dead: false,
    };
    s.checkpoint = snapshot(s);
    return s;
  }
  function snapshot(s) {
    return {
      kai: { x: s.kai.x, y: s.kai.y },
      luma: { x: s.luma.x, y: s.luma.y },
      blocks: s.blocks.map((b) => ({ ...b })),
      latched: { ...s.latched },
      timers: { ...s.timers },
      tether: s.tether,
    };
  }
  function respawn(s) {
    const cp = s.checkpoint;
    s.kai = character("kai", [cp.kai.x, cp.kai.y]);
    s.luma = character("luma", [cp.luma.x, cp.luma.y]);
    s.blocks = cp.blocks.map((b) => ({ ...b }));
    s.latched = { ...cp.latched };
    s.timers = { ...cp.timers };
    s.tether = cp.tether;
    s.dead = false;
    s.events = [];
    s.plates = {};
  }
  function doorOpen(s, d) {
    let open =
      d.kind === "tether"
        ? s.tether
        : d.kind === "latch"
          ? !!s.latched[d.id]
          : d.kind === "timed"
            ? (s.timers[d.id] || 0) > 0
            : !!s.plates[d.id];
    if (d.also) open &&= !!s.latched[d.also];
    return open;
  }
  function terrain(s, who) {
    return [
      ...s.level.walls,
      ...s.platforms,
      ...s.level.bridges.filter((b) => (s.timers[b.id] || 0) > 0),
      ...s.level.doors.filter(
        (d) =>
          !doorOpen(s, d) &&
          !(affects(d, "kai") && overlap(s.kai, d)) &&
          !(affects(d, "luma") && overlap(s.luma, d)),
      ),
    ].filter((b) => affects(b, who));
  }
  function collideAxis(c, b, axis) {
    if (!overlap(c, b)) return;
    if (axis === "x") {
      c.x = c.vx > 0 ? b.x - c.w : b.x + b.w;
      c.vx = 0;
    } else {
      if (c.vy >= 0) {
        c.y = b.y - c.h;
        c.grounded = true;
        c.support = b.id || null;
      } else c.y = b.y + b.h;
      c.vy = 0;
    }
  }
  function moveBlock(s, b, dx) {
    if (b.anchored) return false;
    const candidate = { ...b, x: b.x + dx };
    const walls = terrain(s, "kai");
    if (
      walls.some((w) => overlap(candidate, w)) ||
      s.blocks.some((other) => other !== b && overlap(candidate, other))
    )
      return false;
    b.x += dx;
    return true;
  }
  function interact(s, c) {
    if (c.docked) return;
    if (c.who === "kai") {
      const b = s.blocks.find((b) =>
        close(c, { x: b.x + b.w / 2, y: b.y + b.h / 2 }, 62),
      );
      if (b) {
        b.anchored = !b.anchored;
        s.events.push({ type: "brace", who: c.who, x: b.x, y: b.y });
        return;
      }
    } else {
      const n = s.level.nodes.find((n) => close(c, n, 54));
      if (n) {
        if (n.kind === "latch") s.latched[n.id] = true;
        else s.timers[n.id] = n.duration;
        s.events.push({ type: "switch", who: c.who, x: n.x, y: n.y });
        return;
      }
    }
    if (s.tether) {
      s.tether = false;
      s.events.push({ type: "unlink", who: c.who, ...center(c) });
      return;
    }
    const t = s.level.tethers.find(
      (n) => close(s.kai, n, n.r) && close(s.luma, n, n.r),
    );
    if (t) {
      s.tether = true;
      s.events.push({ type: "link", who: c.who, x: t.x, y: t.y });
    }
  }
  function simulateCharacter(s, c, other, a, dt) {
    if (c.docked) return;
    const wasGrounded = c.grounded,
      oldVy = c.vy;
    c.squash = Math.max(0, c.squash - dt);
    c.footClock -= dt;
    const carry = s.platforms.find((p) => p.id === c.support);
    if (carry && c.grounded) {
      c.x += carry.dx;
      c.y += carry.dy;
    }
    c.coyote = c.grounded ? 0.1 : Math.max(0, c.coyote - dt);
    c.buffer = a.jumpPressed ? 0.13 : Math.max(0, c.buffer - dt);
    const direction = (a.right ? 1 : 0) - (a.left ? 1 : 0);
    if (direction)
      c.vx = Math.max(
        -SPEED,
        Math.min(SPEED, c.vx + direction * (c.grounded ? 2300 : 1700) * dt),
      );
    else {
      const friction = (c.grounded ? 3200 : 420) * dt;
      c.vx = Math.sign(c.vx) * Math.max(0, Math.abs(c.vx) - friction);
    }
    if (c.buffer > 0 && c.coyote > 0) {
      c.vy = -JUMP;
      c.buffer = c.coyote = 0;
      c.grounded = false;
      c.jumpCut = false;
      s.events.push({ type: "jump", who: c.who, ...center(c) });
    }
    if (!a.jump && c.vy < 0 && !c.jumpCut) {
      c.vy *= 0.52;
      c.jumpCut = true;
    }
    c.vy = Math.min(650, c.vy + GRAVITY * dt);
    const solids = terrain(s, c.who),
      oldX = c.x;
    c.x += c.vx * dt;
    if (s.tether) {
      const dy = c.y - other.y,
        limit = Math.sqrt(Math.max(0, TETHER * TETHER - dy * dy));
      const x = Math.max(other.x - limit, Math.min(other.x + limit, c.x));
      if (x !== c.x) c.vx = 0;
      c.x = x;
    }
    if (c.who === "kai")
      for (const b of s.blocks)
        if (overlap(c, b)) {
          const dx = c.x - oldX;
          moveBlock(s, b, dx);
          collideAxis(c, b, "x");
        }
    for (const b of solids) collideAxis(c, b, "x");
    c.grounded = false;
    c.support = null;
    c.y += c.vy * dt;
    if (s.tether) {
      const dx = c.x - other.x,
        limit = Math.sqrt(Math.max(0, TETHER * TETHER - dx * dx)),
        y = Math.max(other.y - limit, Math.min(other.y + limit, c.y));
      if (y !== c.y) c.vy = 0;
      c.y = y;
    }
    for (const b of [...solids, ...(c.who === "kai" ? s.blocks : [])])
      collideAxis(c, b, "y");
    if (c.grounded && !wasGrounded && oldVy > 120) {
      c.squash = 0.15;
      s.events.push({ type: "land", who: c.who, ...center(c) });
    }
    if (c.grounded && Math.abs(c.vx) > 60 && c.footClock <= 0) {
      c.footClock = 0.09;
      s.events.push({
        type: "foot",
        who: c.who,
        x: c.x + c.w / 2,
        y: c.y + c.h,
      });
    }
    if (a.interact) interact(s, c);
  }
  function step(s, actions = {}, dt = DT) {
    if (s.won || s.dead) return;
    s.events = [];
    s.time += dt;
    for (const id of Object.keys(s.timers))
      s.timers[id] = Math.max(0, s.timers[id] - dt);
    for (const p of s.platforms) {
      const oldX = p.x,
        oldY = p.y;
      p.x = p.baseX;
      p.y = p.baseY;
      p[p.axis] += Math.sin(s.time * p.speed) * p.range;
      p.dx = p.x - oldX;
      p.dy = p.y - oldY;
    }
    for (const b of s.blocks) {
      b.vy = Math.min(650, b.vy + GRAVITY * dt);
      b.y += b.vy * dt;
      for (const w of terrain(s, "kai"))
        if (overlap(b, w)) {
          b.y = b.vy >= 0 ? w.y - b.h : w.y + w.h;
          b.vy = 0;
        }
    }
    simulateCharacter(s, s.kai, s.luma, actions.kai || {}, dt);
    simulateCharacter(s, s.luma, s.kai, actions.luma || {}, dt);
    for (const p of s.level.plates) {
      const touching = (o) =>
        o.x + o.w > p.x &&
        o.x < p.x + p.w &&
        Math.abs(o.y + o.h - (p.y + p.h)) < 9;
      const active = touching(s.kai) || s.blocks.some(touching);
      if (active !== !!s.plates[p.id])
        s.events.push({
          type: "plate",
          who: "kai",
          x: p.x + p.w / 2,
          y: p.y,
          active,
        });
      s.plates[p.id] = active;
    }
    for (const [i, o] of s.level.crystals.entries())
      if (
        !s.collected.has(i) &&
        ["kai", "luma"].some(
          (who) =>
            (o.owner === "both" || o.owner === who) && close(s[who], o, 23),
        )
      ) {
        s.collected.add(i);
        s.events.push({ type: "crystal", who: o.owner, x: o.x, y: o.y });
      }
    for (const [i, cp] of s.level.checkpoints.entries())
      if (
        i > s.checkpointIndex &&
        s.kai.grounded &&
        s.luma.grounded &&
        close(s.kai, cp, 95) &&
        close(s.luma, cp, 95)
      ) {
        s.checkpointIndex = i;
        s.checkpoint = snapshot(s);
        s.events.push({ type: "checkpoint", who: "both", x: cp.x, y: cp.y });
      }
    for (const who of ["kai", "luma"]) {
      const c = s[who],
        pos = s.level.portals[who];
      if (
        !c.docked &&
        Math.hypot(center(c).x - pos[0], center(c).y - pos[1]) < 25
      ) {
        c.docked = true;
        c.vx = c.vy = 0;
        c.x = pos[0] - c.w / 2;
        c.y = pos[1] - c.h / 2;
        s.events.push({ type: "portal", who, x: pos[0], y: pos[1] });
      }
    }
    if (s.kai.y > 720 || s.luma.y > 720 || s.blocks.some((b) => b.y > 760)) {
      s.dead = true;
      s.deaths++;
      s.events.push({ type: "death", who: "both", x: center(s.kai).x, y: 580 });
    }
    if (s.kai.docked && s.luma.docked) {
      s.won = true;
      s.events.push({ type: "win", who: "both", x: 990, y: 550 });
    }
  }
  Phasebound.physics = {
    DT,
    W,
    H,
    SPEED,
    TETHER,
    create,
    step,
    respawn,
    terrain,
    doorOpen,
    affects,
    overlap,
    center,
  };
})();
