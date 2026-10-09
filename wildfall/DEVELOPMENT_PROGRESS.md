# WILDFALL — Development progress

Status as of 2026-10-09. The brief asked for a polished opening chapter before the rest of the campaign; that is where the build stops.

## Milestones

| Milestone | Status |
|---|---|
| A. Engine choice, asset research, technical foundation | Done — see `GAME_DESIGN.md` and `ASSET_MANIFEST.md` |
| B. Movement sandbox: jump, grapple, swing, wall-run, air-dash | Built and tested — the Proving Grounds. Not yet judged for feel by a person |
| C. One playable hero and a complete combat loop | Done |
| D. Hero select and three mechanically distinct heroes | Done |
| E. One fully built campaign chapter | Chapter 1, The Fallen Gate, is complete and finishable by all three heroes. "Polished" still needs human playtesting |
| F. More story, enemies, gadgets, bosses, environments | Not started |
| G. Optimise, test and polish the whole game | Chapter 1 only |

## Built

- Deterministic 120 Hz simulation separate from rendering; runs in Node for tests.
- Movement: variable jump, double jump, coyote time, buffering, wall slide/jump/run, slide, air-dash, dive, ledge recovery, moving platforms, blooms, momentum, flow stacks.
- Grapple: anchor targeting, rope constraint, pumping, reeling, release launches, perfect-release window, enemy tethering, Bragg's chain pull.
- Three heroes with different physics, attacks and abilities.
- Combat: chains, launchers, charged attacks, air attacks, dives, hitstop, knockback, poise and stagger, guard and guard-break, parry, perfect dodge, projectile deflection, combo counter.
- Elemental rules: fire, ice, lightning, water, breakable wood/stone/ice, kegs, pylons.
- Six enemy types and a three-phase boss, all with telegraphed attacks.
- Chapter 1 with nine sections, three checkpoints, two arenas, five hidden shards, two inscriptions, intro and outro cards and in-level dialogue.
- Proving Grounds with a timed trial.
- 3D presentation: skinned characters with clip blending driven by simulation time, cloth strips, weapon trails, rope with an aiming arm, drifting islands, waterfalls, cloud sea, shadows, bloom, particles, debris, lightning, camera lead/zoom/shake.
- Audio: 72 sampled effects with a different pitch range per hero, synthesised wind and drone.
- Menus, HUD, settings (difficulty, volume, shake, reduced flashes, quality, controller), versioned local save, keyboard, mouse and controller input.
- Arcade integration: library card, static build, tests.

## Not built

- **Chapters 2–6** (The Hollow Canopy, The Frozen Engine, The Storm Forge, The Shattered Crown, The Sky Engine) and the story's resolution.
- **Gadgets beyond the grapple launcher:** portal device, time-slow, deployable platform, gravity manipulator, decoy, explosive charge and the rest.
- **Upgrades, builds, cosmetics** and any use for collected motes and sky shards beyond counting them.
- **Further bosses and elite enemies**; a purpose-built flying enemy and boss model.
- **Environment mechanics from the brief not yet present:** temporal effects, wind that redirects projectiles, gravity zones, portals. (Wind and hazard zones exist in the simulation but no level uses them.)
- **Control rebinding** for keyboard or controller. The default layouts are fixed.
- **Touch controls.**
- **Composed music and voice.** Only ambience is present.
- **Bespoke animation** for hanging, swinging, wall-running and sliding — currently procedural poses over existing clips.
- **Contextual finishers** and blocking for heroes other than Bragg.

## Suggested next steps

1. Play Chapter 1 and the Proving Grounds with each hero and tune `config.js` — jump arcs, dash, swing limits, enemy damage and boss health are untested by hand.
2. Listen to the sound mix.
3. Try a real controller.
4. Then build Chapter 2 around the grapple, which Chapter 1 only introduces at its end.
