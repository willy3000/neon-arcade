// BLOOD OATH front end: menus, controller assignment, character and arena select, the fight loop, training and arcade.
import { ROSTER, BY_ID } from './data/roster.js';
import boss from './data/malgrave.js';
import { ARENAS, ARENA_BY_ID, drawArena } from './render/arenas.js';
import { FightView } from './render/view.js';
import { solve, over } from './render/rig.js';
import { drawFighter } from './render/skins.js';
import { createMatch, stepMatch, resetPositions } from './engine/match.js';
import { RULES, NEUTRAL } from './engine/constants.js';
import { Devices, ACTION_NAMES, keyLabel, padLabel } from './devices.js';
import { createAI } from './ai.js';
import { Audio } from './audio.js';

const $ = id => document.getElementById(id), frame = $('frame'), KEY = 'blood-oath-save', ALL = { ...BY_ID, [boss.id]: boss };
const DEFAULTS = { version: 1, settings: { music: 0.6, sfx: 0.8, ambience: 0.6, muted: false, blood: 'full', shake: 1, reducedFlash: false, time: 99, rounds: 2, cpu: 1 }, maps: {}, arcade: {} };
function loadSave() { try { const a = JSON.parse(localStorage.getItem(KEY)); if (!a || a.version !== 1) return structuredClone(DEFAULTS); const s = { ...DEFAULTS.settings }; for (const k of ['music', 'sfx', 'ambience', 'shake']) if (Number.isFinite(a.settings?.[k])) s[k] = Math.max(0, Math.min(1, a.settings[k])); for (const k of ['muted', 'reducedFlash']) if (typeof a.settings?.[k] === 'boolean') s[k] = a.settings[k]; if (['full', 'reduced', 'off'].includes(a.settings?.blood)) s.blood = a.settings.blood; if ([0, 60, 99].includes(a.settings?.time)) s.time = a.settings.time; if ([1, 2, 3].includes(a.settings?.rounds)) s.rounds = a.settings.rounds; if ([0, 1, 2, 3].includes(a.settings?.cpu)) s.cpu = a.settings.cpu; return { version: 1, settings: s, maps: a.maps && typeof a.maps === 'object' ? a.maps : {}, arcade: a.arcade && typeof a.arcade === 'object' ? a.arcade : {} }; } catch { return structuredClone(DEFAULTS); } }
const save = loadSave(), settings = save.settings, persist = () => { try { save.maps = devices.export(); localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage may be blocked; play on */ } };
if (matchMedia('(prefers-reduced-motion: reduce)').matches) { settings.reducedFlash = true; settings.shake = Math.min(settings.shake, 0.3); }
const devices = new Devices(save.maps), audio = new Audio(settings), view = new FightView($('stage'), settings);
devices.assigned = ['kb1', 'kb2'];

let resumed = false, screen = 'boot', overlay = null, mode = 'fight', match = null, attract = null, acc = 0, last = performance.now(), time = 0, waiting = -1, announceT = 0, resultT = 0, versusT = 0, history = [], lastHistory = '';
const session = { chars: ['cinder', 'rime'], arena: ARENAS[0], kinds: ['human', 'cpu'], ai: [null, null], cursor: [0, 1], locked: [false, false], arcade: null, training: { boxes: false, dummy: 0, meter: true }, arenaIndex: 0 };
const DUMMIES = ['STANDS', 'CROUCHES', 'JUMPS', 'BLOCKS EVERYTHING', 'BLOCKS AFTER FIRST HIT', 'FIGHTS BACK'];
const LINES = { cinder: 'Ash remembers every oath. Yours burns next.', rime: 'You are loud. Winter is patient.', vesper: 'Do try to bleed elegantly.', grit: 'Stand still. This only hurts once.', malgrave: 'I am the first oath, and the last one kept. Kneel, or be unmade.' };
const ENDINGS = { cinder: 'The Oathkeeper falls and the fire in the mask finally goes quiet. Cinder walks out of the pit owing nothing to anyone, for the first time since the burning.', rime: 'With the first oath broken, the long winter loosens its grip. Rime stands in the thaw and does not know what to do with warm hands.', vesper: 'Vesper wipes the blade, tips her hat to the corpse of a god, and goes looking for a debt worth collecting.', grit: 'Grit sets the hammer down. It leaves a crater. Somebody, somewhere, will have to fix that. Not him. He is retired.' };

