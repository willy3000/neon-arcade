// Everything drawn in HTML over the 3D view: menus, the HUD, hints, dialogue and results.
import { CHARACTERS, CHARACTER_ORDER, PHYS } from './config.js';
import { KITS } from './sim/characters.js';

const $ = id => document.getElementById(id);
const hex = n => '#' + n.toString(16).padStart(6, '0');
const ICONS = {
  blades: '<path d="M4 20 15 3l2 6-9 13zM13 21l7-12 1 5-5 8z"/>', phase: '<path d="M3 12h9M8 6l6 6-6 6M14 6l6 6-6 6"/>', ice: '<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10M9 4l3 3 3-3M9 20l3-3 3 3"/>',
  lightning: '<path d="M13 2 5 13h6l-1 9 9-12h-6z"/>', shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>', leap: '<path d="M12 15V3M6 9l6-6 6 6M3 21h18M7 18l-2 3M17 18l2 3"/>',
  dash: '<path d="M3 8h8M2 12h11M3 16h8M14 6l7 6-7 6"/>', grapple: '<path d="M4 20 15 9M15 9a3.5 3.5 0 1 0 3.5-3.5M4 20l-1 1M9 15l1 4M9 15l-4-1"/>',
};
const KIT_LIST = { vyx: ['Grapple swing & wall-run', 'Phase Dash', 'Kinetic Blades'], sera: ['Fireball & glide', 'Ice Platform', 'Chain Lightning'], bragg: ['Ground slam & chain pull', 'Bulwark shield', 'Seismic Leap'] };
const KIT_ICONS = { vyx: ['grapple', 'phase', 'blades'], sera: ['dash', 'ice', 'lightning'], bragg: ['leap', 'shield', 'leap'] };
const METERS = { vyx: { Speed: 95, Power: 55, Reach: 60 }, sera: { Speed: 70, Power: 75, Reach: 100 }, bragg: { Speed: 45, Power: 100, Reach: 50 } };
const k = text => `<kbd>${text}</kbd>`;
export const HINTS = {
  move: L => `${k(L('left'))} ${k(L('right'))} to run`,
  jump: L => `${k(L('jump'))} to jump — hold it longer to jump higher`,
  doublejump: L => `Press ${k(L('jump'))} again in mid-air for a second jump`,
  walljump: L => `Jump into a wall and press ${k(L('jump'))} to kick off it. Chain kicks to climb.`,
  combat: L => `${k(L('attack'))} to strike · ${k(L('heavy'))} for a heavy blow — hold to charge it`,
  abilities: (L, kit) => `${k(L('ability1'))} ${kit.abilities.ability1.name} · ${k(L('ability2'))} ${kit.abilities.ability2.name}`,
  dash: L => `${k(L('dash'))} to dash. It works in mid-air too.`,
  slide: L => `While running, hold ${k(L('down'))} and press ${k(L('dash'))} to slide under low stone`,
  barrel: () => 'Powder kegs burst a moment after they are struck. Use them, and stand clear.',
  bounce: L => `Sky blooms throw you upward — hold ${k(L('jump'))} to go higher`,
  wallrun: () => 'Hold your direction across a rune-marked wall to run along it. Jump to leap off.',
  breakable: () => 'Cracked stone gives way to blasts and heavy force.',
  dive: L => `Shields stop a blade from the front. In mid-air, hold ${k(L('down'))} and press ${k(L('attack'))} to dive on them.`,
  elements: () => 'Water carries lightning. Fire melts ice. Force breaks stone.',
  pylon: () => 'Old pylons wake when struck with real force: a charged blow, a slam, a blast or lightning.',
  grapple: L => `Hold ${k(L('grapple'))} to latch onto a glowing anchor and swing`,
  release: L => `Let go of ${k(L('grapple'))} on the upswing to launch · ${k(L('up'))} ${k(L('down'))} to reel in and out`,
};
const CONTROL_ROWS = [['Run', ['left', 'right']], ['Jump / double jump', ['jump']], ['Dash / air-dash', ['dash']], ['Slide', ['down', 'dash']], ['Attack', ['attack']], ['Heavy (hold to charge)', ['heavy']], ['Dive (in air)', ['down', 'attack']], ['Grapple (hold)', ['grapple']], ['Reel rope', ['up', 'down']], ['Ability 1', ['ability1']], ['Ability 2', ['ability2']], ['Interact', ['interact']], ['Pause', ['pause']]];

