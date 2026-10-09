// Builds the visible world from level data: sky, drifting islands, the platforms the simulation collides with, and scenery.
import * as THREE from '../vendor/three.bundle.min.js';
import { load, prop, decoPath, textures, buildTextures } from './assets.js';

export const BIOMES = {
  ruins: { top: 0x2b6cb8, mid: 0x86bfe9, horizon: 0xf6dcb4, low: 0xdfeaf2, sun: 0xfff0cf, key: 0xffe6c2, keyPower: 2.5, sky: 0xbcdcff, ground: 0x86754f, fog: 0xcfe0ee, grass: [0x86b94e, 0x6ea440, 0x9cc65a], rock: [0x8f8676, 0x736a5e, 0x5c544c], accent: 0x59e0d0 },
  canopy: { top: 0x1f7fa6, mid: 0x7fd0d8, horizon: 0xe8f3c9, low: 0xd9f0e6, sun: 0xfffbe0, key: 0xfff4d6, keyPower: 2.4, sky: 0xb6f0e2, ground: 0x5d7a4c, fog: 0xc8ead9, grass: [0x62b257, 0x4a9a4d, 0x86c96a], rock: [0x80887a, 0x646c60, 0x4c544c], accent: 0xffd166 },
};

const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const seeded = seed => () => { seed = (seed * 16807 + 11) % 2147483647; return seed / 2147483647; };
const col = new THREE.Color();
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, flatShading: true, ...extra });
const glowing = (color, bright = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(bright), toneMapped: false });

function sky(biome) {
  const u = { top: { value: new THREE.Color(biome.top) }, mid: { value: new THREE.Color(biome.mid) }, horizon: { value: new THREE.Color(biome.horizon) }, low: { value: new THREE.Color(biome.low) }, sun: { value: new THREE.Color(biome.sun) }, sunDir: { value: new THREE.Vector3(-0.42, 0.34, -0.84).normalize() } };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 low; uniform vec3 sun; uniform vec3 sunDir; varying vec3 vDir; void main(){ vec3 d=normalize(vDir); float h=d.y; vec3 c=mix(horizon,mid,smoothstep(0.0,0.22,h)); c=mix(c,top,smoothstep(0.2,0.85,h)); c=mix(c,low,smoothstep(0.02,-0.25,h)); float s=max(dot(d,sunDir),0.0); c+=sun*(pow(s,900.0)*3.0+pow(s,60.0)*0.22+pow(s,8.0)*0.07); gl_FragColor=vec4(c,1.0); }',
  }));
  mesh.renderOrder = -10; mesh.frustumCulled = false; return mesh;
}

