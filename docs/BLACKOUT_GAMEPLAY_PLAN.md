# Blackout Protocol: player experience, gameplay and progression plan

Written 2026-10-13. Status: **built**, except the two items listed under "Not built". The numbers here are the ones in the code.

## Why this was done

The game played well moment to moment. The weak points were around it:

1. **Credits came too easily.** One wave-10 holdout run paid 5,000 to 8,000 CR against a whole armory worth 67,300 CR, and 12 of the 15 guns for sale could be had for free by walking over an enemy's dropped gun.
2. **Movement had rough edges.** Stamina refilled the instant sprint was released, sprint stuttered back on at 4% stamina, and a roll refused for lack of stamina gave no signal.
3. **Nothing led the player from the main menu into a first good session**, and nothing at the end of a run pointed at the next goal.

## Decisions taken

| Question | Decision |
|---|---|
| How long to own everything | 12 to 15 hours |
| Guns dropped by enemies | Usable for that run only; finding one makes it 25% off in the armory for good |
| Rank gates | Five armory tiers, opening at ranks 1, 4, 7, 10 and 13 |
| Existing saves | Reset: credits, rank, purchases and loadout start again. Campaign progress, holdout records, mastery, stats and settings are kept |
| Stamina refill delay | Short after a partial sprint, long only if the bar is emptied |

Two things follow from the reset that were not spelled out when it was chosen. Rank is reset along with credits, because rank now decides what can be bought and the XP curve changed. A save that has finished the opening operation keeps the M870 and frag grenades, because that supply cache is a story reward, not a purchase.

## 1. Economy

### Income

| Lever | Before | Now |
|---|---|---|
| Combo bonus per chained kill | +25%, up to +200% | +10%, up to +80% |
| Bounty per hostile in holdout | full | ×0.6 (campaign bounties are not scaled) |
| Wave-clear bonus | 60 + 25 × wave | 40 + 10 × wave |
| Record bonus | 100 × wave | unchanged |

The combo change applies to the campaign as well, so campaign bounty totals are slightly lower than before.

What a holdout run now pays, measured by running the simulation with a bot that kills every hostile as it appears. "No combo" is a player who never chains kills, "full combo" one who always does. The debrief then applies the difficulty multiplier (Story ×0.6, Standard ×1, High Intensity ×1.4, Insane ×2.2).

| Wave reached (Standard) | No combo | Full combo | Before the change |
|---|---|---|---|
| 5 | 1,160 | 1,420 | 1,790 – 2,640 |
| 8 | 2,150 | 2,670 | 3,450 – 5,460 |
| 10 | 3,170 | 3,940 | 5,120 – 8,240 |
| 15 | 5,890 | 7,570 | 9,870 – 16,670 |

### Prices and tiers

| Tier | Rank | XP | Guns | Gadgets | Upgrades |
|---|---|---|---|---|---|
| 1 | 1 | 0 | M870 600, VZ-61 500, Super-Shorty 600 | frag 450, flash 450 | level 1: 400 – 800 |
| 2 | 4 | 10,250 | MP7 1,600, SVK-9 2,000, .44 2,200 | smoke 900, incendiary 1,100 | level 2: 1,600 – 3,000 |
| 3 | 7 | 34,500 | KV-15 4,500, M110 6,000, M249 6,500, M79 5,000 | mine 2,200, decoy 2,500, cover 2,800 | |
| 4 | 10 | 70,150 | AS-12 12,000, M32 15,000, AT4 13,000 | EMP 4,500 | level 3: 6,000 – 11,000 |
| 5 | 13 | 116,050 | XR-9 24,000, ARC-7 34,000 | | |

The whole catalogue is now 220,500 CR (guns 127,500, gadgets 14,900, upgrades 78,100). Rank needed more XP than before so the tiers spread across the whole journey: the old curve would have opened tier 5 in about an hour.

### Field drops

Walking over a gun dropped by an enemy no longer adds it to the armory. The operator can carry it for the rest of that run, and the first find marks that gun 25% off in the armory permanently. The armory lists found guns as "FOUND" and names the enemy that carries each gun not yet found.

