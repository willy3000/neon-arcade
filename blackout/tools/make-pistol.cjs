'use strict';
// node blackout/tools/make-pistol.cjs  - writes blackout/assets/audio/pistol.wav, the service pistol's report.
//
// The pistol first used `pxx` from the Residue pack, which is a science-fiction sound: a pure 4 kHz whistle through
// the middle of it and a tail that holds its level instead of dying away, so it read as a laser. This one is made
// here from nothing but noise and a sine, shaped the way a pistol shot is: a broadband crack that goes dull within a
// tenth of a second, a short low pop under it, and two quick slaps off nearby walls. Nothing in it holds a pitch.
// It is seeded, so the same file comes out every time; the result is project-original (no third-party material).
const fs = require('node:fs');
const path = require('node:path');

const RATE = 44100, LENGTH = Math.round(RATE * 0.36), TAU = Math.PI * 2;
let seed = 0x9e3779b9;
const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const buffer = (fill) => Float64Array.from({ length: LENGTH }, (_, i) => fill(i / RATE, i));
// A two-pole filter (the usual audio "biquad"); kind is 'lowpass', 'highpass' or 'bandpass'.
function filter(x, kind, hz, q = 0.707) {
  const w = TAU * hz / RATE, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
  const b = kind === 'lowpass' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : kind === 'highpass' ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2] : [alpha, 0, -alpha];
  const out = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = (b[0] * x[i] + b[1] * x1 + b[2] * x2 - (-2 * cos) * y1 - (1 - alpha) * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; out[i] = y; }
  return out;
}
// A one-pole low-pass whose cutoff falls over time: bright at the muzzle, dull a moment later.
function closing(x, from, to, seconds) {
  const out = new Float64Array(x.length); let y = 0;
  for (let i = 0; i < x.length; i++) { const hz = to + (from - to) * Math.exp(-(i / RATE) / seconds), k = 1 - Math.exp(-TAU * hz / RATE); y += k * (x[i] - y); out[i] = y; }
  return out;
}
const decay = (t, seconds) => Math.exp(-t / seconds);

// The crack: noise with nothing below 700 Hz, gone in a few hundredths of a second, losing its top as it goes.
const crack = closing(filter(buffer((t) => noise() * decay(t, 0.022)), 'highpass', 700), 11000, 1800, 0.035);
// The punch: the mid-range body of the report, a little longer.
const punch = filter(buffer((t) => noise() * decay(t, 0.042)), 'bandpass', 1300, 0.6);
// The pop: a thump that drops from 240 to 85 Hz in a few hundredths of a second, like a struck drum, far too short to sound like a note.
let phase = 0;
const pop = buffer((t) => { phase += TAU * (85 + 155 * Math.exp(-t / 0.018)) / RATE; return Math.sin(phase) * decay(t, 0.034); });
// The rumble under it, and the air after it.
const rumble = filter(buffer((t) => noise() * decay(t, 0.05)), 'lowpass', 520);
const air = filter(buffer((t) => noise() * decay(t, 0.085) * Math.min(1, t / 0.012)), 'lowpass', 2600);

const dry = buffer((t, i) => crack[i] * 1.0 + punch[i] * 1.5 + pop[i] * 0.8 + rumble[i] * 0.9 + air[i] * 0.16);
// Two slaps off nearby walls, duller and quieter than the shot itself.
const dull = filter(dry, 'lowpass', 2400);
const wet = buffer((t, i) => dry[i] + (i >= 1014 ? dull[i - 1014] * 0.2 : 0) + (i >= 1852 ? dull[i - 1852] * 0.12 : 0));
// Driven into a soft limit, which is what makes a gunshot sound dense rather than like a drum; then set to a fixed
// peak and faded out over the last few hundredths of a second so the file ends in silence.
let top = 0; for (const v of wet) top = Math.max(top, Math.abs(v));
const shaped = buffer((t, i) => Math.tanh(wet[i] / top * 2.6) * Math.min(1, (LENGTH - i) / (RATE * 0.03)));
let peak = 0; for (const v of shaped) peak = Math.max(peak, Math.abs(v));
const PEAK = 0.7; // about -3 dBFS

const data = Buffer.alloc(44 + LENGTH * 2);
data.write('RIFF', 0); data.writeUInt32LE(36 + LENGTH * 2, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
data.writeUInt32LE(RATE, 24); data.writeUInt32LE(RATE * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(LENGTH * 2, 40);
for (let i = 0; i < LENGTH; i++) data.writeInt16LE(Math.round(shaped[i] / peak * PEAK * 32767), 44 + i * 2);
const file = path.join(__dirname, '..', 'assets', 'audio', 'pistol.wav');
fs.writeFileSync(file, data);
console.log(`wrote ${path.relative(process.cwd(), file)}: ${data.length} bytes, ${Math.round(LENGTH / RATE * 1000)} ms`);
