(() => {
  const g = Echo.game,
    canvas = document.getElementById("echo-world"),
    button = document.getElementById("echo-pulse");
  let aim = null,
    gesture = { active: false, start: 0, aim: null },
    pointerId = null;
  function cancel() {
    gesture.active = false;
    pointerId = null;
  }
  function begin(point = null, id = null) {
    if (g.state !== "playing" || gesture.active) return;
    Echo.audio.unlock();
    pointerId = id;
    gesture = { active: true, start: g.simulation.time, aim, point, drag: 0 };
  }
  function move(e) {
    if (!gesture.active || e.pointerId !== pointerId || !gesture.point) return;
    const point = Echo.renderer.worldPoint(e.clientX, e.clientY),
      dx = point.x - gesture.point.x,
      dy = point.y - gesture.point.y;
    gesture.drag = Math.hypot(dx, dy);
    gesture.aim = gesture.drag > 22 ? Math.atan2(dy, dx) : aim;
  }
  function release() {
    if (!gesture.active) return;
    const held = Math.min(1, (g.simulation.time - gesture.start) / 1.2),
      strength = Math.min(
        1.4,
        0.65 + Math.max(held, gesture.drag / 200) * 0.75,
      ),
      direction = gesture.aim;
    cancel();
    g.pulse(strength, direction);
  }
  function down(e) {
    if (e.button !== 0 || g.state !== "playing") return;
    e.preventDefault();
    const point =
      e.currentTarget === canvas
        ? Echo.renderer.worldPoint(e.clientX, e.clientY)
        : null;
    begin(point, e.pointerId);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  for (const element of [canvas, button]) {
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", (e) => {
      if (e.pointerId !== pointerId) return;
      move(e);
      release();
    });
    element.addEventListener("pointercancel", cancel);
    element.addEventListener("lostpointercapture", () => {
      if (gesture.active) cancel();
    });
  }
  button.onclick = (e) => {
    if (e.detail === 0 && !gesture.active) g.pulse(0.85, aim);
  };
  document.getElementById("echo-aim-mode").onclick = () => {
    aim = aim === null ? 0 : null;
    g.updateHUD();
  };
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (g.state === "playing") {
      const keys = [
        "1",
        "2",
        "3",
        " ",
        "f",
        "F",
        "r",
        "R",
        "p",
        "P",
        "Escape",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "c",
        "C",
      ];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      if (e.repeat) return;
      if (["1", "2", "3"].includes(e.key))
        g.setFrequency(["LOW", "MID", "HIGH"][Number(e.key) - 1]);
      else if (e.key === " ") begin();
      else if (["f", "F"].includes(e.key)) g.pulse(0.85, aim);
      else if (["r", "R"].includes(e.key)) {
        cancel();
        aim = null;
        g.restart();
      } else if (["p", "P", "Escape"].includes(e.key)) g.pause();
      else {
        if (["c", "C"].includes(e.key)) aim = null;
        else if (e.key === "ArrowUp") aim = -Math.PI / 2;
        else if (e.key === "ArrowDown") aim = Math.PI / 2;
        else
          aim = (aim ?? 0) + ((e.key === "ArrowLeft" ? -1 : 1) * Math.PI) / 12;
        if (gesture.active) gesture.aim = aim;
        g.updateHUD();
      }
    } else if (g.state === "paused" && ["p", "P", "Escape"].includes(e.key)) {
      e.preventDefault();
      g.pause();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === " " && gesture.active && pointerId === null) {
      e.preventDefault();
      release();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && g.state === "playing") g.pause();
  });
  window.addEventListener("blur", () => {
    if (g.state === "playing") g.pause();
  });
  window.addEventListener("resize", Echo.renderer.resize);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || document.getElementById("echo-overlay").hidden)
      return;
    const buttons = [
        ...document.querySelectorAll("#echo-overlay button"),
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
  Echo.input = {
    cancel,
    get gesture() {
      return gesture;
    },
    get aim() {
      return aim;
    },
    reset() {
      cancel();
      aim = null;
    },
  };
})();
