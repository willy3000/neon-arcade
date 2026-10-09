// Small authoring helpers so level files read as layouts rather than object literals. Positions are in metres; `top` is a walkable surface height.
export function builder(meta) {
  const L = { solids: [], anchors: [], zones: [], props: [], enemies: [], pickups: [], checkpoints: [], triggers: [], arenas: [], tablets: [], deco: [], gear: {}, ...meta };
  let n = 0; const id = prefix => prefix + ++n;
  const solid = def => { const s = { ...def, id: def.id || id('s') }; L.solids.push(s); return s; };
  const b = {
    L,
    // A floating landmass: grass on top, rock tapering away underneath.
    island: (x0, x1, top, depth = 4, o = {}) => solid({ x: x0, y: top - depth, w: x1 - x0, h: depth, kind: 'island', ...o }),
    stone: (x, y, w, h, o = {}) => solid({ x, y, w, h, kind: 'stone', ...o }),
    ledge: (x, y, w, o = {}) => solid({ x, y: y - 0.35, w, h: 0.35, kind: 'wood', oneWay: true, ...o }),
    mover: (x, y, w, pts, o = {}) => solid({ x, y: y - 0.5, w, h: 0.5, kind: 'mover', move: { pts: [[x, y - 0.5], ...pts.map(([px, py]) => [px, py - 0.5])], speed: o.speed ?? 3, pause: o.pause ?? 0.7, trigger: o.trigger }, id: o.id }),
    bounce: (x, top, w = 2.2, power = 23.5) => solid({ x, y: top - 0.5, w, h: 0.5, kind: 'bounce', bounce: power }),
    cracked: (x, y, w, h, o = {}) => solid({ x, y, w, h, kind: 'cracked', material: 'stone', hp: 40, ...o }),
    barricade: (x, y, w, h, o = {}) => solid({ x, y, w, h, kind: 'barricade', material: 'wood', hp: 34, noWall: true, ...o }),
    gate: (gid, x, y, h = 6) => solid({ id: gid, x, y, w: 0.8, h, kind: 'gate', gate: true, open: true, noWall: true }),
    anchor: (x, y, o = {}) => { const a = { id: id('a'), x, y, ...o }; L.anchors.push(a); return a; },
    zone: (type, x, y, w, h, o = {}) => { const z = { type, x, y, w, h, ...o }; L.zones.push(z); return z; },
    enemy: (type, x, y, o = {}) => L.enemies.push({ type, x, y, ...o }),
    prop: (type, x, y, o = {}) => L.props.push({ id: id('p'), type, x, y, ...o }),
    pickup: (pid, kind, x, y, o = {}) => L.pickups.push({ id: pid, kind, x, y, ...o }),
    checkpoint: (cid, x, y, name) => L.checkpoints.push({ id: cid, x, y, name }),
    trigger: (type, x, y, w, h, o = {}) => L.triggers.push({ id: id('t'), type, x, y, w, h, ...o }),
    hint: (key, x, y, w, h = 6, o = {}) => L.triggers.push({ id: id('t'), type: 'hint', key, x, y, w, h, once: false, ...o }),
    say: (x, y, w, lines, o = {}) => L.triggers.push({ id: id('t'), type: 'dialogue', x, y, w, h: 8, lines, ...o }),
    tablet: (tid, x, y, title, text) => L.tablets.push({ id: tid, x, y, title, text }),
    arena: def => L.arenas.push(def),
    // Scenery only: a model placed in the world with no collision.
    deco: (model, x, y, z = -2.5, o = {}) => L.deco.push({ model, x, y, z, ...o }),
  };
  return b;
}
