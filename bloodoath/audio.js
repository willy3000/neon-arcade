// Sound. Effects are sampled (Kenney, CC0) and layered: a strike is a transient, a low thump for weight, and an element.
// Music streams from three CC0 tracks. Arena ambience is synthesised. Nothing plays until the player has pressed something.
const BASE = new URL('./assets/', import.meta.url).href;
const SFX = ['swingL', 'swingM', 'swingH', 'hitL', 'hitM', 'hitH', 'hitDeep', 'cut', 'block', 'blockH', 'parry', 'armor', 'fireCast', 'fireBurst', 'fireHit', 'iceCast', 'iceHit', 'iceBurst', 'iceBreak', 'arcCast', 'draw', 'chain', 'teleport', 'dive', 'stance', 'hammer', 'grab', 'slam',
  'superStart', 'superHit', 'burst', 'ko', 'knockdown', 'land', 'jump', 'dash', 'round', 'fight', 'win', 'lose', 'uiMove', 'uiOk', 'uiStart', 'uiBack', 'uiNo'];
const TRACKS = { menu: 'determined-pursuit.mp3', fight: 'battle-theme-a.mp3', boss: 'boss-battle-2.mp3' };
const ELEMENT = { fire: 'fireHit', ice: 'iceHit', slash: 'cut', heavy: 'hammer', rock: 'hammer' };

