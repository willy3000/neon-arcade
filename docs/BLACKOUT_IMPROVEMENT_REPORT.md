# Blackout Protocol — Improvement Report

*14 October 2026. Branch `blackout-protocol-windows`, on top of commit `f8fb38c`. Nothing is committed: every change below is in the working tree.*

This report covers the work done against the issues in [`BLACKOUT_PROTOCOL_GAME_AUDIT.md`](BLACKOUT_PROTOCOL_GAME_AUDIT.md), in the order the audit set:
- correctness first;
- then readability and pacing;
- then weapons and rewards;
- then replayability;
- then polish.

Two items are **pending outside this work** and were deliberately left untouched:
- **The name collision.** The game was not renamed and the branding was not changed.
- **The voice-over rights.** No voices were re-recorded, generated or changed.

Both still block a commercial release.

## 1. What changed for players

The ten changes a returning player will notice first:

1. **Every gun has a job.**
   - The armory shows each gun's role, its traits, real numbers and a comparison with the gun equipped.
   - New traits the simulation honours: armour-piercing, counter-shot, suppression, steady on the move, shield overload.
   - Five guns retuned and three re-priced downwards (`BLACKOUT_BALANCE.md`).
   - Every gun for sale now beats the free one at something. A test enforces this.
2. **Enemies are readable at a glance.**
   - Each type has its own headgear, and the dangerous ones carry a badge.
   - The dead fall flat and grey, then fade after six seconds instead of piling up in Holdout.
3. **Seeded daily and weekly Holdout challenges.**
   - The same map, kit, twist and waves for everyone on that day or week.
   - A local top-ten board.
   - Only the first daily attempt counts.
4. **Mutators** on cleared operations: Night Ops, Veterans, Sidearms Only and Scarcity, each with a pay multiplier.
5. **An operation challenge** per mission, paid once.
6. **Perks that make builds.**
   - Ambusher now works on helpless enemies.
   - Executioner finishes anyone below 55 health.
   - Flow State extends with kills.
   - Hardline and Scrounger reward gadget kills.
7. **A better first hour.**
   - Bootcamp has 13 steps, including roll, dive, knife, dodge and perfect flow, and stays on the board to replay.
   - THE CRASH teaches the laser, grenade rings and frags, with a second grenadier and a marked movement lane.
   - The S rating now needs a perfect flow, and the debrief says what a missed S lacked.
8. **Insane is hard, not a wall.** Incoming damage ×1.85 → ×1.5, and post-hit protection 0.14 s → 0.2 s. The tactical rules are unchanged.
9. **Accessibility options:**
   - text size (100 / 115 / 130%);
   - four colour palettes;
   - hold or toggle for sprint and steady aim.
10. **Co-op and team deathmatch.**
    - **Squadmates:** they now roll, dive and slide by the player's rules, and AI partners roll out of shots aimed at them.
    - **Team deathmatch:** matches are slower and fairer:
      - 70% damage;
      - six-second redeploy;
      - bots hunt only what they have seen or heard;
      - longer clocks on large maps;
      - each map is labelled small or large.

## 2. Status of every audit issue

Issue register (audit §6):

