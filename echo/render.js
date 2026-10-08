/* Canvas scene renderer with a reusable 240-particle pool. */
(() => {
  const P = Echo.physics,
    canvas = document.getElementById("echo-world"),
    ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pool = Array.from({ length: 240 }, () => ({ life: 0 }));
  let cursor = 0,
    scale = 1,
    ox = 0,
    oy = 0,
    width = 960,
    height = 600,
    reactive = 0;
  function resize() {
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(width / 960, height / 600);
    ox = (width - 960 * scale) / 2;
    oy = (height - 600 * scale) / 2;
  }
  function worldPoint(x, y) {
    const box = canvas.getBoundingClientRect();
    return { x: (x - box.left - ox) / scale, y: (y - box.top - oy) / scale };
  }
  function burst(x, y, color, count = 18) {
    if (reduced) count = Math.min(count, 5);
    for (let i = 0; i < count; i++) {
      const p = pool[cursor++ % pool.length],
        angle = Math.random() * Math.PI * 2,
        speed = 35 + Math.random() * 140;
      Object.assign(p, {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.45,
        color,
      });
    }
    reactive = 0.8;
  }
  function update(dt) {
    reactive *= Math.exp(-4 * dt);
    for (const p of pool)
      if (p.life > 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-2 * dt);
        p.vy *= Math.exp(-2 * dt);
        p.life -= dt;
      }
  }
  function glow(color, blur = 12) {
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = reduced ? 0 : blur;
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
  function label(text, x, y, color = "#74839e") {
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    if (scale < .6) text = text.replace(' RELAY', '').replace('MID SWITCH', 'MID').replace('EMITTER · ', '');
    ctx.font = `${Math.max(9, 6.5 / scale)}px "Space Grotesk",sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(text, x, y);
  }
  function wave(s, w, t) {
    const color = P.frequencies[w.frequency].color;
    ctx.save();
    glow(color, 8);
    ctx.lineWidth = w.depth ? 2 : 2.2;
    ctx.globalAlpha =
      Math.max(0.08, 1 - w.radius / w.range) * Math.min(1, w.strength);
    const start = w.aim === null ? 0 : w.aim - w.cone,
      end = w.aim === null ? Math.PI * 2 : w.aim + w.cone,
      segments = w.aim === null ? 96 : 42;
    for (let layer = 0; layer < (reduced ? 1 : 2); layer++) {
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i <= segments; i++) {
        const angle = start + ((end - start) * i) / segments,
          mod = reduced
            ? 0
            : w.frequency === "LOW"
              ? Math.sin(angle * 12 + t * 4) * 2
              : w.frequency === "MID"
                ? Math.sin(angle * 24 - t * 6) * 3
                : Math.sin(angle * 48 + t * 8) * 3,
          r = Math.max(0, w.radius - layer * 7 + mod),
          point = {
            x: w.x + Math.cos(angle) * r,
            y: w.y + Math.sin(angle) * r,
          };
        if (!P.visible(s, w, point)) {
          drawing = false;
          continue;
        }
        if (drawing) ctx.lineTo(point.x, point.y);
        else {
          ctx.moveTo(point.x, point.y);
          drawing = true;
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function draw(s, t, gesture) {
    if (!s) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#090b18";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, 960, 600);
    ctx.clip();
    const bg = ctx.createRadialGradient(470, 300, 30, 470, 300, 610);
    bg.addColorStop(0, "#201731");
    bg.addColorStop(1, "#0b1223");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 600);
    ctx.strokeStyle = `rgba(154,146,211,${0.045 + reactive * 0.025})`;
    ctx.lineWidth = 1;
    for (let x = 24; x < 960; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, 576);
      ctx.stroke();
    }
    for (let y = 24; y < 600; y += 40) {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(936, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#5a5279";
    ctx.textAlign = "left";
    ctx.font = "9px monospace";
    ctx.fillText(
      "ECHO LAB / CHAMBER " + String(s.level.id + 1).padStart(2, "0"),
      46,
      61,
    );
    ctx.fillStyle = "#38324e";
    ctx.fillText("ACOUSTIC FIELD · 480u", 46, 78);
    // Decorative spectral bars respond to energy transfers.
    ctx.fillStyle = "#9f80b720";
    for (let i = 0; i < 24; i++) {
      const amp = reduced
        ? 8
        : 5 + Math.abs(Math.sin(t * 2 + i * 0.7)) * 12 + reactive * 12;
      ctx.fillRect(635 + i * 10, 45, 3, amp);
    }
    for (const w of s.waves) wave(s, w, t);
    for (const b of s.level.walls) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#1e2639";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "#35405a";
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.fillStyle = "#64769330";
      for (let x = b.x + 8; x < b.x + b.w - 5; x += 28)
        ctx.fillRect(x, b.y + 5, 8, 2);
    }
    for (const [i, b] of s.level.fragile.entries())
      if (!s.broken.has(i)) {
        ctx.save();
        glow("#f496ef", 12);
        ctx.fillStyle = "#f496ef13";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + b.w, b.y + b.h);
        ctx.stroke();
        ctx.restore();
      }
    for (const d of s.level.doors) {
      ctx.save();
      glow("#63ede7", s.switches[d.id] ? 0 : 10);
      ctx.globalAlpha = s.switches[d.id] ? 0.15 : 1;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.restore();
      label(d.id, d.x + d.w / 2, d.y + 38);
    }
    for (const p of s.platforms) {
      ctx.save();
      glow(p.active ? "#63ede7" : "#597181", p.active ? 10 : 0);
      ctx.fillStyle = "#123440";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(p.x + 3, p.y + 3);
      ctx.lineTo(p.x + p.w - 3, p.y + p.h - 3);
      ctx.stroke();
      ctx.restore();
    }
    for (const a of s.level.absorbers) {
      ring(a.x, a.y, a.r, "#5a5178", 0.7);
      ctx.fillStyle = "#080b14";
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r - 4, 0, Math.PI * 2);
      ctx.fill();
      label("SILENCER", a.x, a.y + a.r + 18);
    }
    for (const pad of s.level.switches) {
      ring(pad.x, pad.y, pad.r, s.switches[pad.id] ? "#9fffc5" : "#63ede7");
      label(pad.id, pad.x, pad.y + 4, "#a4ece6");
      label("MID SWITCH", pad.x, pad.y + 33);
    }
    for (const n of s.level.relays) {
      const color = P.frequencies[n.frequency].color;
      ring(n.x, n.y, n.r, color, 0.85);
      ring(n.x, n.y, n.r + 7 + (reduced ? 0 : Math.sin(t * 2) * 2), color, 0.2);
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(reduced ? Math.PI / 4 : t * 0.4);
      glow(color, 15);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
      label(n.frequency + " RELAY", n.x, n.y + 40, color);
    }
    for (const m of s.level.mirrors) {
      ctx.save();
      glow("#ffd482", 14);
      ctx.lineWidth = 4;
      const tx = -m.normal[1] * m.r,
        ty = m.normal[0] * m.r;
      ctx.beginPath();
      ctx.moveTo(m.x - tx, m.y - ty);
      ctx.lineTo(m.x + tx, m.y + ty);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#ffd48240";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      label("REFLECTOR", m.x, m.y + 44, "#c4a96d");
    }
    for (const [i, c] of s.level.fragments.entries())
      if (!s.fragments.has(i)) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(reduced ? Math.PI / 4 : t * 0.5);
        glow("#ccaaff", 17);
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.fillStyle = "#e6d5ff";
        ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
      }
    const [rx, ry] = s.level.receiver;
    ring(rx, ry, 28, "#8cffd3", 0.9);
    ring(rx, ry, 36, "#8cffd3", 0.18);
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(reduced ? 0 : t * 0.4);
    glow("#8cffd3", 7);
    ctx.setLineDash([9, 15]);
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    label("RECEIVER", rx, ry + 52, "#8db6aa");
    for (const c of s.crates) {
      ctx.save();
      glow("#ffd482", 7);
      ctx.fillStyle = "#393124";
      ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
      ctx.strokeRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
      ctx.fillStyle = "#ffd482";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("LOW", c.x, c.y + 4);
      ctx.restore();
    }
    const c = s.crystal;
    ctx.save();
    ctx.translate(c.x, c.y);
    glow(c.charged ? "#f496ef" : "#738299", c.charged ? 24 : 4);
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fillStyle = c.charged ? "#f496ef38" : "#1a2237";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(0, 16);
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    ctx.fillStyle = c.charged ? "#ffe0fc" : "#738299";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const [ex, ey] = s.level.emitter,
      color = P.frequencies[s.frequency].color;
    ring(ex, ey, 24, color, 0.75);
    ring(ex, ey, 34 + (reduced ? 0 : Math.sin(t * 3) * 2), color, 0.15);
    ctx.save();
    glow(color, 22);
    ctx.fillStyle = "#111d30";
    ctx.beginPath();
    ctx.arc(ex, ey, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    for (let i = -2; i <= 2; i++) {
      const h = 6 + (reduced ? 0 : Math.abs(Math.sin(t * 3 + i))) * 8;
      ctx.fillRect(ex + i * 4 - 1, ey - h / 2, 2, h);
    }
    ctx.restore();
    label("EMITTER · " + s.frequency, ex, ey + 53, color);
    if (gesture && gesture.active) {
      const charge = Math.min(1, (s.time - gesture.start) / 1.2);
      ring(ex, ey, 40 + charge * 9, color, 0.8);
      if (gesture.aim !== null) {
        ctx.save();
        glow(color, 8);
        ctx.setLineDash([6, 5]);
        const aim = gesture.aim;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + Math.cos(aim) * 180, ey + Math.sin(aim) * 180);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.arc(ex, ey, 180, aim - 0.65, aim + 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    for (const p of pool)
      if (p.life > 0) {
        ctx.globalAlpha = Math.min(1, p.life * 2);
        glow(p.color, 5);
        ctx.fillRect(p.x, p.y, 2, 2);
      }
    ctx.restore();
  }
  Echo.renderer = {
    resize,
    worldPoint,
    burst,
    update,
    draw,
    reset() {
      for (const p of pool) p.life = 0;
      reactive = 0;
    },
    get activeParticles() {
      return pool.filter((p) => p.life > 0).length;
    },
  };
})();