export class Audio {
  constructor(settings) { this.s = settings; this.buffers = new Map(); this.last = new Map(); this.ctx = null; this.music = null; this.track = null; this.amb = null; this.failed = []; }
  async load(onProgress) {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    this.out = this.ctx.createGain(); this.out.connect(this.ctx.destination); this.ambGain = this.ctx.createGain(); this.ambGain.gain.value = 0; this.ambGain.connect(this.ctx.destination);
    let done = 0;
    await Promise.all(SFX.map(async name => { try { const r = await fetch(`${BASE}sfx/${name}.ogg`); if (!r.ok) throw new Error(String(r.status)); this.buffers.set(name, await this.ctx.decodeAudioData(await r.arrayBuffer())); } catch { this.failed.push(name); } onProgress?.(++done / SFX.length); }));
    this.apply();
  }
  unlock() { if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {}); if (this.music && this.music.paused && this.wantMusic) this.music.play().catch(() => {}); }
  apply() { const s = this.s, mute = s.muted ? 0 : 1; if (this.out) this.out.gain.value = s.sfx * mute; if (this.music) this.music.volume = Math.min(1, s.music * 0.55 * mute); if (this.ambGain) this.ambGain.gain.setTargetAtTime(this.amb ? s.ambience * 0.5 * mute : 0, this.ctx.currentTime, 0.4); }
  play(name, volume = 0.5, rate = 1, gap = 0.04) {
    const b = this.buffers.get(name); if (!b || !this.ctx || this.ctx.state !== 'running') return; const now = this.ctx.currentTime; if (now - (this.last.get(name) ?? -1) < gap) return; this.last.set(name, now);
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = b; src.playbackRate.value = rate * (0.95 + Math.random() * 0.1); g.gain.value = volume; src.connect(g); g.connect(this.out); src.start();
  }
  setMusic(key) {
    if (this.track === key) return; this.track = key; this.wantMusic = !!key;
    if (this.music) { this.music.pause(); this.music = null; } if (!key) return;
    const el = new window.Audio(`${BASE}music/${TRACKS[key]}`); el.loop = true; el.preload = 'auto'; this.music = el; this.apply(); el.play().catch(() => {}); // blocked until the first key press; unlock() retries
  }
  // Wind, fire, blizzard or a low drone, built from filtered noise and a pair of oscillators.
  setAmbience(kind) {
    if (!this.ctx || this.amb?.kind === kind) return; if (this.amb) { for (const n of this.amb.nodes) { try { n.stop(); } catch { /* already stopped */ } n.disconnect(); } this.amb = null; }
    if (!kind) { this.apply(); return; }
    const ctx = this.ctx, len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let v = 0; for (let i = 0; i < len; i++) { v = v * 0.97 + (Math.random() * 2 - 1) * 0.1; d[i] = v; }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true; const f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    const P = { fire: [260, 0.5, 0.6, 3.1, 140], wind: [480, 0.7, 0.5, 0.13, 260], blizzard: [900, 0.9, 0.9, 0.3, 500], drone: [120, 1.2, 0.4, 0.08, 40] }[kind] || [400, 0.7, 0.5, 0.1, 200];
    f.type = 'bandpass'; f.frequency.value = P[0]; f.Q.value = P[1]; g.gain.value = P[2]; lfo.frequency.value = P[3]; lg.gain.value = P[4]; lfo.connect(lg); lg.connect(f.frequency); noise.connect(f); f.connect(g); g.connect(this.ambGain); noise.start(); lfo.start();
    const nodes = [noise, lfo]; if (kind === 'drone') for (const hz of [55, 82.5]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = hz; og.gain.value = 0.12; o.connect(og); og.connect(this.ambGain); o.start(); nodes.push(o); }
    this.amb = { kind, nodes }; this.apply();
  }
  ui(name) { this.play({ move: 'uiMove', ok: 'uiOk', start: 'uiStart', back: 'uiBack', no: 'uiNo' }[name] || name, 0.35, 1, 0.03); }
  handle(e) {
    const P = (n, v, r, gap) => this.play(n, v, r, gap);
    switch (e.type) {
      case 'move': if (e.kind === 'super') P('superStart', 0.6); else if (e.sfx) P(e.sfx, e.kind === 'normal' ? 0.32 : 0.48, e.ex ? 1.15 : 1); break;
      case 'hit': P(e.heavy ? 'hitH' : e.damage > 45 ? 'hitM' : 'hitL', e.heavy ? 0.7 : 0.55, 1, 0.02); if (e.heavy) P('hitDeep', 0.4, 0.8, 0.05); if (ELEMENT[e.fx]) P(ELEMENT[e.fx], 0.4, 1, 0.05); if (e.counter) P('parry', 0.25, 1.5); break;
      case 'block': P(e.perfect ? 'parry' : e.heavy ? 'blockH' : 'block', e.perfect ? 0.45 : 0.5, e.perfect ? 1.3 : 1); break;
      case 'armor': P('armor', 0.6); break; case 'ward': P('stance', 0.4, 0.8); break; case 'wardBreak': P('iceBreak', 0.6, 0.7); break; case 'rage': P('superStart', 0.7, 0.7); P('hitDeep', 0.6, 0.5); break; case 'counter': case 'parry': P('parry', 0.7); break; case 'tech': P('blockH', 0.5, 1.3); break;
      case 'throw': P('grab', 0.6); break; case 'breaker': P('burst', 0.7); break; case 'ko': P('ko', 0.8); P('hitDeep', 0.7, 0.6); break;
      case 'knockdown': P('knockdown', 0.55); break; case 'land': P('land', 0.3); break; case 'jump': P('jump', 0.35); break; case 'dash': P('dash', 0.4); break;
      case 'bounce': P('slam', 0.55); break; case 'teleport': P('teleport', 0.45); break; case 'freeze': P('iceBurst', 0.6); break; case 'thaw': case 'shatter': P('iceBreak', 0.55); break;
      case 'destroy': case 'clash': P(e.look === 'ice' ? 'iceBreak' : 'fireBurst', 0.35, 1.3); break; case 'cineStart': P('superHit', 0.6, 0.8); break;
      case 'fx': if (e.look === 'slam') P('slam', 0.6, 0.8); else if (e.look === 'icePillar' || e.look === 'frostWave') P('iceBurst', 0.6, 0.8); else if (e.look === 'flamePillar') P('fireBurst', 0.6); break;
      case 'announce': P(e.voice === 'fight' ? 'fight' : e.voice === 'ko' ? 'ko' : 'round', 0.5); break;
      case 'matchEnd': P('win', 0.6); break;
    }
  }
}
