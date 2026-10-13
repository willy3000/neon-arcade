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

## The lobby: Holdout and Team Deathmatch

The COMBAT MODES card on the main menu opens the lobby, where the mode, map, enemy pressure
and loadout are chosen. **Holdout** (endless waves) is played alone, with a friend, or with
an AI teammate in the open slot. **Team Deathmatch** is
two teams, Alpha and Delta, of up to four each: players or AI in any mix, up to eight players
on a LAN, with the kill limit set by the host.

One player hosts and runs the game; the others join. There are two ways to connect, both
offered from the lobby:

- **LAN** — desktop app only. The host shares the address shown in their lobby; guests
  type it in. All machines must be on the same network. One guest in Holdout, up to seven
  in Team Deathmatch.
- **Online** — desktop app or web page. Both players connect out to a small relay service
  and pair up with a five-character room code, so no router setup is needed. This option
  only appears once a relay address is set in `blackout/online-config.js`; `server/README.md`
  covers running the relay locally and putting it on a public host. Online is two-player
  Holdout only for now.

## Verify

- `npm test` — deterministic campaign/combat/systems replay (`blackout/tests/core.cjs`,
  `blackout/tests/walkthrough.cjs`), the co-op rules (`blackout/tests/coop.cjs`), squads, AI
  teammates and team deathmatch (`blackout/tests/squad.cjs`), field support, perks and career
  challenges (`blackout/tests/support.cjs`), the second wave of guns, gadgets and support
  (`blackout/tests/arsenal.cjs`) and the LAN socket framing. No
  browser required.
- `npm run test:relay` — the online relay, over real local WebSockets (Node 22+).
- `npm run test:e2e` / `npm run test:e2e:online` — two real desktop app instances playing a
  LAN session, and an online session through a locally started relay. Each instance runs on
  a scratch profile of its own, never on the save of a game installed on this machine.
- `npm run test:e2e:squad` — three real desktop app instances (a host and two guests) pick
  teams in the lobby and play a LAN team deathmatch against each other, each paid on their own machine.
- `npm run test:resilience` — messages shown outside a run, recovery from a fault inside a
  frame, and what a controller alone can reach.
- `npm run verify:package` / `npm run test:packaged` — inspect and then drive the game as
  built in `release/win-unpacked` (`npm run dist:win` first).
- `npm run test:release` — all of the above in order. Run it before uploading a build.
- `npm run test:tactical` — additional tactical-systems checks.
- `npm run test:browser` — real Chromium input/graphics/audio checks via Playwright
  (`npx playwright install chromium` once if not already installed).

Release documents are in `docs/`: `RELEASE_READINESS_REPORT.md` (audit, changes, test
results, open risks), `STEAM_RELEASE.md` (what Steam launches and how to upload),
`ASSET_LICENSE_REGISTER.md` and `STORE_PAGE_CHECKLIST.md`.

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