### After the catalogue: weapon kit

Each gun has three parts, bought in order, each needing that gun's mastery level: Match Barrel (20% tighter spread, mastery ★), Fast Mag (10% faster reload, ★★), Hot Loads (+8% damage, ★★★). A part costs 25%, 40% and 60% of the gun's price, with the price counted as at least 1,500 and at most 8,000. All parts for all guns come to 94,300 CR.

### Pacing estimate

`node blackout/qa/economy-report.cjs` prints the payout tables and an estimate of time to own the catalogue. With its current assumptions it gives: first purchase after about 9 minutes, tiers 2 to 5 opening at about 0.8, 2.3, 4.9 and 7.8 hours, whole catalogue after about 12 hours.

That figure is an estimate, not a measurement. It rests on assumptions listed at the top of the script: how long a wave takes, how far a player gets, how much they spend at supply drops and how much daily contracts add. It is useful for comparing one set of prices against another. Real playtest times are the thing to tune against.

## 2. Stamina and movement

| Rule | Before | Now |
|---|---|---|
| Wait before stamina refills | 3 s after any sprint | 1 s after any use; 3 s only if the bar was emptied |
| Emptying the bar | sprint cut back in at 4% | "winded": no sprint until 25% is back |
| Rolls, dives, slides, vaults | did not delay refill | restart the 1 s wait |
| Roll without enough stamina | silently ignored | stamina bar flashes, deny sound |
| Stamina bar | 3 px, one colour | 5 px; red and pulsing while winded |
| Reloading while holding sprint | dropped to 175 | jogs at 300, costs no stamina |
| Conditioning upgrade | faster refill, slower drain | also shortens the wait by 10% a level |
| Slide or interact pressed slightly early | lost | held for 0.12 s and fired as soon as possible |

Three more movement chains now count as a "perfect flow" (+12 stamina, the flow counter, and the existing 20 CR per flow in a campaign debrief), once per move:

- a kill made while sliding (that kill also pays 25% more);
- a knife kill within 0.7 s of coming out of a dive;
- a roll or dive that passes through an attack, which also triggers a brief slow-motion.

Smaller changes: the camera leads the aim further when steadying a long-ranged gun; an arrow at the screen edge marks each hostile winding up an attack from outside the view; a HUD panel turns see-through while a hostile or the aim point is underneath it.

## 3. Menu to first fight

- **First-launch drill.** On a brand-new save the campaign card opens the training range with seven steps: move, sprint, slide, vault, fire, reload, swap. It can be skipped from the pause menu and is not offered again.
- **Main menu** shows today's three daily contracts and their progress.
- **Operations board** recommended gear says "X CR SHORT" or "RANK N" instead of a bare price.
- **Armory** shows each item's tier, greys out what the player's rank does not allow, and tags one item "NEXT UP": the cheapest unowned thing recommended for the next operation, or failing that the cheapest gun or gadget open to them.
- **Results screen** ends on a "NEXT" line, such as "620 CR TO THE SVK-9 · 2 RANKS TO ARMORY TIER 3". A rank-up that opens a tier says so.
- **Loadout presets.** Three loadouts, A, B and C, on the operations board and in the lobby.
- **Reset notice.** A save carried over from before the rebalance sees a one-time notice on the main menu.

## 4. Holdout

- **Supply drop.** After each wave three priced crates land beside the operator: any three of full ammunition, +50 armour, full health, a stim, a gadget refill, or a gun to carry for the run. They are bought with interact, paid for from the credits earned so far in that run, and gone when the next wave starts. Prices rise 6% a wave. The rest between waves went from 6 to 9 seconds to give time to choose.
- **Wave modifiers.** Every third wave that is not a red wave carries one of four twists, named on the wave banner and paid an extra 50 + 10 × wave: Blackout (lights out), Armoured (every hostile has 50% more health), Swarm (rushers only, many of them), Marksmen (snipers and riflemen).
- **Killhouses.** The six campaign killhouses pay ×1.1 to ×1.6 in campaign order. Each killhouse keeps its own record per difficulty, shown in the lobby.
- **Fixed on the way:** the Underground and Site Meridian killhouses kept the campaign's closed gates, which cut the enemy spawn points off from the operator (all four in Site Meridian), so a wave there could never be cleared. Killhouses now have no gates.

