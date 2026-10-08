# NEON ARCADE

A browser game library featuring NEON RUSH (arcade survival), GRAVITY HEIST (gravity puzzles), and ECHO FORGE (soundwave physics puzzles). All use HTML5 Canvas, vanilla JavaScript, CSS, and synthesized Web Audio. No build step or runtime dependencies.

## Run

Open `index.html` in a modern browser, or serve this directory locally:

```sh
python -m http.server 8000
```

Then visit http://localhost:8000. Select a game from the library to play. NEON RUSH is also available directly at `neon-rush.html`; use **ALL GAMES** in its header to return to the library. An internet connection is only used for optional Google Fonts; system fonts work offline.

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

Publish the repository root (`.`) with **no build command**. `netlify.toml` sets the publish directory. The library is `index.html`; each game has its own real HTML route, with relative assets and no SPA rewrites. Games also work by opening HTML files directly. Progress is browser-local and is not shared between file URLs, localhost, and deployed sites.

## Implementation

`index.html`, `library.css`, and `library.js` provide the responsive game library. The registry at the top of `library.js` lists released games and their playable pages. The library displays saved personal bests and refreshes them when returning with the browser Back button. To add another game, create its page, add a registry entry, and supply its card artwork.

`neon-rush.html` contains the game menus and accessible controls; `style.css` handles game presentation; `game.js` owns simulation, rendering, input, scoring, and audio. A 120 Hz fixed simulation step keeps movement, collision checks, and scoring independent of rendering frame rate. Canvas resolution follows device pixel ratio (capped at 2). Obstacle rows reserve a two-lane corridor, share speed, and maintain at least 0.9 seconds between rows. Difficulty ramps up gradually and is capped.

GRAVITY HEIST lives in `gravity-heist.html` and `gravity/`: `levels.js` defines rooms; `physics.js` implements pure simulation and interactions; `render.js` draws the letterboxed, high-DPI viewport; `audio.js` synthesizes sounds; `game.js` manages screens and saved progress; `input.js` handles controls and focus. Physics runs at 120 Hz with a 420 px/s velocity cap, limiting travel per step to 3.5 pixels, below the thinnest obstacle thickness. No simulation step uses rendering frame duration directly. Reduced-motion preferences disable decorative motion, trails, and screen shake.

ECHO FORGE is isolated in `echo-forge.html` and `echo/`, with separate level, physics, audio, rendering, input, and game-state modules. It uses a 120 Hz simulation with axis-resolved circle/rectangle collisions, circle/circle cargo contacts, a 380 px/s object speed cap, line-of-sight sound propagation, one hit per object per wave, up to 32 active waves, depth-limited echo chains, and a reusable 240-particle pool. Its viewport is letterboxed rather than stretched, device pixel ratio is capped at 2, and reduced-motion preferences disable decorative animation and simplify wave effects.