| # | Issue | Status | What was done |
|---|---|---|---|
| 1 | Name collision and voice rights | **Pending (external)** | Excluded from this work by instruction. Nothing renamed, no voice assets touched. |
| 2 | Weapon tiers are sidegrades | **Done** | Roles and traits, five retunes, three price cuts, armory facts and comparison, invariant tests. See §3.3. |
| 3 | Campaign short; Act III missing | **Partly done** | Replay value added (mutators, operation challenges, S-rank rule, seeded challenges). Act III not built (§6). |
| 4 | Enemy and corpse readability | **Done** (needs a human blind test) | Headgear per type, role badges, flat grey corpses that fade. |
| 5 | Holdout corpses never removed | **Done** | Corpses pruned after 6 s. See §5 for the measurements. |
| 6 | Contracts ignore what the player owns | **Done** | Contracts need the right gear class; impossible ones are swapped within the day. |
| 7 | THE CRASH too short and easy | **Done** | Second grenadier, a hold-wave grenadier, teaching hints, a movement lane. S needs a flow. |
| 8 | Insane difficulty cliff | **Done** | Damage ×1.5 and 0.2 s protection (was ×1.85 / 0.14 s). Tactical rules unchanged. |
| 9 | TDM too fast on small maps | **Improved, target not met** | 70% damage, 6 s redeploy, hearing-limited bots, patrols, clock scaled by map. See §5. |
| 10 | LAN co-op partner kit | **Partly done** | Movement parity (roll, dive, slide) for every squadmate. Per-guest perks and support deferred (§6). |
| 11 | Gun audio re-pitched from one sample | **Partly done** | Synthesised per-class layers over the shared samples. No new sound files, by instruction. |
| 12 | HUD overlaps | **Done** | Banner queue and boss-bar offset, controls strip moved, pickup labels avoid each other. Checked at 1280×800, 1366×768 and 1920×1080. |
| 13 | Insane death copy joins two messages | **Done** | Killer tip and difficulty line are separate lines. |
| 14 | No leaderboards or score attack | **Done (local)** | Seeded challenges with a local board. No online board or platform achievements (§6). |
| 15 | Dense code style | **Not done** | New code follows the house style. No reformatting pass; that is a separate, low-risk job (§6). |
| 16 | Failing browser test | **Done** | The controller "Y SWAP" hint was hidden by the compact HUD; restored. Browser suite 22/22. |
| 17 | Accessibility options | **Done** | Text size, palettes, sprint and aim toggles, all saved. |

Roadmap items (audit §10) not covered by the issue register:

| # | Item | Status |
|---|---|---|
| 10 | Human Holdout playtests | **Not possible here.** Needs people. Scripted real-input runs are in §4. |
| 12 | Mission mutators | **Done.** The four chosen are Night, Veterans, Sidearms and Scarcity. The audit's "no-HUD" idea was left out because it fights the readability work. |
| 14 | Synergy perks | **Done**, by extending five existing perks rather than adding slots. |
| 16 | Operation challenges | **Done.** |
| 19 | Combat music | **Not done** (§6). A flow-chain rising tone and a counter-shot cue were added. |
| 20 | Boss art | **Not done** (§6). |
| 22 | Steam integration | **Not done.** Out of scope; needs the name resolved first. |
| 23 | Online relay | **Not done.** Out of scope. |
| 24 | Code formatting | **Not done** (see issue 15). |

## 3. Changes in detail

### 3.1 Correctness (stage A)

- **Contracts** (`meta.js`):
  - `contractsFor(day,save)` keeps contracts the player can attempt with what they own: a shotgun, precision, SMG or explosive contract needs that class.
  - `refreshContracts` swaps an unstarted impossible contract within the same day.
- **Corpses** (`core.js`, `render.js`):
  - Hostiles a wave or the director sent in are removed six seconds after death, checked once a second.
  - Authored campaign soldiers stay, so checkpoints still know who is dead.
  - Team deathmatch never prunes.
  - The renderer destroys the sprite of a removed hostile.
- **HUD** (`game.js`, `style.css`):
  - Banners queue (each shows for at least 1.4 s; combo banners are dropped rather than queued).
  - Banners sit lower while a boss bar is up.
  - The training controls strip moved to the bottom centre.
  - Pickup labels avoid one another.
  - The death copy uses separate lines.
- **Browser test:** the compact HUD from `f8fb38c` had hidden the alternate-key hints that the controller test reads. They are back as a compact inline hint.
- **Armory controller navigation:**
  - The D-pad now steps through the detail panel's actions in reading order.
  - This fixed a resilience-suite failure that also fails on the original commit.

### 3.2 Readability and pacing (stage B)

- **Hostiles:**
  - Headgear per type (`HEAD` in `render.js`).
  - Role badges (`BADGE`) on live, visible, uncloaked hostiles outside TDM.
