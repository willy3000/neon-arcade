# WILDFALL: BREAK THE SKY — Design and architecture

A momentum action-platformer for NEON ARCADE. This document describes what is built. `DEVELOPMENT_PROGRESS.md` lists what is not.

## Rendering technology

| Option | For | Against | Verdict |
|---|---|---|---|
| Phaser (already vendored for Blackout Protocol) | Mature 2D toolset, no new dependency | No skeletal 3D characters; depth, lighting and parallax would all be faked with sprites; no suitable licensed 2D animation set was found | Rejected |
| PixiJS | Fast 2D renderer | Same limits as Phaser with less game tooling | Rejected |
| Babylon.js | Full 3D engine with physics, inspector, animation blending | Roughly 4–5× the download of three.js for features this game does not use | Rejected on size |
| **three.js** | Skinned glTF characters, real lights and shadows, fog, bloom; about 790 KB as one bundled file; loads and runs in Node, which let a tool measure animation timing offline | No built-in game loop or physics — both written here | **Chosen** |

**Camera and physics.** The game is 2.5D: a perspective camera looks side-on at a fully 3D world, while play happens on one 2D plane. Jumping, wall-running and rope swinging read best side-on, and a 2D plane keeps the physics deterministic and testable. Full free-roaming 3D was rejected because camera control, 3D collision and 3D level authoring would have consumed the effort that went into movement feel.

**No physics library.** Collision is axis-aligned boxes with a fixed 120 Hz step. The grapple is a distance constraint on the player. This is small, exact, and identical in the browser and in tests.

**Static hosting.** No build step is needed to deploy. three.js is bundled once into `vendor/three.bundle.min.js` (`esbuild --bundle --format=esm --minify` over an entry that re-exports three and the six add-ons listed in the asset manifest).

## Architecture

```
wildfall.html            page, menus, HUD markup
wildfall/config.js       every tuning number: physics, grapple, characters, combat, difficulty
wildfall/sim/            the game itself — no browser or rendering dependencies
  world.js               solids, moving platforms, raycasts, zones
  player.js              movement controller and grapple
  combat.js              damage, hitboxes, projectiles, explosions, elemental rules
  characters.js          attack data and abilities for the three heroes
  enemies.js             enemy roster, behaviour, the boss
  index.js               createSim / step / snapshot, pickups, checkpoints, triggers, arenas
wildfall/levels/         level data: builder.js, chapter1.js, proving.js
wildfall/render/         three.js: scenery.js (world), actors.js (animation), vfx.js, index.js (camera, events → effects)
wildfall/input.js audio.js save.js ui.js main.js
wildfall/tests/          sim.test.mjs, playthrough.test.mjs (+ bot.mjs), browser.cjs
wildfall/tools/          prepare-assets.mjs, analyze-clips.mjs
```

The simulation emits events (`jump`, `hit`, `explosion`, `checkpoint`, …). The renderer, audio and UI each react to the same stream, so nothing visual can affect gameplay.

**Animation follows the simulation.** `tools/analyze-clips.mjs` measures when each attack clip actually swings (peak hand speed). Each attack stores that moment as `impact` and the time its hitbox opens as `hitAt`; the renderer sets the clip position from simulation time so the two coincide, and the pose freezes during hitstop. Enemy windups stretch the clip's anticipation across the telegraph.

## Movement

All values are in `config.js`.

- **Jump:** variable height (hold for 3.4 m, tap for 1.8 m), 0.10 s coyote time, 0.13 s input buffer, lighter gravity at the apex, heavier on the way down.
- **Double jump**, **wall slide**, **wall jump** (chains count as a technique), **ledge recovery** (a jump up to 1.25 m short pulls the hero up).
- **Dash / air-dash:** eight directions in the air, once per airtime. A jump out of a ground dash becomes a long leap.
- **Slide:** hold down + dash while running; halves the hitbox to pass under 1 m gaps; a jump out keeps the boost.
- **Wall-run:** holding a direction across a rune-marked back wall carries speed along it; jump to leap off. Vyx can also run straight up side walls.
- **Dive:** down + attack in the air. Landing sends out a shockwave; landing on an enemy springs the hero back up (Bragg crushes through instead).
- **Sky blooms** launch upward (higher with jump held, higher again from a dive). **Moving platforms** carry riders and hand their velocity to a jump.
- **Momentum:** speed above the run cap is kept in the air and bleeds off slowly on the ground.
- **Flow:** each technique (perfect release, wall chain, dash jump, slide jump, pogo, deflect, …) adds a stack, up to six, each worth +2% run speed. Stacks expire after four seconds or on taking a hit.

### Grapple

Hold the grapple button to fire at the best anchor inside a cone around the aim direction (mouse, right stick, or held direction), within range and with a clear line. The hook travels at 75 m/s; on arrival the rope length is fixed and the hero swings as a pendulum. Left/right pumps the swing up to a per-hero limit; up/down reels in and out, and reeling in speeds the swing up (angular momentum). Releasing keeps the swing's velocity. A release between 23° and 69° above horizontal at speed is a **perfect release** (+17% speed). Jumping off the rope adds lift. Latching refills the air-dash and double jump. Falling out of the world costs a little health and returns the hero to the last safe ground instead of ending the run.

## Heroes

