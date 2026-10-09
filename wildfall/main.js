// WILDFALL entry point: boots the renderer, runs the fixed-step loop and moves between title, hero select, play and results.
import { DT, CHARACTERS, CHARACTER_ORDER } from './config.js';
import { createSim, step, snapshot, NEUTRAL } from './sim/index.js';
import { Renderer } from './render/index.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI, formatTime } from './ui.js';
import * as Save from './save.js';
import { build as chapter1 } from './levels/chapter1.js';
import { build as proving } from './levels/proving.js';

const LEVELS = { chapter1, proving }, $ = id => document.getElementById(id);
let storage; try { storage = window.localStorage; } catch { storage = null; }
const save = Save.load(storage), settings = save.settings, persist = () => Save.write(storage, save);
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { settings.shake = Math.min(settings.shake, 0.2); settings.reducedFlash = true; }

const canvas = $('view'), input = new Input(canvas), audio = new Audio(settings), ui = new UI(input);
let renderer, sim = null, level = null, levelId = null, charId = save.character, state = 'loading', acc = 0, last = performance.now(), lastInput = NEUTRAL, resume = null, deathT = 0, trial = null, selectFor = 'chapter1', busy = false;

function setState(next) { state = next; ui.screen(next); input.enabled = next === 'play'; input.clear(); if (next === 'title' || next === 'select') audio.stopBed(); }

function refreshTitle() {
  const c = save.campaign.chapter1, progress = c && (c.checkpoint || c.cleared.length) && !c.completed;
  $('continue').hidden = !progress; if (progress) $('continue-note').textContent = `${CHARACTERS[c.character].name} · ${formatTime(c.stats.time)} · checkpoint saved`;
  $('new-game').querySelector('span').textContent = c?.completed ? 'REPLAY CHAPTER 1' : progress ? 'START OVER' : 'BEGIN THE CLIMB';
  $('new-game').querySelector('small').textContent = c?.best ? `Best ${formatTime(c.best.time)} · Rank ${c.best.rank}` : 'Chapter 1 · The Fallen Gate';
  const best = Object.entries(save.trial).map(([id, t]) => `${CHARACTERS[id].name} ${t.toFixed(2)}s`).join(' · '); $('proving').querySelector('small').textContent = best ? 'Trial best: ' + best : 'Practice every technique · timed trial';
}

async function toTitle() {
  if (busy) return; busy = true; setState('loading'); ui.loading(0.1, 'Raising the islands…'); sim = null;
  await renderer.showStage(p => ui.loading(0.1 + p * 0.9)); busy = false; refreshTitle(); setState('title'); ($('continue').hidden ? $('new-game') : $('continue')).focus();
}

function toSelect(forLevel) {
  selectFor = forLevel; $('select-mode').textContent = forLevel === 'proving' ? 'PROVING GROUNDS' : 'BREAK THE SKY · CHAPTER 1';
  ui.buildHeroes(charId, (id, hover) => { charId = id; ui.selectHero(id); if (!hover) renderer.cheer(CHARACTER_ORDER.indexOf(id)); }); setState('select'); renderer.cheer(CHARACTER_ORDER.indexOf(charId));
}

async function start(id, character, progress) {
  if (busy) return; busy = true; audio.unlock(); setState('loading'); ui.loading(0.02, 'Charting the route…');
  levelId = id; charId = character; save.character = character; persist(); level = LEVELS[id]();
  await renderer.setLevel(level, p => ui.loading(0.02 + p * 0.55));
  const types = new Set((level.enemies || []).map(e => e.type)); for (const a of level.arenas || []) for (const wave of a.waves) for (const e of wave) types.add(e.type); if (types.has('warden')) ['minion', 'hunter', 'ember'].forEach(t => types.add(t));
  await renderer.preload([...types], p => ui.loading(0.57 + p * 0.3, 'Waking the garrison…'));
  await renderer.setHero(character); ui.loading(1, 'Ready');
  resume = progress ? { ...progress } : null; begin(); busy = false;
  if (!progress && level.intro) {
    sim.cinematic = true; renderer.cam.vista = 99; setState('cards');
    await ui.cards(level.subtitle.toUpperCase(), level.name, level.intro); if (!sim) return;
    sim.cinematic = false; renderer.cam.vista = 0;
  }
  setState('play'); canvas.focus(); ui.banner(level.subtitle.toUpperCase(), level.name);
}

