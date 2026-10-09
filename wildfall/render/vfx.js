// Pooled visual effects: particles, ribbons (trails, rope, lightning), shock rings, debris and short light flashes.
import * as THREE from '../vendor/three.bundle.min.js';

const pick = v => (Array.isArray(v) ? v[0] + Math.random() * (v[1] - v[0]) : v);
const tmpColor = new THREE.Color();

export class Particles {
  constructor(scene, count, additive) {
    this.n = count; this.head = 0; this.alive = 0;
    this.pos = new Float32Array(count * 3); this.vel = new Float32Array(count * 3); this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count); this.alpha = new Float32Array(count); this.life = new Float32Array(count); this.max = new Float32Array(count);
    this.base = new Float32Array(count); this.grav = new Float32Array(count); this.drag = new Float32Array(count); this.grow = new Float32Array(count);
    const g = this.geometry = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vColor; varying float vAlpha; void main(){ vColor=aColor; vAlpha=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: `varying vec3 vColor; varying float vAlpha; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,${additive ? '0.0' : '0.55'},d)*vAlpha; if(a<0.01) discard; gl_FragColor=vec4(vColor,a); }`,
    });
    this.points = new THREE.Points(g, this.material); this.points.frustumCulled = false; this.points.renderOrder = additive ? 30 : 20; scene.add(this.points);
  }
  one(x, y, z, vx, vy, vz, life, size, color, gravity = 0, drag = 0, grow = 0, bright = 1) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    tmpColor.set(color); this.col[i * 3] = tmpColor.r * bright; this.col[i * 3 + 1] = tmpColor.g * bright; this.col[i * 3 + 2] = tmpColor.b * bright;
    this.life[i] = this.max[i] = life; this.base[i] = size; this.grav[i] = gravity; this.drag[i] = drag; this.grow[i] = grow;
  }
  // o: count, speed, angle (radians, centre of the cone), spread (radians), life, size, color (one or a list), gravity, drag, grow, bright, depth, jitter
  burst(x, y, z, o) {
    const colors = Array.isArray(o.color) ? o.color : [o.color ?? 0xffffff];
    for (let k = 0; k < (o.count || 1); k++) {
      const a = (o.angle ?? Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2), s = pick(o.speed ?? 2), j = o.jitter || 0;
      this.one(x + (Math.random() - 0.5) * j, y + (Math.random() - 0.5) * j, z + (Math.random() - 0.5) * (o.depth ?? 0.6), Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * (o.vz ?? 1), pick(o.life ?? 0.5), pick(o.size ?? 0.2), colors[k % colors.length], o.gravity, o.drag, o.grow, o.bright);
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      this.life[i] -= dt; const t = Math.max(0, this.life[i] / this.max[i]), d = 1 - this.drag[i] * dt, j = i * 3;
      this.vel[j] *= d; this.vel[j + 1] = this.vel[j + 1] * d - this.grav[i] * dt; this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      this.size[i] = this.base[i] * (this.grow[i] ? 1 + this.grow[i] * (1 - t) : 0.35 + 0.65 * t); this.alpha[i] = Math.min(1, t * 2.2);
    }
    for (const name of ['position', 'aSize', 'aAlpha', 'aColor']) this.geometry.attributes[name].needsUpdate = true;
  }
}

// A strip of quads, used flat in the gameplay plane for trails, the grapple rope and lightning.
export class Ribbon {
  constructor(scene, max, color, additive = true, order = 25) {
    this.max = max; this.pos = new Float32Array(max * 6); this.col = new Float32Array(max * 8);
    const g = this.geometry = new THREE.BufferGeometry(), index = [];
    for (let i = 0; i < max - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setIndex(index); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 4)); g.setDrawRange(0, 0);
    this.color = new THREE.Color(color); this.bright = 1;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !additive }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = order; scene.add(this.mesh);
  }
  // points: [[ax, ay, az, bx, by, bz, alpha], ...] — the two edges of the strip at each station
  setEdges(points) {
    const n = Math.min(points.length, this.max), c = this.color, b = this.bright;
    for (let i = 0; i < n; i++) { const p = points[i]; this.pos.set([p[0], p[1], p[2], p[3], p[4], p[5]], i * 6); const a = p[6] ?? 1; this.col.set([c.r * b, c.g * b, c.b * b, a, c.r * b, c.g * b, c.b * b, a], i * 8); }
    this.geometry.attributes.position.needsUpdate = true; this.geometry.attributes.color.needsUpdate = true; this.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
  }
  // A line of constant or tapering width through [[x, y, alpha?], ...] at depth z.
  setLine(points, width, z = 0, taper = false) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const w = width * (taper ? 1 - i / (points.length - 1) * 0.85 : 1) * 0.5, nx = (-dy / len) * w, ny = (dx / len) * w, p = points[i];
      out.push([p[0] + nx, p[1] + ny, z, p[0] - nx, p[1] - ny, z, p[2] ?? 1]);
    }
    this.setEdges(out);
  }
  clear() { this.geometry.setDrawRange(0, 0); }
}