| | Vyx — The Kinetic | Sera — The Elementalist | Bragg — The Juggernaut |
|---|---|---|---|
| Health / run speed | 100 / 10.2 | 85 / 8.8 | 140 / 7.9 |
| Mobility | Runs up walls, longest wall-run, dash keeps all its speed and dodges attacks | Glides while jump is held; dash is a short blink | Lowest jump; dash is a Bull Rush that damages and breaks cracked walls |
| Grapple | 12 m, fastest swing, boosted release | 10 m | 8.5 m; fired at an enemy it drags them in, or hauls Bragg into heavy ones |
| Light attack | Three-hit blade chain; three-hit air chain | Fire bolts, angled with up/down | Two heavy axe swings |
| Heavy | Launcher — hold jump to follow the target up | Fireball that explodes | Earthsplitter with a ground shockwave; breaks guards |
| Charged heavy | Kinetic Lunge through a line of enemies | Meteor | Cyclone spin |
| Ability 1 | Kinetic Blades — three thrown blades | Ice Platform — a real, temporary platform; freezes nearby enemies | Bulwark — hold to block, raise on time to parry |
| Ability 2 | Phase Dash — long invulnerable dash that cuts through enemies | Chain Lightning | Seismic Leap — a very high jump with a slam on take-off and landing |
| Dive | Springs off enemies | Lands with a burst of fire | Largest shockwave; breaks cracked floors |

New heroes are added by a `CHARACTERS` entry in `config.js`, a kit in `sim/characters.js` and a view entry in `render/actors.js`.

## Combat

Attacks have startup, an active window with a hitbox in front of the hero, and recovery; pressing the next attack after the cancel point chains it. Hits apply hitstop, knockback, poise damage and combo count. Enemies stagger when poise breaks; launched enemies fall under lighter gravity so they can be juggled. Dashing through an attack as it lands is a **perfect dodge**: brief slow motion and +60% damage for two seconds. Striking an enemy projectile sends it back.

### Elemental rules (`sim/combat.js`)

| Hit | On enemies | On the world |
|---|---|---|
| Fire | Burns over 3 s; thaws frozen targets and leaves them wet | Burns wooden barricades; melts ice at once |
| Ice | Freezes (instantly if wet); frozen targets take double from heavy hits and shatter | — |
| Lightning | Ignores shields; +80% on wet targets | Electrifies a whole pool of water, hitting everything standing in it |
| Slam / charge / explosion | Break guards, launch | Break cracked stone; wake pylons |
| Blade | — | Chips wood and ice only |

Powder kegs burst 0.7 s after being struck (at once from fire) and set off neighbours. Pylons wake only to real force — a charged kinetic lunge, a slam, a blast or lightning — and then open gates or start lifts.

## Enemies

| Enemy | Behaviour | Answer |
|---|---|---|
| Bonewalker | Walks in, telegraphed slash | Anything |
| Ridge Hunter | Fast; leaps from range; hops back after two hits | Punish the landing |
| Hexcaster | Keeps distance, fires a slow homing orb, blinks away when cornered | Close fast; hit the orb back |
| Gate Bulwark | Shield blocks frontal blades | Dive from above, break the guard, or lightning |
| Sky Wraith | Hovers, then swoops along a line; can be grappled | Air attacks, ranged, or tether it |
| Emberhusk | Sprints in and explodes; its blast hurts other enemies | Kill it among its friends, or dash away |
| The Gatewarden (boss) | Cleave, overhead crush with shockwaves to jump; at 62% calls two Bonewalkers and adds a leap slam; at 30% calls a Hunter and two Emberhusks and adds a spinning charge | Punish long recoveries; breaking its poise staggers it for 2.4 s |

Every attack is a windup with a red glow that brightens until the strike, an active window, and a recovery.

## Chapter 1 — The Fallen Gate

1. **Crash site** — run, jump, a first hidden shard.
2. **Terrace and chimney** — double jump, then wall jumps up a shaft to the first vista of the Gate.
3. **First fight**, checkpoint.
4. **Broken span** — moving platform, optional dash gap, a low arch to slide under.
5. **Gate court** — locked arena, three waves, powder kegs. Checkpoint.
6. **The ascent** — sky blooms, a wall-run with a slower lift beneath it for anyone who prefers it, a cracked wall hiding a shard.
7. **Upper terrace** — a shield-bearer, a Sky Wraith, a flooded hall, a pylon-driven lift to a health restore, a barricade.
8. **The Gatewarden.** Checkpoint before the fight.
9. **The sky-bridge** — the boss leaves the grapple launcher; three anchors cross the gap to the Gate. Falls here cost no health.

Five sky shards and two inscriptions are hidden. Every required obstacle is sized for Bragg, the least mobile hero.

**Proving Grounds** — optional practice level with everything unlocked: training husks, a chimney, a wall-run, a four-anchor grapple line, blooms, moving platforms, a pool for lightning, and a timed trial from the first banner to the last with a saved best time per hero.

## Controls

Keyboard and mouse: A/D run, W/S up/down (reel, aim bolts, drop through ledges), Space jump, Shift dash, C slide, J or left click attack, K or F heavy (hold to charge), L or right click grapple (hold), Q/U ability 1, E/I ability 2, R/Enter interact, Esc pause. The mouse aims the grapple.

Controller (standard layout): left stick move, right stick aim grapple, A jump, B dash, X attack, Y heavy, RT grapple, LB/RB abilities, LT slide, D-pad up interact, Start pause. Menus work with stick or D-pad and A/B. It reuses the reader from `blackout/gamepad.js`.

## Saving

`localStorage` key `wildfall-save`, version 1: chosen hero, Chapter 1 progress (checkpoint, cleared arenas, collected items, gear, flags, stats, best time and rank), trial best times, settings. Progress is written at checkpoints, when an arena is cleared and when gear or a shard is collected. Unreadable or out-of-range data falls back to defaults.
