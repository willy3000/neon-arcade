/* NEON RUSH — dependency-free, fixed-step arcade simulation. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const CYAN = '#65fff3', RED = '#ff526d', GOLD = '#ffd477';
  const POWERUPS = {
    shield: { label: 'FORCEFIELD', symbol: '⬡', color: CYAN, duration: 8 },
    magnet: { label: 'ENERGY MAGNET', symbol: 'M', color: '#b597ff', duration: 10 },
    double: { label: 'DOUBLE POINTS', symbol: '2×', color: '#a8ff85', duration: 10 },
    life: { label: 'EXTRA LIFE', symbol: '♥', color: '#ff97ca' },
    blaster: { label: 'BLASTER', symbol: 'B', color: '#79b5ff', duration: 12 }
  };
  const MAX_LIVES = 5;
  let lives = MAX_LIVES, invulnerable = 0, powerupClock = 4, powerups = [];
  let effects = { shield: 0, magnet: 0, double: 0, blaster: 0 };
  const BLAST_RADIUS = 95, BLAST_OFFSET = 105, BLAST_COOLDOWN = .55;
  let blastCooldown = 0, blasts = [];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const random = (a, b) => a + Math.random() * (b - a);
  const format = n => Math.floor(n).toString().padStart(6, '0');
  let width, height, dpr, state = 'menu', best = 0, muted = false, audio;
  try { best = Number(localStorage.getItem('neon-rush-best')) || 0; muted = localStorage.getItem('neon-rush-muted') === 'true'; } catch {}
  let elapsed = 0, score = 0, combo = 0, collected = 0, closeCalls = 0, spawnClock = 0, orbClock = 0;
  let obstacles = [], orbs = [], particles = [], floats = [], trail = [], shake = 0, flash = 0, announcementTime = 0, recordAnnounced = false;
  let player = { x: 0, y: 0, vx: 0, radius: 11 }, targetX = 0, lastTime = 0, accumulator = 0, visualTime = 0;
  const keys = new Set();
  const arena = () => { const w = Math.min(width - 32, 760); return { left: (width - w) / 2, right: (width + w) / 2, width: w }; };
  function resize() {
    const old = width || innerWidth; width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a = arena(); player.x = clamp(player.x * width / old || width / 2, a.left + 16, a.right - 16); targetX = player.x;
    player.y = height - Math.max(95, height * .15);
    for (const item of [...obstacles, ...orbs, ...powerups]) item.x = clamp(item.x * width / old, a.left + 28, a.right - 28);
    trail = [];
  }
  function sound(kind, multiplier = 1) {
    if (muted || !audio) return;
    const osc = audio.createOscillator(), gain = audio.createGain(); osc.connect(gain); gain.connect(audio.destination);
    const t = audio.currentTime; osc.type = kind === 'impact' ? 'sawtooth' : 'sine';
    if (kind === 'blaster') osc.type = 'triangle';
    osc.frequency.setValueAtTime(kind === 'impact' ? 160 : kind === 'near' ? 340 : 540 + multiplier * 70, t);
    osc.frequency.exponentialRampToValueAtTime(kind === 'impact' ? 25 : kind === 'near' ? 680 : 1000 + multiplier * 100, t + .16);
    if (kind === 'blaster') { osc.frequency.setValueAtTime(850, t); osc.frequency.exponentialRampToValueAtTime(70, t + .2); }
    gain.gain.setValueAtTime(kind === 'impact' ? .16 : .065, t); gain.gain.exponentialRampToValueAtTime(.001, t + (kind === 'impact' ? .45 : .2));
    osc.start(t); osc.stop(t + .5);
  }
  function unlockAudio() { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); } catch {} }
  function announce(message) { $('announcement').textContent = message; $('announcement').classList.add('visible'); announcementTime = 1.8; }
  function burst(x, y, color, count = 22) {
    for (let i = 0; i < count; i++) { const angle = random(0, Math.PI * 2), speed = random(45, 210); particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: random(.3, .8), max: .8, color, size: random(1, 3) }); }
  }
  function syncScreens() {
    $('fire').disabled = state !== 'playing' || blastCooldown > 0;
    $('menu').hidden = state !== 'menu'; $('hud').hidden = !['playing', 'paused'].includes(state); $('end').hidden = state !== 'over'; $('paused').hidden = state !== 'paused'; $('pause').hidden = !['playing', 'paused'].includes(state);
    $('menu-best').textContent = format(best); $('mute').textContent = muted ? '♪̸' : '♫'; $('mute').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound'); $('mute').setAttribute('aria-pressed', String(muted));
  }
  function start() {
    unlockAudio(); state = 'playing'; elapsed = score = combo = collected = closeCalls = 0; spawnClock = .8; orbClock = .45;
    obstacles = []; orbs = []; particles = []; floats = []; trail = []; shake = flash = 0; recordAnnounced = false;
    lives = MAX_LIVES; invulnerable = 0; powerups = []; powerupClock = 4;
    effects = { shield: 0, magnet: 0, double: 0, blaster: 0 }; blastCooldown = 0; blasts = [];
    player.x = targetX = width / 2; player.vx = 0; accumulator = 0; keys.clear(); announcementTime = 0; $('announcement').classList.remove('visible'); syncScreens(); updateHUD();
  }
  function pause() { if (state === 'playing') { state = 'paused'; keys.clear(); syncScreens(); } else if (state === 'paused') { state = 'playing'; accumulator = 0; unlockAudio(); syncScreens(); } }
  function home() { state = 'menu'; obstacles = []; orbs = []; powerups = []; blasts = []; trail = []; keys.clear(); $('announcement').classList.remove('visible'); syncScreens(); }
  function fireBlaster() {
    if (state !== 'playing' || effects.blaster <= 0 || blastCooldown > 0) return;
    unlockAudio(); blastCooldown = BLAST_COOLDOWN;
    const x = player.x, y = player.y - BLAST_OFFSET;
    blasts.push({ x, y, originY: player.y - player.radius, life: .35 });
    for (const o of obstacles) {
      // Circle-versus-rectangle intersection catches obstacle edges in the blast.
      const dx = Math.max(Math.abs(o.x - x) - o.w / 2, 0);
      const dy = Math.max(Math.abs(o.y - y) - o.h / 2, 0);
      if (o.y < player.y && Math.hypot(dx, dy) <= BLAST_RADIUS) {
        o.dead = true; burst(o.x, o.y, RED, 18);
      }
    }
    obstacles = obstacles.filter(o => !o.dead);
    burst(x, y, POWERUPS.blaster.color, 24); sound('blaster'); shake = 3; updateHUD();
  }
  function hitObstacle(obstacle) {
    obstacle.dead = true;
    if (effects.shield > 0 || invulnerable > 0) {
      burst(obstacle.x, obstacle.y, effects.shield > 0 ? CYAN : RED, 15);
      if (effects.shield > 0) { sound('near'); shake = 2; }
      return;
    }
    lives--; combo = 0; updateHUD();
    if (lives === 0) { gameOver(); return; }
    invulnerable = 1.5; shake = 9; flash = .3;
    burst(player.x, player.y, RED, 35); sound('impact');
    announce(lives === 1 ? 'LAST LIFE — KEEP GOING' : `${lives} LIVES LEFT`);
  }
  function activatePowerup(type) {
    const power = POWERUPS[type];
    if (type === 'life') {
      const restored = lives < MAX_LIVES;
      lives = Math.min(MAX_LIVES, lives + 1);
      burst(player.x, player.y, power.color, 32); sound('collect', 6);
      announce(restored ? '+1 LIFE' : 'LIVES FULL');
      floats.push({ x: player.x, y: player.y - 30, text: restored ? '+1 ♥' : 'FULL ♥', color: power.color, life: 1 });
      updateHUD(); return;
    }
    // Repeated pickups refresh the timer; different effects can coexist.
    effects[type] = power.duration;
    burst(player.x, player.y, power.color, 32); sound('collect', 6);
    announce(type === 'blaster' ? 'BLASTER · CLICK / SPACE TO FIRE' : `${power.label} · ${power.duration}s`);
  }
  function gameOver() {
    state = 'over'; sound('impact'); shake = 14; flash = .45; burst(player.x, player.y, CYAN, 65);
    const record = Math.floor(score) > best; if (record) { best = Math.floor(score); try { localStorage.setItem('neon-rush-best', String(best)); } catch {} }
    $('final-score').textContent = format(score); $('final-best').textContent = format(best); $('end-label').textContent = record ? '✦ NEW PERSONAL RECORD' : 'SIGNAL LOST';
    $('end-message').textContent = record ? 'A new high. There’s always another.' : 'Take a breath. Then beat it.';
    $('run-details').textContent = `${Math.floor(elapsed)}s survived · ${collected} energy collected · ${closeCalls} close calls`; syncScreens(); $('again').focus();
  }
  function spawnPattern() {
    const a = arena(), lanes = 7, step = a.width / lanes, gap = Math.floor(random(1, lanes - 1));
    const level = Math.min(1, elapsed / 100); const speed = 150 + Math.min(elapsed * 2.4, 230);
    // All members of a row share a speed; reserve a two-lane corridor.
    const pattern = elapsed < 8 ? 0 : Math.random();
    if (pattern < .48) {
      const count = elapsed < 8 ? 2 : 3;
      const chosen = new Set();
      while (chosen.size < count) { const lane = Math.floor(random(0, lanes)); if (lane !== gap && lane !== gap - 1) chosen.add(lane); }
      for (const lane of chosen) obstacles.push({ x: a.left + step * (lane + .5), y: -40, w: Math.min(34 + level * 12, step * .6), h: 34, speed, shape: 'diamond', near: false, passed: false });
    } else {
      for (let lane = 0; lane < lanes; lane++) if (lane !== gap && lane !== gap - 1) obstacles.push({ x: a.left + step * (lane + .5), y: -40, w: step * .76, h: 23, speed, shape: elapsed > 35 && pattern > .8 ? 'hex' : 'bar', near: false, passed: false });
    }
    // Fixed minimum travel time between rows allows a full-width reposition.
    spawnClock = Math.max(.9, 1.6 - elapsed * .006);
  }
  function spawnOrb() {
    const a = arena(), special = elapsed > 12 && Math.random() < .13;
    orbs.push({ x: random(a.left + 28, a.right - 28), y: -24, r: special ? 10 : 7, speed: 145 + Math.min(elapsed * 2.4, 225), special });
    orbClock = random(.85, 1.6);
  }
  function spawnPowerup() {
    const a = arena(), types = Object.keys(POWERUPS);
    powerups.push({ type: types[Math.floor(random(0, types.length))], x: random(a.left + 28, a.right - 28), y: -24, r: 15, speed: 145 + Math.min(elapsed * 2.4, 225) });
    powerupClock = random(7, 11);
  }
  function updateHUD() {
    $('score').textContent = format(score); $('combo').textContent = `×${Math.max(1, combo)}`;
    $('time').textContent = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${Math.floor(elapsed % 60).toString().padStart(2, '0')}`;
    $('lives').textContent = '♥'.repeat(lives) + '♡'.repeat(MAX_LIVES - lives);
    $('lives').setAttribute('aria-label', `${lives} of ${MAX_LIVES} lives remaining`);
    for (const [type, power] of Object.entries(POWERUPS)) {
      if (!power.duration) continue;
      const badge = $(`effect-${type}`); badge.hidden = effects[type] <= 0;
      badge.textContent = `${power.symbol} ${power.label} ${Math.ceil(effects[type])}s`;
    }
    $('fire').hidden = effects.blaster <= 0;
    $('fire').disabled = state !== 'playing' || blastCooldown > 0;
    $('fire').textContent = blastCooldown > 0 ? 'RECHARGING' : 'FIRE · SPACE / CLICK';
  }
  function update(dt) {
    visualTime += dt; shake *= Math.exp(-12 * dt); flash = Math.max(0, flash - dt);
    if (announcementTime > 0) { announcementTime -= dt; if (announcementTime <= 0) $('announcement').classList.remove('visible'); }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 100 * dt; p.life -= dt; } particles = particles.filter(p => p.life > 0);
    for (const f of floats) { f.y -= 35 * dt; f.life -= dt; } floats = floats.filter(f => f.life > 0);
    if (state !== 'playing') return;
    blastCooldown = Math.max(0, blastCooldown - dt);
    for (const blast of blasts) blast.life -= dt;
    blasts = blasts.filter(blast => blast.life > 0);
    invulnerable = Math.max(0, invulnerable - dt);
    for (const type of Object.keys(effects)) effects[type] = Math.max(0, effects[type] - dt);
    elapsed += dt; score += dt * 12 * (effects.double > 0 ? 2 : 1);
    const a = arena(), direction = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
    if (direction) targetX = clamp(targetX + direction * 650 * dt, a.left + 15, a.right - 15);
    const desired = clamp((targetX - player.x) * 18, -950, 950); player.vx += (desired - player.vx) * (1 - Math.exp(-22 * dt));
    player.x = clamp(player.x + player.vx * dt, a.left + 15, a.right - 15);
    trail.push({ x: player.x, y: player.y, life: .32 }); for (const t of trail) t.life -= dt; trail = trail.filter(t => t.life > 0);
    spawnClock -= dt; orbClock -= dt; if (spawnClock <= 0) spawnPattern(); if (orbClock <= 0) spawnOrb();
    powerupClock -= dt; if (powerupClock <= 0) spawnPowerup();
    // Resolve pickups before obstacles, so a forcefield caught on impact protects immediately.
    for (const p of powerups) {
      p.y += p.speed * dt;
      if (Math.hypot(player.x - p.x, player.y - p.y) < player.radius + p.r + 3) { p.dead = true; activatePowerup(p.type); }
    }
    powerups = powerups.filter(p => !p.dead && p.y < height + 30);
    for (const o of obstacles) {
      o.speed = 150 + Math.min(elapsed * 2.4, 230);
      o.y += o.speed * dt;
      const dx = Math.max(Math.abs(player.x - o.x) - o.w / 2, 0), dy = Math.max(Math.abs(player.y - o.y) - o.h / 2, 0);
      const distance = Math.hypot(dx, dy);
      if (distance < player.radius - 2) { hitObstacle(o); if (state === 'over') return; continue; }
      if (distance < player.radius + 19 && effects.shield <= 0 && invulnerable <= 0) o.near = true;
      if (!o.passed && o.y - o.h / 2 > player.y + player.radius) { o.passed = true; if (o.near) { const points = effects.double > 0 ? 70 : 35; score += points; closeCalls++; shake = 3; sound('near'); announce(`CLOSE CALL +${points}`); floats.push({ x: player.x, y: player.y - 30, text: `+${points}`, color: CYAN, life: .9 }); } }
    }
    obstacles = obstacles.filter(o => !o.dead && o.y < height + 60);
    for (const o of orbs) {
      o.y += o.speed * dt;
      if (effects.magnet > 0 && !o.missed && Math.hypot(player.x - o.x, player.y - o.y) < 175) {
        const pull = 1 - Math.exp(-8 * dt); o.x += (player.x - o.x) * pull; o.y += (player.y - o.y) * pull;
      }
      if (Math.hypot(player.x - o.x, player.y - o.y) < player.radius + o.r + 3) {
        combo = Math.min(combo + 1, 10); collected++; const points = (o.special ? 150 : 50) * combo * (effects.double > 0 ? 2 : 1); score += points; o.dead = true;
        burst(o.x, o.y, GOLD, o.special ? 38 : 20); sound('collect', combo); floats.push({ x: o.x, y: o.y - 20, text: `+${points}`, color: GOLD, life: 1 });
        if (combo === 5 || combo === 10) announce(`COMBO ×${combo}`); else if (o.special) announce('SUPER ENERGY');
      } else if (o.y > player.y + player.radius + o.r && !o.missed) { o.missed = true; combo = 0; }
    }
    orbs = orbs.filter(o => !o.dead && o.y < height + 30);
    if (best > 0 && score > best && !recordAnnounced) { recordAnnounced = true; announce('NEW RECORD'); }
    updateHUD();
  }
  function glow(color, blur = 18) { ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.strokeStyle = color; ctx.fillStyle = color; }
  function drawObstacle(o, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(o.x, o.y); glow(RED, 15); ctx.lineWidth = 1.7; ctx.beginPath();
    if (o.shape === 'diamond') { ctx.moveTo(0, -o.h / 2); ctx.lineTo(o.w / 2, 0); ctx.lineTo(0, o.h / 2); ctx.lineTo(-o.w / 2, 0); }
    else if (o.shape === 'hex') { ctx.moveTo(-o.w / 2 + 8, -o.h / 2); ctx.lineTo(o.w / 2 - 8, -o.h / 2); ctx.lineTo(o.w / 2, 0); ctx.lineTo(o.w / 2 - 8, o.h / 2); ctx.lineTo(-o.w / 2 + 8, o.h / 2); ctx.lineTo(-o.w / 2, 0); }
    else ctx.rect(-o.w / 2, -o.h / 2, o.w, o.h);
    ctx.closePath(); ctx.fillStyle = '#ff526d15'; ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function drawOrb(x, y, r, special = false) {
    ctx.save(); glow(GOLD, 20); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff3c6'; ctx.beginPath(); ctx.arc(x - 1, y - 1, r * .35, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .35 + Math.sin(visualTime * 4) * .12; ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(x, y, r + (special ? 10 : 7), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function drawPlayer(x, y, radius = 11) {
    ctx.save(); glow(CYAN, 28); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d7fffa'; ctx.shadowBlur = 7; ctx.beginPath(); ctx.arc(x - 2, y - 2, radius * .42, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function drawPowerup(p) {
    const power = POWERUPS[p.type]; ctx.save(); ctx.translate(p.x, p.y);
    glow(power.color, 20); ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const angle = Math.PI / 3 * i - Math.PI / 2; const x = Math.cos(angle) * p.r, y = Math.sin(angle) * p.r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fillStyle = '#101c2d'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = power.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(power.symbol, 0, 1); ctx.restore();
  }
  function drawPlayerEffects() {
    ctx.save();
    for (const [type, radius] of [['shield', 29], ['magnet', 175], ['double', 20]]) {
      if (effects[type] <= 0) continue;
      const power = POWERUPS[type]; glow(power.color, type === 'magnet' ? 4 : 18);
      ctx.globalAlpha = effects[type] < 2 ? .35 + Math.sin(visualTime * 16) * .2 : type === 'magnet' ? .18 : .7;
      ctx.lineWidth = type === 'shield' ? 2.5 : 1; ctx.beginPath(); ctx.arc(player.x, player.y, radius + Math.sin(visualTime * 4) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  function render() {
    ctx.clearRect(0, 0, width, height); const bg = ctx.createRadialGradient(width * .7, height * .5, 0, width * .6, height * .5, width * .65); bg.addColorStop(0, '#0b222a'); bg.addColorStop(.6, '#0a1220'); bg.addColorStop(1, '#070b15'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    ctx.save(); if (shake > .1) ctx.translate(random(-shake, shake), random(-shake, shake));
    const menu = state === 'menu', gridLeft = menu ? width * .4 : arena().left;
    ctx.strokeStyle = '#65fff309'; ctx.lineWidth = 1; const offset = visualTime * 22 % 48;
    for (let x = gridLeft; x < width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 105); ctx.lineTo(x, height - 58); ctx.stroke(); }
    for (let y = 105 + offset; y < height - 58; y += 48) { ctx.beginPath(); ctx.moveTo(gridLeft, y); ctx.lineTo(menu ? width : arena().right, y); ctx.stroke(); }
    if (menu) {
      const mobile = width < 700, cx = width * (mobile ? .82 : .7), cy = height * .55, scale = mobile ? .55 : 1;
      ctx.globalAlpha = mobile ? .4 : 1;
      ctx.strokeStyle = '#65fff30c'; for (const r of [85, 145, 205]) { ctx.beginPath(); ctx.arc(cx, cy, r * scale, 0, Math.PI * 2); ctx.stroke(); }
      const pieces = [[-115,-150,44,44,'diamond'],[130,-80,70,22,'bar'],[-80,70,70,22,'bar'],[170,135,40,40,'diamond'],[35,-220,40,40,'diamond']];
      for (let i = 0; i < pieces.length; i++) { const [x,y,w,h,shape] = pieces[i]; drawObstacle({ x: cx + x * scale, y: cy + (y + Math.sin(visualTime * .8 + i) * 13) * scale, w: w * scale, h: h * scale, shape }, mobile ? .4 : .8); }
      drawOrb(cx + 40 * scale, cy - 70 * scale, 7 * scale); drawOrb(cx - 140 * scale, cy + 145 * scale, 6 * scale);
      const px = cx + Math.sin(visualTime * .65) * 35 * scale, py = cy + 90 * scale;
      for (let i = 12; i > 0; i--) { ctx.globalAlpha = (1 - i / 13) * .25; drawPlayer(px - Math.sin(visualTime - i * .1) * i * 1.3, py + i * 7 * scale, (11 - i * .6) * scale); } ctx.globalAlpha = mobile ? .5 : 1; drawPlayer(px, py, 13 * scale);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = '#65fff321'; const a = arena(); for (const x of [a.left, a.right]) { ctx.beginPath(); ctx.moveTo(x, 170); ctx.lineTo(x, height - 70); ctx.stroke(); }
      for (const t of trail) { ctx.globalAlpha = t.life / .32 * .35; drawPlayer(t.x, t.y + (1 - t.life / .32) * 35, t.life / .32 * 9); } ctx.globalAlpha = 1;
      obstacles.forEach(o => drawObstacle(o)); orbs.forEach(o => drawOrb(o.x, o.y, o.r, o.special)); powerups.forEach(drawPowerup);
      if (state !== 'over') { drawPlayerEffects(); ctx.save(); if (invulnerable > 0) ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(visualTime * 18)); drawPlayer(player.x, player.y); ctx.restore(); }
      for (const blast of blasts) {
        ctx.save(); glow(POWERUPS.blaster.color, 24); ctx.globalAlpha = blast.life / .35; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(blast.x, blast.originY); ctx.lineTo(blast.x, blast.y); ctx.stroke();
        ctx.beginPath(); ctx.arc(blast.x, blast.y, BLAST_RADIUS * (1 - blast.life / .35), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha *= .2; ctx.beginPath(); ctx.arc(blast.x, blast.y, BLAST_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
    for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); glow(p.color, 8); ctx.fillRect(p.x, p.y, p.size, p.size); } ctx.shadowBlur = 0;
    ctx.font = 'bold 17px "Space Grotesk", sans-serif'; ctx.textAlign = 'center'; for (const f of floats) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.restore(); if (flash > 0) { ctx.fillStyle = `rgba(255,82,109,${flash * .35})`; ctx.fillRect(0, 0, width, height); }
  }
  function frame(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000 || 0, .05); lastTime = timestamp;
    if (state !== 'paused') { accumulator += dt; while (accumulator >= 1 / 120) { update(1 / 120); accumulator -= 1 / 120; } }
    render(); requestAnimationFrame(frame);
  }
  canvas.addEventListener('pointermove', e => { if (state === 'playing') targetX = clamp(e.clientX, arena().left + 15, arena().right - 15); });
  canvas.addEventListener('pointerdown', e => { if (state === 'playing') { unlockAudio(); targetX = clamp(e.clientX, arena().left + 15, arena().right - 15); canvas.setPointerCapture(e.pointerId); if (e.button === 0) fireBlaster(); } });
  window.addEventListener('keydown', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowLeft','ArrowRight','a','d',' ','Escape','p'].includes(key)) e.preventDefault();
    if (e.repeat) return;
    if (key === 'Escape' || key === 'p') pause(); else if (key === ' ' && (state === 'menu' || state === 'over')) start(); else if (key === ' ' && state === 'paused') pause(); else if (key === ' ' && state === 'playing') fireBlaster(); else keys.add(key);
  });
  window.addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  window.addEventListener('resize', resize);
  $('play').onclick = $('again').onclick = start; $('pause').onclick = $('resume').onclick = pause; $('home').onclick = $('pause-home').onclick = home;
  $('fire').onclick = fireBlaster;
  $('mute').onclick = () => { muted = !muted; unlockAudio(); try { localStorage.setItem('neon-rush-muted', String(muted)); } catch {} syncScreens(); };
  resize(); syncScreens(); requestAnimationFrame(frame);
})();
