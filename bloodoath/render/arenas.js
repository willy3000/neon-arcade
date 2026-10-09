// Arenas, painted in layers. The static parts of each layer are drawn once to an off-screen canvas; anything that moves
// (embers, mist, snow, lava glow) is drawn on top every frame. Layers slide at different speeds as the camera moves.
const W = 1280, H = 720, FLOOR = 610;
const seeded = seed => () => { seed = (seed * 16807 + 7) % 2147483647; return seed / 2147483647; };
function layer(width, draw) { const c = document.createElement('canvas'); c.width = width; c.height = H; draw(c.getContext('2d'), width); return c; }
function sky(g, w, stops) { const grad = g.createLinearGradient(0, 0, 0, H); stops.forEach(([p, c]) => grad.addColorStop(p, c)); g.fillStyle = grad; g.fillRect(0, 0, w, H); }
function ridge(g, w, base, amp, color, r, step = 60, jag = 1) { g.fillStyle = color; g.beginPath(); g.moveTo(0, H); let y = base; for (let x = 0; x <= w; x += step) { y = base - amp * (0.3 + r() * 0.7) * (jag > 1 && (x / step) % 2 ? 0.4 : 1); g.lineTo(x, y); } g.lineTo(w, H); g.closePath(); g.fill(); }
function floor(g, w, top, c1, c2, lineC, r) {
  const grad = g.createLinearGradient(0, top, 0, H); grad.addColorStop(0, c1); grad.addColorStop(1, c2); g.fillStyle = grad; g.fillRect(0, top, w, H - top);
  g.strokeStyle = lineC; g.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = top + 6 + i * i * 4.2; g.globalAlpha = 0.5 - i * 0.06; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  for (let x = -200; x < w + 200; x += 120) { g.globalAlpha = 0.35; g.beginPath(); g.moveTo(x + r() * 30, top + 6); g.lineTo(x + (x - w / 2) * 0.35 + r() * 30, H); g.stroke(); } g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, top, w, 5);
}
const column = (g, x, y, w, h, c, broken) => { g.fillStyle = c; g.fillRect(x, y - h, w, h); g.fillRect(x - 8, y - 14, w + 16, 14); if (!broken) g.fillRect(x - 10, y - h - 12, w + 20, 14); else { g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w * 0.4, y - h - 22); g.lineTo(x + w * 0.7, y - h - 6); g.lineTo(x + w, y - h - 16); g.lineTo(x + w, y - h); g.fill(); } };
function tree(g, x, y, h, c, r) { g.strokeStyle = c; g.lineCap = 'round'; const branch = (bx, by, len, ang, w, depth) => { const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len; g.lineWidth = w; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.cos(ang + 0.5) * len * 0.5, by + Math.sin(ang + 0.5) * len * 0.5, ex, ey); g.stroke(); if (depth > 0) for (let i = 0; i < 2 + (r() > 0.6 ? 1 : 0); i++) branch(ex, ey, len * (0.55 + r() * 0.25), ang + (r() - 0.5) * 1.5, w * 0.6, depth - 1); }; branch(x, y, h * 0.42, -Math.PI / 2 + (r() - 0.5) * 0.3, h * 0.07, 4); }

