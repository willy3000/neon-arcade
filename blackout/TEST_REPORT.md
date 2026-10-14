# QA report — 14 October 2026 (improvement pass)

After the changes in `docs/BLACKOUT_IMPROVEMENT_REPORT.md`. All runs on Windows 11, Node 24.18, on the working tree.

## Verified

| Suite | Result | Notes |
|---|---|---|
| `npm test` | **206 checks + 8 campaign replays, pass** | core 45, progression 26, co-op 15, squad 19, support 21, arsenal 19, holdout 22, **quality 31 (new)**, net 8. At the audit: 175 checks. |
| `npm run test:browser` | **22/22** | The controller "Y SWAP" check failed at the audit; fixed. |
| `npm run test:resilience` | **3/3** | The armory controller-actions check failed at the audit, and on the original commit; fixed. |
| `npm run test:e2e` | **pass** | Two Electron instances over a real LAN socket. |
| `npm run test:e2e:squad` | **pass** (second run) | First run timed out at `e2e-squad.cjs:147` waiting to see a guest's 0.4 s roll on the host. Intermittent timing; see below. |
| `npm run test:relay` | **11/11** | |
| `npm run verify` | **pass** | 172 static files. |

`tests/quality.cjs` covers:
- contract eligibility;
- corpse pruning (and that authored campaign soldiers and TDM operators are never pruned);
- each weapon trait against the real damage rules, plus weapon invariants: every gun for sale beats the free one at something, and the legendary pair out-damages it;
- the five extended perks;
- seeded challenges: determinism, the attempt rules, deduplication, the save round trip, and separation from Holdout records;
- each mutator and its pay;
- operation challenges paid once;
- the S rule;
- squadmate roll, dive and slide, and the AI evasive roll;
- TDM hearing-limited hunting and the scaling match clock.

**Real-input runs** (scripted keyboard and mouse, headless Chromium):
- **THE CRASH, Standard:** completed in 53.5 s, 17 kills, rating A, the debrief explains the missed S.
- **THE CRASH, Insane death:** the killer tip and the difficulty line on separate lines; retry 117 ms.
- **Holdout:** solo reached wave 6; with the AI partner, wave 12, through two red waves.
- **TDM 4v4:** 30–24 in 1:58.
- **No console errors**, and at least 57 FPS throughout.

A further 29 browser checks (challenges, the board, mutators, settings, Bootcamp, the HUD at 1280×800, 1366×768 and 1920×1080) passed.

## Known failures and gaps

- **`npm run test:tactical`** (optional, not in `npm test`) still fails, as it did before:
  - **Before:** the cover model died in stage 1 of THE CRASH on Insane.
  - **Now:** it survives stage 1 but stalls. Its rule "health under 35 means hide" never lets it go and find health once its stims are gone.
  - **With that rule fixed** (in a scratch copy, not committed to the test): it reaches stage 2 on Insane and wins on High Intensity.
  - Insane completion by a human is unverified.
- **`e2e-squad.cjs:147`** polls for a 0.4 s state across a real socket with a 4 s budget. It is timing-sensitive on a loaded machine.
- **Not run:**
  - `test:e2e:online` (needs the hosted relay);
  - `verify:package` and `test:packaged` (no packaged build was produced).
- **Still unverified:**
  - human playtests;
  - physical controllers;
  - colour-blind players on the new palettes;
  - real speakers for the new synthesised layers.
- **`blackout/qa/*.png`** still show the old look. Browser runs rewrite them, and they were restored after each run to keep the diff clean.

---

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
