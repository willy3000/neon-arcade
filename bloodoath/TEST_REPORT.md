# BLOOD OATH — Test report

Run on 2026-10-09 on Windows 11, Node 24, Playwright 1.58 (Chromium), NVIDIA RTX 2060.

## How to run

```sh
npm run test:bloodoath           # combat-engine tests (no browser needed)
npm run test:bloodoath:browser   # real-browser checks against the working tree
npm run build && node bloodoath/tests/browser.cjs --production   # the same checks against dist/
```

## Results

| Suite | Result |
|---|---|
| Combat engine (`tests/engine.test.mjs`) | 29 of 29 passed |
| Real browser, working tree (`tests/browser.cjs`) | 19 of 19 passed; no console errors, no missing files |
| Real browser, built `dist/` | 19 of 19 passed |
| Frame rate during a computer-versus-computer fight | 60 frames per second at 1366×768 in headless Chromium on the GPU above |
| Existing arcade suites (`npm test`, `npm run test:browser`) | Still pass after adding the library card and build entries |

## What was not tested

These are the gaps that matter most. None of them is covered by the numbers above.

- **No physical controller was used.** Every controller check replaces the browser's `navigator.getGamepads` with a fake that the test drives. That proves the game's own logic: device assignment, independence of the two players, pause, disconnect handling and remapping. It proves nothing about real hardware: how a given pad reports its buttons, whether a browser exposes two identical pads as separate devices, Bluetooth latency, or stick drift against the dead zone. **Two real controllers in Local Versus is the first thing to try by hand.**
- **Nobody has played it.** No person has judged how the fighting feels, whether the roster is balanced, whether combos are satisfying or whether the computer's four skill levels are pitched well. Balance rests on frame data chosen by design and on automated matches between computer players.
- **The sound has not been listened to.** The tests confirm all 45 effects load and decode and that the three music files are served. Whether each sample suits its moment, and whether the mix is balanced, is unverified.
- **Animation was judged from still frames.** Pose sheets and screenshots were reviewed; motion was not watched at speed by a person.
- **Only Chromium was run.** Firefox and Safari handle controllers and audio unlocking differently and were not tried.

## What the engine tests cover

- **Data.** Every fighter and the boss has the full move list with valid frames and an animation; at least 16 distinct attack animations and a unique stance per fighter.
- **Frames and hitboxes.** A move with startup N connects on frame N and only during its active frames; out-of-range attacks whiff; single hits hit once and multi-hit moves hit exactly their count.
- **Defence.** Stand block stops mids and overheads, crouch block stops lows, lows beat stand block and overheads beat crouch block; perfect guard removes chip and shortens blockstun.
- **Throws.** Beat blocking, can be escaped inside the window, cannot catch jumping or stunned opponents.
- **Projectiles.** Travel, hit, expire, obey one-on-screen limits and cancel each other out.
- **Combos.** Chains and special cancels work only on contact; damage scaling and stun decay; the juggle limit; launch, knockdown and wake-up throw protection; counter-hits; same-frame trades.
- **Meter.** Gain from hitting, being hit and blocking; costs of enhanced specials, supers and the Oath Break; supers play their cinematic on hit and are punishable on block.
- **Each fighter's own tools.** Cinder's chain pull, teleport and dive; Rime's freeze limits, counter and decoy; Vesper's bleed, parry and pass-through step; Grit's armour and stance follow-up.
- **Boss.** The ward absorbs two strikes at half damage without flinching, regrows on schedule and never beyond its maximum; throws ignore it; a super shatters it and still connects; the 40% phase triggers once, refills the ward and speeds its regrowth.
- **Matches.** Round intro, knockout, best of three, meter carry-over, round reset, time-out to the healthier fighter, double knockout as a draw; training mode never kills, refills health and meter and resets positions.
- **Fairness.** Identical inputs give identical fights; each fighter responds only to its own input; fighters cannot pass through each other or leave the stage.
- **No infinites.** Each fighter's strongest looped string, run for 40 seconds against a passive opponent, always lets the opponent recover.
- **Computer opponent.** It is given only the fight state and its side; matches are repeatable from a seed; every fighter and the boss finish matches and deal damage at the lowest and highest levels; the highest level beats the lowest in at least 9 of 12 pairings.

## What the browser tests cover

1. Boots to the menu with all 45 sounds decoded, no errors, and every menu entry on screen.
2. One keyboard: menu navigation, both select cursors moving independently, and WASD and arrow keys each moving only their own fighter.
3. Two simulated controllers are each assigned to the next free player on first press; the Controllers screen names them and its input test shows the right player's buttons.
4. Assignment is explicit: a device already held by one player is refused for the other; reassigning and swapping work.
5. Local Versus is reachable using only the two controllers; each moves only its own fighter (stick on one, d-pad on the other); the keyboard no longer moves anyone.
6. Simultaneous presses on both controllers give each fighter its own attack.
7. A hit from player 1 damages player 2; held block on player 2's controller stops it with no damage.
8. Pause from either controller stops the simulation exactly; the press that closes the pause menu does not reopen it.
9. Unplugging player 2's controller mid-fight pauses and names the player; plugging it back keeps the assignment and restores control.
10. Winning two rounds reaches the result screen; a rematch resets wins, health, meter and projectiles; returning to character select discards the match, and new picks produce the right fighters.
11. Training: no timer, full meter, health refills after a combo, the frame-data readout, hitbox toggle, dummy behaviour and Back-button reset.
12. Arcade: three rivals, then the boss with his ward (a hit is halved and he does not flinch), the ending, and the completion saved.
13. A computer-versus-computer match runs to its result without stalling.
14. Settings: a slider changed from a controller, a key and a controller button rebound (a clashing binding is swapped), and all of it surviving a reload.
15. The character guide shows at least 18 moves for each of the four fighters and changes fighter from a controller.
16. Frame rate during a fight (see above).
17. A phone-sized window letterboxes with no sideways scrolling.
18. The arcade library lists BLOOD OATH first and shows arcade progress.
19. With browser storage blocked, the game still starts and its settings still work.

In the round-ending and boss checks the test sets health and position directly so a match can finish in seconds; the fights themselves are not won by skill.

## Known limitations

- Four playable fighters; Volt and Nyx are not built. The boss is not selectable.
- Controllers that do not report the standard layout will have differently placed buttons until remapped. Controllers with fewer than eight buttons are ignored.
- Two players on one keyboard may hit the keyboard's own limit on simultaneous keys.
- The computer opponent does not use the Oath Break or enhanced specials, and its combos are short fixed strings.
- At very close range the two character drawings overlap; collision is by box, not by outline.
- A launched fighter rotating near the floor can briefly dip below the floor line.
- Not playable on touch devices.
- Fonts come from Google Fonts when online; offline the game uses system fonts and looks plainer.