export const ARENAS = [
  {
    id: 'temple', name: 'THE ASHEN TEMPLE', line: 'A ruin drowning in its own fire.', glow: '#ff6a2a', floorTint: '#ff7a3a', ambience: 'fire',
    build() {
      const r = seeded(11);
      return [
        { par: 0.05, canvas: layer(W + 200, (g, w) => { sky(g, w, [[0, '#12060a'], [0.45, '#3a0f12'], [0.72, '#8a2412'], [0.86, '#e2591c'], [1, '#ffb347']]); g.fillStyle = 'rgba(255,190,90,0.18)'; g.beginPath(); g.arc(w * 0.62, 470, 230, 0, 7); g.fill(); ridge(g, w, 520, 260, '#1c080b', r, 150); ridge(g, w, 560, 140, '#2a0c0c', r, 90); }) },
        { par: 0.25, canvas: layer(W + 500, (g, w) => { for (let x = 60; x < w; x += 210 + r() * 80) column(g, x, FLOOR + 4, 46 + r() * 18, 260 + r() * 150, '#1f0d10', r() > 0.5); g.fillStyle = '#1f0d10'; g.fillRect(0, FLOOR - 26, w, 40); for (let x = 0; x < w; x += 44) g.fillRect(x, FLOOR - 40, 26, 16); }) },
        { par: 0.55, canvas: layer(W + 900, (g, w) => { for (let x = 120; x < w; x += 420 + r() * 120) { column(g, x, FLOOR + 6, 70, 330 + r() * 80, '#150709', r() > 0.4); g.fillStyle = '#ff7a2a'; g.globalAlpha = 0.5; g.fillRect(x + 14, FLOOR - 190, 5, 60); g.fillRect(x + 44, FLOOR - 250, 4, 40); g.globalAlpha = 1; } }) },
        { par: 1, canvas: layer(W + 1400, (g, w) => { floor(g, w, FLOOR, '#3a1a16', '#120708', '#7a2e1c', r); for (let i = 0; i < 26; i++) { const x = r() * w, y = FLOOR + 14 + r() * 90; g.strokeStyle = '#ff7a2a'; g.globalAlpha = 0.5; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + r() * 40, y + (r() - 0.5) * 10); g.lineTo(x + 50 + r() * 50, y + (r() - 0.5) * 16); g.stroke(); } g.globalAlpha = 1; }) },
      ];
    },
    live(g, t, cam, fx) { // lava light pulsing on the horizon and embers drifting up
      const pulse = 0.5 + Math.sin(t * 1.3) * 0.12; const grad = g.createLinearGradient(0, 470, 0, FLOOR); grad.addColorStop(0, 'rgba(255,120,30,0)'); grad.addColorStop(1, `rgba(255,130,40,${0.28 * pulse})`); g.fillStyle = grad; g.fillRect(0, 440, W, 180);
      for (let i = 0; i < 46; i++) { const s = i * 97.13, x = ((s * 13 + t * (18 + (i % 5) * 9) + cam * 0.4) % (W + 60) + W + 60) % (W + 60) - 30, y = H - ((s * 7 + t * (40 + (i % 7) * 14)) % 620); g.fillStyle = i % 3 ? '#ffb347' : '#ff6a2a'; g.globalAlpha = 0.25 + ((i * 37) % 60) / 100; g.fillRect(x + Math.sin(t * 2 + i) * 8, y, 3, 3); } g.globalAlpha = 1;
    },
  },
  {
    id: 'graveyard', name: 'THE HOLLOW YARD', line: 'The dead here were buried standing.', glow: '#9db8ff', floorTint: '#8fa8e0', ambience: 'wind',
    build() {
      const r = seeded(29);
      return [
        { par: 0.04, canvas: layer(W + 200, (g, w) => { sky(g, w, [[0, '#05060f'], [0.5, '#101a36'], [0.85, '#27365e'], [1, '#3d4d78']]); for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; g.fillRect(r() * w, r() * 380, 1.6, 1.6); } const mx = w * 0.68, my = 190; const halo = g.createRadialGradient(mx, my, 60, mx, my, 330); halo.addColorStop(0, 'rgba(190,210,255,0.35)'); halo.addColorStop(1, 'rgba(190,210,255,0)'); g.fillStyle = halo; g.fillRect(0, 0, w, H); g.fillStyle = '#e8eeff'; g.beginPath(); g.arc(mx, my, 110, 0, 7); g.fill(); g.fillStyle = 'rgba(160,175,215,0.5)'; for (const [dx, dy, rr] of [[-30, -20, 26], [34, 18, 18], [-10, 40, 14], [40, -40, 10]]) { g.beginPath(); g.arc(mx + dx, my + dy, rr, 0, 7); g.fill(); } ridge(g, w, 560, 90, '#0a1024', r, 120); }) },
        { par: 0.22, canvas: layer(W + 500, (g, w) => { for (let x = 40; x < w; x += 260 + r() * 140) tree(g, x, FLOOR, 380 + r() * 160, '#070b18', r); g.fillStyle = '#070b18'; g.fillRect(0, FLOOR - 20, w, 30); for (let x = 0; x < w; x += 26) { g.fillRect(x, FLOOR - 92, 5, 80); g.beginPath(); g.moveTo(x - 3, FLOOR - 92); g.lineTo(x + 2.5, FLOOR - 108); g.lineTo(x + 8, FLOOR - 92); g.fill(); } g.fillRect(0, FLOOR - 70, w, 4); g.fillRect(0, FLOOR - 36, w, 4); }) },
        { par: 0.5, canvas: layer(W + 900, (g, w) => { for (let x = 80; x < w; x += 150 + r() * 130) { const h = 70 + r() * 60, tw = 50 + r() * 26; g.fillStyle = '#0c1226'; if (r() > 0.45) { g.beginPath(); g.moveTo(x, FLOOR + 6); g.lineTo(x, FLOOR - h + 20); g.quadraticCurveTo(x + tw / 2, FLOOR - h - 16, x + tw, FLOOR - h + 20); g.lineTo(x + tw, FLOOR + 6); g.fill(); } else { g.fillRect(x + tw * 0.38, FLOOR - h - 30, tw * 0.24, h + 36); g.fillRect(x + tw * 0.1, FLOOR - h, tw * 0.8, tw * 0.22); } } }) },
        { par: 1, canvas: layer(W + 1400, (g, w) => { floor(g, w, FLOOR, '#1c2440', '#080b16', '#3a4a78', r); for (let i = 0; i < 60; i++) { const x = r() * w; g.strokeStyle = '#2c3c5e'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, FLOOR + 4); g.lineTo(x + (r() - 0.5) * 8, FLOOR - 8 - r() * 10); g.stroke(); } }) },
      ];
    },
    live(g, t, cam) { // low mist rolling across the stones, and a few pale wisps
      for (let i = 0; i < 5; i++) { const x = ((t * (14 + i * 6) + i * 340 - cam * 0.6) % (W + 600) + W + 600) % (W + 600) - 300, y = FLOOR - 40 + i * 14; const m = g.createRadialGradient(x, y, 10, x, y, 300); m.addColorStop(0, 'rgba(170,190,235,0.2)'); m.addColorStop(1, 'rgba(170,190,235,0)'); g.fillStyle = m; g.fillRect(x - 300, y - 80, 600, 160); }
      for (let i = 0; i < 9; i++) { const x = (i * 173 + Math.sin(t * 0.5 + i) * 60 - cam * 0.3 + W * 4) % W, y = 300 + Math.sin(t * 0.8 + i * 2) * 90 + i * 14; g.fillStyle = `rgba(190,215,255,${0.35 + Math.sin(t * 3 + i) * 0.25})`; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    },
  },
  {
    id: 'shrine', name: 'THE FROZEN SHRINE', line: 'Nothing here has moved in a hundred winters.', glow: '#bff1ff', floorTint: '#bff1ff', ambience: 'blizzard',
    build() {
      const r = seeded(53);
      return [
        { par: 0.05, canvas: layer(W + 200, (g, w) => { sky(g, w, [[0, '#0d1a28'], [0.5, '#27485c'], [0.85, '#6f9bab'], [1, '#b8d8de']]); ridge(g, w, 500, 300, '#31566b', r, 170); ridge(g, w, 540, 200, '#22404f', r, 110); g.fillStyle = 'rgba(235,250,255,0.5)'; for (let x = 0; x < w; x += 170) { g.beginPath(); g.moveTo(x + 30, 330 + r() * 60); g.lineTo(x + 80, 250 + r() * 50); g.lineTo(x + 130, 340 + r() * 60); g.fill(); } }) },
        { par: 0.25, canvas: layer(W + 500, (g, w) => { const gate = (x, s) => { g.fillStyle = '#12303d'; g.fillRect(x, FLOOR - 320 * s, 22 * s, 330 * s); g.fillRect(x + 230 * s, FLOOR - 320 * s, 22 * s, 330 * s); g.fillRect(x - 40 * s, FLOOR - 340 * s, 332 * s, 24 * s); g.fillRect(x - 20 * s, FLOOR - 280 * s, 292 * s, 16 * s); g.beginPath(); g.moveTo(x - 60 * s, FLOOR - 340 * s); g.quadraticCurveTo(x + 126 * s, FLOOR - 372 * s, x + 312 * s, FLOOR - 340 * s); g.lineTo(x + 312 * s, FLOOR - 356 * s); g.quadraticCurveTo(x + 126 * s, FLOOR - 392 * s, x - 60 * s, FLOOR - 356 * s); g.fill(); }; for (let x = 200; x < w; x += 640) gate(x, 1); g.fillStyle = '#12303d'; g.fillRect(0, FLOOR - 12, w, 20); }) },
        { par: 0.55, canvas: layer(W + 900, (g, w) => { for (let x = 60; x < w; x += 300 + r() * 160) { const h = 120 + r() * 160; g.fillStyle = 'rgba(190,235,250,0.55)'; g.beginPath(); g.moveTo(x, FLOOR + 6); g.lineTo(x + 14, FLOOR - h); g.lineTo(x + 34, FLOOR - h * 0.7); g.lineTo(x + 50, FLOOR + 6); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 16, FLOOR - h * 0.8, 3, h * 0.6); g.fillStyle = '#0d2530'; g.fillRect(x + 110, FLOOR - 70, 26, 76); g.fillRect(x + 100, FLOOR - 84, 46, 16); g.fillRect(x + 104, FLOOR - 112, 38, 10); g.fillStyle = '#8fe3ff'; g.fillRect(x + 114, FLOOR - 100, 18, 14); } }) },
        { par: 1, canvas: layer(W + 1400, (g, w) => { floor(g, w, FLOOR, '#5d8898', '#16303b', '#c8eef6', r); g.fillStyle = 'rgba(255,255,255,0.14)'; for (let i = 0; i < 30; i++) { const x = r() * w, y = FLOOR + 10 + r() * 90; g.fillRect(x, y, 60 + r() * 120, 2); } }) },
      ];
    },
    live(g, t, cam) { // driving snow and a pale ground haze
      g.fillStyle = 'rgba(220,245,255,0.07)'; g.fillRect(0, FLOOR - 60, W, 80);
      for (let i = 0; i < 110; i++) { const sp = 260 + (i % 7) * 60, x = W - ((i * 71.7 + t * sp + cam * 0.5) % (W + 80) + W + 80) % (W + 80) + 40, y = ((i * 53.3 + t * (120 + (i % 5) * 40)) % (H + 40)) - 20, len = 6 + (i % 4) * 4; g.strokeStyle = `rgba(240,250,255,${0.3 + (i % 5) * 0.1})`; g.lineWidth = 1.5 + (i % 3) * 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - len, y + len * 0.5); g.stroke(); }
    },
  },
  {
    id: 'abyss', name: 'THE OATH PIT', line: 'Every promise ever broken ends up down here.', glow: '#ff2a4a', floorTint: '#ff3a5a', ambience: 'drone',
    build() {
      const r = seeded(77);
      return [
        { par: 0.04, canvas: layer(W + 200, (g, w) => { sky(g, w, [[0, '#050207'], [0.5, '#2a0612'], [0.8, '#6a0c1e'], [1, '#2a0612']]); const e = g.createRadialGradient(w / 2, 260, 20, w / 2, 260, 300); e.addColorStop(0, 'rgba(255,60,80,0.85)'); e.addColorStop(0.25, 'rgba(180,20,50,0.5)'); e.addColorStop(1, 'rgba(120,10,30,0)'); g.fillStyle = e; g.fillRect(0, 0, w, H); g.fillStyle = '#12030a'; g.beginPath(); g.ellipse(w / 2, 260, 150, 60, 0, 0, 7); g.fill(); g.fillStyle = '#ff3a5a'; g.beginPath(); g.ellipse(w / 2, 260, 44, 56, 0, 0, 7); g.fill(); g.fillStyle = '#050207'; g.beginPath(); g.ellipse(w / 2, 260, 12, 44, 0, 0, 7); g.fill(); }) },
        { par: 0.3, canvas: layer(W + 500, (g, w) => { g.strokeStyle = '#16050b'; g.lineWidth = 9; for (let x = 60; x < w; x += 170 + r() * 120) { const len = 180 + r() * 320; g.setLineDash([16, 8]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 40, len); g.stroke(); g.setLineDash([]); g.fillStyle = '#16050b'; g.beginPath(); g.arc(x, len + 12, 16, 0, 7); g.fill(); } for (let x = 0; x < w; x += 340) column(g, x + 60, FLOOR + 6, 56, 420, '#12040a', false); }) },
        { par: 1, canvas: layer(W + 1400, (g, w) => { floor(g, w, FLOOR, '#3a0c18', '#0a0206', '#a01c36', r); g.strokeStyle = 'rgba(255,60,90,0.45)'; g.lineWidth = 3; for (let x = 100; x < w; x += 300) { g.beginPath(); g.ellipse(x, FLOOR + 50, 110, 22, 0, 0, 7); g.stroke(); } }) },
      ];
    },
    live(g, t, cam) { const p = 0.5 + Math.sin(t * 0.9) * 0.2; g.fillStyle = `rgba(255,40,70,${0.06 * p})`; g.fillRect(0, 0, W, H); for (let i = 0; i < 30; i++) { const x = (i * 97 + Math.sin(t * 0.4 + i) * 40 - cam * 0.4 + W * 4) % W, y = H - ((i * 61 + t * (20 + (i % 5) * 8)) % 640); g.fillStyle = `rgba(255,70,100,${0.2 + (i % 4) * 0.12})`; g.fillRect(x, y, 2.5, 7); } },
  },
];
export const ARENA_BY_ID = Object.fromEntries(ARENAS.map(a => [a.id, a]));
export const VIEW = { W, H, FLOOR };

const built = new Map();
export function drawArena(g, arena, t, camX) {
  if (!built.has(arena.id)) built.set(arena.id, arena.build());
  for (const L of built.get(arena.id)) { const span = L.canvas.width - W, x = Math.max(0, Math.min(span, span / 2 + camX * L.par)); g.drawImage(L.canvas, x, 0, W, H, 0, 0, W, H); if (L.par < 1 && L === built.get(arena.id)[built.get(arena.id).length - 2]) arena.live(g, t, camX); }
}