export class Effects {
  constructor(scene, quality) {
    this.scene = scene;
    this.glow = new Particles(scene, quality === 'low' ? 700 : 1800, true);
    this.dust = new Particles(scene, quality === 'low' ? 300 : 700, false);
    // Shock rings.
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.78, 1, 48);
    for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })); m.visible = false; m.renderOrder = 28; scene.add(m); this.rings.push({ mesh: m, life: 0 }); }
    // Tumbling debris.
    this.debrisCount = 140; this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), this.debrisCount);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.debris.castShadow = true; this.debris.frustumCulled = false; scene.add(this.debris);
    this.bits = Array.from({ length: this.debrisCount }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 0 })); this.bitHead = 0;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < this.debrisCount; i++) { this.debris.setMatrixAt(i, hide); this.debris.setColorAt(i, tmpColor.set(0x888888)); }
    // Lightning bolts and brief lights.
    this.bolts = Array.from({ length: 10 }, () => ({ ribbon: new Ribbon(scene, 14, 0x9fd0ff), life: 0, from: null, to: null, tick: 0 }));
    for (const b of this.bolts) b.ribbon.bright = 2.6;
    this.lights = Array.from({ length: 4 }, () => { const l = new THREE.PointLight(0xffffff, 0, 16, 1.6); scene.add(l); return { light: l, life: 0, max: 1, power: 0 }; });
    this.dummy = new THREE.Object3D();
  }
  ring(x, y, z, o = {}) {
    const r = this.rings.find(r => r.life <= 0) || this.rings[0];
    r.life = r.max = o.life ?? 0.35; r.from = o.from ?? 0.3; r.to = o.to ?? 2.5; r.mesh.position.set(x, y, z); r.mesh.rotation.set(o.ground ? -Math.PI / 2 : 0, 0, 0);
    r.mesh.material.color.set(o.color ?? 0xffffff).multiplyScalar(o.bright ?? 1.5); r.mesh.visible = true; r.alpha = o.alpha ?? 0.9;
  }
  chunks(x, y, z, o = {}) {
    for (let k = 0; k < (o.count ?? 8); k++) {
      const i = this.bitHead; this.bitHead = (this.bitHead + 1) % this.debrisCount; const b = this.bits[i];
      b.life = 0.9 + Math.random() * 0.9; b.s = pick(o.size ?? [0.12, 0.34]);
      b.p.set(x + (Math.random() - 0.5) * (o.w ?? 1), y + (Math.random() - 0.5) * (o.h ?? 1), z + (Math.random() - 0.5) * 1.6);
      const a = (o.angle ?? Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? 2.6), s = pick(o.speed ?? [3, 9]);
      b.v.set(Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * 4); b.w.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
      this.debris.setColorAt(i, tmpColor.set(Array.isArray(o.color) ? o.color[k % o.color.length] : o.color ?? 0x8a8378));
    }
    this.debris.instanceColor.needsUpdate = true;
  }
  bolt(from, to, life = 0.22) { const b = this.bolts.find(b => b.life <= 0) || this.bolts[0]; b.life = life; b.from = from; b.to = to; b.tick = 0; }
  flash(x, y, color, power = 30, life = 0.18, z = 2) { const l = this.lights.find(l => l.life <= 0) || this.lights[0]; l.life = l.max = life; l.power = power; l.light.color.set(color); l.light.position.set(x, y, z); }
  update(dt) {
    this.glow.update(dt); this.dust.update(dt);
    for (const r of this.rings) { if (r.life <= 0) continue; r.life -= dt; const t = 1 - Math.max(0, r.life / r.max), s = r.from + (r.to - r.from) * (1 - (1 - t) * (1 - t)); r.mesh.scale.setScalar(s); r.mesh.material.opacity = r.alpha * (1 - t); if (r.life <= 0) r.mesh.visible = false; }
    let moved = false;
    for (let i = 0; i < this.debrisCount; i++) {
      const b = this.bits[i]; if (b.life <= 0) continue; moved = true; b.life -= dt;
      b.v.y -= 30 * dt; b.p.addScaledVector(b.v, dt); b.r.x += b.w.x * dt; b.r.y += b.w.y * dt; b.r.z += b.w.z * dt;
      this.dummy.position.copy(b.p); this.dummy.rotation.copy(b.r); this.dummy.scale.setScalar(b.life <= 0 ? 0 : b.s * Math.min(1, b.life * 3)); this.dummy.updateMatrix(); this.debris.setMatrixAt(i, this.dummy.matrix);
    }
    if (moved) this.debris.instanceMatrix.needsUpdate = true;
    for (const b of this.bolts) {
      if (b.life <= 0) continue; b.life -= dt; b.tick -= dt;
      if (b.life <= 0) { b.ribbon.clear(); continue; }
      if (b.tick <= 0) { // re-jag the bolt a few times while it lives
        b.tick = 0.045; const [x0, y0] = b.from, [x1, y1] = b.to, len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(4, Math.min(13, Math.round(len * 1.6))), pts = [];
        for (let i = 0; i <= n; i++) { const t = i / n, off = i === 0 || i === n ? 0 : (Math.random() - 0.5) * Math.min(1.1, len * 0.2); pts.push([x0 + (x1 - x0) * t - ((y1 - y0) / len) * off, y0 + (y1 - y0) * t + ((x1 - x0) / len) * off, 1]); }
        b.ribbon.setLine(pts, 0.14 + Math.random() * 0.1, 0.4);
      }
    }
    for (const l of this.lights) { if (l.life <= 0) { l.light.intensity = 0; continue; } l.life -= dt; l.light.intensity = l.power * Math.max(0, l.life / l.max); }
  }
  setScale(pixels) { this.glow.material.uniforms.uScale.value = pixels; this.dust.material.uniforms.uScale.value = pixels; }
}