// A landmass: flat walkable top, rock that narrows and roughens underneath. The top edge stays true to the collision box.
function islandMesh(w, h, biome, seed) {
  const depth = 6, segX = Math.max(2, Math.round(w / 1.6)), g = new THREE.BoxGeometry(w, h, depth, segX, Math.max(2, Math.round(h / 1.4)), 3).toNonIndexed(), pos = g.attributes.position, hw = w / 2;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const k = 1 - (y + h / 2) / h; // 0 at the top, 1 at the bottom
    if (k > 0.001) {
      const n1 = hash(x + seed, y, z), n2 = hash(z, x + seed, y), edge = THREE.MathUtils.smoothstep(Math.abs(x), hw - 2.5, hw);
      z *= 1 - 0.62 * Math.pow(k, 1.3); z += (n1 - 0.5) * 0.7 * k;
      x -= Math.sign(x) * Math.min(1.1, hw * 0.3) * k * k * edge; if (Math.abs(Math.abs(pos.getX(i)) - hw) > 0.01) x += (n2 - 0.5) * 0.5 * k;
      y -= k > 0.98 ? n1 * Math.min(2.2, 0.5 + w * 0.08) : (n2 - 0.5) * 0.25;
    }
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  const normal = g.attributes.normal, colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) { // colour whole faces so the flat shading reads as cut stone
    const up = normal.getY(i) > 0.8, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, k = 1 - (cy + h / 2) / h, n = hash(Math.round(cx * 2) + seed, Math.round(cy * 2), i % 7);
    if (up && k < 0.05) col.set(biome.grass[Math.floor(n * biome.grass.length)]); else { col.set(biome.rock[Math.min(2, Math.floor(k * 2.4 + n * 0.8))]); if (k < 0.12) col.lerp(new THREE.Color(0x5b4a34), 0.55); col.multiplyScalar(0.86 + n * 0.28); }
    for (let v = 0; v < 3; v++) colors.set([col.r, col.g, col.b], (i + v) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(g, flat(0xffffff, { vertexColors: true })); mesh.position.z = -0.5; mesh.castShadow = true; mesh.receiveShadow = true;
  const group = new THREE.Group(); group.add(mesh);
  // Overhanging turf along the front and back edges.
  const lip = new THREE.BoxGeometry(w + 0.2, 0.36, depth + 0.36, segX, 1, 1), lp = lip.attributes.position;
  for (let i = 0; i < lp.count; i++) if (lp.getY(i) < 0) lp.setY(i, lp.getY(i) - hash(lp.getX(i) + seed, 1, lp.getZ(i)) * 0.35);
  const turf = new THREE.Mesh(lip, flat(biome.grass[1])); turf.position.set(0, h / 2 - 0.19, -0.5); turf.receiveShadow = true; group.add(turf);
  return group;
}

function scaleUv(g, w, h, d, tile = 2.6) {
  const uv = g.attributes.uv, sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * sizes[f][0] / tile, uv.getY(i) * sizes[f][1] / tile); }
}
function block(w, h, d, texture, color = 0xffffff, extra = {}) {
  const g = new THREE.BoxGeometry(w, h, d); scaleUv(g, w, h, d);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texture, color, roughness: 0.95, ...extra })); m.castShadow = true; m.receiveShadow = true; return m;
}

