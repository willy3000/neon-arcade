/* Enemy and companion policies produce actions or explicitly telegraphed attacks. */
(() => {
  const P = Rift.physics,
    C = Rift.combat;
  const archetypes = {
    grunt: { hp: 80, speed: 95, range: 64, cool: 1.5, start: 0.48 },
    hunter: { hp: 70, speed: 165, range: 170, cool: 1.8, start: 0.46 },
    sniper: { hp: 65, speed: 65, range: 600, cool: 2.6, start: 0.85 },
    guard: { hp: 150, speed: 60, range: 95, cool: 2.1, start: 0.7 },
    bomber: { hp: 90, speed: 75, range: 390, cool: 3.6, start: 0.9 },
    sentinel: { hp: 180, speed: 115, range: 155, cool: 2, start: 0.65 },
  };
  function enemy(spec, id) {
    const d = archetypes[spec.type];
    return {
      ...spec,
      id,
      w: spec.type === "guard" ? 38 : 30,
      h: 42,
      vx: 0,
      vy: 0,
      hp: d.hp,
      maxHp: d.hp,
      facing: -1,
      state: "patrol",
      clock: 0,
      cooldown: 1.1,
      stun: 0,
      flash: 0,
      armor: spec.type === "guard" ? 3 : 0,
      home: spec.x,
      deadTime: 0,
      cycle: 0,
    };
  }
  function warning(s, rect, time, kind = "strike", damage = 18, extra = {}) {
    const z = {
      ...rect,
      t: time,
      warning: time,
      active: 0.24,
      kind,
      damage,
      hit: new Set(),
      ...extra,
    };
    s.warnings.push(z);
    s.events.push({
      type: "warning",
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
      kind,
    });
    return z;
  }
  function projectile(
    s,
    from,
    target,
    kind = "bolt",
    speed = 350,
    damage = 13,
  ) {
    const d = Math.hypot(target.x - from.x, target.y - from.y) || 1;
    s.projectiles.push({
      x: from.x,
      y: from.y,
      w: 12,
      h: 12,
      vx: ((target.x - from.x) / d) * speed,
      vy: ((target.y - from.y) / d) * speed,
      life: 6,
      damage,
      kind,
    });
  }
  function target(s, e) {
    return s.heroes
      .filter((h) => h.hp > 0)
      .sort((a, b) => P.dist(e, a) - P.dist(e, b))[0];
  }
  function updateEnemy(s, e, dt) {
    if (e.hp <= 0) {
      e.deadTime -= dt;
      return;
    }
    const h = target(s, e);
    if (!h) return;
    e.flash = Math.max(0, e.flash - dt);
    e.cooldown = Math.max(0, e.cooldown - dt);
    e.vy = Math.min(750, e.vy + 1700 * dt);
    if (e.stun > 0) {
      e.stun -= dt;
      e.vx *= Math.exp(-6 * dt);
      P.move(s, e, dt);
      if (e.stun <= 0) e.state = "chase";
      return;
    }
    const d = archetypes[e.type],
      delta = P.center(h).x - P.center(e).x,
      near = P.dist(e, h),
      face = Math.sign(delta) || e.facing;
    if (e.state === "windup") {
      e.clock += dt;
      e.vx *= Math.exp(-12 * dt);
      if (e.clock >= d.start) {
        e.state = "attack";
        e.clock = 0;
        e.hit = false;
        const from = P.center(e),
          to = P.center(h);
        if (e.type === "sniper") projectile(s, from, e.aim, "bolt", 360);
        else if (e.type === "bomber")
          warning(
            s,
            { x: e.aim.x - 75, y: 530, w: 150, h: 30 },
            1.15,
            "bomb",
            24,
            { radius: 75 },
          );
        else if (e.type === "sentinel" && e.cycle % 2 === 0) {
          projectile(s, from, to, "shock", 300, 17);
          warning(
            s,
            { x: e.x - 70, y: 535, w: 170, h: 25 },
            0.35,
            "strike",
            19,
          );
        } else
          e.vx =
            e.facing *
            (e.type === "hunter" ? 500 : e.type === "sentinel" ? 320 : 110);
      }
    } else if (e.state === "attack") {
      e.clock += dt;
      if (e.type !== "sniper" && e.type !== "bomber" && !e.hit) {
        const box = {
          x: e.facing > 0 ? e.x + e.w : e.x - 55,
          y: e.y - 2,
          w: 55,
          h: e.h + 4,
        };
        for (const p of s.heroes)
          if (P.overlap(box, p)) {
            if (C.hurt(s, p, e.type === "guard" ? 22 : 14, P.center(e)))
              e.hit = true;
          }
      }
      if (e.clock > 0.23) {
        e.state = "recover";
        e.clock = 0;
        e.vx *= 0.2;
      }
    } else if (e.state === "recover") {
      e.clock += dt;
      e.vx *= Math.exp(-12 * dt);
      if (e.clock > 0.48) {
        e.state = "chase";
        e.cooldown = d.cool;
      }
    } else {
      e.facing = face;
      if (near < d.range && Math.abs(h.y - e.y) < 170 && e.cooldown <= 0) {
        e.state = "windup";
        e.clock = 0;
        e.aim = P.center(h);
        e.cycle++;
        e.vx = 0;
        C.emit(s, "enemy-windup", e);
      } else if (near < 680) {
        e.state = "chase";
        const keep = e.type === "sniper" ? 300 : e.type === "bomber" ? 230 : 55;
        e.vx =
          near > keep ? face * d.speed : near < keep - 80 ? -face * d.speed : 0;
      } else {
        e.state = "patrol";
        e.vx = Math.sin(s.time * 0.8 + e.home) > 0 ? 35 : -35;
      }
      if (e.grounded) {
        const fx = e.x + (e.vx > 0 ? e.w + 22 : -22);
        const supported = P.solids(s).some(
          (t) => fx > t.x && fx < t.x + t.w && Math.abs(t.y - e.y - e.h) < 10,
        );
        if (!supported) {
          if (Math.abs(delta) < 250 && e.type !== "sniper") {
            e.vy = -500;
            e.grounded = false;
          } else e.vx = 0;
        }
        if (e.wall && e.type !== "sniper") e.vy = -500;
      }
    }
    P.move(s, e, dt);
    if (e.y > 760)
      C.damage(s, e, e.hp, { ...P.center(h), who: h.who }, "ultimate");
  }
  function boss(kind) {
    const hp = kind === "warden" ? 1350 : kind === "serpent" ? 1550 : 1950;
    return {
      id: "boss",
      type: kind,
      boss: true,
      x: 850,
      y: kind === "warden" ? 458 : 480,
      w: kind === "warden" ? 88 : 70,
      h: kind === "warden" ? 102 : 80,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      state: "recover",
      clock: 0,
      cooldown: 1.8,
      phase: 1,
      cycle: 0,
      facing: -1,
      stun: 0,
      flash: 0,
      deadTime: 0,
    };
  }
  function bossPlan(s, b) {
    const h = target(s, b),
      pos = P.center(h || s.heroes[0]);
    b.aim = pos;
    b.facing = pos.x < b.x ? -1 : 1;
    const arena = 1200,
      c = b.cycle++,
      phase = b.phase;
    let wind = 0.95,
      recovery = 1.45;
    if (b.type === "warden") {
      const kind = ["slam", "sweep", "shockwave", "missiles", "charge"][c % 5];
      b.pattern = kind;
      if (kind === "slam")
        warning(s, { x: b.x - 150, y: 492, w: 390, h: 68 }, wind, "slam", 24);
      if (kind === "sweep")
        warning(
          s,
          { x: b.facing > 0 ? b.x + b.w : b.x - 230, y: 465, w: 230, h: 80 },
          wind,
          "sweep",
          24,
        );
      if (kind === "missiles")
        for (let i = 0; i < 3 + phase; i++)
          warning(
            s,
            {
              x: Math.max(25, Math.min(1100, pos.x + (i - 1) * 145)) - 32,
              y: 460,
              w: 64,
              h: 100,
            },
            wind + i * 0.18,
            "missile",
            20,
          );
      if (kind === "charge") {
        warning(
          s,
          {
            x: Math.min(b.x, pos.x),
            y: 494,
            w: Math.abs(b.x - pos.x) + 100,
            h: 66,
          },
          wind,
          "charge",
          22,
        );
        recovery = 1.8;
      }
    } else if (b.type === "serpent") {
      b.pattern = ["ambush", "beam", "fan", "hazards", "sweep"][c % 5];
      if (b.pattern === "ambush") {
        b.emergeX = Math.max(150, Math.min(960, pos.x + 160 * b.facing));
        warning(
          s,
          { x: b.emergeX - 40, y: 455, w: 155, h: 105 },
          wind,
          "portal",
          25,
        );
      }
      if (b.pattern === "beam")
        warning(
          s,
          { x: 20, y: c % 2 ? 465 : 355, w: 1160, h: 36 },
          1.25,
          "beam",
          24,
        );
      if (b.pattern === "hazards")
        for (let i = 0; i < 4; i++)
          warning(
            s,
            { x: 140 + i * 265, y: 520, w: 100, h: 40 },
            1.25,
            "portal",
            20,
            { active: 1.8 },
          );
      if (b.pattern === "sweep")
        warning(
          s,
          { x: b.facing < 0 ? b.x - 320 : b.x, y: 490, w: 390, h: 70 },
          wind,
          "sweep",
          22,
        );
    } else {
      b.pattern =
        phase === 1
          ? ["sword", "fan", "charge"][c % 3]
          : phase === 2
            ? ["summon", "portals", "fan", "sword"][c % 4]
            : ["collapse", "charge", "fan", "portals"][c % 4];
      wind = phase === 3 ? 0.85 : 1.05;
      recovery = phase === 3 ? 1.15 : 1.5;
      if (b.pattern === "sword")
        warning(
          s,
          { x: b.facing < 0 ? b.x - 200 : b.x, y: 470, w: 260, h: 90 },
          wind,
          "sword",
          25,
        );
      if (b.pattern === "charge")
        warning(
          s,
          {
            x: Math.min(b.x, pos.x),
            y: 500,
            w: Math.abs(b.x - pos.x) + 80,
            h: 60,
          },
          wind,
          "charge",
          23,
        );
      if (b.pattern === "portals")
        for (let i = 0; i < 3; i++)
          warning(
            s,
            { x: 170 + i * 350, y: 525, w: 130, h: 35 },
            wind,
            "portal",
            22,
            { active: 2 },
          );
      if (b.pattern === "collapse") {
        for (let i = 0; i < 5; i++)
          warning(
            s,
            { x: 70 + i * 225, y: 500, w: 90, h: 60 },
            wind + i * 0.1,
            "collapse",
            25,
          );
      }
    }
    b.wind = wind;
    b.recovery = recovery;
    b.clock = 0;
    b.state = "windup";
    C.emit(s, "boss-warning", b, { pattern: b.pattern });
  }
  function updateBoss(s, b, dt) {
    if (b.hp <= 0) {
      b.deadTime -= dt;
      return;
    }
    b.flash = Math.max(0, b.flash - dt);
    b.clock += dt;
    const next =
      b.type === "emperor"
        ? b.hp / b.maxHp < 0.33
          ? 3
          : b.hp / b.maxHp < 0.67
            ? 2
            : 1
        : b.hp / b.maxHp < 0.5
          ? 2
          : 1;
    if (next > b.phase) {
      b.phase = next;
      C.emit(s, "phase", b, { phase: next });
      if (b.type === "emperor" && next === 3) {
        s.arenaShift = true;
        s.platforms.push({
          id: "phase-lift",
          x: 490,
          y: 400,
          w: 180,
          h: 18,
          baseX: 490,
          baseY: 400,
          axis: "y",
          range: 60,
          speed: 1.2,
          dx: 0,
          dy: 0,
        });
      }
    }
    if (b.state === "recover") {
      b.vx *= Math.exp(-8 * dt);
      if (b.clock > b.recovery || (b.recovery === undefined && b.clock > 1.7))
        bossPlan(s, b);
    } else if (b.state === "windup") {
      if (b.clock > b.wind) {
        b.state = "attack";
        b.clock = 0;
        if (b.pattern === "charge")
          b.vx = b.facing * (b.type === "warden" ? 540 : 650);
        if (b.pattern === "ambush") b.x = b.emergeX;
        if (b.pattern === "shockwave") {
          projectile(s, { x: b.x, y: 542 }, { x: 0, y: 542 }, "shock", 300, 18);
          projectile(
            s,
            { x: b.x + b.w, y: 542 },
            { x: 1200, y: 542 },
            "shock",
            300,
            18,
          );
        }
        if (b.pattern === "fan" || b.pattern === "missiles") {
          const from = P.center(b),
            base = Math.atan2(b.aim.y - from.y, b.aim.x - from.x);
          for (let i = -2; i <= 2; i++) {
            const angle = base + i * 0.2;
            projectile(
              s,
              from,
              {
                x: from.x + Math.cos(angle) * 300,
                y: from.y + Math.sin(angle) * 300,
              },
              "void",
              260 + b.phase * 25,
              15,
            );
          }
        }
        if (
          b.pattern === "summon" &&
          s.enemies.filter((e) => !e.boss && e.hp > 0).length < 4
        ) {
          s.enemies.push(
            enemy({ type: "hunter", x: 240, y: 518 }, "summon" + s.serial++),
            enemy({ type: "grunt", x: 970, y: 518 }, "summon" + s.serial++),
          );
          C.emit(s, "summon", b);
        }
      }
    } else if (b.state === "attack" && b.clock > 0.45) {
      b.state = "recover";
      b.clock = 0;
      b.vx *= 0.2;
    }
    b.vy = Math.min(650, b.vy + 1700 * dt);
    P.move(s, b, dt);
    b.x = Math.max(45, Math.min(1070, b.x));
  }
  function companion(s, h, leader, dt) {
    const a = {};
    if (h.hp <= 0) return a;
    const separation = P.dist(h, leader),
      cx = P.center(h).x;
    h.aiClock -= dt;
    if (separation > 680 || h.y > 670) {
      h.lostTime = (h.lostTime || 0) + dt;
      if (h.lostTime > 1.4) {
        const safe = P.safePoint(s, leader.x - 45);
        h.x = safe.x;
        h.y = safe.y;
        h.vx = h.vy = 0;
        h.invulnerable = 1;
        h.lostTime = 0;
        C.emit(s, "recall", h);
      }
    } else h.lostTime = 0;
    const rescue = leader.hp <= 0;
    const foes = s.enemies
      .filter((e) => e.hp > 0 && P.dist(h, e) < 320)
      .sort((a, b) => P.dist(h, a) - P.dist(h, b));
    const foe = foes[0];
    let destination = leader.x - 55 * leader.facing;
    if (rescue) destination = leader.x;
    else if (foe && P.dist(foe, leader) < 380)
      destination = foe.x - h.w * (foe.x > h.x ? 1 : -1);
    const delta = destination - h.x;
    a.left = delta < -24;
    a.right = delta > 24;
    a.jump = true;
    const danger = s.warnings.find(
      (z) => z.t < 0.3 && P.overlap({ ...h, y: h.y + h.h - 5, h: 10 }, z),
    );
    const strip = s.level.traps.some(
      (t) =>
        P.overlap({ ...h, y: h.y + h.h - 5, h: 10 }, t) &&
        (s.time + t.phase) % t.period < t.warning + t.active,
    );
    const front = cx + (delta > 0 ? 1 : -1) * 45,
      feet = h.y + h.h;
    const terrain = P.solids(s),
      support = terrain.some(
        (t) => front > t.x && front < t.x + t.w && Math.abs(t.y - feet) < 10,
      ),
      wall = terrain.some(
        (t) =>
          t.x < h.x + h.w + 38 &&
          t.x + t.w > h.x - 38 &&
          t.y < feet - 5 &&
          t.y > h.y - 140,
      );
    if (h.aiClock <= 0) {
      if (!rescue && (danger || strip)) {
        a.jumpPressed = true;
        a.dash = !!danger;
      } else if (
        (!support ||
          wall ||
          leader.y < h.y - 65 ||
          (foe && foe.y < h.y - 70)) &&
        Math.abs(delta) > 24 &&
        (h.grounded || (h.jumps < 2 && h.vy > 40))
      )
        a.jumpPressed = true;
      if (foe && !rescue && P.dist(h, foe) < 110) {
        a.light = true;
        h.facing = foe.x > h.x ? 1 : -1;
        if (h.energy > 70 && foes.length > 1) a.special = true;
        if (foe.type === "guard") a.heavy = true;
      }
      if (
        s.generatorReady &&
        s.generator.hp > 0 &&
        P.dist(h, s.generator) < 130
      )
        a.heavy = true;
      h.aiClock = 0.28;
    }
    if (rescue && P.dist(h, leader) < 65) {
      a.left = a.right = false;
      a.light = a.special = a.heavy = false;
    }
    if (s.fusion >= 100 && s.fusionRequests[leader.who] > 0) a.fusion = true;
    return a;
  }
  Rift.ai = {
    archetypes,
    enemy,
    boss,
    warning,
    projectile,
    updateEnemy,
    updateBoss,
    companion,
  };
})();
