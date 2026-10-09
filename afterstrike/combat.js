(() => {
  const A = Afterstrike,
    P = A.physics,
    F = A.GAME_FEEL;
  const source = (b) => ({
    ...P.center(b),
    facing: b.facing,
    who: b.echo ? "echo" : "nyx",
    id: b.id || "nyx",
  });
  function style(s, kind, bonus = 0) {
    const repeat =
      s.lastStyle === kind ? Math.max(0.2, 1 - s.repeatStyle * 0.18) : 1;
    s.repeatStyle = s.lastStyle === kind ? s.repeatStyle + 1 : 0;
    s.lastStyle = kind;
    s.style = Math.min(700, s.style + (18 + bonus) * repeat);
    s.styleTimer = 3;
    s.variety.add(kind);
  }
  function damage(s, e, amount, b, kind, launch = false) {
    if (e.hp <= 0) return false;
    const from = source(b);
    let armored = false;
    if (e.boss && e.components) {
      const component = e.components[from.x < P.center(e).x ? 0 : 1];
      if (component.hp > 0) {
        component.hp -=
          amount *
          (["heavy", "charged"].includes(kind) || b.weapon === "gauntlets"
            ? 0.6
            : 0.15);
        if (component.hp <= 0) {
          s.events.push({ type: "component-break", ...P.center(e) });
          s.scene.terrain.push({
            x: Math.max(20, e.x - 140),
            y: 430,
            w: 100,
            h: 18,
          });
        }
      }
      e.armor = e.components.every((c) => c.hp > 0) ? 6 : 0;
    }
    if ((e.type === "bulwark" || e.boss) && e.armor > 0) {
      const breaking =
        kind === "heavy" || kind === "charged" || b.weapon === "gauntlets";
      if (breaking && !e.boss) {
        e.armor -= b.weapon === "gauntlets" ? 2 : 1;
        if (e.armor <= 0)
          s.events.push({ type: "guard-break", ...P.center(e) });
      }
      armored = e.armor > 0 && (from.x - P.center(e).x) * e.facing > 0;
      if (armored) amount *= 0.3;
    }
    if (e.boss) {
      if (e.state !== "recover") amount *= 0.6;
      amount = Math.min(amount, e.maxHp * 0.13);
    }
    if (b.echo) amount *= 0.48;
    const last = e.lastContact,
      opposite = last && last.side !== Math.sign(from.x - P.center(e).x),
      paired = last && last.who !== from.who && s.time - last.time < 0.32;
    if (paired) {
      const perfect = s.time - last.time < 0.13,
        cross = opposite;
      s.syncs++;
      const event = perfect
        ? "PERFECT SYNC"
        : cross
          ? "ECHO CROSSFIRE"
          : "TEMPORAL COMBO";
      amount *= perfect ? 1.3 : cross ? 1.18 : 1.05;
      style(s, "sync", 35);
      s.events.push({ type: "sync", ...P.center(e), text: event });
      if (s.build.has("chorus") && perfect && !s.chorusLock) {
        s.chorusLock = true;
        for (const other of s.enemies)
          if (other !== e && other.hp > 0 && P.distance(e, other) < 100)
            damage(s, other, 10, b, "chorus");
        s.chorusLock = false;
      }
    }
    e.lastContact = {
      who: from.who,
      time: s.time,
      side: Math.sign(from.x - P.center(e).x),
    };
    e.hp = Math.max(0, e.hp - amount);
    e.flash = 0.12;
    e.stagger =
      (e.stagger || 0) + (kind === "heavy" ? 3 : A.weapons[b.weapon].stagger);
    if (!e.boss && !armored) {
      e.state = "stagger";
      e.stun = launch ? 0.5 : 0.22;
      e.vx = Math.sign(P.center(e).x - from.x) * (kind === "heavy" ? 340 : 180);
      e.vy = launch ? -440 : -80;
      if (b.weapon === "chain" && kind === "heavy")
        e.vx = -Math.sign(P.center(e).x - from.x) * 300;
    }
    if (!b.echo) {
      style(s, kind + (b.grounded ? "" : "-air"));
      s.player.ultimate = Math.min(100, s.player.ultimate + amount * 0.2);
      s.player.special = Math.min(100, s.player.special + amount * 0.04);
      if (kind === "dash-attack" && s.build.has("kinetic"))
        s.player.energy = Math.min(100, s.player.energy + 12);
    }
    s.combo++;
    s.comboTimer = 2.3;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.score += Math.round(amount) * (1 + Math.floor(s.style / 100) * 0.15);
    s.hitstop = Math.max(
      s.hitstop,
      kind === "heavy" || paired ? 0.05 : F.hitstop,
    );
    s.events.push({
      type: "hit",
      ...P.center(e),
      amount: Math.round(amount),
      kind,
      echo: !!b.echo,
    });
    if (e.hp <= 0) {
      e.state = "die";
      e.death = 0.65;
      s.kills++;
      s.score += e.boss ? 1200 : 100;
      s.events.push({ type: e.boss ? "boss-death" : "kill", ...P.center(e) });
      if (paired && s.build.has("refund"))
        s.player.energy = Math.min(100, s.player.energy + 18);
      s.player.hp = Math.min(100, s.player.hp + (e.boss ? 0 : 4));
      if (e.boss) s.bossWon = true;
    }
    return true;
  }
  function hurt(s, amount, from) {
    const h = s.player;
    if (h.hp <= 0 || h.invulnerable > 0) return false;
    if (h.action?.kind === "parry" && h.action.t < F.parryWindow) {
      s.parries++;
      h.energy = Math.min(100, h.energy + 15);
      h.special = Math.min(100, h.special + 10);
      h.ultimate = Math.min(100, h.ultimate + 8);
      h.action = null;
      style(s, "parry", 50);
      s.hitstop = 0.07;
      s.events.push({
        type: "parry",
        ...P.center(h),
        text: "PARRY · COUNTER WINDOW",
      });
      if (from?.enemy) {
        from.enemy.stun = 0.8;
        from.enemy.state = "stagger";
      }
      if (s.build.has("bloodless")) s.slow = 1;
      return false;
    }
    if (h.action?.kind === "dash" && h.action.t > 0.02 && h.action.t < 0.15)
      return false;
    const dmg = s.assist ? amount * 0.55 : amount;
    h.hp = Math.max(0, h.hp - dmg);
    s.damage += dmg;
    h.invulnerable = F.hitImmunity;
    h.stun = 0.2;
    h.vx = (Math.sign(P.center(h).x - (from?.x ?? h.x)) || -h.facing) * 260;
    h.vy = -170;
    h.action = null;
    h.buffer = null;
    h.anchor = null;
    h.flash = 0.13;
    s.style *= 0.72;
    s.events.push({ type: "hurt", ...P.center(h) });
    if (h.hp <= 0) {
      h.state = "death";
      s.failed = true;
      s.events.push({ type: "death", ...P.center(h) });
    }
    return true;
  }
  function box(b, attack) {
    const w = A.weapons[attack.weapon || b.weapon],
      range = attack.kind === "heavy" ? w.reach * 1.2 : w.reach;
    return {
      x: b.facing > 0 ? b.x + b.w - 5 : b.x - range + 5,
      y: attack.kind === "launcher" ? b.y - 60 : b.y - 10,
      w: range,
      h: attack.kind === "launcher" ? 100 : b.h + 22,
    };
  }
  function begin(s, h, kind, charge = 0) {
    if (h.hp <= 0 || h.stun > 0) return false;
    const old = h.action;
    if (
      old &&
      !(
        kind === "dash" &&
        old.t >= old.start + old.active &&
        ["light", "heavy", "charged"].includes(old.kind)
      )
    )
      return false;
    if (kind === "dash") {
      if (h.dashCooldown > 0) return false;
      h.dashCooldown = F.dashCooldown;
      h.action = {
        kind,
        t: 0,
        start: 0,
        active: F.dashTime,
        recovery: 0,
        id: s.serial++,
        weapon: h.weapon,
      };
      h.state = h.grounded ? "dash" : "air-dash";
      h.anchor = null;
      s.events.push({
        type: h.snapWindow > 0 ? "snap" : "dash",
        ...P.center(h),
      });
      return true;
    }
    if (
      (kind === "special" && h.special < 30) ||
      (kind === "ultimate" && h.ultimate < 100)
    )
      return false;
    if (kind === "special") h.special -= 30;
    if (kind === "ultimate") h.ultimate = 0;
    const w = A.weapons[h.weapon],
      timing =
        kind === "light"
          ? [w.start, w.active, w.recovery]
          : kind === "parry"
            ? [0, F.parryWindow, 0.16]
            : kind === "special"
              ? [0.1, 0.14, 0.24]
              : kind === "ultimate"
                ? [0.18, 0.35, 0.3]
                : kind === "launcher"
                  ? [0.1, 0.12, 0.2]
                  : [charge > 0.5 ? 0.13 : 0.19, 0.15, 0.25];
    const step = kind === "light" && h.comboTime > 0 ? h.comboStep % 3 : 0;
    if (kind === "light") {
      h.comboStep = step + 1;
      h.comboTime = 0.85;
    }
    h.action = {
      kind,
      t: 0,
      start: timing[0],
      active: timing[1],
      recovery: timing[2],
      weapon: h.weapon,
      step,
      charge,
      id: s.serial++,
      hits: new Set(),
      air: !h.grounded,
      fired: false,
    };
    h.state = kind === "light" ? "attack-startup" : kind;
    h.idle = 0;
    if (kind === "launcher") {
      h.vy = -220;
      h.grounded = false;
    }
    if ((kind === "heavy" || kind === "charged") && !h.grounded) {
      h.vy = 820;
      h.action.slam = true;
    }
    s.events.push({ type: kind, ...P.center(h), weapon: h.weapon, step });
    return true;
  }
  function strike(s, b, attack, hits) {
    const region = box(b, attack),
      w = A.weapons[attack.weapon],
      amount =
        attack.kind === "light"
          ? w.light[attack.step || 0]
          : attack.kind === "launcher"
            ? w.heavy * 0.7
            : attack.kind === "dash-attack"
              ? w.heavy * 0.6
              : w.heavy * (1 + (attack.charge || 0) * 0.7);
    for (const e of s.enemies)
      if (e.hp > 0 && !hits.has(e.id) && P.overlap(region, e)) {
        hits.add(e.id);
        damage(
          s,
          e,
          amount,
          b,
          attack.kind,
          attack.kind === "launcher" ||
            (attack.weapon === "gauntlets" && attack.kind !== "light") ||
            attack.step === 2,
        );
      }
  }
  function update(s, h, dt) {
    const a = h.action;
    if (!a) return;
    a.t += dt;
    if (a.kind === "parry") {
      if (a.t >= F.parryWindow + 0.16) h.action = null;
      return;
    }
    if (a.kind === "dash") return;
    if (a.t >= a.start && a.t < a.start + a.active) {
      h.state = a.kind === "light" ? "attack-active" : a.kind;
      if (
        ["light", "heavy", "charged", "launcher", "dash-attack"].includes(
          a.kind,
        )
      )
        strike(s, h, a, a.hits);
      else if (!a.fired) {
        a.fired = true;
        const r = a.kind === "ultimate" ? 310 : 200;
        for (const e of s.enemies)
          if (e.hp > 0 && P.distance(h, e) < r) {
            damage(s, e, a.kind === "ultimate" ? 100 : 26, h, a.kind, true);
            if (a.kind === "special" && !e.boss) e.stun = 1.2;
          }
        if (a.kind === "special") s.slow = 1.5;
        s.events.push({
          type: a.kind === "ultimate" ? "afterstorm" : "zero-hour",
          ...P.center(h),
          r,
        });
        s.recordEvents.push({ kind: a.kind, id: a.id, weapon: a.weapon });
      }
    } else if (a.t >= a.start + a.active) h.state = "attack-recovery";
    if (a.t >= a.start + a.active + a.recovery) h.action = null;
  }
  function collapse(s) {
    const h = s.player;
    if (!s.echoes.length || h.special < 20) return false;
    h.special -= 20;
    for (const echo of s.echoes) {
      for (const e of s.enemies)
        if (e.hp > 0 && P.distance(echo, e) < 190)
          damage(s, e, 68, echo, "collapse", true);
      s.events.push({ type: "collapse", ...P.center(echo), r: 190 });
    }
    s.echoes = [];
    style(s, "collapse", 20);
    return true;
  }
  A.combat = {
    damage,
    hurt,
    style,
    box,
    begin,
    strike,
    update,
    collapse,
    source,
  };
})();
