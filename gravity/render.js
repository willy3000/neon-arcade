(() => {
  const H = Heist,
    canvas = document.getElementById("world"),
    ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 960,
    height = 600,
    scale = 1,
    offsetX = 0,
    offsetY = 0,
    particles = [],
    trail = [],
    angle = Math.PI / 2,
    shake = 0;
  const colors = {
    cyan: "#69f5ef",
    purple: "#ad8cff",
    red: "#ff6078",
    orange: "#ffb36b",
    teal: "#67e3bf",
  };
  function resize() {
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(width / 960, height / 600);
    offsetX = (width - 960 * scale) / 2;
    offsetY = (height - 600 * scale) / 2;
  }
  function burst(x, y, color, count = 24) {
    if (reduced) count = 6;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2,
        v = 40 + Math.random() * 150;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.3 + Math.random() * 0.5,
        color,
      });
    }
  }
  function glow(color, blur = 12) {
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = reduced ? 0 : blur;
  }
  function update(s, dt) {
    shake *= Math.exp(-12 * dt);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    trail = trail.filter((p) => (p.life -= dt) > 0);
    if (s && !reduced) {
      trail.push({ x: s.x, y: s.y, life: 0.25 });
      if (trail.length > 40) trail.shift();
    }
    const desired = Math.PI / 2 + (s.gravity * Math.PI) / 2;
    let diff = ((desired - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    angle += diff * (reduced ? 1 : 1 - Math.exp(-12 * dt));
  }
  function robot(s, t) {
    ctx.save();
    ctx.translate(s.x, s.y);
    glow(colors.cyan, 15);
    ctx.fillStyle = "#182d3a";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.cyan;
    ctx.fillRect(-8, -5, 16, 7);
    ctx.fillStyle = "#15313c";
    if (s.dead) {
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("× ×", 0, 1);
    } else {
      const blink = !reduced && t % 4 > 3.85;
      ctx.fillRect(-5, -3, 3, blink ? 1 : 3);
      ctx.fillRect(2, -3, 3, blink ? 1 : 3);
    }
    ctx.strokeStyle = colors.cyan;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, -18);
    ctx.stroke();
    glow(colors.orange, 5);
    ctx.beginPath();
    ctx.arc(0, -18, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function draw(s, t) {
    if (!s) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#080e19";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    if (shake && !reduced)
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );
    const l = s.level;
    ctx.fillStyle = "#0b1422";
    ctx.fillRect(0, 0, 960, 600);
    ctx.strokeStyle = "#79a8c10b";
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
    ctx.font = "9px monospace";
    ctx.fillStyle = "#395268";
    ctx.fillText(
      "ORBITAL RESEARCH / SECTOR " + String(l.id + 1).padStart(2, "0"),
      42,
      80,
    );
    // Animated background machinery stays visually behind all collision geometry.
    for (let x = 110; x < 900; x += 210) {
      ctx.save();
      ctx.translate(x, 300);
      ctx.rotate(reduced ? 0 : t * 0.12);
      ctx.strokeStyle = "#647b920d";
      ctx.strokeRect(-30, -30, 60, 60);
      ctx.restore();
    }
    for (const z of l.zones) {
      ctx.fillStyle = "#a183ff12";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "#b08aff45";
      ctx.setLineDash([5, 7]);
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.setLineDash([]);
      ctx.fillStyle = colors.purple;
      ctx.font = "9px monospace";
      ctx.fillText("GRAVITY ×1.8", z.x + 12, z.y + 20);
    }
    const [gx, gy] = H.physics.directions[s.gravity];
    glow(colors.orange, 0);
    ctx.globalAlpha = 0.14;
    for (let x = 100; x < 900; x += 110)
      for (let y = 110; y < 540; y += 100) {
        const drift = reduced ? 0 : (t * 13) % 22;
        ctx.beginPath();
        ctx.moveTo(x + gx * drift, y + gy * drift);
        ctx.lineTo(x + gx * (drift + 10), y + gy * (drift + 10));
        ctx.stroke();
      }
    ctx.globalAlpha = 1;
    for (const w of l.walls) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = w.magnetic ? "#241d3f" : "#182638";
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = w.magnetic ? "#ad8cff" : "#30465c";
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
      ctx.fillStyle = w.magnetic ? "#ad8cff45" : "#5b789022";
      for (let x = w.x + 8; x < w.x + w.w - 4; x += 24)
        ctx.fillRect(x, w.y + 5, 7, 3);
    }
    for (const d of l.doors) {
      const open = H.physics.doorOpen(s, d);
      ctx.save();
      glow(open ? colors.teal : colors.orange, open ? 0 : 10);
      ctx.globalAlpha = open ? 0.18 : 1;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.globalAlpha = 1;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(d.ids.join("+"), d.x + 8, 115);
      if (d.timed) {
        const seconds = Math.min(...d.ids.map((id) => s.timers[id] || 0));
        ctx.fillText(
          seconds > 0 ? seconds.toFixed(1) + "s" : "7s",
          d.x + 8,
          135,
        );
      }
      ctx.restore();
    }
    for (const pad of l.switches) {
      const on = s.switches[pad.id];
      glow(on ? colors.teal : colors.orange, 12);
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, pad.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(pad.id, pad.x, pad.y + 4);
      ctx.textAlign = "left";
    }
    for (const h of l.hazards) {
      const b = H.physics.hazardAt(h, s.time);
      ctx.save();
      glow(colors.red, b.active ? 15 : 0);
      if (b.r) {
        ctx.translate(b.x, b.y);
        ctx.rotate(reduced ? 0 : t * (b.type === "saw" ? 3 : -1));
        ctx.beginPath();
        if (b.type === "saw") {
          for (let i = 0; i < 24; i++) {
            const a = (i * Math.PI) / 12,
              r = i % 2 ? b.r - 5 : b.r;
            const x = Math.cos(a) * r,
              y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.strokeRect(-13, -10, 26, 20);
          ctx.fillRect(-6, -3, 12, 6);
          ctx.beginPath();
          ctx.arc(0, 0, b.r + 5, 0, Math.PI * 1.5);
          ctx.stroke();
        }
        ctx.fillStyle = "#291322";
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = b.active ? 1 : 0.22;
        if (b.active) ctx.fillRect(b.x, b.y, b.w, b.h);
        else {
          ctx.setLineDash([5, 6]);
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
        if (b.type === "electric") {
          ctx.strokeStyle = "#ffc2cc";
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          for (let x = 0; x < b.w; x += 9)
            ctx.lineTo(b.x + x, b.y + (x % 18 ? b.h : 0));
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (!s.core) {
      ctx.save();
      ctx.translate(...l.core);
      ctx.rotate(reduced ? Math.PI / 4 : t * 0.8);
      glow(colors.purple, 22);
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.fillStyle = "#e6d5ff";
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(...l.exit);
    glow(colors.teal, 20);
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.9 - i * 0.2;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        18 + i * 5,
        23 + i * 5,
        0,
        (reduced ? 0 : t) + i,
        (reduced ? 0 : t) + i + Math.PI * 1.6,
      );
      ctx.stroke();
    }
    ctx.fillStyle = "#67e3bf18";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const p of trail) {
      ctx.globalAlpha = (p.life / 0.25) * 0.25;
      ctx.fillStyle = colors.cyan;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (4 * p.life) / 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    robot(s, t);
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      glow(p.color, 5);
      ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    // Compass animates toward the new field without changing physics responsiveness.
    ctx.save();
    ctx.translate(875, 95);
    ctx.strokeStyle = "#ffb36b25";
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(angle);
    glow(colors.orange, 8);
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.lineTo(10, -7);
    ctx.moveTo(18, 0);
    ctx.lineTo(10, 7);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  H.renderer = {
    resize,
    update,
    draw,
    burst,
    reset() {
      trail = [];
      particles = [];
    },
    impact() {
      shake = 12;
    },
  };
})();