// ---- screens ---------------------------------------------------------------------------------------------------------------
const SCREENS = ['boot', 'menu', 'select', 'arena', 'versus', 'result', 'story'], OVERLAYS = ['devices', 'pause', 'guide', 'settings'];
function show(name) { screen = name; overlay = null; frame.dataset.screen = name; frame.dataset.mode = mode; for (const s of SCREENS) $(s).hidden = s !== name; for (const o of OVERLAYS) $(o).hidden = true; $('hud').hidden = name !== 'fight'; focusFirst(); }
function open(name) { overlay = name; for (const o of OVERLAYS) $(o).hidden = o !== name; focusFirst(); }
function close() { const was = overlay; overlay = null; for (const o of OVERLAYS) $(o).hidden = true; if (was === 'settings' || was === 'guide' || was === 'devices') { if (screen === 'fight') open('pause'); else focusFirst(); } persist(); }
const top = () => $(overlay || screen);
function focusFirst() { const el = top(); if (!el) return; const b = el.querySelector('button.primary:not([hidden])') || el.querySelector('button:not([hidden])'); b?.focus({ preventScroll: true }); }
function navigate() { // any device can drive ordinary menus, including the sliders and choices in settings
  const m = devices.menuAny(), el = top(); if (!el || devices.listening) return;
  const v = (m.down ? 1 : 0) - (m.up ? 1 : 0), h = (m.right ? 1 : 0) - (m.left ? 1 : 0);
  if (overlay === 'guide') { // the move list scrolls; left and right change fighter
    if (h) { const i = ROSTER.findIndex(r => r.id === guideId); openGuide(ROSTER[(i + h + ROSTER.length) % ROSTER.length].id); audio.ui('move'); } if (v) $('guide-moves').scrollBy({ top: v * $('guide-moves').clientHeight * 0.5, behavior: 'smooth' });
    if (m.ok || m.back) back(); return;
  }
  const items = [...el.querySelectorAll('button, input, select')].filter(b => b.offsetParent !== null), at = items.indexOf(document.activeElement), cur = items[at], field = cur && cur.tagName !== 'BUTTON';
  const changed = () => cur.dispatchEvent(new Event('input', { bubbles: true }));
  if (field && h) { if (cur.type === 'range') cur.value = Number(cur.value) + h * Number(cur.step || 1); else if (cur.type === 'checkbox') cur.checked = !cur.checked; else cur.selectedIndex = Math.max(0, Math.min(cur.options.length - 1, cur.selectedIndex + h)); changed(); audio.ui('move'); }
  else if ((v || h) && items.length) { items[at < 0 ? 0 : (at + (v || h) + items.length) % items.length].focus({ preventScroll: true }); audio.ui('move'); }
  if (m.ok && cur) { audio.ui('ok'); if (!field) cur.click(); else if (cur.type === 'checkbox') { cur.checked = !cur.checked; changed(); } } else if (m.back || (m.start && overlay === 'pause')) back();
}
function back() { audio.ui('back'); if (overlay === 'pause') resume(); else if (overlay) close(); else if (screen === 'select' || screen === 'arena') toMenu(); }

// ---- drawing fighters for portraits and splash screens ---------------------------------------------------------------------
function portrait(canvas, def, o = {}) {
  const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height, s = o.scale ?? 1.9; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  if (o.bg !== false) { const grad = g.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.4, w * 0.8); grad.addColorStop(0, def.accent + '66'); grad.addColorStop(1, '#0a0508'); g.fillStyle = grad; g.fillRect(0, 0, w, h); }
  g.translate(w / 2 + (o.dx ?? -10) * (o.facing ?? 1), o.floor ?? h * 1.52); g.scale(s, -s);
  const J = solve(def.rig, over(def.poses.stance, o.pose ? def.poses[o.pose] : {}), 0, 0, o.facing ?? 1), v = {}; for (let i = 0; i < 30; i++) drawFighter(document.createElement('canvas').getContext('2d'), def.id, J, def.rig, v, 1 + i / 60); drawFighter(g, def.id, J, def.rig, v, 2);
}

// ---- menu and attract mode -------------------------------------------------------------------------------------------------
function startAttract() { const i = Math.floor(Math.random() * ROSTER.length), a = ROSTER[i], b = ROSTER[(i + 1 + Math.floor(Math.random() * (ROSTER.length - 1))) % ROSTER.length]; attract = { match: createMatch(a, b, { time: 60, roundsToWin: 9, seed: Math.floor(Math.random() * 1e6) }), ai: [createAI(2, a, Math.random() * 99 | 0), createAI(2, b, Math.random() * 99 | 0)], arena: ARENAS[Math.floor(Math.random() * 3)] }; view.reset(); }
function toMenu() { match = null; mode = 'fight'; if (!attract) startAttract(); show('menu'); audio.setMusic('menu'); audio.setAmbience(null); menuFoot(); }
function menuFoot() { $('menu-foot').textContent = `P1 ${devices.name(devices.assigned[0])}  ·  ${devices.pads.length ? devices.pads.length + ' controller' + (devices.pads.length > 1 ? 's' : '') + ' detected' : 'press a button on a controller to wake it'}`; }
for (const b of $('menu-list').children) b.addEventListener('click', () => { const go = b.dataset.go; audio.unlock(); if (go === 'guide') openGuide(session.chars[0]); else if (go === 'devices') openDevices(-1); else if (go === 'settings') openSettings(); else begin(go); });