export class UI {
  constructor(input) { this.input = input; this.lines = []; this.lineT = 0; this.hintKey = null; this.device = null; this.hpShown = 1; this.bannerT = 0; this.comboShown = 0; }
  screen(name) {
    document.body.dataset.screen = name === 'play' || name === 'paused' || name === 'cards' || name === 'popup' || name === 'results' ? 'play' : name;
    for (const id of ['loading', 'title', 'select', 'pause', 'cards', 'results', 'popup']) $(id).hidden = id !== (name === 'paused' ? 'pause' : name);
    $('hud').hidden = !['play', 'paused', 'popup'].includes(name);
  }
  loading(fraction, text) { $('load-bar').style.width = Math.round(fraction * 100) + '%'; if (text) $('load-text').textContent = text; }

  buildHeroes(selected, pick) {
    const list = $('heroes'); list.replaceChildren();
    for (const id of CHARACTER_ORDER) {
      const c = CHARACTERS[id], b = document.createElement('button'); b.className = 'hero'; b.type = 'button'; b.dataset.hero = id; b.style.setProperty('--c', hex(c.color)); b.setAttribute('role', 'option');
      b.innerHTML = `<h3>${c.name}</h3><div class="role">${c.title}</div><span class="tag">${c.tag}</span><p>${c.blurb}</p><ul>${KIT_LIST[id].map((t, i) => `<li><svg viewBox="0 0 24 24">${ICONS[KIT_ICONS[id][i]]}</svg>${t}</li>`).join('')}</ul><div class="meters">${Object.entries(METERS[id]).map(([n, v]) => `<div class="meter">${n.toUpperCase()}<i style="--v:${v}%"></i></div>`).join('')}</div>`;
      b.addEventListener('click', () => pick(id)); b.addEventListener('mouseenter', () => pick(id, true)); list.append(b);
    }
    this.selectHero(selected);
  }
  selectHero(id) { for (const b of $('heroes').children) b.setAttribute('aria-selected', b.dataset.hero === id); $('select-go-label').textContent = 'PLAY AS ' + CHARACTERS[id].name; }

  setHero(charId, level) {
    const c = CHARACTERS[charId], kit = KITS[charId]; this.kit = kit; this.char = c; this.level = level;
    $('portrait').innerHTML = `<b>${c.name[0]}</b>`; $('hud').style.setProperty('--c', hex(c.color)); $('portrait').style.setProperty('--c', hex(c.color)); $('hero-name').textContent = c.name;
    $('flow').innerHTML = '<i></i>'.repeat(PHYS.flowMax); $('area-name').textContent = level.name; $('objective').textContent = level.subtitle;
    this.total = (level.pickups || []).filter(p => p.kind === 'skyshard').length; $('trial').hidden = true;
    const slots = [['grapple', 'grapple', 'Grapple'], ['dash', 'dash', c.blink ? 'Blink' : c.bullRush ? 'Bull Rush' : 'Dash'], ['ability1', kit.abilities.ability1.id, kit.abilities.ability1.name], ['ability2', kit.abilities.ability2.id, kit.abilities.ability2.name]];
    $('abilities').innerHTML = slots.map(([slot, icon, name]) => `<div class="ability" data-slot="${slot}"><div class="icon"><svg viewBox="0 0 24 24">${ICONS[icon]}</svg><div class="cool"></div></div><kbd></kbd><small>${name}</small></div>`).join('');
    this.device = null; this.lines = []; this.hintKey = null; $('hint').hidden = true; $('dialogue').hidden = true; $('boss').hidden = true; $('combo').hidden = true; $('prompt').hidden = true; $('toasts').replaceChildren();
  }
  labels() { for (const el of $('abilities').children) el.querySelector('kbd').textContent = this.input.label(el.dataset.slot); if (this.hintKey) this.showHint(this.hintKey); }
  showHint(key) { const make = HINTS[key]; if (!make) return; this.hintKey = key; $('hint').innerHTML = make(a => this.input.label(a), this.kit); $('hint').hidden = false; }

