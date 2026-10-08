/* Add released games here. Each entry links to its own playable page. */
(() => {
  "use strict";
  const games = [
    {
      title: "PHASEBOUND",
      href: "phasebound.html",
      genre: "CO-OP PLATFORM PUZZLE · 12 RUINS",
      description:
        "Two sparks in overlapping worlds. Guide Kai and Luma through ancient machinery, reveal hidden bridges, and find a way home together.",
      controls: "WASD + ARROWS · SOLO SWITCH · TOUCH",
      bestKey: "phasebound-progress",
      art: "phasebound",
      caption: "TWO WORLDS. ONE WAY HOME.",
      progress: true,
    },
    {
      title: "NEON RUSH",
      href: "neon-rush.html",
      genre: "ENDLESS ARCADE · SURVIVAL",
      description:
        "Dodge the red. Chase the gold. Collect power-ups, blast your way through, and see how long you can keep the rush alive.",
      controls: "MOUSE / TOUCH / KEYBOARD",
      bestKey: "neon-rush-best",
      art: "neon-rush",
      caption: "FIND YOUR FLOW. DODGE THE CHAOS.",
    },
    {
      title: "GRAVITY HEIST",
      href: "gravity-heist.html",
      genre: "PHYSICS PUZZLE · 12 ROOMS",
      description:
        "A tiny robot. An orbital facility. Rotate gravity, keep your momentum, steal the core, and engineer your escape.",
      controls: "Q / E · ARROW KEYS · TOUCH",
      bestKey: "gravity-heist-progress",
      art: "gravity-heist",
      caption: "BEND GRAVITY. BREAK INTO ORBIT.",
      progress: true,
    },
    {
      title: "ECHO FORGE",
      href: "echo-forge.html",
      genre: "SOUNDWAVE PUZZLE · 12 CHAMBERS",
      description:
        "Shape the silence. Charge a pulse, bend a reflected echo, and set off a chain of resonance to guide the crystal home.",
      controls: "CLICK / TOUCH · HOLD · DRAG TO AIM",
      bestKey: "echo-forge-progress",
      art: "echo-forge",
      caption: "LISTEN. AIM. RESONATE.",
      progress: true,
    },
  ];
  const list = document.getElementById("game-list"),
    template = document.getElementById("game-card-template");
  document.getElementById("game-count").textContent = String(
    games.length,
  ).padStart(2, "0");
  function bestLabel(game) {
    if (game.progress) {
      let stars = 0;
      try {
        const saved = JSON.parse(localStorage.getItem(game.bestKey));
        if (Array.isArray(saved))
          stars = saved
            .slice(0, 12)
            .reduce(
              (sum, r) => sum + Math.max(0, Math.min(3, Number(r?.stars) || 0)),
              0,
            );
      } catch {}
      return `STARS ${stars} / 36`;
    }
    let best = 0;
    try {
      best = Math.max(0, Number(localStorage.getItem(game.bestKey)) || 0);
    } catch {}
    return `YOUR BEST ${Math.floor(best).toString().padStart(6, "0")}`;
  }
  for (const [index, game] of games.entries()) {
    const card = template.content.cloneNode(true),
      link = card.querySelector(".game-link");
    link.href = game.href;
    link.setAttribute("aria-label", `Play ${game.title}`);
    card.querySelector(".game-art").classList.add(game.art);
    card.querySelector(".art-id").textContent =
      `ARCADE / ${String(index + 1).padStart(3, "0")}`;
    card.querySelector(".art-title").textContent = game.title;
    card.querySelector(".art-caption").textContent = game.caption;
    card.querySelector(".game-title").textContent = game.title;
    card.querySelector(".game-genre").textContent = game.genre;
    card.querySelector(".game-description").textContent = game.description;
    card.querySelector(".game-controls").textContent = game.controls;
    card.querySelector(".game-best").textContent = bestLabel(game);
    list.append(card);
  }
  // Back/forward navigation can restore a cached page after a new record.
  window.addEventListener("pageshow", () =>
    list.querySelectorAll(".game-best").forEach((label, index) => {
      label.textContent = bestLabel(games[index]);
    }),
  );
})();