- **Corpses:** a fall, then a flat grey shape with a stain, fading over the last 1.5 s. Machine wrecks fade the same way.
- **Feedback:** suppression arcs, the COUNTER pop-up, and an amber ring on a perfect flow (no flash, so it survives reduced-flash mode).
- **THE CRASH** (`missions.js`):
  - A grenadier (`a5`) at the supply cache.
  - A grenadier in the hold wave (an infantryman on Story).
  - Stage hints teaching the laser, red rings and frags.
  - A SPRINT · SLIDE · VAULT area label.
  - The grenadier was moved during final validation (§7).
- **Bootcamp** (`game.js`):
  - 13 steps: move, sprint, slide, vault, perfect flow, roll, dive, fire, reload, swap, knife, dodge a telegraphed shot, gadget.
  - Always offered on the operations board, with replay text once done.
- **Difficulty:** Insane damage ×1.5 and protection 0.2 s.
- **Rating:** S needs a score of 9,800 and a perfect flow; the debrief explains a missed S.

### 3.3 Weapons and rewards (stage C)

Full tables are in [`BLACKOUT_BALANCE.md`](BLACKOUT_BALANCE.md).

| Change | Detail |
|---|---|
| Traits (in `damageEnemy`, `core.js`) | `ap`, `counter`, `suppress`, `steady`, `overload` |
| Retunes | MP7, FR-9, RX-4, ARC-7, plus traits on SVK-9, KV-15, M110, M249, M134, XR-9, .44, VZ-61 |
| Price cuts | M32 15,000 → 11,000; TESLA-3 16,000 → 12,000; M79 5,000 → 3,500. No price raised; the legendary pair kept their prices. |
| Armory | Role, trait list, a numbers row, and a comparison with the equipped gun (`weaponFacts`) |
| Perks | Ambusher, Executioner, Flow State, Hardline, Scrounger extended (`credit()` and `damageEnemy`) |
| Economy | Whole-armory estimate 18.7 h → 18.4 h, inside the agreed 18–25 h band |

New tools:
- `blackout/qa/weapon-report.cjs`: weapon matrix (sustained, versus armour, tank, shield, time to kill, group);
- `blackout/qa/holdout-sim.cjs --weapons`: survival by primary.

### 3.4 Replayability and multiplayer (stage D)

- **Seeded challenges** (`meta.js`; `game.js` challenges panel, opened from the CHALLENGES button by the daily contracts on the main menu. They were first placed in the Holdout lobby, which cluttered it, and moved after review):
  - The daily uses standard pressure and counts its first attempt only. The weekly uses high intensity and keeps the best.
  - The seed comes from the day or week number (high bits of a linear congruential generator).
  - The given loadout only: no upgrades, perks or profile.
  - Score = wave × 1000 + kills × 10 + best combo × 25.
  - The board keeps the top ten per kind on this machine.
  - Challenge runs are kept out of ordinary Holdout records and milestones.
  - The end screen shows score, accuracy and rank.
- **Mutators** (`world.js` table; `core.js` rules; `meta.js` pay; `game.js` chips on the brief):
  - Only on cleared operations.
  - Not in TDM or training.
  - Multipliers combine (Night with Sidearms pays ×1.56).
- **Operation challenges:** one per operation, 400–700 CR, paid once and stored as `missions[id].opChallenge`.
- **Holdout debrief:** accuracy and score lines.
- **Co-op parity:**
  - `stepMate` gives every squadmate roll, dive and slide with the player's stamina costs, speeds and invulnerable window (`damageMate`).
  - No firing or knifing while airborne.
  - AI partners roll out of a shot past 55% of its wind-up.
  - Guest prediction follows the dodge states.
  - The guest vault and per-guest perks and support were not done (§6).
- **TDM pacing:**
  - 70% damage (was 85%), 6 s redeploy (was 5 s).
  - Bots patrol, hunt only an operator they have seen or heard (a shot is audible for 1.5 s within 700 units), and peek from cover when pressed.
  - Match clock × √(map area), capped at 20 minutes.
  - Map-size tags in the lobby.