## 5. Holdout's long game

**The problem.** A playtest on High Intensity reached wave 23 and only ended because it got boring. Three things caused it. At most 10 hostiles were ever on the field, so a bigger wave was only a longer one. The last new hostile arrived on wave 10. Hostiles fought no better on wave 20 than on wave 2. The AI teammate followed the player, stood in the open and went down again and again.

**The aim.** A player should feel each step up and die trying, not get bored. The point where runs end should depend on skill: an average player around waves 6 to 9, a good one around 12 to 15, a great one past 20.

What changed (all in `core.js` unless noted):

- **Three ways to get harder at once.**
  - The field cap grows from 8 to 18, plus 2 per squadmate.
  - A threat level (`pressureFor`) rises every three waves, a level sooner on High Intensity and Insane. It folds into the rules every hostile plays by: faster wind-ups, tighter spread, aim that leads a moving target, longer bursts.
    - Level I: fighting from cover (peek out to shoot, back behind the wall between shots and to reload).
    - Level II: flankers and grenades for anyone who camps.
    - Level III: suppressing fire, and pushing in while you reload.
    - Level IV: hunting and flashbangs.
  - Hostiles gain up to 45% health over the run.
  - Veterans (gold chevron) turn up from wave 6, with better guns that they drop.
- **New threats on a schedule.** Each is meant to break a habit the earlier waves allowed:
  - Field medic (wave 6): brings the fallen back.
  - Mortar team and spotter drone (wave 8): punish sitting behind one wall; the mortar fires blind on a spotted target.
  - Juggernaut (wave 9).
  - Engineer, who builds sentry guns (wave 11).
  - Jammer (wave 14): field support goes offline while it lives.

  Each appears on its own wave, is announced with a NEW THREAT card and a tip, and early rank-and-file thin out as the run goes on.
- **Red waves.** Every fifth wave has a siren, red screen edges, a longer break before it, and a boss:
  - Wave 5: commander.
  - Wave 10: the Warden. In holdout its barrier soaks a set amount and breaks for six seconds; it adds telegraphed missile salvos.
  - Wave 15: the Havoc tank. It drives, has front armour and a weak rear, and fires a telegraphed main gun.
  - Wave 20: the Wraith.
  - From wave 25: two bosses at once.

  Bosses get tougher each time round and with a squadmate. They pay about what a commander does, to keep the economy bands.
- **The legendary crate.** It lands before every red wave and holds that boss's answer, priced to be saved for (500 + 45 × wave):

  | Boss | Weapon |
  |---|---|
  | Commander | M32 grenade launcher |
  | Warden | ARC-7 (rail slugs now pass through barriers, as its description always said) |
  | Tank | AT4 |
  | Wraith | M110 |
- **Supply crates.**
  - They come down on parachutes in their grade's colour, with a hologram of the contents and the price.
  - The first crate is always a basic: whichever you are short of.
  - The pool opens up with the waves: sentry turret, fortify (three barriers), partner kit (revives and rearms the AI teammate), hollow points (+12% damage, stacks to three), field support charge, rebuild cover, and a thermal scan of the next wave.
- **Skill pays.**
  - A clean wave (under 35 damage taken) pays 6 + 2 × wave; a flawless one (under 10) pays 15 + 3 × wave.
  - A supply uplink lands out in the open on waves 7, 11, 19, 23 and so on. Securing it under fire pays credits, ammunition and armour.
  - First-time milestones at waves 5, 10, 15, 20, 25, 30, 40 and 50 pay once per difficulty (`meta.js`).