// (Re)creates the simulation from the last saved point. The level is rebuilt so broken walls and spent kegs come back.
function begin() {
  level = LEVELS[levelId](); const from = resume || {};
  sim = createSim(level, charId, { checkpoint: from.checkpoint, cleared: from.cleared, collected: from.collected, gear: from.gear, flags: from.flags, stats: from.stats, difficulty: settings.difficulty });
  ui.setHero(charId, level); audio.setCharacter(charId); audio.startBed(); renderer.snapCamera(sim); acc = 0; deathT = 0; trial = null; for (let i = 0; i < 4; i++) step(sim, NEUTRAL);
}
function checkpointSave() {
  resume = snapshot(sim);
  if (levelId === 'chapter1') { save.campaign.chapter1 = { ...(save.campaign.chapter1 || {}), ...resume, character: charId, completed: false, best: save.campaign.chapter1?.best || null }; persist(); }
}

function rank(stats, shards, total) {
  const points = 100 - (stats.deaths || 0) * 14 - Math.max(0, stats.hurt - 5) * 1.8 - Math.max(0, (stats.time - 540) / 18) + (shards / Math.max(1, total)) * 12 + Math.min(12, stats.tech * 0.3) - 12;
  return points >= 88 ? 'S' : points >= 72 ? 'A' : points >= 52 ? 'B' : 'C';
}

async function complete() {
  const s = sim.stats, total = level.pickups.filter(p => p.kind === 'skyshard').length, shards = [...sim.collected].filter(id => level.pickups.some(p => p.id === id && p.kind === 'skyshard')).length, r = rank(s, shards, total);
  const prev = save.campaign.chapter1?.best; save.campaign.chapter1 = { ...snapshot(sim), character: charId, completed: true, checkpoint: null, best: !prev || s.time < prev.time ? { time: s.time, rank: r } : prev }; persist();
  setState('cards'); await ui.cards('CHAPTER 1 COMPLETE', level.name, level.outro); if (!sim) return;
  ui.results('CHAPTER 1 COMPLETE', level.name, [['RANK', r, 'rank'], ['TIME', formatTime(s.time)], ['FOES FELLED', s.kills], ['BEST COMBO', sim.combo.best], ['TECHNIQUES', s.tech], ['SKY SHARDS', `${shards} / ${total}`]],
    'The rest of BREAK THE SKY — the Hollow Canopy through the Sky Engine — is still being built. Try another hero: each one crosses this chapter differently.');
  setState('results');
}

function onEvent(ev) {
  renderer.handle(ev, sim); audio.handle(ev, sim); ui.handle(ev, sim);
  switch (ev.type) {
    case 'checkpoint': case 'arenaClear': checkpointSave(); break;
    case 'pickup': if (ev.kind === 'gear' || ev.kind === 'skyshard' || ev.kind === 'heart') checkpointSave(); break;
    case 'gear': popup('NEW GEAR', ev.title, ev.text); break;
    case 'tablet': popup('INSCRIPTION', ev.title, ev.text); break;
    case 'complete': complete(); break;
    case 'trialStart': if (!trial && sim.player.onGround) { trial = { t: 0 }; $('trial').hidden = false; ui.toast('TRIAL STARTED', true); } break;
    case 'trialEnd': if (trial) { const t = trial.t, best = save.trial[charId]; trial = null; if (!best || t < best) { save.trial[charId] = t; persist(); } ui.banner(!best || t < best ? 'NEW BEST' : `BEST ${best.toFixed(2)}s`, t.toFixed(2) + ' SECONDS'); audio.play('victory', 0.5); } break;
  }
}
async function popup(eyebrow, title, text) { if (state !== 'play') return; setState('popup'); await ui.popup(eyebrow, title, text); if (sim && state === 'popup') { setState('play'); canvas.focus(); } }

