# Blackout Protocol — delivering the Windows build through Steam

Written 13 October 2026 for version 0.2.0. Nothing described here has been uploaded, and no Steamworks account was
touched. The upload steps follow Valve's own page, [Uploading to Steam](https://partner.steamgames.com/doc/sdk/uploading);
check that page before you run them, because Valve changes it from time to time.

## What Steam delivers

Steam delivers a folder and starts a program in it. It does not need the installer.

| | |
|---|---|
| Build command | `npm run dist:steam` (folder only) or `npm run dist:win` (folder, installer and portable exe) |
| Folder to upload | `release/win-unpacked/` — 24 files, about 240 MB |
| Program Steam starts | `Blackout Protocol.exe` (at the top of that folder) |
| Arguments | none needed |
| Operating system | Windows, 64-bit |
| Build scripts | `release/steam/app_build.vdf` and `release/steam/depot_build.vdf`, written by the build |

The installer (`Blackout-Protocol-Setup-0.2.0.exe`) and the portable exe are for giving the game to people outside
Steam. Do not upload them to Steam: a player would have to run an installer inside their Steam library every time.

The game runs from wherever that folder is put. It was started from a path containing spaces, accented letters and
Chinese characters, from a different working directory, and it found all of its files (see the smoke test in
`docs/RELEASE_READINESS_REPORT.md`).

### Launch options you can offer

| Argument | Effect |
|---|---|
| *(none)* | Starts full screen. F11 or Alt+Enter switches to a window and back. |
| `--windowed` | Starts in a 1366×768 window. |
| `--user-data-dir=<folder>` | Keeps the save, cache and log in that folder instead of `%APPDATA%\Blackout Protocol`. Used by the tests; a player does not need it. |

Two environment variables are also read: `BP_WINDOWED=1` (same as `--windowed`) and `BP_RELAY_URL` (points online
co-op at another relay, for testing).

## What is and is not integrated with Steam

The Steamworks SDK is **not** in the game. That is deliberate: nothing in the current requirements needs it. It means:

- Steam starts the game, tracks play time and keeps it updated. This needs no SDK.
- There are **no** achievements, no Steam Cloud calls, no Steam friends or invites, no Steam networking, no rich
  presence, no trading cards, and the game does not check that Steam is running. Do not tick any of those on the
  store page.
- The Steam overlay is **not verified**. Electron games often need extra work before the overlay draws over them.
  Test it once the build is in your Steam library, and do not promise it before then.
- Online co-op pairs players by a five-character room code through your own relay, not through Steam.
- Saves live in `%APPDATA%\Blackout Protocol\save-store.json`. Steam's "Auto-Cloud" can sync that file with no code
  change (root *Windows AppData Roaming*, subdirectory `Blackout Protocol`, pattern `save-store.json`). That is a
  Steamworks setting you would have to configure and test yourself; it has **not** been set up or tested.

## Uploading a build

You need: a Steamworks account with the app created, its **App ID** and Windows **Depot ID**, and a Steam account
that has the *Edit App Metadata* and *Publish App Changes To Steam* permissions for it. Use a separate build account
for uploads rather than your personal one, and never put its password in this repository.

1. **Build and check the game.**

   ```
   npm install
   npm run test:release
   ```

   `test:release` runs every automated check, ending with the built game itself. Do not upload a build that fails it.
   To rebuild first: `npm run dist:win`.

2. **Write the build scripts with your numbers.**

   ```
   set STEAM_APP_ID=1234560
   set STEAM_DEPOT_ID=1234561
   npm run dist:steam
   ```

   Without those two variables the scripts are written with `YOUR_APP_ID` and `YOUR_DEPOT_ID` in them, to be replaced
   by hand. The result is:

   ```
   "AppBuild"
   {
       "AppID" "1234560"
       "Desc" "Blackout Protocol 0.2.0 (Windows x64)"
       "ContentRoot" "<this project>\\release\\win-unpacked"
       "BuildOutput" "<this project>\\release\\steam\\output"
       "Depots"
       {
           "1234561" "depot_build.vdf"
       }
   }
   ```

   and a depot script that maps every file in that folder to the root of the depot.

3. **Set up the app in Steamworks** (once).
   - *Installation → General Installation*: add a launch option. Executable `Blackout Protocol.exe`, no arguments,
     operating system Windows, 64-bit only.
   - *SteamPipe → Depots*: one Windows depot.
   - Add the depot to your store package (and to the developer comp package, so your own account owns it).
   - *Publish* the Steamworks changes. Settings are not live until you publish them.

4. **Upload.** Download the Steamworks SDK and run its `steamcmd` once so it updates itself. Then, from the SDK
   folder:

   ```
   tools\ContentBuilder\builder\steamcmd.exe +login <build_account> +run_app_build "<this project>\release\steam\app_build.vdf" +quit
   ```

   It asks for the password and a Steam Guard code. It prints a **BuildID** when it finishes.
   To see what would be uploaded without sending anything, add `"Preview" "1"` to `app_build.vdf` first.

5. **Put the build on a branch.** In Steamworks, open *SteamPipe → Builds*, find the BuildID and set it live. Put it
   on a private beta branch first. Valve's page notes that the default branch cannot be set live from the script; that
   is done by hand on this page.

6. **Test the copy Steam installs** before the release branch gets it. See the list below.

## What to test once it is in your Steam library

None of this could be done without a Steamworks app, so all of it is **not verified**:

- Steam installs the game and PLAY starts it; quitting from the game's QUIT button returns Steam to "not running".
- A second click on PLAY while the game is open brings the window forward rather than starting a second copy.
- An update from one build to the next keeps the save.
- A controller works with Steam Input on and off (the game reads controllers through the browser Gamepad API, in the
  standard Xbox layout).
- Whether the Steam overlay appears (Shift+Tab).
- On a Steam Deck, or under Proton on Linux: see the Steam Deck section of the readiness report.
- Windows SmartScreen does not interrupt the first launch. The exe is **not code-signed**. Games started by Steam are
  normally not stopped by SmartScreen, but the stand-alone installer will be until it is signed.

## Every release after this one

1. Raise `version` in `package.json` (and the `BLACKOUT / v0.2` text in the main-menu footer of
   `blackout-protocol.html`, if you want it to match).
2. `npm run dist:win`, then `npm run test:release`.
3. Upload as above, to the beta branch, test, then set it live.
4. If the online protocol changed, raise `PROTOCOL` in both `blackout/online.js` and `server/relay.js` and deploy the
   relay **before** the game: players on the old version are then told to update instead of meeting a newer host
   they cannot understand.
