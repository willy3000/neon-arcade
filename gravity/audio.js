(() => {
  let context,
    muted = false;
  try {
    muted = localStorage.getItem("gravity-heist-muted") === "true";
  } catch {}
  const notes = {
    rotate: [380, 620, 0.12, "triangle"],
    magnet: [170, 330, 0.15, "sine"],
    death: [190, 25, 0.35, "sawtooth"],
    core: [600, 1200, 0.2, "sine"],
    switch: [320, 760, 0.18, "triangle"],
    portal: [180, 500, 0.4, "triangle"],
    win: [520, 1500, 0.5, "sine"],
    ui: [300, 450, 0.08, "sine"],
  };
  function unlock() {
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      context.resume().catch(() => {});
    } catch {}
  }
  function play(name) {
    if (muted || !context) return;
    const [from, to, duration, type] = notes[name] || notes.ui;
    const o = context.createOscillator(),
      g = context.createGain(),
      t = context.currentTime;
    o.type = type;
    o.connect(g);
    g.connect(context.destination);
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + duration);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.start(t);
    o.stop(t + duration + 0.03);
  }
  Heist.audio = {
    unlock,
    play,
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      try {
        localStorage.setItem("gravity-heist-muted", String(muted));
      } catch {}
      return muted;
    },
  };
})();
