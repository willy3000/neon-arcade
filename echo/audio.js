(() => {
  let context,
    muted = false,
    voices = 0;
  try {
    muted = localStorage.getItem("echo-forge-muted") === "true";
  } catch {}
  function unlock() {
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === "suspended") context.resume().catch(() => {});
    } catch {}
  }
  function tone(from, to, duration = 0.2, type = "sine", volume = 0.045) {
    if (muted || !context || context.state !== "running" || voices >= 12)
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
    g.gain.linearRampToValueAtTime(volume, t + 0.015);
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
  function play(event, frequency = "MID") {
    const pitch = Echo.physics.frequencies[frequency].pitch;
    if (event === "pulse")
      tone(
        pitch,
        pitch * 0.65,
        0.36,
        frequency === "LOW" ? "triangle" : "sine",
      );
    else if (event === "resonance") {
      tone(pitch, pitch * 1.5, 0.25);
      tone(pitch * 2, pitch * 2.5, 0.3, "sine", 0.025);
    } else if (event === "reflection")
      tone(pitch * 0.8, pitch * 0.45, 0.25, "sine", 0.025);
    else if (event === "win") {
      tone(440, 880, 0.65);
      tone(660, 1320, 0.7, "sine", 0.025);
    } else if (["activation", "fragment"].includes(event))
      tone(900, 1500, 0.25);
    else if (event === "shatter") tone(1100, 320, 0.2, "triangle", 0.025);
    else if (["switch", "platform"].includes(event)) tone(340, 640, 0.18);
    else if (event === "ui") tone(300, 430, 0.08, "sine", 0.025);
  }
  Echo.audio = {
    unlock,
    play,
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      try {
        localStorage.setItem("echo-forge-muted", String(muted));
      } catch {}
      return muted;
    },
  };
})();
