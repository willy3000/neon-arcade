# BLACKOUT PROTOCOL — design

Desktop top-down military action, isolated from the other NEON ARCADE games. Six campaign operations (Acts I–II), an endless HOLDOUT mode, four-a-side TEAM DEATHMATCH, a live-fire range, an armory economy and four difficulty tiers. Act III (three chapters) is planned, not playable.

## Stack decision

Phaser 3.90.0 (MIT), vendored locally: sprite atlases, layered game objects, render textures, camera bounds/look-ahead/shake, asset preloading, scaling and pooled sound voices. A pure CommonJS/browser simulation (`core.js`) owns collisions, AI and combat at 120 Hz, so every mechanic is testable without a browser. `missions.js` holds level data, `world.js` the weapon/enemy/gear tables, `meta.js` the economy, `save.js` the versioned save. No backend, bundler or runtime CDN.

## Modes

- **Campaign** — six operations unlocked in order from the operations board. Each has a briefing, recommended equipment (with a buy button), a difficulty choice and a loadout. Checkpoints resume a run; dying keeps the checkpoint and counts against the NO DEATHS medal.
- **HOLDOUT** — endless killhouse waves (unlocked by finishing THE CRASH). Budgeted, escalating compositions; a commander every fifth wave; a named modifier (Blackout, Armoured, Swarm, Marksmen) on every third wave that is not a commander wave; credits for every cleared wave. After each wave a supply drop lands three priced crates (ammunition, armour, health, a stim, a gadget refill or a gun for the run) bought with that run's credits. Seven killhouses: the default one and one per campaign operation, which pay ×1.1 to ×1.6 and keep their own best wave per difficulty.
- **Team deathmatch** — Team Alpha against Team Delta on any killhouse map, up to four operators a side, players or AI in any mix (1v1, 1v3, 2v2, 4v4...). A kill is a point for the killer's team; first to the kill limit the host picks (5, 10, 15, 20, 30, 50 or 75) wins, or whoever is ahead when the clock runs out. Everyone redeploys five seconds after going down, at their own base, or out of the other team's sight if that base is being watched.
  - **Every operator is whole.** Each one, player or AI, on either team, has the full move set (sprint, slide, roll, dive, vault, knife), two guns, a lethal, a tactical, stims, three perks and field support, from their own loadout. Permanent upgrades, weapon mastery and kit parts are left at the door so everyone starts level.
  - **Operator against operator.** A hit does 85% of its damage and there is no protection after it, so every pellet of a blast lands; only a dodge, a vault or the 2.5 seconds after redeploying (given up by firing) saves you. A knife kills outright. A stun (flashbang, tear gas, EMP, blackout) stops an operator firing and halves their speed for at most 2.2 seconds. Nothing of yours harms your own team; your own grenades can still kill you, which scores for the other side.
  - **Gadgets and support take sides.** A sentry, hound, seeker, mine or fire belongs to whoever put it there and goes for the other team; an EMP or blackout takes the other team's devices down; a trophy system stops their grenades. The other team's grenades and rounds are drawn in red, and their field support is announced ("ENEMY AIRSTRIKE"). The host can switch field support off for a match.
  - **AI operators** are the same operators run by `botInput`, with a frag and a stim they use. "Enemy pressure" becomes **AI skill**: the share of a player's damage they do (40%, 60%, 80%, 100%) and how fast they react.
  - **What you see:** your team's rings and name tags are blue, the other team's red, your own amber. The minimap shows your team always, and an enemy only while they are firing or marked by your recon or your team's sensor darts. A kill feed lists who got whom and with what.
  - **Pay** is per player, on their own machine: half a bounty (25 CR, more in a chain) for each kill, and a result bonus (300 win / 150 draw / 100 loss) scaled down for a kill limit under 30 or a smaller team opposite. Only a match to 20 or more against a team at least the size of your own is kept in the record, counts for the daily and for the "win five" challenge. The AI skill multiplier applies only if there was AI on the other team.
- **Training range** — every weapon and gadget, never touches progress.

Holdout and team deathmatch share one lobby (the COMBAT MODES card on the main menu): mode, map, enemy pressure and loadout are picked there, and it reopens as it was left. Holdout is one operator, or two with a friend (LAN or online) or an AI teammate in the open slot. Team deathmatch shows eight seats, four for Alpha and four for Delta; it opens as you and seven AI. The lobby leader adds or removes the AI in any seat and sets the kill limit and field support; anyone can move to a seat with no player in it, changing places with an AI that was there. Up to seven more players join over a LAN and are seated on the team with fewer players. A match can start once each team has someone in it and every player who has joined is ready; a player who drops out mid-match is replaced by an AI.

