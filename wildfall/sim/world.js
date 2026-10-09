// Static and moving collision geometry. Bodies are axis-aligned boxes described by a centre x, a bottom y, a half width and a height.
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
export const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const overlaps = (b, s) => b.x - b.hw < s.x + s.w && b.x + b.hw > s.x && b.y < s.y + s.h && b.y + b.h > s.y;
export const boxOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const bodyBox = b => ({ x: b.x - b.hw, y: b.y, w: b.hw * 2, h: b.h });
export const circleBox = (cx, cy, r, s) => { const dx = cx - clamp(cx, s.x, s.x + s.w), dy = cy - clamp(cy, s.y, s.y + s.h); return dx * dx + dy * dy <= r * r; };

const solid = s => !s.dead && !s.open;

// Moves a body by (dx, dy), stopping at solids. One-way platforms only stop bodies that land on them from above.
export function moveBody(world, b, dx, dy) {
  const res = { left: false, right: false, up: false, down: false, ground: null, wall: null, ceiling: null };
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.35)), sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx) {
      b.x += sx;
      for (const s of world.solids) {
        if (!solid(s) || s.oneWay || s === b.ignore || !overlaps(b, s)) continue;
        if (sx > 0) { b.x = s.x - b.hw; res.right = true; } else { b.x = s.x + s.w + b.hw; res.left = true; }
        res.wall = s;
      }
    }
    if (sy) {
      const before = b.y; b.y += sy;
      for (const s of world.solids) {
        if (!solid(s) || s === b.ignore) continue;
        if (s.oneWay && (sy > 0 || before < s.y + s.h - 0.02 || b.dropTimer > 0)) continue;
        if (!overlaps(b, s)) continue;
        if (sy > 0) { b.y = s.y - b.h; res.up = true; res.ceiling = s; } else { b.y = s.y + s.h; res.down = true; res.ground = s; }
      }
    }
  }
  return res;
}

// True when a solid sits immediately beside the body on the given side (used for wall slides, jumps and runs).
export function wallAt(world, b, dir, reach = 0.06) {
  const probe = { x: b.x + dir * reach, y: b.y + 0.25, hw: b.hw, h: b.h - 0.5 };
  for (const s of world.solids) if (solid(s) && !s.oneWay && !s.noWall && overlaps(probe, s)) return s;
  return null;
}
export function blocked(world, box) { for (const s of world.solids) if (solid(s) && !s.oneWay && boxOverlap(box, s)) return s; return null; }
export function groundBelow(world, x, y, depth = 0.6) { for (const s of world.solids) if (solid(s) && x > s.x && x < s.x + s.w && s.y + s.h <= y + 0.05 && s.y + s.h >= y - depth) return s; return null; }

// Nearest hit of the segment against solid geometry, as a fraction 0..1 of the segment, or null when clear.
export function raycast(world, x0, y0, x1, y1, ignore) {
  let best = null; const dx = x1 - x0, dy = y1 - y0;
  for (const s of world.solids) {
    if (!solid(s) || s.oneWay || s === ignore) continue;
    let lo = 0, hi = 1, miss = false;
    for (const [p, q] of [[-dx, x0 - s.x], [dx, s.x + s.w - x0], [-dy, y0 - s.y], [dy, s.y + s.h - y0]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) { miss = true; break; } } else { const t = q / p; if (p < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); if (lo > hi) { miss = true; break; } }
    }
    if (!miss && (!best || lo < best.t)) best = { t: lo, solid: s, x: x0 + dx * lo, y: y0 + dy * lo };
  }
  return best;
}
export const clearLine = (world, x0, y0, x1, y1, ignore) => !raycast(world, x0, y0, x1, y1, ignore);

export function zoneAt(world, type, x, y) { for (const z of world.zones) if (z.type === type && !z.off && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z; return null; }

// Advances moving platforms and carries or pushes the bodies they touch.
export function stepMovers(world, bodies, dt) {
  for (const s of world.solids) {
    s.vx = 0; s.vy = 0;
    const m = s.move; if (!m || s.dead || (m.trigger && !m.active)) continue;
    if (m.wait > 0) { m.wait -= dt; continue; }
    const [tx, ty] = m.pts[m.i], ddx = tx - s.x, ddy = ty - s.y, d = Math.hypot(ddx, ddy), step = m.speed * dt;
    let dx, dy;
    if (d <= step) { dx = ddx; dy = ddy; m.wait = m.pause || 0; if (m.once && m.i === m.pts.length - 1) m.active = false; else m.i = (m.i + 1) % m.pts.length; } else { dx = (ddx / d) * step; dy = (ddy / d) * step; }
    const riders = bodies.filter(b => b.ground === s && !b.dead);
    s.x += dx; s.y += dy; s.vx = dx / dt; s.vy = dy / dt;
    for (const b of riders) { b.ignore = s; moveBody(world, b, dx, 0); b.ignore = null; b.y = s.y + s.h; }
    for (const b of bodies) {
      if (b.dead || s.oneWay || riders.includes(b) || !overlaps(b, s)) continue;
      if (dx > 0) b.x = s.x + s.w + b.hw; else if (dx < 0) b.x = s.x - b.hw; else if (dy > 0) b.y = s.y + s.h; else b.y = s.y - b.h;
    }
  }
}

let nextId = 1;
export function addSolid(world, def) {
  const s = { kind: 'stone', material: 'stone', vx: 0, vy: 0, ...def, id: def.id || 'w' + nextId++ };
  if (s.move) s.move = { i: 1, wait: 0, pause: 0.6, speed: 3, active: !s.move.trigger, ...s.move, pts: s.move.pts.map(p => [...p]) };
  if (s.hp) s.maxHp = s.hp;
  world.solids.push(s);
  return s;
}

export function createWorld(level) {
  const world = { solids: [], anchors: [], zones: [], bounds: { ...level.bounds }, killY: level.killY ?? level.bounds.y - 6 };
  for (const def of level.solids) addSolid(world, def);
  for (const a of level.anchors || []) world.anchors.push({ ...a, id: a.id || 'wa' + nextId++ });
  for (const z of level.zones || []) world.zones.push({ ...z });
  return world;
}
