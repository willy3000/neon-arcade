(() => {
  let context,
    sfxBus,
    musicBus,
    voices = 0,
    lastMusic = -99;
  function unlock() {
    try {
      if (!context) {
        context = new (window.AudioContext || window.webkitAudioContext)();
        sfxBus = context.createGain();
        musicBus = context.createGain();
        sfxBus.connect(context.destination);
        musicBus.connect(context.destination);
        sync();
      }
      if (context.state === "suspended") context.resume().catch(() => {});
    } catch {}
  }
  function sync() {
    if (!context) return;
    sfxBus.gain.setValueAtTime(
      Rift.save.settings.sfx ? 1 : 0,
      context.currentTime,
    );
    musicBus.gain.setValueAtTime(
      Rift.save.settings.music ? 1 : 0,
      context.currentTime,
    );
  }
  function tone(
    from,
    to,
    duration = 0.15,
    volume = 0.03,
    type = "triangle",
    music = false,
  ) {
    if (!context || context.state !== "running" || voices >= 16) return;
    const o = context.createOscillator(),
      g = context.createGain(),
      t = context.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(music ? musicBus : sfxBus);
    voices++;
    o.onended = () => {
      voices--;
      o.disconnect();
      g.disconnect();
    };
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  function play(e) {
    const n = e.type,
      volt = e.who === "volt" || e.from === "volt",
      pitch = volt ? 620 : 260;
    if (n === "light")
      tone(
        pitch * (1 + (e.step || 0) * 0.12),
        pitch * 0.45,
        0.1,
        0.025,
        "sawtooth",
      );
    else if (n === "heavy" || n === "hit")
      tone(
        n === "heavy" ? 160 : 230,
        45,
        n === "heavy" ? 0.23 : 0.1,
        0.035,
        "triangle",
      );
    else if (["fire", "explosion", "fusion-blast", "boss-death"].includes(n)) {
      tone(130, 25, 0.45, 0.05, "sawtooth");
      tone(330, 45, 0.25, 0.018);
    } else if (n === "lightning" || n === "arc")
      tone(1100, 180, 0.16, 0.025, "sawtooth");
    else if (n === "dash" || n === "grapple" || n === "release")
      tone(pitch, pitch * 2, 0.13, 0.022);
    else if (n === "jump") tone(pitch * 0.5, pitch, 0.14, 0.016);
    else if (n === "hurt" || n === "down") tone(170, 35, 0.2, 0.035, "square");
    else if (n === "warning" || n === "boss-warning")
      tone(220, 185, 0.25, 0.015, "square");
    else if (n === "victory" || n === "revive" || n === "checkpoint") {
      tone(440, 880, 0.6, 0.026);
      tone(660, 1320, 0.65, 0.018);
    } else if (n === "fusion") {
      tone(100, 660, 0.6, 0.045);
      tone(400, 1100, 0.55, 0.025);
    } else if (n === "defeat") tone(300, 50, 0.8, 0.03);
    else if (n === "relic" || n === "pickup" || n === "ui")
      tone(720, 1100, 0.13, 0.015);
  }
  function update(time, boss = false) {
    if (time < lastMusic) lastMusic = -99;
    if (!Rift.save.settings.music || time - lastMusic < 0.5) return;
    lastMusic = time;
    const seq = boss
        ? [110, 110, 130.81, 98, 110, 164.81, 130.81, 98]
        : [82.41, 123.47, 164.81, 123.47, 98, 146.83, 196, 146.83],
      n = seq[Math.floor(time * 2) % 8];
    tone(n, n * 1.001, 0.42, 0.012, "triangle", true);
    if (Math.floor(time * 2) % 2 === 0)
      tone(n * 2, n * 2, 0.35, 0.006, "sine", true);
  }
  Rift.audio = { unlock, sync, play, update };
})();