function pause() { if (state === 'play') { setState('paused'); $('resume').focus(); } }
function unpause() { if (state === 'paused') { setState('play'); canvas.focus(); acc = 0; } }

// Menus work with arrow keys, WASD and a controller as well as the mouse.
function menuNav() {
  if (state === 'play' || state === 'loading') return;
  const m = input.menu(), dialog = $('settings');
  if (dialog.open) { if (m.back || m.start) dialog.close(); return; }
  if (state === 'select') {
    if (m.dx) { charId = CHARACTER_ORDER[(CHARACTER_ORDER.indexOf(charId) + m.dx + 3) % 3]; ui.selectHero(charId); renderer.cheer(CHARACTER_ORDER.indexOf(charId)); audio.play('uiMove', 0.3); }
    if (m.confirm) $('select-go').click(); if (m.back) $('select-back').click(); return;
  }
  const root = $(state === 'paused' ? 'pause' : state), buttons = root ? [...root.querySelectorAll('button')].filter(b => b.offsetParent !== null) : []; if (!buttons.length) return;
  const at = buttons.indexOf(document.activeElement), dir = m.dy || m.dx;
  if (dir) { buttons[at < 0 ? 0 : (at + dir + buttons.length) % buttons.length].focus(); audio.play('uiMove', 0.3); }
  if (m.confirm) (at >= 0 ? buttons[at] : buttons[0]).click();
  if ((m.back || m.start) && state === 'paused') unpause();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; input.poll(); menuNav();
  if (sim && ['play', 'cards', 'paused', 'popup', 'results'].includes(state)) {
    const running = state === 'play' || (state === 'cards' && !sim.ended);
    if (state === 'play' && input.tapped('pause')) pause();
    else if (running) {
      const scale = sim.slowmo > 0 ? 0.35 : 1; if (sim.slowmo > 0) sim.slowmo -= dt;
      let inp = state === 'play' ? input.read(renderer.aim(sim, input.mouse)) : NEUTRAL, steps = 0; lastInput = inp; acc += dt * scale;
      while (acc >= DT && steps < 14) { step(sim, inp); inp = Input.sustain(inp); acc -= DT; steps++; }
      if (steps === 14) acc = 0;
      for (const ev of sim.events.splice(0)) { onEvent(ev); if (!sim) return; }
      if (trial) { trial.t += dt * scale; $('trial').textContent = trial.t.toFixed(2); if (sim.player.onGround && sim.player.y < 5) { trial = null; $('trial').hidden = true; ui.toast('TRIAL RESET — STAY OFF THE LOW GROUND'); } }
      if (sim.player.dead) { deathT += dt; if (deathT > 1.7) { resume = { ...(resume || {}), stats: { ...sim.stats, deaths: (sim.stats.deaths || 0) + 1 } }; begin(); ui.toast('BACK ON YOUR FEET'); } }
      audio.frame(sim, dt * scale); ui.hud(sim, dt);
      renderer.frame(sim, dt * scale, lastInput);
    } else renderer.frame(sim, 0, NEUTRAL);
  } else if (renderer && (state === 'title' || state === 'select')) renderer.stageFrame(dt, state === 'select' ? CHARACTER_ORDER.indexOf(charId) : -1);
  input.endFrame();
}

