# BLOOD OATH — Design and systems

A side-view, one-on-one fighting game for the NEON ARCADE. Dark fantasy, thick-outlined cartoon characters, stylised blood. It runs as static files in a browser with no backend.

What exists: four playable fighters, a boss, four arenas, Fight (versus the computer), Local Versus, Arcade, Training, a character guide and settings. What does not: see "Not built" at the end.

## How it is put together

| Part | Files | Notes |
|---|---|---|
| Combat engine | `engine/constants.js`, `engine/fight.js`, `engine/match.js` | Plain JavaScript, no browser APIs. One call advances exactly one frame (1/60 s). It takes two inputs and emits events; it never draws or plays sound. Given the same inputs and seed it always produces the same fight. |
| Fighter data | `data/common.js`, `data/<fighter>.js`, `data/roster.js` | Every move is data: frames, hitbox, damage, stun, pushback, cancels, special properties and its animation key poses. Adding a fighter means adding a data file and a skin. |
| Drawing | `render/rig.js`, `render/skins.js`, `render/anim.js`, `render/arenas.js`, `render/view.js` | Canvas 2D. Reads engine state; cannot change it, so effect settings never alter a match. |
| Input | `devices.js` | Two keyboard layouts and any number of controllers. Each player is assigned one device. |
| Computer opponent | `ai.js` | Produces the same kind of input a controller does. |
| Sound | `audio.js` | Sampled effects, streamed music, synthesised ambience. |
| Screens and flow | `main.js`, `../blood-oath.html`, `style.css` | Menus, select screens, HUD, pause, results, training tools, arcade ladder. |

The browser draws as fast as the display allows, but the fight advances in fixed 60 Hz steps (up to four catch-up steps per drawn frame), so speed is the same on a 60 Hz and a 144 Hz screen.

## Controls

Each player uses one device. Defaults (all can be changed in Settings → Remap):

| Action | Keyboard 1 | Keyboard 2 | Controller |
|---|---|---|---|
| Move / jump / crouch | A D / W / S | ← → / ↑ / ↓ | Left stick or d-pad |
| Light, medium, heavy | F, G, H | J, K, L | A, B, X |
| Special | T | I | Y |
| Block | R | U | LB |
| Throw | Y | O | RB |
| Dash | C | N | LT |
| Enhance (hold) | V | M | RT |
| Pause | Esc | Enter | Start |

In menus, light attack confirms and medium attack goes back. Controller names assume the standard layout; a controller that reports a different layout may need remapping.

**Controllers.** A browser only reveals a controller after a button on it is pressed. The first controller to wake is given to player 1 and the second to player 2; the **Controllers** screen shows who holds what, has a live input test for each player, and lets either player be reassigned by pressing a button on the device they want. A device cannot be given to both players. Local Versus always opens this screen first. If a player's controller disconnects mid-fight, the game pauses and names the player; the assignment is kept, so plugging it back in restores control.

## Combat rules

- **Attacks** have startup, active and recovery frames. A move with startup N first hits on its Nth frame. Each attack is high, mid, low or overhead: lows must be crouch-blocked, overheads must be stand-blocked, highs miss a crouching opponent.
- **Blocking** is a button, held facing the attacker. Blocked specials do 16% chip damage; blocked normals do none; chip cannot knock out. Pressing block 5 frames or fewer before impact is a **perfect guard**: no chip, 5 frames less blockstun, half the pushback, four times the meter.
- **Throws** (6 frames, range 92) beat blocking and can be escaped by pressing throw within 9 frames. They cannot catch a jumping or stunned opponent, and there is an 8-frame window after recovering from stun in which a fighter cannot be thrown. Hold back to throw the other way.
- **Combos.** Light → medium → heavy chains, and normals cancel into specials and supers, only on contact. Damage scales per hit: 100, 100, 86, 76, 66, 56, 48, 42, 36, 32, 28%, never below 25%. From the sixth hit, each hit stuns one frame less. An airborne opponent can absorb 6 juggle points; after that they fall out untouched. A combo may use one ground bounce, one wall bounce and one freeze. These limits are why there are no infinites; a test loops each fighter's strongest string for 40 seconds and checks the opponent keeps recovering.
- **Counter-hit.** Hitting an opponent during their own attack does 20% more damage and 6 frames more stun. Two strikes that connect on the same frame trade.
- **Knockdown.** 34 frames down, 18 getting up, then 6 frames of invulnerability.
- **Movement.** 4-frame jump start-up, 3 landing frames (6 after an air attack). Double-tap or press Dash to dash; back dashes are briefly invulnerable.
- **Buffer.** A press is remembered for 7 frames, and does not age during hit-stop, so combos do not need frame-perfect timing.

### Super meter

Three bars (300 points). Meter is gained by landing hits (11% of damage), taking hits (7%), having attacks blocked or blocking (4%), and a little for using specials. It carries between rounds, not between matches.