  hud(sim, dt) {
    const p = sim.player;
    if (this.device !== this.input.device) { this.device = this.input.device; this.labels(); }
    const f = Math.max(0, p.hp / p.maxHp) * 100 + '%'; $('hp-bar').style.width = f; $('hp-lag').style.width = f;
    const pips = $('flow').children; for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < p.flow);
    $('shard-count').textContent = `${[...sim.collected].filter(id => (sim.level.pickups || []).some(pk => pk.id === id && pk.kind === 'skyshard')).length} / ${this.total}`; $('mote-count').textContent = sim.stats.motes;
    for (const el of $('abilities').children) {
      const slot = el.dataset.slot, ab = sim.kit.abilities[slot], locked = slot === 'grapple' && !sim.gear.grapple;
      const left = slot === 'dash' ? Math.max(0, p.dashCd) / p.char.dashCooldown : ab ? Math.max(0, p.cooldowns[slot] || 0) / ab.cooldown : 0;
      el.classList.toggle('locked', locked); el.classList.toggle('ready', !locked && left <= 0); el.querySelector('.cool').style.height = Math.min(100, left * 100) + '%';
    }
    const boss = sim.enemies.find(e => e.def.boss && !e.dead && e.alert && e.state !== 'idle'); $('boss').hidden = !boss;
    if (boss) { const w = Math.max(0, boss.hp / boss.maxHp) * 100 + '%'; $('boss-hp').style.width = w; $('boss-lag').style.width = w; $('boss-name').textContent = boss.def.name.toUpperCase(); $('boss-poise').style.width = Math.max(0, boss.poise / boss.def.poise) * 100 + '%'; }
    const combo = sim.combo.count; $('combo').hidden = combo < 3; if (combo !== this.comboShown) { this.comboShown = combo; $('combo-count').textContent = combo; $('combo').classList.remove('pop'); void $('combo').offsetWidth; $('combo').classList.add('pop'); }
    $('prompt').hidden = !sim.near; if (sim.near) $('prompt').innerHTML = `${k(this.input.label('interact'))} ${sim.near.read ? 'Read again' : 'Read the inscription'}`;
    $('vignette').classList.toggle('slow', sim.slowmo > 0);
    // Dialogue advances on its own; pressing interact skips ahead.
    if (this.lines.length) { this.lineT -= dt; if (this.lineT <= 0 || (this.input.tapped('interact') && this.lineT < this.lineMax - 0.4)) { this.lines.shift(); this.nextLine(); } }
  }
  nextLine() { const line = this.lines[0]; $('dialogue').hidden = !line; $('hud').classList.toggle('talking', !!line); if (!line) return; $('speaker').textContent = line.who === 'hero' ? this.char.name : line.who; $('line').textContent = line.text; this.lineT = this.lineMax = 2.2 + line.text.length * 0.045; }
  say(lines) { const idle = !this.lines.length; this.lines.push(...lines); if (idle) this.nextLine(); }
  toast(text, gold) { const t = document.createElement('div'); t.className = 'toast' + (gold ? ' gold' : ''); t.textContent = text; $('toasts').prepend(t); while ($('toasts').children.length > 3) $('toasts').lastChild.remove(); setTimeout(() => t.remove(), 1150); }
  banner(eyebrow, title) { const b = $('banner'); $('banner-eyebrow').textContent = eyebrow; $('banner-title').textContent = title; b.hidden = true; void b.offsetWidth; b.hidden = false; clearTimeout(this.bannerTimer); this.bannerTimer = setTimeout(() => { b.hidden = true; }, 3200); }

  handle(ev, sim) {
    switch (ev.type) {
      case 'hint': this.showHint(ev.key); break;
      case 'hintEnd': if (this.hintKey === ev.key) { this.hintKey = null; $('hint').hidden = true; } break;
      case 'dialogue': this.say(ev.lines); break;
      case 'tech': this.toast(ev.name.toUpperCase() + (ev.flow > 1 ? '  ×' + ev.flow : ''), ev.name.startsWith('perfect')); break;
      case 'hurt': { const v = $('vignette'); v.classList.add('hurt'); setTimeout(() => v.classList.remove('hurt'), 160); break; }
      case 'checkpoint': this.toast('CHECKPOINT · ' + (ev.name || 'Saved').toUpperCase(), true); break;
      case 'arenaStart': this.banner(ev.boss ? 'GUARDIAN OF THE GATE' : 'AMBUSH', ev.name || 'HOLD YOUR GROUND'); break;
      case 'arenaClear': this.toast(ev.boss ? 'THE GATE IS OPEN' : 'COURT CLEARED', true); break;
      case 'wave': if (ev.wave > 1) this.toast(`WAVE ${ev.wave} / ${ev.of}`); break;
      case 'bossPhase': this.toast(ev.phase === 2 ? 'IT CALLS ITS DEAD' : 'THE WARDEN RAGES', true); break;
      case 'bossStagger': this.toast('STAGGERED — STRIKE NOW', true); break;
      case 'guardBreak': this.toast('GUARD BROKEN'); break;
      case 'pickup': if (ev.kind === 'skyshard') this.toast('SKY SHARD', true); else if (ev.kind === 'heart') this.toast('RESTORED', true); break;
      case 'grappleMiss': if (sim.gear.grapple && sim.world.anchors.length) this.toast('NO ANCHOR IN REACH'); break;
      case 'pit': this.toast('RECOVERED'); break;
    }
  }

  // Story cards: resolves when the last one is dismissed or the sequence is skipped.
  cards(eyebrow, title, lines) {
    return new Promise(resolve => {
      let i = 0; $('card-eyebrow').textContent = eyebrow; $('card-title').textContent = title;
      const show = () => { $('card-text').textContent = lines[i]; $('card-next').querySelector('span').textContent = i === lines.length - 1 ? 'BEGIN' : 'CONTINUE'; };
      const done = () => { $('card-next').onclick = $('card-skip').onclick = null; resolve(); };
      $('card-next').onclick = () => { if (++i >= lines.length) done(); else show(); }; $('card-skip').onclick = done; show(); $('card-next').focus();
    });
  }
  popup(eyebrow, title, text) { return new Promise(resolve => { $('popup-eyebrow').textContent = eyebrow; $('popup-title').textContent = title; $('popup-text').textContent = text; $('popup-ok').onclick = () => { $('popup-ok').onclick = null; resolve(); }; $('popup-ok').focus(); }); }
  results(eyebrow, title, stats, note) {
    $('results-eyebrow').textContent = eyebrow; $('results-title').textContent = title; $('results-note').textContent = note;
    $('results-stats').innerHTML = stats.map(([label, value, cls]) => `<div class="${cls || ''}"><span>${label}</span><b>${value}</b></div>`).join(''); $('results-title-button').focus();
  }
  controls() { $('controls').innerHTML = CONTROL_ROWS.map(([name, actions]) => `<div><span>${name}</span><span>${actions.map(a => k(this.input.label(a))).join(' + ')}</span></div>`).join(''); }
}
export const formatTime = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
