(() => {
  const B = Phasebound,
    $ = (id) => document.getElementById(id);
  let state = "menu",
    simulation = B.physics.create(B.levels[0]),
    last = 0,
    accumulator = 0,
    visual = 0,
    deathTimer = 0,
    noticeTimer = 0,
    hintIndex = -1;
  let mode = matchMedia("(pointer: coarse)").matches ? "solo" : "coop",
    selected = "kai";
  let records = Array.from({ length: 12 }, () => ({
    stars: 0,
    time: null,
    crystals: [],
  }));
  try {
    const settings = JSON.parse(localStorage.getItem("phasebound-settings"));
    if (["solo", "coop"].includes(settings?.mode)) mode = settings.mode;
    const saved = JSON.parse(localStorage.getItem("phasebound-progress"));
    if (Array.isArray(saved))
      records = records.map((r, i) => {
        const v = saved[i];
        return v && typeof v === "object"
          ? {
              stars: Math.floor(Math.max(0, Math.min(3, Number(v.stars) || 0))),
              time: Number.isFinite(v.time) && v.time >= 0 ? v.time : null,
              crystals: Array.isArray(v.crystals)
                ? [
                    ...new Set(
                      v.crystals.filter(
                        (n) =>
                          Number.isInteger(n) &&
                          n >= 0 &&
                          n < B.levels[i].crystals.length,
                      ),
                    ),
                  ]
                : [],
            }
          : r;
      });
  } catch {}
  const unlocked = (i) =>
      i >= 0 && i < 12 && (i === 0 || records[i - 1].stars > 0),
    totalStars = () => records.reduce((n, r) => n + r.stars, 0);
  function setState(next) {
    state = next;
    $("phase-menu").hidden = next !== "menu";
    $("phase-levels").hidden = next !== "levels";
    $("phase-how").hidden = next !== "how";
    $("phase-gameplay").hidden = ![
      "playing",
      "paused",
      "dying",
      "complete",
      "finished",
    ].includes(next);
    $("phase-overlay").hidden = !["paused", "complete", "finished"].includes(
      next,
    );
    if (next !== "playing") B.input?.clear();
  }
  function ui() {
    B.audio.unlock();
    B.audio.play("ui");
  }
  function notify(text) {
    $("phase-notice").textContent = text;
    $("phase-notice").classList.add("visible");
    noticeTimer = 2.1;
  }
  function setMode(next) {
    if (next === "solo" && mode !== next) {
      simulation.kai.vx = simulation.luma.vx = 0;
    }
    mode = next;
    B.input?.clear();
    try {
      localStorage.setItem("phasebound-settings", JSON.stringify({ mode }));
    } catch {}
    $("phase-mode").textContent =
      mode === "coop" ? "TWO PLAYERS" : "SOLO · " + selected.toUpperCase();
    $("phase-touch-controls").hidden = mode !== "solo";
    document.body.dataset.mode = mode;
    updateHUD();
  }
  function switchCharacter() {
    if (mode !== "solo") return;
    B.input?.clear();
    simulation[selected].vx = 0;
    selected = selected === "kai" ? "luma" : "kai";
    ui();
    updateHUD();
  }
  function start(index) {
    if (!unlocked(index)) return;
    B.audio.unlock();
    B.input?.clear();
    simulation = B.physics.create(B.levels[index]);
    accumulator = 0;
    visual = 0;
    hintIndex = -1;
    selected = "kai";
    B.renderer.reset();
    setState("playing");
    $("phase-room-number").textContent =
      `LEVEL ${String(index + 1).padStart(2, "0")} / 12 · ${simulation.level.chapter}`;
    $("phase-room-name").textContent = simulation.level.name;
    $("phase-targets").textContent =
      `★ ≤${simulation.level.time}s · no falls · collect every crystal`;
    $("phase-hint-text").hidden = true;
    $("phase-hint").textContent = "HINT 0 / 3";
    $("phase-notice").classList.remove("visible");
    setMode(mode);
    B.renderer.resize();
    $("phase-world").focus({ preventScroll: true });
  }
  function menu() {
    setState("menu");
    $("phase-progress").textContent =
      `${records.filter((r) => r.stars > 0).length} / 12 LEVELS CLEARED · ${totalStars()} / 36 STARS`;
    $("phase-play-coop").focus();
  }
  function select() {
    ui();
    setState("levels");
    const grid = $("phase-level-grid");
    grid.replaceChildren();
    for (let chapter = 0; chapter < 3; chapter++) {
      const section = document.createElement("section"),
        heading = document.createElement("h3"),
        cards = document.createElement("div");
      section.className = "chapter";
      heading.textContent = `0${chapter + 1} / ${B.levels[chapter * 4].chapter}`;
      cards.className = "chapter-grid";
      for (let i = chapter * 4; i < chapter * 4 + 4; i++) {
        const l = B.levels[i],
          b = document.createElement("button");
        b.disabled = !unlocked(i);
        b.className = "level-card";
        b.style.setProperty("--i", i);
        const number = document.createElement("span"),
          title = document.createElement("strong"),
          stars = document.createElement("span"),
          detail = document.createElement("small");
        number.className = "level-number";
        number.textContent = String(i + 1).padStart(2, "0");
        title.textContent = l.name;
        stars.className = "level-stars";
        stars.textContent = b.disabled
          ? "LOCKED"
          : "★".repeat(records[i].stars) + "☆".repeat(3 - records[i].stars);
        detail.textContent =
          records[i].time === null
            ? "TWO SPARKS REQUIRED"
            : `${records[i].time.toFixed(1)}s BEST · ${records[i].crystals.length}/${l.crystals.length} CRYSTALS`;
        b.append(number, title, stars, detail);
        b.onclick = () => start(i);
        cards.append(b);
      }
      section.append(heading, cards);
      grid.append(section);
    }
    $("phase-levels-back").focus();
  }
  function updateHUD() {
    const s = simulation;
    $("phase-time").textContent = s.time.toFixed(1) + "s";
    $("phase-crystals").textContent =
      `◇ ${s.collected.size} / ${s.level.crystals.length}`;
    $("phase-kai-status").textContent = s.kai.docked
      ? "KAI · HOME ✓"
      : mode === "solo" && selected === "kai"
        ? "KAI · SELECTED"
        : "KAI · A D W S";
    $("phase-luma-status").textContent = s.luma.docked
      ? "LUMA · HOME ✓"
      : mode === "solo" && selected === "luma"
        ? "LUMA · SELECTED"
        : "LUMA · ARROWS";
    $("phase-link-status").textContent = s.tether
      ? "LINK ACTIVE · STAY CLOSE"
      : "";
    $("phase-switch").firstElementChild.textContent = selected.toUpperCase();
    $("phase-switch").dataset.character = selected;
    $("phase-mode").textContent =
      mode === "coop" ? "TWO PLAYERS" : "SOLO · " + selected.toUpperCase();
  }
  function modal(label, title, description, button, action) {
    $("phase-modal-label").textContent = label;
    $("phase-modal-title").textContent = title;
    $("phase-modal-description").textContent = description;
    $("phase-modal-primary").textContent = button;
    $("phase-modal-primary").onclick = action;
    $("phase-modal-primary").focus();
  }
  function pause() {
    if (state === "playing") {
      setState("paused");
      $("phase-modal-stars").textContent = "";
      $("phase-modal-stats").textContent = "";
      $("phase-modal-retry").hidden = true;
      modal(
        "TAKE A BREATHER",
        "ON HOLD.",
        "Both worlds, every bridge timer, and the ferry are waiting for you.",
        "RESUME JOURNEY ↗",
        pause,
      );
    } else if (state === "paused") {
      setState("playing");
      B.audio.unlock();
      accumulator = 0;
    }
  }
  function complete() {
    const s = simulation,
      l = s.level,
      stars =
        1 +
        (s.collected.size === l.crystals.length ? 1 : 0) +
        (s.time <= l.time && s.deaths === 0 ? 1 : 0),
      r = records[l.id];
    r.stars = Math.max(r.stars, stars);
    r.time = r.time === null ? s.time : Math.min(r.time, s.time);
    r.crystals = [...new Set([...r.crystals, ...s.collected])];
    try {
      localStorage.setItem("phasebound-progress", JSON.stringify(records));
    } catch {}
    setState("complete");
    $("phase-modal-stars").textContent =
      "★".repeat(stars) + "☆".repeat(3 - stars);
    $("phase-modal-stats").textContent =
      `${s.time.toFixed(1)}s · ${s.collected.size}/${l.crystals.length} crystals · ${s.deaths} falls · best ${r.time.toFixed(1)}s`;
    $("phase-modal-retry").hidden = false;
    modal(
      l.id % 4 === 3 ? "CHAPTER COMPLETE" : "BOTH SPARKS HOME",
      l.name.toUpperCase(),
      stars === 3
        ? "Perfectly in step. A path only you could make together."
        : "One for reaching home. One for crystals. One for a quick, flawless crossing.",
      l.id === 11
        ? "CELEBRATE THE JOURNEY ↗"
        : l.id % 4 === 3
          ? "NEXT CHAPTER ↗"
          : "NEXT LEVEL ↗",
      () => (l.id === 11 ? finish() : start(l.id + 1)),
    );
  }
  function finish() {
    setState("finished");
    $("phase-modal-stars").textContent = "✦";
    $("phase-modal-stats").textContent =
      `12 levels completed · ${totalStars()} / 36 stars`;
    $("phase-modal-retry").hidden = true;
    modal(
      "THE CONVERGENCE COMPLETE",
      "TWO WORLDS. ONE HOME.",
      "Kai and Luma found their way through the fracture. Return to any ruin and chase a perfect journey.",
      "RETURN TO THE RUINS ↗",
      select,
    );
  }
  function restart() {
    if (["playing", "paused", "dying", "complete"].includes(state))
      start(simulation.level.id);
  }
  function event(e) {
    if (e.type !== "foot") B.audio.play(e.type, e.who);
    const color =
      e.who === "kai" ? "#ffbc79" : e.who === "luma" ? "#79f4ef" : "#b7a0ff";
    B.renderer.burst(
      e.x,
      e.y,
      color,
      e.type === "foot" ? 3 : e.type === "win" ? 35 : 12,
    );
    if (e.type === "switch") notify("SPIRIT RELAY ACTIVE");
    else if (e.type === "brace")
      notify(
        "STONE " +
          (simulation.blocks.find((b) => Math.abs(b.x - e.x) < 1)?.anchored
            ? "BRACED"
            : "RELEASED"),
      );
    else if (e.type === "link") notify("TETHER LINKED · STAY TOGETHER");
    else if (e.type === "unlink") notify("TETHER RELEASED");
    else if (e.type === "checkpoint") notify("CHECKPOINT · BOTH SPARKS SAFE");
    else if (e.type === "portal")
      notify(e.who.toUpperCase() + " IS HOME · BRING THE OTHER SPARK");
    else if (e.type === "win") complete();
    else if (e.type === "death") {
      setState("dying");
      B.renderer.impact();
      deathTimer = 0.4;
      notify(
        "RETURNING TO " +
          (simulation.checkpointIndex < 0 ? "THE START" : "CHECKPOINT"),
      );
    }
  }
  function frame(now) {
    const dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    if (state === "playing" || state === "dying") {
      visual += dt;
      B.renderer.update(dt);
      if (noticeTimer > 0 && (noticeTimer -= dt) <= 0)
        $("phase-notice").classList.remove("visible");
      if (state === "dying") {
        deathTimer -= dt;
        if (deathTimer <= 0) {
          B.physics.respawn(simulation);
          setState("playing");
          accumulator = 0;
        }
      } else {
        accumulator += dt;
        while (accumulator >= B.physics.DT && state === "playing") {
          B.physics.step(simulation, B.input?.sample() || {});
          accumulator -= B.physics.DT;
          for (const e of simulation.events) event(e);
        }
        B.audio.update(simulation.time);
        updateHUD();
      }
    }
    if (!$("phase-gameplay").hidden)
      B.renderer.draw(simulation, visual, mode === "solo" ? selected : null);
    requestAnimationFrame(frame);
  }
  function play() {
    const next = records.findIndex((r) => r.stars === 0);
    start(next < 0 ? 0 : next);
  }
  $("phase-play-coop").onclick = () => {
    ui();
    setMode("coop");
    play();
  };
  $("phase-play-solo").onclick = () => {
    ui();
    setMode("solo");
    play();
  };
  $("phase-select").onclick = select;
  $("phase-levels-back").onclick = menu;
  $("phase-instructions").onclick = () => {
    ui();
    setState("how");
    $("phase-how-back").focus();
  };
  $("phase-how-back").onclick = menu;
  $("phase-how-play").onclick = play;
  $("phase-modal-levels").onclick = select;
  $("phase-modal-retry").onclick = () => start(simulation.level.id);
  $("phase-restart").onclick = restart;
  $("phase-pause").onclick = pause;
  $("phase-mode").onclick = () => {
    ui();
    setMode(mode === "coop" ? "solo" : "coop");
  };
  $("phase-switch").onclick = switchCharacter;
  $("phase-hint").onclick = () => {
    hintIndex = Math.min(hintIndex + 1, 2);
    $("phase-hint-text").hidden = false;
    $("phase-hint-text").textContent = simulation.level.hints[hintIndex];
    $("phase-hint").textContent = `HINT ${hintIndex + 1} / 3`;
  };
  function syncAudio() {
    $("phase-mute").textContent = B.audio.muted ? "♪̸" : "♫";
    $("phase-mute").setAttribute("aria-pressed", String(B.audio.muted));
    $("phase-mute").setAttribute(
      "aria-label",
      B.audio.muted ? "Unmute sound" : "Mute sound",
    );
    $("phase-music").setAttribute("aria-pressed", String(B.audio.music));
    $("phase-music").setAttribute(
      "aria-label",
      B.audio.music ? "Disable ambient music" : "Enable ambient music",
    );
  }
  $("phase-mute").onclick = () => {
    B.audio.unlock();
    B.audio.mute();
    syncAudio();
  };
  $("phase-music").onclick = () => {
    B.audio.unlock();
    B.audio.toggleMusic();
    syncAudio();
  };
  B.game = {
    start,
    select,
    menu,
    pause,
    restart,
    setMode,
    switchCharacter,
    get state() {
      return state;
    },
    get simulation() {
      return simulation;
    },
    get mode() {
      return mode;
    },
    get selected() {
      return selected;
    },
  };
  setMode(mode);
  syncAudio();
  menu();
  requestAnimationFrame(frame);
})();
