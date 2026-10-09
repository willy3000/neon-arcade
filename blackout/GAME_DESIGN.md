# BLACKOUT PROTOCOL — shipped opening slice

Desktop top-down military action, isolated from the other NEON ARCADE games. The release includes THE CRASH and a repeatable live-fire range. Eight later chapters remain production plans.

## Stack decision

Phaser 3.90.0 (MIT), vendored locally: sprite atlases, layered game objects, camera bounds/look-ahead/shake, asset preloading, scaling, sound decoding and pooled sound voices. WebGL and Canvas are supported render paths. Hardware-backed WebGL is preferred; software WebGL selects Phaser's Canvas renderer after local profiling showed a substantial advantage. QA can force `?renderer=webgl` or `?renderer=canvas`. The same scenes, sprites, cameras and audio run in either path. A pure CommonJS/browser-compatible simulation owns collisions and animation-driven combat at 120 Hz. No backend, bundler, runtime CDN, SPA rewrite or installed dependencies are needed to play from HTTP(S).

Evaluated [Phaser](https://phaser.io/) and [PixiJS](https://pixijs.com/8.x/guides/getting-started/intro). PixiJS is suitable for rendering but would require additional scene, camera, input, collision and audio integration. Matter.js would add general rigid-body physics that this deterministic top-down combat does not need. Phaser provides the useful integration, while a bounded custom swept collision layer makes movement and hit timing testable without a browser. Arcade Physics is available in the engine but this release does not use it; claiming otherwise would misdescribe the stack.

## Combat loop

Move → control distance → fight → use resources → reach the next checkpoint. Rifle and pistol are available after the crash. The supply cache unlocks shotgun and frags through dialogue. Q injects a stim after 0.85 seconds; damage or an evasive action interrupts it before consumption. Armor absorbs 65% of incoming damage while available. Pickups restore useful resources, and the director adds ammo support when reserves are low.

Walk/run acceleration uses a 25/s response and braking a 31/s response. Normal speed is 250 world units/s, sprint 360. Diagonals normalize. Rifle movement remains independent of mouse aim; steady aim slows to 175. Weapon mass multiplies movement speed. Sprint consumes stamina; ordinary movement regenerates it.

Slide requires moving above 265 units/s, begins at at least 490, and decays exponentially over 0.7s. It permits firing and passes through designated range underpasses. Vaulting crosses eligible low cover only when the landing is clear. Slide → vault in the first 0.07–0.44s shortens the vault from 0.37s to 0.26s and refunds 12 stamina. Slides into knife attacks and melee recovery into a roll also trigger flow. These bonuses are optional.

Roll costs 30 stamina and lasts 0.4s. Invulnerability is 0.055–0.25s. Sprint + roll commits to a 0.63s dive, costs 40 and grants protection from 0.07–0.28s. Neither permits firing. Melee uses startup/active/recovery timing, one hit per eligible target, three escalating quick strikes (45/55/80 damage), and a held heavy strike (95). Heavy strikes bypass shield facing protection; weakened targets permit an immediate finisher. Successful melee hits cause 25ms hitstop with buffered action inputs.

## Weapons

| Weapon | Magazine | Shot interval | Reload | Damage | Role |
|---|---:|---:|---:|---:|---|
| MK18 rifle | 30 | .105s | 1.65s | 24 | Sustained, controlled fire |
| M870 shotgun | 6 | .72s | 2.15s | 8 × 18 | Close range stagger, broad blast |
| P226 pistol | 15 | .25s | 1.1s | 31 | Accurate, mobile fallback |
| MP7 SMG | 40 | .065s | 1.45s | 14 | Fast, short range suppression |
| M110 precision | 8 | .85s | 2.1s | 105 | Range, two-target penetration |
| M249 LMG | 75 | .09s | 3s | 27 | Sustained fire, movement penalty |
| M32 launcher | 6 | .8s | 2.6s | 95 + area | Destruction and grouped targets |
| AT4 rocket | 1 | 1.1s | 2.8s | 190 + area | High impact, slow handling |

The last five firearms are range equipment, not campaign unlocks in THE CRASH. Weapon-specific projectile speed, range, recoil, spread, sampled sounds, penetration, reload and mass are live mechanics. Recoil follows a deterministic pattern and settles over time. The knife is a separate melee system.

## Enemies and director

Infantry perceives through line of sight, seeks nearby cover when injured, flanks during cooldown, and reloads every five shots. Rushers close for a timed strike. Snipers show a long telegraph and remember where a target was seen; they do not acquire through walls. Shield troopers face their protection toward the target but are vulnerable to heavy knives, explosives and off-angle attacks. Training adds orbiting drones. The extraction commander gains grenade attacks at 66% health and a three-shot spread at 33%, with readable transitions.

Director pressure combines hostile density and health; recovery periods delay the second wave after damage. Reinforcements receive 2.3s warning and a minimum 340-unit separation. Low reserves trigger a limited ammo supply; low health before the commander can trigger a medkit. Story/standard/intense alter damage and attack cadence. Enemies retain archetype health across difficulties.

## Destruction and rendering

Crates, cover, glass, weak walls, barrels, vehicles and consoles own real health. Destroyed props stop blocking movement and bullets. Barrels and vehicles chain area damage; consoles stagger nearby machines/units. Muzzle locations are checked against intervening cover so a protruding weapon cannot shoot through a wall. Projectiles use swept segment tests, axis-resolved movement uses substeps no larger than 7 units, and vaults validate endpoints.

Static floor and roof marks are baked once into a texture; props remain interactive. Camera culling hides distant characters. Projectile capacity is 192, visual particles 320, decals 160, effect queues 256 and simultaneous samples use capped per-sound voice pools. Essential assets load once; this release has no later-chapter streaming requirement. Cameras combine aim and motion look-ahead. Shake and flash can be reduced. Hidden tabs and focus loss pause play and clear input.

## Scope boundaries

Not shipped: eight later chapters, mobile controls, grapple/EMP/flash/shield/decoy/remote gadgets, full cosmetic/upgrade trees, human voice acting or a bespoke animation for every movement verb in the original brief. This slice is not presented as the complete nine-mission flagship. See the animation spec and progress log for concrete gaps.
