(() => {
  let context,
    master,
    buses = {},
    voices = 0,
    lastBeat = -99;
  function unlock() {
    try {
      if (!context) {
        context = new (window.AudioContext || window.webkitAudioContext)();
        master = context.createGain();
        master.connect(context.destination);
        for (const name of ["ui", "movement", "combat", "ambience", "music"]) {
          buses[name] = context.createGain();
          buses[name].connect(master);
        }
        sync();
      }
      if (context.state === "suspended") context.resume().catch(() => {});
    } catch {}
  }
  function sync() {
    if (!context) return;
    const c = Afterstrike.save.settings;
    for (const [name, g] of Object.entries(buses))
      g.gain.setValueAtTime(
        name === "music" ? (c.musicEnabled ? c.music : 0) : c.sfx,
        context.currentTime,
      );
    master.gain.setValueAtTime(0.65, context.currentTime);
  }
  function tone(
    group,
    from,
    to,
    duration = 0.16,
    volume = 0.05,
    type = "triangle",
  ) {
    if (!context || context.state !== "running" || voices >= 20) return;
    const t = context.currentTime,
      o = context.createOscillator(),
      g = context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(25, to), t + duration);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(buses[group]);
    voices++;
    o.onended = () => {
      voices--;
      o.disconnect();
      g.disconnect();
    };
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  function event(e) {
    const type = e.type,
      pitch = e.weapon === "gauntlets" ? 180 : e.weapon === "chain" ? 480 : 350;
    if (type === "light")
      tone(
        "combat",
        pitch,
        pitch * 0.5,
        0.1,
        0.04,
        e.weapon === "chain" ? "sine" : "sawtooth",
      );
    else if (type === "hit" || type === "heavy" || type === "charged")
      tone("combat", type === "hit" ? 140 : 180, 45, 0.16, 0.07);
    else if (type === "foot") tone("movement", 90, 45, 0.045, 0.012);
    else if (type === "jump" || type === "dash" || type === "snap")
      tone("movement", type === "jump" ? 200 : 330, 650, 0.12, 0.025);
    else if (type === "land")
      tone("movement", 110, 45, 0.1, e.strong ? 0.04 : 0.02);
    else if (type === "parry") {
      tone("combat", 900, 1500, 0.17, 0.05);
      tone("combat", 400, 900, 0.12, 0.025);
    } else if (type === "echo" || type === "sync" || type === "intercept") {
      tone("combat", type === "echo" ? 320 : 620, 1100, 0.35, 0.035, "sine");
      tone("ambience", 550, 320, 0.4, 0.016, "sine");
    } else if (
      ["collapse", "afterstorm", "slam", "boss-death"].includes(type)
    ) {
      tone("combat", 130, 30, 0.45, 0.08, "sawtooth");
      tone("combat", 360, 100, 0.3, 0.025);
    } else if (type === "zero-hour")
      tone("combat", 560, 80, 0.7, 0.045, "sine");
    else if (type === "hurt" || type === "death")
      tone("combat", 150, 35, type === "death" ? 0.8 : 0.25, 0.04);
    else if (type === "warning" || type === "boss-warning")
      tone("combat", 230, 200, 0.3, 0.025, "square");
    else if (type === "anchor" || type === "release")
      tone("movement", 440, 900, 0.12, 0.025);
    else if (type === "victory") {
      tone("ui", 440, 880, 0.7, 0.045);
      tone("ui", 660, 990, 0.75, 0.028);
    } else if (type === "ui" || type === "relic" || type === "heal")
      tone("ui", 720, 1050, 0.14, 0.03);
  }
  function update(time, boss = false) {
    if (time < lastBeat) lastBeat = -99;
    if (!Afterstrike.save.settings.musicEnabled || time - lastBeat < 0.65)
      return;
    lastBeat = time;
    const seq = boss
        ? [98, 123.47, 146.83, 123.47]
        : [82.41, 110, 123.47, 164.81],
      n = seq[Math.floor(time / 0.65) % 4];
    tone("music", n, n, 0.6, 0.08, "triangle");
    tone("ambience", n * 2, n * 2, 0.55, 0.008, "sine");
  }
  function pause() {
    if (context) master.gain.setValueAtTime(0, context.currentTime);
  }
  Afterstrike.audio = {
    unlock,
    sync,
    event,
    update,
    pause,
    get voices() {
      return voices;
    },
  };
})();
