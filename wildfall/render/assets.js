// Asset loading with a shared cache. Models load on demand so the title screen does not wait for the whole campaign.
import * as THREE from '../vendor/three.bundle.min.js';

export const BASE = new URL('../assets/', import.meta.url).href;
const loader = new THREE.GLTFLoader(), cache = new Map();

export function load(path) {
  if (!cache.has(path)) cache.set(path, new Promise((resolve, reject) => loader.load(BASE + path, resolve, undefined, () => reject(new Error('Could not load ' + path)))));
  return cache.get(path);
}
export async function loadAll(paths, onProgress) {
  let done = 0; const unique = [...new Set(paths)];
  return Promise.all(unique.map(p => load(p).then(g => { onProgress?.(++done / unique.length); return g; })));
}
export const decoPath = name => (name.startsWith('hex/') ? `env/${name}.gltf` : `env/${name}.glb`);

// A skinned model can only be shown once, so every character on screen gets its own clone with its own materials.
export function instance(gltf) {
  const root = THREE.SkeletonUtils.clone(gltf.scene);
  root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
  return root;
}
export function prop(gltf, shadows = true) {
  const root = gltf.scene.clone(true);
  root.traverse(o => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = true; } });
  return root;
}

// Painted textures for the pieces of the world that are built from level geometry rather than loaded.
function canvasTexture(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rand = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
export const textures = {};
export function buildTextures() {
  if (textures.stone) return textures;
  textures.stone = canvasTexture(256, (g, s) => {
    const r = rand(7); g.fillStyle = '#6f6a62'; g.fillRect(0, 0, s, s);
    for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
      const w = s / 2, h = s / 4, x = col * w + (row % 2 ? w / 2 : 0), y = row * h, v = 96 + Math.floor(r() * 42);
      g.fillStyle = `rgb(${v + 12},${v + 6},${v - 4})`; g.fillRect(x + 3, y + 3, w - 6, h - 6);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 3, y + 3, w - 6, 5); g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x + 3, y + h - 9, w - 6, 6);
      for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(40,36,30,${0.08 + r() * 0.1})`; g.fillRect(x + 6 + r() * (w - 20), y + 6 + r() * (h - 16), 3 + r() * 9, 2 + r() * 4); }
    }
  });
  textures.wood = canvasTexture(128, (g, s) => {
    const r = rand(11); g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) { const v = 88 + Math.floor(r() * 30); g.fillStyle = `rgb(${v + 30},${v - 4},${v - 44})`; g.fillRect(i * 32 + 2, 0, 28, s); for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(40,24,10,${0.1 + r() * 0.15})`; g.fillRect(i * 32 + 4 + r() * 22, r() * s, 1.5, 12 + r() * 30); } }
  });
  textures.crack = canvasTexture(256, (g, s) => {
    const r = rand(3); g.fillStyle = '#7c7468'; g.fillRect(0, 0, s, s); g.strokeStyle = '#231d18'; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) { let x = r() * s, y = r() * s; g.lineWidth = 2 + r() * 3; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 70; y += (r() - 0.3) * 60; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(255,190,110,.5)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { let x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  });
  textures.glow = canvasTexture(64, (g, s) => { const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, s, s); });
  textures.glow.colorSpace = THREE.NoColorSpace;
  return textures;
}
