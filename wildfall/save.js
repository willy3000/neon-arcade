// Versioned local save. Anything unreadable or out of range falls back to defaults instead of breaking the game.
import { CHARACTERS, DIFFICULTY } from './config.js';

export const KEY = 'wildfall-save';
export function defaults() {
  return { version: 1, character: 'vyx', campaign: {}, trial: {}, settings: { volume: 0.7, music: true, muted: false, shake: 0.8, reducedFlash: false, quality: 'high', difficulty: 'standard', gamepad: true } };
}
const strings = (list, max = 200) => (Array.isArray(list) ? list.filter(x => typeof x === 'string' && x.length < 60).slice(0, max) : []);
const flags = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => k.length < 40 && typeof v === 'boolean').slice(0, 60));
const num = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback);

export function decode(raw) {
  const d = defaults();
  try {
    const a = JSON.parse(raw); if (!a || a.version !== 1) return d;
    if (CHARACTERS[a.character]) d.character = a.character;
    for (const [id, c] of Object.entries(a.campaign && typeof a.campaign === 'object' ? a.campaign : {}).slice(0, 12)) {
      if (!/^[a-z0-9]{1,20}$/.test(id) || !c || typeof c !== 'object') continue;
      d.campaign[id] = { checkpoint: typeof c.checkpoint === 'string' && c.checkpoint.length < 20 ? c.checkpoint : null, cleared: strings(c.cleared), collected: strings(c.collected), gear: flags(c.gear), flags: flags(c.flags), completed: c.completed === true, character: CHARACTERS[c.character] ? c.character : d.character,
        stats: { time: num(c.stats?.time, 0, 360000, 0), kills: num(c.stats?.kills, 0, 1e6, 0), tech: num(c.stats?.tech, 0, 1e6, 0), hurt: num(c.stats?.hurt, 0, 1e6, 0), motes: num(c.stats?.motes, 0, 1e6, 0), deaths: num(c.stats?.deaths, 0, 1e5, 0) },
        best: c.best && Number.isFinite(c.best.time) ? { time: num(c.best.time, 0, 360000, 0), rank: ['S', 'A', 'B', 'C'].includes(c.best.rank) ? c.best.rank : 'C' } : null };
    }
    for (const id of Object.keys(CHARACTERS)) if (Number.isFinite(a.trial?.[id]) && a.trial[id] > 0) d.trial[id] = num(a.trial[id], 1, 3600, 0);
    const s = a.settings || {};
    for (const k of ['music', 'muted', 'reducedFlash', 'gamepad']) if (typeof s[k] === 'boolean') d.settings[k] = s[k];
    for (const k of ['volume', 'shake']) d.settings[k] = num(s[k], 0, 1, d.settings[k]);
    if (['high', 'low'].includes(s.quality)) d.settings.quality = s.quality;
    if (DIFFICULTY[s.difficulty]) d.settings.difficulty = s.difficulty;
  } catch { /* corrupt data: start clean */ }
  return d;
}
export function load(storage) { try { return decode(storage.getItem(KEY)); } catch { return defaults(); } }
export function write(storage, value) { try { storage.setItem(KEY, JSON.stringify(value)); return true; } catch { return false; } }