function begin(m) {
  mode = m; session.kinds = m === 'versus' ? ['human', 'human'] : m === 'training' ? ['human', 'dummy'] : ['human', 'cpu']; session.locked = [false, false]; session.arcade = null;
  match = null; if (!attract) startAttract(); audio.setMusic('menu'); audio.setAmbience(null); show('select'); buildSelect();
  if (m === 'versus') openDevices(devices.connected(devices.assigned[1]) && devices.assigned[1] !== devices.assigned[0] ? -1 : 1); // two players always confirm who holds what
}

// ---- controllers ------------------------------------------------------------------------------------------------------------
function openDevices(wait) { waiting = wait; open('devices'); renderDevices(); }
function renderDevices() {
  for (const i of [0, 1]) { $('slot-' + i).textContent = waiting === i ? 'Press any button on the device for this player…' : devices.name(devices.assigned[i]); $('slot-' + i).parentElement.classList.toggle('wait', waiting === i); $('test-' + i).innerHTML = devices.describe(devices.assigned[i]).map(a => `<i>${ACTION_NAMES[a].split(' ')[0].toUpperCase()}</i>`).join(''); }
  $('devices-note').textContent = !devices.supported ? 'This browser does not expose controllers. Both keyboard layouts still work.' : devices.pads.length ? 'Each player uses one device. Hold buttons to test them below.' : 'No controller detected yet. Plug one in and press any button on it — browsers only reveal a controller after its first press.';
  $('devices-found').textContent = 'Available: ' + devices.list().map(d => devices.name(d)).join('  ·  ');
}
$('assign-0').addEventListener('click', () => { waiting = 0; renderDevices(); }); $('assign-1').addEventListener('click', () => { waiting = 1; renderDevices(); });
$('devices-swap').addEventListener('click', () => { devices.assigned.reverse(); session.explicit = true; renderDevices(); }); $('devices-done').addEventListener('click', close);
devices.onChange = (lost, found) => {
  // Until the players choose for themselves, the first controller to wake goes to player 1 and the second to player 2.
  if (found && !session.explicit && screen !== 'fight' && screen !== 'versus' && !devices.assigned.includes(found)) { const slot = devices.assigned[0] === 'kb1' ? 0 : devices.assigned[1] === 'kb2' ? 1 : -1; if (slot >= 0) devices.assigned[slot] = found; }
  if (overlay === 'devices') renderDevices(); if (screen === 'menu') menuFoot(); if (screen === 'select') renderSelect();
  const slot = devices.assigned.indexOf(lost);
  if (lost && screen === 'fight' && slot >= 0 && session.kinds[slot] === 'human') { if (!overlay) pause(); if (overlay === 'pause') { $('pause-kicker').textContent = 'PLAYER ' + (slot + 1) + ' CONTROLLER DISCONNECTED'; $('pause-title').textContent = 'RECONNECT IT'; } }
};

