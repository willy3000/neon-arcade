# NEON ARCADE

A nine-game browser arcade: BLOOD OATH, WILDFALL, BLACKOUT PROTOCOL, NEON RUSH, GRAVITY HEIST, ECHO FORGE, PHASEBOUND, RIFTBREAKERS, and AFTERSTRIKE. BLOOD OATH is a 2D one-on-one fighting game with local versus on two controllers, drawn entirely in code with CC0 sound and music. WILDFALL is a 2.5D action-platformer using locally vendored three.js with CC0 animated characters. BLACKOUT PROTOCOL is a top-down tactical campaign (six operations, endless HOLDOUT, armory economy, insane tier) using locally vendored Phaser, licensed sprite atlases and sampled audio. The other games use HTML5 Canvas and vanilla JavaScript. Deployment needs no compilation or backend.

## Run

Open `index.html` in a modern browser, or serve this directory locally:

```sh
python -m http.server 8000
```

Then visit http://localhost:8000. Select a game from the library to play. BLACKOUT PROTOCOL needs HTTP hosting for its asset loader; existing games also work from file URLs. An internet connection is only used for optional Google Fonts; system fonts work offline. If port 8000 is occupied, use `python -m http.server 8127` and http://localhost:8127.

## Play BLOOD OATH

Select **BLOOD OATH** from `index.html`, or open `blood-oath.html`. It loads its code as modules, so it needs HTTP hosting (`npm run serve`, then http://127.0.0.1:8127/blood-oath.html); it will not run from a file URL.

- **Modes:** Fight (one match against the computer), Local Versus (two players), Arcade (three rivals, then a boss), Training (hitboxes, frame data, a configurable dummy) and a Character Guide with every move.
- **Fighters:** Cinder (rushdown, teleport), Rime (projectiles, freeze, counter), Vesper (long sword, bleed, parry) and Grit (armour, command grab). Volt and Nyx from the original plan are not built.
- **Keyboard, player 1:** A/D move, W jump, S crouch, F/G/H light/medium/heavy, T special, R block, Y throw, C dash, V enhance, Esc pause. **Player 2:** arrow keys, J/K/L attacks, I special, U block, O throw, N dash, M enhance, Enter pause.
- **Controller:** stick or d-pad to move, A/B/X attacks, Y special, LB block, RB throw, LT dash, RT enhance, Start pause. Press any button once so the browser detects it. The first controller to wake goes to player 1 and the second to player 2; the **Controllers** screen shows who holds what, tests inputs and lets either player be reassigned.
- **Basics:** block lows crouching and overheads standing; throws beat blocking; light → medium → heavy chains cancel into specials. Direction + Special gives each fighter four specials. Hold Enhance with a special to spend one bar on a stronger version; Heavy + Special spends two bars on a super; Block + Enhance while being hit spends two bars to break out of a combo.
- Settings: volumes, blood (full, reduced, off), screen shake, reduced flashes, round timer, rounds to win, computer skill, and remapping for both keyboards and controllers.

Design, frame data, assets and test results are in `bloodoath/GAME_DESIGN.md`, `FRAME_DATA.md`, `ASSET_MANIFEST.md` and `TEST_REPORT.md`. Two-controller play has only been tested with simulated controllers; see the test report. Tests: `npm run test:bloodoath` and `npm run test:bloodoath:browser`.

## Play WILDFALL

Select **WILDFALL** from `index.html`, or open `wildfall.html`. It loads 3D models, so it needs HTTP hosting (`npm run serve`, then http://127.0.0.1:8127/wildfall.html); it will not run from a file URL.

- **Chapter 1, The Fallen Gate,** is the playable campaign: nine sections, two arenas, a three-phase boss and a grapple finale. Chapters 2–6 are not built yet. **Proving Grounds** is a practice level with every technique unlocked and a timed movement trial.
- Choose **Vyx** (fast; wall-runs; best grapple), **Sera** (ranged fire, ice platforms, chain lightning; glides) or **Bragg** (heavy hits, parrying shield, ground slams; breaks walls and floors). They differ in physics, attacks and abilities, not just looks.
- **Keyboard and mouse:** A/D run, Space jump (hold for height, press again in the air), Shift dash, S + Shift slide, J or left click attack, K heavy (hold to charge), S + J in the air to dive, L or right click to hold the grapple, W/S reel the rope, Q and E abilities, R interact, Esc pause.
- **Controller:** left stick move, A jump, B dash, X attack, Y heavy, RT grapple, right stick aims it, LB/RB abilities, Start pause. Press any button once so the browser detects it.
- The grapple is a real rope: latch onto a glowing anchor, swing, and let go on the upswing to launch. A well-timed release is a **perfect release**.
- Chained techniques build **flow**, which raises run speed until you are hit or slow down.
- Progress saves at checkpoints. Falling out of the world costs a little health and returns you to safe ground.
- Settings: challenge level, volume, camera shake, reduced flashes, visual quality (Low turns off shadows and bloom) and controller on/off.

Design, assets, test results and what remains are in `wildfall/GAME_DESIGN.md`, `ASSET_MANIFEST.md`, `TEST_REPORT.md` and `DEVELOPMENT_PROGRESS.md`. Tests: `npm run test:wildfall` and `npm run test:wildfall:browser`.

## Play NEON RUSH

- Move horizontally with your mouse, drag on a touchscreen, or use **← / →** or **A / D**.
- Avoid red obstacles and collect gold energy. Survival earns 12 points per second.
- Start each run with **5 lives**. An obstacle hit costs one life and resets your combo. You blink and are protected for 1.5 seconds afterward, so one collision cannot drain several lives. The fifth damaging hit ends the run.
- Catch falling hexagonal power-ups: **cyan forcefield** protects against all obstacle hits for 8 seconds; **purple magnet** attracts nearby gold energy for 10 seconds; **green double points** doubles survival, energy, and near-miss scores for 10 seconds. Active effects and countdowns appear beneath your lives.
- Different power-ups can be active together. Picking up the same type refreshes its duration. Pausing freezes all effect timers. Each restart resets lives and effects.
- **Pink heart pickups** randomly fall alongside other power-ups. Catch one to restore a life instantly, up to the maximum of 5. At full health, the pickup displays “LIVES FULL”.
- **Blue blaster pickups** grant 12 seconds of firing: **left-click**, press **Space**, or tap the **FIRE** button. Each shot instantly destroys obstacles within a 95-pixel radius centered 105 pixels ahead of your ball, with a visible blast and sound. Shots recharge in 0.55 seconds. Energy and power-up pickups survive the blast. Repeated blaster pickups refresh the timer; pausing freezes the timer and recharge.
- Energy earns 50 points × your combo (up to ×10). Missing energy breaks the streak. Rare super energy earns 150 points × combo.
- Passing close to an obstacle earns 35 points.
- **P / Escape** pauses; **Space** starts, restarts, or resumes. Use the sound button to mute.
- Switching tabs or leaving the window automatically pauses. Resume when ready.

Personal best and mute preference are saved to localStorage when available. Scores still work when browser storage is disabled.

## Play GRAVITY HEIST

Select **GRAVITY HEIST** from `index.html`, or open `gravity-heist.html` directly. All scripts use ordinary local script tags so the game works from a file without a server.

- **Q / Left Arrow** rotates gravity counterclockwise. **E / Right Arrow** rotates clockwise. The robot cannot walk or jump. Rotation preserves momentum; walls stop motion perpendicular to the surface and allow sliding.
- **R** instantly restarts the room. **Space / Escape** pauses and resumes. The large on-screen rotation buttons support mobile and keyboard focus. Short haptic feedback plays on supported devices.
- Reach the teal portal to unlock the next room. Grab the optional purple energy core before leaving.
- Each room awards one star for escape, one for collecting the core, and one for completing within **both** its time and rotation targets. Targets appear on the completion screen. Best time, fewest rotations, highest stars, and mute preference persist in localStorage when available.
- Red saws, patrol drones, electric surfaces, and active lasers are lethal. Dashed lasers are temporarily inactive. Hazard contact reboots the room after a short effect.
- Purple magnetic walls damp sliding very strongly. Rotate away to detach. Purple rectangular fields amplify acceleration by 1.8×; maximum speed stays capped.
- Orange pressure pads latch ordinary doors open. Timed doors stay open for seven seconds after pad contact and refresh while touching the pad. Timed gates wait for a robot already crossing to clear them before closing. Return to the pad to reopen an expired gate.
- Switching tabs or losing window focus pauses physics, timers, hazards, and momentum. Progress is saved after each successful escape. Level Select allows replaying every unlocked room.

Rooms 1–3 introduce gravity, 4–6 introduce timing, 7–9 introduce magnetic walls, fields, and switches, and 10–12 combine these mechanics. Level geometry is handcrafted and fixed; there is no procedural level generation.

## Play ECHO FORGE

Select **ECHO FORGE** from the library, or open `echo-forge.html`. The emitter remains fixed: every interaction with objects happens through sound.

- **Click / tap** anywhere in the chamber for a circular pulse. **Hold and release** to charge it for up to 1.2 seconds. **Drag** to aim a cone; longer drags strengthen the pulse, up to a cap. The large PULSE button also supports holding on mobile.
- **1 / LOW** pushes heavy cargo. **2 / MID** opens switches and starts moving baffles. **3 / HIGH** activates crystals, shatters glass, and collects optional purple tone fragments. Every frequency also transfers momentum to the crystal, with distance-dependent strength.
- **Space** charges a pulse while held; release to fire. **F** fires a quick pulse. **Left / Right Arrow** changes aim by 15°, **Up / Down Arrow** sets a vertical aim, and **C** returns to radial pulses. The on-screen aim button toggles between radial and a rightward cone.
- **R** restarts immediately; **P / Escape** pauses and resumes. Changing tabs or losing focus pauses objects, waves, energy recharge, and moving platforms. Pausing cancels a held gesture without firing or consuming energy.
- Energy recharges at 20 points per second. A pulse costs 18 plus 12 times its strength. Holding or aiming increases strength from 0.65 to 1.4. If energy is low, wait and try again; the chamber cannot run out of energy permanently.
- Push the crystal into the green receiver. In chambers 4–12, wake it with HIGH first. Solid walls and closed gates block sound. MID-activated baffles stop physical objects but their acoustic grating transmits sound.
- Match a relay’s labeled frequency to amplify and re-emit sound from that relay. Angled golden mirrors reflect it into a focused cone. Chains have bounded depth and remember visited nodes to prevent endless feedback.
- Earn one star for delivery, one for collecting every tone fragment, and one for meeting **both** time and pulse targets. Best time, fewest pulses, highest stars, unlocked chambers, and mute preference are saved locally. Restarting clears only the current attempt.

Chambers 1–3 teach pulses and cargo; 4–6 teach frequencies, switches, and platforms; 7–9 teach resonance and aiming; 10–12 combine reflection, relay chains, gates, glass, and moving-platform timing. All 12 chambers have verified three-star playthroughs.

## Verify

Run `node --check game.js` and `node test.cjs`. The dependency-free smoke test exercises menus, scoring, pause/resume, window focus handling, mute persistence, collision, records, restart, and high-DPI mobile resizing with mocked browser APIs. Visual appearance, audio, and physical touch input still need a real browser check.

For GRAVITY HEIST, run `node gravity/test.cjs` to replay saved solver routes through all 12 rooms and check unlocking, records, stars, input, pause, hazard reboot, game completion, and three-star attainability in every room. Run `node gravity/verify.cjs` to regenerate `gravity/routes.json` using a bounded route search against the actual physics; this slower check also tests velocity preservation, world boundaries, and thin-wall collision safety.

Run `node gravity/verify.cjs --cores` to search for routes that collect each optional core before escaping, stored in `gravity/core-routes.json`. These route files are verification artifacts, not required for gameplay.

For ECHO FORGE, run `node echo/test.cjs` to replay every three-star route and verify frequencies, reflection, relay chains, energy regeneration, collision safety, mouse/touch input paths, keyboard controls, pause, records, reload, unlocking, game completion, audio lifecycle, and bounded high-DPI rendering. Run `node echo/verify.cjs` to regenerate the deterministic real-physics playthroughs in `echo/routes.json`. No test modifies live saved browser progress.

Browser APIs are mocked for UI/input/rendering/audio checks. A live browser is still needed to assess visual layout, actual speakers, and physical touch hardware.

## Static hosting / Netlify

Run `npm run build` (or `node blackout/tools/build-static.cjs`) and publish **`dist`**. `netlify.toml` configures this dependency-free copy/validation build and publish directory. The library is `index.html`; each game has its own real HTML route, with relative assets and no SPA rewrites. Games also work by opening HTML files directly. Progress is browser-local and is not shared between file URLs, localhost, and deployed sites.

## Implementation

BLACKOUT PROTOCOL lives in `blackout-protocol.html` and `blackout/`. Its engine and gameplay assets are checked in, so there is no runtime CDN dependency. The static packaging script excludes development dependencies, source archives and QA tools from the deployable folder. BLACKOUT requires HTTP(S) rather than a file URL; the existing games retain their file-URL support.

`index.html`, `library.css`, and `library.js` provide the responsive game library. The registry at the top of `library.js` lists released games and their playable pages. The library displays saved personal bests and refreshes them when returning with the browser Back button. To add another game, create its page, add a registry entry, and supply its card artwork.

`neon-rush.html` contains the game menus and accessible controls; `style.css` handles game presentation; `game.js` owns simulation, rendering, input, scoring, and audio. A 120 Hz fixed simulation step keeps movement, collision checks, and scoring independent of rendering frame rate. Canvas resolution follows device pixel ratio (capped at 2). Obstacle rows reserve a two-lane corridor, share speed, and maintain at least 0.9 seconds between rows. Difficulty ramps up gradually and is capped.

GRAVITY HEIST lives in `gravity-heist.html` and `gravity/`: `levels.js` defines rooms; `physics.js` implements pure simulation and interactions; `render.js` draws the letterboxed, high-DPI viewport; `audio.js` synthesizes sounds; `game.js` manages screens and saved progress; `input.js` handles controls and focus. Physics runs at 120 Hz with a 420 px/s velocity cap, limiting travel per step to 3.5 pixels, below the thinnest obstacle thickness. No simulation step uses rendering frame duration directly. Reduced-motion preferences disable decorative motion, trails, and screen shake.

ECHO FORGE is isolated in `echo-forge.html` and `echo/`, with separate level, physics, audio, rendering, input, and game-state modules. It uses a 120 Hz simulation with axis-resolved circle/rectangle collisions, circle/circle cargo contacts, a 380 px/s object speed cap, line-of-sight sound propagation, one hit per object per wave, up to 32 active waves, depth-limited echo chains, and a reusable 240-particle pool. Its viewport is letterboxed rather than stretched, device pixel ratio is capped at 2, and reduced-motion preferences disable decorative animation and simplify wave effects.

## Play PHASEBOUND

Select **PHASEBOUND** from the library, or open `phasebound.html` directly. Guide both characters into their matching portals to finish each of 12 handcrafted levels across three chapters.

- **Two players:** Kai uses **A/D** to move, **W** to jump, and **S** to interact. Luma uses **Left/Right**, **Up**, and **Down**. Both control schemes work simultaneously.
- **Solo:** either movement scheme controls the selected character. Press **X** or the character button to switch. Mobile has movement, jump, interact, and switch buttons with simultaneous touch support. The inactive character stops horizontally; gravity and moving platforms still apply.
- **R** restarts; **Escape** pauses/resumes. Losing focus or hiding the tab pauses physics and mechanism timers.
- Amber terrain and blocks belong to Kai; cyan terrain belongs to Luma. Both use neutral stone. Luma phases through striped veils and physical blocks.
- Kai pushes blocks onto plates and braces/releases nearby blocks with interact. Luma activates spirit relays to reveal timed bridges or unlock gates.
- Bring both characters inside a purple tether node and interact to link. Stay close to power tether gates; interact away from blocks and relays to unlink.
- Larger levels save a checkpoint when both reach its flag. Falling returns both there, restores mechanisms, and preserves collected crystals. Restart resets the attempt.
- Earn one star for bringing both home, one for every crystal, and one for meeting the displayed time without falling. Progress, best times, collected crystals, mode, mute, and music preferences save locally.
- HINT reveals three progressive clues. Sound and optional ambient music have separate controls.

PHASEBOUND uses separate `phasebound/{levels,physics,render,audio,game,input}.js` modules, original canvas artwork, a 120 Hz simulation, dimension-filtered collisions, coyote time, buffered variable-height jumps, moving platforms, and a capped particle pool. Input packets remain separate from simulation; multiplayer is local on one device.

Run `node phasebound/test.cjs` to replay all 12 cooperative and solo three-star routes and check mechanisms, collision rules, independent/simultaneous input, checkpoints, touch cancellation, pause, saves/reload, progression, rendering, and synthesized audio. Run `node phasebound/verify.cjs` and `node phasebound/verify.cjs --solo` to regenerate the test-only action recordings. The solo verifier sends actions to only one selected character at a time. Live visual, speaker, and physical touch checks require a browser.

## Play RIFTBREAKERS

Open `riftbreakers.html` or select it from the arcade. Nine authored stages span three chapters, each ending in a distinct boss. Choose Blaze or Volt for solo play with an AI partner, or use local two-player mode.

| Action | Blaze | Volt |
|---|---|---|
| Move | A / D | Left / Right |
| Jump / double jump | W | Up |
| Dash | S | Down |
| Light attack | F | K |
| Heavy / aerial slam | T | O |
| Special | G | L |
| Ultimate | J | P |
| Attach / release grapple | Y | I |
| Confirm fusion | H | ; |

Tap attacks; holding a key does not continually hit. Specials cost 35 energy. Ultimates require full charge. Dash cancels light/heavy recovery and grants brief immunity after startup. Volt can dash upward while holding jump. Alternate hero hits and electrify Blaze's fire with Volt's special to earn fusion. Both heroes confirm a full meter within two seconds while nearby; solo AI confirms automatically.

Stand close to a downed teammate without attacking for 1.45 seconds to revive them within 20 seconds. Clear arena waves, destroy the exposed rift generator, and bring both to extraction. Checkpoints save encounter state and restore team health on retry. R restarts the entire stage, Escape pauses, and X switches solo heroes. Mobile solo includes multi-touch movement and all combat actions.

Settings include unique keyboard rebinding, effects/music toggles, three quality levels, adjustable shake, reduced motion/flash, a shorter fusion cinematic, and touch sizing. Unlocks, stars, relics, best time/score and preferences save locally. The third rating star requires meeting the displayed stage time, ≤100 team damage, and no falls.

`node riftbreakers/test.cjs` checks deterministic campaign replays, combat, movement, mechanisms, AI, input, persistence and rendering. `node riftbreakers/verify.cjs` and `node riftbreakers/verify.cjs --coop` regenerate action-only completion routes. UI/render checks mock browser APIs. Live browser/speaker/touch testing is still required.

On HTTPS or localhost, `riftbreakers-sw.js` caches RIFTBREAKERS and library navigation for offline use after installation. Other games' requests pass through unchanged. Opening local HTML files also works without a service worker. No runtime fonts, downloaded artwork, or dependencies are needed.

RIFTBREAKERS has isolated modules for authored levels, physics, combat, enemy/boss/companion AI, simulation, persistence, rendering, audio, UI and input. Original procedural character artwork, inline SVG cover artwork, and synthesized audio require no third-party attribution.

## Play AFTERSTRIKE

Open `afterstrike.html` or select it from the arcade. This complete vertical slice links three Fallen City scenes, two mutation selections and the Clockwork Titan boss. Practice provides all three weapons and replenishing resources. The proposed later worlds and two additional bosses remain expansion work; see [release scope and QA](afterstrike/QA.md).

| Action | Desktop |
|---|---|
| Move / crouch | A/D or arrows / S or Down |
| Jump / double jump | Space or W |
| Dash | Shift |
| Light / hold charged heavy | J or left mouse / K or right mouse |
| Parry / summon echo | F / E |
| Grapple / collapse echoes | Q / C |
| Heal / special / ultimate | H / L / U |
| Weapon selection | 1 / 2 / 3 |
| Restart / pause | R / Escape |

Echoes replay the last three seconds of committed movement and combat, strike live enemies, intercept projectiles during recorded defensive actions, and hold relay plates. They phase through terrain so changed scenery cannot trap recordings. Synchronize attacks from opposite sides for extra rewards. Weapon unlocks, discoveries, cosmetics, records and challenge results save locally; assisted records stay separate.

Touch controls expose movement and combat, with an expandable ability tray. Standard gamepads use left stick to move, A jump, B dash, X light, Y charged heavy, LB parry, RB echo, LT grapple, RT special, right-stick press ultimate, D-pad down heal/left cycle weapon/right collapse, and Start pause. Settings include audio levels, quality, shake, reduced motion/flash and assist mode.

The isolated `afterstrike/` modules implement fixed-step physics, combat, echo recording, AI, simulation, persistence, original articulated artwork, bounded effects, audio, rendering, UI and input. No runtime dependencies or external assets are required. See [design](afterstrike/GAME_DESIGN.md) and [asset manifest](afterstrike/assets/manifest.json).

Run `node afterstrike/test.cjs` for the verification suite and `node afterstrike/verify.cjs` to regenerate real-action completion routes for every weapon. Canvas snapshots and hardware-testing limitations are documented in [QA](afterstrike/QA.md).


## Play BLACKOUT PROTOCOL

Open `blackout-protocol.html` from a local server or choose its card in the library. **Deploy into campaign** opens the operations board: six operations across Acts I–II (THE CRASH, NO SAFE GROUND, DEAD FREQUENCY, UNDERGROUND, IRON CONVOY, GHOST SIGNAL), each with a briefing, recommended gear, four difficulty tiers (story / standard / high intensity / **insane**) and a loadout of one primary, one secondary, one lethal and one tactical gadget. **Armory** spends credits on weapons, gadgets and upgrades and shows your rank, daily contracts and medals. **HOLDOUT** (after THE CRASH) is endless waves. The **training range** has every weapon and gadget and never changes progress.

| Action | Keyboard / mouse | Controller |
|---|---|---|
| Move / aim / fire | WASD / mouse / left click | Left stick / right stick / RT |
| Steady aim / sprint | Right click / Shift | LT (aim assist lock) / LB |
| Roll / combat dive | Space / Shift + Space while moving | A |
| Slide | Ctrl while sprinting | B |
| Interact / vault | E | X (reloads when nothing is in reach) |
| Reload | R (or fire an empty magazine) | D-pad up (or X) |
| Swap weapon / select | X or mouse wheel / 1, 2 | **Y** |
| Knife combo / heavy knife | Tap F / hold F | R3 |
| Stim / lethal / tactical | Q / G / C | D-pad left / RB deploys the selected gadget, D-pad right switches lethal ↔ tactical |
| Pause | Escape | Start |

Enemies drop their guns: walk over one you don't own to unlock it for good, press interact to swap it in now. Kills pay bounties, chained kills raise a combo multiplier, and the debrief adds completion, rating, medal, first-clear, contract, streak and difficulty bonuses (insane pays ×2.2). Low health brings a pulsing red vignette with heartbeat and breathing until you heal. All controls rebind in settings.

`npm ci` installs QA dependencies only. `npm test` runs deterministic systems and control-packet replays of every operation (and checks that insane punishes open-field play); `npm run build` validates and packages the static distributable in `dist/`. `npm run test:browser` launches its own temporary server for real Chromium input, graphics, audio context, pause, settings and persistence checks. Install its browser with `npx playwright install chromium` if needed. See [game design](blackout/GAME_DESIGN.md), [asset licenses](blackout/ASSET_MANIFEST.md), [animation scope](blackout/ANIMATION_SPEC.md), [campaign plan](blackout/CAMPAIGN_PLAN.md), [testing](blackout/TEST_REPORT.md), and [progress](blackout/DEVELOPMENT_PROGRESS.md).
