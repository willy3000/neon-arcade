# Blackout Protocol — Game Quality Audit

*Audit date: 14 October 2026. Read-only audit: no source, asset, configuration, balance or save files were changed. Playtest scripts and screenshots were kept outside the project.*

---

## 1. Executive Summary

**Overall assessment: 6.6 / 10.** Blackout Protocol is a well-engineered, good-looking top-down military shooter. Its controls are excellent and its systems run deep. Its weak spots are content volume, build variety and a distinctive identity. It is better than most hobby projects and close to a solid indie release in how it feels to play. It is not yet a game that clearly beats its genre on value, variety or memorable identity.

**Current state.** Four playable modes:
- A six-operation campaign (Acts I–II; Act III is not built).
- Holdout (endless waves, recently reworked).
- Four-a-side Team Deathmatch with AI or LAN players.
- A training range.

Around these sit an armory economy with five rarity tiers, ranks, weapon mastery, kit parts, perks, field support, daily contracts, career challenges and an animated debrief. The game launched without a single console error in any of the 7 browser sessions run for this audit. Input latency, measured end to end, is excellent.

**Biggest strengths**
1. **Controls and movement.** About 19 ms from key press to movement, about 11 ms from click to first shot, and a real movement kit: slide, vault, roll, dive, the "perfect flow" chain and stamina.
2. **Readable, telegraphed combat.** Wind-up lines, sniper lasers, grenade and mortar rings, damage-direction arcs. Deaths come from position and timing.
3. **Presentation.** A coherent "classified dossier" visual language, a strong animated menu, an atmospheric intro film and a satisfying debrief.
4. **Systems depth for its size.** Many interlocking reward loops, a deterministic 120 Hz simulation, and about 190 automated checks.

