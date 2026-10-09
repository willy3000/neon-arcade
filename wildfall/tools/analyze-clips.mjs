// Measures when each attack clip actually swings, so combat timing can follow the animation instead of guesses.
// Usage: node wildfall/tools/analyze-clips.mjs [characters/hero-anims.glb|enemies/skeleton-anims.glb]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three.bundle.min.js';

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');
const file = path.join(assets, process.argv[2] || 'characters/hero-anims.glb');
const data = fs.readFileSync(file);
const gltf = await new Promise((resolve, reject) => new THREE.GLTFLoader().parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '', resolve, reject));
const root = gltf.scene, mixer = new THREE.AnimationMixer(root);
const bones = { right: root.getObjectByName('handslotr'), left: root.getObjectByName('handslotl'), hips: root.getObjectByName('hips') };
const v = new THREE.Vector3();
const rows = [];
for (const clip of gltf.animations) {
  if (!/Attack|Spellcast|Throw|Dodge|Jump|Block_Attack|Kick|Taunt|Awaken|Spawn|Hit_|Death/.test(clip.name) || clip.duration < 0.05) continue;
  const action = mixer.clipAction(clip); action.reset().play();
  const step = 1 / 60, samples = [];
  for (let t = 0; t <= clip.duration + 1e-6; t += step) { mixer.setTime(t); root.updateMatrixWorld(true); samples.push({ t, r: bones.right.getWorldPosition(v).clone(), l: bones.left.getWorldPosition(v).clone(), h: bones.hips.getWorldPosition(v).clone() }); }
  action.stop(); mixer.uncacheAction(clip);
  let peak = { speed: 0, t: 0, hand: 'right' };
  for (let i = 1; i < samples.length; i++) for (const [hand, key] of [['right', 'r'], ['left', 'l']]) { const speed = samples[i][key].distanceTo(samples[i - 1][key]) / step; if (speed > peak.speed) peak = { speed, t: samples[i].t, hand }; }
  // The swing window is the span around the peak where the hand still moves faster than 45% of peak speed.
  const key = peak.hand === 'right' ? 'r' : 'l'; let from = peak.t, to = peak.t;
  for (let i = 1; i < samples.length; i++) { const speed = samples[i][key].distanceTo(samples[i - 1][key]) / step; if (speed > peak.speed * 0.45) { if (samples[i].t < from) from = samples[i].t; if (samples[i].t > to && samples[i].t - to < 0.12) to = samples[i].t; } }
  const rootTravel = samples.at(-1).h.clone().sub(samples[0].h);
  rows.push(`${clip.name.padEnd(34)} dur ${clip.duration.toFixed(2)}  peak ${peak.t.toFixed(2)}s (${peak.hand}, ${peak.speed.toFixed(1)} u/s)  swing ${from.toFixed(2)}-${to.toFixed(2)}  hips travel x${rootTravel.x.toFixed(2)} y${rootTravel.y.toFixed(2)} z${rootTravel.z.toFixed(2)}`);
}
console.log(path.basename(file) + ': ' + gltf.animations.length + ' clips\n' + rows.join('\n'));
