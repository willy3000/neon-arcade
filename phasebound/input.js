/* Action source: replace sample() with network packets for future peer-to-peer play. */
(() => {
  const g = Phasebound.game,
    held = new Set(),
    pressed = new Set(),
    touch = new Map();
  function clear() {
    held.clear();
    pressed.clear();
    touch.clear();
  }
  const key = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const controlKeys = [
    "a",
    "d",
    "w",
    "s",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
  ];
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    const k = key(e);
    if (!["playing", "paused", "dying"].includes(g.state)) return;
    if ([...controlKeys, "r", "Escape", "x"].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === "Escape") {
      g.pause();
      return;
    }
    if (k === "r") {
      g.restart();
      return;
    }
    if (k === "x") {
      g.switchCharacter();
      return;
    }
    if (g.state === "playing" && controlKeys.includes(k)) {
      if (!held.has(k)) pressed.add(k);
      held.add(k);
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = key(e);
    if (controlKeys.includes(k) && g.state === "playing") e.preventDefault();
    held.delete(k);
  });
  function map(actions, keys) {
    return {
      left: keys.left.some((k) => held.has(k)),
      right: keys.right.some((k) => held.has(k)),
      jump: keys.jump.some((k) => held.has(k)),
      jumpPressed: keys.jump.some((k) => pressed.has(k)),
      interact: keys.interact.some((k) => pressed.has(k)),
      ...actions,
    };
  }
  function sample() {
    let kai = {},
      luma = {};
    if (g.mode === "coop") {
      kai = map(
        {},
        { left: ["a"], right: ["d"], jump: ["w"], interact: ["s"] },
      );
      luma = map(
        {},
        {
          left: ["ArrowLeft"],
          right: ["ArrowRight"],
          jump: ["ArrowUp"],
          interact: ["ArrowDown"],
        },
      );
    } else {
      const values = [...touch.values()];
      const actions = map(
        {},
        {
          left: ["a", "ArrowLeft"],
          right: ["d", "ArrowRight"],
          jump: ["w", "ArrowUp"],
          interact: ["s", "ArrowDown"],
        },
      );
      for (const name of ["left", "right", "jump"])
        actions[name] ||= values.includes(name);
      actions.jumpPressed ||= pressed.has("touch-jump");
      actions.interact ||= pressed.has("touch-interact");
      if (g.selected === "kai") kai = actions;
      else luma = actions;
    }
    pressed.clear();
    return { kai, luma };
  }
  for (const action of ["left", "right", "jump", "interact"]) {
    const button = document.getElementById("phase-touch-" + action);
    button.addEventListener("pointerdown", (e) => {
      if (g.state !== "playing" || g.mode !== "solo") return;
      e.preventDefault();
      if (e.button !== 0) return;
      touch.set(e.pointerId, action);
      pressed.add("touch-" + action);
      button.setPointerCapture(e.pointerId);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(name, (e) => {
        touch.delete(e.pointerId);
      });
    button.onclick = (e) => {
      if (e.detail !== 0 || g.mode !== "solo") return;
      if (action === "jump" || action === "interact")
        pressed.add("touch-" + action);
    };
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && g.state === "playing") g.pause();
  });
  window.addEventListener("blur", () => {
    if (g.state === "playing") g.pause();
    clear();
  });
  window.addEventListener("resize", Phasebound.renderer.resize);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || document.getElementById("phase-overlay").hidden)
      return;
    const buttons = [
        ...document.querySelectorAll("#phase-overlay button"),
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
  Phasebound.input = { sample, clear };
})();
