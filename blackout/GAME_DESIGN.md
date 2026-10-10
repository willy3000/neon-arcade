# BLACKOUT PROTOCOL — design

Desktop top-down military action, isolated from the other NEON ARCADE games. Six campaign operations (Acts I–II), an endless HOLDOUT mode, a live-fire range, an armory economy and four difficulty tiers. Act III (three chapters) is planned, not playable.

## Stack decision

Phaser 3.90.0 (MIT), vendored locally: sprite atlases, layered game objects, render textures, camera bounds/look-ahead/shake, asset preloading, scaling and pooled sound voices. A pure CommonJS/browser simulation (`core.js`) owns collisions, AI and combat at 120 Hz, so every mechanic is testable without a browser. `missions.js` holds level data, `world.js` the weapon/enemy/gear tables, `meta.js` the economy, `save.js` the versioned save. No backend, bundler or runtime CDN.

## Modes

- **Campaign** — six operations unlocked in order from the operations board. Each has a briefing, recommended equipment (with a buy button), a difficulty choice and a loadout. Checkpoints resume a run; dying keeps the checkpoint and counts against the NO DEATHS medal.
- **HOLDOUT** — endless killhouse waves (unlocked by finishing THE CRASH). Budgeted, escalating compositions; a commander every fifth wave; credits for every cleared wave; best wave saved per difficulty.
- **Training range** — every weapon and gadget, never touches progress.

## Difficulty

Story, standard and high intensity keep their original damage (×.55 / ×1 / ×1.22) and cadence. **Insane** is the skill tier:

- every authored soldier gets a reinforcement beside it (marksmen are replaced by mission specialists so sniper pairs don't decide fights), and waves get extra spawns;
- incoming damage ×1.85, post-hit protection .14s instead of .32s;
- riflemen fire 3-round bursts; enemy fire cadence ×.62, wind-up ×.8, bullet speed ×1.3, aim leads 60% of your movement;
- every alerted enemy hunts along a breadth-first path field instead of waiting at your last-seen corner;
- enemies keep suppressing your last position and lob grenades at a player who stays within 110 units of one spot for 3.2s;
- fewer drops, no director medkits, 55-health checkpoint floor.

Everything stays telegraphed (wind-up lines, red sniper lasers, grenade rings, damage-direction arcs), so death comes from position and timing, not hidden rolls. Rewards scale ×.6 / ×1 / ×1.4 / ×2.2; lowering difficulty mid-mission pays at the lowest tier played.

## Combat loop and movement

Unchanged from the opening slice: 250/360 run/sprint, slide → vault PERFECT FLOW, roll/dive invulnerability windows, three-hit knife combo, heavy knife, stims that damage interrupts. Fixes and additions:

- Reload and stim timers now settle at exactly zero. Before, a tiny negative remainder still read as "reloading", which blocked sprint (and slowed movement and later reloads) until a melee or roll reset it.
- Two weapon slots (primary + secondary), toggled with X / mouse wheel / controller **Y**, or selected with 1 / 2.
- Firing an empty magazine starts a reload.
- Controller X interacts or vaults when something is in reach, otherwise reloads; D-pad left is a dedicated reload.

## Weapons, drops and loadouts

Seventeen guns: ten primaries (MK18, M870, MP7, SVK-9, KV-15, M110, M249, AS-12, M32, XR-9 pulse, ARC-7 rail) and six secondaries (P226, VZ-61, .44, sawed-off, M79, AT4). Enemies carry real guns that improve across the campaign (`map.guns`). Killing a carrier of a gun you don't own always drops it; walking over it unlocks it permanently, interact swaps it into its slot on the spot. Enemies also drop ammo, health, armor, lethal or tactical refills by type. Weapon mastery (20/60/150 kills) adds reserve ammo, faster reloads and then damage.

Gadgets: lethal (frag, incendiary, proximity mine) and tactical (flashbang, smoke, EMP, holo decoy, deployable cover). Smoke blocks enemy sight; flash stuns anyone who can see the blast; EMP destroys drones, blinds sentries/armour and drops shields and barriers; the decoy draws fire; cover drops a 280-hp vaultable barrier.

## Enemies and bosses

Riflemen, rushers, marksmen, shields, drones and the commander are joined by scouts (SMG bursts), breachers (shotgun pushers), grenadiers (lobbed shells with ground rings), machine gunners (long tracking bursts), rocketeers (laser-telegraphed rockets that destroy cover), sentry guns (front-armoured, slow turn — flank or EMP them), cloaked ghosts (only visible up close), bomb drones and Halcyon elites (pulse bursts). Bosses: the **Wraith** (blinks between perches after every shot), the **Bulwark** (armoured roadblock: bullets do 12%, explosives full; mortar salvos; EMP opens a window) and the **Warden** (mech whose barrier cuts damage 92% until a generator is destroyed or it is EMP'd; stomps up close). Killing a boss or finishing a defence routs that fight's reinforcements.

## Economy and retention

Credits come from kill bounties (combo multiplier up to ×3 for chained kills, ×1.5 knife), mission completion, rating, flows, NO DEATHS, intel, first clears per difficulty, medals (5 per operation), daily contracts (3 rotating per day), a daily-operation streak bonus, rank-ups (150 × rank) and the Scavenger upgrade. They buy guns, gadgets and seven three-level upgrades. Each later operation is tuned around specific gear the briefing recommends: smoke and a long rifle for Dead Frequency, flashbangs for Underground, explosives for the Bulwark, EMP for Site Meridian.

Feedback: animated debrief tally, XP bar and award cards; NEW WEAPON / combo / objective banners; credit popups; hit and kill markers; slow-motion on boss kills and wave clears; damage-direction arcs; low-health red pulse with heartbeat and laboured breathing until healed; flashbang white-out and ringing; bullet whiz; per-theme ambience and weather.

## Destruction and rendering

Props own real health; destroyed props stop blocking. New walls: water and chain-link fence (block movement, not bullets or sight), gates opened by objectives, jammers/servers/generators, fuel tankers. Six themes (city, ruins at dusk, night snowfield, blacked-out subway, desert highway, lab facility) are baked into one texture per map. The subway uses a render-texture darkness layer with a flashlight cone, lamps, muzzle flashes and explosions erased out of it.
