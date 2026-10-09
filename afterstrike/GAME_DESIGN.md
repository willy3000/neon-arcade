# AFTERSTRIKE: ECHOES OF WAR — game design

## Research and decisions

Research completed before implementation. These are principles adopted from primary sources, not copied art, maps, dialogue, character designs or source code.

- [Maddy Thorson, Celeste & Forgiveness](https://www.mattmakesgames.com/articles/celeste_and_forgiveness/index.html): small timing and positioning grace windows help players express intent. Use 100 ms coyote time, 130 ms jump buffering, gentle apex gravity, and narrow ledge correction; keep these in GAME_FEEL.
- [Sébastien Bénard, Dead Cells GDC postmortem](https://media.gdcvault.com/gdc2019/presentations/Benard-Sebastian-DeepCells.pdf): responsive control and rapid retry support challenging repeated runs. Use immediate turn intent, explicit cancel windows, compact encounters, and one-button retry. Decorative anticipation must not delay movement.
- [Supergiant, Hades FAQ](https://www.supergiantgames.com/blog/hades-faq/): let different players access the same core experience through difficulty choices. Add an explicit assist mode and opt-in challenge modifiers; keep unlocks primarily about new play styles.
- [MDN, optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas): bound work, reuse visual objects and limit expensive drawing. Use an effect pool, visible-world culling, capped resolution, and cached original layered rig geometry. Visual quality never changes physics accuracy.
- [MDN, Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API): poll connected standard-mapping pads and convert buttons/axes to the same action packets as keyboard and touch. Edge-trigger attacks, pauses and echo summons.

Canvas with an original layered procedural rig is the chosen production approach. It keeps world-space attack events and the echo renderer precisely registered, permits animation blending without inconsistent generated frames, and works directly from static files. An engine would add integration and asset costs without resolving the central replay problem. Bitmap concept art is optional; it is not an animation pipeline.

## Vertical slice

A complete short run through three linked encounters in the Fallen City, culminating in the Clockwork Titan. Traversal, a quiet discovery route, an echo-operated relay, mixed enemies, a mutation choice between encounters, boss victory, defeat, retry, saves and optional challenges form the shipped loop. A practice room allows immediate movement/combat experiments.

Three mechanically distinct weapons: balanced Chrono Blade; short-range, armor-breaking Rift Gauntlets; long-range pulling Phantom Chain. Persistent discoveries unlock alternate starting weapons and mantle colors; all three can be experimented with in practice. Run mutations affect echoes, movement and tactical choices rather than passive permanent damage.

The full Fracture Depths / Chronarch's Domain campaign, Mirror Assassin and Chronarch bosses are expansion work, not part of this vertical slice.

## Echo architecture

Record a bounded circular buffer at fixed 120 Hz. Frames include world pose, velocity, facing, state, weapon and committed gameplay events. Echo Shift copies the most recent sequence into an independent immutable track; echoes cannot record themselves, summon echoes or spend player resources. Cost, maximum count and cooldown bound replay.

Playback is pose-reconciled: the echo follows recorded world positions instead of resimulating collisions against a changed scene. Attack events emit fresh explicit hitboxes into the current world, with unique swing IDs and target hit sets. New scenery neither traps a replay nor changes the real player's resources. Echoes phase through terrain; this is visibly signaled by their translucent silhouette. Playback is interrupted by hunters and ends on scene transitions. An echo cannot award a second kill on an already defeated target.

Synchronization examines successful real/echo hits, timing and approach side. Crossfire, perfect sync, launch follow-ups, defensive interception and collapse are distinct tactics. Relay occupancy can be supplied by a replay even while Nyx moves away. Echo frame poses are cosmetic; recorded attack events are gameplay.

## Art direction and rig production

Palette: ink navy, mineral gray, pale parchment, coral Nyx weapon light, ice-blue echoes, gold interactables, crimson enemy warnings. Nyx is an asymmetric masked warrior with a split mantle, three distinct weapon assemblies and long secondary scarf motion. Keep visor and weapon readable at ~50 world pixels tall.

Use registered layered polygons with consistent root at the feet, articulated shoulders/elbows/knees, interpolated poses, fixed limb lengths, animated cloth, weapon-specific arcs, and immediately interruptible alternate idles. Rig dimensions and state coverage are documented in the asset manifest. No unlicensed third-party artwork or audio.

## Quality gates and evidence

Pure simulation tests must prove movement, startup/active/recovery phases, one hit per target per swing, resource costs, playback after destruction, synchronization, echo cleanup and actual run completion. Browser mocks cover UI/save/input paths without claiming live hardware validation. Simulation benchmarks are CPU evidence, not a claim of rendered FPS. Human playtesting remains required for subjective feel and actual visual/audio quality.

Keep practice and the full run playable before adding systems. Do not describe unbuilt bosses or worlds as implemented.
