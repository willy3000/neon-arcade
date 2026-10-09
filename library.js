/* Add released games here. Each entry links to its own playable page. */
(() => {
  "use strict";
  const games = [
    {
      title: "WILDFALL",
      href: "wildfall.html",
      genre: "ACTION PLATFORMER · BREAK THE SKY",
      description:
        "The sky broke and the world went up with it. Swing, wall-run and fight across drifting islands with three very different heroes.",
      controls: "KEYBOARD + MOUSE / CONTROLLER · CAMPAIGN + TRIAL",
      bestKey: "wildfall-save",
      art: "wildfall",
      caption: "GRAPPLE. JUMP. FIGHT. SURVIVE.",
      climb: true,
    },
    {
      title: "BLACKOUT PROTOCOL",
      href: "blackout-protocol.html",
      genre: "TACTICAL ACTION · OPENING MISSION",
      description:
        "Shot down. Cut off. Left for dead. Master slides, vaults and close-quarters combat in the occupied streets of Vesper City.",
      controls: "KEYBOARD + MOUSE · CAMPAIGN + TRAINING",
      bestKey: "blackout-protocol-progress",
      art: "blackout",
      caption: "THE MISSION IS OVER. YOUR WAR HAS JUST BEGUN.",
      campaign: true,
    },
    {
      title: "AFTERSTRIKE",
      href: "afterstrike.html",
      genre: "ACTION ROGUELITE · ECHOES OF WAR",
      description:
        "Your past strikes back. Reconstruct your last three seconds, fight beside your echo, and shape a new build through the Fallen City.",
      controls: "KEYBOARD / MOUSE / GAMEPAD / TOUCH",
      bestKey: "afterstrike-progress",
      art: "afterstrike",
      caption: "REMEMBER THE NEXT MOMENT.",
      run: true,
    },
    {
      title: "RIFTBREAKERS",
      href: "riftbreakers.html",
      genre: "CO-OP ACTION · 9 BREACHES",
      description:
        "Fire meets lightning. Master blade combos, swing across the ruins, and close the final breach with a friend or an AI partner.",
      controls: "SOLO + AI / TWO PLAYERS / TOUCH",
      bestKey: "riftbreakers-progress",
      art: "riftbreakers",
      caption: "MOVE FAST. HIT HARD. BREAK TOGETHER.",
      progress: true,
      levels: 9,
    },
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
    if (game.climb) {
      try {
        const chapter = JSON.parse(localStorage.getItem(game.bestKey))?.campaign?.chapter1;
        if (chapter?.best?.rank) return `THE FALLEN GATE / RANK ${String(chapter.best.rank).slice(0, 1)}`;
        if (chapter?.checkpoint) return "CHECKPOINT SAVED";
      } catch {}
      return "CHAPTER 1 · THE FALLEN GATE";
    }
    if (game.campaign) {
      try {
        const saved = JSON.parse(localStorage.getItem(game.bestKey));
        if (saved?.completed) return `THE CRASH / ${saved.best?.rating || "COMPLETE"}`;
        if (saved?.checkpoint) return `CHECKPOINT ${Math.min(4, Math.max(1, Number(saved.checkpoint.stage) + 1))} / 4`;
      } catch {}
      return "OPERATION BLACKOUT";
    }
    if (game.run) {
      try {
        const saved = JSON.parse(localStorage.getItem(game.bestKey));
        const time = saved?.best?.standard?.time;
        if (Number.isFinite(time) && time >= 0)
          return `${time.toFixed(1)}s BEST RUN`;
      } catch {}
      return "THE FALLEN CITY";
    }
    if (game.progress) {
      let stars = 0;
      try {
        const saved = JSON.parse(localStorage.getItem(game.bestKey));
        if (Array.isArray(saved))
          stars = saved
            .slice(0, game.levels || 12)
            .reduce(
              (sum, r) => sum + Math.max(0, Math.min(3, Number(r?.stars) || 0)),
              0,
            );
      } catch {}
      return `STARS ${stars} / ${(game.levels || 12) * 3}`;
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
