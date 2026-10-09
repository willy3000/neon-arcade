// The roster. Adding a fighter means adding a data file and a skin; nothing in the engine changes.
import cinder from './cinder.js';
import rime from './rime.js';
import vesper from './vesper.js';
import grit from './grit.js';

export const ROSTER = [cinder, rime, vesper, grit];
export const BY_ID = Object.fromEntries(ROSTER.map(f => [f.id, f]));