// ---- character select --------------------------------------------------------------------------------------------------------
function buildSelect() {
  $('select-mode').textContent = { fight: 'FIGHT · VERSUS THE COMPUTER', versus: 'LOCAL VERSUS', arcade: 'ARCADE', training: 'TRAINING' }[mode]; const grid = $('roster'); grid.replaceChildren();
  ROSTER.forEach((def, i) => { const cell = document.createElement('div'); cell.className = 'cell'; const c = document.createElement('canvas'); c.width = 300; c.height = 260; cell.append(c); const b = document.createElement('b'); b.textContent = def.name; cell.append(b); grid.append(cell); portrait(c, def, { scale: 1.5, floor: 420 }); cell.addEventListener('click', () => { const who = session.locked[0] && mode !== 'arcade' ? 1 : 0; session.cursor[who] = i; confirmPick(who); }); cell.addEventListener('mouseenter', () => { const who = session.locked[0] && mode !== 'arcade' ? 1 : 0; if (!session.locked[who]) { session.cursor[who] = i; renderSelect(); } }); });
  session.cursor = [ROSTER.findIndex(r => r.id === session.chars[0]), ROSTER.findIndex(r => r.id === session.chars[1])].map(i => Math.max(0, i)); renderSelect();
}
function renderSelect() {
  const solo = mode === 'arcade', cells = [...$('roster').children];
  cells.forEach((cell, i) => { cell.classList.toggle('c0', session.cursor[0] === i); cell.classList.toggle('c1', !solo && session.cursor[1] === i); cell.querySelectorAll('.tag').forEach(t => t.remove()); for (const p of [0, 1]) if (session.cursor[p] === i && !(solo && p === 1)) { const t = document.createElement('span'); t.className = 'tag t' + p; t.textContent = session.kinds[p] === 'human' ? 'P' + (p + 1) : session.kinds[p] === 'cpu' ? 'CPU' : 'DUMMY'; cell.append(t); } });
  for (const p of [0, 1]) { const def = ROSTER[session.cursor[p]], el = $('pick-' + p); if (solo && p === 1) { el.innerHTML = '<div class="who">ARCADE</div><h3>THREE RIVALS</h3><p>Then the Oathkeeper, who has never lost and does not intend to start.</p>'; continue; }
    const specials = Object.values(def.moves).filter(m => m.cmd).slice(0, 6).map(m => `<li><b>${m.name}</b> — ${m.cmd}</li>`).join('');
    el.innerHTML = `<div class="who">${session.kinds[p] === 'human' ? 'PLAYER ' + (p + 1) + ' · ' + devices.name(devices.assigned[p]) : session.kinds[p] === 'cpu' ? 'COMPUTER' : 'TRAINING DUMMY'}</div><h3>${def.name}</h3><div class="style">${def.title.toUpperCase()} · ${def.style.toUpperCase()}</div><div class="diff">DIFFICULTY ${'◆'.repeat(def.difficulty)}${'◇'.repeat(4 - def.difficulty)}</div><p>${def.blurb}</p><ul>${specials}</ul>${session.locked[p] ? '<div class="ready">READY</div>' : ''}`; }
  $('select-foot').textContent = '← → ↑ ↓ choose · light attack confirms · medium goes back · heavy picks at random';
}
function confirmPick(p) { session.locked[p] = true; session.chars[p] = ROSTER[session.cursor[p]].id; audio.ui('start'); renderSelect(); if (mode === 'arcade') return startArcade(); if (session.locked[0] && session.locked[1]) setTimeout(() => { if (screen === 'select') toArena(); }, 350); }
function selectInput() {
  if (overlay) return; const solo = mode === 'arcade';
  for (const p of [0, 1]) {
    if (solo && p === 1) continue; const human = session.kinds[p] === 'human'; if (!human && !session.locked[0]) continue; // the first player picks for a computer or dummy opponent
    const m = devices.menu(devices.assigned[human ? p : 0]); if (!human && session.justLocked) continue;
    if (!session.locked[p]) { const step = (m.right ? 1 : 0) - (m.left ? 1 : 0) + ((m.down ? 1 : 0) - (m.up ? 1 : 0)) * 2; if (step) { session.cursor[p] = (session.cursor[p] + step + ROSTER.length * 2) % ROSTER.length; audio.ui('move'); renderSelect(); } if (m.alt) { session.cursor[p] = Math.floor(Math.random() * ROSTER.length); renderSelect(); } if (m.ok) { confirmPick(p); if (p === 0) session.justLocked = true; } else if (m.back && p === 0) toMenu(); }
    else if (m.back) { session.locked[p] = false; audio.ui('back'); renderSelect(); }
  }
  session.justLocked = false;
}

// ---- arena select -------------------------------------------------------------------------------------------------------------
function toArena() { show('arena'); const box = $('arenas'); box.replaceChildren(); ARENAS.forEach((a, i) => { const b = document.createElement('button'); b.className = 'arena'; const c = document.createElement('canvas'); c.width = 320; c.height = 180; b.append(c); b.insertAdjacentHTML('beforeend', `<b>${a.name}</b><span>${a.line}</span>`); const g = c.getContext('2d'); g.scale(0.25, 0.25); drawArena(g, a, 1, 0); b.addEventListener('click', () => { session.arenaIndex = i; startFight(); }); b.addEventListener('focus', () => { session.arenaIndex = i; [...box.children].forEach((x, k) => x.classList.toggle('on', k === i)); }); box.append(b); }); box.children[session.arenaIndex].focus(); }

