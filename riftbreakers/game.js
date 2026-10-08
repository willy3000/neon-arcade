(() => {
  const R = Rift,
    $ = (id) => document.getElementById(id),
    cfg = R.save.settings;
  let state = "menu",
    s = R.simulation.create(R.levels[0], cfg.mode, cfg.selected, cfg),
    last = 0,
    acc = 0,
    visual = 0,
    noticeTime = 0,
    settingsReturn = "menu",
    pendingBinding = null;
  const names = {
    warden: "THE IRON WARDEN",
    serpent: "THE RIFT SERPENT",
    emperor: "THE VOID EMPEROR",
  };
  function screen(next) {
    state = next;
    for (const [id, v] of [
      ["rift-menu", "menu"],
      ["rift-levels", "levels"],
      ["rift-instructions", "how"],
      ["rift-settings-screen", "settings"],
    ])
      $(id).hidden = next !== v;
    $("rift-gameplay").hidden = ![
      "playing",
      "paused",
      "complete",
      "defeat",
      "finished",
    ].includes(next);
    $("rift-overlay").hidden = ![
      "paused",
      "complete",
      "defeat",
      "finished",
    ].includes(next);
    if (next !== "playing") R.input?.clear();
  }
  function ui() {
    R.audio.unlock();
    R.audio.play({ type: "ui" });
  }
  function notice(text) {
    $("rift-notice").textContent = text;
    $("rift-notice").classList.add("visible");
    noticeTime = 4;
  }
  function preferences() {
    document.body.classList.toggle("reduce-motion", cfg.reducedMotion);
    document.documentElement.style.setProperty("--touch-scale", cfg.touchScale);
    R.audio.sync();
    R.save.saveSettings();
    for (const who of ["blaze", "volt"])
      $("rift-pick-" + who).setAttribute(
        "aria-pressed",
        String(cfg.selected === who),
      );
  }
  function menu() {
    screen("menu");
    $("rift-progress").textContent =
      `${R.save.records.filter((r) => r.stars > 0).length} / 9 BREACHES CLOSED · ${R.save.records.reduce((n, r) => n + r.stars, 0)} / 27 STARS`;
    $("rift-solo").focus();
  }
  function start(i) {
    if (!R.save.unlocked(i)) return;
    ui();
    R.input?.clear();
    s = R.simulation.create(R.levels[i], cfg.mode, cfg.selected, cfg);
    acc = 0;
    visual = 0;
    R.renderer.reset();
    screen("playing");
    $("rift-chapter").textContent =
      `0${Math.floor(i / 3) + 1} / ${s.level.chapter} · ${String(i + 1).padStart(2, "0")} / 9`;
    $("rift-level-name").textContent = s.level.name;
    $("rift-touch").hidden = s.mode !== "solo";
    $("rift-switch").hidden = s.mode !== "solo";
    R.renderer.resize();
    hud();
    notice(s.level.tutorial);
    $("rift-world").focus({ preventScroll: true });
  }
  function play() {
    const next = R.save.records.findIndex((r) => r.stars === 0);
    start(next < 0 ? 0 : next);
  }
  function select() {
    ui();
    screen("levels");
    const grid = $("rift-level-grid");
    grid.replaceChildren();
    for (let chapter = 0; chapter < 3; chapter++) {
      const section = document.createElement("section"),
        heading = document.createElement("h3"),
        cards = document.createElement("div");
      section.className = "chapter-section";
      heading.textContent = `0${chapter + 1} / ${R.levels[chapter * 3].chapter}`;
      cards.className = "chapter-cards";
      for (let i = chapter * 3; i < chapter * 3 + 3; i++) {
        const l = R.levels[i],
          r = R.save.records[i],
          b = document.createElement("button");
        b.className = "level-card" + (l.boss ? " boss" : "");
        b.disabled = !R.save.unlocked(i);
        b.style.setProperty("--i", i);
        const n = document.createElement("span"),
          title = document.createElement("strong"),
          stars = document.createElement("span"),
          detail = document.createElement("small");
        n.className = "level-number";
        n.textContent = `${String(i + 1).padStart(2, "0")} / ${l.boss ? "GUARDIAN" : "BREACH"}`;
        title.textContent = l.name;
        stars.className = "level-stars";
        stars.textContent = b.disabled
          ? "LOCKED"
          : "★".repeat(r.stars) + "☆".repeat(3 - r.stars);
        detail.textContent =
          r.time === null
            ? "FIRE × LIGHTNING"
            : `${r.time.toFixed(1)}s BEST · ${r.relics.length}/${l.relics.length} RELICS`;
        b.append(n, title, stars, detail);
        b.onclick = () => start(i);
        cards.append(b);
      }
      section.append(heading, cards);
      grid.append(section);
    }
    $("rift-levels-back").focus();
  }
  function modal(label, title, description, primary, action) {
    $("rift-modal-label").textContent = label;
    $("rift-modal-title").textContent = title;
    $("rift-modal-description").textContent = description;
    $("rift-modal-primary").textContent = primary;
    $("rift-modal-primary").onclick = action;
    $("rift-modal-primary").focus();
  }
  function pause() {
    if (state === "playing") {
      screen("paused");
      $("rift-modal-stars").textContent = "";
      $("rift-modal-stats").textContent = "";
      modal(
        "THE BREACH CAN WAIT",
        "TAKE A BREATHER.",
        "Every warning, swing, rescue timer and platform is paused.",
        "BACK INTO THE FIGHT ↗",
        pause,
      );
    } else if (state === "paused") {
      screen("playing");
      R.audio.unlock();
      acc = 0;
    }
  }
  function restart() {
    if (["playing", "paused", "complete", "defeat"].includes(state))
      start(s.level.id);
  }
  function switchHero() {
    if (s.mode !== "solo" || !["playing", "paused"].includes(state)) return;
    R.input?.clear();
    s.selected = s.selected === "blaze" ? "volt" : "blaze";
    cfg.selected = s.selected;
    preferences();
    ui();
    hud();
  }
  function hud() {
    for (const h of s.heroes) {
      const prefix = "rift-" + h.who;
      $(prefix + "-hp").style.width = h.hp + "%";
      $(prefix + "-health").textContent =
        h.hp <= 0
          ? `DOWN · ${Math.ceil(h.downTimer)}s`
          : Math.ceil(h.hp) + " / 100";
      $(prefix + "-energy").textContent = Math.floor(h.energy);
      $(prefix + "-ultimate").textContent =
        h.ultimate >= 100 ? "READY" : Math.floor(h.ultimate) + "%";
      $(prefix + "-energy-bar").style.width = h.energy + "%";
      $(prefix + "-ultimate-bar").style.width = h.ultimate + "%";
      $(prefix + "-role").textContent =
        s.mode === "coop"
          ? "PLAYER " + (h.who === "blaze" ? "1" : "2")
          : s.selected === h.who
            ? "YOU"
            : "AI PARTNER";
    }
    $("rift-fusion").style.width = s.fusion + "%";
    $("rift-fusion-label").textContent =
      s.fusion >= 100 ? "READY" : Math.floor(s.fusion) + "%";
    $("rift-combo").textContent = s.combo
      ? `${s.combo} HIT COMBO`
      : "BUILD YOUR MOMENTUM";
    $("rift-combo").classList.toggle("combo-live", s.combo > 2);
    $("rift-time").textContent = s.time.toFixed(1) + "s";
    $("rift-score").textContent = Math.floor(s.score)
      .toString()
      .padStart(6, "0");
    $("rift-relics").textContent =
      `◇ ${s.collected.size} / ${s.level.relics.length}`;
    $("rift-switch").textContent = s.selected.toUpperCase() + " · SWITCH X";
    const boss = s.enemies.find((e) => e.boss && e.hp > 0);
    $("rift-boss-hud").hidden = !boss;
    if (boss) {
      $("rift-boss-name").textContent = names[boss.type];
      $("rift-boss-hp").style.width =
        Math.max(0, (boss.hp / boss.maxHp) * 100) + "%";
      $("rift-boss-phase").textContent = "PHASE " + boss.phase;
    }
    $("rift-objective").textContent =
      s.generator.hp <= 0
        ? "RIFT CLOSED · BOTH HEROES TO EXTRACTION"
        : s.generatorReady
          ? "GENERATOR EXPOSED · BREAK IT WITH YOUR ATTACKS"
          : `HOSTILES ${s.enemies.filter((e) => e.hp > 0).length} · CLEAR THE ENCOUNTER`;
  }
  function events() {
    for (const e of s.events) {
      R.renderer.event(e);
      if (!["foot", "land", "team", "notice"].includes(e.type)) R.audio.play(e);
      if (e.text) notice(e.text);
      else if (e.type === "checkpoint")
        notice("CHECKPOINT SAVED · HEALTH RESTORED");
      else if (e.type === "revive")
        notice(e.who.toUpperCase() + " BACK IN THE FIGHT");
      else if (e.type === "down")
        notice("PARTNER DOWN · STAND CLOSE TO REVIVE");
      else if (e.type === "phase")
        notice(names[s.level.boss] + " · PHASE " + e.phase);
      else if (e.type === "team" && s.combo % 4 === 0)
        notice("TEAM COMBO · FUSION ENERGY BOOST");
      else if (e.type === "gate") notice("ENCOUNTER CLEARED · GATE OPEN");
      else if (e.type === "boss-death")
        notice("GUARDIAN DEFEATED · EXTRACT TOGETHER");
      else if (e.type === "victory") complete();
      else if (e.type === "defeat") {
        screen("defeat");
        $("rift-modal-stars").textContent = "";
        $("rift-modal-stats").textContent =
          `${Math.floor(s.score)} score · ${s.kills} enemies defeated`;
        modal(
          "THE RIFT PUSHED BACK",
          "GET BACK UP.",
          s.checkpointIndex < 0
            ? "Your next attempt starts at the first encounter."
            : "Your checkpoint is ready. Both heroes and the saved encounter state will return.",
          "RETRY CHECKPOINT ↗",
          () => {
            R.simulation.retry(s);
            acc = 0;
            screen("playing");
            R.input.clear();
            R.renderer.reset();
            ui();
          },
        );
      }
    }
  }
  function complete() {
    const stars = R.save.finish(s);
    screen("complete");
    $("rift-modal-stars").textContent =
      "★".repeat(stars) + "☆".repeat(3 - stars);
    $("rift-modal-stats").textContent =
      `${s.time.toFixed(1)}s · ${Math.floor(s.score)} score · ${s.kills} defeats · ${s.maxCombo} max combo · ${s.damage} team damage · ${s.collected.size}/${s.level.relics.length} relics`;
    modal(
      s.level.boss ? "GUARDIAN DOWN" : "BREACH CLOSED",
      s.level.name.toUpperCase(),
      stars === 3
        ? "Fast, fearless, and nothing left behind."
        : "One star for extraction, one for all relics, one for a fast run with low damage and no falls.",
      s.level.id === 8 ? "CLOSE THE FINAL BREACH ↗" : "NEXT BREACH ↗",
      () => (s.level.id === 8 ? finish() : start(s.level.id + 1)),
    );
  }
  function finish() {
    screen("finished");
    $("rift-modal-stars").textContent = "✦";
    $("rift-modal-stats").textContent =
      `9 breaches closed · ${R.save.records.reduce((n, r) => n + r.stars, 0)} / 27 stars`;
    modal(
      "THE VOID HAS FALLEN",
      "WE BREAK TOGETHER.",
      "The Emperor is gone. Blaze and Volt bought the world another sunrise. Return to the campaign for better runs and hidden relics.",
      "RETURN TO THE CAMPAIGN ↗",
      select,
    );
  }
  function frame(now) {
    const dt = Math.min(Math.max(0, (now - last) / 1000) || 0, 0.05);
    last = now;
    if (state === "playing") {
      visual += dt;
      acc += dt;
      while (acc >= R.physics.DT && state === "playing") {
        const actions = R.input?.sample() || {};
        R.simulation.step(s, actions);
        acc -= R.physics.DT;
        events();
      }
      R.renderer.update(dt, s);
      R.audio.update(s.time, !!s.level.boss);
      hud();
      if (noticeTime > 0 && (noticeTime -= dt) <= 0)
        $("rift-notice").classList.remove("visible");
    }
    if (!$("rift-gameplay").hidden) R.renderer.draw(s, visual);
    requestAnimationFrame(frame);
  }
  function controlsGuide() {
    const root = $("rift-controls-guide");
    root.replaceChildren();
    for (const who of ["blaze", "volt"]) {
      const p = document.createElement("p");
      p.className = "controls-line";
      p.textContent =
        who.toUpperCase() +
        " · " +
        Object.entries(cfg.bindings[who])
          .map(
            ([a, k]) =>
              a +
              " " +
              (k === "ArrowUp"
                ? "↑"
                : k === "ArrowDown"
                  ? "↓"
                  : k === "ArrowLeft"
                    ? "←"
                    : k === "ArrowRight"
                      ? "→"
                      : k.toUpperCase()),
          )
          .join(" · ");
      root.append(p);
    }
  }
  function bindings() {
    const root = $("rift-bindings");
    root.replaceChildren();
    for (const who of ["blaze", "volt"]) {
      const column = document.createElement("div"),
        title = document.createElement("h3");
      title.textContent = who.toUpperCase();
      column.append(title);
      for (const [action, key] of Object.entries(cfg.bindings[who])) {
        const b = document.createElement("button"),
          name = document.createElement("span"),
          value = document.createElement("kbd");
        name.textContent = action.toUpperCase();
        value.textContent = key;
        b.append(name, value);
        b.setAttribute(
          "aria-label",
          `Rebind ${who} ${action}, currently ${key}`,
        );
        b.onclick = () => {
          pendingBinding = { who, action };
          $("rift-binding-status").textContent =
            `PRESS A KEY FOR ${who.toUpperCase()} ${action.toUpperCase()}`;
        };
        column.append(b);
      }
      root.append(column);
    }
  }
  function bindKey(key) {
    if (!pendingBinding) return false;
    if (key === "Escape") {
      pendingBinding = null;
      $("rift-binding-status").textContent = "REBIND CANCELED";
      return true;
    }
    if (["r", "x", "Tab", "Enter", " "].includes(key)) {
      $("rift-binding-status").textContent = "THAT KEY IS RESERVED";
      return true;
    }
    const p = pendingBinding;
    for (const who of ["blaze", "volt"])
      for (const [a, k] of Object.entries(cfg.bindings[who]))
        if (k === key && (who !== p.who || a !== p.action)) {
          $("rift-binding-status").textContent = "THAT KEY IS ALREADY IN USE";
          return true;
        }
    cfg.bindings[p.who][p.action] = key;
    pendingBinding = null;
    preferences();
    bindings();
    controlsGuide();
    $("rift-binding-status").textContent = "CONTROL SAVED";
    return true;
  }
  function settings() {
    ui();
    settingsReturn = state === "playing" ? "paused" : state;
    if (state === "playing") pause();
    screen("settings");
    pendingBinding = null;
    $("rift-binding-status").textContent = "";
    for (const key of [
      "sfx",
      "music",
      "quality",
      "shake",
      "reducedFlash",
      "reducedMotion",
      "shortFusion",
      "touchScale",
    ]) {
      const el = $("rift-setting-" + key);
      if (typeof cfg[key] === "boolean") el.checked = cfg[key];
      else el.value = cfg[key];
      el.onchange = () => {
        cfg[key] =
          el.type === "checkbox"
            ? el.checked
            : el.type === "range"
              ? Number(el.value)
              : el.value;
        preferences();
      };
    }
    bindings();
    $("rift-settings-back").focus();
  }
  $("rift-settings-back").onclick = () => {
    pendingBinding = null;
    if (settingsReturn === "paused") {
      screen("playing");
      pause();
    } else if (["complete", "defeat", "finished"].includes(settingsReturn))
      screen(settingsReturn);
    else menu();
  };
  $("rift-reset-bindings").onclick = () => {
    cfg.bindings = R.save.defaults().bindings;
    pendingBinding = null;
    preferences();
    bindings();
    controlsGuide();
  };
  for (const who of ["blaze", "volt"])
    $("rift-pick-" + who).onclick = () => {
      cfg.selected = who;
      preferences();
      ui();
    };
  $("rift-solo").onclick = () => {
    cfg.mode = "solo";
    preferences();
    play();
  };
  $("rift-coop").onclick = () => {
    cfg.mode = "coop";
    preferences();
    play();
  };
  $("rift-select").onclick = select;
  $("rift-levels-back").onclick = menu;
  $("rift-settings").onclick = settings;
  $("rift-how").onclick = () => {
    ui();
    controlsGuide();
    screen("how");
    $("rift-how-back").focus();
  };
  $("rift-how-back").onclick = menu;
  $("rift-how-play").onclick = play;
  $("rift-pause").onclick = pause;
  $("rift-restart").onclick = restart;
  $("rift-switch").onclick = switchHero;
  $("rift-modal-levels").onclick = select;
  $("rift-modal-replay").onclick = () => start(s.level.id);
  $("rift-modal-settings").onclick = settings;
  R.game = {
    start,
    menu,
    select,
    pause,
    restart,
    switchHero,
    settings,
    bindKey,
    get state() {
      return state;
    },
    get simulation() {
      return s;
    },
  };
  preferences();
  menu();
  requestAnimationFrame(frame);
  if (location.protocol === "file:")
    $("rift-offline").textContent = "LOCAL PLAY · NO CONNECTION REQUIRED";
  else if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./riftbreakers-sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(
        () =>
          ($("rift-offline").textContent =
            "OFFLINE READY · YOUR FIGHT IS CACHED"),
      )
      .catch(
        () => ($("rift-offline").textContent = "INSTANT PLAY · NO DOWNLOADS"),
      );
  }
})();