**AI teammates in holdout** are squadmates whose controls are worked by the simulation instead of a person (`botInput` in `core.js`). They take a moment to react, aim at a human turning rate with some wander, fire in bursts, deal 45% damage, reload by themselves and never run dry. They stay at your shoulder, fetch your dog tags and revive you. Their kills are not yours: no combo, mastery or kill count, and half a bounty. A holdout squadmate, player or AI, still has the leaner guns-and-knife kit.

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
- Controller X interacts or vaults when something is in reach, otherwise reloads; D-pad up is a dedicated reload, D-pad left injects a stim, D-pad right switches the selected gadget and RB deploys it. D-pad down is unbound because rocker pads report it by accident while right is pressed.

## Weapons, drops and loadouts

The first seventeen guns: ten primaries (MK18, M870, MP7, SVK-9, KV-15, M110, M249, AS-12, M32, XR-9 pulse, ARC-7 rail) and six secondaries (P226, VZ-61, .44, sawed-off, M79, AT4). Enemies carry real guns that improve across the campaign (`map.guns`). Killing a carrier of a gun you don't own always drops it; walking over it unlocks it permanently, interact swaps it into its slot on the spot. Enemies also drop ammo, health, armor, lethal or tactical refills by type. Weapon mastery (20/60/150 kills) adds reserve ammo, faster reloads and then damage.

Gadgets: lethal (frag, incendiary, proximity mine) and tactical (flashbang, smoke, EMP, holo decoy, deployable cover). Smoke blocks enemy sight; flash stuns anyone who can see the blast; EMP destroys drones, blinds sentries/armour and drops shields and barriers; the decoy draws fire; cover drops a 280-hp vaultable barrier.

## The second wave: guns and gadgets with a mechanic each

Five more primaries, each with a rule of its own: the **FR-9 burst rifle** (three rounds a pull), the **RX-4 ricochet carbine** (rounds come off a wall twice), the **M2 flamethrower** (a short stream that passes through a crowd and leaves the ground burning), the **M134 minigun** (0.7 seconds of spin-up, then 200 rounds) and the **TESLA-3 arc caster** (the bolt jumps to two more hostiles for 60% each and stalls machines). That makes 22 guns.

Lethals: **throwing knives** (one drops most soldiers, and the knife lies where it lands to be picked up again), the **cluster grenade** (one blast, then five bomblets), **C4** (planted, set off by pressing again, one charge down at a time) and the **seeker** (a rolling charge that hunts for eight seconds). Tacticals: the **grapple hook** (a fast dive along the line of aim that counts as a flow), the **sensor dart** (marks hostiles near it for twelve seconds), **tear gas** (soldiers in it cannot fight; machines and bosses are untroubled), the **trophy system** (knocks down hostile grenades, shells and rockets near it for twenty seconds) and the **ammo box**.

