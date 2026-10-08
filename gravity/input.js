(() => {
  const g = Heist.game;
  document.getElementById("rotate-left").onclick = () => g.rotate(-1);
  document.getElementById("rotate-right").onclick = () => g.rotate(1);
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (
      [
        "q",
        "Q",
        "e",
        "E",
        "ArrowLeft",
        "ArrowRight",
        "r",
        "R",
        " ",
        "Escape",
      ].includes(e.key)
    ) {
      if (
        e.key === " " &&
        e.target.tagName === "BUTTON" &&
        g.state !== "playing" &&
        g.state !== "paused"
      )
        return;
      e.preventDefault();
      if (e.repeat) return;
      if (["q", "Q", "ArrowLeft"].includes(e.key)) g.rotate(-1);
      else if (["e", "E", "ArrowRight"].includes(e.key)) g.rotate(1);
      else if (["r", "R"].includes(e.key)) g.restart();
      else g.pause();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && g.state === "playing") g.pause();
  });
  window.addEventListener("blur", () => {
    if (g.state === "playing") g.pause();
  });
  window.addEventListener("resize", Heist.renderer.resize);
  // Keep keyboard focus inside the open modal; Escape / Space resumes pause.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || document.getElementById("overlay").hidden) return;
    const buttons = [...document.querySelectorAll("#overlay button")].filter(
      (b) => !b.hidden,
    );
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
})();