// ---- starting a fight ---------------------------------------------------------------------------------------------------------
function startFight(story) {
  session.arena = session.arcade ? ARENA_BY_ID[session.arcade.arenas[session.arcade.index]] : ARENAS[session.arenaIndex];
  const defs = session.chars.map(id => ALL[id]); view.reset(); attract = null;
  for (const p of [0, 1]) { portrait($('vs-' + p), defs[p], { scale: 1.75, floor: 552, bg: false, facing: p ? -1 : 1, dx: 0 }); $('vs-name-' + p).textContent = defs[p].name; $('vs-title-' + p).textContent = defs[p].title.toUpperCase(); }
  $('vs-line').textContent = story || session.arena.line; prepare(); show('versus'); versusT = 150; audio.ui('start'); audio.setMusic(session.chars[1] === boss.id ? 'boss' : 'fight');
}
function prepare() {
  const defs = session.chars.map(id => ALL[id]), training = mode === 'training', level = session.arcade ? session.arcade.levels[session.arcade.index] : settings.cpu;
  match = createMatch(defs[0], defs[1], { time: settings.time, roundsToWin: settings.rounds, training, infiniteMeter: training && session.training.meter, seed: Math.floor(Math.random() * 1e6) });
  session.ai = session.kinds.map((k, i) => (k === 'cpu' || k === 'dummy' ? createAI(k === 'dummy' ? 1 : level, defs[i], 17 + i) : null));
  view.reset(); acc = 0; history = []; lastHistory = ''; resultT = 0; session.training.wasHit = false; session.training.lastCombo = null; session.training.lastMove = null; for (const e of match.events.splice(0)) view.handle(e, match.fight);
}
function launch() {
  const defs = session.chars.map(id => ALL[id]), training = mode === 'training'; acc = 0; show('fight'); audio.setAmbience(session.arena.ambience); $('tr-inputs').replaceChildren();
  for (const p of [0, 1]) { $('name-' + p).textContent = defs[p].name; $('pips-' + p).innerHTML = '<i></i>'.repeat(settings.rounds); } $('training').hidden = !training; $('clock').textContent = training || !settings.time ? '∞' : settings.time; $('announce').hidden = true;
}
function dummyInput(fight) { // the training dummy's behaviour
  const d = session.training.dummy, me = fight.fighters[1], foe = fight.fighters[0], fm = foe.state === 'attack' ? foe.move : null;
  if (d === 1) return { ...NEUTRAL, down: true }; if (d === 2) return { ...NEUTRAL, up: me.state === 'idle' && fight.frame % 50 < 3 };
  if (d === 3 || (d === 4 && session.training.wasHit)) return { ...NEUTRAL, B: true, down: !!fm && fm.level === 'low' };
  if (d === 5) return session.ai[1](fight, 1); return NEUTRAL;
}
function inputs() { const f = match.fight; return [0, 1].map(i => (session.kinds[i] === 'human' ? { ...NEUTRAL, ...devices.read(devices.assigned[i]) } : session.kinds[i] === 'dummy' ? dummyInput(f) : session.ai[i](f, i))); }

// ---- arcade -------------------------------------------------------------------------------------------------------------------
function startArcade() { const me = session.chars[0], rivals = ROSTER.map(r => r.id).filter(id => id !== me); session.arcade = { index: 0, order: [...rivals, boss.id], arenas: ['temple', 'graveyard', 'shrine', 'abyss'], levels: [Math.max(0, settings.cpu - 1), settings.cpu, Math.min(3, settings.cpu + 1), Math.min(3, settings.cpu + 1)], continues: 0 }; arcadeNext(); }
function arcadeNext() { const a = session.arcade, id = a.order[a.index], def = ALL[id]; session.chars[1] = id; session.kinds = ['human', 'cpu']; story(`FIGHT ${a.index + 1} OF ${a.order.length}`, id === boss.id ? 'THE OATHKEEPER' : def.name, `"${LINES[id]}"`, () => startFight(`"${LINES[id]}"`)); }
function story(kicker, title, text, then) { $('story-kicker').textContent = kicker; $('story-title').textContent = title; $('story-text').textContent = text; $('story-next').onclick = then; show('story'); }

// ---- pause, results -----------------------------------------------------------------------------------------------------------
function pause() { if (screen !== 'fight' || overlay) return; $('pause-kicker').textContent = mode === 'training' ? 'TRAINING OPTIONS' : 'CATCH YOUR BREATH'; $('pause-title').textContent = mode === 'training' ? 'TRAINING' : 'PAUSED'; renderTraining(); open('pause'); audio.ui('back'); }
function resume() { overlay = null; $('pause').hidden = true; acc = 0; resumed = true; }
function renderTraining() { const t = session.training; $('tr-boxes').textContent = 'HITBOXES: ' + (t.boxes ? 'ON' : 'OFF'); $('tr-dummy').textContent = 'DUMMY ' + DUMMIES[t.dummy]; $('tr-meter').textContent = 'METER: ' + (t.meter ? 'INFINITE' : 'NORMAL'); }
$('resume').addEventListener('click', resume); $('pause-moves').addEventListener('click', () => openGuide(session.chars[0])); $('pause-settings').addEventListener('click', openSettings); $('pause-devices').addEventListener('click', () => openDevices(-1)); $('pause-select').addEventListener('click', () => begin(mode === 'arcade' ? 'arcade' : mode)); $('pause-quit').addEventListener('click', toMenu);
$('tr-boxes').addEventListener('click', () => { session.training.boxes = !session.training.boxes; renderTraining(); }); $('tr-dummy').addEventListener('click', () => { session.training.dummy = (session.training.dummy + 1) % DUMMIES.length; renderTraining(); });
$('tr-meter').addEventListener('click', () => { session.training.meter = !session.training.meter; match.opts.infiniteMeter = match.fight.opts.infiniteMeter = session.training.meter; renderTraining(); }); $('tr-reset').addEventListener('click', () => { resetPositions(match); view.reset(); resume(); });
function showResult() {
  const r = match.result, w = ALL[session.chars[r.winner]], s = r.stats, a = session.arcade, won = r.winner === 0; show('result'); audio.setAmbience(null);
  $('result-kicker').textContent = a ? `ARCADE · FIGHT ${a.index + 1} OF ${a.order.length}` : mode === 'versus' ? `PLAYER ${r.winner + 1} WINS` : won ? 'VICTORY' : 'DEFEAT'; $('result-title').textContent = w.name + ' WINS'; $('result-line').textContent = `${r.wins[0]} – ${r.wins[1]} in ${r.rounds} round${r.rounds > 1 ? 's' : ''}`;
  $('result-stats').innerHTML = [0, 1].map(p => `<div><span>${ALL[session.chars[p]].name} DAMAGE</span><b>${Math.round(s[p].damage)}</b></div>`).join('') + [0, 1].map(p => `<div><span>${ALL[session.chars[p]].name} BEST COMBO</span><b>${s[p].maxCombo}</b></div>`).join('') + [0, 1].map(p => `<div><span>${ALL[session.chars[p]].name} PERFECT GUARDS</span><b>${s[p].perfect}</b></div>`).join('');
  $('result-next').textContent = a ? (won ? (a.index + 1 >= a.order.length ? 'SEE THE ENDING' : 'NEXT FIGHT') : 'TRY AGAIN') : 'REMATCH'; $('result-select').hidden = !!a; focusFirst(); if (!won && a) audio.play('lose', 0.5);
}
$('result-next').addEventListener('click', () => { const a = session.arcade; if (!a) return startFight(); if (match.result.winner !== 0) { a.continues++; return startFight(`"${LINES[a.order[a.index]]}"`); } a.index++; if (a.index >= a.order.length) { save.arcade[session.chars[0]] = true; persist(); return story('ARCADE COMPLETE', ALL[session.chars[0]].name, ENDINGS[session.chars[0]] + (a.continues ? `  (${a.continues} continue${a.continues > 1 ? 's' : ''} used.)` : '  (No continues used.)'), toMenu); } arcadeNext(); });
$('result-select').addEventListener('click', () => begin(mode)); $('result-menu').addEventListener('click', toMenu);

