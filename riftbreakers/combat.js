/* Explicit action phases, per-swing hit sets, interrupts and resource costs. */
(() => {
  const P = Rift.physics;
  const stats = {
    blaze: { speed: 265, jump: 590, light: [23, 29, 44], combo: 3 },
    volt: { speed: 320, jump: 620, light: [15, 19, 23, 34], combo: 4 },
  };
  function hero(who, x) {
    return {
      id: who,
      who,
      x,
      y: 516,
      w: 26,
      h: 44,
      vx: 0,
      vy: 0,
      facing: 1,
      hp: 100,
      energy: 65,
      ultimate: 0,
      invulnerable: 0,
      grounded: false,
      coyote: 0,
      jumpBuffer: 0,
      jumps: 0,
      jumpCut: false,
      wall: 0,
      support: null,
      state: "idle",
      action: null,
      buffer: null,
      comboStep: 0,
      comboTime: 0,
      dashCooldown: 0,
      downTimer: 0,
      revive: 0,
      grapple: null,
      grappleCooldown: 0,
      swingCooldown: 0,
      flash: 0,
      aiClock: 0,
      footClock: 0,
    };
  }
  const emit = (s, type, b, extra = {}) =>
    s.events.push({ type, who: b.who || b.type, ...P.center(b), ...extra });
  function hurt(s, h, amount, source) {
    if (h.hp <= 0 || h.invulnerable > 0 || s.fusionAction) return false;
    const a = h.action;
    if (a?.kind === "dash" && a.t >= 0.035 && a.t <= 0.17) {
      s.fusion = Math.min(100, s.fusion + 3);
      return false;
    }
    h.hp = Math.max(0, h.hp - amount);
    s.damage += amount;
    h.invulnerable = 1.05;
    h.flash = 0.14;
    h.grapple = null;
    h.buffer = null;
    const direction = source
      ? Math.sign(P.center(h).x - source.x) || 1
      : -h.facing;
    h.vx = direction * 260;
    h.vy = -190;
    h.action = null;
    h.stun = 0.22;
    h.state = "hit-stun";
    s.hitstop = Math.max(s.hitstop, 0.035);
    emit(s, "hurt", h, { value: amount });
    if (h.hp <= 0) {
      h.state = "defeated";
      h.downTimer = 20;
      h.revive = 0;
      emit(s, "down", h);
    }
    return true;
  }
  function damage(s, e, amount, from, kind = "light", launch = false) {
    if (e.hp <= 0) return false;
    if (
      e.type === "guard" &&
      e.armor > 0 &&
      kind !== "fusion" &&
      kind !== "ultimate"
    ) {
      const front = (from.x - P.center(e).x) * e.facing > 0;
      if (kind === "heavy" || kind === "special") e.armor--;
      if (front && e.armor > 0 && !e.stun) {
        amount *= 0.25;
        emit(s, "shield", e);
      }
    }
    if (e.boss) {
      if (e.state !== "recover" && kind !== "fusion" && kind !== "ultimate")
        amount *= 0.45;
      amount = Math.min(amount, e.maxHp * 0.16);
    }
    const coordinated =
      e.lastWho && e.lastWho !== from.who && s.time - e.lastHit < 1.5;
    if (coordinated) {
      s.fusion = Math.min(100, s.fusion + 7);
      s.score += 25;
      emit(s, "team", e);
    }
    e.lastWho = from.who;
    e.lastHit = s.time;
    e.hp = Math.max(0, e.hp - amount);
    e.flash = 0.12;
    const direction = Math.sign(P.center(e).x - from.x) || 1;
    if (!e.boss) {
      e.vx = direction * (kind === "heavy" ? 360 : 200);
      e.vy = launch ? -420 : -100;
      e.stun = kind === "special" ? 0.5 : 0.18;
      e.state = "stunned";
    }
    s.combo++;
    s.comboTimer = 2.25;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.score += Math.round(amount) * (1 + Math.floor(s.combo / 5) * 0.15);
    s.fusion = Math.min(100, s.fusion + 2);
    const h = s.heroes.find((h) => h.who === from.who);
    if (h) {
      h.energy = Math.min(100, h.energy + 3);
      h.ultimate = Math.min(100, h.ultimate + amount * 0.22);
    }
    s.hitstop = Math.max(s.hitstop, kind === "heavy" ? 0.055 : 0.025);
    emit(s, "hit", e, { value: Math.round(amount), kind, from: from.who });
    if (e.hp <= 0) {
      e.state = "dead";
      e.deadTime = 0.65;
      s.kills++;
      s.score += e.boss ? 1000 : 120;
      emit(s, e.boss ? "boss-death" : "kill", e);
      s.drops.push({
        x: e.x + e.w / 2,
        y: e.y + e.h / 2,
        life: 15,
        kind: s.kills % 3 === 0 ? "health" : "energy",
      });
      if (e.boss) {
        s.generator.hp = 0;
        s.events.push({ type: "generator", ...P.center(s.generator) });
      }
    }
    return true;
  }
  function attackBox(h, a) {
    const reach =
      a.kind === "heavy"
        ? h.who === "volt"
          ? 130
          : 100
        : h.who === "volt"
          ? 80
          : 94;
    return {
      x: h.facing > 0 ? h.x + h.w - 5 : h.x - reach + 5,
      y: h.y - 12,
      w: reach,
      h: h.h + 28,
    };
  }
  function scenery(s, box, amount, from, kind) {
    for (const c of [...s.crates, s.generator]) {
      if (
        c.hp <= 0 ||
        !P.overlap(box, c) ||
        (c === s.generator && !s.generatorReady)
      )
        continue;
      if (c.reinforced && kind === "light") continue;
      c.hp -= amount;
      if (c.hp <= 0) {
        emit(
          s,
          c.barrel ? "explosion" : c === s.generator ? "generator" : "crate",
          c,
          { radius: c.barrel ? 145 : 60 },
        );
        s.score += 50;
        if (c.barrel) {
          for (const e of s.enemies)
            if (P.dist(c, e) < 145) damage(s, e, 70, from, "special", true);
          for (const h of s.heroes)
            if (P.dist(c, h) < 105) hurt(s, h, 12, P.center(c));
        } else if (c !== s.generator)
          s.drops.push({ ...P.center(c), kind: "health", life: 20 });
      }
    }
  }
  function area(s, h, radius, amount, kind) {
    const from = { ...P.center(h), who: h.who };
    for (const e of s.enemies)
      if (P.dist(h, e) <= radius) damage(s, e, amount, from, kind, true);
    scenery(
      s,
      { x: from.x - radius, y: from.y - radius, w: radius * 2, h: radius * 2 },
      amount,
      from,
      kind,
    );
    emit(
      s,
      kind === "fusion"
        ? "fusion-blast"
        : h.who === "blaze"
          ? "fire"
          : "lightning",
      h,
      { radius },
    );
  }
  function begin(s, h, kind) {
    if (h.hp <= 0 || h.stun > 0) return false;
    const current = h.action;
    if (current) {
      const cancel =
        kind === "dash" &&
        current.t >= current.start + current.active &&
        (current.kind === "light" || current.kind === "heavy");
      if (!cancel) return false;
    }
    if (kind === "dash") {
      if (h.dashCooldown > 0) return false;
      h.dashCooldown = h.who === "blaze" ? 0.75 : 0.6;
      h.action = {
        kind,
        t: 0,
        start: 0,
        active: 0.2,
        recovery: 0.06,
        hit: new Set(),
      };
      h.state = "dash";
      h.grapple = null;
      emit(s, "dash", h);
      return true;
    }
    if (
      (kind === "special" && h.energy < 35) ||
      (kind === "ultimate" && h.ultimate < 100)
    )
      return false;
    if (kind === "special") h.energy -= 35;
    if (kind === "ultimate") h.ultimate = 0;
    const timings =
      kind === "light"
        ? h.who === "blaze"
          ? [0.065, 0.105, 0.17]
          : [0.04, 0.08, 0.12]
        : kind === "heavy"
          ? h.who === "blaze"
            ? [0.23, 0.14, 0.3]
            : [0.15, 0.14, 0.22]
          : kind === "special"
            ? [0.15, 0.15, 0.25]
            : [0.22, 0.75, 0.35];
    const step =
      kind === "light"
        ? h.comboTime > 0
          ? h.comboStep % stats[h.who].combo
          : 0
        : 0;
    if (kind === "light") {
      h.comboStep = step + 1;
      h.comboTime = 0.85;
    }
    h.action = {
      kind,
      t: 0,
      start: timings[0],
      active: timings[1],
      recovery: timings[2],
      step,
      hit: new Set(),
      fired: false,
      air: !h.grounded,
      pulse: 0,
    };
    h.state =
      kind === "special"
        ? "special"
        : kind === "ultimate"
          ? "ultimate"
          : "attack-startup";
    if (kind === "ultimate" && h.who === "blaze") {
      h.vy = -720;
      h.grounded = false;
    }
    if (kind === "heavy" && !h.grounded) {
      h.vy = 700;
      h.action.slam = true;
    }
    emit(s, kind, h, { step });
    return true;
  }
  function updateAction(s, h, dt, input) {
    const a = h.action;
    if (!a) return;
    a.t += dt;
    if (a.kind === "dash") {
      const vertical =
        h.who === "volt" ? (input.up ? -1 : input.aimDown ? 1 : 0) : 0;
      const horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      h.vx =
        (horizontal || (!vertical ? h.facing : 0)) *
        (h.who === "volt" ? 860 : 720);
      h.vy = vertical * 720;
      if (a.t >= 0.2) {
        h.vx *= 0.46;
        h.action = null;
      }
      return;
    }
    if (a.t < a.start) {
      h.state =
        a.kind === "special"
          ? "special"
          : a.kind === "ultimate"
            ? "ultimate"
            : "attack-startup";
      return;
    }
    if (a.t < a.start + a.active) {
      h.state =
        a.kind === "special"
          ? "special"
          : a.kind === "ultimate"
            ? "ultimate"
            : "attack-active";
      if (a.kind === "special" && !a.fired) {
        a.fired = true;
        if (h.who === "blaze") {
          area(s, h, 180, 55, "special");
          s.zones.push({
            ...P.center(h),
            r: 130,
            t: 3,
            tick: 0,
            kind: "fire",
            who: h.who,
          });
        } else {
          let origin = P.center(h),
            used = new Set();
          for (let chain = 0; chain < 5; chain++) {
            const candidates = s.enemies
              .filter(
                (e) =>
                  e.hp > 0 &&
                  !used.has(e.id) &&
                  Math.hypot(
                    P.center(e).x - origin.x,
                    P.center(e).y - origin.y,
                  ) < (chain ? 200 : 290),
              )
              .sort(
                (a, b) =>
                  Math.hypot(
                    P.center(a).x - origin.x,
                    P.center(a).y - origin.y,
                  ) -
                  Math.hypot(
                    P.center(b).x - origin.x,
                    P.center(b).y - origin.y,
                  ),
              );
            const e = candidates[0];
            if (!e) break;
            used.add(e.id);
            const next = P.center(e);
            s.events.push({
              type: "arc",
              x: origin.x,
              y: origin.y,
              to: next,
              who: h.who,
            });
            damage(
              s,
              e,
              48 * Math.pow(0.8, chain),
              { ...origin, who: h.who },
              "special",
            );
            origin = next;
          }
          for (const z of s.zones)
            if (
              z.kind === "fire" &&
              Math.hypot(z.x - h.x, z.y - h.y) < 300 &&
              !z.electrified
            ) {
              z.electrified = true;
              s.fusion = Math.min(100, s.fusion + 12);
              emit(s, "team", h);
            }
          scenery(
            s,
            { x: h.x - 140, y: h.y - 80, w: 300, h: 180 },
            45,
            { ...P.center(h), who: h.who },
            "special",
          );
          emit(s, "lightning", h, { radius: 100 });
        }
      } else if (a.kind === "ultimate") {
        if (h.who === "blaze") {
          if (a.t > 0.35) h.vy = 950;
          if (h.grounded && !a.fired) {
            a.fired = true;
            area(s, h, 330, 125, "ultimate");
          }
        } else {
          a.pulse -= dt;
          s.slowEnemies = 0.8;
          if (a.pulse <= 0) {
            a.pulse = 0.14;
            for (const e of s.enemies)
              if (P.dist(h, e) < 260)
                damage(s, e, 18, { ...P.center(h), who: h.who }, "ultimate");
            emit(s, "lightning", h, { radius: 180 });
          }
          if (a.t > a.start + a.active - 0.03 && !a.fired) {
            a.fired = true;
            area(s, h, 280, 70, "ultimate");
          }
        }
      } else if (a.kind === "light" || a.kind === "heavy") {
        const box = attackBox(h, a),
          amount = a.kind === "heavy" ? 65 : stats[h.who].light[a.step];
        for (const e of s.enemies)
          if (e.hp > 0 && !a.hit.has(e.id) && P.overlap(box, e)) {
            a.hit.add(e.id);
            damage(
              s,
              e,
              amount,
              { ...P.center(h), who: h.who },
              a.kind,
              a.kind === "heavy" || a.step === stats[h.who].combo - 1,
            );
          }
        if (!a.hit.has("scenery")) {
          a.hit.add("scenery");
          scenery(s, box, amount, { ...P.center(h), who: h.who }, a.kind);
        }
      }
    } else h.state = "attack-recovery";
    if (a.t >= a.start + a.active + a.recovery) {
      if (a.kind === "ultimate" && h.who === "blaze" && !a.fired)
        area(s, h, 330, 125, "ultimate");
      h.action = null;
    }
  }
  Rift.combat = {
    stats,
    hero,
    hurt,
    damage,
    attackBox,
    scenery,
    area,
    begin,
    updateAction,
    emit,
  };
})();