### 3.5 Finishing (stage E)

- **Accessibility:**
  - Text-size multiplier on the `--t1/--t2/--t3` type scale and on labels drawn in the field.
  - Palettes recolour hostile, warning and machine colours in the renderer and on the HUD. Red–green and blue–yellow sets use Okabe-Ito colours; telegraphs also differ by shape.
  - Sprint and aim toggles.
  - At 130% text the main-menu dossier drops its decorative map strip and is capped at the screen height, scrolling inside if needed. Before this it ran past the bottom of the screen.
- **Audio** (synthesised only, no new files):
  - per-class shot layers;
  - a counter-shot tone;
  - a rising tone for chained flows;
  - a "PERFECT FLOW ×n" toast.
- **Squad order** binding: T, or left stick click. It is rebindable and shown on the controller layout.

## 4. Tests

### 4.1 Results

All runs on the final working tree, Windows 11, Node 24.18.

| Suite | Baseline (audit, `f8fb38c` + Holdout work) | Final |
|---|---|---|
| `npm test` | 175 checks + campaign replays, pass | **206 checks + 8 campaign replays, pass** (core 45, progression 26, co-op 15, squad 19, support 21, arsenal 19, holdout 22, quality 31, net 8) |
| `npm run test:browser` | 21/22 (controller "Y SWAP" failing) | **22/22** |
| `npm run test:resilience` | 2/3 (armory controller actions failing, also on the original commit) | **3/3** |
| `npm run test:e2e` (two Electron instances, real LAN) | pass | **pass** |
| `npm run test:e2e:squad` (three instances, TDM) | pass | **pass on the second run.** The first run timed out waiting to observe a guest's 0.4 s roll on the host (`e2e-squad.cjs:147`). Intermittent timing, see §7. |
| `npm run test:relay` | pass | **11/11 pass** |
| `npm run verify` | pass | **pass** (172 static files) |
| `npm run test:tactical` (optional, not in `npm test`) | **fails** (bot dies on THE CRASH Insane, stage 1, 55 s) | **fails** (see §7) |
| Browser validation script (scratch, real clicks) | — | **29/29** |

Not run:
- `test:e2e:online` (needs the hosted relay);
- `verify:package` and `test:packaged` (need a packaged Windows build, which was not produced; a build was not part of this task).

### 4.2 New coverage

`blackout/tests/quality.cjs` adds 31 checks:
- **contracts and corpses:**
  - eligibility, swap and refresh;
  - pruning only of spawned dead; authored dead kept; TDM untouched;
- **weapons:**
  - each trait in isolation, against the real damage rules;
  - weapon invariants: every gun for sale beats the free one at something, and the legendary pair out-damages it;
- **perks:** all five extensions, including the Flow State cap;
- **seeded challenges:** determinism, the attempt rules, deduplication, the save round trip, and separation from ordinary Holdout records;
- **mutators and rewards:** each mutator's effect and its pay; operation challenges paid once; the S rule;
- **squadmates:** dodges and a roll through a blast; the bot evasive roll;
- **TDM:** hearing-limited hunting and the scaling clock.

Updated deliberately, never weakened:
- **core:** Insane damage ≥ 1.45× Standard and above High Intensity (was a hard-coded > 1.7×).
- **support:** the Ambusher dummies use stagger 0, since a staggered dummy is now "helpless"; helpless cases added.
- **browser:**
  - 18 bound keys (was 17), and the rebinding test uses the free key Y because T is now the squad order;
  - the left-stick call-out text;
  - THE CRASH kill count 17 (was 15).

### 4.3 Real-input playtests (scripted keyboard and mouse, headless Chromium)