| Use | Cost | What it does |
|---|---|---|
| Enhanced special (hold Enhance + special) | 1 bar | A stronger version: faster, armoured, invulnerable or multi-hit depending on the move |
| Super (Heavy + Special) | 2 bars | Invulnerable or armoured approach; on hit a short cinematic deals heavy damage. Very punishable if blocked |
| Oath Break (Block + Enhance while being hit, after the second hit) | 2 bars | Bursts out of a combo and knocks the attacker away. No damage |

### Status effects

Burn (Cinder): small damage over time. Chill (Rime): walking is 30% slower. Freeze (Rime): holds the opponent for 56 frames, once per combo, then immunity for 5 seconds. Bleed (Vesper): up to three stacks, each adding 6% to damage taken, with a slow drain. None of them can knock out.

## Fighters

Frame data for every move is in `FRAME_DATA.md` (generated from the game data) and in the in-game Character Guide.

- **CINDER, the Ash Wraith — rushdown.** Fastest walk and normals, lowest health (950). Ember Shot (fireball), Scorching Chain (drags the opponent in; unsafe on block), Hellstep (teleport behind, away, or above; vulnerable on arrival), Flame Burst (close launcher), Ashfall (air dive), Inferno Break.
- **RIME, the Frostbound — zoning and counters.** Frost Lance (projectile), Ice Prison (freeze), Glacier Counter (answers highs, mids and overheads; loses to lows and throws), Frozen Echo (a decoy that absorbs a hit and bursts), Absolute Winter.
- **VESPER, the Blood Duelist — footsies and parries.** Long sword normals and bleed. Thorn Arc (projectile), Crimson Draw, Perfect Parry (very short window; staggers the attacker), Bloodstep (passes through), Falling Thorn (air), Red Eclipse.
- **GRIT, the Iron Breaker — armour and grabs.** Slowest, most health (1180). Quake Drive (low ground shockwave), Hammerfall (armoured overhead), Iron Guard (absorbs two hits, branches into a swing), Siege Toss (command grab; cannot be escaped, can be jumped), Worldbreaker.
- **MALGRAVE, the Oathkeeper — boss, not selectable.** Fights behind an **Oath Ward**: two charges that each absorb a strike at half damage without flinching, and regrow one at a time while he is not being hit. Throws ignore the ward and a super shatters it. Below 40% health the ward refills at once and regrows almost twice as fast.

## Modes

- **Fight.** One match against the computer at the skill chosen in Settings.
- **Local Versus.** Two players, two devices. Independent select cursors; rematch or return to character select from the result screen.
- **Arcade.** The three other fighters in turn, each a little stronger, then Malgrave in the Oath Pit with his own music. Story cards between fights and an ending per fighter. Losing offers a retry and counts continues. Completion is saved and shown on the arcade library card.
- **Training.** No timer or knockouts; health refills when a combo ends. The panel shows combo hits and damage, the last move's startup/active/recovery and advantage on block, both fighters' states, and an input history. Pause menu: hitbox display, infinite meter, six dummy behaviours (stand, crouch, jump, block everything, block after the first hit, fight back), reset positions (also Backspace or the controller's Back button).
- **Character Guide.** Every move with its input, properties and frame data.

Matches are best of three by default; rounds to win (1–3) and the timer (60, 99, off) are settings.

## Computer opponent

The AI is given the fight state and its own side and returns an input, the same shape a controller produces. It is never given the other player's buttons. What it knows about the opponent is delayed by its reaction time (22, 15, 11 or 8 frames from Novice to Oathsworn), and whether it blocks, guesses high or low correctly, punishes and anti-airs is decided by dice weighted by level. Each fighter has a profile (Cinder aggressive, Rime ranged, Vesper balanced, Grit defensive, Malgrave boss) that sets how often it approaches, zones, throws and retreats. Automated matches show the top level beats the bottom level in at least 9 of 12 pairings.

## Comfort and accessibility

Settings: music, effects and ambience volume with a mute; blood full, reduced or off; screen shake 0–100%; reduced flashes; every key and controller button can be remapped. Someone whose system asks for reduced motion starts with flashes reduced and shake lowered. All menus work with keyboard, controller or mouse. Settings and mappings are saved in the browser; if storage is blocked the game still plays without saving.

## Not built

- **Volt and Nyx.** The brief allowed four polished fighters ahead of six unfinished ones; only four plus the boss exist.
- Finishing moves, arena hazards or stage transitions, a tutorial, combo trials, replays, dummy recording and frame-stepping in Training.
- Online play. The engine is deterministic, which is the prerequisite for rollback netcode, but nothing network-related exists.
- Touch controls. The page letterboxes on a phone but is not playable there.
- Bespoke super cinematics. Supers use a darkened stage, a camera push-in and a keyed attack sequence, not individually directed scenes.
