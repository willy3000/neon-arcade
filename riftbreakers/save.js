(() => {
  const defaults = {
    sfx: true,
    music: false,
    quality: "medium",
    shake: 0.6,
    reducedFlash: false,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    shortFusion: false,
    touchScale: 1,
    selected: "blaze",
    mode: matchMedia("(pointer: coarse)").matches ? "solo" : "coop",
    bindings: {
      blaze: {
        left: "a",
        right: "d",
        jump: "w",
        dash: "s",
        light: "f",
        heavy: "t",
        special: "g",
        ultimate: "j",
        grapple: "y",
        fusion: "h",
      },
      volt: {
        left: "ArrowLeft",
        right: "ArrowRight",
        jump: "ArrowUp",
        dash: "ArrowDown",
        light: "k",
        heavy: "o",
        special: "l",
        ultimate: "p",
        grapple: "i",
        fusion: ";",
      },
    },
  };
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  };
  const raw = read("riftbreakers-settings", {}),
    settings = { ...defaults };
  for (const k of [
    "sfx",
    "music",
    "reducedFlash",
    "reducedMotion",
    "shortFusion",
  ])
    if (typeof raw[k] === "boolean") settings[k] = raw[k];
  if (["low", "medium", "high"].includes(raw.quality))
    settings.quality = raw.quality;
  for (const k of ["shake", "touchScale"])
    if (Number.isFinite(raw[k]))
      settings[k] = Math.max(
        k === "shake" ? 0 : 0.8,
        Math.min(k === "shake" ? 1 : 1.3, raw[k]),
      );
  if (["blaze", "volt"].includes(raw.selected))
    settings.selected = raw.selected;
  if (["solo", "coop"].includes(raw.mode)) settings.mode = raw.mode;
  const reserved = ["Escape", "r", "x", "Tab", "Enter", " "];
  for (const who of ["blaze", "volt"]) {
    settings.bindings[who] = { ...defaults.bindings[who] };
    for (const action of Object.keys(settings.bindings[who])) {
      const key = raw.bindings?.[who]?.[action];
      if (typeof key === "string" && key.length < 20 && !reserved.includes(key))
        settings.bindings[who][action] = key;
    }
  }
  const records = Array.from({ length: 9 }, () => ({
      stars: 0,
      time: null,
      score: 0,
      kills: 0,
      damage: null,
      relics: [],
    })),
    stored = read("riftbreakers-progress", []);
  if (Array.isArray(stored))
    for (let i = 0; i < 9; i++) {
      const r = stored[i];
      if (!r || typeof r !== "object") continue;
      records[i] = {
        stars: Math.floor(Math.max(0, Math.min(3, Number(r.stars) || 0))),
        time: Number.isFinite(r.time) && r.time >= 0 ? r.time : null,
        score: Math.max(0, Number(r.score) || 0),
        kills: Math.max(0, Number(r.kills) || 0),
        damage: Number.isFinite(r.damage) && r.damage >= 0 ? r.damage : null,
        relics: Array.isArray(r.relics)
          ? [
              ...new Set(
                r.relics.filter(
                  (n) =>
                    Number.isInteger(n) &&
                    n >= 0 &&
                    n < Rift.levels[i].relics.length,
                ),
              ),
            ]
          : [],
      };
    }
  const write = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  };
  function finish(s) {
    const r = records[s.level.id],
      stars =
        1 +
        (s.collected.size === s.level.relics.length ? 1 : 0) +
        (s.time <= s.level.time && s.damage <= 100 && s.falls === 0 ? 1 : 0);
    r.stars = Math.max(r.stars, stars);
    r.time = r.time === null ? s.time : Math.min(r.time, s.time);
    r.score = Math.max(r.score, Math.floor(s.score));
    r.kills = Math.max(r.kills, s.kills);
    r.damage = r.damage === null ? s.damage : Math.min(r.damage, s.damage);
    r.relics = [...new Set([...r.relics, ...s.collected])];
    write("riftbreakers-progress", records);
    return stars;
  }
  Rift.save = {
    settings,
    records,
    finish,
    saveSettings: () => write("riftbreakers-settings", settings),
    unlocked: (i) => i >= 0 && i < 9 && (i === 0 || records[i - 1].stars > 0),
    defaults: () => JSON.parse(JSON.stringify(defaults)),
  };
})();