function solidMesh(s, biome, T) {
  const group = new THREE.Group(), cx = s.w / 2, cy = s.h / 2;
  if (s.kind === 'island') { const m = islandMesh(s.w, s.h, biome, s.x * 3.1 + s.y); m.position.set(cx, cy, 0); group.add(m); }
  else if (s.kind === 'wood') {
    const plank = block(s.w, 0.24, 2.8, T.wood); plank.position.set(cx, s.h - 0.12, -0.3); group.add(plank);
    for (const x of [0.35, s.w - 0.35]) { const beam = block(0.22, 0.9, 0.22, T.wood, 0x9a8a78); beam.position.set(x, s.h - 0.6, -1.5); beam.rotation.x = 0.5; group.add(beam); }
  } else if (s.kind === 'mover') {
    const slab = block(s.w, s.h, 3.2, T.stone, 0xd8d2c4); slab.position.set(cx, cy, -0.3); group.add(slab);
    const rune = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.7, 0.08, 3.3), glowing(biome.accent, 1.8)); rune.position.set(cx, 0.1, -0.3); group.add(rune);
    const keel = new THREE.Mesh(new THREE.ConeGeometry(Math.min(1.1, s.w * 0.32), 1.5, 5), flat(biome.rock[1])); keel.rotation.x = Math.PI; keel.position.set(cx, -0.75, -0.3); keel.castShadow = true; group.add(keel);
  } else if (s.kind === 'bounce') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.5, 7), flat(0x3f7a44)); stem.position.set(cx, 0.1, 0); group.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(s.w / 2, 14, 8), new THREE.MeshStandardMaterial({ color: 0xff6fa8, emissive: 0xff3f8a, emissiveIntensity: 0.55, roughness: 0.5, flatShading: true }));
    cap.scale.set(1, 0.34, 0.9); cap.position.set(cx, s.h - 0.1, 0); cap.castShadow = true; group.add(cap); group.userData.cap = cap;
    for (let i = 0; i < 6; i++) { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), glowing(0xfff0c0, 1.6)); const a = (i / 6) * Math.PI * 2; dot.position.set(cx + Math.cos(a) * s.w * 0.3, s.h + 0.08, Math.sin(a) * s.w * 0.25); group.add(dot); }
  } else if (s.kind === 'cracked') { const m = block(s.w, s.h, 4.4, T.crack, 0xe4d8c4); m.position.set(cx, cy, -0.6); group.add(m); }
  else if (s.kind === 'barricade') {
    for (let i = 0; i < 5; i++) { const p = block(0.3, s.h * (0.85 + hash(i, s.x, 1) * 0.25), 0.3, T.wood, 0xc9b294); p.position.set(cx + (hash(i, 2, s.x) - 0.5) * 0.4, cy, -1.6 + i * 0.6); p.rotation.z = (hash(i, 3, s.x) - 0.5) * 0.3; group.add(p); }
    for (const y of [s.h * 0.3, s.h * 0.7]) { const p = block(0.26, 0.26, 3.2, T.wood, 0xb39a7a); p.position.set(cx + 0.2, y, -0.4); p.rotation.x = (hash(y, s.x, 5) - 0.5) * 0.25; group.add(p); }
  } else if (s.kind === 'gate') {
    const bars = new THREE.Group(), iron = new THREE.MeshStandardMaterial({ color: 0x2c2f38, roughness: 0.5, metalness: 0.7 });
    for (let i = 0; i < 6; i++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, s.h, 6), iron); bar.position.set(cx, cy, -2.2 + i * 0.75); bar.castShadow = true; bars.add(bar); }
    for (const y of [0.6, s.h * 0.5, s.h - 0.5]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.4), iron); rail.position.set(cx, y, -0.35); bars.add(rail); }
    const seal = new THREE.Mesh(new THREE.BoxGeometry(0.2, s.h * 0.8, 0.12), glowing(0xff5a3c, 1.4)); seal.position.set(cx, cy, 1.55); bars.add(seal);
    group.add(bars); group.userData.bars = bars; group.userData.height = s.h; bars.position.y = s.open ? s.h : 0;
  } else if (s.kind === 'ice') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 2.8), new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x4fb4ff, emissiveIntensity: 0.45, roughness: 0.15, transparent: true, opacity: 0.86, flatShading: true }));
    m.position.set(cx, cy, 0); group.add(m);
    for (let i = 0; i < 7; i++) { const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16 + hash(i, s.x, 2) * 0.16, 0.5 + hash(i, s.y, 3) * 0.7, 5), m.material); spike.rotation.x = Math.PI; spike.position.set(0.3 + hash(i, 4, s.x) * (s.w - 0.6), -0.3, (hash(i, 5, s.x) - 0.5) * 2.2); group.add(spike); }
  } else {
    const m = block(s.w, s.h, 4.6, T.stone); m.position.set(cx, cy, -0.6); group.add(m);
    const cap = block(s.w + 0.16, 0.2, 4.8, T.stone, 0xf0e8d8); cap.position.set(cx, s.h - 0.1, -0.6); group.add(cap);
  }
  group.position.set(s.x, s.y, 0);
  return group;
}

function floatingIsland(radius, height, biome, rand) {
  const group = new THREE.Group(), sides = 9;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, radius * 0.12, sides), flat(biome.grass[Math.floor(rand() * 3)])); group.add(top);
  const g = new THREE.ConeGeometry(radius * 0.96, height, sides, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.5 - p.getY(i) / height; p.setX(i, p.getX(i) * (1 + (hash(i, radius, 1) - 0.5) * 0.35 * k)); p.setZ(i, p.getZ(i) * (1 + (hash(i, radius, 2) - 0.5) * 0.35 * k)); }
  g.computeVertexNormals();
  const body = new THREE.Mesh(g, flat(biome.rock[Math.floor(rand() * 2)])); body.rotation.x = Math.PI; body.position.y = -height / 2 - radius * 0.05; group.add(body);
  return group;
}

