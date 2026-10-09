# Release scope and verification

AFTERSTRIKE is a complete playable **vertical slice**, not the full proposed campaign. The run links three Fallen City encounters and ends with the two-phase Clockwork Titan. It includes three distinct weapons, recorded combat echoes, pressure-relay traversal, six mutations, practice, challenges, local progression, keyboard/mouse/touch/gamepad input and settings.

Fracture Depths, Chronarch's Domain, Mirror Assassin, Chronarch, additional enemy families, optional wall-running, dedicated finisher choreography and a larger animation library remain future expansion work. They are not selectable unfinished screens.

## Automated checks

From the repository root, run `node afterstrike/test.cjs` and `node afterstrike/verify.cjs`. The verifier supplies actual control actions through production simulation; it never teleports Nyx or modifies health to force completion. Saved routes complete the run with blade, gauntlets and chain. Additional seeds 1, 42, 99 and 2026 have been completed with each weapon.

Tests cover combat timing and repeated-hit protection, movement and thin obstacles, grapple release, immutable echo recording, replay after scenery changes, independent resource accounting, synchronization, interception, collapse, relay doors, boss phases, UI/input paths, persistence, progression, bounded effects and synthesized-audio lifecycle. Browser APIs are mocked for these tests.

A separate 60,000-step practice simulation exercised roughly eight minutes of simulation, with recording bounded at 480 frames and no accumulating projectiles or warnings. This is memory/simulation evidence, not a measured browser FPS claim.

## Artwork inspection

`qa/combat.png`, `qa/nyx-cover.png` and `qa/rig-atlas.png` were produced by running the production renderer with a native Canvas implementation and visually inspected. They demonstrate actual rig and combat rendering. They do not validate HTML layout, physical input or browser performance.

Optional developer-only snapshot generation on Windows:

```powershell
npm install --prefix "$env:TEMP/neon-arcade-canvas-qa" --no-audit --no-fund @napi-rs/canvas
node afterstrike/qa/render.cjs
node riftbreakers/qa/render.cjs
```

The native Canvas package is not used by the games and is not bundled into the website.

## Manual release checks still required

No in-app browser session was available in this environment. Before publishing, check desktop and mobile landscape/portrait layouts, simultaneous touch and cancellation, actual gamepad mappings, keyboard rollover, audio after the first gesture, mute and tab suspension, reduced-motion settings, and readable telegraphs during dense combat. Profile an extended run in browser developer tools at each quality setting on target hardware; the simulation runs at 120 Hz while rendering uses requestAnimationFrame, but actual 60 FPS requires hardware measurement.

Verify local file opening and static hosting, save/reload, returning to the arcade and the distinction between assisted and standard records. For RIFTBREAKERS, verify offline reload after its service worker has installed on HTTPS or localhost. AFTERSTRIKE has no service worker and does not promise cached offline hosting.
