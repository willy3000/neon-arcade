/* Input edges are sampled once. AI and human controllers share the same packet format. */
(() => {
  const held = new Set(),
    pressed = new Set(),
    touch = new Map(),
    g = Rift.game,
    cfg = Rift.save.settings;
  const normalize = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  function clear() {
    held.clear();
    pressed.clear();
    touch.clear();
  }
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    const k = normalize(e);
    if (g.bindKey(k)) {
      e.preventDefault();
      return;
    }
    if (!["playing", "paused"].includes(g.state)) return;
    if (k === "Escape") {
      e.preventDefault();
      if (!e.repeat) g.pause();
      return;
    }
    if (k === "r") {
      e.preventDefault();
      if (!e.repeat) g.restart();
      return;
    }
    if (k === "x") {
      e.preventDefault();
      if (!e.repeat) g.switchHero();
      return;
    }
    if (Object.values(cfg.bindings).some((b) => Object.values(b).includes(k))) {
      e.preventDefault();
      if (g.state === "playing" && !e.repeat) {
        if (!held.has(k)) pressed.add(k);
        held.add(k);
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = normalize(e);
    held.delete(k);
    if (
      Object.values(cfg.bindings).some((b) => Object.values(b).includes(k)) &&
      g.state === "playing"
    )
      e.preventDefault();
  });
  function map(who) {
    const keys = cfg.bindings[who],
      a = {};
    for (const [name, key] of Object.entries(keys))
      if (name === "left" || name === "right") a[name] = held.has(key);
      else if (name === "jump") {
        a.jump = held.has(key);
        a.up = a.jump;
        a.jumpPressed = pressed.has(key);
      } else a[name] = pressed.has(key);
    return a;
  }
  function sample() {
    // Preserve input edges during hit stop, so an impact cannot swallow a combo tap.
    if (g.simulation.hitstop > 0) return {};
    const packets = { blaze: {}, volt: {} };
    if (g.simulation.mode === "coop") {
      packets.blaze = map("blaze");
      packets.volt = map("volt");
    } else {
      const who = g.simulation.selected,
        a = map(who);
      for (const name of ["left", "right", "jump"])
        a[name] ||= [...touch.values()].includes(name);
      a.up = a.jump;
      for (const name of [
        "light",
        "heavy",
        "dash",
        "special",
        "ultimate",
        "grapple",
        "fusion",
      ])
        a[name] ||= pressed.has("touch-" + name);
      a.jumpPressed ||= pressed.has("touch-jump");
      packets[who] = a;
      if (a.light || a.heavy || a.special) {
        const hero = g.simulation.heroes.find((h) => h.who === who),
          foe = g.simulation.enemies
            .filter((e) => e.hp > 0 && Rift.physics.dist(hero, e) < 180)
            .sort(
              (a, b) => Rift.physics.dist(hero, a) - Rift.physics.dist(hero, b),
            )[0];
        if (foe && !a.left && !a.right) hero.facing = foe.x > hero.x ? 1 : -1;
      }
    }
    pressed.clear();
    return packets;
  }
  for (const b of document.querySelectorAll("#rift-touch [data-action]")) {
    const action = b.dataset.action;
    b.addEventListener("pointerdown", (e) => {
      if (
        g.state !== "playing" ||
        g.simulation.mode !== "solo" ||
        e.button !== 0
      )
        return;
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      touch.set(e.pointerId, action);
      pressed.add("touch-" + action);
      Rift.audio.unlock();
    });
    for (const n of ["pointerup", "pointercancel", "lostpointercapture"])
      b.addEventListener(n, (e) => touch.delete(e.pointerId));
    b.addEventListener("click", (e) => {
      if (
        e.detail === 0 &&
        g.state === "playing" &&
        g.simulation.mode === "solo"
      )
        pressed.add("touch-" + action);
    });
  }
  window.addEventListener("blur", () => {
    if (g.state === "playing") g.pause();
    clear();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && g.state === "playing") g.pause();
  });
  window.addEventListener("resize", Rift.renderer.resize);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || document.getElementById("rift-overlay").hidden)
      return;
    const buttons = [
        ...document.querySelectorAll("#rift-overlay button"),
      ].filter((b) => !b.hidden),
      first = buttons[0],
      last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  Rift.input = { sample, clear };
})();