| Run | Result |
|---|---|
| THE CRASH, Standard | Completed in 53.5 s (sim). 17 kills, 29 damage taken, rating A, no flows. The debrief showed "S: take less damage, beat par, chain flows". 3,006 CR and rank 2. |
| THE CRASH, Insane, standing still | Dead in 4.9 s. The death screen shows the killer tip ("Taken down by a rusher…") and the Insane line on separate lines. Retry 117 ms. |
| Holdout solo, Standard | Wave 6, 47 kills, 67% accuracy, max 9 hostiles alive, min 57 FPS, no errors. |
| Holdout with AI partner, Standard | Wave 12, 115 kills, max 17 alive, min 57 FPS, no errors. Waves 5 and 10 were red waves; died to a juggernaut on 13. |
| Team deathmatch, 4v4 killhouse, scripted player plus 7 AI | Won 30–24 in 1:58: 12 kills and 5 deaths for the pilot. About 27.5 kills a minute (the audit run: 30–26 in 1:34, about 35.7). Min 57 FPS, no errors. |
| Challenge, board, mutators, settings, Bootcamp, HUD at three sizes | 29/29 checks, no console errors. |

The pilot is a script, not a person: it does not slide or vault and aims perfectly once it sees a target. Treat these runs as checks that everything works end to end, not as difficulty data.

## 5. Performance and pacing measurements

**Long Holdout session** (`holdout-sim`, same seed, to wave 16):

| Measure | Before | After |
|---|---|---|
| Entries in `s.enemies` | 174 | 17 |
| Mean simulation step | 0.010 ms | 0.006 ms |
| Kills | 265 | 265 (identical) |

The FPS in the real-input runs stayed at 57–61 in headless software rendering, as at the audit.

**Holdout survival** (8 seeded runs, AI pilot, with partner):
- median wave 11 on Standard and 9 on High Intensity;
- solo with the free MK18, median wave 5;
- the per-weapon medians are in the balance doc.

**Team deathmatch kills per minute** (all-AI matches, 4v4):

| Map | Before | After |
|---|---|---|
| Killhouse (small) | ~30 | ~23 |
| Large maps | ~25 | ~17–20 |
| Killhouse, real-input run (§4.3) | ~35.7 | ~27.5 |

The audit's target was 6–10. All-AI matches are faster than human ones will be, because bots aim consistently. Human matches are the real test. The levers are `TDM.dmg`, `TDM.respawn` and the bot hearing range, all in `core.js`.

## 6. Deferred or not done, and why

| Item | Why it was not done | Suggested next step |
|---|---|---|
| Name and voice rights | Excluded by instruction; external legal blockers | Resolve before any release |
| Act III | Large content job, high risk; the audit offered "reframe as a prologue" as the alternative | Decide on scope after human playtests |
| Per-guest perks, field support and vault for LAN squadmates | Needs a per-operator context like TDM's `act()` threaded through `stepMate`, `credit()` and the support code; risky to change late | Port the TDM operator context to Holdout co-op |
| TDM pace target (6–10 kills a minute) | Measured only with bots; not met by bots | Tune against human matches |
| Combat music layers | No licensed music stems; no new assets by instruction | Commission or license stems, then layer on red waves and bosses |
| New weapon sound samples | No new or uncertain-licence audio by instruction; synthesised layers added instead | Record or license per-class sets |
| Boss art | Art production | — |
| Online leaderboards, achievements, cloud saves | Needs the name settled and a platform | Steamworks after rename |
| Code reformatting | Low-risk but large; not mixed into a feature change | A separate formatting-only commit under the full test suite |
| QA screenshots in `blackout/qa/*.png` | They show the pre-change look; browser runs regenerate them, and they were restored each time to avoid churn | Regenerate in a dedicated commit |

## 7. Bugs found and fixed during the work

Found while implementing:
- **Veterans in the campaign silently off:** `create()` reset `s.waveD`, wiping the Veterans mutator's rules. Removed the reset.
- **Skewed challenge picks:** they used the generator's low bits. Switched to the high bits.
- **Restartable daily:** a restart could dodge the first-attempt rule. Attempts are now counted when the run starts.
- **Wrong global in `game.js`:** five references to `World.mutators`, where only `BPWorld` exists.
- **Settings selects not wired:** they did not save until added to the change-listener list.
- **Challenge banner hidden:** the generic Holdout banner covered it.
- **Armory panel overflow:** the detail panel hid its action buttons on short screens.

