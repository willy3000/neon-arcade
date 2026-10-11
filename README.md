# BLACKOUT PROTOCOL — Windows Desktop Build

This branch (`blackout-protocol-windows`) isolates **Blackout Protocol** out of the
multi-game N-Arcade website into its own standalone project, in preparation for
packaging it as a Windows desktop application (and eventually Steam).

The web version lives unmodified at `blackout-protocol.html` + `blackout/`. Nothing in
`blackout/` was changed — gameplay, balance, controls, visuals, and audio are identical
to the arcade release. See `WINDOWS_PACKAGING.md` for the Electron shell, its rationale,
and the remaining steps to produce a shippable `.exe`.

## Run it as a web page (unchanged behavior)

Blackout Protocol's asset loader uses XHR and refuses to run from a `file://` URL (it
shows "CANNOT RUN FROM A LOCAL FILE" and tells you to serve it). So:

```sh
npm run serve
```

then open http://127.0.0.1:8127/blackout-protocol.html.

## Run it as a Windows desktop app (Electron)

```sh
npm install
npm start
```

`electron/main.js` spins up a loopback-only HTTP server serving this same directory and
points the Electron window at it — the same fix as `npm run serve`, just automated and
bundled. See `WINDOWS_PACKAGING.md` for why this approach was chosen, how to build a
distributable `.exe`, and what's left before a Steam upload.

## Verify

- `npm test` — deterministic campaign/combat/systems replay (`blackout/tests/core.cjs`,
  `blackout/tests/walkthrough.cjs`). No browser required.
- `npm run test:tactical` — additional tactical-systems checks.
- `npm run test:browser` — real Chromium input/graphics/audio checks via Playwright
  (`npx playwright install chromium` once if not already installed).

Game design, asset licensing, animation scope, campaign plan, and prior test reports are
in `blackout/GAME_DESIGN.md`, `blackout/ASSET_MANIFEST.md`, `blackout/ANIMATION_SPEC.md`,
`blackout/CAMPAIGN_PLAN.md`, and `blackout/TEST_REPORT.md`.

## What was removed from the original repo on this branch

The other eight N-Arcade games and the shared arcade shell (`index.html`, `library.css`,
`library.js`, the root `game.js`/`style.css` which belong to a different game called Neon
Rush, `netlify.toml`, `riftbreakers-sw.js`) were removed **on this branch only**. Blackout
Protocol had no runtime dependency on any of them — confirmed by tracing every `src=`/
`href=` in `blackout-protocol.html` and every asset path referenced from `blackout/*.js`.
The only remaining reference to the old site is the "N NEON ARCADE / ALL GAMES" link in
the HUD header, which is dead in this standalone build (harmless — it's just a nav link,
not a functional dependency) and was left as-is per the no-gameplay-changes constraint.

The `master` branch is untouched; this is purely a new branch.
