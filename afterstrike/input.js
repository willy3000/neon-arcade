(() => {
  const A = Afterstrike,
    g = A.game,
    held = new Set(),
    pressed = new Set(),
    touch = new Map(),
    padEdges = new Set();
  let padHeld = {},
    previousPad = [];
  const keys = [
    "a",
    "d",
    "w",
    "s",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    " ",
    "Shift",
    "j",
    "k",
    "f",
    "e",
    "q",
    "c",
    "h",
    "l",
    "u",
    "1",
    "2",
    "3",
  ];
  const normalize = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  function cancelHeavy() {
    const h = g.simulation.player;
    h.chargeHeld = false;
    h.charge = 0;
  }
  function clear() {
    held.clear();
    pressed.clear();
    touch.clear();
    padEdges.clear();
    cancelHeavy();
  }
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    const k = normalize(e);
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
    if (keys.includes(k)) {
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
    if (keys.includes(k) && g.state === "playing") e.preventDefault();
  });
  function pollGamepad() {
    let pad;
    try {
      pad = Array.from(navigator.getGamepads?.() || []).find(
        (p) => p && p.mapping === "standard",
      );
    } catch {}
    if (!pad) {
      padHeld = {};
      previousPad = [];
      return;
    }
    const buttons = pad.buttons.map((b) => b.pressed || b.value > 0.5),
      edge = (i) => buttons[i] && !previousPad[i];
    if (edge(9) && ["playing", "paused"].includes(g.state)) g.pause();
    if (g.state === "playing") {
      padHeld = {
        left: pad.axes[0] < -0.25,
        right: pad.axes[0] > 0.25,
        up: pad.axes[1] < -0.5,
        down: pad.axes[1] > 0.5,
        jump: buttons[0],
        heavyHeld: buttons[3],
      };
      for (const [id, name] of [
        [0, "jumpPressed"],
        [1, "dash"],
        [2, "light"],
        [4, "parry"],
        [5, "echo"],
        [6, "anchor"],
        [7, "special"],
        [11, "ultimate"],
        [13, "heal"],
        [14, "nextWeapon"],
        [15, "collapse"],
      ])
        if (edge(id)) padEdges.add(name);
    }
    previousPad = buttons;
  }
  function sample() {
    if (g.simulation.hitstop > 0) return {};
    const values = [...touch.values()],
      is = (...k) => k.some((k) => held.has(k)),
      edge = (...k) => k.some((k) => pressed.has(k));
    const a = {
      left: is("a", "ArrowLeft") || values.includes("left"),
      right: is("d", "ArrowRight") || values.includes("right"),
      up: is("w", "ArrowUp"),
      down: is("s", "ArrowDown"),
      jump: is(" ", "w", "ArrowUp") || values.includes("jump"),
      jumpPressed: edge(" ", "w", "ArrowUp") || pressed.has("touch-jump"),
      dash: edge("Shift"),
      light: edge("j") || pressed.has("mouse-light"),
      heavyHeld:
        is("k") || values.includes("heavy") || values.includes("mouse-heavy"),
      parry: edge("f"),
      echo: edge("e"),
      anchor: edge("q"),
      collapse: edge("c"),
      heal: edge("h"),
      special: edge("l"),
      ultimate: edge("u"),
    };
    for (const name of [
      "light",
      "dash",
      "parry",
      "echo",
      "anchor",
      "collapse",
      "heal",
      "special",
      "ultimate",
    ])
      a[name] ||= pressed.has("touch-" + name);
    for (const [name, value] of Object.entries(padHeld)) a[name] ||= value;
    for (const name of padEdges) a[name] = true;
    if (a.light && a.up) a.launcher = true;
    for (const [k, weapon] of [
      ["1", "blade"],
      ["2", "gauntlets"],
      ["3", "chain"],
    ])
      if (pressed.has(k)) a.weapon = weapon;
    if (a.nextWeapon || pressed.has("touch-nextWeapon")) {
      const all = g.simulation.unlockedWeapons,
        current = all.indexOf(g.simulation.player.weapon);
      a.weapon = all[(current + 1) % all.length];
    }
    pressed.clear();
    padEdges.clear();
    return a;
  }
  for (const b of document.querySelectorAll("[data-action]")) {
    const action = b.dataset.action;
    b.addEventListener("pointerdown", (e) => {
      if (g.state !== "playing" || e.button !== 0) return;
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      touch.set(e.pointerId, action);
      pressed.add("touch-" + action);
      A.audio.unlock();
    });
    for (const n of ["pointerup", "pointercancel", "lostpointercapture"])
      b.addEventListener(n, (e) => {
        if (n === "pointercancel" && action === "heavy") cancelHeavy();
        touch.delete(e.pointerId);
      });
    b.addEventListener("click", (e) => {
      if (e.detail === 0 && g.state === "playing") {
        if (action === "heavy")
          g.simulation.player.buffer = {
            kind: "heavy",
            t: A.GAME_FEEL.attackBuffer,
            charge: 0,
          };
        else pressed.add("touch-" + action);
      }
    });
  }
  const canvas = document.getElementById("after-world");
  canvas.addEventListener("pointerdown", (e) => {
    if (g.state !== "playing") return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 0) pressed.add("mouse-light");
    else if (e.button === 2) touch.set(e.pointerId, "mouse-heavy");
    A.audio.unlock();
  });
  for (const n of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(n, (e) => {
      if (n === "pointercancel" && touch.get(e.pointerId) === "mouse-heavy")
        cancelHeavy();
      touch.delete(e.pointerId);
    });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && g.state === "playing") g.pause();
  });
  window.addEventListener("blur", () => {
    if (g.state === "playing") g.pause();
    clear();
  });
  window.addEventListener("resize", A.renderer.resize);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || document.getElementById("after-overlay").hidden)
      return;
    const visible = [
        ...document.querySelectorAll("#after-overlay button"),
      ].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length),
      first = visible[0],
      last = visible[visible.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  });
  A.input = { sample, clear, pollGamepad };
})();