function waterfall(width, length, color) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float time; uniform vec3 tint; varying vec2 vUv; float n(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); } void main(){ float s=n(vec2(floor(vUv.x*14.0),floor((vUv.y+time*0.5)*9.0))); float edge=smoothstep(0.0,0.2,vUv.x)*smoothstep(1.0,0.8,vUv.x); float a=(0.5+0.45*s)*edge*smoothstep(0.0,0.12,vUv.y)*smoothstep(1.0,0.96,vUv.y); gl_FragColor=vec4(mix(tint,vec3(1.0),s*0.6),a*0.82); }',
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat); m.userData.fall = mat; return m;
}

export class Scenery {
  constructor(scene, level) {
    this.scene = scene; this.level = level; this.biome = BIOMES[level.biome] || BIOMES.ruins; this.root = new THREE.Group(); scene.add(this.root);
    this.solids = new Map(); this.anchors = []; this.props = new Map(); this.pickups = new Map(); this.shrines = new Map(); this.falls = []; this.clouds = []; this.drifters = []; this.torches = []; this.water = [];
    this.T = buildTextures();
  }

  async build(onProgress) {
    const L = this.level, B = this.biome, root = this.root, rand = seeded(Math.round(L.bounds.w * 7 + 13));
    root.add(sky(B));
    const paths = ['env/hex/cloud_big.gltf', 'env/hex/cloud_small.gltf', 'env/hex/tree_single_A.gltf', 'env/hex/tree_single_B.gltf', 'env/hex/trees_A_medium.gltf', 'env/hex/trees_B_large.gltf', 'env/hex/rock_single_A.gltf', 'env/hex/rock_single_C.gltf', 'env/hex/rock_single_E.gltf',
      'env/hex/mountain_A.gltf', 'env/hex/mountain_B.gltf', 'env/hex/mountain_A_grass_trees.gltf', 'env/hex/hills_A_trees.gltf', 'env/hex/building_castle_blue.gltf', 'env/hex/building_tower_A_blue.gltf', 'env/hex/building_church_blue.gltf', 'env/hex/building_windmill_blue.gltf',
      'env/dungeon/barrel_large.glb', 'env/dungeon/box_large.glb', 'env/dungeon/pillar.glb', ...L.deco.map(d => decoPath(d.model))];
    const loaded = new Map(); let done = 0;
    await Promise.all([...new Set(paths)].map(p => load(p).then(g => { loaded.set(p, g); onProgress?.(++done / new Set(paths).size); })));
    const model = (name, shadows) => prop(loaded.get(decoPath(name)), shadows);

    // Collision geometry, exactly as the simulation sees it.
    for (const s of L.solids) this.addSolid(s);

    // Grapple anchors hang from their own small rock so the attachment point is always visible.
    for (const a of L.anchors) {
      const g = new THREE.Group(), ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 20), new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.8, roughness: 0.35, emissive: 0x6a4a10 }));
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), glowing(B.accent, 2.2)), halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.T.glow, color: B.accent, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
      halo.scale.setScalar(2.2); const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75), flat(B.rock[1])); rock.position.y = 1.55; rock.scale.set(1.3, 0.8, 1.1); rock.castShadow = true;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 5), new THREE.MeshStandardMaterial({ color: 0x4a4a52, metalness: 0.7, roughness: 0.4 })); chain.position.y = 0.78;
      g.add(ring, core, halo, rock, chain); g.position.set(a.x, a.y, 0); root.add(g); this.anchors.push({ def: a, group: g, ring, core, halo });
    }

    for (const z of L.zones) {
      if (z.type === 'wallrun') {
        const wall = block(z.w, z.h, 0.7, this.T.stone, 0xc9d4d0); wall.position.set(z.x + z.w / 2, z.y + z.h / 2, -3.05); root.add(wall);
        for (let x = z.x + 1; x < z.x + z.w - 0.5; x += 1.5) { const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), glowing(B.accent, 1.3)); mark.position.set(x, z.y + z.h * 0.3 + Math.sin(x * 1.3) * 0.25, -2.68); mark.rotation.z = Math.PI / 4; root.add(mark); }
      } else if (z.type === 'water') {
        const surface = new THREE.Mesh(new THREE.PlaneGeometry(z.w, 6), new THREE.MeshStandardMaterial({ color: 0x3fa7c9, transparent: true, opacity: 0.62, roughness: 0.1, metalness: 0.3, emissive: 0x0b3a52 })); surface.rotation.x = -Math.PI / 2; surface.position.set(z.x + z.w / 2, z.y + z.h, -0.5); root.add(surface);
        const front = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.h), new THREE.MeshBasicMaterial({ color: 0x2f8fb5, transparent: true, opacity: 0.4, depthWrite: false })); front.position.set(z.x + z.w / 2, z.y + z.h / 2, 2.4); root.add(front);
        this.water.push({ zone: z, surface, front });
      }
    }

    for (const d of L.props) this.addProp(d, model);
    for (const pk of L.pickups) this.addPickup(pk);
    for (const c of L.checkpoints) {
      const g = new THREE.Group(), base = model('dungeon/pillar'); base.scale.setScalar(0.55); g.add(base);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), new THREE.MeshStandardMaterial({ color: 0x6f7f8c, emissive: 0x16323a, emissiveIntensity: 1, roughness: 0.3, flatShading: true })); crystal.position.y = 3; crystal.scale.y = 1.5; g.add(crystal);
      const light = new THREE.PointLight(B.accent, 0, 9, 1.6); light.position.y = 3; g.add(light);
      g.position.set(c.x, c.y, -1.9); root.add(g); this.shrines.set(c.id, { crystal, light, lit: false });
    }
    for (const t of L.tablets) {
      const slab = block(1.1, 1.5, 0.3, this.T.stone, 0xd9d2c0); slab.position.set(t.x, t.y + 0.75, -1.5); slab.rotation.z = 0.06; root.add(slab);
      for (let i = 0; i < 4; i++) { const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.34 + hash(i, t.x, 1) * 0.3, 0.07), glowing(B.accent, 1.5)); glyph.position.set(t.x, t.y + 1.15 - i * 0.22, -1.33); glyph.rotation.z = 0.06; root.add(glyph); }
    }

    // Authored scenery.
    for (const d of L.deco) {
      const m = model(d.model); m.position.set(d.x, d.y, d.z); m.scale.setScalar(d.scale ?? 1); m.rotation.set(0, d.rot ?? 0, d.tilt ?? 0); root.add(m);
      if (d.model.includes('torch')) { const light = new THREE.PointLight(0xffa24a, 14, 11, 1.7); light.position.set(d.x, d.y + (d.model.includes('mounted') ? 0.6 : 0.9) * (d.scale ?? 1), d.z + 0.5); root.add(light); this.torches.push({ light, x: light.position.x, y: light.position.y, z: light.position.z, seed: d.x }); }
    }
    // Trees, rocks and grass scattered along the back of every island so no surface is bare.
    const tuft = new THREE.ConeGeometry(0.09, 0.42, 4), tufts = [];
    for (const s of L.solids) {
      if (s.kind !== 'island') continue; const top = s.y + s.h;
      for (let x = s.x + 1.2; x < s.x + s.w - 1; x += 2.2 + rand() * 3.6) {
        const r = rand(), name = r < 0.3 ? 'hex/tree_single_A' : r < 0.52 ? 'hex/tree_single_B' : r < 0.62 ? 'hex/trees_A_medium' : r < 0.8 ? 'hex/rock_single_A' : r < 0.9 ? 'hex/rock_single_C' : 'hex/rock_single_E';
        const m = model(name), tree = name.includes('tree'); m.position.set(x, top - 0.05, tree ? -2.3 - rand() * 0.9 : -1.9 - rand() * 1.3); m.scale.setScalar(tree ? 2.1 + rand() * 1.5 : 1.3 + rand() * 1.2); m.rotation.y = rand() * 6.28; root.add(m);
      }
      for (let x = s.x + 0.3; x < s.x + s.w - 0.3; x += 0.38 + rand() * 0.5) tufts.push([x, top + 0.18, rand() < 0.75 ? -1.4 - rand() * 2 : 1.3 + rand() * 0.9, 0.7 + rand() * 0.9, rand()]);
    }
    if (tufts.length) {
      const inst = new THREE.InstancedMesh(tuft, flat(0xffffff), tufts.length), o = new THREE.Object3D();
      tufts.forEach(([x, y, z, s, r], i) => { o.position.set(x, y, z); o.scale.set(s, s, s); o.rotation.set((r - 0.5) * 0.4, r * 6, (r - 0.5) * 0.5); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); inst.setColorAt(i, col.set(B.grass[Math.floor(r * 3)]).multiplyScalar(0.85 + r * 0.35)); });
      inst.receiveShadow = true; root.add(inst);
    }

    // The far world: drifting islands with peaks, forests, ruins and waterfalls, fading into the haze.
    const far = ['hex/mountain_A', 'hex/mountain_B', 'hex/mountain_A_grass_trees', 'hex/hills_A_trees', 'hex/trees_B_large', 'hex/building_tower_A_blue', 'hex/building_church_blue', 'hex/building_windmill_blue'];
    const span = L.bounds.w, count = Math.round(span / 9);
    for (let i = 0; i < count; i++) {
      const z = -42 - rand() * rand() * 230, radius = 5 + rand() * 11 + -z * 0.06, x = L.bounds.x - 60 + rand() * (span + 120), y = L.bounds.y + 2 + rand() * (L.bounds.h * 0.9) + z * 0.06;
      const isle = floatingIsland(radius, radius * (1.2 + rand() * 1.3), B, rand); isle.position.set(x, y, z);
      for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) { const m = model(far[Math.floor(rand() * far.length)], false), a = rand() * 6.28, r = rand() * radius * 0.55; m.position.set(Math.cos(a) * r, radius * 0.06, Math.sin(a) * r); m.scale.setScalar(radius * (0.28 + rand() * 0.25)); m.rotation.y = rand() * 6.28; isle.add(m); }
      if (rand() < 0.45) { const fall = waterfall(radius * 0.22, radius * 3.2, 0xbfe6ff); fall.position.set((rand() - 0.5) * radius, -radius * 1.6, radius * 0.86); isle.add(fall); this.falls.push(fall.userData.fall); }
      root.add(isle); this.drifters.push({ mesh: isle, y, phase: rand() * 6.28, amp: 0.4 + rand() * 0.8 });
    }
    // The Gate's citadel on the horizon gives the chapter a destination you can see from the first vista.
    if (L.biome === 'ruins') {
      const citadel = floatingIsland(46, 80, B, rand); citadel.position.set(L.bounds.x + span + 30, L.bounds.y + 44, -150);
      for (const [name, x, z, s] of [['hex/building_castle_blue', 0, 0, 30], ['hex/building_tower_A_blue', -24, 6, 22], ['hex/building_tower_A_blue', 24, -4, 26], ['hex/building_church_blue', -8, -22, 20], ['hex/mountain_B', 14, -26, 30]]) { const m = model(name, false); m.position.set(x, 5, z); m.scale.setScalar(s); citadel.add(m); }
      const fall = waterfall(9, 150, 0xcdeeff); fall.position.set(-12, -74, 40); citadel.add(fall); this.falls.push(fall.userData.fall); root.add(citadel);
    }
    // Clouds: a sea of them below the islands and loose banks drifting between the layers.
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeaf5, emissiveIntensity: 0.22, roughness: 1, flatShading: true });
    const cloud = big => { const m = model(big ? 'hex/cloud_big' : 'hex/cloud_small', false); m.traverse(o => { if (o.isMesh) { o.material = cloudMat; o.receiveShadow = false; } }); return m; };
    for (let i = 0; i < Math.round(span / 3.2); i++) {
      // Banks drifting between the island layers stay well behind the play area; the cloud sea lies below it.
      const sea = rand() < 0.62, m = cloud(rand() < 0.6), s = sea ? 9 + rand() * 13 : 8 + rand() * 22, z = sea ? -70 + rand() * 78 : -50 - s * 1.6 - rand() * 180;
      m.position.set(L.bounds.x - 80 + rand() * (span + 160), sea ? L.killY - 8 - rand() * 9 + z * 0.02 : L.bounds.y + rand() * L.bounds.h * 1.1, z);
      m.scale.set(s * (1.2 + rand()), s * (0.5 + rand() * 0.4), s); m.rotation.y = rand() * 6.28; root.add(m);
      this.clouds.push({ mesh: m, speed: 0.25 + rand() * 0.7, min: L.bounds.x - 100, max: L.bounds.x + span + 100 });
    }
  }

  addSolid(s) { if (s.hidden) return; const g = solidMesh(s, this.biome, this.T); this.root.add(g); this.solids.set(s.id, { group: g, def: s, kind: s.kind }); return g; }

  addProp(d, model) {
    const g = new THREE.Group(), B = this.biome;
    if (d.type === 'barrel') { const m = model('dungeon/barrel_large'); m.scale.setScalar(0.8); g.add(m); const band = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.05, 6, 16), glowing(0xff7a2a, 1.2)); band.rotation.x = Math.PI / 2; band.position.y = 0.65; g.add(band); g.userData.band = band; }
    else if (d.type === 'crate') { const m = model('dungeon/box_large'); m.scale.setScalar(0.72); g.add(m); }
    else if (d.type === 'pylon') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.52, 2.6, 5), flat(0x4a4f5c)); body.position.y = 1.3; body.castShadow = true; g.add(body);
      const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), glowing(0x4a6a8c, 1)); rune.position.y = 3.05; g.add(rune);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.1), glowing(0x4a6a8c, 1)); strip.position.set(0, 1.3, 0.42); g.add(strip);
      const light = new THREE.PointLight(B.accent, 0, 8, 1.6); light.position.y = 3; g.add(light); g.userData = { rune, strip, light };
    }
    g.position.set(d.x, d.y, d.type === 'pylon' ? -1 : 0); this.root.add(g); this.props.set(d.id, { group: g, def: d });
  }

  addPickup(pk) {
    const g = new THREE.Group(), B = this.biome;
    if (pk.kind === 'skyshard') { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), glowing(0x7df6ff, 1.9)); m.scale.y = 1.6; g.add(m); }
    else if (pk.kind === 'heart') g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.36), glowing(0xff5d7a, 1.7)));
    else { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 8, 18), glowing(0xffd36a, 1.8)), hook = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), glowing(0xfff2c0, 1.8)); hook.position.y = 0.5; g.add(ring, hook); }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.T.glow, color: pk.kind === 'heart' ? 0xff5d7a : pk.kind === 'gear' ? 0xffd36a : 0x7df6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 })); halo.scale.setScalar(2.4); g.add(halo);
    g.position.set(pk.x, pk.y, 0); this.root.add(g); this.pickups.set(pk.id, { group: g, def: pk });
  }

  breakSolid(id) { const v = this.solids.get(id); if (v) v.group.visible = false; }

  // Keeps everything that moves or changes in step with the simulation.
  sync(sim, dt, time, target) {
    // After a respawn the world is rebuilt; anything conjured in the previous attempt (ice, for example) must not linger on screen.
    if (this.world !== sim.world) { this.world = sim.world; const live = new Set(sim.world.solids.map(s => s.id)); for (const [id, v] of this.solids) if (!live.has(id)) { this.root.remove(v.group); this.solids.delete(id); } for (const v of this.props.values()) { v.on = false; } }
    for (const s of sim.world.solids) {
      let v = this.solids.get(s.id);
      if (!v) { if (s.dead || s.hidden) continue; this.addSolid(s); v = this.solids.get(s.id); if (s.temp) { v.group.scale.setScalar(0.2); v.grow = 0; } }
      v.group.visible = !s.dead;
      if (s.dead) continue;
      v.group.position.set(s.x, s.y, 0);
      if (v.grow !== undefined && v.grow < 1) { v.grow = Math.min(1, v.grow + dt * 6); v.group.scale.setScalar(0.2 + 0.8 * (1 - Math.pow(1 - v.grow, 3))); }
      if (s.temp && s.ttl < 1.2) v.group.visible = Math.floor(s.ttl * 12) % 2 === 0 || s.ttl > 0.6;
      const bars = v.group.userData.bars; if (bars) bars.position.y += ((s.open ? v.group.userData.height + 0.4 : 0) - bars.position.y) * Math.min(1, dt * 7);
      const cap = v.group.userData.cap; if (cap) { v.squash = Math.max(0, (v.squash || 0) - dt * 4); cap.scale.y = 0.34 * (1 - 0.6 * Math.sin(v.squash * Math.PI) * v.squash) * (1 + Math.sin(time * 2 + s.x) * 0.04); }
      if (s.burning > 0) v.burning = true;
    }
    for (const a of this.anchors) {
      const live = sim.gear.grapple && !a.def.off, hot = target === a.def;
      a.group.visible = true; a.group.position.set(a.def.x, a.def.y, 0); a.ring.rotation.y += dt * (hot ? 5 : 1.2); a.core.rotation.y -= dt * 2;
      a.halo.material.opacity += ((live ? (hot ? 1 : 0.5) : 0.08) - a.halo.material.opacity) * Math.min(1, dt * 10); a.halo.scale.setScalar(hot ? 3.4 + Math.sin(time * 9) * 0.3 : 2.2); a.core.visible = live;
    }
    for (const p of sim.props) {
      const v = this.props.get(p.id); if (!v) continue; v.group.visible = !p.dead;
      if (p.type === 'barrel' && p.fuse >= 0) { const f = Math.sin(time * 40) > 0; v.group.userData.band.material.color.setRGB(f ? 4 : 1.2, f ? 2 : 0.4, 0.2); v.group.scale.setScalar(1 + (0.7 - Math.min(0.7, p.fuse)) * 0.25); }
      if (p.type === 'pylon') { const u = v.group.userData, on = p.active; u.rune.rotation.y += dt * (on ? 3 : 0.6); u.rune.position.y = 3.05 + Math.sin(time * 2) * 0.08; if (on && !v.on) { v.on = true; u.rune.material.color.set(this.biome.accent).multiplyScalar(2.6); u.strip.material.color.set(this.biome.accent).multiplyScalar(2.2); u.light.intensity = 18; } }
    }
    for (const pk of sim.pickups) {
      const v = pk.id && this.pickups.get(pk.id); if (!v) continue;
      v.group.visible = !pk.taken && (!pk.when || !!sim.flags[pk.when]); v.group.position.y = pk.y + Math.sin(time * 2.4 + pk.x) * 0.16; v.group.children[0].rotation.y += dt * 2.2;
    }
    for (const [id, s] of this.shrines) { const lit = sim.checkpoint === id; if (lit !== s.lit) { s.lit = lit; s.crystal.material.emissive.set(lit ? this.biome.accent : 0x16323a); s.crystal.material.emissiveIntensity = lit ? 2.6 : 1; s.light.intensity = lit ? 16 : 0; } s.crystal.rotation.y += dt * (lit ? 1.6 : 0.3); s.crystal.position.y = 3 + Math.sin(time * 1.7 + s.crystal.id) * 0.1; }
    for (const f of this.falls) f.uniforms.time.value = time;
    for (const c of this.clouds) { c.mesh.position.x += c.speed * dt; if (c.mesh.position.x > c.max) c.mesh.position.x = c.min; }
    for (const d of this.drifters) d.mesh.position.y = d.y + Math.sin(time * 0.25 + d.phase) * d.amp;
    for (const t of this.torches) t.light.intensity = 12 + Math.sin(time * 11 + t.seed) * 2 + Math.sin(time * 23 + t.seed * 2) * 1.4;
    for (const w of this.water) { const live = w.zone.live > 0; w.surface.material.emissive.set(live ? 0x9fd8ff : 0x0b3a52); w.surface.material.emissiveIntensity = live ? 2 + Math.sin(time * 60) : 1; w.surface.position.y = w.zone.y + w.zone.h + Math.sin(time * 1.3) * 0.03; }
  }
  dispose() { this.scene.remove(this.root); this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
}
