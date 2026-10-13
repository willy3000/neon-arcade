# Windows Desktop Packaging — Blackout Protocol

Status (13 October 2026): **built and run as a packaged game.** `npm run dist:win` produces,
in `release/`:

- `Blackout-Protocol-Setup-0.2.0.exe` — the installer (choose a folder, desktop and Start
  menu shortcuts, uninstaller; saves are kept on uninstall).
- `Blackout-Protocol-0.2.0-Portable.exe` — a single file that runs without installing.
- `win-unpacked/Blackout Protocol.exe` — the game as a plain folder.

All three carry the game's logo (`build/icon.ico`) and the product details "Blackout
Protocol / Neon Arcade / 0.2.0". The installer's side panel and header and the portable
exe's splash are drawn from the same logo by `npm run dist:art`
(`build/make-installer-art.cjs`).

What was checked on the packaged build: it launches, the menu and a run render, the bundled
typefaces and all seven killhouse pictures load, it makes no outside network requests on
start-up, and progress written in one launch is there in the next (each launch uses a
different local port). The portable exe was started and reached its window. The installer
was run: its first page shows the logo in the title bar and header; a silent install into a
scratch folder put down the game, the uninstaller, desktop and Start menu shortcuts and an
Apps list entry ("Blackout Protocol 0.2.0, Neon Arcade"); the installed game launched and
started a run; and the uninstaller removed all of it while leaving the save folder alone.
The later wizard pages (folder choice, progress, finish) were not looked at by eye.

Things to know:

- **Not code-signed.** Windows SmartScreen will warn on first run until it is signed.
- **Saves** live in `%APPDATA%\Blackout Protocol\save-store.json`. A copy that ran before
  packaging kept its save under `%APPDATA%\blackout-protocol-windows`; the first start under
  the new name copies that across.
- **One copy at a time.** Starting the game again brings the running window forward.
- `dist:win` first runs `npm run verify` (`blackout/tools/verify-static.cjs`), which checks
  every referenced file exists, asset hashes match, and no stylesheet or script loads from
  the network.

The rest of this document is the original scaffolding note, kept for the reasoning behind
the local-server design. Where it says something is "not yet built", "not installed" or
"left alone", the list above is the current state: fonts are now bundled, the icon exists
and the build has been produced.

## Why Electron, and why a local server instead of `file://`

The brief's default direction — wrap the existing Phaser game in Electron rather than
rewrite or re-engine it — holds up on inspection:

- The game is 100% self-contained JS/CSS/Phaser/assets under `blackout/`, with its vendor
  copy of Phaser already checked in (`blackout/vendor/phaser.js`), and no backend. Nothing
  about it requires an engine migration.
- Electron can host it with effectively zero changes to game code.

One concrete wrinkle, found during inspection: **`blackout/game.js` explicitly detects
`location.protocol === 'file:'`** and refuses to initialize, showing "CANNOT RUN FROM A
LOCAL FILE / RUN NPM RUN SERVE...". This isn't a bug to fix — it's the game correctly
anticipating that Phaser's XHR-based loader (used for the character/prop atlases, JSON,
and audio) is blocked by Chromium's same-origin restrictions on `file://` XHR reads. The
existing README documents the same constraint for the web version. Electron's
`BrowserWindow.loadFile()` serves pages over `file://` by default, so naively calling
`loadFile('blackout-protocol.html')` would hit the exact same wall.

**Resolution (no gameplay code touched):** `electron/main.js` starts a plain Node
`http.createServer` bound to `127.0.0.1` on an OS-assigned port, serving this directory's
files, and points the `BrowserWindow` at `http://127.0.0.1:<port>/blackout-protocol.html`
instead of a `file://` URL. This is the same trick the project's own
`blackout/tests/browser.cjs` and `npm run serve` already use for local testing/dev — just
automated inside the app so the player never sees a terminal or a URL. No asset paths,
atlases, or loader code change; the game still loads `blackout/assets/...` exactly as
before, just over loopback HTTP instead of disk.

This was verified directly: a minimal Node static server was started against this
checkout and `blackout-protocol.html`, `blackout/vendor/phaser.js`, `blackout/game.js`,
`blackout/assets/characters.png`, and `blackout/assets/audio/pistol.ogg` all returned
HTTP 200. The deterministic gameplay test suites (`blackout/tests/core.cjs`,
`blackout/tests/walkthrough.cjs`) also pass unmodified on this branch.

## What's scaffolded on this branch

