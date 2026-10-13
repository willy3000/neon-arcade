# Blackout Protocol — Steam release readiness report

13 October 2026 · version 0.2.0 · branch `blackout-protocol-windows` · Windows 11 development machine

## 1. Summary

The Windows build is technically sound and has been hardened, rebuilt and tested as a built game, not only as source.
It is **not ready to submit** yet, for reasons that are not about the build:

1. **The name.** Another top-down co-op shooter was released on Steam as *Blackout Protocol* in 2023 (later renamed
   *Section 13*). Clear the name before spending on store art.
2. **The commander voice.** Nobody has recorded where the original voice recording came from, and 51 of the 56 voice
   lines are AI clones of it. That is a rights problem and a Steam disclosure item.
3. **The menu music licence** is confirmed (Pixabay Content License, read on the track's page on 14 October 2026). What is left is that the MP3 also sits by itself in the public repository, which that licence does not allow; the owner chose to leave it there (`ASSET_LICENSE_REGISTER.md`, item 3).
4. **Small text.** At 1366×768 and on a Steam Deck's 1280×800 screen, most interface labels are 6–8 px tall.
5. **The online relay** runs on a hosting tier that sleeps and is far from where this was tested (about 800 ms between
   two players here). It works; it will not feel good, and the address is one you do not control.

What was done: the Electron shell was locked down; the build now verifies its own archive and refuses to run as
anything but the game; a QUIT button, visible error messages and a crash guard were added; three controller
navigation defects were fixed; the in-run HUD now scales on large screens; the two-player tests, which had stopped
working, were repaired; and a test now drives the real built exe. Gameplay, balance, the save format and the network
protocol are unchanged.

Nothing was uploaded, published, purchased or changed in any account.

## 2. How the game is built and shipped

- **Game:** plain HTML, CSS and JavaScript on Phaser 3.90 (`blackout-protocol.html`, `blackout/*.js`). No build
  step, no bundler, no source maps, no runtime dependencies from npm.
- **Shell:** Electron 33.4.11 (`electron/main.js`, `electron/preload.js`). The main process serves the game's files
  to its own window from a loopback HTTP server on a random port, because the game loads its atlases and sound with
  XHR, which Chromium refuses under `file://`. The page gets three narrow bridges: `BPStore` (the save file),
  `BPNet` (LAN sockets) and `BPDesktop` (quit).
- **Co-op:** two players, host-authoritative. LAN uses a direct TCP socket on port 47321 (`electron/net/`). Online
  uses a WebSocket to a relay (`server/relay.js`, deployed separately at `wss://neon-arcade-0zkx.onrender.com`) that
  pairs players by room code and forwards their messages.
- **Save:** `%APPDATA%\Blackout Protocol\save-store.json`, written atomically.
- **Package:** electron-builder 25.1.8. Everything ships in one archive, `resources/app.asar` (152 files, 11.5 MB).
  No loose application files, no remote web content, no auto-updater.

| Command | What it does |
|---|---|
| `npm start` / `npm run start:windowed` | Run from source |
| `npm test` | Simulation, economy, campaign replays, co-op rules, LAN socket framing |
| `npm run test:relay` | The relay, over real local WebSockets |
| `npm run test:browser` | 21 real-Chromium checks of play, input and menus (rewrites `blackout/qa/*.png`; restore them afterwards) |
| `npm run test:resilience` | **New.** Messages, the frame-fault guard, controller reachability |
| `npm run test:e2e`, `npm run test:e2e:online` | Two real copies of the app in a LAN session and an online session |
| `npm run dist:win` | Static checks → installer, portable exe and game folder → package check → Steam scripts |
| `npm run dist:steam` | The same, game folder only |
| `npm run verify:package` | **New.** Inspects the built folder |
| `npm run test:packaged` | **New.** Drives the built exe |
| `npm run test:release` | **New.** All of the above except `test:browser`, in order |

## 3. What the audit found

**Critical**

- **A window that never appears.** If the local server failed to start, the error was dropped: no window, no
  message, and the process stayed alive holding the one-copy lock, so starting the game again did nothing. *Fixed.*
- **No way to quit.** The game opens full screen with no menu bar and had no exit button. Alt+F4 was the only way
  out, and a controller had none. *Fixed.*
- **The two-player end-to-end tests could not run and pointed at the real save.** The one-copy-at-a-time lock, added
  after the tests were written, made the second copy exit; and the tests set the save through `localStorage`, which
  the desktop app no longer reads, so the first copy ran on the player's real profile. *Fixed.*

**High**

- **A peer on the LAN could crash the host's main process.** A line containing `null` threw inside the socket
  handler; a connection that never sent a line break grew a buffer without limit; a second connection that was
  turned away had no error handler. *Fixed.*
- **A bad frame froze the game for good.** Phaser asks for the next frame only after the current one returns, so one
  exception in the frame — for instance from a malformed co-op update — stopped the game loop permanently. *Fixed.*
- **A co-op guest applied whatever the host sent**, field by field, without checking its shape. *Fixed.*
- **Clicking a credit link opened a second Electron window** on an outside website, with the game's preload script
  and its save and network bridges attached. Nothing stopped the window being navigated elsewhere either. *Fixed.*
- **Messages raised outside a run were invisible.** The toast and banner lived inside the in-run HUD, which is hidden
  on the menu, armory and lobby. "Not enough credits" and "storage unavailable" were never seen. *Fixed.*
- **Controller navigation in the armory did not follow the stick.** Right from an item went to a tab, not to its
  BUY button; leaving the buttons selected a different item. *Fixed.*
- **A controller could switch itself off** in the settings and had no way back. *Fixed.*
- **The in-run HUD did not scale.** Menus grow with the window; the HUD stayed at 6–7 px text at 1080p, 1440p and
  4K. *Fixed for windows larger than 1366×768.*
- **Electron 33 is out of support.** Its Chromium (130) no longer gets security fixes; the current release is 44.
  *Not changed — see section 9.*
- Name clash, voice rights, music licence, relay hosting. *Yours to resolve — sections 8, 10 and the checklists.*

**Medium**

- No content security policy; sandbox not explicit; developer tools available in the released build; the IPC
  handlers trusted any sender and any argument; the local server would serve any file in the archive to any local
  caller, including the main-process source. *Fixed.*
- The released exe could be run as a plain Node.js interpreter (`ELECTRON_RUN_AS_NODE`), take options from
  `NODE_OPTIONS`, or be opened with `--inspect`; nothing checked `app.asar` had not been altered. *Fixed.*
- Every launch added roughly 10 MB to Chromium's disk cache, because the address (and so the cache key) changes each
  time. *Fixed: two launches of the built game now leave no cached files.*
- A save file that could not be parsed was treated as empty and overwritten by the next save. *Fixed.*
- A dropped connection gave no sign for the 20–45 seconds the system takes to notice. *Fixed (indicator only).*
- All 55 Chromium language packs shipped for an English-only game; the installer step added an unused
  `elevate.exe`. *Fixed.*
- Small text throughout the interface. *Measured, partly addressed — section 7.*

**Low**

- No licence notices visible beside the exe. *Fixed.* A stale row in the asset manifest. *Fixed.*
- The exe is not code-signed. *Not changed.* The main menu shows "v0.2" and "™". *Not changed — your call.*
- `window.BPApp` (a read-only test hook) is present in the released game. *Left in: the tests depend on it and it
  exposes nothing a player does not already have.* The `?qa` and `?credits` developer switches cannot be reached in
  the released game, because the window's address is fixed and cannot be navigated.

## 4. What was changed, and why

| File | Change |
|---|---|
| `electron/main.js` | Start-up and runtime failures are caught, logged to `%APPDATA%\Blackout Protocol\logs\blackout.log` and shown to the player; a crashed renderer offers a restart. Sandbox on, developer tools off in the released game, content security policy, no navigation away, no new windows (the three credit links open in the player's browser), all permissions refused except copying a lobby code. Every IPC call is checked for sender and arguments. The local server answers only this window, only GET, only the game's own folder, and tells Chromium not to cache. The save is read once, keeps a spare copy, and sets an unreadable file aside instead of overwriting it. QUIT handler; Alt+Enter as well as F11; `--user-data-dir` for tests. |
| `electron/preload.js` | Adds `BPDesktop.quit()`. |
| `electron/net/host.js`, `guest.js` | Only JSON objects are delivered; a line over 1 MB drops the connection; rejected and failed connections can no longer raise an uncaught error. Framing and messages are unchanged. |
| `blackout-protocol.html` | QUIT button (desktop app only); toast and banner moved out of the HUD; a line in the settings about F11. |
| `blackout/game.js` | QUIT with a second press to confirm; frame-fault guard that returns to the menu with a message; shape checks on co-op updates; "NO SIGNAL" indicator; controller navigation reaches QUIT and text fields, follows left/right in the armory, and cannot switch the controller off; HUD scale. |
| `blackout/style.css` | Toast and banner positioned against the window; QUIT button style; HUD scales with `--hud-scale`. |
| `package.json` | Build: `asar` explicit, fuses hook, English locale only, no publishing, no elevation helper, licence files beside the exe, test files excluded by pattern. New scripts. `@electron/fuses` added as a development dependency. |
| `build/after-pack.cjs` (new) | Sets the exe's fuses. |
| `build/verify-package.cjs` (new) | Checks the built folder. |
| `build/stage-steam.cjs` (new) | Writes the SteamPipe scripts. |
| `build/THIRD-PARTY-NOTICES.txt` (new) | Ships beside the exe. |
| `electron/net/packaged-smoke.cjs` (new) | Drives the built exe. |
| `blackout/tests/resilience.cjs` (new) | Messages, fault guard, controller reachability. |
| `electron/net/e2e.cjs`, `e2e-online.cjs`, `test.cjs` | Repaired and extended. |
| `docs/` (four new files), `README.md`, `WINDOWS_PACKAGING.md`, `blackout/ASSET_MANIFEST.md`, `build/README.md`, `server/README.md` | Documentation. |

Not changed: `core.js`, `world.js`, `missions.js`, `meta.js`, `save.js`, `render.js`, `audio.js`, `online.js`,
`gamepad.js`, the relay, every asset, the save format, the wire protocol.

### On code protection

`app.asar` is an archive, **not encryption**. Anyone can unpack it with a free tool and read every script, picture
and sound in the game. What the build now does is refuse to *start* if the archive has been altered (the exe carries
the archive's checksum) and refuse to load code from anywhere else. That stops casual tampering and stops the exe
being used as a general-purpose Node.js. It does not hide anything.

**Obfuscating the JavaScript was assessed and not adopted.** There is nothing secret in the client to protect: no
keys, and the relay holds no authority over the game. The simulation runs sixty times a second, and obfuscators that
do more than rename variables slow that down and occasionally break code. The pictures and sound would stay
extractable regardless. If you still want it, it can be added as a step in `build/after-pack.cjs` that never touches
the source files — and it should then be run through `npm run test:release` like any other build.

## 5. Tests run and their results

Run on the final code, on this machine. The built-game tests ran against the build described in section 6.

| Test | Result |
|---|---|
| `npm test` — 45 core and 25 progression checks, 11 scripted campaign replays, 15 co-op checks, 7 socket checks | **PASSED** |
| `npm run test:relay` — 11 checks | **PASSED** |
| `npm run test:browser` — 21 checks in real Chromium, including a full first mission | **PASSED** |
| `npm run test:resilience` — 3 checks | **PASSED** |
| `npm run test:e2e` — two app copies, LAN, 8 steps | **PASSED** (was failing before this work) |
| `npm run test:e2e:online` — two app copies through a local relay, 8 steps including a malformed update | **PASSED** (was failing before this work) |
| `npm run verify:package` — 7 checks of the built folder | **PASSED** |
| `npm run test:packaged` — 10 checks driving the built exe | **PASSED** |
| The same smoke test against an **installed** copy (8 of 10; the two skipped were already run on the folder build) | **PASSED** |
| Installer: silent per-user install, without administrator rights, to the default folder | **PASSED** — exe and `app.asar` identical to the build, both shortcuts point at it, Apps-list entry present, nothing written under HKLM |
| Uninstaller | **PASSED with a note** — files, shortcuts and Apps entry removed, save kept; it left the empty install folder behind |
| Silent install to a custom folder with a space in its path (`/D=`) | **FAILED** — installed to the path cut off at the first space. Affects scripted installs only; the wizard's folder page and Steam are not involved. Not fixed. |
| Portable exe reaches its window | **PASSED** (start-up only) |
| `npm run test:tactical` — an optional AI model trying to win on Insane | **FAILED** — "crash insane must be winnable with cover play". Fails on the code as committed before this work, which touched none of the files it uses; the existing test report already lists it as not won. |

What the built-exe test showed, specifically: it starts from a path with spaces, accented and Chinese characters,
from another working directory, with `ELECTRON_RUN_AS_NODE` and `NODE_OPTIONS` set; it loads 129 files with no failed
request or console error and asks the network for nothing; the page has no Node.js access and cannot open windows or
navigate away; a run starts, takes input, plays sound, pauses and exits; QUIT ends the process with exit code 0 and
the save is on disk; the next start has the saved setting; a second copy steps aside; a controller alone can quit;
with the relay unreachable both online buttons say so and solo play still works; two copies met through the **real**
relay and played; one changed byte in `app.asar` and the game refuses to start.

**Not run / not verified**

| | |
|---|---|
| Steam itself: install, launch, update, overlay, Steam Input, cloud | **NOT VERIFIED** — needs a Steamworks app. Steps in `STEAM_RELEASE.md`. |
| A clean Windows machine that has never had Node or the project on it | **NOT VERIFIED** — the installed-copy test ran on the development machine. Install on another PC and play. |
| A physical controller | **NOT VERIFIED** here — every controller test uses a simulated one. |
| Steam Deck, Proton, Linux | **NOT VERIFIED** — section 9. |
| Windows 10; other graphics hardware; 4K at high display scaling | **NOT VERIFIED** |
| The later pages of the installer wizard, by eye | **NOT RUN** |
| Starting the game by double-clicking its shortcut | **NOT RUN** — it would have opened on your real save. The shortcut's target and working folder were checked instead. |
| Real latency and packet loss | Partly: the online two-copy test also **PASSED** with 150 ms added to every message each way (the relay's test-only delay). No packet loss or jitter was simulated. |
| More than two players | Not applicable — the game and relay allow two. |

## 6. The build

| | |
|---|---|
| Version | 0.2.0 |
| Command | `npm run dist:win` |
| Result | Succeeded. Electron 33.4.11, electron-builder 25.1.8, x64. Not code-signed. |
| Game folder (for Steam) | `release/win-unpacked/` — 24 files, 239.6 MB. Program: `Blackout Protocol.exe` |
| Steam scripts | `release/steam/app_build.vdf`, `depot_build.vdf` (placeholders for the app and depot numbers) |
| Installer | `release/Blackout-Protocol-Setup-0.2.0.exe` — 80.4 MB — sha256 `4087d97c83a755decf13276a078c9676caf695f8fc0a45ae02d9a366b0053cc5` |
| Portable | `release/Blackout-Protocol-0.2.0-Portable.exe` — 80.0 MB — sha256 `b3300cd0e597e9590faf17ddab2059f2f859919d1d2c498ee9e4e00a5e9b8318` |
| `app.asar` | sha256 `c65078caea3b994afa0175f9813d1d2c0bb18e4b92fc58e1c0008763aa93983a` |

`release/` is ignored by git; nothing built was committed. The source changes are in the working tree, uncommitted,
for you to review.

Warnings from the build: "no signing info identified, signing is skipped" (expected). On the first build,
electron-builder could not unpack its signing-tools download because it contains two macOS symbolic links and this
Windows account may not create links; the download had unpacked everything else, and the build ran once that folder
was given the name electron-builder looks for. On another machine, turn on Windows Developer Mode or run the first
build once from an administrator prompt.

## 7. Display and readability

Menus are drawn for 1366×768 and scaled to the window. Before this work the in-run HUD was not scaled at all; it now
grows with windows larger than 1366×768. Measured from the real pages (share of text below 9 px on screen):

| Window | Smallest text | Main menu | Settings | In-run HUD |
|---|---|---|---|---|
| 1280×800 (Steam Deck) | 5.6 px | 55 of 71 | 133 of 162 | 27 of 45 |
| 1366×768 | 6 px | 50 of 68 | 125 of 159 | 27 of 45 |
| 1920×1080 | 8.4 px | 11 of 68 | 19 of 159 | 9 of 45 (was 27, at 6 px) |
| 2560×1440 | 11.2 px | none | none | none |
| 3440×1440 | 11.3 px | none | none | none |

No clipped or overlapping text was found at any of these sizes, and no screen scrolls.

At 1080p and above the interface is now readable. **At 1366×768 and 1280×800 it is not comfortable**: the helper
lines in settings, the dossier, the HUD meter labels and the footer are 6–7 px capitals. This was left alone because
the layout fills its 1366×768 design exactly, so making small text larger means re-fitting most screens — a design
pass, which is yours to direct. The practical options are to raise the 6–8 px tier to 9–10 px and re-fit, or to draw
the layout for a smaller logical screen so everything scales up.

## 8. Multiplayer

**Verified:** the released build connects to the configured relay; two copies host, join by code, see each other,
chat, ready up, deploy, play, and leave, on a LAN and through both a local and the real relay; a guest leaving
returns the host to solo play; the host leaving returns the guest to the lobby; the relay forgets the room; a wrong
code, a full room, an old version, an unreachable relay and a busy relay each produce their own message; menus are
never locked by a failed connection; malformed lines, oversized lines and malformed world updates are refused
without a crash. The relay's own tests cover flooding, code guessing and silent connections.

**Measured:** about 410 ms round trip from this machine to the relay, about 790 ms between two players here. The
game's prediction keeps your own movement immediate, but enemies and your squadmate will lag visibly at that delay.

**Not verified:** play between two different networks; behaviour under packet loss; how many rooms the hosted relay
actually sustains.

**Keeping it running after release**

1. **Use an address you own.** The relay address is fixed inside every copy sold. If the hosting service is renamed,
   deleted or moved, every installed game loses online play until it is patched. Point a domain of yours at the relay
   (for example `wss://relay.yourgame.com`) and ship that, before release.
2. **Use a tier that does not sleep.** The current one does; the first player of the day waits up to a minute.
3. **Put it near your players.**
4. **Confirm `RELAY_TRUST_PROXY=1` is set** in the hosting service's settings. Behind a platform proxy without it,
   the limit of eight connections per address would count all players together. From one machine this cannot be told
   apart from the correct setting.
5. **Watch `https://<relay>/health`** with an uptime monitor.
6. **Restarting the relay ends games in progress.** Deploy at quiet hours.
7. **Protocol changes:** raise `PROTOCOL` on both sides and deploy the relay first.
8. The relay keeps nothing on disk and has no admin endpoint, password or key; nothing private is in the client.
9. LAN hosting listens on TCP port 47321, and Windows Firewall asks the host to allow it the first time. Say so on
   a support page.

## 9. Open risks and decisions

- **Electron 33 → a supported version.** Recommended before release, as its own piece of work: change the version,
  rebuild, run `npm run test:release` and `npm run test:browser`, then play with a real controller and real
  speakers. Not done here because it replaces the whole runtime under a game you have been testing by hand, and that
  retest needs you.
- **Steam Deck — not tested, do not claim.** Expected trouble, in order: text size (section 7, and Valve's own
  guidance asks for more than this); text entry — callsign, room code, LAN address and chat need a keyboard, and
  without the Steamworks SDK the game cannot raise the on-screen keyboard itself (the player can, with Steam+X);
  no Linux build, so it would run under Proton, where Electron games usually work but this one has never been
  started. Outstanding tests: start under Proton; controller through Steam Input; sound; 1280×800 legibility on the
  device; frame pacing; LAN and online co-op; suspend and resume during a run and during an online session.
- **Remote debugging.** A player can start the released exe with Chromium's `--remote-debugging-port` and inspect or
  change their own game. The tests use this. Since the host's machine decides everything in co-op anyway, it was
  left available; it can be refused at start-up if you prefer, at the cost of testing the built exe.
- **Co-op trust.** The host is the authority and can cheat in its own game. Credits a guest earns are not saved for
  the guest. There are no leaderboards to protect.
- **Installer:** not signed; silent install with `/D=` and a space; empty folder left by the uninstaller.
- **Your save file's timestamp.** Before the tests were repaired, the old two-player test was run once and started a
  copy of the app on your real profile. `save-store.json` shows a write at 10:02 that morning. The test clicked
  nothing before it failed and the file is a valid save (0 credits, rank 1, callsign ONYX, drill done) in a profile
  folder first created at 09:56 the same day, so at most a few minutes of play existed in it — but what wrote it
  cannot be proved. A copy from 10:05 is beside it as `save-store.backup-2026-10-13.json`. If you had more progress
  than that, say so. Every test since has used its own scratch folder, and each run confirmed the real file
  untouched while it ran. The file was written once more at 10:34, with a game session on that profile lasting
  until 10:37, at a time when no test was using that folder; its contents are identical to the 10:05 copy. That
  looks like you starting the game yourself. If you did not, tell me, because then something else is.

## 10. What is left for you, in order

1. Read the diff and commit it (nothing was committed).
2. Decide the name (`STORE_PAGE_CHECKLIST.md`, section 1).
3. Clear or replace the commander voice: it was downloaded, and its source and licence are still not recorded (`ASSET_LICENSE_REGISTER.md`). The music is confirmed.
4. Move the relay to an address you own, on a tier that stays awake, near your players; set `RELAY_TRUST_PROXY=1`;
   put the new address in `blackout/online-config.js`; rebuild.
5. Decide on the Electron upgrade and on the text-size pass; rebuild; `npm run test:release` and
   `npm run test:browser`.
6. Play the built game with a real controller, on a second PC, two players on two networks.
7. Steamworks: account, app, depot, launch option, store page, art, content survey (`STORE_PAGE_CHECKLIST.md`).
8. Upload to a beta branch and run the Steam checks (`STEAM_RELEASE.md`).
9. Submit for review.

## 11. Readiness at a glance

| Technical | State |
|---|---|
| Builds reproducibly with one command | Done |
| Runs from the installed folder with nothing else present | Done on this machine; second PC **not verified** |
| Starts, plays, saves, quits cleanly | Done |
| Fails with a message instead of silently | Done |
| Electron shell locked down; archive integrity enforced | Done |
| No secrets, source maps, tests or tools in the package | Done, and checked on every build |
| Solo play unaffected by network failure | Done |
| Co-op on LAN and through the real relay | Done for two copies on one machine |
| Controller reaches everything it needs | Done with a simulated controller; real hardware **not verified** |
| Readable at 1080p and above | Done |
| Readable at 1366×768 / Steam Deck | **Open** |
| Supported Electron version | **Open** |
| Signed exe | **Open** (optional for Steam) |

| Account, legal, store and release — all yours | State |
|---|---|
| Name cleared | **Open** |
| Voice rights | **Open** (source of the downloaded recording not recorded) |
| Music rights | Confirmed 14 October 2026; the MP3 in the public repository is an accepted risk |
| Steamworks account, app, fee, tax and bank | Not started |
| Store page text, capsules, screenshots, trailer | Not started |
| Content survey, including AI disclosure | Not started |
| Relay on your own address and an always-on tier | **Open** |
| Build uploaded and tested through Steam | Not started |
| Valve's review | Not started — nobody can guarantee its outcome |