// ---- character guide ----------------------------------------------------------------------------------------------------------
const NOTATION = id => (id === 'throw' ? 'T (or L + M)' : id === 'breaker' ? 'B + X while being hit (2 bars)' : id.startsWith('j') ? id.slice(1) + ' in the air' : id.startsWith('2') ? '↓ + ' + id.slice(1) : id.startsWith('6') ? '→ + ' + id.slice(1) : id.startsWith('4') ? '← + ' + id.slice(1) : id.slice(1));
let guideId = 'cinder';
function openGuide(id) {
  const def = BY_ID[id] || ROSTER[0]; guideId = def.id; open('guide'); $('guide-moves').scrollTop = 0; $('guide-name').textContent = def.name + ' — ' + def.title; $('guide-style').textContent = def.style; $('guide-blurb').textContent = def.blurb; portrait($('guide-art'), def, { scale: 1.08, floor: 312, bg: false });
  const tabs = $('guide-tabs'); tabs.replaceChildren(); for (const r of ROSTER) { const b = document.createElement('button'); b.textContent = r.name; b.classList.toggle('on', r.id === def.id); b.addEventListener('click', () => openGuide(r.id)); tabs.append(b); }
  $('guide-moves').innerHTML = Object.entries(def.moves).filter(([, m]) => !m.hidden).map(([mid, m]) => `<div><b>${m.name}</b><i>${m.cmd || NOTATION(mid)}</i><span>${m.note || (m.level === 'throw' ? 'Throw. Beats blocking.' : `${m.level}${m.launch ? ', launches' : ''}${m.knockdown ? ', knocks down' : ''}`)} · ${m.startup}/${m.active}/${m.recovery}f${m.damage ? ' · ' + m.damage : ''}</span></div>`).join('') + '<div><b>Enhanced special</b><i>hold X + special</i><span>Costs one bar. Stronger version of most specials.</span></div><div><b>Perfect guard</b><i>B just before impact</i><span>No chip damage, faster recovery, extra meter.</span></div><div><b>Dash</b><i>tap → → or ← ←, or D</i><span>Back dashes are briefly invulnerable.</span></div>';
}
$('guide-close').addEventListener('click', close);