Four more field support calls: **supply drop** (600), **reinforcement** (1,000; a rifleman at Rook's side for 45 seconds), **gunship** (1,400; circles him for 20 seconds firing over walls) and **blackout** (1,600; a map-wide EMP that fells drones, darkens machines and blinds every soldier for five seconds).

Of these the flamethrower, minigun, C4, grapple hook and blackout are challenge awards (25 kills with fire, wave 12 in holdout, 40 explosive kills, 25 perfect flows, all six operations finished); the rest are sold. Anything the player cannot have yet, because its rank is ahead of them or its challenge is unmet, is drawn in the armory and the pickers as a silhouette in its grade colour beside what it asks for.

## Field support, perks and challenges

**Field support** is one ability carried into a run and called in (V, or BACK on a controller) when its meter is full. The meter fills with Rook's own score: a kill is worth its bounty, a flow 25, a cleared wave 60, an objective 150. It fills at ×1 in holdout, ×1.6 in team deathmatch and ×0.6 in the campaign, and starts again from empty after every call. Kills the support itself makes do not charge it.

- **Recon sweep** (450) marks every hostile on the map and in view for 20 seconds; cloaks and darkness hide nothing.
- **Sentry turret** (800) is set in front of Rook and shoots what it can see for 30 seconds.
- **K9 unit** (900) is a combat hound that paths to the nearest hostile and bites until it drops, for 25 seconds.
- **Airstrike** (1,200) lays six shells along the line of aim, starting at the aim point and walking away from Rook, each with a ring and a second's warning. It hurts him as much as any grenade if he stands in it.

Hostiles do not target the sentry or the hound; their time limit is what ends them. Their kills are Rook's (bounty, combo, kill count).

**Perks** are one per slot in three slots, survival, combat and movement, which open at ranks 2, 5 and 8. They change how a run plays rather than raising a number, which is what the permanent upgrades are for. Survival: Field Dressing (health climbs back to 60 after six seconds unhurt), Flak Vest (blasts and fire do 40% less), Second Wind (one killing blow per run leaves 30 health). Combat: Scrounger (a gun kill returns a quarter magazine to reserve), Ambusher (+35% damage to hostiles that have not noticed you), Executioner (a knife kill gives back 20 health). Movement: Low Profile (hostiles must be a quarter closer to spot you), Flow State (a perfect flow gives three seconds of +30% damage), Hardline (support charges 25% faster).

Some are bought with credits at their tier's rank; the others are never sold and are awarded by a **career challenge**, shown with its progress on the item's card: 400 hostiles (K9 unit), two operations without dying (Second Wind), 30 knife kills (Executioner), 50 perfect flows (Flow State), five deathmatch wins (Hardline). An award is made at the end of the run that met the challenge and shown on the debrief.

In the campaign and holdout only the lobby leader carries field support and perks (a holdout squadmate has the guns-only kit). In team deathmatch every operator has their own.

## Enemies and bosses

Riflemen, rushers, marksmen, shields, drones and the commander are joined by scouts (SMG bursts), breachers (shotgun pushers), grenadiers (lobbed shells with ground rings), machine gunners (long tracking bursts), rocketeers (laser-telegraphed rockets that destroy cover), sentry guns (front-armoured, slow turn — flank or EMP them), cloaked ghosts (only visible up close), bomb drones and Halcyon elites (pulse bursts). Bosses: the **Wraith** (blinks between perches after every shot), the **Bulwark** (armoured roadblock: bullets do 12%, explosives full; mortar salvos; EMP opens a window) and the **Warden** (mech whose barrier cuts damage 92% until a generator is destroyed or it is EMP'd; stomps up close). Killing a boss or finishing a defence routs that fight's reinforcements.

## Economy and retention

Credits come from kill bounties (+10% per chained kill up to +80%, ×1.5 knife, ×1.25 mid-slide, and ×0.6 in HOLDOUT where hostiles are far more numerous), mission completion, rating, flows, NO DEATHS, intel, first clears per difficulty, medals (5 per operation), daily contracts (3 rotating per day), a daily-operation streak bonus, rank-ups (150 × rank) and the Scavenger upgrade. They buy guns, gadgets, seven three-level upgrades and, once a gun's mastery allows, three kit parts per gun. The armory opens in five tiers at ranks 1, 4, 7, 10 and 15. A tier is also an item's grade, and every screen that shows a gun, gadget or upgrade colours it by that: standard issue (silver), field grade (green), specialist (blue), elite (gold) and legendary (a fiery red, for the XR-9 at 60,000 CR and the ARC-7 at 85,000 CR, which cost several times anything else and open at the last rank title). A gun dropped by an enemy can be carried for that run only; finding one makes it 25% off in the armory for good. Prices and the rank curve are paced so everything but the legendary pair takes roughly thirteen hours and the pair about eight more (`node blackout/qa/economy-report.cjs` prints the payout tables and that estimate, with its assumptions). The reasoning and the numbers are in `docs/BLACKOUT_GAMEPLAY_PLAN.md`. Each later operation is tuned around specific gear the briefing recommends: smoke and a long rifle for Dead Frequency, flashbangs for Underground, explosives for the Bulwark, EMP for Site Meridian.

Feedback: animated debrief tally, XP bar and award cards; NEW WEAPON / combo / objective banners; credit popups; hit and kill markers; slow-motion on boss kills and wave clears; damage-direction arcs; low-health red pulse with heartbeat and laboured breathing until healed; flashbang white-out and ringing; bullet whiz; per-theme ambience and weather.

## Destruction and rendering

Props own real health; destroyed props stop blocking. New walls: water and chain-link fence (block movement, not bullets or sight), gates opened by objectives, jammers/servers/generators, fuel tankers. Six themes (city, ruins at dusk, night snowfield, blacked-out subway, desert highway, lab facility) are baked into one texture per map. The subway uses a render-texture darkness layer with a flashlight cone, lamps, muzzle flashes and explosions erased out of it.
