(() => {
  let context,
    muted = false,
    music = false,
    lastNote = -99,
    voices = 0;
  try {
    muted = localStorage.getItem("phasebound-muted") === "true";
    music = localStorage.getItem("phasebound-music") === "true";
  } catch {}
  function unlock() {
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === "suspended") context.resume().catch(() => {});
    } catch {}
  }
  function tone(from, to, duration = 0.18, volume = 0.045, type = "sine") {
    if (muted || !context || context.state !== "running" || voices >= 10)
      return;
    const o = context.createOscillator(),
      g = context.createGain(),
      t = context.currentTime;
    o.type = type;
    o.connect(g);
    g.connect(context.destination);
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + duration);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    voices++;
    o.onended = () => {
      voices--;
      o.disconnect();
      g.disconnect();
    };
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  function play(name, who = "both") {
    const pitch = who === "kai" ? 280 : who === "luma" ? 530 : 400;
    if (name === "jump") tone(pitch, pitch * 1.7, 0.15, 0.035, "triangle");
    else if (name === "land") tone(pitch * 0.7, pitch * 0.35, 0.1, 0.025);
    else if (name === "switch" || name === "plate" || name === "brace")
      tone(330, 660, 0.17);
    else if (name === "link") {
      tone(330, 880, 0.35);
      tone(440, 1100, 0.4, 0.025);
    } else if (name === "unlink") tone(550, 220, 0.2);
    else if (name === "crystal") tone(820, 1400, 0.22);
    else if (name === "portal") tone(pitch, 900, 0.35);
    else if (name === "checkpoint") tone(400, 800, 0.4);
    else if (name === "win") {
      tone(440, 880, 0.7);
      tone(660, 1320, 0.7, 0.025);
    } else if (name === "death") tone(200, 45, 0.3, 0.04, "triangle");
    else if (name === "ui") tone(300, 420, 0.08, 0.025);
  }
  Phasebound.audio = {
    unlock,
    play,
    update(time) {
      if (time < lastNote) lastNote = -99;
      if (!music || time - lastNote < 3) return;
      lastNote = time;
      const notes = [130.81, 164.81, 196, 220, 261.63],
        note = notes[Math.floor(time / 3) % notes.length];
      tone(note, note * 1.002, 2.5, 0.013);
      tone(note * 1.5, note * 1.498, 2.5, 0.008);
    },
    get muted() {
      return muted;
    },
    get music() {
      return music;
    },
    mute() {
      muted = !muted;
      try {
        localStorage.setItem("phasebound-muted", String(muted));
      } catch {}
    },
    toggleMusic() {
      music = !music;
      lastNote = -99;
      try {
        localStorage.setItem("phasebound-music", String(music));
      } catch {}
    },
  };
})();