// ---- settings -----------------------------------------------------------------------------------------------------------------
let remapDevice = 'kb1';
function openSettings() { open('settings'); for (const k of ['music', 'sfx', 'ambience', 'shake']) $('s-' + k).value = settings[k]; for (const k of ['muted', 'reducedFlash']) $('s-' + k).checked = settings[k]; $('s-blood').value = settings.blood; $('s-time').value = settings.time; $('s-rounds').value = settings.rounds; $('s-cpu').value = settings.cpu; renderRemap(); }
function renderRemap() {
  for (const b of $('remap-tabs').children) b.classList.toggle('on', b.dataset.dev === remapDevice); const box = $('remap'); box.replaceChildren();
  const actions = remapDevice === 'pad' ? ['L', 'M', 'H', 'S', 'B', 'T', 'X', 'D', 'start'] : ['left', 'right', 'up', 'down', 'L', 'M', 'H', 'S', 'B', 'T', 'X', 'D', 'start'];
  for (const a of actions) { const b = document.createElement('button'), cur = remapDevice === 'pad' ? padLabel(devices.padMap[a]) : keyLabel(devices.keys[remapDevice][a]); b.innerHTML = `<span>${ACTION_NAMES[a]}</span><b>${cur}</b>`; b.addEventListener('click', () => { b.classList.add('wait'); b.querySelector('b').textContent = remapDevice === 'pad' ? 'PRESS A BUTTON' : 'PRESS A KEY'; devices.listen(remapDevice === 'pad' ? 'pad' : 'key', remapDevice, a, () => { renderRemap(); persist(); }); }); box.append(b); }
}
for (const b of $('remap-tabs').children) b.addEventListener('click', () => { remapDevice = b.dataset.dev; devices.listening = null; renderRemap(); });
$('remap-reset').addEventListener('click', () => { devices.resetMaps(); renderRemap(); persist(); });
for (const id of ['music', 'sfx', 'ambience', 'shake', 'muted', 'reducedFlash', 'blood', 'time', 'rounds', 'cpu']) $('s-' + id).addEventListener('input', () => { const el = $('s-' + id); settings[id] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : ['time', 'rounds', 'cpu'].includes(id) ? Number(el.value) : el.value; audio.apply(); persist(); });
$('settings-close').addEventListener('click', close);

// ---- HUD ----------------------------------------------------------------------------------------------------------------------
function hud() {
  const f = match.fight, t = match.timer;
  $('clock').textContent = t === Infinity ? '∞' : Math.ceil(t / 60);
  for (const p of [0, 1]) {
    const me = f.fighters[p], foe = f.fighters[1 - p], pct = Math.max(0, me.hp / me.def.health) * 100 + '%'; $('hp-' + p).style.width = pct; $('lag-' + p).style.width = pct; $('hp-' + p).classList.toggle('low', me.hp < me.def.health * 0.25);
    $('meter-' + p).style.width = (me.meter / RULES.meterMax) * 100 + '%'; $('meter-' + p).classList.toggle('full', me.meter >= RULES.superCost);
    const pips = $('pips-' + p).children; for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < match.wins[p]);
    const hits = foe.combo.hits, c = $('combo-' + p); c.hidden = hits < 2; if (hits >= 2) c.innerHTML = `${hits} HITS<small>${Math.round(foe.combo.damage)} DAMAGE</small>`;
    const s = me.status, chips = []; if (s.burn > 0) chips.push('<i style="color:#ff8a3a">BURN</i>'); if (s.bleed > 0) chips.push(`<i style="color:#ff5a6e">BLEED ×${s.bleed}</i>`); if (s.chill > 0) chips.push('<i style="color:#8fe3ff">CHILL</i>'); if (me.state === 'frozen') chips.push('<i style="color:#e9fbff">FROZEN</i>'); if (me.armor > 0) chips.push('<i style="color:#ffb347">WARD</i>'); const html = chips.join(''); if ($('status-' + p).innerHTML !== html) $('status-' + p).innerHTML = html;
  }
  if (announceT > 0 && --announceT === 0) $('announce').hidden = true;
  if (mode === 'training') { const me = f.fighters[0], d = f.fighters[1], m = me.state === 'attack' ? me.move : session.training.lastMove; if (me.state === 'attack') session.training.lastMove = me.move;
    const hits = d.combo.hits || session.training.lastCombo?.hits || 0; $('tr-combo').textContent = `Combo ${hits} hit${hits === 1 ? '' : 's'} · ${Math.round(d.combo.damage || session.training.lastCombo?.damage || 0)} damage`; $('tr-move').textContent = m ? `${m.name}: startup ${m.startup} · active ${m.active} · recovery ${m.recovery}${m.blockstun ? ' · on block ' + (m.blockstun - m.active - m.recovery + 1) : ''}` : 'Last move: —'; $('tr-state').textContent = `State ${me.state}${me.state === 'attack' ? ' f' + me.mf : ''} · dummy ${d.state}${d.stun > 0 ? ' ' + d.stun : ''}`; }
}
function onEvent(e) {
  view.handle(e, match.fight); audio.handle(e);
  if (e.type === 'announce') { const a = $('announce'); a.textContent = e.text; a.hidden = true; void a.offsetWidth; a.hidden = false; announceT = e.text === 'FIGHT' ? 50 : 80; }
  if (e.type === 'roundStart') view.reset(); if ((e.type === 'hit' || e.type === 'block') && (e.victim ?? e.side) === 1) session.training.wasHit = true; if (e.type === 'comboEnd') { if (e.side === 1) { session.training.wasHit = false; session.training.lastCombo = { hits: e.hits, damage: e.damage }; } }
}
function recordInput(inp) { const s = ['left', 'right', 'up', 'down'].filter(k => inp[k]).map(k => ({ left: '←', right: '→', up: '↑', down: '↓' })[k]).join('') + ['L', 'M', 'H', 'S', 'B', 'T', 'X', 'D'].filter(k => inp[k]).join('+'); if (s !== lastHistory) { lastHistory = s; if (s) { history.unshift(s); history.length = Math.min(history.length, 14); $('tr-inputs').className = 'keys'; $('tr-inputs').innerHTML = history.map(h => `<i>${h}</i>`).join(''); } } }