- `electron/main.js` — Electron main process: starts the loopback server, creates the
  `BrowserWindow` (1366x768 default, resizable, 960x600 minimum), removes the default
  menu bar, and toggles fullscreen on F11. `nodeIntegration` is off and
  `contextIsolation` is on since the page needs no Node/Electron APIs — it's an unmodified
  web game.
- `package.json` — rewritten for this standalone project: `main` points at
  `electron/main.js`; added `electron` and `electron-builder` as `devDependencies`;
  added `npm start` (launch the Electron app) and `npm run dist:win` (build a Windows
  installer + portable exe via electron-builder); kept `npm test`, `npm run test:browser`,
  and `npm run serve` scoped to just Blackout Protocol's own test files.
- `package.json` `build` key — electron-builder config: NSIS installer and a portable
  exe, both x64, output to `release/`, bundling `blackout-protocol.html`,
  `electron/**`, and `blackout/**` while excluding `blackout/qa`, `blackout/tests`,
  `blackout/tools`, and the design/markdown docs (none of that ships in a player-facing
  build).
- `build/README.md` — placeholder note: a real `build/icon.ico` must be added before
  `dist:win` will produce a correctly-iconed executable.

Electron and electron-builder are declared as dependencies but **not installed** in this
environment (that's a large, environment-specific download, and the task asked to
establish and document the project rather than complete a full build). `npm install` has
not been run since the `package.json` rewrite.

## Remaining steps to produce a shippable Windows build

1. `npm install` — pulls in `electron` and `electron-builder` (and refreshes
   `package-lock.json`, which currently only locks `playwright`).
2. `npm start` — sanity-check the Electron shell actually launches and plays correctly
   on a real Windows machine (this was not run in this environment; only the local-HTTP-
   server piece behind it was verified directly).
3. Produce `build/icon.ico` (256x256 multi-resolution ICO) from existing game art — there
   is currently no app icon.
4. `npm run dist:win` — produces the NSIS installer and portable `.exe` under `release/`.
   Review electron-builder's output size; `blackout/assets` includes licensed audio/image
   assets (see `blackout/ASSET_MANIFEST.md` and `blackout/assets/licenses/`) that must
   ship with the build and keep their attribution.
5. Decide on code signing. electron-builder will produce an unsigned exe by default,
   which triggers a Windows SmartScreen warning on first run. Not required to run the
   game, but worth deciding before any wide distribution.
6. For Steam specifically (not started, out of scope for this task beyond noting it):
   - Integrate the Steamworks SDK (e.g. via `steamworks.js` or `greenworks`) for basic
     app-id handshake, and optionally achievements/cloud saves — currently the game only
     persists to `localStorage` (`blackout/save.js`), which works fine standalone but
     doesn't talk to Steam.
   - Steam requires launching via `steam_api64.dll` validation; this typically means
     adding a small Steamworks init check at app start in `electron/main.js`, not in game
     code.
   - Build Steam depot/content scripts once a build is approved for upload. No Steamworks
     account action was taken or implied by this work.

## Things intentionally left alone

- All of `blackout/*.js`, `blackout/style.css`, and every asset — zero gameplay, balance,
  control, visual, or audio changes, per the task constraints.
- `blackout/tools/build-static.cjs` and `blackout/tools/verify-static.cjs` — these built
  and verified the **whole nine-game Netlify site** (they assert other games' files
  exist). They're left in place untouched since they're not gameplay code, but they are
  no longer wired into `npm run build` on this branch since the files they check for
  (other games, `library.js`, `netlify.toml`) were removed in the isolation step. They'd
  need rewriting or removal if this branch's static-site tooling is still wanted; the
  Electron path doesn't use them at all.
- The Google Fonts `@import` at the top of `blackout/style.css` still points at
  `fonts.googleapis.com`. This degrades gracefully offline (every font rule has a system-
  font fallback, and the original README documents this: "An internet connection is only
  used for optional Google Fonts; system fonts work offline") — so it is **not** a
  functional blocker to offline play, just a minor visual-fidelity gap without internet.
  Self-hosting those fonts under `blackout/assets/fonts/` would close that gap but was not
  done here, since it would mean editing `blackout/style.css`, which is asset/visual code
  outside this task's isolation/scaffolding scope.
- The "N NEON ARCADE / ALL GAMES" back-link in the HUD header still points at
  `index.html`, which no longer exists on this branch. It's a dead link, not a crash — the
  page just won't navigate anywhere if clicked. Left as-is rather than edited, per the
  no-gameplay-code-changes constraint; a true Steam build would eventually want this
  either removed or repointed, but that's a presentation decision for later, not a
  packaging blocker.
