# Development progress

## 13 October 2026 — economy rebalance, stamina, holdout depth

Delivered, following `docs/BLACKOUT_GAMEPLAY_PLAN.md`: holdout income roughly halved (smaller combo bonus, ×0.6 bounties, smaller wave bonus); new prices in five rank-gated armory tiers with a steeper XP curve; enemy-dropped guns usable for the run only, with a 25% armory discount once found; purchasable weapon kit parts gated by mastery; killhouse pay multipliers and per-killhouse records. Stamina now waits 1 s before refilling (3 s and a "winded" lock if emptied), rolls delay it, a refused roll is signalled, and reloading at a jog replaces the walk. Three more flow chains (slide kill, dive into knife kill, rolling through an attack), buffered slide and interact presses, weapon-scaled camera look-ahead, edge arrows for off-screen attackers and HUD panels that fade over hostiles. Holdout gained the between-wave supply drop and four wave modifiers. Around the game: a first-launch movement drill, daily contracts on the main menu, loadout presets, a next-goal line on the debrief and a next-up marker in the armory. The killhouse picker shows screenshots of each map.

Saves: version 3. A version 2 save keeps campaign progress, holdout records, mastery, stats and settings; credits, rank, purchases and loadout start again, and the main menu says so once.

Fixed along the way: desktop saves were lost on every launch because the local server's port (and so the page's storage origin) changed each time, now kept in a file under the app's user-data folder; the armory voice line only played once; analog-stick left/right did nothing in menus; controller focus moved in markup order instead of by position; Escape and B did nothing on the results screen.

Fixed: the Underground and Site Meridian killhouses kept the campaign's closed gates, which walled the spawn points off from the operator (three of four, and all four), so waves there could not be cleared. Killhouses now drop the gates, and a test checks every spawn point is reachable.

Found while testing: a game controller plugged into the test machine was being read by the browser tests, moving the operator and the menus. Browser test contexts now start with no controller. This is the likely cause of the campaign-walkthrough browser test failing earlier in the day, including on unmodified code. With the controller shut out that test passed in two of three full-suite runs and four of four runs on its own, so it remains sensitive to machine speed.

Balance evidence: `blackout/tests/progression.cjs` holds holdout pay inside a band at waves 5, 10 and 15 on every difficulty. The time-to-catalogue figure (about twelve hours) is an estimate from stated assumptions, not a measurement. The control-packet bot still completes every operation on standard; it was changed to let go of sprint while reloading, as its routes were tuned to the old walking pace and its result on Site Meridian swung with small changes in jog speed.

Packaged: `npm run dist:win` builds an installer and a portable exe into `release/`, with the logo on the exe, installer, uninstaller and shortcuts, and installer and splash art drawn from it. The packaged game was launched and played in a scratch profile. The installer was run into a scratch folder: files, shortcuts and the Apps list entry appeared, the installed game started a run, and the uninstaller removed everything and left saves alone. Details in `WINDOWS_PACKAGING.md`. For packaging: the three typefaces are now bundled (they were loaded from Google at run time), the app runs one copy at a time, it has its proper name (its save folder becomes `%APPDATA%\Blackout Protocol`, adopting an earlier save from the old folder), and `blackout/tools/verify-static.cjs` works again and runs before each build.

Loose ends closed: hostiles no longer stall short of a stationary operator in the killhouses. Two causes: one following the path field tried a single sidestep direction and pushed at a corner for ever if that pointed into the wall (it now tries the other side); and one that could see the operator walked straight at them through cars, crates and water (rushers now path round, as do riflemen in holdout). Riflemen keep their old behaviour in the campaign, because fixing it there made reinforcements more effective and dropped the control-packet bot's pass rate on Site Meridian from 11 of 12 seeds to 9; with the change limited to holdout it is 11 of 12 again. A test runs every killhouse on three seeds and fails if anything stalls. The live browser walkthrough's limit went from three minutes to five. The three SVGs that failed their integrity hashes on Windows were a line-ending problem, fixed in `.gitattributes`.

Not done: cosmetics; a sprint-out delay before the first shot (only wanted if playtests ask for it); code signing. Still needs human playtests: time to first purchase, whether being winded reads clearly, how much of a run goes on supply drops, and whether the nine-second rest between waves is too long.

## 10 October 2026 — campaign, Insane, economy

Delivered: five new operations (Acts I–II complete), HOLDOUT, the Insane tier, 17 guns with field drops and two-slot loadouts, eight gadgets, eleven new enemy types including three bosses, the armory economy with ranks, medals, daily contracts and streaks, an operations board with briefings and recommended gear, an animated debrief, and situational audio/visual feedback (low-health pulse with heartbeat and breathing, flashbang white-out, bullet whiz, damage-direction arcs, combo banners, slow-motion kills, weather, subway darkness).

Fixed: sprint was blocked after a reload or stim until a melee or roll, because the timers ended slightly negative and still read as active. Timers now settle at zero; a unit test and a real-browser test cover it. Controller Y now toggles weapons.

Found while testing: a THE CRASH reinforcement fallback point overlapped a crate (moved); resuming a checkpoint at a boss stage would throw on the first boss-health threshold (fixed, every checkpoint of every mission is now exercised on every difficulty); laser grids re-damaged every 0.32s (now a .7s contact cooldown).

Balance evidence: the control-packet bot completes every operation on standard (Convoy and Meridian with the modest upgrades a player owns by then). A human-limited open-field bot dies on Insane in THE CRASH (42.6s), NO SAFE GROUND (11.4s) and DEAD FREQUENCY (13.4s). A separate cover-using bot (`tests/tactical.cjs`) completes THE CRASH on standard and intense and reaches the final hold on Insane, but has not beaten Insane — Insane winnability is plausible, not proven by automation, and needs human playtesting.

## Remaining production work

Human playtests of Insane and of the later operations' pacing; physical-controller testing; real speakers for the synthesized heartbeat/breathing mix; bespoke enemy and boss art (bosses and machines are drawn in code, soldiers reuse the licensed survivor rig with tints and overlays); Act III.

## 9 October 2026 — opening slice

Isolated Phaser game with THE CRASH and the training range; movement, combat, destruction, director and checkpoints; controller support with aim assist; static build and QA pipeline. See the git history for detail.