// ---- main loop ------------------------------------------------------------------------------------------------------------------
function tick(now) {
  requestAnimationFrame(tick); const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt; devices.poll(); if (audio.ctx?.state === 'suspended' && devices.justPressed()) audio.unlock(); // a controller press may also be allowed to start sound
  if (overlay === 'devices') { if (waiting >= 0) { const d = devices.justPressed(); if (d && d !== devices.assigned[1 - waiting]) { devices.assigned[waiting] = d; waiting = -1; session.explicit = true; audio.ui('start'); persist(); renderDevices(); if (screen === 'select') renderSelect(); } else if (d) { audio.ui('no'); $('slot-' + waiting).textContent = 'That device belongs to the other player. Press a button on a different one.'; } } if (waiting < 0 || !devices.justPressed()) renderDevicesLive(); if (waiting < 0) navigate(); }
  else if (overlay || ['menu', 'result', 'story', 'arena'].includes(screen)) navigate();
  else if (screen === 'select') selectInput();
  else if (screen === 'versus') { if (--versusT <= 0 || devices.menuAny().ok) launch(); }
  if (screen === 'fight' && match) {
    if (!overlay) {
      for (const i of [0, 1]) if (!resumed && session.kinds[i] === 'human' && devices.menu(devices.assigned[i]).start) pause();
      if (mode === 'training' && (devices.pressed.has('Backspace') || [...devices.padTaps.values()].some(t => t.has(8)))) { resetPositions(match); view.reset(); }
      acc += dt; let steps = 0;
      while (acc >= 1 / 60 && steps < 4 && !overlay) { const inp = inputs(); if (mode === 'training') recordInput(inp[0]); stepMatch(match, inp); for (const e of match.events.splice(0)) onEvent(e); acc -= 1 / 60; steps++; }
      if (steps === 4) acc = 0; hud();
      if (match.result && ++resultT > 40) showResult();
    }
    if (match) view.draw(match.fight, session.arena, time, { hitboxes: mode === 'training' && session.training.boxes });
  } else if (screen === 'versus' && match) { view.draw(match.fight, session.arena, time);
  } else if (attract && ['menu', 'select', 'arena', 'story', 'result', 'boot'].includes(screen)) {
    acc += dt; let steps = 0; const m = attract.match; while (acc >= 1 / 60 && steps < 3) { stepMatch(m, [attract.ai[0](m.fight, 0), attract.ai[1](m.fight, 1)]); for (const e of m.events.splice(0)) view.handle(e, m.fight); acc -= 1 / 60; steps++; } if (steps === 3) acc = 0;
    if (m.result || m.round > 3) startAttract(); view.draw(attract.match.fight, attract.arena, time);
  }
  devices.endFrame(); resumed = false;
}
function renderDevicesLive() { for (const i of [0, 1]) if (waiting !== i) $('test-' + i).innerHTML = devices.describe(devices.assigned[i]).map(a => `<i>${ACTION_NAMES[a].split(' ')[0].toUpperCase()}</i>`).join(''); }

addEventListener('resize', () => view.resize()); addEventListener('keydown', () => audio.unlock()); addEventListener('pointerdown', () => audio.unlock());
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }); addEventListener('blur', () => pause());
window.BO = { devices, session, save, settings, audio, view, get screen() { return overlay || screen; }, get match() { return match; }, begin, startFight, toMenu, snapshot: () => ({ screen, overlay, mode, sounds: audio.buffers.size, soundsFailed: audio.failed.length, assigned: [...devices.assigned], chars: [...session.chars], ...(match ? { phase: match.phase, round: match.round, wins: [...match.wins], frame: match.frame, timer: match.timer, result: match.result && match.result.winner, p: match.fight.fighters.map(f => ({ id: f.id, x: f.x, y: f.y, hp: f.hp, meter: f.meter, state: f.state, facing: f.facing })), projectiles: match.fight.projectiles.length } : {}) }) };

(async function boot() {
  try { view.resize(); requestAnimationFrame(tick); await audio.load(p => { $('boot-bar').style.width = Math.round(p * 100) + '%'; }); if (audio.failed.length) console.warn('Sounds that failed to load: ' + audio.failed.join(', ')); toMenu(); }
  catch (err) { console.error(err); $('boot-text').textContent = 'Could not start: ' + err.message; }
})();
