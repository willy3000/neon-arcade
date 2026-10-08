(() => {
  const H = Heist,
    $ = (id) => document.getElementById(id);
  let state = "menu",
    simulation = H.physics.create(H.levels[0]),
    last = 0,
    accumulator = 0,
    visual = 0,
    deathTimer = 0,
    noticeTimer = 0;
  let records = Array.from({ length: 12 }, () => ({
    stars: 0,
    time: null,
    rotations: null,
  }));
  try {
    const saved = JSON.parse(localStorage.getItem("gravity-heist-progress"));
    if (Array.isArray(saved))
      records = records.map((r, i) => {
        const v = saved[i];
        return v && typeof v === "object"
          ? {
              stars: Math.max(0, Math.min(3, Number(v.stars) || 0)),
              time: Number.isFinite(v.time) ? v.time : null,
              rotations: Number.isFinite(v.rotations) ? v.rotations : null,
            }
          : r;
      });
  } catch {}
  const unlocked = (index) => index === 0 || records[index - 1].stars > 0;
  const totalStars = () => records.reduce((n, r) => n + r.stars, 0);
  const setState = (next) => {
    state = next;
    $("menu").hidden = next !== "menu";
    $("levels").hidden = next !== "levels";
    $("gameplay").hidden = ![
      "playing",
      "paused",
      "dying",
      "complete",
      "finished",
    ].includes(next);
    $("overlay").hidden = !["paused", "complete", "finished"].includes(next);
  };
  function uiSound() {
    H.audio.unlock();
    H.audio.play("ui");
  }
  function notify(text) {
    $("notice").textContent = text;
    $("notice").classList.add("visible");
    noticeTimer = 2;
  }
  function start(index) {
    if (!unlocked(index)) return;
    H.audio.unlock();
    simulation = H.physics.create(H.levels[index]);
    accumulator = 0;
    deathTimer = 0;
    H.renderer.reset();
    setState("playing");
    $("room-number").textContent =
      `ROOM ${String(index + 1).padStart(2, "0")} / 12 · ${simulation.level.chapter}`;
    $("room-name").textContent = simulation.level.name;
    $("room-targets").textContent =
      `★ TARGETS ≤${simulation.level.time}s · ≤${simulation.level.rotations} turns · optional core`;
    $("hint").textContent = simulation.level.hint;
    $("notice").classList.remove("visible");
    H.renderer.resize();
    updateHUD();
    $("rotate-left").focus();
  }
  function select() {
    uiSound();
    setState("levels");
    const grid = $("level-grid");
    grid.replaceChildren();
    for (const [i, l] of H.levels.entries()) {
      const button = document.createElement("button");
      button.className = "level-card";
      button.disabled = !unlocked(i);
      button.style.setProperty("--i", i);
      const number = document.createElement("span"),
        name = document.createElement("strong"),
        stars = document.createElement("span"),
        detail = document.createElement("small");
      number.className = "level-number";
      number.textContent = String(i + 1).padStart(2, "0");
      name.textContent = l.name;
      stars.className = "level-stars";
      stars.textContent = button.disabled
        ? "LOCKED"
        : "★".repeat(records[i].stars) + "☆".repeat(3 - records[i].stars);
      detail.textContent =
        records[i].time !== null
          ? `BEST ${records[i].time.toFixed(1)}s · ${records[i].rotations} TURNS`
          : l.chapter;
      button.append(number, name, stars, detail);
      button.onclick = () => start(i);
      grid.append(button);
    }
    $("levels-back").focus();
  }
  function menu() {
    setState("menu");
    $("progress").textContent =
      `${records.filter((r) => r.stars > 0).length} / 12 ROOMS CLEARED · ${totalStars()} / 36 STARS`;
    $("play").focus();
  }
  function updateHUD() {
    $("timer").textContent = simulation.time.toFixed(1) + "s";
    $("rotations").textContent = simulation.rotations;
    $("core-status").textContent = simulation.core ? "◆" : "◇";
    $("core-status").classList.toggle("collected", simulation.core);
    $("gravity-arrow").textContent = ["↓", "←", "↑", "→"][simulation.gravity];
  }
  function modal(label, title, description, primary, action) {
    $("modal-label").textContent = label;
    $("modal-title").textContent = title;
    $("modal-description").textContent = description;
    $("modal-primary").textContent = primary;
    $("modal-primary").onclick = action;
    $("modal-primary").focus();
  }
  function pause() {
    if (state === "playing") {
      setState("paused");
      $("modal-stars").textContent = "";
      $("modal-stats").textContent = "";
      $("modal-retry").hidden = true;
      modal(
        "GRAVITY SUSPENDED",
        "ON HOLD.",
        "Your momentum will be right where you left it.",
        "RESUME HEIST ↗",
        pause,
      );
    } else if (state === "paused") {
      setState("playing");
      accumulator = 0;
      H.audio.unlock();
    }
  }
  function complete() {
    const s = simulation,
      l = s.level,
      stars =
        1 +
        (s.core ? 1 : 0) +
        (s.time <= l.time && s.rotations <= l.rotations ? 1 : 0),
      r = records[l.id];
    r.stars = Math.max(r.stars, stars);
    r.time = r.time === null ? s.time : Math.min(r.time, s.time);
    r.rotations =
      r.rotations === null ? s.rotations : Math.min(r.rotations, s.rotations);
    try {
      localStorage.setItem("gravity-heist-progress", JSON.stringify(records));
    } catch {}
    H.audio.play("portal");
    H.audio.play("win");
    H.renderer.burst(s.x, s.y, "#67e3bf", 45);
    setState("complete");
    $("modal-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    $("modal-stats").textContent =
      `${s.time.toFixed(1)}s / ${s.rotations} rotations / core ${s.core ? "secured" : "left behind"} · Targets: ≤${l.time}s & ≤${l.rotations} turns`;
    $("modal-retry").hidden = false;
    modal(
      "ROOM SECURED",
      l.name.toUpperCase(),
      stars === 3
        ? "Clean entry. Perfect getaway."
        : "One star for escape. One for the core. One for beating both targets.",
      l.id === 11 ? "FINISH THE HEIST ↗" : "NEXT ROOM ↗",
      () => {
        if (l.id < 11) start(l.id + 1);
        else finish();
      },
    );
  }
  function finish() {
    setState("finished");
    $("modal-stars").textContent = "✦";
    $("modal-stats").textContent =
      `12 rooms cleared · ${totalStars()} / 36 stars`;
    $("modal-retry").hidden = true;
    modal(
      "MISSION COMPLETE",
      "HEIST COMPLETE.",
      "G-07 made it out. The facility is yours. Replay any room to chase the perfect 36-star heist.",
      "RETURN TO FACILITY ↗",
      select,
    );
  }
  function rotate(dir) {
    if (state !== "playing") return;
    H.audio.unlock();
    H.physics.rotate(simulation, dir);
    H.audio.play("rotate");
    if (navigator.vibrate) navigator.vibrate(12);
    updateHUD();
  }
  function restart() {
    if (!["playing", "paused", "dying", "complete"].includes(state)) return;
    start(simulation.level.id);
  }
  function frame(now) {
    const dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    if (state === "playing" || state === "dying") {
      visual += dt;
      H.renderer.update(simulation, dt);
      if (noticeTimer > 0 && (noticeTimer -= dt) <= 0)
        $("notice").classList.remove("visible");
      if (state === "dying") {
        deathTimer -= dt;
        if (deathTimer <= 0) start(simulation.level.id);
      } else {
        accumulator += dt;
        while (accumulator >= H.physics.DT && state === "playing") {
          H.physics.step(simulation);
          accumulator -= H.physics.DT;
          for (const event of simulation.events) {
            if (event === "death") {
              H.audio.play("death");
              H.renderer.impact();
              H.renderer.burst(simulation.x, simulation.y, "#ff6078", 35);
              setState("dying");
              deathTimer = 0.45;
              notify("SIGNAL LOST · REBOOTING");
            } else if (event === "win") complete();
            else if (event === "core") {
              H.audio.play("core");
              H.renderer.burst(simulation.x, simulation.y, "#ad8cff");
              notify("ENERGY CORE SECURED");
            } else if (event === "switch") {
              H.audio.play("switch");
              notify("ACCESS AUTHORIZED");
            } else if (event === "magnet") H.audio.play("magnet");
          }
        }
        updateHUD();
      }
    }
    if (!$("gameplay").hidden) H.renderer.draw(simulation, visual);
    requestAnimationFrame(frame);
  }
  $("play").onclick = () => {
    uiSound();
    const next = records.findIndex((r) => r.stars === 0);
    start(next < 0 ? 0 : next);
  };
  $("select").onclick = select;
  $("levels-back").onclick = menu;
  $("modal-levels").onclick = select;
  $("modal-retry").onclick = () => start(simulation.level.id);
  $("restart").onclick = restart;
  $("pause").onclick = pause;
  $("mute").onclick = () => {
    H.audio.unlock();
    H.audio.toggle();
    syncMute();
  };
  function syncMute() {
    $("mute").textContent = H.audio.muted ? "♪̸" : "♫";
    $("mute").setAttribute(
      "aria-label",
      H.audio.muted ? "Unmute sound" : "Mute sound",
    );
    $("mute").setAttribute("aria-pressed", String(H.audio.muted));
  }
  H.game = {
    start,
    select,
    menu,
    pause,
    rotate,
    restart,
    get state() {
      return state;
    },
    get simulation() {
      return simulation;
    },
  };
  syncMute();
  menu();
  requestAnimationFrame(frame);
})();
