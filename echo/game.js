(() => {
  const E = Echo,
    $ = (id) => document.getElementById(id);
  let state = "menu",
    simulation = E.physics.create(E.levels[0]),
    last = 0,
    accumulator = 0,
    visual = 0,
    noticeTimer = 0;
  let records = Array.from({ length: 12 }, () => ({
    stars: 0,
    time: null,
    pulses: null,
  }));
  try {
    const saved = JSON.parse(localStorage.getItem("echo-forge-progress"));
    if (Array.isArray(saved))
      records = records.map((r, i) => {
        const v = saved[i];
        return v && typeof v === "object"
          ? {
              stars: Math.floor(Math.max(0, Math.min(3, Number(v.stars) || 0))),
              time: Number.isFinite(v.time) && v.time >= 0 ? v.time : null,
              pulses:
                Number.isFinite(v.pulses) && v.pulses >= 0 ? v.pulses : null,
            }
          : r;
      });
  } catch {}
  const unlocked = (i) =>
    i >= 0 && i < 12 && (i === 0 || records[i - 1].stars > 0);
  const totalStars = () => records.reduce((n, r) => n + r.stars, 0);
  function setState(next) {
    state = next;
    $("echo-menu").hidden = next !== "menu";
    $("echo-levels").hidden = next !== "levels";
    $("echo-gameplay").hidden = ![
      "playing",
      "paused",
      "complete",
      "finished",
    ].includes(next);
    $("echo-overlay").hidden = !["paused", "complete", "finished"].includes(
      next,
    );
    if (next !== "playing") E.input?.cancel();
  }
  function notify(text) {
    $("echo-notice").textContent = text;
    $("echo-notice").classList.add("visible");
    noticeTimer = 2;
  }
  function processEvent(event) {
    E.audio.play(event.type, event.frequency);
    if (
      [
        "pulse",
        "transfer",
        "activation",
        "fragment",
        "resonance",
        "reflection",
        "shatter",
        "switch",
        "platform",
        "win",
      ].includes(event.type)
    )
      E.renderer.burst(
        event.x,
        event.y,
        E.physics.frequencies[event.frequency].color,
        event.type === "shatter" ? 28 : 12,
      );
    if (event.type === "fragment") notify("TONE FRAGMENT SECURED");
    else if (event.type === "activation") notify("CRYSTAL AWAKENED");
    else if (event.type === "absorb")
      notify("SIGNAL ABSORBED · TRY A DIRECTIONAL PULSE");
    else if (event.type === "win") complete();
  }
  function ui() {
    E.audio.unlock();
    E.audio.play("ui");
  }
  function start(index) {
    if (!unlocked(index)) return;
    E.audio.unlock();
    E.input?.reset();
    simulation = E.physics.create(E.levels[index]);
    accumulator = 0;
    visual = 0;
    noticeTimer = 0;
    E.renderer.reset();
    setState("playing");
    $("echo-room-number").textContent =
      `CHAMBER ${String(index + 1).padStart(2, "0")} / 12 · ${simulation.level.chapter}`;
    $("echo-room-name").textContent = simulation.level.name;
    $("echo-targets").textContent =
      `★ ≤${simulation.level.time}s · ≤${simulation.level.budget} pulses · all tone fragments`;
    $("echo-hint").textContent = simulation.level.hint;
    $("echo-notice").classList.remove("visible");
    E.renderer.resize();
    updateHUD();
    $("echo-world").focus({ preventScroll: true });
  }
  function select() {
    ui();
    setState("levels");
    const grid = $("echo-level-grid");
    grid.replaceChildren();
    for (const [i, l] of E.levels.entries()) {
      const b = document.createElement("button");
      b.className = "level-card";
      b.disabled = !unlocked(i);
      b.style.setProperty("--i", i);
      const number = document.createElement("span"),
        name = document.createElement("strong"),
        stars = document.createElement("span"),
        detail = document.createElement("small");
      number.className = "level-number";
      number.textContent = String(i + 1).padStart(2, "0");
      name.textContent = l.name;
      stars.className = "level-stars";
      stars.textContent = b.disabled
        ? "LOCKED"
        : "★".repeat(records[i].stars) + "☆".repeat(3 - records[i].stars);
      detail.textContent =
        records[i].time !== null
          ? `${records[i].time.toFixed(1)}s BEST · ${records[i].pulses} PULSES`
          : l.chapter;
      b.append(number, name, stars, detail);
      b.onclick = () => start(i);
      grid.append(b);
    }
    $("echo-back").focus();
  }
  function menu() {
    setState("menu");
    $("echo-progress").textContent =
      `${records.filter((r) => r.stars > 0).length} / 12 CHAMBERS FORGED · ${totalStars()} / 36 STARS`;
    $("echo-play").focus();
  }
  function setFrequency(f) {
    if (state !== "playing" || !E.physics.frequencies[f]) return;
    ui();
    simulation.frequency = f;
    updateHUD();
  }
  function pulse(strength = 0.8, aim = null) {
    if (state !== "playing") return false;
    E.audio.unlock();
    const success = E.physics.fire(
      simulation,
      simulation.frequency,
      strength,
      aim,
    );
    if (!success) {
      notify("RECHARGING · ENERGY RETURNS AUTOMATICALLY");
      return false;
    }
    for (const event of simulation.events)
      if (event.type === "pulse") processEvent(event);
    simulation.events = [];
    if (navigator.vibrate) navigator.vibrate(10);
    updateHUD();
    return true;
  }
  function updateHUD() {
    const s = simulation;
    $("echo-time").textContent = s.time.toFixed(1) + "s";
    $("echo-pulses").textContent = s.pulses;
    $("echo-fragments").textContent =
      `${s.fragments.size} / ${s.level.fragments.length}`;
    $("echo-energy-label").textContent = Math.floor(s.energy) + "%";
    $("echo-energy").setAttribute(
      "aria-valuenow",
      String(Math.floor(s.energy)),
    );
    $("echo-energy").firstElementChild.style.width = s.energy + "%";
    const gesture = E.input?.gesture,
      charge = gesture?.active
        ? Math.min(1, (s.time - gesture.start) / 1.2)
        : 0;
    $("echo-charge").style.width = charge * 100 + "%";
    $("echo-charge-label").textContent =
      charge >= 1
        ? "FULL CHARGE · RELEASE"
        : charge > 0
          ? `CHARGING ${Math.floor(charge * 100)}%`
          : "HOLD TO CHARGE";
    for (const f of ["LOW", "MID", "HIGH"]) {
      const b = $("echo-" + f.toLowerCase());
      b.setAttribute("aria-pressed", String(s.frequency === f));
    }
    const aim = E.input?.aim;
    $("echo-aim-mode").textContent =
      aim === null || aim === undefined
        ? "RADIAL · C TO RESET"
        : `AIMED ${Math.round((aim * 180) / Math.PI)}° · C FOR RADIAL`;
  }
  function modal(label, title, description, button, action) {
    $("echo-modal-label").textContent = label;
    $("echo-modal-title").textContent = title;
    $("echo-modal-description").textContent = description;
    $("echo-modal-primary").textContent = button;
    $("echo-modal-primary").onclick = action;
    $("echo-modal-primary").focus();
  }
  function pause() {
    if (state === "playing") {
      setState("paused");
      $("echo-modal-stars").textContent = "";
      $("echo-modal-stats").textContent = "";
      $("echo-modal-retry").hidden = true;
      modal(
        "LET THE SILENCE SETTLE",
        "ON HOLD.",
        "Every wave and moving object is waiting exactly where you left it.",
        "RESUME SESSION ↗",
        pause,
      );
    } else if (state === "paused") {
      setState("playing");
      E.audio.unlock();
      accumulator = 0;
    }
  }
  function complete() {
    const s = simulation,
      l = s.level,
      stars =
        1 +
        (s.fragments.size === l.fragments.length ? 1 : 0) +
        (s.time <= l.time && s.pulses <= l.budget ? 1 : 0),
      r = records[l.id];
    r.stars = Math.max(stars, r.stars);
    r.time = r.time === null ? s.time : Math.min(r.time, s.time);
    r.pulses = r.pulses === null ? s.pulses : Math.min(r.pulses, s.pulses);
    try {
      localStorage.setItem("echo-forge-progress", JSON.stringify(records));
    } catch {}
    setState("complete");
    $("echo-modal-stars").textContent =
      "★".repeat(stars) + "☆".repeat(3 - stars);
    $("echo-modal-stats").textContent =
      `${s.time.toFixed(1)} seconds · ${s.pulses} pulses · ${s.fragments.size}/${l.fragments.length} fragments · Best: ${r.time.toFixed(1)}s / ${r.pulses} pulses`;
    $("echo-modal-retry").hidden = false;
    modal(
      "SIGNAL DELIVERED",
      l.name.toUpperCase(),
      stars === 3
        ? "Perfect harmony. You made the room sing."
        : "Delivered. Replay to collect the fragment and refine your pulse count.",
      l.id === 11 ? "FINISH THE FORGE ↗" : "NEXT CHAMBER ↗",
      () => {
        if (l.id < 11) start(l.id + 1);
        else finish();
      },
    );
  }
  function finish() {
    setState("finished");
    $("echo-modal-stars").textContent = "✦";
    $("echo-modal-stats").textContent =
      `12 chambers completed · ${totalStars()} / 36 stars`;
    $("echo-modal-retry").hidden = true;
    modal(
      "EVERY ECHO FOUND A HOME",
      "FORGE COMPLETE.",
      "You shaped motion out of silence. The chambers remain open for your next perfect performance.",
      "RETURN TO CHAMBERS ↗",
      select,
    );
  }
  function restart() {
    if (["playing", "paused", "complete"].includes(state))
      start(simulation.level.id);
  }
  function frame(now) {
    const dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    if (state === "playing") {
      visual += dt;
      E.renderer.update(dt);
      if (noticeTimer > 0 && (noticeTimer -= dt) <= 0)
        $("echo-notice").classList.remove("visible");
      accumulator += dt;
      while (accumulator >= E.physics.DT && state === "playing") {
        E.physics.step(simulation);
        accumulator -= E.physics.DT;
        for (const event of simulation.events) processEvent(event);
      }
      updateHUD();
    }
    if (!$("echo-gameplay").hidden)
      E.renderer.draw(simulation, visual, E.input?.gesture);
    requestAnimationFrame(frame);
  }
  $("echo-play").onclick = () => {
    ui();
    const next = records.findIndex((r) => r.stars === 0);
    start(next < 0 ? 0 : next);
  };
  $("echo-select").onclick = select;
  $("echo-back").onclick = menu;
  $("echo-modal-levels").onclick = select;
  $("echo-modal-retry").onclick = () => start(simulation.level.id);
  $("echo-restart").onclick = restart;
  $("echo-pause").onclick = pause;
  for (const f of ["LOW", "MID", "HIGH"])
    $("echo-" + f.toLowerCase()).onclick = () => setFrequency(f);
  function syncMute() {
    $("echo-mute").textContent = E.audio.muted ? "♪̸" : "♫";
    $("echo-mute").setAttribute(
      "aria-label",
      E.audio.muted ? "Unmute sound" : "Mute sound",
    );
    $("echo-mute").setAttribute("aria-pressed", String(E.audio.muted));
  }
  $("echo-mute").onclick = () => {
    E.audio.unlock();
    E.audio.toggle();
    syncMute();
  };
  E.game = {
    start,
    select,
    menu,
    pause,
    restart,
    pulse,
    setFrequency,
    updateHUD,
    notify,
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