Found during final validation:
- **CRASH grenadier pulled the pilot into a snag:**
  - The new `a5` grenadier at (1520, 1320) stood just south of a low barrier. The keyboard-and-mouse pilot chased it there and caught on the barrier's corner on the way back.
  - Moved it to (1600, 1180), north of the barrier, where it covers the cache from behind it.
  - The campaign replays, the browser suite (22/22) and the real-input run were re-checked after the move.
- **Intermittent squad e2e timeout** (`e2e-squad.cjs:147`):
  - The test waits 4 s to see a guest's 0.4 s roll on the host over a real socket. It failed once, then passed on the rerun.
  - The squadmate dodge change does not affect TDM operators, which are stepped by `stepVersus`.
  - Left as is and reported. It needs a longer or event-based wait if it recurs.
- **`test:tactical` still fails:**
  - **Before:** the cover model died in stage 1 at 55 s.
  - **After:** it survives stage 1 but stalls. Its rule "health under 35 means hide" has no way out once its stims are gone, because it only looks for health when it is not hiding.
  - With that rule changed in a scratch copy, it clears stage 1 and dies in stage 2 on Insane, and wins on High Intensity with 93 HP. The test file was left as it was.
  - Insane completion by a human remains unverified.

## 8. Save compatibility

- **Format:** still version 3. Every new field is additive, with a default:
  - `challenges`;
  - `missions[id].opChallenge`;
  - `settings.textScale`, `palette`, `sprintMode` and `aimMode`;
  - the `order` key and pad bindings.
- **Old saves:** a pre-change version-3 save decodes with its credits, guns and missions intact and picks up the defaults. Version 1 and 2 migration are unchanged and still covered by the core tests.
- **Validation:** challenge records are checked on load. The score is recomputed from its parts, duplicates are dropped, the board is cut to ten per kind, and keys are checked against a pattern, so a hand-edited save cannot stand.
- **Downgrade:** an older build ignores the new fields.

## 9. Files

**Modified:**
- `blackout-protocol.html`
- `package.json` (adds `quality.cjs` and `holdout.cjs` to `npm test`)
- docs:
  - `blackout/GAME_DESIGN.md`
  - `blackout/TEST_REPORT.md`
  - `docs/BLACKOUT_GAMEPLAY_PLAN.md`
- game code in `blackout/`: `audio.js`, `core.js`, `game.js`, `icons.js`, `meta.js`, `missions.js`, `render.js`, `save.js`, `style.css`, `world.js`
- existing tests in `blackout/tests/`: `browser.cjs`, `core.cjs`, `progression.cjs`, `support.cjs`

**New:**
- `blackout/tests/quality.cjs`
- `blackout/tests/holdout.cjs` (from the Holdout redesign earlier in this session)
- `blackout/qa/weapon-report.cjs`
- `blackout/qa/holdout-sim.cjs`
- `docs/BLACKOUT_BALANCE.md`
- `docs/BLACKOUT_PROTOCOL_GAME_AUDIT.md`
- `docs/BLACKOUT_IMPROVEMENT_REPORT.md` (this file)

**Unchanged:**
- all voice files and other assets;
- the game's name and branding;
- Electron networking code.

## 10. What human players should test next

1. **First session.**
   - Do new players do Bootcamp, and do they reach a perfect flow in THE CRASH?
   - How long does THE CRASH take a person?
2. **Readability.** A blind test with 3–5 people: name the hostile type from a screenshot of a crowded wave, with and without the badges.
3. **Holdout:**
   - the wave reached and the cause of death for 5–10 players;
   - the design goal is waves 6–12 for average players.
4. **Weapons:**
   - Do players notice and use counter-shots, suppression and the MP7's slide bonus?
   - The balance doc lists what to watch.
5. **Insane:** can a skilled player finish THE CRASH? The bots cannot.
6. **Team deathmatch with people:** kills per minute on small and large maps, against the 6–10 target.
7. **Accessibility:** colour-blind players on each palette, and text size at 130% on a 1280×800 laptop.
8. **LAN co-op:** a guest's roll and dive in a real Holdout match over Wi-Fi.

