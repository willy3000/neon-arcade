(() => {
  const A = Afterstrike,
    P = A.physics,
    C = A.combat;
  const roles = {
    scavenger: { hp: 75, speed: 120, range: 68, start: 0.5, cool: 1.6 },
    lancer: { hp: 100, speed: 95, range: 220, start: 0.65, cool: 2.1 },
    bulwark: { hp: 170, speed: 65, range: 90, start: 0.8, cool: 2.5 },
    gunner: { hp: 65, speed: 45, range: 650, start: 0.9, cool: 2.7 },
    hunter: { hp: 110, speed: 155, range: 110, start: 0.55, cool: 1.7 },
  };
  function create(spec, id) {
    const d = roles[spec.type];
    return {
      id,
      type: spec.type,
      x: spec.x,
      y: spec.y ?? 464,
      w: 34,
      h: 46,
      vx: 0,
      vy: 0,
      facing: -1,
      hp: d.hp,
      maxHp: d.hp,
      armor: spec.type === "bulwark" ? 4 : 0,
      state: "patrol",
      t: 0,
      cool: 1.1,
      stun: 0,
      flash: 0,
      home: spec.x,
      death: 0,
    };
  }
  function warn(s, rect, t = 0.8, kind = "strike", damage = 18, active = 0.25) {
    s.warnings.push({
      ...rect,
      t,
      duration: t,
      kind,
      damage,
      active,
      hit: false,
    });
    s.events.push({ type: "warning", x: rect.x + rect.w / 2, y: rect.y });
  }
  function bolt(s, x, y, target, speed = 320) {
    const d = Math.hypot(target.x - x, target.y - y) || 1;
    s.projectiles.push({
      x,
      y,
      w: 12,
      h: 8,
      vx: ((target.x - x) / d) * speed,
      vy: ((target.y - y) / d) * speed,
      damage: 14,
      life: 5,
    });
  }
  function update(s, e, dt) {
    if (e.hp <= 0) {
      e.death -= dt;
      return;
    }
    e.flash = Math.max(0, e.flash - dt);
    e.cool = Math.max(0, e.cool - dt);
    e.vy = Math.min(750, e.vy + 1700 * dt);
    if (e.stun > 0) {
      e.stun -= dt;
      e.vx *= Math.exp(-6 * dt);
      P.move(s, e, dt);
      if (e.stun <= 0) e.state = "recover";
      return;
    }
    const target =
        e.type === "hunter" && s.echoes.length
          ? s.echoes
              .slice()
              .sort((a, b) => P.distance(e, a) - P.distance(e, b))[0]
          : s.player,
      d = P.distance(e, target),
      direction = Math.sign(target.x - e.x) || e.facing,
      role = roles[e.type];
    if (e.state === "windup") {
      e.t += dt;
      e.vx = 0;
      if (e.t >= role.start) {
        e.state = "attack";
        e.t = 0;
        e.hit = false;
        if (e.type === "gunner") bolt(s, e.x + 17, e.y + 20, e.aim);
        else e.vx = e.facing * (e.type === "lancer" ? 500 : 100);
      }
    } else if (e.state === "attack") {
      e.t += dt;
      const attack = {
        x: e.facing > 0 ? e.x + e.w : e.x - 55,
        y: e.y,
        w: 55,
        h: e.h,
      };
      if (
        !e.hit &&
        e.type !== "gunner" &&
        P.overlap(attack, target) &&
        !P.solids(s).some((t) =>
          P.overlap(t, {
            x: Math.min(P.center(e).x, P.center(target).x),
            y: e.y + 15,
            w: Math.abs(P.center(e).x - P.center(target).x),
            h: 10,
          }),
        )
      ) {
        if (target.echo) {
          target.integrity--;
          e.hit = true;
          s.events.push({ type: "echo-break", ...P.center(target) });
        } else
          e.hit = C.hurt(s, e.type === "bulwark" ? 23 : 16, {
            ...P.center(e),
            enemy: e,
          });
      }
      if (e.t > 0.24) {
        e.state = "recover";
        e.t = 0;
        e.vx = 0;
      }
    } else if (e.state === "recover") {
      e.t += dt;
      e.vx *= Math.exp(-10 * dt);
      if (e.t > 0.6) {
        e.state = "approach";
        e.cool = role.cool;
      }
    } else {
      e.facing = direction;
      if (d < role.range && Math.abs(e.y - target.y) < 150 && e.cool <= 0) {
        e.state = "windup";
        e.t = 0;
        e.aim = P.center(target);
        s.events.push({ type: "enemy-warning", ...P.center(e) });
      } else if (d < 680) {
        e.state = "approach";
        const keep = e.type === "gunner" ? 280 : 55;
        e.vx =
          d > keep
            ? direction * role.speed
            : d < keep - 80
              ? -direction * role.speed
              : 0;
      } else {
        e.state = "patrol";
        e.vx = Math.sin(s.time + e.home) > 0 ? 28 : -28;
      }
      if (e.grounded) {
        const fx = e.x + (e.vx > 0 ? e.w + 18 : -18),
          support = P.solids(s).some(
            (t) => fx > t.x && fx < t.x + t.w && Math.abs(t.y - e.y - e.h) < 10,
          );
        if (!support) e.vx = 0;
        if (e.wall && e.type !== "gunner") e.vy = -500;
      }
    }
    P.move(s, e, dt);
    if (e.y > 720) C.damage(s, e, e.hp * 4, s.player, "fall");
  }
  function titan() {
    return {
      id: "titan",
      type: "titan",
      boss: true,
      x: 790,
      y: 380,
      w: 105,
      h: 130,
      hp: 1100,
      maxHp: 1100,
      vx: 0,
      vy: 0,
      facing: -1,
      state: "recover",
      t: 0,
      phase: 1,
      cycle: 0,
      armor: 6,
      components: [
        { id: "left-arm", hp: 85 },
        { id: "right-arm", hp: 85 },
      ],
      stun: 0,
      flash: 0,
      death: 0,
    };
  }
  function boss(s, e, dt) {
    if (e.hp <= 0) {
      e.death -= dt;
      return;
    }
    e.flash = Math.max(0, e.flash - dt);
    e.t += dt;
    if (e.hp < e.maxHp * 0.5 && e.phase === 1) {
      e.phase = 2;
      s.events.push({
        type: "boss-phase",
        ...P.center(e),
        text: "TITAN · PHASE TWO",
      });
      s.scene.terrain.push({ x: 475, y: 402, w: 150, h: 18 });
    }
    if (e.state === "recover" && e.t > 1.4) {
      e.state = "windup";
      e.t = 0;
      e.facing = s.player.x < e.x ? -1 : 1;
      e.pattern = e.cycle++ % 4;
      e.wind = e.phase === 2 ? 0.8 : 1.05;
      if (e.pattern === 0)
        warn(s, { x: e.x - 150, y: 450, w: 410, h: 60 }, e.wind, "SLAM", 23);
      if (e.pattern === 1)
        warn(
          s,
          { x: e.facing < 0 ? e.x - 260 : e.x + e.w, y: 407, w: 260, h: 90 },
          e.wind,
          "SWEEP",
          22,
        );
      if (e.pattern === 2)
        for (let i = 0; i < 3; i++)
          warn(
            s,
            {
              x: Math.max(40, Math.min(980, s.player.x + (i - 1) * 150)),
              y: 440,
              w: 65,
              h: 70,
            },
            e.wind + i * 0.2,
            "MISSILE",
            20,
          );
      s.events.push({ type: "boss-warning", ...P.center(e) });
    } else if (e.state === "windup" && e.t > e.wind) {
      e.state = "attack";
      e.t = 0;
      if (e.pattern === 3) {
        bolt(s, e.x, 493, { x: 0, y: 493 }, 300);
        bolt(s, e.x + e.w, 493, { x: 1100, y: 493 }, 300);
      }
    } else if (e.state === "attack" && e.t > 0.4) {
      e.state = "recover";
      e.t = 0;
    }
    e.vy = Math.min(750, e.vy + 1700 * dt);
    P.move(s, e, dt);
  }
  A.ai = { roles, create, update, warn, bolt, titan, boss };
})();
