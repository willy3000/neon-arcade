/* Pure simulation entry point. External hero action packets support human or AI input. */
(() => {
  const P = Rift.physics,
    C = Rift.combat,
    A = Rift.ai;
  function create(level, mode = "solo", selected = "blaze", settings = {}) {
    const s = {
      level,
      mode,
      selected,
      settings,
      time: 0,
      heroes: [C.hero("blaze", 75), C.hero("volt", 125)],
      enemies: [],
      platforms: level.moving.map((p, i) => ({
        ...p,
        id: "moving" + i,
        baseX: p.x,
        baseY: p.y,
        dx: 0,
        dy: 0,
      })),
      crates: level.crates.map((c, i) => ({
        ...c,
        id: "crate" + i,
        hp: c.barrel ? 30 : 55,
        reinforced: !c.barrel,
      })),
      generator: { ...level.generator, id: "generator", hp: 120 },
      generatorReady: false,
      gates: level.waves.map((w, i) => ({
        x: w.gate,
        y: -600,
        w: 18,
        h: 1160,
        id: "gate" + i,
        open: false,
      })),
      waves: level.waves.map(() => ({ started: false, done: false })),
      serial: 0,
      projectiles: [],
      warnings: [],
      zones: [],
      drops: [],
      collected: new Set(),
      fusion: 0,
      fusionRequests: { blaze: 0, volt: 0 },
      fusionAction: null,
      hitstop: 0,
      slowEnemies: 0,
      events: [],
      combo: 0,
      comboTimer: 0,
      maxCombo: 0,
      score: 0,
      damage: 0,
      kills: 0,
      falls: 0,
      won: false,
      failed: false,
      checkpointIndex: -1,
      checkpoint: null,
    };
    if (level.boss) s.enemies.push(A.boss(level.boss));
    s.checkpoint = snapshot(s);
    return s;
  }
  function snapshot(s) {
    return {
      heroes: s.heroes.map((h) => ({ who: h.who, x: h.x, y: h.y })),
      waves: s.waves.map((w) => ({ ...w })),
      enemies: s.enemies.map((e) => ({ ...e })),
      crates: s.crates.map((c) => ({ ...c })),
      generator: { ...s.generator },
      collected: [...s.collected],
      score: s.score,
      kills: s.kills,
    };
  }
  function retry(s) {
    const cp = s.checkpoint;
    s.heroes = cp.heroes.map((h) => ({
      ...C.hero(h.who, h.x),
      y: h.y,
      invulnerable: 1.5,
    }));
    s.waves = cp.waves.map((w) => ({ ...w }));
    s.enemies = cp.enemies.map((e) => ({ ...e }));
    s.crates = cp.crates.map((c) => ({ ...c }));
    s.generator = { ...cp.generator };
    s.collected = new Set(cp.collected);
    s.score = cp.score;
    s.kills = cp.kills;
    s.gates.forEach((g, i) => (g.open = s.waves[i].done));
    s.failed = false;
    s.projectiles = [];
    s.warnings = [];
    s.zones = [];
    s.drops = [];
    s.fusionAction = null;
    s.hitstop = 0;
    s.events = [];
    s.fusionRequests = { blaze: 0, volt: 0 };
  }
  function grapple(s, h) {
    if (h.grapple) {
      h.grapple = null;
      h.vx *= 1.16;
      h.vy = Math.min(h.vy, -130);
      C.emit(s, "release", h);
      return;
    }
    if (h.grappleCooldown > 0) return;
    const c = P.center(h),
      anchors = [
        ...s.level.anchors,
        ...s.enemies
          .filter((e) => e.hp > 0 && !e.boss)
          .map((e) => ({ ...P.center(e), enemy: e.id })),
      ]
        .filter((n) => Math.hypot(n.x - c.x, n.y - c.y) < 440 && n.y < c.y + 40)
        .sort(
          (a, b) =>
            Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y),
        );
    const n = anchors[0];
    if (!n) {
      C.emit(s, "notice", h, { text: "NO ANCHOR IN REACH" });
      return;
    }
    h.grapple = {
      x: n.x,
      y: n.y,
      enemy: n.enemy,
      length: Math.max(80, Math.hypot(n.x - c.x, n.y - c.y)),
    };
    h.grappleCooldown = 0.25;
    h.action = null;
    h.vx += h.facing * 160;
    C.emit(s, "grapple", h);
  }
  function heroStep(s, h, a, dt) {
    h.invulnerable = Math.max(0, h.invulnerable - dt);
    h.flash = Math.max(0, h.flash - dt);
    h.dashCooldown = Math.max(0, h.dashCooldown - dt);
    h.grappleCooldown = Math.max(0, h.grappleCooldown - dt);
    h.swingCooldown = Math.max(0, h.swingCooldown - dt);
    h.comboTime = Math.max(0, h.comboTime - dt);
    h.energy = Math.min(100, h.energy + 4 * dt);
    h.ultimate = Math.min(100, h.ultimate + 0.4 * dt);
    if (h.hp <= 0) {
      h.downTimer -= dt;
      h.vx *= Math.exp(-10 * dt);
      h.vy = Math.min(750, h.vy + 1650 * dt);
      P.move(s, h, dt);
      if (h.y > 700) {
        const safe = P.safePoint(s, h.x);
        h.x = safe.x;
        h.y = safe.y;
        h.vy = 0;
      }
      return;
    }
    if (h.stun > 0) {
      h.stun -= dt;
      h.state = h.stun > 0.12 ? "hit-stun" : "knockback";
      h.vx *= Math.exp(-3 * dt);
      h.vy = Math.min(750, h.vy + 1650 * dt);
      P.move(s, h, dt);
      return;
    }
    const st = C.stats[h.who],
      direction = (a.right ? 1 : 0) - (a.left ? 1 : 0);
    if (direction && !h.action) h.facing = direction;
    h.coyote = h.grounded ? 0.1 : Math.max(0, h.coyote - dt);
    if (h.grounded) h.jumps = 0;
    h.jumpBuffer = a.jumpPressed ? 0.13 : Math.max(0, h.jumpBuffer - dt);
    if (
      h.jumpBuffer > 0 &&
      (!h.action || h.action.t > h.action.start + h.action.active)
    ) {
      if (h.wall && !h.grounded) {
        h.vx = -h.wall * 420;
        h.vy = -st.jump * 0.95;
        h.facing = -h.wall;
        h.jumps = 1;
      } else if (h.coyote > 0 || h.jumps < 2) {
        h.vy = -st.jump;
        h.jumps = h.coyote > 0 ? 1 : Math.max(1, h.jumps) + 1;
        if (h.jumps > 2) h.jumps = 2;
      } else h.jumpBuffer = 0;
      if (h.jumpBuffer > 0) {
        h.jumpBuffer = 0;
        h.coyote = 0;
        h.grounded = false;
        h.jumpCut = false;
        h.action = null;
        h.grapple = null;
        C.emit(s, "jump", h);
      }
    }
    if (!a.jump && h.vy < 0 && !h.jumpCut && !h.grapple) {
      h.vy *= 0.55;
      h.jumpCut = true;
    }
    if (a.grapple) grapple(s, h);
    if (a.fusion) {
      s.fusionRequests[h.who] = s.time + 2;
      if (s.fusion < 100)
        C.emit(s, "notice", h, { text: "FUSION NEEDS A FULL METER" });
      else C.emit(s, "notice", h, { text: "FUSION ARMED · PARTNER CONFIRM" });
    }
    const request = a.ultimate
      ? "ultimate"
      : a.special
        ? "special"
        : a.heavy
          ? "heavy"
          : a.light
            ? "light"
            : a.dash
              ? "dash"
              : null;
    if (request) {
      h.buffer = { kind: request, t: 0.2 };
      if (request === "dash" && C.begin(s, h, "dash")) h.buffer = null;
    }
    if (h.buffer) {
      h.buffer.t -= dt;
      if (h.buffer.t <= 0) h.buffer = null;
      else if (!h.action && C.begin(s, h, h.buffer.kind)) h.buffer = null;
    }
    if (!h.action || h.action.kind !== "dash") {
      const acceleration = h.grounded ? 3000 : 1800,
        cap = st.speed;
      if (direction) {
        if (Math.abs(h.vx) <= cap)
          h.vx = Math.max(
            -cap,
            Math.min(cap, h.vx + direction * acceleration * dt),
          );
        else h.vx -= Math.sign(h.vx) * Math.min(Math.abs(h.vx) - cap, 900 * dt);
      } else
        h.vx =
          Math.sign(h.vx) *
          Math.max(0, Math.abs(h.vx) - (h.grounded ? 2300 : 150) * dt);
      h.vy = Math.min(900, h.vy + 1650 * dt);
      if (h.wall && !h.grounded && direction === h.wall && h.vy > 0)
        h.vy = Math.min(h.vy, 95);
    }
    if (h.grapple) {
      const g = h.grapple;
      if (g.enemy) {
        const e = s.enemies.find((e) => e.id === g.enemy && e.hp > 0);
        if (e) Object.assign(g, P.center(e));
        else h.grapple = null;
      }
      if (h.grapple) {
        const c = P.center(h),
          dx = c.x - g.x,
          dy = c.y - g.y,
          d = Math.hypot(dx, dy) || 1;
        if (d > g.length) {
          const nx = dx / d,
            ny = dy / d;
          h.x = g.x + nx * g.length - h.w / 2;
          h.y = g.y + ny * g.length - h.h / 2;
          const radial = h.vx * nx + h.vy * ny;
          if (radial > 0) {
            h.vx -= radial * nx;
            h.vy -= radial * ny;
          }
        }
        h.vx += direction * 700 * dt;
        if (Math.hypot(h.vx, h.vy) > 250 && h.swingCooldown <= 0) {
          for (const e of s.enemies)
            if (e.hp > 0 && P.dist(h, e) < 65) {
              C.damage(s, e, 38, { ...P.center(h), who: h.who }, "heavy", true);
              h.swingCooldown = 0.4;
            }
        }
      }
    }
    C.updateAction(s, h, dt, a);
    P.move(s, h, dt, { hero: true });
    if (!h.action)
      h.state = h.grapple
        ? "grapple"
        : h.grounded
          ? Math.abs(h.vx) > 30
            ? "run"
            : "idle"
          : h.vy < 0
            ? "jump"
            : "fall";
    if (h.grounded && h.grapple && h.vy === 0 && Math.abs(h.vx) < 50)
      h.grapple = null;
    h.footClock -= dt;
    if (h.grounded && Math.abs(h.vx) > 100 && h.footClock <= 0) {
      h.footClock = 0.12;
      C.emit(s, "foot", h, { y: h.y + h.h });
    }
    if (h.y > 750) {
      s.falls++;
      const safe = P.safePoint(
        s,
        s.heroes.find((p) => p !== h && p.hp > 0)?.x ?? h.x,
      );
      h.x = safe.x;
      h.y = safe.y;
      h.vx = h.vy = 0;
      h.grapple = null;
      C.hurt(s, h, 20, P.center(h));
    }
  }
  function encounters(s) {
    const leader =
      s.mode === "solo"
        ? s.heroes.find((h) => h.who === s.selected)
        : s.heroes.reduce((a, b) => (a.x < b.x ? a : b));
    s.level.waves.forEach((wave, i) => {
      const state = s.waves[i];
      if (!state.started && leader.x > wave.x) {
        state.started = true;
        for (const spec of wave.enemies)
          s.enemies.push({ ...A.enemy(spec, "enemy" + s.serial++), wave: i });
        s.events.push({
          type: "wave",
          x: wave.x,
          y: 400,
          text: "RIFT INCOMING · " + wave.enemies.length + " HOSTILES",
        });
      }
      if (
        state.started &&
        !state.done &&
        !s.enemies.some((e) => e.wave === i && e.hp > 0)
      ) {
        state.done = true;
        s.gates[i].open = true;
        s.events.push({ type: "gate", x: wave.gate, y: 380 });
      }
    });
    s.generatorReady = s.level.boss
      ? !s.enemies.some((e) => e.boss && e.hp > 0)
      : s.waves.every((w) => w.done);
    s.level.checkpoints.forEach((x, i) => {
      if (
        i > s.checkpointIndex &&
        s.heroes.every(
          (h) => h.hp > 0 && h.x > x - 70 && h.x < x + 210 && h.grounded,
        ) &&
        !s.enemies.some((e) => e.hp > 0 && Math.abs(e.x - x) < 250)
      ) {
        s.heroes.forEach((h) => (h.hp = Math.max(h.hp, 75)));
        s.checkpointIndex = i;
        s.checkpoint = snapshot(s);
        s.events.push({ type: "checkpoint", x, y: 520 });
      }
    });
  }
  function step(s, packets = {}, dt = P.DT) {
    if (s.won || s.failed) return;
    s.events = [];
    if (s.hitstop > 0) {
      s.hitstop = Math.max(0, s.hitstop - dt);
      return;
    }
    const slow = s.fusionAction && s.fusionAction.t < 0.38 ? 0.35 : 1;
    s.time += dt;
    s.slowEnemies = Math.max(0, s.slowEnemies - dt);
    s.comboTimer -= dt;
    if (s.comboTimer <= 0) s.combo = 0;
    for (const p of s.platforms) {
      const oldX = p.x,
        oldY = p.y;
      p.x = p.baseX;
      p.y = p.baseY;
      p[p.axis] += Math.sin(s.time * p.speed) * p.range;
      p.dx = p.x - oldX;
      p.dy = p.y - oldY;
    }
    const leader = s.heroes.find((h) => h.who === s.selected);
    for (const h of s.heroes) {
      const a =
        s.mode === "solo" && h !== leader
          ? A.companion(s, h, leader, dt)
          : packets[h.who] || {};
      heroStep(s, h, a, dt * slow);
    }
    if (
      !s.fusionAction &&
      s.fusion >= 100 &&
      s.heroes.every((h) => h.hp > 0 && s.fusionRequests[h.who] > s.time) &&
      P.dist(s.heroes[0], s.heroes[1]) < 440
    ) {
      s.fusion = 0;
      s.fusionAction = { t: 0, fired: false };
      s.fusionRequests = { blaze: 0, volt: 0 };
      s.events.push({ type: "fusion", ...P.center(leader) });
    }
    if (s.fusionAction) {
      const f = s.fusionAction;
      f.t += dt;
      if (f.t > (s.settings.shortFusion ? 0.16 : 0.42) && !f.fired) {
        f.fired = true;
        const center = {
          ...leader,
          x: (s.heroes[0].x + s.heroes[1].x) / 2,
          y: Math.min(s.heroes[0].y, s.heroes[1].y),
        };
        C.area(s, center, 540, 260, "fusion");
      }
      if (f.t > (s.settings.shortFusion ? 0.45 : 0.85)) s.fusionAction = null;
    }
    const enemyDt = dt * slow * (s.slowEnemies > 0 ? 0.38 : 1);
    for (const e of s.enemies)
      if (e.boss) A.updateBoss(s, e, enemyDt);
      else A.updateEnemy(s, e, enemyDt);
    // Soft separation only between enemies, avoiding pileups without trapping heroes.
    for (let i = 0; i < s.enemies.length; i++)
      for (let j = i + 1; j < s.enemies.length; j++) {
        const a = s.enemies[i],
          b = s.enemies[j];
        if (!a.boss && !b.boss && a.hp > 0 && b.hp > 0 && P.overlap(a, b)) {
          const push = Math.sign(P.center(b).x - P.center(a).x) || 1;
          a.vx -= push * 80 * dt;
          b.vx += push * 80 * dt;
        }
      }
    for (const z of s.warnings) {
      z.t -= dt * slow;
      if (z.t <= 0 && z.t > -z.active) {
        for (const h of s.heroes)
          if (!z.hit.has(h.who) && P.overlap(z, h)) {
            if (C.hurt(s, h, z.damage, { x: z.x + z.w / 2, y: z.y }))
              z.hit.add(h.who);
          }
        if (!z.fired) {
          z.fired = true;
          s.events.push({
            type: "danger",
            x: z.x + z.w / 2,
            y: z.y + z.h / 2,
            radius: z.w / 2,
            kind: z.kind,
          });
        }
      }
    }
    s.warnings = s.warnings.filter((z) => z.t > -z.active);
    for (const p of s.projectiles) {
      p.x += p.vx * enemyDt;
      p.y += p.vy * enemyDt;
      p.life -= dt;
      for (const h of s.heroes)
        if (P.overlap(p, h)) {
          C.hurt(s, h, p.damage, P.center(p));
          p.life = 0;
        }
      if (P.solids(s).some((t) => P.overlap(p, t))) p.life = 0;
    }
    s.projectiles = s.projectiles.filter((p) => p.life > 0);
    for (const t of s.level.traps) {
      const cycle = (s.time + t.phase) % t.period;
      if (cycle >= t.warning && cycle < t.warning + t.active) {
        for (const h of s.heroes)
          if (P.overlap(h, { ...t, y: t.y - 12, h: 24 }))
            C.hurt(s, h, 15, { x: t.x + t.w / 2, y: t.y });
      }
    }
    for (const z of s.zones) {
      z.t -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.65;
        for (const e of s.enemies)
          if (
            e.hp > 0 &&
            Math.hypot(P.center(e).x - z.x, P.center(e).y - z.y) < z.r
          )
            C.damage(
              s,
              e,
              z.electrified ? 16 : 8,
              { x: z.x, y: z.y, who: z.who },
              "special",
            );
      }
    }
    s.zones = s.zones.filter((z) => z.t > 0);
    s.level.relics.forEach((r, i) => {
      if (
        !s.collected.has(i) &&
        s.heroes.some(
          (h) =>
            h.hp > 0 &&
            Math.hypot(P.center(h).x - r.x, P.center(h).y - r.y) < 28,
        )
      ) {
        s.collected.add(i);
        s.score += 250;
        s.events.push({ type: "relic", ...r });
      }
    });
    for (const d of s.drops) {
      d.life -= dt;
      const h = s.heroes.find(
        (h) =>
          h.hp > 0 && Math.hypot(P.center(h).x - d.x, P.center(h).y - d.y) < 65,
      );
      if (h) {
        if (d.kind === "health") h.hp = Math.min(100, h.hp + 18);
        else h.energy = Math.min(100, h.energy + 14);
        d.life = 0;
        C.emit(s, "pickup", h, { kind: d.kind });
      }
    }
    s.drops = s.drops.filter((d) => d.life > 0);
    for (const h of s.heroes.filter((h) => h.hp <= 0)) {
      const ally = s.heroes.find((p) => p !== h && p.hp > 0);
      if (
        ally &&
        P.dist(h, ally) < 75 &&
        (!ally.action || ally.action.kind === "dash") &&
        h.downTimer > 0
      ) {
        h.revive += dt;
        ally.state = "reviving";
        if (h.revive >= 1.45) {
          h.hp = 45;
          h.invulnerable = 2;
          h.state = "idle";
          h.downTimer = 0;
          h.revive = 0;
          C.emit(s, "revive", h);
          s.fusion = Math.min(100, s.fusion + 15);
        }
      } else h.revive = Math.max(0, h.revive - dt * 0.35);
    }
    encounters(s);
    if (
      s.heroes.every((h) => h.hp <= 0) ||
      s.heroes.some((h) => h.hp <= 0 && h.downTimer <= 0)
    ) {
      s.failed = true;
      s.events.push({ type: "defeat", ...P.center(leader) });
    }
    if (
      s.generator.hp <= 0 &&
      s.heroes.every((h) => h.hp > 0 && h.x > s.level.exit - 130)
    ) {
      s.won = true;
      s.events.push({ type: "victory", ...P.center(leader) });
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0 || e.deadTime > 0);
  }
  Rift.simulation = { create, step, retry, snapshot, heroStep, grapple };
})();
