(() => {
  const pool = Array.from({ length: 360 }, () => ({ life: 0 }));
  let cursor = 0,
    rings = [],
    numbers = [];
  function burst(x, y, color, count = 18) {
    const cfg = Afterstrike.save.settings,
      cap = cfg.quality === "high" ? 360 : cfg.quality === "low" ? 60 : 180;
    count = cfg.reducedMotion ? Math.min(3, count) : count;
    for (let i = 0; i < count; i++) {
      const p = pool[cursor++ % cap],
        angle = Math.random() * Math.PI * 2,
        speed = 30 + Math.random() * 150;
      Object.assign(p, {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.3 + Math.random() * 0.35,
        size: 1 + Math.random() * 2,
        color,
      });
    }
  }
  function event(e) {
    const color = e.echo
      ? "#96e6f2"
      : ["hurt", "enemy-warning"].includes(e.type)
        ? "#eb8397"
        : ["echo", "intercept", "sync", "collapse"].includes(e.type)
          ? "#96e6f2"
          : "#ffa89b";
    if (e.type === "notice" || e.type === "encounter") return;
    burst(
      e.x ?? 0,
      e.y ?? 0,
      color,
      e.type === "foot"
        ? 2
        : e.type === "afterstorm" || e.type === "boss-death"
          ? 55
          : 18,
    );
    if (
      [
        "echo",
        "sync",
        "collapse",
        "afterstorm",
        "zero-hour",
        "guard-break",
        "boss-death",
        "slam",
        "snap",
        "parry",
      ].includes(e.type)
    )
      rings.push({
        x: e.x,
        y: e.y,
        r: e.r || 60,
        t: 0,
        life: e.type === "boss-death" ? 1.1 : 0.55,
        color,
      });
    if (e.type === "hit")
      numbers.push({ x: e.x, y: e.y - 14, t: 0.6, value: e.amount, color });
    rings = rings.slice(-24);
    numbers = numbers.slice(-24);
  }
  function update(dt) {
    for (const p of pool)
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 230 * dt;
      }
    rings.forEach((r) => (r.t += dt));
    rings = rings.filter((r) => r.t < r.life);
    numbers.forEach((n) => {
      n.t -= dt;
      n.y -= 30 * dt;
    });
    numbers = numbers.filter((n) => n.t > 0);
  }
  function draw(ctx) {
    ctx.save();
    ctx.shadowBlur = 0;
    for (const p of pool)
      if (p.life > 0) {
        ctx.globalAlpha = Math.min(0.7, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    for (const r of rings) {
      ctx.globalAlpha = (1 - r.t / r.life) * 0.6;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(1, (r.r * r.t) / r.life), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = "700 12px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    for (const n of numbers) {
      ctx.globalAlpha = Math.min(1, n.t * 3);
      ctx.fillStyle = n.color;
      ctx.fillText(n.value, n.x, n.y);
    }
    ctx.restore();
  }
  Afterstrike.effects = {
    event,
    update,
    draw,
    reset() {
      pool.forEach((p) => (p.life = 0));
      rings = [];
      numbers = [];
    },
    get active() {
      return pool.filter((p) => p.life > 0).length;
    },
  };
})();