- **The end of a wave.** Once three or fewer hostiles are left for 12 seconds, they stop hanging back, come for you, and are marked. Sentries an engineer built do not hold a wave open.
- **The death screen** says what killed you and how to beat it.
- **The AI teammate** plays its own game inside a leash (`mateGoal`):
  - It covers the side you are not facing.
  - It hunts hostiles already in the fight, starting with whatever is closing on you and the dangerous few.
  - Under fire it works a peek spot behind low cover; hurt, it falls back and stims.
  - It throws a frag into a pack or behind a wall, and a flashbang when rushed, never near you.
  - It earns a sentry of its own from its kills.
  - It calls out contacts behind you and priority targets.
  - It still revives you.
  - The squad order key (T, or left stick click; `save.js`) cycles FREE / FOLLOW / HOLD HERE.

**Fixed on the way.**
- A wave could be marked cleared as its last queued hostiles were sent out onto an empty field.
- Large bodies (a commander, a tank) could spawn inside a crate next to a spawn point and stall the wave for ever. They are now moved to the nearest clear spot, and anything wedged by the soldier-sized path grid backs out.
- The Wraith's blink found no perches on killhouse maps.

**How it is checked.**
- `blackout/tests/holdout.cjs` (in `npm test`, 22 checks) covers:
  - threat levels;
  - the roster schedule;
  - red waves and bosses;
  - the field cap;
  - veterans and spawn clearance;
  - every new hostile's mechanic;
  - the tank's armour;
  - the Warden's barrier;
  - hostile flashbangs;
  - clean-wave pay;
  - the last stand;
  - the uplink;
  - milestones;
  - death blame;
  - the legendary crate and the new crates;
  - the partner's hunting, orders, gadgets, callouts and sentry.
- The pay bands in `progression.cjs` still hold on every difficulty.

**Balance check.** `node blackout/qa/holdout-sim.cjs [difficulty] [runs] [--partner] [--pressure]` plays holdout with an AI-driven operator.

`--pressure` keeps the operator standing still and unkillable, and reports the damage each wave dealt. That measures how hard waves push, the same way whatever the AI on either side does. Standing still on High Intensity, it now soaks:

| Waves | Damage per wave |
|---|---|
| 1–9 | 60–140 |
| 10 | about 270 |
| 15–25 | 700–1,250 |

Without `--pressure` the AI operator, which never slides, rolls or vaults, reaches a median of wave 6 alone on Standard. With an AI partner it reaches a median of 11 on Standard and 10 on High Intensity, and it dies to a spread of threats rather than one fixed wall.

## Not built

- **Cosmetics** (operator colours, callsign plates). They need new art or sprite tinting and were the lowest-priority sink.
- **A sprint-out delay before the first shot.** The plan only wanted it if playtests show sprint-and-shoot is too strong.

## How it is checked

- `npm test` now includes `blackout/tests/progression.cjs`: 24 checks covering the stamina rules, the new flow chains, input buffering, the supply drop, wave modifiers, income bands at waves 5, 10 and 15 on every difficulty, rank tiers, the found-gun discount, weapon kit, killhouse pay and records, every killhouse's spawn points being reachable, and the save reset.
- The income-band check fails if holdout pay drifts outside the agreed range, so a later change cannot quietly break the economy again.
- `blackout/tests/browser.cjs` runs the game in a browser. Its contexts now start with no game controller, because a controller plugged into the test machine was steering the operator and the menus.

## Known loose ends

All three of the loose ends first listed here were closed later the same day:

- The browser suite's live campaign walkthrough (a bot playing THE CRASH in real time) ran out of its 180-second limit in one of three full-suite runs. Its time varies from one to three minutes with how quickly the page answers the bot, so the limit is now 300 seconds.
- Hostiles stopping short of an operator who stands still in the killhouses: fixed in the simulation, with a test over every killhouse. Riflemen pathing round obstacles is limited to holdout so campaign difficulty is unchanged.
- `blackout/tools/verify-static.cjs` and the three SVG integrity mismatches: both fixed; the tool now runs before every packaged build.

Still open: the game is not code-signed. The installer has since been run end to end into a scratch folder (install, launch, uninstall).

## Things to watch in playtests

1. Time to first purchase, and what was bought.
2. Whether players notice being winded and understand why.
3. How much of a run's credits go on supply drops. The estimate assumes a quarter.
4. Whether tier 2 (rank 4) arrives before interest in tier 1 runs out.
5. Whether the 9-second rest between waves feels long once the crates are familiar.
