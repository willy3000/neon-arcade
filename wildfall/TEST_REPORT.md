# WILDFALL — Test report

Run on 2026-10-09 on Windows 11, Node 24, Playwright 1.58 (Chromium), NVIDIA RTX 2060.

## How to run

```sh
npm run test:wildfall           # mechanics tests, then three full Chapter 1 playthroughs (no browser needed)
npm run test:wildfall:browser   # real-browser checks against the working tree
npm run build && node wildfall/tests/browser.cjs --production   # the same checks against dist/
```

## Results

| Suite | Result |
|---|---|
| Mechanics (`tests/sim.test.mjs`) | 37 of 37 passed |
| Chapter 1 playthroughs (`tests/playthrough.test.mjs`) | Vyx, Sera and Bragg each completed the chapter |
| Real browser, working tree (`tests/browser.cjs`) | 15 of 15 passed; no console errors, no missing files |
| Real browser, built `dist/` | 15 of 15 passed |
| Existing arcade suites (`npm test`, `npm run test:browser`) | Still pass after adding the library card and build entries |

### Mechanics tests cover

Variable jump height; jump buffering and coyote time; double jump and refills; wall slide, wall jump and chimney climbing; Vyx's wall-run versus the others; back-wall running; air-dash limits and momentum; Sera's blink and glide; sliding under a low arch and slide-jumps; ledge recovery; moving platforms and momentum hand-over; one-way ledges; sky blooms and dive-blooms; grapple targeting (range, aim cone, line of sight, needs the launcher); the rope constraint (the hand never drifts more than 2 cm beyond the rope over six seconds of swinging); pumping, reeling and release; perfect release and jump-release; hero differences; combo chaining and hit-frame timing; launchers; charged attacks; dive pogo and Bragg's floor break; shields versus dives, guard-breaks and lightning; ice, fire, water and lightning interactions; Sera's ice platform; kegs, cracked stone, barricades and pylons; Bragg's shield, parry and chain pull; perfect dodge; enemy telegraphs and interrupts; the boss's three phases and stagger; pit recovery and defeat; checkpoint save and restore; arena gates and waves; determinism; same-tick input and presses during hitstop; save-data validation; level integrity.

### Playthroughs

A deliberately simple bot (`tests/bot.mjs`) follows waypoints through the whole chapter on Story difficulty: it runs, jumps when it must, hits what is in reach, steps away from telegraphed attacks and swings the final anchors.

| Hero | Game time | Enemies defeated | Hits taken | Health at the end |
|---|---|---|---|---|
| Vyx | 108.9 s | 23 | 8 | 74 / 100 |
| Sera | 104.2 s | 18 | 4 | 77 / 85 |
| Bragg | 112.1 s | 23 | 10 | 89 / 140 |

This shows every required jump, both arenas, the boss and the grapple finale are completable by each hero. It does not show the chapter is well paced or fun.

### Browser checks cover

Title and asset loading; hero select by mouse and keyboard; running, held jumps, double jump and air-dash with real key presses; a melee combo; latching, swinging and releasing the grapple with a held key; wall-run; pause on key press and on window blur; Sera's glide and ice platform, Bragg's health and Seismic Leap; a simulated controller moving, jumping and grappling with controller labels on the HUD; intro cards, a checkpoint save and CONTINUE after a page reload; defeat and respawn at the checkpoint; the gate court arena; settings persistence and a corrupt save; a 390-pixel-wide viewport; the library card.

Frame rate during the gate court fight: 60 fps median, 60 fps at the slowest 5% of frames, at 1366×768 on High quality.

## Problems the tests found, and the fixes

- **Sky blooms had a 0.5 m lip**, so walking into one made the hero hop over it instead of bouncing. Blooms now sit flush with the ground.
- **A latched hero could not run on the ground**, so a grapple fired from a ledge left Sera and Bragg standing still. The rope is now a leash while grounded.
- **The final landing was level with the take-off**, so long-rope swings arrived below it. The landing island is now 3 m lower than the take-off.
- **The second bloom needed jump held for Bragg to reach the upper terrace.** Its launch power was raised.
- **Moving platforms and conjured solids were given no id**, so only one of several moving platforms was drawn in the right place.
- **Vyx's charged lunge travelled 4 m before its hitbox opened**, passing through things directly in front. The hitbox now opens almost immediately.
- **Multi-hit spins knocked the target out of range after the first hit.** Their knockback was reduced.
- **Pause was applied on the next frame**, not on the key press. It is now immediate.

## What has not been tested

- **Nobody has played it.** All input came from scripts. Whether the movement feels good, the difficulty is fair or the chapter is fun is unverified, and the tuning numbers in `config.js` are first guesses.
- **No physical controller.** Controller support was exercised only through a simulated gamepad object.
- **Audio was never listened to.** Files load and play calls are made without error; the mix, timing and whether sounds suit their actions are unchecked.
- **One browser, one machine.** Chromium on a desktop GPU only. Firefox, Safari, integrated graphics and phones are untested. There are no touch controls.
- **Mastery difficulty** and the route bot on Standard were not run.
- **Long sessions.** No soak test for memory growth.
- **The Proving Grounds trial** timer was exercised by events only, not by a full timed run.
