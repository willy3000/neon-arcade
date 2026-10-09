/* Reconciled immutable pose tracks with independent live-world attack participants. */
(() => {
  const A = Afterstrike,
    P = A.physics,
    C = A.combat,
    F = A.GAME_FEEL,
    CAP = 480;
  function init() {
    return { frames: Array(CAP), head: 0, count: 0 };
  }
  function record(s) {
    const h = s.player,
      a = h.action,
      active = a && a.t >= a.start && a.t < a.start + a.active;
    const frame = Object.freeze({
      x: h.x,
      y: h.y,
      w: h.w,
      h: h.h,
      vx: h.vx,
      vy: h.vy,
      facing: h.facing,
      state: h.state,
      weapon: h.weapon,
      grounded: h.grounded,
      jumps: h.jumps,
      phase: h.phase,
      action: a
        ? Object.freeze({
            kind: a.kind,
            t: a.t,
            start: a.start,
            active: a.active,
            recovery: a.recovery,
            step: a.step,
            weapon: a.weapon,
            id: a.id,
            charge: a.charge,
          })
        : null,
      attack:
        active &&
        ["light", "heavy", "charged", "launcher", "dash-attack"].includes(
          a.kind,
        ),
      defense:
        a &&
        ((a.kind === "parry" && a.t < F.parryWindow) ||
          (a.kind === "dash" && a.t > 0.02 && a.t < 0.15)),
      events: Object.freeze(s.recordEvents.map((e) => Object.freeze({ ...e }))),
      interaction: !!s.playerOnRelay,
    });
    const history = s.history;
    history.frames[history.head] = frame;
    history.head = (history.head + 1) % CAP;
    history.count = Math.min(CAP, history.count + 1);
  }
  function summon(s) {
    const h = s.player;
    if (s.echoCooldown > 0 || h.energy < F.echoCost || s.history.count < 48) {
      s.events.push({
        type: "notice",
        text:
          s.echoCooldown > 0
            ? "ECHO RECONSTRUCTING"
            : h.energy < F.echoCost
              ? "ECHO ENERGY RECHARGING"
              : "MAKE A MOMENT TO REPLAY",
      });
      return false;
    }
    const count = Math.min(
        s.history.count,
        (s.build.has("exposure") ? 4 : F.echoSeconds) / F.dt,
      ),
      track = [];
    for (let i = count; i > 0; i--)
      track.push(s.history.frames[(s.history.head - i + CAP) % CAP]);
    h.energy -= F.echoCost;
    s.echoCooldown = F.echoCooldown;
    s.echoes.push({
      ...track[0],
      who: "echo",
      id: "echo" + s.serial++,
      echo: true,
      index: 0,
      track: Object.freeze(track),
      attackHits: new Map(),
      abilityHits: new Set(),
      integrity: 3,
      hp: 100,
      fade: 1,
      anchor: null,
    });
    if (s.echoes.length > F.maxEchoes) s.echoes.shift();
    h.summon = 0.2;
    s.events.push({
      type: "echo",
      ...P.center(h),
      text: "ECHO SHIFT · YOUR PAST IS FIGHTING",
    });
    return true;
  }
  function playback(s) {
    for (const echo of s.echoes) {
      if (echo.index >= echo.track.length || echo.integrity <= 0) continue;
      const frame = echo.track[echo.index++];
      Object.assign(echo, frame);
      echo.fade = Math.min(1, (echo.track.length - echo.index) / 25);
      if (frame.attack) {
        const attack = frame.action;
        if (!echo.attackHits.has(attack.id))
          echo.attackHits.set(attack.id, new Set());
        C.strike(s, echo, attack, echo.attackHits.get(attack.id));
      }
      for (const event of frame.events)
        if (!echo.abilityHits.has(event.id)) {
          echo.abilityHits.add(event.id);
          for (const enemy of s.enemies)
            if (enemy.hp > 0 && P.distance(echo, enemy) < 180)
              C.damage(
                s,
                enemy,
                event.kind === "ultimate" ? 55 : 20,
                echo,
                "echo-ability",
                true,
              );
          s.events.push({ type: "echo-burst", ...P.center(echo), r: 150 });
        }
      if (frame.defense) {
        for (const p of s.projectiles)
          if (
            p.life > 0 &&
            P.overlap(
              { x: echo.x - 10, y: echo.y - 5, w: echo.w + 20, h: echo.h + 10 },
              p,
            )
          ) {
            p.life = 0;
            s.intercepts++;
            C.style(s, "intercept", 20);
            s.events.push({
              type: "intercept",
              ...P.center(echo),
              text: "ECHO INTERCEPT",
            });
          }
      }
    }
    s.echoes = s.echoes.filter(
      (e) => e.index < e.track.length && e.integrity > 0,
    );
  }
  function clear(s) {
    s.history = init();
    s.echoes = [];
    s.echoCooldown = 0;
  }
  A.echo = { init, record, summon, playback, clear, CAP };
})();
