// Sampled effects (Kenney, CC0) plus a small synthesised wind-and-drone bed. Each character has its own pitch range and voice.
import { BASE } from './render/assets.js';

const FILES = ['step0', 'step1', 'step2', 'step3', 'stone0', 'stone1', 'stone2', 'land', 'landHeavy', 'jump', 'doubleJump', 'dash', 'wallJump', 'slide', 'swing0', 'swing1', 'swing2', 'swingHeavy', 'hit0', 'hit1', 'hit2', 'hitHeavy', 'armor', 'block', 'parry', 'bone0', 'bone1',
  'breakStone', 'breakWood', 'grappleFire', 'grappleAttach', 'rope0', 'rope1', 'rope2', 'grappleRelease', 'fire', 'fireball', 'explosion0', 'explosion1', 'boom', 'slam', 'ice0', 'ice1', 'iceBreak', 'zap0', 'zap1', 'zapChain', 'shield', 'shieldHit', 'blade', 'bounce', 'pickup', 'shard',
  'heal', 'checkpoint', 'unlock', 'victory', 'defeat', 'bossIntro', 'enemyCast', 'enemyShot', 'telegraph', 'hurt', 'uiMove', 'uiSelect', 'uiConfirm', 'uiBack', 'gate', 'chest', 'tablet', 'flow', 'perfect'];
// Pitch and loudness that give each hero a recognisable sound: Vyx quick and bright, Sera airy, Bragg low and heavy.
const VOICE = { vyx: { rate: 1.18, step: 1.15, weight: 0.8 }, sera: { rate: 1, step: 1.05, weight: 0.7 }, bragg: { rate: 0.72, step: 0.78, weight: 1.35 } };
const pick = list => list[Math.floor(Math.random() * list.length)];

