/* Pure sound propagation, interactions, and fixed-step object simulation. */
(() => {
  const E = Echo,
    DT = 1 / 120,
    RANGE = 480,
    MAX_WAVES = 32;
  const frequencies = {
    LOW: { color: "#ffd482", pitch: 130 },
    MID: { color: "#63ede7", pitch: 360 },
    HIGH: { color: "#f496ef", pitch: 780 },
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDifference = (a, b) =>
    Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const circleRect = (o, b) =>
    Math.hypot(
      o.x - clamp(o.x, b.x, b.x + b.w),
      o.y - clamp(o.y, b.y, b.y + b.h),
    ) < o.r;
  function create(level) {
    return {
      level,
      time: 0,
      energy: 100,
      pulses: 0,
      frequency: "MID",
      won: false,
      waves: [],
      serial: 0,
      switches: {},
      broken: new Set(),
      platforms: level.platforms.map((p) => ({
        ...p,
        baseX: p.x,
        baseY: p.y,
        active: false,
        start: 0,
      })),
      fragments: new Set(),
      events: [],
      crystal: {
        x: level.crystal[0],
        y: level.crystal[1],
        vx: 0,
        vy: 0,
        r: 13,
        mass: 1,
        charged: level.id < 3,
      },
      crates: level.crates.map((c) => ({ ...c, vx: 0, vy: 0 })),
    };
  }
  function solids(s, sound = false) {
    return [
      ...s.level.walls,
      ...s.level.doors.filter((d) => !s.switches[d.id]),
      ...s.level.fragile.filter((b, i) => !s.broken.has(i)),
      ...(sound ? [] : s.platforms),
    ];
  }
  // Slab intersection: sound cannot jump through walls or unopened barriers.
  function rayBlocked(a, b, rect) {
    let low = 0,
      high = 1;
    for (const axis of ["x", "y"]) {
      const d = b[axis] - a[axis],
        min = rect[axis],
        max = min + rect[axis === "x" ? "w" : "h"];
      if (Math.abs(d) < 1e-8) {
        if (a[axis] <= min || a[axis] >= max) return false;
      } else {
        let t1 = (min - a[axis]) / d,
          t2 = (max - a[axis]) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        low = Math.max(low, t1);
        high = Math.min(high, t2);
        if (low > high) return false;
      }
    }
    return high > 1e-4 && low < 0.9999 && high >= low;
  }
  const visible = (s, a, b, ignore) =>
    !solids(s, true).some((r) => r !== ignore && rayBlocked(a, b, r));
  function emit(s, options) {
    if (s.waves.length >= MAX_WAVES) return false;
    s.waves.push({
      id: ++s.serial,
      x: options.x,
      y: options.y,
      frequency: options.frequency,
      strength: options.strength,
      radius: 0,
      previous: 0,
      range: RANGE,
      aim: options.aim ?? null,
      cone: options.cone ?? 0.65,
      depth: options.depth || 0,
      visited: new Set(options.visited || []),
      hits: new Set(),
    });
    return true;
  }
  function fire(s, frequency = s.frequency, strength = 1, aim = null) {
    if (s.won || !frequencies[frequency]) return false;
    strength = clamp(strength, 0.6, 1.4);
    const cost = 18 + strength * 12;
    if (s.energy < cost || s.waves.length >= MAX_WAVES) return false;
    s.energy -= cost;
    s.pulses++;
    s.frequency = frequency;
    emit(s, {
      x: s.level.emitter[0],
      y: s.level.emitter[1],
      frequency,
      strength,
      aim,
    });
    s.events.push({
      type: "pulse",
      x: s.level.emitter[0],
      y: s.level.emitter[1],
      frequency,
    });
    return true;
  }
  function touches(s, w, o, id, ignore) {
    if (w.hits.has(id)) return false;
    const d = distance(w, o),
      r = o.r || 12;
    if (d + r < w.previous || d - r > w.radius) return false;
    if (
      w.aim !== null &&
      Math.abs(angleDifference(Math.atan2(o.y - w.y, o.x - w.x), w.aim)) >
        w.cone
    )
      return false;
    if (!visible(s, w, o, ignore)) return false;
    w.hits.add(id);
    return true;
  }
  function impulse(w, o, heavy = false) {
    let dx = o.x - w.x,
      dy = o.y - w.y,
      d = Math.hypot(dx, dy);
    if (d < 1) {
      dx = 1;
      dy = 0;
      d = 1;
    }
    const response = heavy
      ? w.frequency === "LOW"
        ? 0.6
        : 0.025
      : { LOW: 0.8, MID: 0.9, HIGH: 0.9 }[w.frequency];
    const force = (520 * w.strength * response) / (1 + d / 300);
    o.vx += (dx / d) * force;
    o.vy += (dy / d) * force;
  }
  function propagate(s, w) {
    for (const [i, a] of s.level.absorbers.entries())
      if (touches(s, w, a, "absorber" + i)) {
        w.strength *= 0.18;
        s.events.push({
          type: "absorb",
          x: a.x,
          y: a.y,
          frequency: w.frequency,
        });
      }
    // Glass and switches are resolved before objects at the same wavefront.
    for (const [i, b] of s.level.fragile.entries())
      if (
        !s.broken.has(i) &&
        w.frequency === "HIGH" &&
        touches(
          s,
          w,
          { x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.max(b.w, b.h) / 2 },
          "glass" + i,
          b,
        )
      ) {
        s.broken.add(i);
        s.events.push({
          type: "shatter",
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          frequency: w.frequency,
        });
      }
    for (const pad of s.level.switches)
      if (
        w.frequency === "MID" &&
        touches(s, w, pad, "switch" + pad.id) &&
        !s.switches[pad.id]
      ) {
        s.switches[pad.id] = true;
        s.events.push({
          type: "switch",
          x: pad.x,
          y: pad.y,
          frequency: w.frequency,
        });
      }
    for (const [i, p] of s.platforms.entries())
      if (
        w.frequency === "MID" &&
        touches(
          s,
          w,
          { x: p.x + p.w / 2, y: p.y + p.h / 2, r: Math.max(p.w, p.h) / 2 },
          "platform" + i,
        ) &&
        !p.active
      ) {
        p.active = true;
        p.start = s.time;
        s.events.push({
          type: "platform",
          x: p.x,
          y: p.y,
          frequency: w.frequency,
        });
      }
    for (const [i, n] of s.level.relays.entries())
      if (
        w.frequency === n.frequency &&
        !w.visited.has("relay" + i) &&
        w.depth < 4 &&
        touches(s, w, n, "relay" + i)
      ) {
        const visited = new Set(w.visited);
        visited.add("relay" + i);
        emit(s, {
          x: n.x,
          y: n.y,
          frequency: w.frequency,
          strength: Math.min(1.65, w.strength * 1.3),
          depth: w.depth + 1,
          visited,
        });
        s.events.push({
          type: "resonance",
          x: n.x,
          y: n.y,
          frequency: w.frequency,
        });
      }
    for (const [i, m] of s.level.mirrors.entries())
      if (
        !w.visited.has("mirror" + i) &&
        w.depth < 4 &&
        touches(s, w, m, "mirror" + i)
      ) {
        let ix = m.x - w.x,
          iy = m.y - w.y,
          len = Math.hypot(ix, iy);
        if (len < 1) continue;
        ix /= len;
        iy /= len;
        const dot = ix * m.normal[0] + iy * m.normal[1],
          ox = ix - 2 * dot * m.normal[0],
          oy = iy - 2 * dot * m.normal[1],
          visited = new Set(w.visited);
        visited.add("mirror" + i);
        emit(s, {
          x: m.x + ox * 8,
          y: m.y + oy * 8,
          frequency: w.frequency,
          strength: w.strength * 0.9,
          aim: Math.atan2(oy, ox),
          cone: 0.55,
          depth: w.depth + 1,
          visited,
        });
        s.events.push({
          type: "reflection",
          x: m.x,
          y: m.y,
          frequency: w.frequency,
        });
      }
    if (touches(s, w, s.crystal, "crystal")) {
      if (w.frequency === "HIGH" && !s.crystal.charged) {
        s.crystal.charged = true;
        s.events.push({
          type: "activation",
          x: s.crystal.x,
          y: s.crystal.y,
          frequency: w.frequency,
        });
      }
      impulse(w, s.crystal);
      s.events.push({
        type: "transfer",
        x: s.crystal.x,
        y: s.crystal.y,
        frequency: w.frequency,
      });
    }
    for (const [i, c] of s.crates.entries())
      if (touches(s, w, c, "crate" + i)) impulse(w, c, true);
    for (const [i, c] of s.level.fragments.entries())
      if (
        !s.fragments.has(i) &&
        w.frequency === "HIGH" &&
        touches(s, w, c, "fragment" + i)
      ) {
        s.fragments.add(i);
        s.events.push({
          type: "fragment",
          x: c.x,
          y: c.y,
          frequency: w.frequency,
        });
      }
  }
  function resolve(o, b, axis) {
    if (!circleRect(o, b)) return;
    if (axis === "x") {
      if (o.vx > 0) o.x = b.x - o.r;
      else if (o.vx < 0) o.x = b.x + b.w + o.r;
      else o.x = o.x < b.x + b.w / 2 ? b.x - o.r : b.x + b.w + o.r;
      o.vx *= -0.12;
      o.vy *= 0.95;
    } else {
      if (o.vy > 0) o.y = b.y - o.r;
      else if (o.vy < 0) o.y = b.y + b.h + o.r;
      else o.y = o.y < b.y + b.h / 2 ? b.y - o.r : b.y + b.h + o.r;
      o.vy *= -0.12;
      o.vx *= 0.95;
    }
  }
  function move(o, blocks, dt) {
    const speed = Math.hypot(o.vx, o.vy);
    if (speed > 380) {
      o.vx *= 380 / speed;
      o.vy *= 380 / speed;
    }
    o.vx *= Math.exp(-1.15 * dt);
    o.vy *= Math.exp(-1.15 * dt);
    o.x += o.vx * dt;
    for (const b of blocks) resolve(o, b, "x");
    o.y += o.vy * dt;
    for (const b of blocks) resolve(o, b, "y");
  }
  function step(s, dt = DT) {
    if (s.won) return;
    s.events = [];
    s.time += dt;
    s.energy = Math.min(100, s.energy + 20 * dt);
    for (const p of s.platforms)
      if (p.active) {
        p.x = p.baseX;
        p.y = p.baseY;
        p[p.axis] += Math.sin((s.time - p.start) * p.speed) * p.range;
      }
    const waves = [...s.waves];
    for (const w of waves) {
      w.previous = w.radius;
      w.radius = Math.min(w.range, w.radius + 520 * dt);
      propagate(s, w);
    }
    s.waves = s.waves.filter((w) => w.radius < w.range);
    const blocks = solids(s),
      objects = [s.crystal, ...s.crates];
    for (const o of objects) move(o, blocks, dt);
    for (let a = 0; a < objects.length; a++)
      for (let b = a + 1; b < objects.length; b++) {
        const p = objects[a],
          q = objects[b],
          dx = q.x - p.x,
          dy = q.y - p.y,
          d = Math.hypot(dx, dy) || 0.01,
          overlap = p.r + q.r - d;
        if (overlap <= 0) continue;
        const nx = dx / d,
          ny = dy / d,
          total = p.mass + q.mass;
        p.x -= (nx * overlap * q.mass) / total;
        p.y -= (ny * overlap * q.mass) / total;
        q.x += (nx * overlap * p.mass) / total;
        q.y += (ny * overlap * p.mass) / total;
        const relative = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
        if (relative < 0) {
          const j = (-1.1 * relative) / (1 / p.mass + 1 / q.mass);
          p.vx -= (j * nx) / p.mass;
          p.vy -= (j * ny) / p.mass;
          q.vx += (j * nx) / q.mass;
          q.vy += (j * ny) / q.mass;
        }
      }
    const [rx, ry] = s.level.receiver;
    if (
      s.crystal.charged &&
      Math.hypot(s.crystal.x - rx, s.crystal.y - ry) < 28
    ) {
      s.won = true;
      s.crystal.x = rx;
      s.crystal.y = ry;
      s.crystal.vx = s.crystal.vy = 0;
      s.events.push({ type: "win", x: rx, y: ry, frequency: s.frequency });
    }
  }
  E.physics = {
    DT,
    RANGE,
    MAX_WAVES,
    frequencies,
    create,
    fire,
    step,
    solids,
    visible,
    rayBlocked,
    circleRect,
  };
})();