## 11. Follow-up changes after review

Made after this report was first written, at the project owner's request.

- **Challenges moved out of the Holdout lobby.** The lobby is back to the operator, the open co-op slot and the records. The daily and weekly challenges now open from a CHALLENGES button by the daily contracts on the main menu, into a panel that slides in from the right with the full detail and the local board.
- **Leaving a hosted or joined lobby** (LEAVE LOBBY, Escape or B) now returns the player to their own Holdout lobby, not the main menu. `electron/net/packaged-smoke.cjs` was updated to expect this; it was not run, because it needs a packaged build.
- **Campaign cards and the briefing** show each operation's map, reusing the killhouse screenshots.
- **Intel** (new): an armory tab with a file on each of the 25 hostiles that can be met.
  - **Look:** files are graded grey to red by threat. Portraits are rendered from the game's own sprites.
  - **Unlocking:** a hostile never met shows as a silhouette in its grade's colour. Its file fills in as it is sighted, studied (one kill) and completed (a set number of kills), and completion pays once.
  - **Older saves** are back-filled from the progress they already have.
  - **Tests:** `blackout/tests/intel.cjs` (7 checks, in `npm test`).
  - **Not filed:** three soldier types defined in `world.js` (assault, pointman, sharpshooter) never spawn anywhere, so they have no file.

## 12. New content: combat modes and Act III

**Six new combat modes** in the shared lobby, chosen from a picker grouped into co-op and versus (details in `blackout/GAME_DESIGN.md`):
- **Versus:** Arms Race, Uplink, Hunted and Breach. They run on the Team Deathmatch engine with rules of their own (`VERSUS` in `core.js`), so seats, AI, LAN play, the scoreboard and pay carry over.
- **Co-op:** Extraction and Flow Trials. They run on the Holdout engine with a stage of their own. Flow Trials save the best run on a course as a ghost to race.
- **Mutators:** Night Ops, Sidearms Only and Scarcity can be applied to versus matches.
- **AI:**
  - Bots now pursue each mode's objective: relays, the breach site, the hunter's hunt-and-fade, and keeping a squad together.
  - All bots can now free themselves when stuck on a tight corner. This also fixes a bot stall in team deathmatch.
- **Balance with bots:**
  - **Hunted:** the hunter wins about half its rounds against three or four AI squadmates, and about 80% against two.
  - **Breach:** all-AI matches run 4 to 6 minutes with every kind of round win.
- **Pictures:** each mode has its own lobby picture, captured from play (`blackout/qa/mode-shots.cjs`).

**The campaign is complete at three acts of nine operations.** Act III / The Truth adds:
- **REDLINE:** escort Lark.
- **CITADEL:** two routes in, three pylons, the Havoc tank, the lift.
- **BLACKOUT:** the reactor, then Colonel Voss.

What Act III brings in:
- **Engine:** an escort mechanic, a new final boss built from existing mechanics, and two new map themes (rain, citadel).
- **Hostiles:** first campaign use of the three Halcyon special-forces types, which now have Intel files (29 files in all).
- **Maps:** three new killhouses for Holdout and versus play.
- **Economy:** three new operation challenges. The armory pacing estimate stays inside the agreed band at 18.2 hours.
- **Ending:** GHOST SIGNAL's "Act III is in development" outro has been replaced. BLACKOUT ends the story.

**Tests:**
- New: `blackout/tests/modes.cjs` (11 checks).
- The campaign replay suite now plays all nine operations; Act III runs with the upgrades a player has by then.
- Updated deliberately for the new content:
  - the locked operation and killhouse counts in `browser.cjs`;
  - Intel's file total;
  - the quality check that said team deathmatch takes no mutators.
- Each of the three Act III operations was also replayed without upgrades and completes.
- **Not yet tested over a real network:** the four new versus modes and Extraction with a LAN guest. Their objective state is sent in the snapshot, but only team deathmatch and holdout have end-to-end network tests.
