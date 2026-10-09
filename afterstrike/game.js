(() => {
  const A = Afterstrike,
    $ = (id) => document.getElementById(id),
    cfg = A.save.settings;
  let state = "title",
    s = A.simulation.create(),
    last = 0,
    acc = 0,
    visual = 0,
    titleTime = 0,
    noticeTime = 0,
    settingsReturn = "title",
    summaryDone = false;
  const ranks = ["D", "C", "B", "A", "S", "SS", "SSS"],
    rankNames = [
      "ROOKIE",
      "STRIKER",
      "RELENTLESS",
      "SPECTACULAR",
      "ANOMALY",
      "UNSTOPPABLE",
      "TIMELINE BREAKER",
    ];
  function screen(next) {
    state = next;
    for (const [id, value] of [
      ["after-title", "title"],
      ["after-weapon-screen", "weapons"],
      ["after-how-screen", "how"],
      ["after-settings-screen", "settings"],
      ["after-collection-screen", "collection"],
      ["after-challenge-screen", "challenge"],
    ])
      $(id).hidden = next !== value;
    $("after-gameplay").hidden = ![
      "playing",
      "paused",
      "upgrade",
      "victory",
      "defeat",
    ].includes(next);
    $("after-overlay").hidden = ![
      "paused",
      "upgrade",
      "victory",
      "defeat",
    ].includes(next);
    if (next !== "playing") {
      A.input?.clear();
      A.audio.pause();
    }
  }
  function ui() {
    A.audio.unlock();
    A.audio.sync();
    A.audio.event({ type: "ui" });
  }
  function preferences() {
    document.body.classList.toggle("reduce-motion", cfg.reducedMotion);
    A.save.saveSettings();
    A.audio.sync();
    A.renderer.resize();
  }
  function title() {
    screen("title");
    const p = A.save.progress,
      b = p.best.standard;
    $("after-personal-best").textContent = b
      ? `${b.time.toFixed(1)}s BEST · ${b.score} TOP SCORE · ${p.bossWins} GUARDIAN VICTORIES`
      : "THE FALLEN CITY / THREE LINKED ENCOUNTERS / FAST RETRIES";
    $("after-start").focus();
    A.renderer.resize();
  }
  function notice(text) {
    $("after-notice").textContent = text;
    $("after-notice").classList.add("visible");
    noticeTime = 6;
  }
  function start(practice = false) {
    ui();
    s = A.simulation.create({
      weapon: cfg.weapon,
      seed:
        cfg.challenge === "time-trial"
          ? 12345
          : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0,
      assist: cfg.assist,
      challenge: practice ? "standard" : cfg.challenge,
      practice,
    });
    s.unlockedWeapons = practice
      ? Object.keys(A.weapons)
      : A.save.progress.weapons.slice();
    acc = 0;
    visual = 0;
    summaryDone = false;
    A.input?.clear();
    A.renderer.reset();
    screen("playing");
    sceneHud();
    notice(s.scene.tutorial);
    $("after-touch").hidden = !matchMedia("(pointer: coarse)").matches;
    $("after-extra-touch").hidden = true;
    $("after-more-actions").setAttribute("aria-expanded", "false");
    A.renderer.resize();
    hud();
    $("after-world").focus({ preventScroll: true });
  }
  function sceneHud() {
    $("after-scene-label").textContent =
      s.scene.subtitle +
      (s.assist ? " / ASSIST" : "") +
      (s.challenge !== "standard" ? " / " + s.challenge.toUpperCase() : "");
    $("after-scene-title").textContent = s.scene.name;
  }
  function hud() {
    const h = s.player,
      r = Math.min(6, Math.floor(s.style / 100));
    $("after-health").style.width = h.hp + "%";
    $("after-health-number").textContent = Math.ceil(h.hp);
    $("after-energy").style.width = h.energy + "%";
    $("after-energy-number").textContent = Math.floor(h.energy);
    $("after-special").style.width = h.special + "%";
    $("after-special-number").textContent = Math.floor(h.special);
    $("after-current-weapon").textContent = A.weapons[h.weapon].name;
    $("after-ultimate").textContent =
      h.ultimate >= 100
        ? "AFTERSTORM READY · U"
        : "AFTERSTORM " + Math.floor(h.ultimate) + "%";
    $("after-echo-status").textContent =
      s.echoCooldown > 0
        ? `SHIFT ${s.echoCooldown.toFixed(1)}s`
        : s.echoes.length
          ? `${s.echoes.length} ECHO ACTIVE · E READY`
          : "ECHO SHIFT READY · E";
    $("after-style").textContent = ranks[r];
    $("after-style-name").textContent = rankNames[r];
    $("after-combo").textContent = s.combo
      ? `${s.combo} HIT COMBO`
      : "FIND YOUR FLOW";
    $("after-timer").textContent = s.time.toFixed(1) + "s";
    $("after-score").textContent = Math.floor(s.score)
      .toString()
      .padStart(6, "0");
    const boss = s.enemies.find((e) => e.boss && e.hp > 0);
    $("after-boss-hud").hidden = !boss;
    if (boss) {
      $("after-boss-hp").style.width = (boss.hp / boss.maxHp) * 100 + "%";
      $("after-boss-phase").textContent = "PHASE " + boss.phase;
    }
    $("after-objective").textContent = s.practice
      ? "PRACTICE · UNLIMITED RESOURCES · ALL WEAPONS"
      : s.scene.pad && !s.relayOpen && s.encounters.every((e) => e.done)
        ? "HOLD THE RELAY WITH YOUR ECHO · PASS THE DOOR"
        : boss
          ? "BREAK ARMORED LIMBS · PUNISH RECOVERY"
          : s.encounters.every((e) => e.done)
            ? "REACH THE NEXT MOMENT"
            : "CLEAR THE TIMELINE HOSTILES";
  }
  function modal(label, titleText, description, button, action) {
    $("after-modal-label").textContent = label;
    $("after-modal-title").textContent = titleText;
    $("after-modal-description").textContent = description;
    $("after-modal-primary").textContent = button;
    $("after-modal-primary").onclick = action;
    $("after-modal-primary").hidden = false;
    $("after-upgrade-cards").hidden = true;
    $("after-modal-primary").focus();
  }
  function pause() {
    if (state === "playing") {
      screen("paused");
      $("after-modal-stats").textContent = "";
      modal(
        "THE WORLD CAN WAIT",
        "HOLD THIS MOMENT.",
        "Your replay tracks, attack warnings, and momentum are paused.",
        "RETURN TO THE FIGHT ↗",
        pause,
      );
    } else if (state === "paused") {
      screen("playing");
      acc = 0;
      A.audio.unlock();
      A.audio.sync();
    }
  }
  function restart() {
    if (["playing", "paused", "defeat", "victory", "upgrade"].includes(state))
      start(s.practice);
  }
  function upgrade() {
    A.save.discover(s);
    screen("upgrade");
    modal(
      "A FRACTURE IN POSSIBILITY",
      "CHOOSE WHAT REMAINS.",
      "One mutation for this run. Weapons and discoveries persist after it ends.",
      "",
      () => {},
    );
    $("after-modal-primary").hidden = true;
    $("after-modal-stats").textContent = "HEALTH +15 ON THE NEXT SCENE";
    const root = $("after-upgrade-cards");
    root.hidden = false;
    root.replaceChildren();
    for (const m of s.offers) {
      const b = card(m.name, m.text, "TEMPORARY MUTATION");
      b.onclick = () => {
        if (!A.simulation.choose(s, m.id)) return;
        A.save.discover(s);
        s.unlockedWeapons = A.save.progress.weapons.slice();
        acc = 0;
        A.input.clear();
        A.renderer.reset();
        screen("playing");
        sceneHud();
        hud();
        ui();
        notice(s.scene.tutorial);
      };
      root.append(b);
    }
    root.children[0]?.focus();
  }
  function end(won) {
    if (summaryDone) return;
    summaryDone = true;
    const unlocks = A.save.summary(s);
    screen(won ? "victory" : "defeat");
    $("after-modal-stats").textContent =
      `${s.time.toFixed(1)}s · ${Math.floor(s.score)} SCORE · ${s.kills} DEFEATS · ${s.maxCombo} MAX COMBO · ${s.syncs} SYNCS · ${Math.ceil(s.damage)} DAMAGE · ${s.found.size} RELICS`;
    modal(
      won ? "CLOCKWORK HEART SILENCED" : "A FUTURE STILL POSSIBLE",
      won ? "THE NEXT MOMENT IS YOURS." : "BECOME SOMETHING ELSE.",
      won
        ? "The Fallen City run is complete." +
            (unlocks.length ? " Unlocked: " + unlocks.join(" · ") : "")
        : "Your discoveries remain. Change your weapon or build, and try a different timeline.",
      "ANOTHER TIMELINE ↗",
      () => start(),
    );
  }
  function events() {
    for (const e of s.events) {
      A.renderer.event(e);
      A.audio.event(e);
      if (e.text) notice(e.text);
      if (e.type === "upgrade") upgrade();
      else if (e.type === "victory") end(true);
      else if (e.type === "death" && !s.practice) end(false);
      else if (e.type === "parry") notice("PARRY · CHOOSE YOUR COUNTER");
      else if (e.type === "relic") notice("A MEMORY RECOVERED");
      else if (e.type === "component-break") notice("TITAN ARM SHATTERED");
    }
  }
  function frame(now) {
    const dt = Math.min(Math.max(0, (now - last) / 1000) || 0, 0.05);
    last = now;
    A.input?.pollGamepad();
    if (state === "title") {
      titleTime += dt;
      A.renderer.drawCover(titleTime);
    }
    if (state === "playing") {
      visual += dt;
      acc += dt;
      while (acc >= A.GAME_FEEL.dt && state === "playing") {
        const actions = A.input?.sample() || {};
        if (state !== "playing") break;
        A.simulation.step(s, actions);
        acc -= A.GAME_FEEL.dt;
        events();
      }
      A.renderer.update(dt, s);
      A.audio.update(s.time, !!s.scene.boss);
      hud();
      if (noticeTime > 0 && (noticeTime -= dt) <= 0)
        $("after-notice").classList.remove("visible");
    }
    if (!$("after-gameplay").hidden) A.renderer.draw(s, visual);
    requestAnimationFrame(frame);
  }
  function card(titleText, description, label) {
    const b = document.createElement("button"),
      small = document.createElement("span"),
      titleNode = document.createElement("strong"),
      p = document.createElement("p");
    b.className = "choice-card";
    small.textContent = label;
    titleNode.textContent = titleText;
    p.textContent = description;
    b.append(small, titleNode, p);
    return b;
  }
  function weapons() {
    ui();
    screen("weapons");
    const root = $("after-weapon-grid");
    root.replaceChildren();
    const info = {
      blade:
        "Fast three-hit combos, precise parries and aerial follow-ups. Balanced reach and recovery.",
      gauntlets:
        "Short reach, heavy stagger and armor breaking. Punches launch enemies; aerial heavies slam.",
      chain:
        "Long sweeps and a pulling heavy. Keep crowds at range, then reel a target into your echo.",
    };
    for (const [id, w] of Object.entries(A.weapons)) {
      const b = card(
        w.name,
        info[id],
        A.save.progress.weapons.includes(id)
          ? "MODULAR WEAPON"
          : "DISCOVERY LOCKED",
      );
      b.disabled = !A.save.progress.weapons.includes(id);
      b.setAttribute("aria-pressed", String(cfg.weapon === id));
      b.onclick = () => {
        cfg.weapon = id;
        preferences();
        weapons();
      };
      root.append(b);
    }
    $("after-weapons-back").focus();
  }
  function challenges() {
    ui();
    screen("challenge");
    const root = $("after-challenge-grid");
    root.replaceChildren();
    for (const [id, name, desc] of [
      [
        "standard",
        "A NEW TIMELINE",
        "Fresh seeded enemy compositions, with fair authored positions. The default run.",
      ],
      [
        "time-trial",
        "ONE FIXED MOMENT",
        "The same seeded encounter route each attempt. Compare your best completion time.",
      ],
      [
        "fragile",
        "GLASS TIMELINE",
        "Maximum health is 60. Precision, parries and echo positioning matter more.",
      ],
      [
        "overclock",
        "OVERCLOCK",
        "Enemies act 15% faster. Their warnings remain visible; rewards stay focused on mastery.",
      ],
    ]) {
      const b = card(
        name,
        desc,
        id === "standard" || A.save.progress.bossWins
          ? "RUN MODIFIER"
          : "DEFEAT THE TITAN TO UNLOCK",
      );
      b.disabled = id !== "standard" && A.save.progress.bossWins === 0;
      b.setAttribute("aria-pressed", String(cfg.challenge === id));
      b.onclick = () => {
        cfg.challenge = id;
        preferences();
        challenges();
      };
      root.append(b);
    }
    $("after-challenges-back").focus();
  }
  function collection() {
    ui();
    screen("collection");
    const root = $("after-collection-content");
    root.replaceChildren();
    function section(name) {
      const section = document.createElement("section"),
        h = document.createElement("h3"),
        grid = document.createElement("div");
      section.className = "collection-section";
      h.textContent = name;
      grid.className = "collection-grid";
      section.append(h, grid);
      root.append(section);
      return grid;
    }
    const mantles = section("MANTLES");
    for (const [id, name, desc] of [
      ["ash", "ASH MANTLE", "The original fractured uniform."],
      ["ivory", "IVORY MANTLE", "Close the Clockwork Heart."],
      [
        "violet",
        "VIOLET MANTLE",
        "Win with five successful echo synchronizations.",
      ],
    ]) {
      const item = document.createElement("article"),
        h = document.createElement("h4"),
        p = document.createElement("p"),
        b = document.createElement("button");
      item.className = "collection-item";
      h.textContent = name;
      p.textContent = desc;
      b.textContent = A.save.progress.cosmetics.includes(id)
        ? cfg.cosmetic === id
          ? "EQUIPPED"
          : "EQUIP"
        : "UNDISCOVERED";
      b.disabled = !A.save.progress.cosmetics.includes(id);
      b.onclick = () => {
        cfg.cosmetic = id;
        preferences();
        collection();
      };
      item.append(h, p, b);
      mantles.append(item);
    }
    const mutations = section("MUTATION ARCHIVE");
    for (const m of A.mutations) {
      const item = document.createElement("article"),
        h = document.createElement("h4"),
        p = document.createElement("p");
      item.className = "collection-item";
      h.textContent = A.save.progress.mutations.includes(m.id)
        ? m.name
        : "UNDISCOVERED MUTATION";
      p.textContent = A.save.progress.mutations.includes(m.id)
        ? m.text
        : "A future run may offer this possibility.";
      item.append(h, p);
      mutations.append(item);
    }
    const stats = document.createElement("p");
    stats.className = "screen-note";
    stats.textContent = `${A.save.progress.runs} runs · ${A.save.progress.bossWins} Titan victories · ${A.save.progress.discoveries.length} memories · challenges: ${A.save.progress.challenges.join(", ") || "none completed"}`;
    root.append(stats);
    $("after-collection-back").focus();
  }
  function settings() {
    ui();
    settingsReturn = state === "playing" ? "paused" : state;
    if (state === "playing") pause();
    screen("settings");
    for (const key of [
      "quality",
      "shake",
      "reducedMotion",
      "reducedFlash",
      "assist",
      "sfx",
      "musicEnabled",
      "music",
    ]) {
      const el = $("after-setting-" + key);
      if (typeof cfg[key] === "boolean") el.checked = cfg[key];
      else el.value = cfg[key];
      el.onchange = () => {
        cfg[key] =
          el.type === "checkbox"
            ? el.checked
            : el.type === "range"
              ? Number(el.value)
              : el.value;
          if (key === "assist") {
            s.assist = cfg.assist;
            sceneHud();
          }
        preferences();
      };
    }
    $("after-settings-back").focus();
  }
  $("after-settings-back").onclick = () => {
    if (settingsReturn === "paused") {
      screen("playing");
      pause();
    } else if (["victory", "defeat", "upgrade"].includes(settingsReturn))
      screen(settingsReturn);
    else title();
  };
  $("after-start").onclick = () => start();
  $("after-practice").onclick = () => start(true);
  $("after-weapons").onclick = weapons;
  $("after-weapons-play").onclick = () => start();
  $("after-challenges").onclick = challenges;
  $("after-challenges-play").onclick = () => start();
  $("after-collection").onclick = collection;
  $("after-how").onclick = () => {
    ui();
    screen("how");
    $("after-how-back").focus();
  };
  $("after-how-play").onclick = () => start();
  $("after-settings").onclick = settings;
  for (const id of [
    "after-weapons-back",
    "after-how-back",
    "after-challenges-back",
    "after-collection-back",
    "after-modal-title-button",
  ])
    $(id).onclick = title;
  $("after-pause").onclick = pause;
  $("after-restart").onclick = restart;
  $("after-modal-retry").onclick = () => start(s.practice);
  $("after-modal-settings").onclick = settings;
  $("after-story").onclick = () => notice(s.scene.story);
  $("after-more-actions").onclick = () => {
    const extra = $("after-extra-touch");
    extra.hidden = !extra.hidden;
    $("after-more-actions").setAttribute(
      "aria-expanded",
      String(!extra.hidden),
    );
  };
  A.game = {
    start,
    title,
    pause,
    restart,
    weapons,
    challenges,
    collection,
    settings,
    get state() {
      return state;
    },
    get simulation() {
      return s;
    },
  };
  preferences();
  title();
  requestAnimationFrame(frame);
})();
