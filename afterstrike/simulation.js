(() => {
  const A = Afterstrike,
    P = A.physics,
    F = A.GAME_FEEL,
    C = A.combat,
    E = A.echo;
  function random(s) {
    s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }
  function create({
    weapon = "blade",
    seed = 12345,
    assist = false,
    challenge = "standard",
    practice = false,
  } = {}) {
    const s = {
      seed: seed >>> 0,
      initialSeed: seed >>> 0,
      assist,
      challenge,
      practice,
      stage: practice ? 3 : 0,
      player: P.body(),
      scene: null,
      enemies: [],
      gates: [],
      encounters: [],
      serial: 0,
      echoes: [],
      history: E.init(),
      echoCooldown: 0,
      events: [],
      recordEvents: [],
      warnings: [],
      projectiles: [],
      build: new Set(),
      offers: [],
      style: 0,
      styleTimer: 0,
      lastStyle: null,
      repeatStyle: 0,
      variety: new Set(),
      combo: 0,
      comboTimer: 0,
      maxCombo: 0,
      score: 0,
      time: 0,
      damage: 0,
      kills: 0,
      syncs: 0,
      parries: 0,
      intercepts: 0,
      found: new Set(),
      hitstop: 0,
      slow: 0,
      failed: false,
      won: false,
      transition: false,
      relayOpen: false,
      playerOnRelay: false,
      bossWon: false,
      falls: 0,
      healUsed: false,
    };
    s.player.weapon = weapon;
    enter(s, s.stage);
    return s;
  }
  function enter(s, index) {
    s.stage = index;
    s.scene = JSON.parse(JSON.stringify(A.scenes[index]));
    s.player = {
      ...P.body(),
      weapon: s.player.weapon,
      hp: Math.min(100, s.player.hp + 15),
      energy: s.player.energy,
      special: Math.min(100, s.player.special + 15),
      ultimate: s.player.ultimate,
    };
    s.enemies = [];
    s.gates = s.scene.encounters.map((e) => ({
      x: e.gate,
      y: -600,
      w: 18,
      h: 1110,
      open: false,
    }));
    s.encounters = s.scene.encounters.map(() => ({
      started: false,
      done: false,
    }));
    s.projectiles = [];
    s.warnings = [];
    s.relayOpen = false;
    s.transition = false;
    s.bossWon = false;
    s.hitstop = 0;
    E.clear(s);
    if (s.scene.boss) s.enemies.push(A.ai.titan());
    if (s.practice)
      s.enemies.push(A.ai.create({ type: "bulwark", x: 970 }, "dummy"));
    s.events = [{ type: "scene", text: s.scene.tutorial }];
  }
  function offer(s) {
    const available = A.mutations.filter((m) => !s.build.has(m.id));
    const copy = available.slice(),
      out = [];
    while (out.length < 3 && copy.length) {
      out.push(copy.splice(Math.floor(random(s) * copy.length), 1)[0]);
    }
    s.offers = out;
  }
  function choose(s, id) {
    if (!s.transition || !s.offers.some((m) => m.id === id)) return false;
    s.build.add(id);
    enter(s, s.stage + 1);
    return true;
  }
  function anchor(s) {
    const h = s.player;
    if (h.anchor) {
      h.anchor = null;
      h.vx *= 1.15;
      h.vy = Math.min(-100, h.vy);
      h.snapWindow = 0.16;
      h.state = "grapple-release";
      s.events.push({ type: "release", ...P.center(h) });
      return;
    }
    const point = P.center(h),
      candidates = [
        ...s.scene.anchors,
        ...s.enemies
          .filter((e) => e.hp > 0 && !e.boss)
          .map((e) => ({ ...P.center(e), enemy: e.id })),
      ]
        .filter(
          (n) =>
            Math.hypot(n.x - point.x, n.y - point.y) < 420 &&
            n.y < point.y + 40,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - point.x, a.y - point.y) -
            Math.hypot(b.x - point.x, b.y - point.y),
        );
    const n = candidates[0];
    if (n) {
      h.anchor = {
        ...n,
        length: Math.max(70, Math.hypot(n.x - point.x, n.y - point.y)),
        t: 2.7,
      };
      h.vx += h.facing * 150;
      s.events.push({ type: "anchor", ...P.center(h) });
    } else s.events.push({ type: "notice", text: "NO VALID TEMPORAL ANCHOR" });
  }
  function player(s, a, dt) {
    const h = s.player,
      w = A.weapons[h.weapon];
    h.phase += dt;
    h.invulnerable = Math.max(0, h.invulnerable - dt);
    h.flash = Math.max(0, h.flash - dt);
    h.land = Math.max(0, h.land - dt);
    h.summon = Math.max(0, (h.summon || 0) - dt);
    h.switchPose = Math.max(0, (h.switchPose || 0) - dt);
    h.heal = Math.max(0, (h.heal || 0) - dt);
    h.dashCooldown = Math.max(0, h.dashCooldown - dt);
    h.snapWindow = Math.max(0, h.snapWindow - dt);
    h.comboTime = Math.max(0, h.comboTime - dt);
    h.energy = Math.min(100, h.energy + 8 * dt);
    h.special = Math.min(100, h.special + 3 * dt);
    if (h.stun > 0) {
      h.stun -= dt;
      h.state = "hit";
      h.vx *= Math.exp(-4 * dt);
      h.vy = Math.min(F.maxFall, h.vy + F.gravity * dt);
      P.move(s, h, dt);
      return;
    }
    const direction = (a.right ? 1 : 0) - (a.left ? 1 : 0);
    if (direction && !h.action) h.facing = direction;
    if (
      a.weapon &&
      A.weapons[a.weapon] &&
      s.unlockedWeapons?.includes(a.weapon) &&
      !h.action
    ) {
      h.weapon = a.weapon;
      h.switchPose = 0.2;
      s.events.push({ type: "weapon", ...P.center(h) });
    }
    h.coyote = h.grounded ? F.coyote : Math.max(0, h.coyote - dt);
    if (h.grounded) h.jumps = 0;
    h.jumpBuffer = a.jumpPressed
      ? F.jumpBuffer
      : Math.max(0, h.jumpBuffer - dt);
    if (
      h.jumpBuffer > 0 &&
      (!h.action || h.action.t >= h.action.start + h.action.active)
    ) {
      let jumped = false;
      if (h.wall && !h.grounded) {
        h.vx = -h.wall * 440;
        h.vy = -F.jump;
        h.jumps = 1;
        h.facing = -h.wall;
        jumped = true;
      } else if (h.coyote > 0 || h.jumps < 2) {
        h.vy = -F.jump;
        h.jumps = h.coyote > 0 ? 1 : Math.min(2, Math.max(1, h.jumps) + 1);
        jumped = true;
      }
      if (jumped) {
        h.jumpBuffer = 0;
        h.coyote = 0;
        h.grounded = false;
        h.jumpCut = false;
        h.anchor = null;
        h.action = null;
        h.state = h.jumps === 2 ? "double-jump" : "jump";
        s.events.push({ type: "jump", ...P.center(h), double: h.jumps === 2 });
      }
    }
    if (!a.jump && h.vy < 0 && !h.jumpCut && !h.anchor) {
      h.vy *= 0.55;
      h.jumpCut = true;
    }
    if (a.echo) E.summon(s);
    if (a.anchor) anchor(s);
    if (a.collapse) C.collapse(s);
    if (a.heal && !s.healUsed && h.hp < 100) {
      s.healUsed = true;
      h.hp = Math.min(100, h.hp + 35);
      h.heal = 0.5;
      s.events.push({ type: "heal", ...P.center(h) });
    }
    if (a.heavyHeld && !h.action) {
      h.charge = Math.min(1.2, h.charge + dt);
      h.chargeHeld = true;
      h.state = "charge";
    }
    if (!a.heavyHeld && h.chargeHeld) {
      a = { ...a, heavy: true };
      h.chargeHeld = false;
    }
    const request = a.ultimate
      ? "ultimate"
      : a.special
        ? "special"
        : a.parry
          ? "parry"
          : a.launcher
            ? "launcher"
            : a.heavy
              ? h.charge > 0.45
                ? "charged"
                : "heavy"
              : a.light
                ? h.action?.kind === "dash"
                  ? "dash-attack"
                  : "light"
                : a.dash
                  ? "dash"
                  : null;
    if (request) {
      if (request === "dash-attack") h.action = null;
      h.buffer = { kind: request, t: F.attackBuffer, charge: h.charge };
      h.charge = 0;
      if (request === "dash" && C.begin(s, h, "dash")) h.buffer = null;
    }
    if (h.buffer) {
      h.buffer.t -= dt;
      if (h.buffer.t <= 0) h.buffer = null;
      else if (!h.action && C.begin(s, h, h.buffer.kind, h.buffer.charge))
        h.buffer = null;
    }
    const dash = h.action?.kind === "dash";
    if (dash) {
      const vertical = a.up ? -1 : a.down ? 1 : 0,
        dx = direction || (!vertical ? h.facing : 0),
        boost = h.snapWindow > 0 ? 1.25 : 1;
      h.vx = dx * F.dashSpeed * boost;
      h.vy = vertical * F.dashSpeed * boost;
      h.action.t += dt;
      if (h.action.t >= F.dashTime) {
        h.action = null;
        h.vx *= 0.55;
        h.vy *= 0.5;
      }
    } else {
      if (direction) {
        if (Math.abs(h.vx) <= F.speed)
          h.vx = Math.max(
            -F.speed,
            Math.min(
              F.speed,
              h.vx +
                direction *
                  (h.grounded ? F.groundAcceleration : F.airAcceleration) *
                  dt,
            ),
          );
        else
          h.vx -=
            Math.sign(h.vx) * Math.min(Math.abs(h.vx) - F.speed, 1200 * dt);
      } else
        h.vx =
          Math.sign(h.vx) *
          Math.max(0, Math.abs(h.vx) - (h.grounded ? F.friction : 180) * dt);
      if (a.down && h.grounded && Math.abs(h.vx) > 100) {
        h.state = "slide";
        h.vx += h.facing * 500 * dt;
      } else if (a.down && !h.grounded) h.vy += 2500 * dt;
      h.vy = Math.min(
        F.maxFall,
        h.vy + F.gravity * (a.jump && Math.abs(h.vy) < 80 ? 0.55 : 1) * dt,
      );
      if (h.wall && !h.grounded && direction === h.wall) {
        h.vy = Math.min(h.vy, 90);
        h.state = "wall-slide";
      }
    }
    if (h.anchor) {
      const g = h.anchor;
      g.t -= dt;
      if (g.enemy) {
        const e = s.enemies.find((e) => e.id === g.enemy && e.hp > 0);
        if (e) Object.assign(g, P.center(e));
        else h.anchor = null;
      }
      if (g.t <= 0) {
        h.anchor = null;
        h.snapWindow = 0.16;
      } else if (h.anchor) {
        const c = P.center(h),
          dx = c.x - g.x,
          dy = c.y - g.y,
          d = Math.hypot(dx, dy) || 1;
        if (direction === Math.sign(g.x - c.x)) {
          g.length = Math.max(60, g.length - 110 * dt);
          h.vx += ((g.x - c.x) / d) * 900 * dt;
          h.vy += ((g.y - c.y) / d) * 900 * dt;
        }
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
        h.state = "grapple";
      }
    }
    if (!dash) C.update(s, h, dt);
    P.move(s, h, dt);
    if (h.action?.slam && h.grounded && !h.action.landed) {
      h.action.landed = true;
      s.events.push({ type: "slam", ...P.center(h) });
      if (s.build.has("gravity")) {
        const wave = {
          x: h.facing > 0 ? h.x : h.x - 220,
          y: 470,
          w: 220,
          h: 40,
        };
        for (const e of s.enemies)
          if (e.hp > 0 && P.overlap(wave, e)) C.damage(s, e, 26, h, "gravity");
      }
    }
    if (!h.action && !h.anchor && !h.chargeHeld) {
      h.state = h.grounded
        ? a.down
          ? Math.abs(h.vx) > 80
            ? "slide"
            : "crouch"
          : h.land > 0
            ? "land"
            : Math.abs(h.vx) > 40
              ? "run"
              : "idle"
        : h.wall && direction === h.wall
          ? "wall-slide"
          : Math.abs(h.vy) < 70
            ? "apex"
            : h.vy < 0
              ? "jump"
              : "fall";
    }
    h.idle = h.state === "idle" ? h.idle + dt : 0;
    h.foot -= dt;
    if (h.grounded && Math.abs(h.vx) > 100 && h.foot <= 0) {
      h.foot = 0.11;
      s.events.push({ type: "foot", x: h.x + 16, y: h.y + h.h });
    }
    if (h.y > 720) {
      s.falls++;
      C.hurt(s, 18, { x: h.x });
      const t = s.scene.terrain
        .filter((t) => t.w > 100 && t.y >= 390)
        .sort(
          (a, b) =>
            Math.abs(a.x + a.w / 2 - h.x) - Math.abs(b.x + b.w / 2 - h.x),
        )[0];
      h.x = Math.max(t.x + 10, Math.min(t.x + t.w - h.w - 10, h.x));
      h.y = t.y - h.h;
      h.vx = h.vy = 0;
      h.anchor = null;
    }
  }
  function step(s, a = {}, dt = F.dt) {
    if (s.failed || s.won || s.transition) return;
    s.events = [];
    s.recordEvents = [];
    if (s.hitstop > 0) {
      s.hitstop = Math.max(0, s.hitstop - dt);
      return;
    }
    s.time += dt;
    s.echoCooldown = Math.max(0, s.echoCooldown - dt);
    s.slow = Math.max(0, s.slow - dt);
    s.comboTimer -= dt;
    if (s.comboTimer <= 0) s.combo = 0;
    s.styleTimer -= dt;
    if (s.styleTimer <= 0) s.style = Math.max(0, s.style - dt * 14);
    if (s.challenge === "fragile") s.player.hp = Math.min(s.player.hp, 60);
    player(s, a, dt);
    E.playback(s);
    const enemyDt =
      dt * (s.slow > 0 ? 0.32 : 1) * (s.challenge === "overclock" ? 1.15 : 1);
    for (const e of s.enemies)
      if (e.boss) A.ai.boss(s, e, enemyDt);
      else A.ai.update(s, e, enemyDt);
    for (const z of s.warnings) {
      z.t -= enemyDt;
      if (z.t <= 0 && z.t > -z.active && !z.hit && P.overlap(z, s.player))
        z.hit = C.hurt(s, z.damage, { x: z.x + z.w / 2 });
    }
    s.warnings = s.warnings.filter((z) => z.t > -z.active);
    for (const p of s.projectiles) {
      p.x += p.vx * enemyDt;
      p.y += p.vy * enemyDt;
      p.life -= dt;
      if (P.overlap(p, s.player)) {
        C.hurt(s, p.damage, { x: p.x });
        p.life = 0;
      }
      if (P.solids(s).some((t) => P.overlap(p, t))) p.life = 0;
    }
    s.projectiles = s.projectiles.filter((p) => p.life > 0);
    s.scene.encounters.forEach((e, i) => {
      const state = s.encounters[i];
      if (!state.started && s.player.x > e.x) {
        state.started = true;
        const variant = e.variants[Math.floor(random(s) * e.variants.length)];
        for (const spec of variant)
          s.enemies.push({
            ...A.ai.create(spec, "enemy" + s.serial++),
            encounter: i,
          });
        s.events.push({
          type: "encounter",
          text: "TIMELINE HOSTILES · " + variant.length,
        });
      }
      if (
        state.started &&
        !state.done &&
        !s.enemies.some((e) => e.encounter === i && e.hp > 0)
      ) {
        state.done = true;
        s.gates[i].open = true;
        s.events.push({ type: "clear", x: e.gate, y: 480 });
      }
    });
    const pad = s.scene.pad;
    s.playerOnRelay =
      !!pad && P.overlap(s.player, { ...pad, y: pad.y - 10, h: 20 });
    if (pad && !s.relayOpen) {
      const held =
        s.playerOnRelay ||
        s.echoes.some((e) => P.overlap(e, { ...pad, y: pad.y - 10, h: 20 }));
      s.relayHeld = held;
      if (held && s.player.x > s.scene.door.x + s.scene.door.w)
        s.relayOpen = true;
    }
    s.scene.relics.forEach((r, i) => {
      const id = s.stage + ":" + i;
      if (
        !s.found.has(id) &&
        Math.hypot(P.center(s.player).x - r.x, P.center(s.player).y - r.y) < 27
      ) {
        s.found.add(id);
        s.score += 250;
        s.events.push({ type: "relic", ...r });
      }
    });
    E.record(s);
    if (s.practice) {
      if (s.player.hp < 100) s.player.hp = 100;
      s.failed = false;
      s.player.energy = 100;
      s.player.special = 100;
      s.player.ultimate = 100;
      if (!s.enemies.some((e) => e.hp > 0))
        s.enemies.push(
          A.ai.create({ type: "bulwark", x: 970 }, "dummy" + s.serial++),
        );
    } else if (
      s.player.x > s.scene.exit - 30 &&
      s.encounters.every((e) => e.done) &&
      (!s.scene.door || s.relayOpen) &&
      (!s.scene.boss || s.bossWon)
    ) {
      if (s.stage === 2) {
        s.won = true;
        s.player.state = "victory";
        s.events.push({ type: "victory", ...P.center(s.player) });
      } else {
        s.transition = true;
        offer(s);
        s.events.push({
          type: "upgrade",
          text: "A MOMENT TO CHOOSE YOUR FUTURE",
        });
      }
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0 || e.death > 0);
  }
  A.simulation = { create, step, enter, choose, anchor, player, random };
})();
