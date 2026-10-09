(() => {
  const A = Afterstrike,
    canvas = document.getElementById("after-world"),
    ctx = canvas.getContext("2d"),
    cover = document.getElementById("after-cover"),
    coverCtx = cover.getContext("2d"),
    P = A.physics;
  let width = 960,
    height = 540,
    ratio = 1,
    scale = 1,
    ox = 0,
    oy = 0,
    camera = 0,
    shake = 0,
    ghosts = [];
  const cfg = () => A.save.settings;
  function resize() {
    const b = canvas.getBoundingClientRect(),
      quality = cfg().quality;
    ratio = Math.min(
      devicePixelRatio || 1,
      quality === "low" ? 1 : quality === "high" ? 2 : 1.5,
    );
    width = Math.max(1, b.width);
    height = Math.max(1, b.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    scale = Math.min(width / 960, height / 540);
    ox = (width - scale * 960) / 2;
    oy = (height - scale * 540) / 2;
    const size = cover.getBoundingClientRect();
    cover.width = Math.max(
      1,
      Math.round(size.width * Math.min(devicePixelRatio || 1, 1.5)),
    );
    cover.height = Math.max(
      1,
      Math.round(size.height * Math.min(devicePixelRatio || 1, 1.5)),
    );
  }
  function event(e) {
    A.effects.event(e);
    if (["hit", "slam", "parry", "sync", "boss-death"].includes(e.type))
      shake = Math.max(
        shake,
        e.type === "boss-death" ? 9 : e.type === "sync" ? 5 : 2,
      );
  }
  function update(dt, s) {
    A.effects.update(dt);
    shake *= Math.exp(-13 * dt);
    ghosts.forEach((g) => (g.life -= dt));
    ghosts = ghosts.filter((g) => g.life > 0);
    if (
      s.player.action?.kind === "dash" &&
      !cfg().reducedMotion &&
      ghosts.length < 18
    )
      ghosts.push({
        x: s.player.x,
        y: s.player.y,
        w: 32,
        h: 52,
        weapon: s.player.weapon,
        facing: s.player.facing,
        state: "dash",
        phase: s.player.phase,
        vx: s.player.vx,
        grounded: false,
        hp: 100,
        life: 0.16,
      });
    const ahead = s.player.facing * A.GAME_FEEL.lookAhead,
      target = Math.max(
        0,
        Math.min(s.scene.width - 960, s.player.x + 16 - 460 + ahead),
      );
    camera += (target - camera) * Math.min(1, dt * A.GAME_FEEL.cameraDamping);
  }
  function text(value, x, y, color = "#a2a9b3", size = 10) {
    ctx.fillStyle = color;
    ctx.font = `600 ${size}px Segoe UI,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(value, x, y);
  }
  function ring(x, y, r, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  function backdrop(c, w, h, t, offset = 0) {
    const quality = cfg().quality,
      reduced = cfg().reducedMotion,
      sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#172b3b");
    sky.addColorStop(0.7, "#253442");
    sky.addColorStop(1, "#121f2b");
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    for (let layer = 0; layer < (quality === "low" ? 2 : 3); layer++) {
      const spacing = layer === 0 ? 210 : 150,
        scroll = offset * (0.08 + layer * 0.16);
      c.fillStyle = ["#334554", "#2b3d4c", "#22333f"][layer];
      for (let x = -spacing; x < w + spacing; x += spacing) {
        const px = x - (scroll % spacing),
          height = 160 + (Math.sin(x * 11 + layer) * 0.5 + 0.5) * 160;
        c.beginPath();
        c.moveTo(px, h * 0.9);
        c.lineTo(px + 12, h * 0.9 - height);
        c.lineTo(px + spacing * 0.55, h * 0.9 - height - 25);
        c.lineTo(px + spacing * 0.65, h * 0.9 - height + 70);
        c.lineTo(px + spacing * 0.65, h * 0.9);
        c.closePath();
        c.fill();
        if (layer === 2) {
          c.strokeStyle = "#698393";
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(px + 20, h * 0.9 - height + 40);
          c.lineTo(px + 20, h * 0.85);
          c.stroke();
        }
      }
    }
    c.strokeStyle = "#c4ad8c44";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(w * 0.2, 0);
    c.lineTo(w * 0.24, h * 0.2);
    c.lineTo(w * 0.18, h * 0.3);
    c.lineTo(w * 0.22, h * 0.6);
    c.stroke();
    if (quality !== "low")
      for (let i = 0; i < 25; i++) {
        const x = (i * 137 + (reduced ? 0 : t * 11)) % w,
          y = (i * 87 + (reduced ? 0 : t * 6)) % h;
        c.fillStyle = i % 5 ? "#bed3ce33" : "#ffb5a455";
        c.fillRect(x, y, 1, 2);
      }
    c.fillStyle = "#afc5ca0a";
    c.fillRect(0, h * 0.62, w, h * 0.12);
  }
  function tile(t) {
    ctx.fillStyle = "#3c4955";
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = "#9da9a8";
    ctx.fillRect(t.x, t.y, t.w, 3);
    ctx.fillStyle = "#283844";
    for (let x = t.x + 10; x < t.x + t.w - 20; x += 60) {
      ctx.fillRect(x, t.y + 11, 45, 5);
      if (t.h > 30) {
        ctx.fillRect(x + 3, t.y + 27, 4, 29);
      }
    }
    ctx.fillStyle = "#192b36";
    ctx.fillRect(t.x, t.y + t.h - 5, t.w, 5);
  }
  function enemy(e, t) {
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    ctx.scale(e.facing || 1, 1);
    if (e.hp <= 0) {
      ctx.globalAlpha = Math.max(0, e.death / 0.65);
      ctx.rotate((0.65 - e.death) * 2);
    }
    if (e.flash > 0 && !cfg().reducedFlash) ctx.globalAlpha = 0.55;
    const p = A.rig.polygon,
      color = e.type === "hunter" ? "#89bfdc" : "#e7919f",
      stride = cfg().reducedMotion ? 0 : Math.sin(t * 11 + e.home);
    if (e.boss) {
      p(
        ctx,
        [
          [-48, -95],
          [-35, -125],
          [33, -125],
          [52, -97],
          [46, -45],
          [-45, -45],
        ],
        "#65727b",
      );
      p(
        ctx,
        [
          [-33, -98],
          [31, -98],
          [28, -75],
          [-29, -75],
        ],
        "#293d4a",
      );
      ctx.fillStyle = "#edcb93";
      ctx.fillRect(-22, -93, 43, 4);
      ring(0, -56, 17, e.state === "recover" ? "#ffd39d" : "#e7919f");
      const armY = e.state === "windup" ? -95 : -44;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#879094";
      ctx.lineWidth = 20;
      ctx.beginPath();
      if (e.components?.[0]?.hp > 0) {
        ctx.moveTo(-42, -82);
        ctx.lineTo(-64, armY);
        ctx.lineTo(-78, armY + 30);
      }
      if (e.components?.[1]?.hp > 0) {
        ctx.moveTo(42, -82);
        ctx.lineTo(64, armY);
        ctx.lineTo(78, armY + 30);
      }
      ctx.stroke();
      ctx.lineWidth = 17;
      ctx.beginPath();
      ctx.moveTo(-24, -41);
      ctx.lineTo(-27, -5);
      ctx.moveTo(24, -41);
      ctx.lineTo(27, -5);
      ctx.stroke();
    } else {
      ctx.lineCap = "round";
      ctx.strokeStyle = "#6b7a89";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-7, -16);
      ctx.lineTo(-8 + stride * 4, -2);
      ctx.moveTo(7, -16);
      ctx.lineTo(8 - stride * 4, -2);
      ctx.stroke();
      p(
        ctx,
        [
          [-14, -40],
          [11, -40],
          [15, -18],
          [5, -11],
          [-11, -15],
        ],
        e.type === "bulwark" ? "#687180" : "#405665",
      );
      p(
        ctx,
        [
          [-11, -40],
          [-8, -52],
          [8, -52],
          [14, -39],
          [5, -34],
        ],
        "#334554",
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -43);
      ctx.lineTo(11, -42);
      ctx.stroke();
      if (e.type === "scavenger")
        p(
          ctx,
          [
            [-12, -39],
            [-31, -30],
            [-25, -22],
            [-7, -30],
          ],
          "#a96779",
        );
      if (e.type === "lancer") {
        ctx.strokeStyle = "#d5a0a5";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(7, -31);
        ctx.lineTo(58, -29);
        ctx.stroke();
        p(
          ctx,
          [
            [53, -35],
            [67, -29],
            [53, -23],
          ],
          "#d5a0a5",
        );
      }
      if (e.type === "bulwark") {
        ctx.fillStyle = e.armor > 0 ? "#958da5" : "#4d5063";
        ctx.fillRect(14, -49, 16, 44);
        ctx.strokeStyle = "#e3c8b4";
        ctx.lineWidth = 2;
        ctx.strokeRect(17, -46, 10, 36);
      }
      if (e.type === "gunner") {
        ctx.fillStyle = "#95a3ac";
        ctx.fillRect(8, -34, 37, 7);
        ctx.fillStyle = "#b291a8";
        ctx.fillRect(35, -35, 8, 9);
      }
      if (e.type === "hunter") {
        p(
          ctx,
          [
            [-15, -37],
            [-30, -44],
            [-24, -18],
            [-13, -13],
          ],
          "#618195",
        );
        ring(0, -26, 6, "#96e6f2", 0.7);
      }
    }
    ctx.restore();
    if (e.hp > 0 && !e.boss) {
      ctx.fillStyle = "#1c2c3a";
      ctx.fillRect(e.x - 3, e.y - 12, e.w + 6, 3);
      ctx.fillStyle = color;
      ctx.fillRect(e.x - 3, e.y - 12, ((e.w + 6) * e.hp) / e.maxHp, 3);
    }
    if (e.state === "windup") text("!", e.x + e.w / 2, e.y - 23, "#ffd397", 18);
    if (e.type === "gunner" && e.state === "windup" && e.aim) {
      ctx.strokeStyle = "#e7919f66";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.x + 17, e.y + 20);
      ctx.lineTo(e.aim.x, e.aim.y);
      ctx.stroke();
    }
  }
  function draw(s, t) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#0b1822";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    backdrop(ctx, 960, 540, t, camera);
    ctx.save();
    const jitter = cfg().reducedMotion ? 0 : shake * cfg().shake;
    ctx.translate(
      -camera + Math.sin(t * 65) * jitter,
      Math.cos(t * 63) * jitter * 0.5,
    );
    // A broken suspended tram and a warm lamp anchor the Fallen City's silhouette.
    if (s.stage === 0) {
      ctx.fillStyle = "#405362";
      ctx.fillRect(250, 260, 150, 45);
      ctx.fillStyle = "#b4b5a744";
      for (let x = 260; x < 390; x += 28) ctx.fillRect(x, 267, 20, 16);
      ctx.strokeStyle = "#6c8795";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(275, 0);
      ctx.lineTo(275, 260);
      ctx.moveTo(380, 0);
      ctx.lineTo(380, 260);
      ctx.stroke();
    }
    for (const tileData of s.scene.terrain)
      if (tileData.x + tileData.w > camera - 50 && tileData.x < camera + 1010)
        tile(tileData);
    for (const gate of s.gates)
      if (!gate.open) {
        ctx.fillStyle = "#94678c55";
        ctx.fillRect(gate.x, 270, gate.w, 240);
        text("HOSTILES REMAIN", gate.x, 252, "#dfa5ac", 8);
      }
    if (s.scene.pad) {
      const pad = s.scene.pad;
      ctx.fillStyle = s.relayHeld ? "#96e6f2" : "#b7a071";
      ctx.fillRect(pad.x, pad.y, pad.w, 7);
      text("REPLAY RELAY", pad.x + pad.w / 2, pad.y - 20, "#dbc5a3", 9);
      text("STAND → ECHO → MOVE", pad.x + pad.w / 2, pad.y - 36, "#9eaab0", 8);
      if (!s.relayOpen) {
        ctx.fillStyle = s.relayHeld ? "#96e6f222" : "#b7a07177";
        ctx.fillRect(s.scene.door.x, 250, 18, 260);
      }
    }
    for (const a of s.scene.anchors) {
      ring(a.x, a.y, 11, "#efd1a0");
      A.rig.polygon(
        ctx,
        [
          [a.x, a.y - 6],
          [a.x + 6, a.y],
          [a.x, a.y + 6],
          [a.x - 6, a.y],
        ],
        "#efd1a0",
      );
      text("ANCHOR", a.x, a.y - 19, "#b8b5a4", 8);
    }
    for (const [i, r] of s.scene.relics.entries())
      if (!s.found.has(s.stage + ":" + i)) {
        const bob = cfg().reducedMotion ? 0 : Math.sin(t * 2) * 3;
        A.rig.polygon(
          ctx,
          [
            [r.x, r.y - 9 + bob],
            [r.x + 7, r.y + bob],
            [r.x, r.y + 9 + bob],
            [r.x - 7, r.y + bob],
          ],
          "#e8d49f",
        );
        ring(r.x, r.y + bob, 15, "#e8d49f", 0.18);
      }
    if (s.encounters.every((e) => e.done) && (!s.scene.boss || s.bossWon)) {
      ring(s.scene.exit, 474, 28, "#96e6f2", 0.5);
      ring(s.scene.exit, 474, 35, "#96e6f2", 0.2);
      text("NEXT MOMENT", s.scene.exit, 423, "#96e6f2", 8);
    }
    for (const g of ghosts) {
      ctx.save();
      ctx.globalAlpha = (g.life / 0.16) * 0.15;
      A.rig.draw(ctx, g, t, {
        echo: true,
        reduced: cfg().reducedMotion,
        glow: false,
      });
      ctx.restore();
    }
    s.enemies.forEach((e) => enemy(e, t));
    for (const echo of s.echoes)
      A.rig.draw(ctx, echo, t, {
        echo: true,
        reduced: cfg().reducedMotion,
        glow: cfg().quality !== "low",
      });
    A.rig.draw(ctx, s.player, t, {
      reduced: cfg().reducedMotion,
      cosmetic: cfg().cosmetic,
      glow: cfg().quality !== "low",
    });
    if (s.player.anchor) {
      const a = s.player.anchor;
      ctx.strokeStyle = "#e7d6aa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.player.x + 16, s.player.y + 20);
      ctx.lineTo(a.x, a.y);
      ctx.stroke();
      ring(a.x, a.y, 17, "#e7d6aa", 0.4);
    }
    for (const p of s.projectiles) {
      ctx.fillStyle = "#e7919f";
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    A.effects.draw(ctx);
    // Danger shapes are the final world layer and remain legible over all particles.
    for (const z of s.warnings) {
      ctx.save();
      ctx.fillStyle = z.t <= 0 ? "#e7919f44" : "#ffd3970f";
      ctx.strokeStyle = z.t <= 0 ? "#e7919f" : "#ffd397";
      ctx.lineWidth = 2;
      ctx.setLineDash(z.t <= 0 ? [] : [5, 4]);
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      if (z.t > 0) {
        ctx.fillStyle = "#ffd397";
        ctx.fillRect(z.x, z.y - 4, z.w * (1 - z.t / z.duration), 2);
        text(z.kind, z.x + z.w / 2, z.y - 13, "#ffd397", 9);
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  }
  function drawCover(t) {
    const c = coverCtx,
      w = cover.width,
      h = cover.height;
    if (w < 2 || h < 2) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    backdrop(c, w, h, t, 0);
    c.save();
    c.translate(w * 0.5, h * 0.57);
    c.scale(w / 210, w / 210);
    const echo = {
      ...P.body(-18, -52),
      phase: t,
      state: "idle",
      grounded: true,
      fade: 0.7,
      weapon: "blade",
      facing: -1,
    };
    c.save();
    c.translate(-30, -6);
    A.rig.draw(c, echo, t, {
      echo: true,
      glow: false,
      reduced: cfg().reducedMotion,
    });
    c.restore();
    const nyx = {
      ...P.body(-18, -52),
      phase: t,
      idle: t % 12,
      state: "idle",
      grounded: true,
      weapon: A.save.settings.weapon,
      hp: 100,
      vx: 0,
    };
    A.rig.draw(c, nyx, t, {
      cosmetic: cfg().cosmetic,
      reduced: cfg().reducedMotion,
    });
    c.restore();
    c.strokeStyle = "#c6b89b55";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(w * 0.5, h * 0.6, w * 0.35, h * 0.05, 0, 0, Math.PI * 2);
    c.stroke();
  }
  A.renderer = {
    resize,
    event,
    update,
    draw,
    drawCover,
    reset() {
      A.effects.reset();
      ghosts = [];
      camera = shake = 0;
    },
  };
})();
