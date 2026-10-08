/* Original stone/mechanical and spirit silhouettes, layered scenery, pooled particles. */
(() => {
  const P = Phasebound.physics,
    canvas = document.getElementById("phase-world"),
    ctx = canvas.getContext("2d"),
    reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors = {
    kai: "#ffbc79",
    luma: "#79f4ef",
    both: "#e9d59a",
    veil: "#b7a0ff",
  };
  const particles = Array.from({ length: 240 }, () => ({ life: 0 }));
  let cursor = 0,
    width = 1080,
    height = 640,
    scale = 1,
    ox = 0,
    oy = 0,
    shake = 0;
  function resize() {
    const b = canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    width = Math.max(1, b.width);
    height = Math.max(1, b.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(width / 1080, height / 640);
    ox = (width - 1080 * scale) / 2;
    oy = (height - 640 * scale) / 2;
  }
  function glow(c, blur = 12) {
    ctx.fillStyle = ctx.strokeStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = reduced ? 0 : blur;
  }
  function burst(x, y, color, count = 12) {
    if (reduced) count = Math.min(4, count);
    for (let i = 0; i < count; i++) {
      const p = particles[cursor++ % particles.length],
        angle = Math.random() * Math.PI * 2,
        speed = 15 + Math.random() * 80;
      Object.assign(p, {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25 + Math.random() * 0.4,
        color,
      });
    }
  }
  function update(dt) {
    shake *= Math.exp(-14 * dt);
    for (const p of particles)
      if (p.life > 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 50 * dt;
        p.life -= dt;
      }
  }
  function text(label, x, y, color = "#79839d") {
    ctx.shadowBlur = 0;
    ctx.font = `${Math.max(9, 6.5 / scale)}px "Space Grotesk",sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.fillText(label, x, y);
  }
  function ring(x, y, r, color, alpha = 1) {
    ctx.save();
    glow(color, 15);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  function terrain(b, t, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const color = colors[b.dimension] || colors.both;
    glow(color, b.dimension === "both" ? 0 : 9);
    ctx.fillStyle =
      b.dimension === "both"
        ? "#252b3c"
        : b.dimension === "kai"
          ? "#382b28"
          : "#172f39";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.dimension === "both" ? "#515367" : color;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.25;
    ctx.fillRect(b.x, b.y, b.w, 3);
    ctx.shadowBlur = 0;
    for (let x = b.x + 12; x < b.x + b.w - 8; x += 40) {
      ctx.fillRect(x, b.y + 10, 5, 3);
      if (b.h > 25) {
        ctx.strokeStyle = "#98a2ba15";
        ctx.strokeRect(x - 5, b.y + 20, 25, 20);
      }
    }
    ctx.restore();
  }
  function character(c, t, selected) {
    ctx.save();
    const cx = c.x + c.w / 2,
      cy = c.y + c.h / 2;
    ctx.translate(cx, cy);
    const land = c.squash > 0 && !reduced ? c.squash / 0.15 : 0,
      bob =
        !reduced && c.grounded
          ? Math.sin(t * (Math.abs(c.vx) > 20 ? 18 : 2)) * 1.2
          : 0;
    ctx.translate(0, bob);
    ctx.scale(1 + land * 0.18, 1 - land * 0.16);
    const blink = !reduced && t % 4.5 > 4.34,
      color = colors[c.who];
    glow(color, c.docked ? 25 : 13);
    if (c.who === "kai") {
      ctx.fillStyle = "#574136";
      ctx.beginPath();
      ctx.moveTo(-10, -13);
      ctx.lineTo(6, -14);
      ctx.lineTo(11, -8);
      ctx.lineTo(11, 10);
      ctx.lineTo(6, 14);
      ctx.lineTo(-9, 13);
      ctx.lineTo(-12, 5);
      ctx.lineTo(-12, -7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.fillRect(-8, -6, 16, 8);
      ctx.fillStyle = "#342b2c";
      ctx.fillRect(-5 + (c.vx > 0 ? 1 : 0), -4, 3, blink ? 1 : 4);
      ctx.fillRect(2 + (c.vx > 0 ? 1 : 0), -4, 3, blink ? 1 : 4);
      ctx.fillStyle = "#d49763";
      ctx.fillRect(-10, 11, 6, 5);
      ctx.fillRect(3, 11, 6, 5);
      ctx.strokeStyle = "#ffbc7960";
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.lineTo(0, 7);
      ctx.lineTo(5, 4);
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = "#1c69736b";
      ctx.beginPath();
      ctx.moveTo(-11, 11);
      ctx.quadraticCurveTo(-14, -8, 0, -14);
      ctx.quadraticCurveTo(14, -8, 11, 11);
      ctx.lineTo(6, 7);
      ctx.lineTo(0, 13);
      ctx.lineTo(-5, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#d8ffff";
      ctx.beginPath();
      ctx.ellipse(-4, -3, 2, blink ? 0.5 : 3, 0, 0, Math.PI * 2);
      ctx.ellipse(4, -3, 2, blink ? 0.5 : 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.quadraticCurveTo(0, c.docked ? 9 : 7, 3, 4);
      ctx.stroke();
    }
    if (!c.grounded && !c.docked) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(-7, 17);
      ctx.lineTo(-7, 22);
      ctx.moveTo(6, 17);
      ctx.lineTo(6, 23);
      ctx.stroke();
    }
    ctx.restore();
    if (selected) text("▼", cx, c.y - 14, color);
  }
  function draw(s, t, selected = null) {
    if (!s) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0c1020";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, 1080, 640);
    ctx.clip();
    if (shake && !reduced)
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );
    const bg = ctx.createLinearGradient(0, 0, 1080, 600);
    bg.addColorStop(0, "#221b32");
    bg.addColorStop(0.5, "#161d34");
    bg.addColorStop(1, "#0d2a33");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 640);
    const focus = (s.kai.x + s.luma.x) / 2;
    // Three scenery layers shift at different rates while the playable geometry stays fixed.
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = ["#1c243858", "#2b264c38", "#2844572b"][layer];
      for (let i = 0; i < 8; i++) {
        const x = i * 190 - 80 - (reduced ? 0 : focus * 0.03 * (layer + 1)),
          y = 140 + layer * 60 + (i % 3) * 30;
        ctx.fillRect(x, y, 50 + layer * 20, 450 - y);
        ctx.beginPath();
        ctx.arc(x + 25 + layer * 10, y, 25 + layer * 10, Math.PI, 0);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "#b4b0d010";
    for (let x = 40; x < 1060; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 410);
      ctx.lineTo(x + 40, 480);
      ctx.lineTo(x, 550);
      ctx.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const x = (i * 137 + 57) % 1056,
        y = 100 + ((i * 83) % 420) + (reduced ? 0 : Math.sin(t * 0.4 + i) * 8);
      ctx.fillStyle = i % 2 ? "#79f4ef25" : "#ffbc7925";
      ctx.fillRect(x, y, 2, 2);
    }
    text("PHASEBOUND / " + s.level.chapter, 220, 70, "#7c6f99");
    for (const b of s.level.walls) terrain(b, t);
    for (const b of s.platforms) {
      terrain(b, t);
      text(
        b.dimension === "kai" ? "KAI FERRY" : "SHARED FERRY",
        b.x + b.w / 2,
        b.y + 36,
        colors[b.dimension],
      );
    }
    for (const b of s.level.bridges) {
      const remaining = s.timers[b.id] || 0;
      ctx.save();
      const visible = remaining > 0;
      ctx.globalAlpha = visible
        ? remaining < 2
          ? 0.45 + Math.sin(t * 12) * 0.2
          : 0.9
        : 0.2;
      glow("#b7a0ff", visible ? 16 : 0);
      ctx.setLineDash(visible ? [] : [8, 9]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "#b7a0ff25";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.restore();
      text(
        visible ? remaining.toFixed(1) + "s" : "HIDDEN BRIDGE",
        b.x + b.w / 2,
        b.y + 42,
        "#ad96d7",
      );
    }
    for (const d of s.level.doors) {
      const open = P.doorOpen(s, d);
      ctx.save();
      glow(colors[d.dimension] || "#b7a0ff", 10);
      ctx.globalAlpha = open ? 0.12 : 1;
      ctx.fillStyle = open ? "#7bffd722" : "#3e345c";
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      if (d.dimension === "veil") {
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(d.x + 9, d.y);
        ctx.lineTo(d.x + 9, d.y + d.h);
        ctx.stroke();
      }
      ctx.restore();
      text(
        d.id === "LINK" ? "LINK" : d.id,
        d.x + 9,
        d.y - 15,
        open ? "#91e8bf" : colors[d.dimension],
      );
    }
    for (const p of s.level.plates) {
      glow("#ffbc79", s.plates[p.id] ? 17 : 0);
      ctx.fillRect(p.x, p.y, p.w, p.h);
      text(p.id, p.x + p.w / 2, p.y - 15, "#ffbc79");
    }
    for (const n of s.level.nodes) {
      const active =
        n.kind === "latch" ? s.latched[n.id] : (s.timers[n.id] || 0) > 0;
      ring(n.x, n.y, 20, "#79f4ef", active ? 1 : 0.6);
      ring(n.x, n.y, 27 + (reduced ? 0 : Math.sin(t * 2) * 2), "#b7a0ff", 0.2);
      text(n.id, n.x, n.y + 4, "#bafdf6");
      text("LUMA ↓", n.x, n.y - 39, "#79f4ef");
    }
    for (const n of s.level.tethers) {
      ring(n.x, n.y, n.r, "#b7a0ff", 0.13);
      ring(n.x, n.y, 22, "#b7a0ff", s.tether ? 1 : 0.6);
      text("LINK", n.x, n.y + 5, "#c5b1f5");
    }
    for (const [i, n] of s.level.checkpoints.entries()) {
      ctx.save();
      glow(i <= s.checkpointIndex ? "#91ffd0" : "#99a8b9", 7);
      ctx.beginPath();
      ctx.moveTo(n.x, n.y + 18);
      ctx.lineTo(n.x, n.y - 22);
      ctx.lineTo(n.x + 17, n.y - 15);
      ctx.lineTo(n.x, n.y - 8);
      ctx.stroke();
      ctx.restore();
    }
    for (const b of s.blocks) {
      terrain(b, t);
      ctx.strokeStyle = "#ffbc79";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + 9, b.y + 12);
      ctx.lineTo(b.x + 17, b.y + 22);
      ctx.lineTo(b.x + 25, b.y + 12);
      ctx.stroke();
      if (b.anchored) text("▣", b.x + b.w / 2, b.y - 8, "#ffdca2");
    }
    for (const [i, o] of s.level.crystals.entries())
      if (!s.collected.has(i)) {
        ctx.save();
        ctx.translate(o.x, o.y + (reduced ? 0 : Math.sin(t * 2 + i) * 2));
        glow(colors[o.owner], 18);
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 10);
        ctx.lineTo(-7, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = "#eee0b822";
        ctx.fill();
        ctx.restore();
      }
    for (const who of ["kai", "luma"]) {
      const [x, y] = s.level.portals[who];
      ctx.save();
      glow(colors[who], 20);
      ctx.beginPath();
      ctx.ellipse(x, y, 18, 27, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.13;
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([7, 12]);
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        25,
        34,
        0,
        reduced ? 0 : t * 0.5,
        (reduced ? 0 : t * 0.5) + Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
      text(who === "kai" ? "K" : "L", x, y - 45, colors[who]);
    }
    if (s.tether) {
      const k = P.center(s.kai),
        l = P.center(s.luma),
        d = Math.hypot(k.x - l.x, k.y - l.y);
      ctx.save();
      glow(d > 200 ? "#ffbc79" : "#b7a0ff", 12);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const p = i / 30,
          x = k.x + (l.x - k.x) * p,
          y =
            k.y +
            (l.y - k.y) * p +
            (reduced
              ? 0
              : Math.sin(p * Math.PI * 4 + t * 5) * 3 * Math.sin(p * Math.PI));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    character(s.kai, t, selected === "kai");
    character(s.luma, t, selected === "luma");
    for (const p of particles)
      if (p.life > 0) {
        ctx.globalAlpha = Math.min(1, p.life * 2);
        glow(p.color, 4);
        ctx.fillRect(p.x, p.y, 2, 2);
      }
    ctx.restore();
  }
  Phasebound.renderer = {
    resize,
    draw,
    update,
    burst,
    reset() {
      for (const p of particles) p.life = 0;
      shake = 0;
    },
    impact() {
      shake = 7;
    },
    get activeParticles() {
      return particles.filter((p) => p.life > 0).length;
    },
  };
})();