// ---- Wiring ---------------------------------------------------------------------------------------------------------------
function applySettings() {
  settings.difficulty = $('difficulty').value; settings.volume = Number($('volume').value); settings.music = $('music').checked; settings.shake = Number($('shake').value); settings.reducedFlash = $('reducedFlash').checked;
  const quality = $('quality').value; settings.gamepad = $('gamepad').checked; input.padOn = settings.gamepad;
  if (quality !== settings.quality) { settings.quality = quality; renderer.resize(); }
  if (sim) sim.difficulty = settings.difficulty; audio.apply(); persist(); padStatus();
}
function padStatus() { $('gamepad-status').textContent = !input.pad ? 'Not supported in this browser' : !settings.gamepad ? 'Off' : input.padName || 'Press any button on the controller'; }
function openSettings() {
  if (state === 'play') pause();
  for (const id of ['difficulty', 'volume', 'shake', 'quality']) $(id).value = settings[id]; for (const id of ['music', 'reducedFlash', 'gamepad']) $(id).checked = settings[id];
  padStatus(); ui.controls(); $('settings').showModal();
}
for (const id of ['difficulty', 'volume', 'music', 'shake', 'reducedFlash', 'quality', 'gamepad']) $(id).addEventListener('change', applySettings);
$('settings').addEventListener('close', applySettings);
for (const id of ['settings-button', 'title-settings', 'pause-settings']) $(id).addEventListener('click', openSettings);
$('sound').addEventListener('click', () => { settings.muted = !settings.muted; $('sound').textContent = settings.muted ? 'SOUND OFF' : 'SOUND ON'; audio.unlock(); audio.apply(); persist(); });
$('sound').textContent = settings.muted ? 'SOUND OFF' : 'SOUND ON';
$('continue').addEventListener('click', () => { const c = save.campaign.chapter1; start('chapter1', c.character, { checkpoint: c.checkpoint, cleared: c.cleared, collected: c.collected, gear: c.gear, flags: c.flags, stats: c.stats }); });
$('new-game').addEventListener('click', () => toSelect('chapter1')); $('proving').addEventListener('click', () => toSelect('proving'));
$('select-back').addEventListener('click', () => { setState('title'); $('new-game').focus(); });
$('select-go').addEventListener('click', () => {
  if (selectFor === 'chapter1') { // a fresh run replaces saved progress but keeps the best result
    const best = save.campaign.chapter1?.best;
    if (best) save.campaign.chapter1 = { checkpoint: null, cleared: [], collected: [], gear: {}, flags: {}, stats: { time: 0, kills: 0, tech: 0, hurt: 0, motes: 0, deaths: 0 }, completed: true, character: charId, best }; else delete save.campaign.chapter1;
    persist();
  }
  start(selectFor, charId, null);
});
$('pause-button').addEventListener('click', pause); $('resume').addEventListener('click', unpause);
$('restart').addEventListener('click', () => { begin(); setState('play'); canvas.focus(); });
$('quit').addEventListener('click', toTitle); $('results-title-button').addEventListener('click', toTitle);
$('results-again').addEventListener('click', () => toTitle().then(() => toSelect('chapter1')));
addEventListener('resize', () => renderer?.resize());
addEventListener('blur', pause); document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('pointerdown', () => audio.unlock(), { passive: true });
// Pause answers the key press itself rather than waiting for the next frame.
addEventListener('keydown', e => { audio.unlock(); if (e.repeat || !['Escape', 'KeyP'].includes(e.code) || $('settings').open) return; if (state === 'play') { e.preventDefault(); pause(); } else if (state === 'paused') { e.preventDefault(); unpause(); } });
addEventListener('gamepadconnected', padStatus); addEventListener('gamepaddisconnected', () => { padStatus(); if (input.device === 'pad') pause(); });

async function boot() {
  try {
    input.padOn = settings.gamepad; renderer = new Renderer(canvas, settings);
    window.WF = { get sim() { return sim; }, get state() { return state; }, renderer, save, input, start, snapshot: () => sim && { state, level: levelId, char: charId, x: sim.player.x, y: sim.player.y, vx: sim.player.vx, vy: sim.player.vy, hp: sim.player.hp, mode: sim.player.mode, onGround: sim.player.onGround, flow: sim.player.flow, checkpoint: sim.checkpoint, enemies: sim.enemies.filter(e => !e.dead).length, kills: sim.stats.kills, combo: sim.combo.count, time: sim.stats.time, gear: { ...sim.gear }, ended: sim.ended } };
    requestAnimationFrame(frame);
    ui.loading(0.05, 'Tuning the wind…'); await Promise.all([audio.load(), renderer.showStage(p => ui.loading(0.05 + p * 0.9))]);
    refreshTitle(); setState('title'); ($('continue').hidden ? $('new-game') : $('continue')).focus();
  } catch (err) { console.error(err); $('load-text').textContent = location.protocol === 'file:' ? 'WILDFALL must be served over HTTP — run "npm run serve" and open http://127.0.0.1:8127/wildfall.html' : 'Could not start: ' + err.message; }
}
boot();
