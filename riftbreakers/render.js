/* Original procedural warriors, authored scenery and bounded, gameplay-independent FX. */
(() => {
  const canvas = document.getElementById("rift-world"),
    ctx = canvas.getContext("2d"),
    P = Rift.physics;
  const colors = {
    blaze: "#ff9b54",
    volt: "#70f5eb",
    enemy: "#f5708e",
    rift: "#ae86ff",
  };
  const pool = Array.from({ length: 420 }, () => ({ life: 0 }));
  let cursor = 0,
    fx = [],
    numbers = [],
    ghosts = [],
    shake = 0,
    flash = 0,
    camera = { x: 0, y: 0, zoom: 1 },
    cw = 1080,
    ch = 600,
    scale = 1,
    ox = 0,
    oy = 0,
    dpr = 1;
  const settings = () => Rift.save.settings;
  function resize() {
    const b = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    cw = Math.max(1, b.width);
    ch = Math.max(1, b.height);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    scale = Math.min(cw / 1080, ch / 600);
    ox = (cw - 1080 * scale) / 2;
    oy = (ch - 600 * scale) / 2;
  }
  function burst(x, y, color, n = 18) {
    const cfg = settings(),
      cap = cfg.quality === "high" ? 420 : cfg.quality === "low" ? 100 : 240;
    n = cfg.reducedMotion ? Math.min(4, n) : Math.min(n, cap);
    for (let i = 0; i < n; i++) {
      const p = pool[cursor++ % cap],
        angle = Math.random() * Math.PI * 2,
        speed = 40 + Math.random() * 180;
      Object.assign(p, {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.25 + Math.random() * 0.45,
        color,
        size: 1 + Math.random() * 3,
      });
    }
  }
  function event(e) {
    const color = colors[e.who] || colors[e.from] || colors.rift;
    if (e.type === "foot") {
      burst(e.x, e.y, color, 3);
      return;
    }
    if (
      e.type === "notice" ||
      e.type === "wave" ||
      e.type === "warning" ||
      e.type === "enemy-windup"
    )
      return;
    burst(
      e.x,
      e.y,
      color,
      ["explosion", "fusion-blast", "boss-death", "fire"].includes(e.type)
        ? 65
        : 15,
    );
    if (e.type === "hit") {
      numbers.push({ x: e.x, y: e.y - 20, t: 0.65, value: e.value, color });
      shake = Math.max(shake, e.kind === "heavy" ? 5 : 2);
    }
    if (
      [
        "fire",
        "lightning",
        "explosion",
        "fusion-blast",
        "danger",
        "boss-death",
        "generator",
        "land",
        "phase",
      ].includes(e.type)
    ) {
      fx.push({
        ...e,
        t: 0,
        life: e.type === "boss-death" ? 1.4 : 0.6,
        color,
        radius: e.radius || 65,
      });
      if (e.type !== "land") {
        shake = Math.max(shake, e.type === "fusion-blast" ? 12 : 6);
        flash = Math.max(flash, 0.18);
      }
    }
    if (e.type === "arc") fx.push({ ...e, t: 0, life: 0.24, color });
    fx = fx.slice(-35);
    numbers = numbers.slice(-24);
  }
  function update(dt, s) {
    shake *= Math.exp(-12 * dt);
    flash = Math.max(0, flash - dt);
    for (const p of pool)
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 220 * dt;
      }
    fx.forEach((f) => (f.t += dt));
    fx = fx.filter((f) => f.t < f.life);
    numbers.forEach((n) => {
      n.t -= dt;
      n.y -= dt * 42;
    });
    numbers = numbers.filter((n) => n.t > 0);
    ghosts.forEach((g) => (g.life -= dt));
    ghosts = ghosts.filter((g) => g.life > 0);
    if (s) {
      const cfg = settings();
      for (const h of s.heroes)
        if (
          h.action?.kind === "dash" &&
          !cfg.reducedMotion &&
          ghosts.length < 24
        )
          ghosts.push({ x: h.x, y: h.y, who: h.who, life: 0.18 });
      const alive = s.heroes.filter((h) => h.hp > 0),
        mid =
          alive.reduce((a, h) => a + h.x + h.w / 2, 0) / (alive.length || 1),
        distance = alive.length > 1 ? Math.abs(alive[0].x - alive[1].x) : 0;
      const zoom =
        s.mode === "coop"
          ? Math.max(0.45, Math.min(1, 1000 / (distance + 200)))
          : 1;
      camera.zoom += (zoom - camera.zoom) * Math.min(1, dt * 4);
      const vw = 1080 / camera.zoom;
      const target = Math.max(0, Math.min(s.level.width - vw, mid - vw * 0.48));
      camera.x += (target - camera.x) * Math.min(1, dt * 7);
      camera.y = 600 - 600 / camera.zoom;
    }
  }
  function glow(color, amount = 10) {
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur =
      settings().quality === "low" || settings().reducedFlash ? 0 : amount;
  }
  function line(x1, y1, x2, y2, color, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function text(value, x, y, color = "#91a3b4", size = 10) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = `600 ${size}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(value, x, y);
  }
  function ring(x, y, r, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    glow(color, 9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  function poly(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  function background(s, t) {
    ctx.fillStyle =
      s.level.theme === "lab"
        ? "#0c1725"
        : s.level.theme === "void"
          ? "#100e21"
          : "#101321";
    ctx.fillRect(0, 0, 1080, 600);
    const reduced = settings().reducedMotion;
    for (let layer = 0; layer < 3; layer++) {
      const offset = camera.x * (0.08 + layer * 0.13),
        spacing = layer === 0 ? 220 : 140;
      ctx.fillStyle = ["#191d30", "#202133", "#28283a"][layer];
      for (let x = -spacing; x < 1080 + spacing; x += spacing) {
        const px = x - (offset % spacing),
          height = 140 + (Math.sin(x * 13 + layer) * 0.5 + 0.5) * 210;
        ctx.fillRect(px, 510 - height, spacing * 0.65, height);
        if (layer === 2) {
          ctx.fillStyle = "#ffac7022";
          for (let y = 520 - height; y < 500; y += 45)
            ctx.fillRect(px + 12, y, 6, 16);
          ctx.fillStyle = "#28283a";
        }
      }
    }
    ctx.strokeStyle = "#ab81ff22";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(690, 0);
    ctx.lineTo(645, 140);
    ctx.lineTo(720, 195);
    ctx.lineTo(670, 320);
    ctx.stroke();
    for (let i = 0; i < 20; i++) {
      const x = (i * 137 + (reduced ? 0 : t * 8)) % 1080,
        y = (i * 89 + (reduced ? 0 : t * 4)) % 510;
      ctx.fillStyle = i % 3 ? "#ff9b5444" : "#ae86ff55";
      ctx.fillRect(x, y, 2, 2);
    }
    const flare = reduced ? 0.5 : 0.45 + Math.sin(t * 0.8) * 0.1;
    ring(720, 195, 75, "#ae86ff", flare);
    ring(720, 195, 95, "#ae86ff", 0.12);
    ctx.fillStyle = "#070c1588";
    ctx.fillRect(0, 520, 1080, 80);
  }
  function tile(t, moving = false) {
    ctx.fillStyle = moving ? "#25424e" : "#303644";
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = moving ? "#70f5eb" : "#98a2aa";
    ctx.fillRect(t.x, t.y, t.w, 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#1c2330";
    for (let x = t.x + 12; x < t.x + t.w - 12; x += 60) {
      ctx.fillRect(x, t.y + 12, 36, 4);
      if (t.h > 40) ctx.fillRect(x, t.y + 30, 6, 20);
    }
    if (t.h > 40) {
      ctx.fillStyle = "#ff9b5422";
      ctx.fillRect(t.x, t.y + 4, t.w, 3);
    }
  }
  function warrior(h, t, selected) {
    const cfg = settings(),
      color = colors[h.who],
      action = h.action,
      run = h.state === "run",
      phase = cfg.reducedMotion
        ? 0
        : Math.sin(t * (h.who === "volt" ? 22 : 17)),
      dash = h.state === "dash",
      down = h.hp <= 0,
      air = !h.grounded;
    ctx.save();
    ctx.translate(h.x + h.w / 2, h.y + h.h / 2);
    ctx.scale(h.facing, 1);
    if (h.flash > 0 && !cfg.reducedFlash) ctx.globalAlpha = 0.65;
    if (down) ctx.rotate(-Math.PI / 2);
    else if (dash) ctx.rotate(0.32);
    const bob = run
      ? Math.abs(phase) * 1.5
      : cfg.reducedMotion
        ? 0
        : Math.sin(t * 3) * 0.6;
    ctx.translate(0, bob);
    // Animated feet, articulated limbs and cape occupy the hero's gameplay silhouette.
    ctx.lineCap = "round";
    line(
      -5,
      10,
      -6 + (run ? phase * 9 : air ? -8 : 0),
      20 - (air ? 8 : 0),
      "#526072",
      6,
    );
    line(
      5,
      10,
      6 - (run ? phase * 9 : air ? -9 : 0),
      20 - (air ? 7 : 0),
      "#526072",
      6,
    );
    if (h.who === "blaze") {
      poly(
        [
          [-10, -12],
          [-19, -20],
          [-16, -3],
          [-23, 5],
          [-9, 2],
        ],
        "#a94a38",
      );
      poly(
        [
          [-11, -13],
          [8, -13],
          [13, 7],
          [7, 13],
          [-9, 12],
          [-14, -2],
        ],
        "#38424f",
      );
      glow(color, 5);
      poly(
        [
          [-9, -10],
          [0, -7],
          [9, -10],
          [7, -3],
          [0, 2],
          [-7, -3],
        ],
        color,
      );
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#242c39";
      ctx.fillRect(-9, -23, 18, 14);
      poly(
        [
          [-10, -22],
          [-7, -30],
          [0, -25],
          [6, -31],
          [10, -18],
        ],
        "#e75b3a",
      );
      glow("#ffe4a5", 4);
      ctx.fillRect(0, -18, 7, 3);
    } else {
      poly(
        [
          [-9, -14],
          [-18, -3],
          [-25, 14],
          [-8, 9],
          [5, 12],
          [11, -4],
        ],
        "#163e51",
      );
      poly(
        [
          [-7, -12],
          [9, -12],
          [10, 8],
          [4, 13],
          [-5, 11],
          [-11, -3],
        ],
        "#344756",
      );
      glow(color, 5);
      line(-6, -6, 7, 3, color, 3);
      poly(
        [
          [-10, -19],
          [-6, -28],
          [5, -27],
          [12, -17],
          [5, -10],
          [-8, -11],
        ],
        "#234854",
      );
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#70f5eb";
      ctx.fillRect(1, -20, 7, 3);
    }
    ctx.shadowBlur = 0;
    line(-9, -6, -12 + (run ? phase * 3 : 0), 4, "#6a7685", 5);
    let angle = -0.85;
    if (
      action &&
      ["light", "heavy", "special", "ultimate"].includes(action.kind)
    ) {
      const progress = Math.max(
        0,
        Math.min(1, (action.t - action.start) / action.active),
      );
      angle =
        action.kind === "heavy"
          ? -2.2 + progress * 3.1
          : action.kind === "light"
            ? -1.7 + (action.step % 2 ? 1 : -1) * progress * 3.2
            : -0.35;
      if (h.state === "attack-active" || h.state === "ultimate") {
        ctx.save();
        glow(color, 15);
        ctx.lineWidth = h.who === "blaze" ? 5 : 3;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(
          4,
          -5,
          action.kind === "heavy" ? 72 : 57,
          angle - 0.6,
          angle + 0.7,
        );
        ctx.stroke();
        ctx.restore();
      }
    }
    const armX = 6 + Math.cos(angle) * 14,
      armY = -5 + Math.sin(angle) * 14;
    line(7, -7, armX, armY, "#8993a0", 5);
    ctx.save();
    ctx.translate(armX, armY);
    ctx.rotate(angle);
    glow(color, 8);
    poly(
      [
        [0, -3],
        [h.who === "blaze" ? 49 : 31, -2],
        [h.who === "blaze" ? 59 : 39, 0],
        [h.who === "blaze" ? 49 : 31, 4],
        [0, 4],
      ],
      color,
    );
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d4dbe0";
    ctx.fillRect(2, -2, h.who === "blaze" ? 40 : 25, 2);
    ctx.restore();
    if (h.who === "volt") {
      line(-10, 4, -29, 13, color, 3);
    }
    ctx.restore();
    if (selected === h.who) {
      poly(
        [
          [h.x + 8, h.y - 12],
          [h.x + 18, h.y - 12],
          [h.x + 13, h.y - 7],
        ],
        color,
      );
    }
    if (h.hp <= 0) {
      text(
        `REVIVE ${Math.ceil(h.downTimer)}s`,
        h.x + 13,
        h.y - 23,
        "#f5708e",
        10,
      );
      ctx.fillStyle = "#263647";
      ctx.fillRect(h.x - 12, h.y - 16, 50, 3);
      ctx.fillStyle = color;
      ctx.fillRect(h.x - 12, h.y - 16, (50 * h.revive) / 1.45, 3);
    }
    if (h.grapple) {
      line(h.x + 13, h.y + 10, h.grapple.x, h.grapple.y, color, 2);
      ring(h.grapple.x, h.grapple.y, 10, color, 0.6);
    }
  }
  function foe(e, t) {
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    ctx.scale(e.facing || 1, 1);
    if (e.hp <= 0) {
      ctx.globalAlpha = Math.max(0, e.deadTime / 0.65);
      ctx.rotate((0.65 - e.deadTime) * 3);
    }
    if (e.flash > 0 && !settings().reducedFlash) ctx.globalAlpha = 0.55;
    const color = e.boss
        ? "#b595ff"
        : e.type === "guard"
          ? "#caa6ff"
          : "#f5708e",
      stride = settings().reducedMotion ? 0 : Math.sin(t * 12 + e.home),
      active = e.state === "windup";
    if (e.type === "warden") {
      ctx.fillStyle = "#394454";
      ctx.fillRect(-40, -40, 80, 68);
      ctx.fillStyle = "#56616c";
      ctx.fillRect(-34, -48, 68, 19);
      ctx.fillStyle = "#151f2a";
      ctx.fillRect(-17, -37, 34, 20);
      glow(e.state === "recover" ? "#ffdd8a" : "#f5708e", 8);
      ctx.fillRect(-10, -27, 20, 5);
      ring(0, 0, 13, e.state === "recover" ? "#ffdd8a" : "#f5708e");
      ctx.shadowBlur = 0;
      line(-36, -10, -56, active ? -35 : 23, "#637180", 18);
      line(35, -10, 54, active ? -36 : 23, "#637180", 18);
      line(-20, 30, -22, 47, "#687786", 16);
      line(20, 30, 22, 47, "#687786", 16);
    } else if (e.type === "serpent") {
      for (let i = 7; i > 0; i--) {
        ctx.fillStyle = i % 2 ? "#403766" : "#60507f";
        ctx.beginPath();
        ctx.ellipse(
          -i * 28,
          Math.sin(t * 2 - i * 0.5) * 18,
          20,
          24 - i,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        poly(
          [
            [-i * 28, -23],
            [-i * 28 - 8, -36],
            [-i * 28 + 9, -24],
          ],
          "#b78cff",
        );
      }
      poly(
        [
          [-31, -25],
          [10, -36],
          [36, -14],
          [24, 18],
          [-26, 27],
          [-39, 5],
        ],
        "#685085",
      );
      glow(active ? "#ff7993" : "#ffd09a", 9);
      poly(
        [
          [4, -16],
          [29, -14],
          [18, -6],
        ],
        active ? "#ff7993" : "#ffd09a",
      );
      ctx.shadowBlur = 0;
      line(21, 13, 37, 10, "#a58ac5", 4);
    } else if (e.type === "emperor") {
      poly(
        [
          [-22, -18],
          [-35, 33],
          [0, 41],
          [34, 33],
          [21, -18],
        ],
        e.phase === 3 ? "#613051" : "#3c3159",
      );
      poly(
        [
          [-20, -25],
          [19, -25],
          [24, 14],
          [0, 26],
          [-24, 14],
        ],
        "#60607a",
      );
      poly(
        [
          [-19, -34],
          [-23, -52],
          [-8, -43],
          [0, -59],
          [9, -43],
          [23, -52],
          [18, -32],
        ],
        "#bb91e9",
      );
      glow("#fbd4ae", 8);
      ctx.fillRect(-11, -28, 22, 4);
      line(21, -7, 61, 23, "#c5a6ff", 5);
      ctx.shadowBlur = 0;
      ring(0, 0, 49, "#a176f8", 0.2);
    } else {
      line(-7, 12, -9 + stride * 4, 20, "#687083", 5);
      line(7, 12, 9 - stride * 4, 20, "#687083", 5);
      poly(
        [
          [-13, -12],
          [9, -15],
          [15, 7],
          [5, 14],
          [-10, 12],
        ],
        "#414155",
      );
      ctx.fillStyle = "#665068";
      ctx.fillRect(-10, -23, 20, 14);
      glow(color, 4);
      ctx.fillRect(0, -18, 9, 3);
      ctx.shadowBlur = 0;
      if (e.type === "grunt") {
        poly(
          [
            [-11, -23],
            [-18, -31],
            [-16, -16],
          ],
          color,
        );
        line(9, -6, 26, 9, color, 4);
      }
      if (e.type === "hunter") {
        poly(
          [
            [-10, -16],
            [-30, -8],
            [-35, 2],
            [-7, -4],
          ],
          "#bf4769",
        );
        line(12, -6, 34, -2, color, 3);
      }
      if (e.type === "sniper") {
        line(9, -7, 42, -7, "#b594b7", 6);
        poly(
          [
            [-11, -23],
            [8, -30],
            [13, -16],
          ],
          "#a372a1",
        );
      }
      if (e.type === "guard") {
        ctx.fillStyle = e.armor > 0 ? "#8a69a6" : "#433a51";
        ctx.fillRect(16, -24, 13, 43);
        line(20, -17, 20, 12, "#e7c2ff", 3);
      }
      if (e.type === "bomber") {
        ctx.fillStyle = "#bd5f6d";
        ctx.beginPath();
        ctx.arc(-14, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ring(-14, 0, 6, "#ffb581", 0.6);
      }
      if (e.type === "sentinel") {
        poly(
          [
            [-15, -11],
            [-30, -20],
            [-27, 10],
            [-12, 5],
          ],
          "#745887",
        );
        poly(
          [
            [11, -11],
            [28, -20],
            [27, 10],
            [11, 5],
          ],
          "#745887",
        );
        ring(0, -1, 5, "#ddadff");
      }
    }
    ctx.restore();
    if (!e.boss && e.hp > 0) {
      ctx.fillStyle = "#152030";
      ctx.fillRect(e.x - 2, e.y - 10, e.w + 4, 3);
      ctx.fillStyle = colorFor(e);
      ctx.fillRect(e.x - 2, e.y - 10, ((e.w + 4) * e.hp) / e.maxHp, 3);
    }
    if (active) {
      text("!", e.x + e.w / 2, e.y - 24, "#ffce84", 18);
      if (e.type === "sniper" && e.aim)
        line(e.x + e.w / 2, e.y + 20, e.aim.x, e.aim.y, "#f5708e66", 1);
    }
  }
  const colorFor = (e) => (e.type === "guard" ? "#caa6ff" : "#f5708e");
  function draw(s, t) {
    const cfg = settings();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#080d16";
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    background(s, t);
    ctx.save();
    const jitter = cfg.reducedMotion ? 0 : shake * cfg.shake;
    ctx.translate(Math.sin(t * 71) * jitter, Math.cos(t * 67) * jitter * 0.6);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    s.level.terrain.forEach((p) => tile(p));
    s.platforms.forEach((p) => tile(p, true));
    for (const c of s.crates)
      if (c.hp > 0) {
        ctx.fillStyle = c.barrel ? "#643940" : "#394758";
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = c.barrel ? "#ffad76" : "#a8b8c9";
        ctx.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
        line(
          c.x + 4,
          c.y + 5,
          c.x + c.w - 4,
          c.y + c.h - 5,
          ctx.strokeStyle,
          2,
        );
        if (c.barrel) text("!", c.x + c.w / 2, c.y + 25, "#ffad76", 18);
      }
    for (const g of s.gates) {
      if (!g.open) {
        glow("#b58cf5", 6);
        ctx.fillRect(g.x, 280, g.w, 280);
        text("SEALED", g.x, 265, "#c8a9ff", 10);
      } else {
        ctx.fillStyle = "#70f5eb33";
        ctx.fillRect(g.x, 548, g.w, 12);
      }
    }
    for (const a of s.level.anchors) {
      ring(a.x, a.y, 14, "#70f5eb", 0.8);
      poly(
        [
          [a.x, a.y - 8],
          [a.x + 8, a.y],
          [a.x, a.y + 8],
          [a.x - 8, a.y],
        ],
        "#70f5eb",
      );
      text("GRAPPLE", a.x, a.y - 24, "#6da3ab", 8);
    }
    for (const [i, r] of s.level.relics.entries())
      if (!s.collected.has(i)) {
        const bob = cfg.reducedMotion ? 0 : Math.sin(t * 2 + i) * 3;
        glow("#ffd291", 8);
        poly(
          [
            [r.x, r.y - 11 + bob],
            [r.x + 8, r.y + bob],
            [r.x, r.y + 11 + bob],
            [r.x - 8, r.y + bob],
          ],
          "#ffd291",
        );
      }
    for (const [i, x] of s.level.checkpoints.entries()) {
      line(x, 510, x, 560, i <= s.checkpointIndex ? "#70f5eb" : "#627687", 3);
      poly(
        [
          [x, 510],
          [x + 27, 520],
          [x, 530],
        ],
        i <= s.checkpointIndex ? "#70f5eb" : "#627687",
      );
      text("CHECKPOINT", x, 490, "#708395", 8);
    }
    for (const t of s.level.traps) {
      const cycle = (s.time + t.phase) % t.period,
        on = cycle >= t.warning && cycle < t.warning + t.active;
      ctx.fillStyle = on ? "#f5708e" : "#57313d";
      ctx.fillRect(t.x, t.y, t.w, t.h);
      if (cycle < t.warning) {
        line(t.x, t.y - 3, t.x + t.w, t.y - 3, "#ffcb81", 3);
        text("DANGER", t.x + t.w / 2, t.y - 15, "#ffcb81", 8);
      }
    }
    const g = s.generator;
    ctx.shadowBlur = 0;
    ctx.fillStyle = g.hp > 0 ? "#39334e" : "#262b39";
    ctx.fillRect(g.x, g.y, g.w, g.h);
    if (g.hp > 0) {
      ring(
        g.x + g.w / 2,
        g.y + 25,
        14,
        s.generatorReady ? "#ffb774" : "#ae86ff",
        0.9,
      );
      text(
        s.generatorReady ? "BREAK THE RIFT" : "RIFT LOCKED",
        g.x + g.w / 2,
        g.y - 13,
        s.generatorReady ? "#ffb774" : "#ae86ff",
        9,
      );
    } else {
      ring(s.level.exit, 512, 33, "#70f5eb", 0.8);
      ring(s.level.exit, 512, 42, "#70f5eb", 0.2);
      text("BOTH TO EXTRACTION", s.level.exit - 30, 455, "#70f5eb", 9);
    }
    for (const z of s.zones) {
      ring(z.x, z.y, z.r, z.electrified ? "#70f5eb" : "#ff9b54", 0.25);
    }
    for (const d of s.drops) {
      ring(d.x, d.y, 6, d.kind === "health" ? "#80efa5" : "#70f5eb", 0.7);
    }
    for (const ghost of ghosts) {
      ctx.globalAlpha = (ghost.life / 0.18) * 0.2;
      ctx.fillStyle = colors[ghost.who];
      ctx.fillRect(ghost.x - 3, ghost.y, 32, 44);
    }
    ctx.globalAlpha = 1;
    s.enemies.forEach((e) => foe(e, t));
    s.heroes.forEach((h) =>
      warrior(h, t, s.mode === "solo" ? s.selected : null),
    );
    for (const p of s.projectiles) {
      glow(p.kind === "shock" ? "#ffb87b" : "#c094ff", 7);
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    // Telegraph layer is drawn above heroes and FX, never hidden by blast decoration.
    for (const f of fx) {
      if (f.type === "arc" && f.to) {
        ctx.save();
        ctx.globalAlpha = 1 - f.t / f.life;
        glow(f.color, 7);
        const mx = (f.x + f.to.x) / 2;
        line(f.x, f.y, mx, f.y - 12, f.color, 2);
        line(mx, f.y - 12, f.to.x, f.to.y, f.color, 2);
        ctx.restore();
      } else {
        ring(
          f.x,
          f.y,
          (f.radius * f.t) / f.life,
          f.color,
          (1 - f.t / f.life) * 0.55,
        );
      }
    }
    ctx.shadowBlur = 0;
    for (const p of pool)
      if (p.life > 0) {
        ctx.globalAlpha = Math.min(0.75, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    ctx.globalAlpha = 1;
    for (const n of numbers) text(String(n.value), n.x, n.y, n.color, 14);
    for (const z of s.warnings) {
      ctx.save();
      const active = z.t <= 0;
      ctx.fillStyle = active ? "#f5708e55" : "#ffcc7f12";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = active ? "#ff8099" : "#ffcc7f";
      ctx.lineWidth = 2;
      ctx.setLineDash(active ? [] : [7, 5]);
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      if (!active) {
        const ratio = 1 - z.t / z.warning;
        ctx.fillStyle = "#ffcc7f";
        ctx.fillRect(z.x, z.y - 5, z.w * ratio, 3);
        text(z.kind.toUpperCase(), z.x + z.w / 2, z.y - 12, "#ffcc7f", 9);
      }
      ctx.restore();
    }
    ctx.restore();
    if (s.fusionAction) {
      ctx.fillStyle = "#0e152533";
      ctx.fillRect(0, 0, 1080, 600);
      text("SUPERNOVA FUSION", 540, 165, "#ffce9d", 28);
      text("FIRE × LIGHTNING", 540, 194, "#70f5eb", 11);
    }
    if (flash > 0 && !cfg.reducedFlash) {
      ctx.fillStyle = `rgba(255,145,80,${flash * 0.16})`;
      ctx.fillRect(0, 0, 1080, 600);
    }
    ctx.restore();
  }
  Rift.renderer = {
    resize,
    draw,
    update,
    event,
    reset() {
      pool.forEach((p) => (p.life = 0));
      fx = [];
      numbers = [];
      ghosts = [];
      shake = flash = 0;
      camera = { x: 0, y: 0, zoom: 1 };
    },
    get activeParticles() {
      return pool.filter((p) => p.life > 0).length;
    },
  };
})();