**Biggest weaknesses**
1. **Not enough campaign.** Six operations; a scripted bot clears all six in about 11 simulated minutes, and THE CRASH took it 56 seconds with an S rating. A human will likely finish the campaign in under about 90 minutes (estimate).
2. **Weapon progression is mostly sidegrades.** The free starting MK18 has equal or higher sustained damage than eight weapons that cost up to 85,000 CR. The armory's prices promise power it does not deliver.
3. **Enemy readability.** Most soldiers share one tinted sprite, and corpses are dim copies of the same silhouette that never leave the map in Holdout.
4. **Commercial blockers not about gameplay** (from the project's own release report): the name collides with an existing Steam game, and most voice lines are AI clones of a recording of unknown origin.

**Most important next steps**
1. Clear the name and voice-rights blockers before any store spend.
2. Make weapon tiers mean something, by giving each gun a clear role rather than more damage.
3. Fix enemy and corpse readability.
4. Put the reworked Holdout in front of human players.
5. Plan content, either Act III or a repeatable mission structure.

**Commercial readiness:** ready for closed external playtesting; **not ready for a paid release.**

---

## 2. Audit Methodology

### Version audited
- Branch `blackout-protocol-windows` at commit `f8fb38c`, **plus uncommitted working-tree changes**. These are a substantial Holdout rework (new enemies, red waves, boss rotation, AI partner rewrite, new supply crates) made earlier in this same session by the auditor at the owner's request.
- **Conflict of interest:** I wrote those Holdout changes. I have tried to judge them as critically as everything else. They have **not yet been played by a human**, which lowers confidence in the Holdout-related judgements.

### Environment
- Windows 11 Pro, Node v24.18.0, Playwright 1.58.2 with headless Chromium, at 1366×768 unless noted (1280×800 and 1920×1080 also tested).
- Headless Chromium renders with software WebGL. **FPS figures below say nothing about real GPUs.**
- No speakers were monitored. **Audio was judged from the code, not by listening.**

### Systems and files inspected
| Area | Files |
|---|---|
| Simulation (movement, combat, AI, director, Holdout, bots, TDM) | `blackout/core.js` |
| Data tables (22 weapons, 17 gadgets, 8 field supports, 9 perks, 7 upgrades, 29 enemy archetypes, difficulties) | `blackout/world.js` |
| Levels (6 operations, 7 killhouses) | `blackout/missions.js` |
| Economy, ranks, contracts, challenges, debrief | `blackout/meta.js` |
| Save and versioning | `blackout/save.js` |
| UI flow, HUD, lobby, networking, input | `blackout/game.js` |
| Rendering | `blackout/render.js` |
| Sound | `blackout/audio.js` |
| Menu and intro | `blackout/menu-scene.js`, `blackout/intro.js` |
| Desktop shell, LAN, relay | `electron/`, `server/` |
| Project docs | `GAME_DESIGN.md`, `TEST_REPORT.md`, `docs/RELEASE_READINESS_REPORT.md`, `docs/BLACKOUT_GAMEPLAY_PLAN.md` |

### Methods
1. **Seven scripted browser sessions** using real keyboard, mouse and (stubbed) gamepad events. They are described in §2a.
2. **Deterministic simulation runs:**
   - The existing campaign replay bot across all six operations.
   - A Holdout balance harness.
   - A simulation CPU benchmark.
   - A weapon DPS/TTK calculation from the data tables.
3. **The existing test suites.** `npm test` passes: 175 checks plus campaign replays. The browser suite `npm run test:browser` fails one pre-existing check: the controller test's "Y SWAP" label in Training fails identically on the original commit.

### 2a. Playtesting evidence

**Did the game launch?** Yes, every time, as a web page served locally (the same build the Electron shell serves).

**Controls used:** real keyboard and mouse events through Playwright, and a stubbed standard-mapping gamepad (D-pad, A/B, sticks, RT). The "players" were scripted. **No human played during this audit.** Feel is judged from measurements, recordings and screenshots, not from a person's hands.

**What was played**

| Session | What | Result |
|---|---|---|
| S1 First launch | Fresh profile → menu → ops board → armory (all tabs) → settings → lobby (Holdout and TDM) → Training → pause → exit; then a gamepad-only pass | Loading screen gone within 2.5 s locally. 0 console errors. Gamepad D-pad moved focus logically (Campaign → Training → Combat Modes → Campaign → Armory); A launched Training; left stick moved and RT fired. |
| S2 Intro + campaign | Intro film (`?intro`), THE CRASH on Standard with the existing real-input bot, debrief, back to menu; THE CRASH on Insane standing in the open; retry | Intro holds on the emblem until a press. CRASH cleared in **56 s, S rating, 15 kills, 18 damage taken**; first clear paid **3,233 CR** and rank 2. On Insane, walking into the open killed Rook in **2.8 s**. Retry → playing in **0.13 s**. |
| S3 Feel measurements | Walk, sprint, slide, roll, fire, reload, swap, stamina in Training, sampled every frame | See §4C. |
| S4a Holdout solo | Standard, default kit, scripted player buying basics | **Survived 9 waves**, killed by a rifleman on wave 10 (6:08, 138 kills, ×27 best combo, 4,565 CR including contracts). |
| S4b Holdout + AI partner | Same, AI teammate in the open slot | **Survived 9 waves**, killed by the Warden on red wave 10 (4:51). |
| S4c Team Deathmatch | 4v4 with seven AI, first to 30 | **Won 30–26 in 1:34.** Scripted player 12 kills, 6 deaths. |
| S5 Text and layout | Menu, ops board and HUD at 1280×800, 1366×768, 1920×1080 | No visible text under **13 px**; no horizontal overflow. |

**Not tested, and why**
- Operations 2–6 were **not played in the browser**. They were completed only by the deterministic simulation bot.
- **LAN and online co-op:** needs two machines or the relay; not attempted.
- **The packaged Electron build:** not launched; the browser build is the same code.
- **A physical controller:** stubbed only.
- **Audio by ear.**
- **Real GPUs, the Steam Deck, Linux.**
- **Human players' learning curve and frustration.**

**Most important firsthand observations**
1. The game is responsive and stable. Nothing crashed, no console errors, and every restart was instant.
2. The first operation is very short and easy for a competent player.
3. Holdout now has a felt difficulty step at red wave 10. Both scripted runs ended there, one to the boss and one to a rifleman during it.
4. TDM on the Killhouse is extremely fast: about 19 kills a minute across 8 operators.
5. Corpses pile up on the Holdout map and are visually close to live soldiers.
6. Daily contracts ask fresh players for things they cannot do yet ("25 kills with submachine guns" at rank 1, where SMGs are locked until rank 4).

---

## 3. Scorecard

| # | Category | Score | Confidence | Justification |
|---|---|---|---|---|
| A | UI/UX and presentation | **7.0** | High | Cohesive, attractive and controller-navigable. A few HUD overlaps, no text scaling or colour-blind options, and contracts that cannot be completed. |
| B | Core gameplay and game feel | **7.0** | Medium | Excellent responsiveness and telegraphed combat. The opening campaign is too short and easy; Insane can be instantly lethal. |
| C | Movement and player control | **7.5** | High | Measured latency is excellent; slide/vault/roll/dive and flow chains give real skill expression. |
| D | Weapons, combat options, builds | **6.0** | High | 22 guns, several with genuinely distinct mechanics. The free rifle out-performs most paid guns; tiers promise power that isn't delivered. Perk synergies are thin. |
| E | Enemies, AI, encounter design | **7.0** | Medium | 29 archetypes with clear roles and telegraphs, mechanical bosses, a new tactical layer in Holdout. Visual sameness hurts readability; campaign AI is simpler than Holdout's. |
| F | Progression and motivation | **6.5** | Medium | Many loops and a good debrief "NEXT" goal. Front-loaded payouts, contracts ignore what you own, and the campaign runs out fast. |
| G | Content depth and replayability | **6.0** | Medium | 6 operations and 7 maps reused across modes, Holdout and TDM give replay. Act III is missing; no procedural or seeded variety in the campaign. |
| H | Animation, VFX, polish | **6.5** | Medium | Strong feedback layering (shake, hit-stop, slow-motion, particles, flashes). Character animation comes from a shared CC sprite set; enemies differ mainly by tint; vector bosses are functional rather than impressive. |
| I | Audio and sound design | **5.5** | Low | Sensible implementation (pooling, attenuation, pan, a crafted distant-battle mix). Small sample set re-pitched across many guns, no combat music, and the voice has unresolved rights. Not heard. |
| J | Skill ceiling and mastery | **7.0** | Medium | Flow chains, dodge timing, combo bounties, S ratings, Insane, Holdout wave records. No leaderboards or score attack to show mastery. |
| K | Technical quality, performance | **7.5** | High | Deterministic simulation under 0.4 ms per frame, zero errors in all sessions, a strong test suite. Holdout corpses accumulate without limit; the code is dense; one browser test fails. |
| L | Retention, commercial potential | **5.5** | Low–Medium | Strong first impression. Limited content, a name collision, voice rights and no platform hooks (achievements, cloud saves) hold it back. |

### Overall: **6.6 / 10** (weighted)

| Weight | Categories | Why |
|---|---|---|
| 15% | B Core gameplay | Whether it is fun decides everything else. |
| 10% each | D Weapons/builds, E Enemies, F Progression, G Content | These decide whether players keep playing. |
| 8% each | A UI/UX, C Movement | |
| 7% | J Mastery | |
| 6% each | H Visual polish, K Technical | |
| 5% each | I Audio, L Commercial | L is largely an outcome of the others, so it is weighted low to avoid double counting. |

The calculation: (7.0×15 + 7.0×10 + 7.5×8 + 6.0×10 + 6.5×10 + 6.0×10 + 7.0×7 + 7.0×8 + 6.5×6 + 7.5×6 + 5.5×5 + 5.5×5) / 100 = **6.64**.

Technical quality and presentation are the game's best areas, but they carry only 14% together, so they cannot hide the content and build-variety gaps.

---

## 4. Detailed Category Assessments

### A. UI/UX and Presentation — 7.0 (High confidence)

**Evidence**
- *Observed (S1, S5):* the menu, ops board, armory, lobby, debrief and pause screens share one typographic system: Barlow Condensed for titles, IBM Plex Mono for labels, an amber/olive palette.
- *Observed:* minimum rendered text is 13 px at all three tested sizes. The release report's "6–8 px labels" note is out of date.
- *Observed:* gamepad D-pad navigation moved focus in a sensible spatial order, and A activated the focused card.
- *Observed:* the HUD shows health, armour, stamina, equipment counts with icons, weapon and ammo, the alternate weapon, the objective with hint, a minimap and a clock.
- *Observed:* the debrief tallies lines, XP, rank-ups, contracts and a "NEXT · YOU CAN AFFORD THE SCROUNGER · 2 RANKS TO ARMORY TIER 2" goal line, which is excellent.
- *Verified in code:* settings cover pressure, volume, music, voice, camera shake, reduced flash, visual detail, controller toggle, aim assist, and full key and button rebinding with a picture (`game.js` `bindings()`).

**Strongest aspect:** a visual identity that feels deliberate and premium for an indie game, carried consistently from the menu to the debrief.

**Weakest aspect:** small clarity failures that add up:
- *Observed:* the Training controls strip runs across the objective line (S1 screenshot).
- *Observed:* the NEW THREAT banner sits over the boss bar.
- *Observed:* weapon pickup labels overlap other labels.
- *Observed:* the Insane death screen reads "Insane punishes open ground… A forgiving first night." Two pieces of copy are joined.
- *Observed and verified:* daily contracts are chosen by date alone (`contractsFor(day)` in `meta.js`). A rank-1 player is told to get "25 kills with submachine guns" with no SMG available.

**Accessibility gaps (verified absent):** text scaling, colour-blind modes (enemy versus ally relies on red/amber/blue), a hold-to-toggle option for sprint or aim, and difficulty sub-options such as aim assist on mouse or slower enemies on their own.

**Top improvements**
1. Filter daily contracts to what the player owns and can do. Low effort, removes an early frustration.
2. A HUD layout pass: reserve a lane for banners so they never cover the boss bar or objective; move the Training controls strip.
3. A text-size slider and a colour-blind palette for the enemy/ally/telegraph colours.

### B. Core Gameplay and Game Feel — 7.0 (Medium confidence)

**Evidence**
- *Measured (S3):* key to first movement about 19 ms; 66 ms to 90% speed; about 134 ms to stop; mouse to first round about 11 ms; swap about 10 ms.
- *Verified:* the 120 Hz fixed-step simulation (`core.js` `step`, DT 1/120); enemy attacks always telegraph with a wind-up (`stepEnemies` → `telegraph` events, drawn in `render.js`).
- *Observed (S2):* THE CRASH was cleared in 56 s with an S rating and 18 damage taken by a bot that never slides or rolls.
- *Observed:* on Insane, Rook died in 2.8 s after stepping into the open.
- *Observed (S4):* Holdout escalates from about 20 s per wave early to about 45 s at waves 9–10; both runs ended at red wave 10.

**Strongest aspect:** combat is honest. Every dangerous attack is visible before it lands, and the player's tools answer the threats: roll invulnerability windows, smoke, flashbangs, EMP, cover.

**Weakest aspect:** the first impression undersells the game.
- The opening operation is over in a minute or two for a competent player and demands nothing of the movement kit.
- The difficulty jump between Standard and Insane is very large: Standard was cleared with 18 damage, while Insane killed in seconds.
- High Intensity sits between them but was not completed by a human here.

**Top improvements**
1. Re-pace THE CRASH so it needs one slide/vault escape and one cover fight before extraction. That shows off the best mechanic in the first five minutes.
2. Smooth the Insane wall: keep its tactical rules but lower its damage multiplier (×1.85) or post-hit protection, and let skill decide.
3. Add a 'Veteran' setting between High Intensity and Insane, or per-modifier difficulty toggles.

### C. Movement and Player Control — 7.5 (High confidence)

**Measured (S3, real input, per-frame sampling)**

| Action | Result |
|---|---|
| Walk | top speed about 270 px/s, reaches 90% in about 66 ms, stops in about 134 ms after release |
| Sprint | about 395 px/s, drains 12 stamina per 0.9 s; short sprints never ran the bar dry in 6.5 s of alternating sprints |
| Slide (from sprint) | 683 ms, peak about 512 px/s |
| Roll | 383 ms, about 152 px |
| Reload (MK18) | 1.63 s |

*Verified:* invulnerability windows on roll (0.055–0.25 s) and dive (0.07–0.28 s); "perfect flow" for a slide into a vault, a slide kill, a knife out of a dive, and a dodge through an attack, which refunds stamina (`core.js` `flow`, `damagePlayer`). Aiming slows to 175 px/s and tightens spread; walking while firing is allowed, sprinting while firing is not.

**Strongest aspect:** responsive, weighty-but-not-floaty movement, with a real skill layer of flow chains and timed dodges that is rare in top-down military shooters.

**Weakest aspect:**
- Movement skill is barely needed in the campaign's opening and is taught only in part. Bootcamp covers move, sprint, slide, vault, fire, reload, swap and gadget, but not roll, dive, knife or reading telegraphs.
- AI and LAN squadmates have a reduced kit (no slide, roll, dive or vault), so co-op partners move worse than the host.

**Top improvements**
1. Add roll/dive-through-a-telegraph and knife steps to Bootcamp, and a "flow" challenge in the first operation.
2. Give LAN squadmates the full movement kit. In co-op this is a fairness issue.
3. Show the stamina cost on the bar before a roll or dive is refused.

### D. Weapons, Combat Options and Build Variety — 6.0 (High confidence)

**Evidence: sustained DPS per weapon, from `world.js`** (magazine-limited, reload included; per-hit damage before modifiers)

| Weapon | Price | Sustained DPS | Notes |
|---|---|---|---|
| M134 minigun | challenge | 274 | spin-up |
| XR-9 pulse | 60,000 | 229 | pierce 1 |
| M249 LMG | 6,500 | 208 | |
| AS-12 auto shotgun | 12,000 | 191 | 430 range |
| KV-15 battle rifle | 4,500 | 171 | |
| **MK18 rifle (free)** | **0** | **150** | |
| ARC-7 rail | 85,000 | 150 | pierce 6, breach |
| MP7 | 1,600 | 138 | |
| RX-4 ricochet | 5,500 | 125 | bounce |
| FR-9 burst | 2,600 | 116 | |
| SVK-9 marksman | 2,000 | 109 | |
| TESLA-3 arc | 16,000 | 105 | chain |
| M110 precision | 6,000 | 94 | pierce 2 |
| M32 launcher | 15,000 | 77 | blast |

**What works**
- Several guns have a genuine rule of their own: burst, ricochet, flame that leaves fire, minigun spin-up, chain lightning, a rail that passes through cover, blast weapons that stagger bosses.
- The gadget list (17) is broad and tactical: smoke blocks sight, EMP kills drones and drops shields, decoys pull fire, the trophy system stops grenades, the grapple is a mobility tool.
- Kit parts and mastery give per-gun goals.

**What doesn't work**
- **The free MK18 matches or beats eight paid guns on sustained damage**, including the 85,000 CR ARC-7. The price ladder (600 → 85,000) reads as a power ladder, but it is mostly a list of sidegrades.
- The XR-9 at 60,000 CR is only about 10% above an M249 at 6,500. Expensive legendary items risk feeling like a scam unless their role is unique.
- Perks (9, one per slot) are mostly independent bonuses. Few combinations create a build identity. Flow State + Executioner + the knife is the one that clearly does.
- Only the lobby leader has perks and field support in campaign and Holdout co-op (`GAME_DESIGN.md`, "In the campaign and holdout only the lobby leader carries field support and perks"), so a second player's choices matter less.

**Top improvements**
1. Give each weapon class a clear role with a trade-off rather than a DPS tier. For example, precision rifles headshot or one-shot unaware enemies, LMGs suppress (slow enemy wind-ups), SMGs reward the sprint-slide kit. Re-price legendaries against their role.
2. Add 3–4 perks that interact with other systems ("kills during a slide refill a gadget charge", "suppressed enemies take +X%"), so loadouts form builds.
3. Give the second operator in co-op their own perks and support.

### E. Enemies, AI and Encounter Design — 7.0 (Medium confidence)

**Evidence**
- *Verified:* 29 archetypes in `world.js`. Riflemen, rushers, scouts, breachers, shields (frontal armour), grenadiers (lob with ground rings), marksmen (laser telegraph), machine gunners, rocketeers, sentries (flank or EMP), cloaked ghosts, bomb drones, elites; in Holdout also medics (revive), mortar teams (blind fire on spotted targets), spotter drones (mark through walls), juggernauts, engineers (build sentries) and jammers (shut off support). Campaign bosses: Wraith, Bulwark, Warden; Holdout adds the Havoc tank.
- *Verified:* the Insane rules: path-field hunting, suppressing fire, grenades against campers. Holdout's threat levels add cover peeking, flanking, pressure during reloads and flashbangs (`pressureFor`, `coverFor`, `flank` in `core.js`).
- *Observed (S4):* deaths came from different sources (a rifleman, the Warden). The new-threat cards and death-screen tips appeared.

**Strongest aspect:** every enemy has a role and a counter, and each counter is in the player's kit (EMP for drones, sentries and shields; flank shields; explosives for armour).

**Weakest aspect: readability.**
- *Observed:* most soldiers are the same character sprite with a colour tint and small overlays. At normal zoom in a busy wave they are hard to tell apart.
- *Observed:* corpses are drawn as darker, semi-transparent copies of the same silhouette.
- *Measured:* in Holdout dead enemies are never removed (`s.enemies` reached 238 entries by wave 17 in a simulation), so the field fills with silhouettes.
- *Verified:* the smarter cover and flanking behaviour is limited to Holdout. Campaign enemies use the older simpler AI on purpose (a comment in `stepEnemies`).

**Top improvements**
1. A silhouette pass so each role reads at a glance: distinct shapes for the heavy, shield, medic, rocketeer and grenadier (backpacks, helmets, scale), plus an icon over elites and vets.
2. Fade and remove corpses after a few seconds in Holdout, and make corpses visually distinct (flat, desaturated, no weapon).
3. Port the threat-level AI (cover peeking and flanking) to the later campaign operations at High Intensity and above.

### F. Progression and Player Motivation — 6.5 (Medium confidence)

**Evidence**
- *Observed (S2):* the first clear of THE CRASH paid 3,233 CR: mission, bounties, S rating, no deaths, first clear, three medals and the daily bonus. That means rank 2 and the shotgun and frag unlocked from the story cache.
- *Observed (S4a):* a six-minute Holdout run paid 4,565 CR including two contracts.
- *Verified (`meta.js`, `economy-report.cjs`):* armory tiers at ranks 1/4/7/10/15; about 13 hours to own everything except the legendary pair and about 8 more for those (the project's own estimate); weapon mastery at 20/60/150 kills; three kit parts per gun; ten career challenges; three daily contracts; daily streak.
- *Observed:* the debrief's "NEXT" line always names a concrete next goal.

**Strongest aspect:** layered short-, medium- and long-term goals (contracts → rank and tier → mastery and kit → challenges → legendary weapons), shown clearly at the end of every run.

**Weakest aspect:**
- **The rewards are mostly sidegrades** (see D), so the long grind for power has weak payoff.
- **The campaign, which carries the story motivation, runs out within an evening.** The narrative hook in the debrief ("The missile came from your own side… who gave the order?") is strong, but Act III does not exist.
- **Contracts can't always be completed,** and the medal set is identical for every operation.

**Top improvements**
1. Contract filtering, plus one contract that rotates between modes (campaign, Holdout, TDM).
2. Operation-specific medals or challenges ("finish NO SAFE GROUND without the generator going down") so replays have their own goals.
3. Tie legendary items to challenges (as the minigun and flamer already are) rather than only to very large credit costs.

### G. Content Depth and Replayability — 6.0 (Medium confidence)

**Inventory (verified)**
- **6 operations:**

  | Operation | Stages | Authored enemies |
  |---|---|---|
  | THE CRASH | 5 | 11 |
  | NO SAFE GROUND | 4 | 25 |
  | DEAD FREQUENCY | 5 (including the Wraith boss) | 22 |
  | UNDERGROUND | 5 | 18 |
  | IRON CONVOY | 4 (including the Bulwark) | 19 |
  | GHOST SIGNAL | 5 (including the Warden) | 20 |

- **7 killhouse maps** for Holdout and TDM (the default one plus one per operation).
- **4 difficulties,** 4 wave modifiers, Holdout's red waves and boss rotation, TDM with 1–4 per side and a kill limit from 5 to 75.

**Estimated time to exhaust content** (assumptions stated):
- **Campaign.** The bot's total is 11 simulated minutes; assuming a human takes 3–5× as long with retries and reading, that is about 35–60 minutes for one Standard pass.
- **Campaign replays.** Medals and higher difficulties add perhaps 2–4 hours for a completionist.
- **Holdout.** Probably the longest-lived mode now: the boss rotation repeats every 20 waves and new threats appear up to wave 14. Assuming players chase wave records, it could hold interest for several hours. Unverified with humans.
- **TDM against AI.** Matches are very short (S4c: 1:34 to 30 kills). Assuming no LAN friends, likely a few hours of novelty.
- **Armory.** The 13–21 hours for the full armory is mostly grind, with weak power payoff.

**Strongest aspect:** every map does triple duty (campaign, Holdout, TDM), and Holdout now changes how a player has to play as waves go on.

**Weakest aspect:** no structural variety in the campaign. Missions use a fixed seed (1701); arena runs are randomised. There is no mission randomiser, no optional objectives beyond intel, no mutators, and Act III is missing.

**Top improvements**
1. Mission mutators for replays: "night", "armoured", "no HUD", "pistols only", with credit multipliers. That is cheap content using existing systems.
2. A weekly seeded Holdout challenge with a fixed loadout and map, a shared seed, and a local or online best.
3. Build Act III, or decide the campaign is complete and market the game around Holdout, TDM and replays.

### H. Animations, Visual Effects and Polish — 6.5 (Medium confidence)

**Evidence**
- *Verified:* character animation uses the "Riley Gombart CC-BY 3.0" sprite set: separate feet and body sequences for idle, move, strafe, shoot, reload and melee, with a 70 ms blend between body sequences (`render.js` `drawActor`).
- *Verified:* rolls, dives and vaults are faked with scale and lift.
- *Observed:* feedback layering includes muzzle flashes, casings, sparks, smoke, decals, explosion flashes, screen shake scaled by distance, hit-stop on melee, slow motion on boss kills and wave clears, hit and kill crosshair marks, damage-direction arcs, a low-health pulse and flashbang whiteout.
- *Observed:* bosses and machines (tank, Warden, sentry, drones) are drawn as vector shapes in code. They read clearly but look plainer than the sprite characters.

**Strongest aspect:** the feedback ("juice") is well judged. Impactful but restrained, with Reduced Flash and camera-shake settings, and the telegraphs stay visible through effects.

**Weakest aspect:** visual sameness. One character sprite tinted for nearly every human, and corpses that look like enemies. The vector bosses look like a different art direction from the sprite characters and the painted menu.

**Top improvements**
1. Distinct silhouettes for enemy roles (see E).
2. A proper death treatment: a short fall animation, then flat and desaturated, then gone.
3. Draw bosses (tank, Warden) as sprites matching the character art, with an anticipation pose before the telegraphed attacks.

### I. Audio and Sound Design — 5.5 (Low confidence: not heard)

**Evidence (code only)**
- About 45 audio files, many weapons sharing samples at different pitch (`audio.js` sound table: battle, LMG, minigun, burst and ricochet all use `rifle`).
- Synthesised UI and alert tones.
- Pooled voices with distance attenuation (1,100 px) and stereo pan.
- A carefully built distant-battle mix on the menu (echo, filtering, soft limiting).
- A heartbeat and breathing at low health.
- Menu music only, plus an in-mission drone; no combat music.
- 56 commander voice lines, 51 of them AI clones (`docs/RELEASE_READINESS_REPORT.md`).

**Strongest aspect:** audio is used for combat information: telegraph tones for snipers and rocketeers, bullet whiz, the low-health heartbeat, and spatial panning.

**Weakest aspect:** the guns' sound identity. One rifle sample at different pitches cannot make a 4,500 CR battle rifle feel different from the free MK18. The voice also has a rights problem.

**Top improvements**
1. A unique fire sound and tail for each weapon class (at least eight), plus layered mechanical sounds on reload and swap.
2. Dynamic combat music for Holdout red waves and boss fights.
3. Re-record or properly license the commander voice.

### J. Skill Ceiling and Mastery — 7.0 (Medium confidence)

**What an expert can do that a beginner cannot (verified mechanics)**
- Chain slides into vaults for stamina refunds and Flow State damage.
- Dodge through telegraphed shots on the invulnerability window and get a flow from it.
- Keep kill combos alive for up to +80% bounty (the scripted player reached ×27).
- Use knife finishers on low-health enemies (an instant kill under 35 HP).
- Bank ricochet shots, hit the tank's rear (×1.6), break the Warden's barrier, and time EMPs.
- In Holdout, save credits for the legendary crate and keep clean waves for the bonus.

**Limitations**
- There is no place to show mastery. No leaderboards, no score-attack mode, no replays, no visible combo or score ranking beyond a mission's S rating and a personal best wave.
- The campaign's S rating is easy: the bot earned one without movement tricks.

**Top improvements**
1. A per-mission score with a target time (the code already computes `rating()`), a local leaderboard, and later Steam leaderboards.
2. Tighten the S rating so it needs flows and a time target.
3. A Holdout "daily seed" (see G) as a level playing field.

### K. Technical Quality and Performance — 7.5 (High confidence)

**Measured**
- **Simulation cost:** 0.12 ms per step at Holdout wave 1 and 0.18 ms at wave 18 with 20 live hostiles. That is under 0.4 ms of simulation per 60 fps frame. Worst single step: 3.5 ms.
- **Headless frame rate (software WebGL):** 59–61 throughout the campaign run; minimum average 47 during the longest Holdout run (138 kills, with corpses accumulating) and 56 with the partner. Real-GPU numbers are unknown.
- **Load:** DOM ready in 323 ms; loading screen gone within 2.5 s locally.
- **Stability:** zero page errors or console errors across all seven sessions.
- **State transitions:** retry 0.13 s; Training start immediate.

**Verified**
- A deterministic 120 Hz simulation separate from rendering, which makes AI and balance testable headless.
- A versioned save with validation and migration (`save.js`).
- Network snapshot validation (`SNAP_SHAPE`).
- `npm test` passes; one pre-existing browser-suite failure.
- An unbounded `s.enemies` growth in Holdout (238 entries by wave 17).

**Maintainability concern:** `core.js` (1,046 lines) and `game.js` (1,074 lines) are written in a very dense style, with lines of up to 1,213 characters and many statements chained per line. The comments are good, but code reviews, diffs and onboarding a second developer will be slow and error-prone. *Observed in this session:* a renderer edit introduced a reference error that only browser play caught.

**Top improvements**
1. Prune dead enemies (keep the last N for visuals) and cap the decals and pickups lists.
2. Fix or update the failing browser check so the suite gates releases again.
3. Gradually reformat the hottest files (one statement per line) under the existing tests.

### L. Retention and Commercial Potential — 5.5 (Low–Medium confidence)

**First 30 seconds:** strong. An atmospheric intro (skippable, holds on the emblem), then a menu with a live animated battle behind it and one obvious "DEPLOY INTO CAMPAIGN" button.

**First 5 minutes:** good but thin. Bootcamp is optional (recommended, not forced). THE CRASH is quick, story-driven and rewarding (a rank-up and an S rating), but it doesn't show off the movement or tactical depth.

**First satisfying combat moment:** within about 30 seconds of deploying (the first patrol at the radio).

**Second session motivation:** good. Daily contracts, the streak, the next operation's cliffhanger, Holdout records.

**Weeks:** weak. Content runs out (campaign), and power progression is mostly sidegrades.

**Differentiation:** the top-down tactical shooter field is crowded (Door Kickers, Running With Rifles, Ruiner-likes, Hotline Miami-likes). The game's distinctive mix of slide-vault flow movement, telegraphed tactical AI and military-dossier presentation is real, but not yet a headline feature.

**Blockers before any paid release** (from the project's own release report; not re-verified):
- The name *Blackout Protocol* collides with a 2023 Steam game (since renamed *Section 13*).
- Most voice lines are AI clones of a recording of unknown origin.
- The online relay runs on a free hosting tier that sleeps, with about 800 ms between two players in the owner's test.

**Top improvements**
1. Resolve the name and voice before marketing spend.
2. Choose and push a headline hook (see §9).
3. Add platform features players expect from a paid game: Steam achievements, cloud saves, leaderboards.

---

## 5. What Blackout Protocol Does Exceptionally Well

1. **Responsive movement with a skill layer.** About 19 ms input to motion, about 11 ms to the first shot, invulnerable dodges and "perfect flow" chains that reward precise movement with stamina and damage. *Amplify:* make flow the signature; see §9.
2. **Telegraph-first combat design.** Every lethal attack is announced (wind-up lines, red lasers, grenade, mortar and missile rings, a glowing tank barrel, damage arcs), so deaths feel fair. *Amplify:* keep this rule for every new enemy, and say it on the store page.
3. **Presentation and UX framing.** Classified-dossier menus, an animated menu battlefield, a cinematic intro, a debrief with a "NEXT" goal. *Preserve at all costs.*
4. **Tactical tool kit.** EMP, smoke, flashbangs, decoys, trophy system, grapple, deployable cover. Each solves a specific enemy problem. *Amplify:* design encounters that need one tool, and tell the player which.
5. **Engineering foundation.** The deterministic simulation, broad automated tests and a balance harness let the game change safely. *Preserve.*
6. **Holdout's new escalation** (unverified with humans): threat levels, new threats with tips, red-wave bosses with legendary counter-crates, and death-screen lessons. This is the strongest candidate for the "one more run" loop.

**Moments most likely to make a player think "that was awesome":**
- A slide-vault-flow over cover into a knife kill.
- Rolling through a sniper shot.
- Breaking the Warden's barrier and dumping a magazine into it.
- An AT4 into the tank's engine.
- Surviving a red wave with the screen edges pulsing.

---

## 6. Weaknesses and Opportunities — Issue Register

| # | Issue | Category | Severity | Type | Effort |
|---|---|---|---|---|---|
| 1 | Name collision and voice rights | Commercial | Critical (for release) | Legal | Medium |
| 2 | Weapon tiers are sidegrades; the free rifle out-damages paid guns | Weapons | High | Balance/design | Medium |
| 3 | Campaign content is short; Act III missing | Content | High | Content gap | High |
| 4 | Enemy and corpse readability | Enemies/visuals | High | Usability | Medium |
| 5 | Holdout corpses never removed | Technical | Medium | Bug/perf | Low |
| 6 | Daily contracts ignore what the player owns | Progression | Medium | Usability | Low |
| 7 | THE CRASH is too short and easy to show off the game | Gameplay | Medium | Design | Low–Medium |
| 8 | Difficulty cliff between High Intensity and Insane | Gameplay | Medium | Balance | Low |
| 9 | TDM on small maps is extremely fast (30 kills in 1:34) | Content | Medium | Balance | Low |
| 10 | Co-op partner (LAN) has a reduced kit and no perks or support | Gameplay | Medium | Design | Medium |
| 11 | Gun audio re-pitched from one sample | Audio | Medium | Content gap | Medium |
| 12 | HUD overlaps (controls strip, banner over boss bar, labels) | UI | Low | Usability | Low |
| 13 | Insane death copy joins two messages | UI | Low | Bug | Low |
| 14 | No leaderboards, achievements or score-attack | Retention | Medium | Content gap | Medium |
| 15 | Dense code style slows changes | Technical | Medium | Maintainability | Ongoing |
| 16 | One browser test fails (pre-existing) | Technical | Low | Bug | Low |
| 17 | Missing accessibility options (text scale, colour-blind palette) | UI | Medium | Accessibility | Low–Medium |

**Detail for the issues that matter most**

**#2 — Weapon progression is mostly sidegrades.**
- **Current:** the free MK18 has 150 sustained DPS. The ARC-7 (85,000 CR) has 150, the M110 (6,000) 94, the TESLA-3 (16,000) 105.
- **Why it matters:** players read prices and tiers as power. A 13–21 hour grind towards items that are not better breeds disappointment and "the starter gun is best" community wisdom.
- **Fix:** define a role per class, with a mechanic that only that class has. Then re-price, so legendaries are unique tools rather than bigger numbers. Validate with the existing `holdout-sim.cjs` by comparing wave reached per weapon.
- **Expected impact:** buying a gun changes how you play, so the armory becomes a reason to return.
- **Risk:** balance churn; use the existing tests and harness.

**#3 — Short campaign.**
- **Current:** six operations, about 35–60 minutes for a human (estimate).
- **Why it matters:** the narrative hook is strong and then stops; players who come for the campaign will feel short-changed.
- **Fix:** either build Act III, or reposition the campaign as a prologue and make Holdout, TDM and replays the product. Mutators (see G) are the cheapest way to add replay value.

**#4 and #5 — Readability.**
- **Current:** tinted, near-identical soldiers, and corpses that look like soldiers and never leave in Holdout.
- **Why it matters:** in a game built on reading telegraphs and roles, the player has to identify threats in a fraction of a second.
- **Fix:** distinct silhouettes; corpses go flat, desaturate and fade after about 6 s; prune `s.enemies`.
- **Validation:** a screenshot test where an untrained viewer names enemy types.

**#6 — Contracts.**
- **Current:** `contractsFor(day)` picks from the full list regardless of what is owned.
- **Fix:** re-roll contracts the player cannot attempt with owned items, or give a free re-roll.
- **Impact:** removes a "can't do this" message on the first menu screen.

**#9 — TDM pacing.**
- **Current:** about 19 kills a minute on the Killhouse with eight operators.
- **Fix:** larger default maps for 4v4, or a default limit and time tuned per map size. Re-check the match-length assumptions in the code (`T.time` scales with the limit).
- **Impact:** fights become positional rather than spawn-churn.

---

## 7. Player Retention Analysis

| Window | Current quality | What carries it | What threatens it |
|---|---|---|---|
| First 30 s | Strong | Intro film, animated menu, one obvious button | Nothing significant |
| First 5 min | Good | Quick story mission, rank-up, S rating, generous credits | The opening is easy and short, and the movement kit isn't used |
| First hour | Good | Operations 2–6, bosses, the armory opening, Holdout and TDM | The campaign may already be over; the guns bought feel like sidegrades |
| Sessions 2–5 | Fair–good | Daily contracts, streak, Holdout records and the new red waves, mastery, challenges | Repetition of the 7 maps; contracts that can't be done; no leaderboards |
| Weeks | Weak | Holdout wave records, the legendary grind | No new content cadence, weak power payoff, no social layer outside LAN |

**What keeps a player after the first match:** the debrief's next goal and the cliffhanger.

**What brings them back tomorrow:** daily contracts and the streak. Fix the contract filtering so these always work.

**What sustains weeks:**
- Holdout mastery: seeded dailies and leaderboards.
- Weapon roles that change how you play.
- Mutators.
- Co-op that works over the internet with acceptable latency.

**What makes them recommend it:** a signature mechanic people can show in a clip (see §9) and the presentation.

**What makes them buy it over a competitor:** a clear identity and enough hours of content to justify the price.

---

## 8. Gameplay Depth and Skill Ceiling

- **Mechanical mastery:**
  - Flow chains (slide → vault, slide kill, dive → knife, dodge-through).
  - Invulnerability timing.
  - Recoil and spread management (aim halves spread; moving fast raises it by 50%).
  - Knife finishers.
  - Ricochet angles.
  - Boss weak points (Warden barrier, tank rear).
- **Tactical choices:**
  - Gadget-to-enemy counters.
  - Cover use against grenadiers and mortars (both punish camping).
  - Holdout credit management (save for the legendary crate or spend on basics).
  - Priority targets: medic, spotter, jammer.
- **Weapon variety:** mechanically varied, numerically flat (see D). The depth is in *how* the guns work (burst, bounce, chain, flame, pierce, blast), not in which is strongest.
- **Build diversity:** limited. One primary, one secondary, one lethal, one tactical, one support and three perks give many combinations, but few synergies change a playstyle.
- **Advanced strategies seen in testing:** the scripted player's ×27 combo shows the combo bounty system rewards continuous aggression. Credit income favours aggressive, fast clears.
- **Beginner versus expert:** the gap is large on Insane and in deep Holdout, and small in the campaign on Standard.

---

## 9. Competitive Differentiation

**What already sets it apart:**
- The **flow movement system** (slide, vault, dive, dodge, chained into stamina and damage) in a *military* shooter. Most top-down military games are slow and cover-based.
- **Telegraph-first fairness** against tactical AI that uses cover, flanks and gadgets.
- **Dossier presentation.**

**A recognisable identity it could own: "tactical flow."** Read the telegraph, move through it, punish. Concretely:
1. Make every flow visible and rewarding: a distinct sound and screen accent, a flow counter in the HUD, score multipliers.
2. Design enemies that are best beaten by flowing *through* them (shield wall → vault over; sniper → roll through the laser).
3. Market it with 10-second clips of slide-vault-knife chains and boss weak-point kills.

**What not to chase:** more guns or more modes for their own sake. The game already has enough systems; it needs sharper identity and more *designed* content for them.

---

## 10. Prioritized Improvement Roadmap

Priority uses **impact × confidence ÷ effort** as a comparative guide (L = 1, M = 2, H = 3).

### Stage 1 — Critical fixes
| Rank | Item | Proposed change | Impact /10 | Confidence | Effort | Dependencies | Validation |
|---|---|---|---|---|---|---|---|
| 1 | Name and voice rights | Rename or clear the trademark; re-record or license the voice | 10 (release) | High | M | Legal | Written clearance |
| 2 | Contract filtering | Re-roll contracts the player can't attempt | 5 | High | L | none | A unit test on a fresh save |
| 3 | Holdout corpse pruning | Fade corpses after about 6 s and prune `s.enemies` | 5 | High | L | none | `s.enemies.length` stays bounded in `holdout-sim`; frame-rate check |
| 4 | Fix the browser test | Repair the controller "Y SWAP" check | 3 | High | L | none | `npm run test:browser` green |
| 5 | Death-copy and HUD overlap bugs | Reserve a banner lane; fix the Insane copy | 4 | High | L | none | Screenshot review at 3 resolutions |

### Stage 2 — High-impact improvements
| Rank | Item | Proposed change | Impact | Conf. | Effort | Validation |
|---|---|---|---|---|---|---|
| 6 | Enemy readability | Distinct silhouettes per role; elite and vet icons; flat corpses | 8 | High | M | Blind identification test with 3–5 people |
| 7 | Weapon roles | A role mechanic per class; re-price | 8 | Medium | M | Sim harness per weapon; playtest survey |
| 8 | Opening operation re-pace | Add one movement-skill set piece and a cover fight to THE CRASH; make Bootcamp cover roll/dive and knife | 7 | Medium | L–M | First-session playtests: time to first flow |
| 9 | Difficulty curve | A tier between High Intensity and Insane, or lower Insane damage | 6 | Medium | L | Completion rates across difficulties |
| 10 | Human Holdout playtests | 5–10 players; record the wave reached and cause of death | 7 | High | L | Waves 6–12 for average players (the stated design goal) |
| 11 | TDM pacing | Match length and limit by map size | 5 | Medium | L | Kills a minute between 6 and 10 |

### Stage 3 — Depth and replayability
| Rank | Item | Proposed change | Impact | Conf. | Effort |
|---|---|---|---|---|---|
| 12 | Mission mutators | Night, armoured, pistols-only, no-HUD, with credit multipliers | 7 | Medium | M |
| 13 | Seeded daily or weekly Holdout plus local leaderboards | A shared seed, fixed loadout and map | 7 | Medium | M |
| 14 | Synergy perks | 3–4 perks that combine with movement and gadgets | 6 | Medium | M |
| 15 | Co-op parity | Full move set, perks and support for the second operator | 6 | Medium | M |
| 16 | Operation-specific medals and challenges | One unique challenge per operation | 5 | Medium | L |
| 17 | Act III or campaign repositioning | Build three chapters, or reframe the campaign as a prologue | 8 | Low–Medium | H |

### Stage 4 — Premium polish
| Rank | Item | Proposed change | Impact | Conf. | Effort |
|---|---|---|---|---|---|
| 18 | Weapon audio | A unique fire, tail and reload set per class | 6 | Medium | M |
| 19 | Combat music | Dynamic layers for red waves and bosses | 5 | Medium | M |
| 20 | Boss art | Sprite bosses with anticipation poses | 5 | Medium | M–H |
| 21 | Accessibility | Text scale, colour-blind palette, toggle sprint and aim | 5 | High | L–M |
| 22 | Steam integration | Achievements, cloud saves, leaderboards, Steam Input | 6 | Medium | M |
| 23 | Online relay | A paid, regional relay or Steam networking | 6 | Medium | M |
| 24 | Code formatting | Reformat `core.js` and `game.js` progressively under tests | 4 | High | M (ongoing) |

---

## 11. Recommended Features

**Must-have (before a paid release)**
- Name and voice rights resolved.
- Weapon roles and re-pricing.
- Enemy and corpse readability.
- Contract filtering.
- Corpse pruning.
- Accessibility basics (text scale, colour-blind palette).
- Steam achievements and cloud saves.
- Human playtests of Holdout and the campaign.

**High-value additions**
- Mission mutators.
- Seeded daily Holdout with leaderboards.
- Synergy perks.
- Co-op parity.
- Per-class weapon audio.
- Combat music.

**Optional future features**
- Act III.
- New killhouse maps sized for 4v4 TDM.
- Sprite bosses.
- A replay or kill-cam for flow chains.
- Online TDM.

**Not worth implementing yet**
- More guns or more gadgets: there are enough; make the existing ones distinct first.
- Cosmetics or a store.
- New game modes beyond mutators.
- Procedural campaign levels: the authored maps are a strength, and procedural generation is high-effort.

---

## 12. Final Verdict

1. **Is the game fun now?** Yes. The moment-to-moment combat is responsive, fair and has a real movement skill layer. The fun is front-loaded, and the content runs thin after a few hours. *(Based on measured feel and scripted play; human confirmation pending.)*
2. **Strongest selling point:** tactical flow combat. Precise slide-vault-dodge movement against telegraphed, tactically behaving enemies, wrapped in high-quality military-dossier presentation.
3. **Biggest weakness:** depth of rewarding content. A short campaign and weapons that are mostly sidegrades, so long-term goals have weak payoff.
4. **Most likely to make a new player quit:** running out of campaign quickly, or hitting Insane's wall. Secondarily, losing track of threats in a crowded field of near-identical soldiers and corpses.
5. **Most likely to make a player return:** daily contracts and the streak, Holdout wave records with red-wave bosses, and the story cliffhanger.
6. **The three changes that would help most:**
   1. Give weapon classes distinct roles and re-price the armory.
   2. Fix enemy and corpse readability.
   3. Add replayable structure: mutators plus a seeded daily Holdout with leaderboards.
7. **Ready for external playtesting?** Yes, in a closed group. It is stable, has no errors observed, and has clear goals to test (time to first flow, Holdout wave distribution, readability).
8. **Ready for commercial release?** No. The legal blockers come first, then content and weapon value.
9. **The single most important next step:** resolve the name and voice rights, then run 5–10 human playtests of THE CRASH and Holdout. Everything else on this roadmap should be tuned against what those players do.

**Verdict.** Blackout Protocol today is a **6.6/10**: a polished, technically excellent, genuinely fun top-down military shooter whose systems are ahead of its content and identity. If the Stage 1–2 items land (readable enemies, meaningful weapons, a stronger opening, human-tuned Holdout) and Stage 3 adds replayable structure, it can plausibly reach **7.5–8** and compete as a well-reviewed indie title. The foundation is the hard part, and it is already built.
