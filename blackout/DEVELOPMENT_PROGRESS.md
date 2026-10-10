# Development progress

## 10 October 2026 — campaign, Insane, economy

Delivered: five new operations (Acts I–II complete), HOLDOUT, the Insane tier, 17 guns with field drops and two-slot loadouts, eight gadgets, eleven new enemy types including three bosses, the armory economy with ranks, medals, daily contracts and streaks, an operations board with briefings and recommended gear, an animated debrief, and situational audio/visual feedback (low-health pulse with heartbeat and breathing, flashbang white-out, bullet whiz, damage-direction arcs, combo banners, slow-motion kills, weather, subway darkness).

Fixed: sprint was blocked after a reload or stim until a melee or roll, because the timers ended slightly negative and still read as active. Timers now settle at zero; a unit test and a real-browser test cover it. Controller Y now toggles weapons.

Found while testing: a THE CRASH reinforcement fallback point overlapped a crate (moved); resuming a checkpoint at a boss stage would throw on the first boss-health threshold (fixed, every checkpoint of every mission is now exercised on every difficulty); laser grids re-damaged every 0.32s (now a .7s contact cooldown).

Balance evidence: the control-packet bot completes every operation on standard (Convoy and Meridian with the modest upgrades a player owns by then). A human-limited open-field bot dies on Insane in THE CRASH (42.6s), NO SAFE GROUND (11.4s) and DEAD FREQUENCY (13.4s). A separate cover-using bot (`tests/tactical.cjs`) completes THE CRASH on standard and intense and reaches the final hold on Insane, but has not beaten Insane — Insane winnability is plausible, not proven by automation, and needs human playtesting.

## Remaining production work

Human playtests of Insane and of the later operations' pacing; physical-controller testing; real speakers for the synthesized heartbeat/breathing mix; bespoke enemy and boss art (bosses and machines are drawn in code, soldiers reuse the licensed survivor rig with tints and overlays); Act III.

## 9 October 2026 — opening slice

Isolated Phaser game with THE CRASH and the training range; movement, combat, destruction, director and checkpoints; controller support with aim assist; static build and QA pipeline. See the git history for detail.
