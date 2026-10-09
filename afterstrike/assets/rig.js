/* Original registered layered rig. Root = center of feet; lengths remain stable. */
(() => {
  const A = Afterstrike;
  const palette = {
    ink: "#13222e",
    armor: "#374b5a",
    light: "#7e929b",
    mantle: "#53616e",
    scarf: "#aa6263",
    visor: "#eef6e9",
    coral: "#ffa89b",
    echo: "#96e6f2",
  };
  const easing = (x) => x * x * (3 - 2 * x);
  function pose(b, t) {
    const state = b.state,
      action = b.action,
      phase = b.phase ?? t,
      run = state === "run",
      air = !b.grounded,
      dash = state === "dash" || state === "air-dash",
      swing = run ? Math.sin(phase * 18) : 0;
    const active = action
      ? Math.max(
          0,
          Math.min(
            1,
            (action.t - action.start) / Math.max(0.01, action.active),
          ),
        )
      : 0;
    let angle = -0.8,
      lean = run ? 0.15 : dash ? 0.65 : state === "hit" ? -0.35 : 0,
      torso = run ? Math.abs(swing) * 1.8 : Math.sin(phase * 2) * 0.8;
    if (action) {
      const n = action.kind;
      if (n === "light" || n === "dash-attack") {
        const sign = (action.step || 0) % 2 ? -1 : 1;
        angle = -1.9 + sign * easing(active) * 3.8;
        lean = 0.1 + active * 0.15;
      } else if (["heavy", "charged", "launcher"].includes(n)) {
        angle = n === "launcher" ? 1.1 - active * 3 : -2.5 + active * 3.7;
        lean = -0.18 + active * 0.4;
      } else if (n === "parry") angle = -1.3;
      else if (n === "special" || n === "ultimate") angle = -0.35;
    }
    if (state === "charge") angle = -2.2;
    if (state === "crouch" || state === "slide") {
      torso += 9;
      lean = 0.3;
    }
    if (state === "grapple") angle = -1.65;
    const resting = b.idle > 9,
      inspection = b.idle > 5 && b.idle < 8;
    if (inspection) angle = -1.55 + Math.sin(phase) * 0.12;
    if (resting) angle = 0.55;
    if (!action && b.switchPose > 0) angle = -1.7;
    if (!action && b.heal > 0) angle = -1.2;
    return {
      angle,
      lean,
      torso,
      swing,
      air,
      dash,
      resting,
      blink: Math.sin(phase * 1.3) > 0.995,
      injured: b.hp < 30,
      active,
    };
  }
  function polygon(ctx, points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  function limb(ctx, x1, y1, x2, y2, x3, y3, color, width = 5) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  }
  function draw(
    ctx,
    b,
    t,
    { echo = false, reduced = false, cosmetic = "ash", glow = true } = {},
  ) {
    const p = pose(b, reduced ? 0 : t),
      color = echo
        ? palette.echo
        : A.weapons[b.action?.weapon || b.weapon].color,
      phase = reduced ? 0 : (b.phase ?? t);
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    ctx.scale(b.facing, 1);
    if (echo) ctx.globalAlpha = 0.42 * (b.fade ?? 1);
    if (b.state === "death")
      ctx.rotate(-Math.min(Math.PI / 2, (b.deathTime || 0.7) * 2));
    const land = b.land ? Math.sin((b.land / 0.14) * Math.PI) * 0.1 : 0;
    ctx.scale(1 + land, 1 - land);
    ctx.translate(p.lean * 6, p.torso);
    ctx.rotate(p.lean * 0.12);
    // Registered articulated legs: hips, knees, boots. Cloth follows velocity.
    const leg = p.swing * 9,
      knee = p.air ? 8 : 0,
      frontFoot = p.dash ? -16 : p.air ? 4 : leg;
    limb(
      ctx,
      -5,
      -17,
      -7 - leg * 0.25,
      -8 - knee,
      -7 - leg,
      0 - knee,
      palette.armor,
      7,
    );
    limb(
      ctx,
      5,
      -16,
      7 + leg * 0.25,
      -9,
      7 + frontFoot,
      0 - (p.air ? 6 : 0),
      palette.light,
      6,
    );
    ctx.fillStyle = palette.ink;
    ctx.fillRect(-11 - leg, -3 - knee, 11, 4);
    ctx.fillRect(3 + frontFoot, -3 - (p.air ? 6 : 0), 12, 4);
    const cloth =
      Math.sin(phase * 4) * 2 + Math.max(-12, Math.min(12, -b.vx * 0.018));
    polygon(
      ctx,
      [
        [-8, -40],
        [-17, -29],
        [-19 + cloth, -11],
        [-8, -19],
        [0, -15],
        [10, -31],
      ],
      cosmetic === "violet" ? "#635579" : palette.mantle,
    );
    polygon(
      ctx,
      [
        [-7, -45],
        [-15, -41],
        [-21 + cloth, -40],
        [-33 + cloth, -29],
        [-22 + cloth, -30],
        [-12, -35],
      ],
      echo ? "#6299ac" : cosmetic === "ivory" ? "#c2c6bb" : palette.scarf,
    );
    // Torso silhouette and asymmetric plated shoulder.
    polygon(
      ctx,
      [
        [-8, -39],
        [9, -39],
        [12, -25],
        [7, -15],
        [-6, -15],
        [-11, -28],
      ],
      palette.armor,
    );
    polygon(
      ctx,
      [
        [-8, -38],
        [-14, -33],
        [-9, -25],
        [-4, -32],
      ],
      palette.light,
    );
    polygon(
      ctx,
      [
        [2, -36],
        [10, -32],
        [6, -25],
        [-1, -27],
      ],
      palette.ink,
    );
    ctx.fillStyle = color;
    ctx.fillRect(0, -32, 3, 8);
    ctx.strokeStyle = palette.light;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -18);
    ctx.lineTo(8, -18);
    ctx.stroke();
    const headTilt = p.injured ? 0.12 : p.resting ? 0.1 : 0;
    ctx.save();
    ctx.translate(1, -44);
    ctx.rotate(headTilt);
    polygon(
      ctx,
      [
        [-8, -9],
        [3, -12],
        [10, -7],
        [11, 3],
        [5, 8],
        [-7, 6],
        [-11, -1],
      ],
      palette.ink,
    );
    polygon(
      ctx,
      [
        [-10, -5],
        [-6, -12],
        [5, -14],
        [12, -7],
        [5, -9],
        [-4, -7],
      ],
      palette.mantle,
    );
    ctx.strokeStyle = echo ? palette.echo : palette.visor;
    ctx.lineWidth = p.blink ? 1 : 3;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(9, -3);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(-7, 1, 2, 3);
    ctx.restore();
    const elbowX = 11 + Math.cos(p.angle) * 11,
      elbowY = -33 + Math.sin(p.angle) * 11,
      handX = elbowX + Math.cos(p.angle) * 12,
      handY = elbowY + Math.sin(p.angle) * 12;
    limb(ctx, 7, -35, elbowX, elbowY, handX, handY, palette.light, 5);
    const backReach = p.air ? -15 : -9;
    limb(ctx, -8, -33, backReach, -26, -13, -20, palette.armor, 5);
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(p.angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? 6 : 0;
    const weapon = b.action?.weapon || b.weapon;
    if (weapon === "blade") {
      polygon(
        ctx,
        [
          [0, -3],
          [45, -4],
          [58, -1],
          [48, 4],
          [0, 4],
        ],
        color,
      );
      ctx.shadowBlur = 0;
      polygon(
        ctx,
        [
          [7, -2],
          [44, -2],
          [52, -1],
          [44, 0],
          [7, 1],
        ],
        palette.visor,
      );
      ctx.fillStyle = palette.armor;
      ctx.fillRect(-5, -6, 7, 12);
    } else if (weapon === "gauntlets") {
      polygon(
        ctx,
        [
          [-3, -8],
          [13, -11],
          [23, -6],
          [25, 5],
          [13, 11],
          [-3, 8],
        ],
        palette.armor,
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, -9);
      ctx.lineTo(21, -5);
      ctx.lineTo(22, 4);
      ctx.lineTo(12, 9);
      ctx.stroke();
      ctx.fillStyle = palette.visor;
      ctx.fillRect(13, -3, 6, 5);
      ctx.restore();
      ctx.save();
      ctx.translate(-13, -20);
      polygon(
        ctx,
        [
          [-6, -6],
          [9, -6],
          [12, 3],
          [5, 8],
          [-7, 5],
        ],
        palette.armor,
      );
      ctx.strokeStyle = color;
      ctx.strokeRect(-3, -4, 9, 8);
    } else {
      const extension = b.action && b.state === "attack-active" ? 112 : 47,
        curve = Math.sin(phase * 5) * 9;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(extension * 0.5, curve + 12, extension, -2);
      ctx.stroke();
      polygon(
        ctx,
        [
          [extension - 8, -8],
          [extension + 10, -2],
          [extension - 5, 6],
        ],
        color,
      );
      ctx.fillStyle = palette.armor;
      ctx.fillRect(-4, -4, 11, 8);
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    if (
      b.action &&
      ["attack-active", "heavy", "charged", "launcher", "dash-attack"].includes(
        b.state,
      )
    ) {
      const reach = A.weapons[b.action.weapon].reach * 0.8;
      ctx.save();
      ctx.globalAlpha *= 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = weapon === "gauntlets" ? 8 : 3;
      ctx.beginPath();
      ctx.arc(6, -31, reach, p.angle - 0.6, p.angle + 0.6);
      ctx.stroke();
      ctx.restore();
    }
    if (b.summon > 0) {
      ctx.strokeStyle = "#96e6f2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, -25, 28, 38, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.state === "victory") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-22, -55);
      ctx.lineTo(-12, -59);
      ctx.stroke();
    }
    ctx.restore();
  }
  A.rig = {
    palette,
    pose,
    draw,
    root: "feet-center",
    bounds: { width: 240, height: 260 },
    polygon,
  };
})();
