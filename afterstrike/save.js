(() => {
  const A = Afterstrike,
    read = (k, f) => {
      try {
        return JSON.parse(localStorage.getItem(k)) || f;
      } catch {
        return f;
      }
    };
  const defaults = {
      quality: "medium",
      shake: 0.45,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      reducedFlash: false,
      assist: false,
      weapon: "blade",
      cosmetic: "ash",
      sfx: 0.55,
      music: 0.18,
      musicEnabled: false,
      challenge: "standard",
    },
    raw = read("afterstrike-settings", {}),
    settings = { ...defaults };
  for (const k of ["assist", "reducedMotion", "reducedFlash", "musicEnabled"])
    if (typeof raw[k] === "boolean") settings[k] = raw[k];
  for (const k of ["shake", "sfx", "music"])
    if (Number.isFinite(raw[k])) settings[k] = Math.max(0, Math.min(1, raw[k]));
  if (["low", "medium", "high"].includes(raw.quality))
    settings.quality = raw.quality;
  if (A.weapons[raw.weapon]) settings.weapon = raw.weapon;
  if (["ash", "ivory", "violet"].includes(raw.cosmetic))
    settings.cosmetic = raw.cosmetic;
  if (
    ["standard", "time-trial", "fragile", "overclock"].includes(raw.challenge)
  )
    settings.challenge = raw.challenge;
  const stored = read("afterstrike-progress", {}),
    progress = {
      version: 1,
      weapons: ["blade"],
      cosmetics: ["ash"],
      mutations: [],
      bossWins: 0,
      runs: 0,
      best: {},
      challenges: [],
      discoveries: [],
    };
  for (const key of [
    "weapons",
    "cosmetics",
    "mutations",
    "challenges",
    "discoveries",
  ])
    if (Array.isArray(stored[key]))
      progress[key] = [
        ...new Set(stored[key].filter((v) => typeof v === "string")),
      ];
  progress.weapons = [
    ...new Set(["blade", ...progress.weapons.filter((w) => A.weapons[w])]),
  ];
  progress.cosmetics = [
    ...new Set([
      "ash",
      ...progress.cosmetics.filter((c) =>
        ["ash", "ivory", "violet"].includes(c),
      ),
    ]),
  ];
  progress.mutations = progress.mutations.filter((m) =>
    A.mutations.some((v) => v.id === m),
  );
  for (const key of ["bossWins", "runs"])
    progress[key] = Math.floor(Math.max(0, Number(stored[key]) || 0));
  if (stored.best && typeof stored.best === "object")
    for (const [k, r] of Object.entries(stored.best))
      if (
        r &&
        Number.isFinite(r.time) &&
        r.time >= 0 &&
        Number.isFinite(r.score) &&
        r.score >= 0
      )
        progress.best[k] = {
          time: r.time,
          score: r.score,
          combo: Math.max(0, Number(r.combo) || 0),
        };
  if (!progress.weapons.includes(settings.weapon)) settings.weapon = "blade";
  if (!progress.cosmetics.includes(settings.cosmetic))
    settings.cosmetic = "ash";
  const write = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  };
  function discover(s) {
    progress.mutations = [...new Set([...progress.mutations, ...s.build])];
    progress.discoveries = [...new Set([...progress.discoveries, ...s.found])];
    if (s.stage >= 1 && !progress.weapons.includes("gauntlets"))
      progress.weapons.push("gauntlets");
    if (s.stage >= 2 && !progress.weapons.includes("chain"))
      progress.weapons.push("chain");
    write("afterstrike-progress", progress);
  }
  function summary(s) {
    progress.runs++;
    discover(s);
    const unlocks = [];
    if (s.won && !s.practice) {
      progress.bossWins++;
      if (!progress.cosmetics.includes("ivory")) {
        progress.cosmetics.push("ivory");
        unlocks.push("IVORY MANTLE");
      }
      if (s.syncs >= 5 && !progress.cosmetics.includes("violet")) {
        progress.cosmetics.push("violet");
        unlocks.push("VIOLET MANTLE");
      }
      const key = s.challenge + (s.assist ? "-assist" : ""),
        r = progress.best[key];
      progress.best[key] = {
        time: r ? Math.min(r.time, s.time) : s.time,
        score: r ? Math.max(r.score, Math.floor(s.score)) : Math.floor(s.score),
        combo: r ? Math.max(r.combo, s.maxCombo) : s.maxCombo,
      };
      if (!s.assist) {
        if (s.challenge !== "standard")
          progress.challenges = [
            ...new Set([...progress.challenges, s.challenge]),
          ];
        if (s.damage === 0)
          progress.challenges = [
            ...new Set([...progress.challenges, "untouched"]),
          ];
        if (s.syncs >= 8)
          progress.challenges = [
            ...new Set([...progress.challenges, "synchronist"]),
          ];
      }
    }
    write("afterstrike-progress", progress);
    return unlocks;
  }
  A.save = {
    settings,
    progress,
    discover,
    summary,
    saveSettings: () => write("afterstrike-settings", settings),
  };
})();
