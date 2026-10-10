# QA report — 10 October 2026

## Verified

- **45 deterministic core checks** (`node blackout/tests/core.cjs`): the original movement/combat/destruction/save checks, plus sprint after reload and stim, empty-magazine reload, primary/secondary swap, 17 distinct firearms, rail breaching, gun drops → unlock → field equip, bounties and combos, Insane density/damage/bursts/anti-camp grenades, smoke/flash/decoy/EMP/mines/deployable cover, Bulwark armour and Warden generators, every map's spawn/enemy/pickup/objective placement, per-target checkpoints, every checkpoint of every mission on every difficulty, economy (rewards, medals, first clears, contracts, streaks, rank-ups, purchases, loadout validation), version-1 save migration and HOLDOUT waves.
- **Campaign replays** (`node blackout/tests/walkthrough.cjs`): ordinary control packets only. THE CRASH completes on story/standard/intense; NO SAFE GROUND, DEAD FREQUENCY and UNDERGROUND on standard; IRON CONVOY and GHOST SIGNAL on standard with plating 1 + medic 1. A human-limited open-field model (0.3s reaction, finite turn rate, aim wobble) dies on Insane in the first three operations. Bot times reflect fast scripted aim, not human mission length.
- **20 real-Chromium checks** (including the item-art HUD) (`npm run test:browser`), against the working tree and the `dist/` build: assets, WASD/slide/vault/roll/dive, fire/reload, 1/2/X/mouse-wheel swaps, sprint after reload, grenades and tactical gadgets, melee, pause, rebinding/persistence, all 17 range weapons, operations board + loadout picker + armory purchase + deploy, a stubbed controller swapping with **Y** and reloading with **X**, the low-health vignette clearing after a stim, v1 save migration and checkpoint restore, corrupt saves/offline fonts, a full keyboard-and-mouse playthrough of THE CRASH through the debrief, small-screen layout, library card and blocked storage. No uncaught page errors; median 55 FPS headless at 1366×768.
- Other NEON ARCADE suites (WILDFALL, BLOOD OATH) still pass under `npm test`.

## Not verified

- Insane completion by a human. The cover-using model in `tests/tactical.cjs` reaches THE CRASH's final hold on Insane but has not won it. It is an optional QA tool, not part of `npm test`.
- Physical controllers (only a stubbed `navigator.getGamepads`), real speakers for the synthesized heartbeat/breathing, other browsers and GPUs.
- Later-operation pacing with real players.

## Visual artifacts

`blackout/qa/campaign-shots.cjs` and `effects-shots.cjs` (QA only, `?qa=1` hook) capture every screen, every mission, the low-health state, both mechanical bosses, the subway darkness and the debrief into `blackout/qa/`. QA files are excluded from the production build.