export class Audio {
  constructor(settings) { this.settings = settings; this.buffers = new Map(); this.ctx = null; this.voice = VOICE.vyx; this.stepT = 0; this.ropeT = 0; this.last = new Map(); }
  async load(onProgress) {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); this.bed = this.ctx.createGain(); this.bed.gain.value = 0; this.bed.connect(this.master); this.apply();
    let done = 0;
    await Promise.all(FILES.map(async name => {
      try { const data = await (await fetch(`${BASE}audio/${name}.ogg`)).arrayBuffer(); this.buffers.set(name, await this.ctx.decodeAudioData(data)); } catch { /* a missing sound must never stop the game */ }
      onProgress?.(++done / FILES.length);
    }));
  }
  apply() { if (this.master) this.master.gain.value = this.settings.muted ? 0 : this.settings.volume; if (this.bed) this.bed.gain.setTargetAtTime(this.playing && this.settings.music ? 0.5 : 0, this.ctx.currentTime, 0.6); }
  unlock() { if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {}); }
  setCharacter(id) { this.voice = VOICE[id] || VOICE.vyx; }
  play(name, volume = 0.5, rate = 1, gap = 0.03) {
    const buffer = this.buffers.get(name); if (!buffer || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime; if (now - (this.last.get(name) || -1) < gap) return; this.last.set(name, now);
    const src = this.ctx.createBufferSource(), gain = this.ctx.createGain(); src.buffer = buffer; src.playbackRate.value = rate * (0.96 + Math.random() * 0.08); gain.gain.value = volume; src.connect(gain); gain.connect(this.master); src.start();
  }
  // Wind and a slow drone, built from noise and oscillators so the world is never silent.
  startBed() {
    if (!this.ctx || this.nodes) { this.playing = true; this.apply(); return; }
    const ctx = this.ctx, len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.06; d[i] = b; }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true; const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 420; filter.Q.value = 0.6; const wind = ctx.createGain(); wind.gain.value = 0.55;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = 0.09; lfoGain.gain.value = 240; lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
    noise.connect(filter); filter.connect(wind); wind.connect(this.bed); noise.start(); lfo.start(); this.nodes = [noise, lfo];
    for (const [freq, level] of [[73.4, 0.05], [110, 0.035], [146.8, 0.022], [220.3, 0.012]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = freq; g.gain.value = level; const wobble = ctx.createOscillator(), wg = ctx.createGain(); wobble.frequency.value = 0.05 + Math.random() * 0.1; wg.gain.value = level * 0.6; wobble.connect(wg); wg.connect(g.gain); o.connect(g); g.connect(this.bed); o.start(); wobble.start(); this.nodes.push(o, wobble); }
    this.playing = true; this.apply();
  }
  stopBed() { this.playing = false; this.apply(); }

  // Footsteps and rope creaks follow the simulation rather than events.
  frame(sim, dt) {
    const p = sim.player, v = this.voice, speed = Math.abs(p.vx);
    if (p.onGround && speed > 2.5 && p.mode === 'normal' && !p.dead) { this.stepT -= dt * speed; if (this.stepT <= 0) { this.stepT = 2.5; this.play(p.ground?.kind === 'island' ? pick(['step0', 'step1', 'step2', 'step3']) : pick(['stone0', 'stone1', 'stone2']), 0.22 * v.weight, v.step); } }
    if (p.mode === 'grapple') { this.ropeT -= dt * Math.hypot(p.vx, p.vy); if (this.ropeT <= 0) { this.ropeT = 22; this.play(pick(['rope0', 'rope1', 'rope2']), 0.3, 0.9 + Math.random() * 0.3, 0.3); } }
  }
  handle(ev, sim) {
    const v = this.voice, P = (name, vol, rate, gap) => this.play(name, vol, rate, gap);
    switch (ev.type) {
      case 'jump': P(ev.kind === 'double' ? 'doubleJump' : ev.kind === 'wall' || ev.kind === 'wallrun' ? 'wallJump' : 'jump', ev.kind === 'double' ? 0.3 : 0.4, v.rate); break;
      case 'land': if (!ev.enemy) P(ev.speed > 18 ? 'landHeavy' : 'land', Math.min(0.7, 0.2 + ev.speed / 45) * v.weight, v.step); else if (ev.heavy) P('slam', 0.7, 0.8); break;
      case 'dash': P('dash', 0.4, v.rate * (ev.phase ? 0.8 : 1)); break;
      case 'blink': P('doubleJump', 0.4, 1.5); P('ice1', 0.2, 1.6); break;
      case 'slide': P('slide', 0.5, v.rate); break;
      case 'bounce': P('bounce', 0.45, 1); break;
      case 'grappleFire': P('grappleFire', 0.45, v.rate); break;
      case 'grappleAttach': P('grappleAttach', 0.5, v.rate); break;
      case 'grappleRelease': P('grappleRelease', 0.4, v.rate); if (ev.perfect) P('perfect', 0.4, 1.1); break;
      case 'chainPull': P('grappleAttach', 0.6, 0.7); break;
      case 'attack': if (ev.sfx) P(ev.sfx, ev.heavy ? 0.5 : 0.38, ev.sfx.startsWith('swing') ? v.rate : 1); break;
      case 'hit': if (ev.res === 'blocked') P('block', 0.5, 1.1); else P(ev.kind === 'fire' ? 'fire' : ev.kind === 'ice' ? 'ice1' : ev.kind === 'lightning' ? 'zap1' : ev.heavy ? 'hitHeavy' : pick(['hit0', 'hit1', 'hit2']), ev.heavy ? 0.6 : 0.45, ev.heavy ? 0.9 : 1.05); break;
      case 'guardBreak': P('armor', 0.7, 0.8); break;
      case 'parry': case 'deflect': P('parry', 0.6, 1.2); break;
      case 'shieldUp': P('shield', 0.35, 1); break;
      case 'shieldHit': P('shieldHit', 0.5, 1); break;
      case 'perfectDodge': P('perfect', 0.45, 1.4); break;
      case 'hurt': P('hurt', 0.6, v.rate); break;
      case 'explosion': P(pick(['explosion0', 'explosion1']), 0.7, 1); P('boom', 0.5, 1, 0.1); break;
      case 'slam': P('slam', 0.6, ev.enemy ? 0.85 : 1); break;
      case 'lightning': P('zap0', 0.5, 1); if (ev.segs.length > 2) P('zapChain', 0.4, 1); break;
      case 'electrify': P('zapChain', 0.5, 0.8); break;
      case 'iceForm': P('ice0', 0.45, 1.2); break;
      case 'freeze': P('ice1', 0.45, 0.9); break;
      case 'shatter': P('iceBreak', 0.6, 1); break;
      case 'break': P(ev.material === 'wood' ? 'breakWood' : ev.material === 'ice' ? 'iceBreak' : 'breakStone', 0.6, 0.9); break;
      case 'solidHit': P(ev.material === 'wood' ? 'breakWood' : 'breakStone', 0.25, 1.4, 0.08); break;
      case 'enemyDead': P(pick(['bone0', 'bone1']), 0.5, ev.boss ? 0.6 : 1); if (ev.boss) P('victory', 0.5, 1); break;
      case 'enemySpawn': P('enemyCast', 0.3, 0.7, 0.2); break;
      case 'enemyShot': P('enemyShot', 0.35, 0.8); break;
      case 'enemyBlink': P('enemyCast', 0.3, 1.4); break;
      case 'telegraph': P('telegraph', ev.boss ? 0.4 : 0.22, ev.fuse ? 1.8 : ev.boss ? 0.6 : 1, 0.15); break;
      case 'barrelLit': P('fire', 0.4, 1.4); break;
      case 'mechanism': P('unlock', 0.5, 1); break;
      case 'pickup': P(ev.kind === 'mote' ? 'pickup' : ev.kind === 'heal' || ev.kind === 'heart' ? 'heal' : 'shard', ev.kind === 'mote' ? 0.18 : 0.5, ev.kind === 'mote' ? 1.3 + Math.random() * 0.4 : 1, 0.04); break;
      case 'checkpoint': P('checkpoint', 0.5, 1); break;
      case 'tech': P('flow', 0.22, 0.9 + ev.flow * 0.08, 0.08); break;
      case 'arenaStart': P(ev.boss ? 'bossIntro' : 'gate', 0.55, ev.boss ? 0.8 : 0.9); break;
      case 'arenaClear': P('gate', 0.5, 1.1); P('unlock', 0.45, 1); break;
      case 'bossPhase': P('bossIntro', 0.5, 1.1); break;
      case 'tablet': P('tablet', 0.5, 1); break;
      case 'gear': P('victory', 0.5, 1.1); break;
      case 'death': P('defeat', 0.5, 1); break;
      case 'complete': P('victory', 0.6, 1); break;
    }
  }
}
