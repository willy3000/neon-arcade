# Blackout Protocol — asset licence register

Written 13 October 2026 for version 0.2.0. It covers what is inside the released game
(`release/win-unpacked/resources/app.asar` and the files beside the exe). The build check confirms the released
archive holds exactly the files listed in `blackout/assets/` and nothing from `blackout/assets/source/`.

This is a record of the evidence, not legal advice. **"Confirmed"** means the licence was read on the source's own
page today, or its text ships with the game. **"As recorded"** means the only evidence is what
`blackout/ASSET_MANIFEST.md` says. **"Unverified"** means there is no evidence to rely on.

## Needs your attention before release

| # | Asset | Problem | What to do |
|---|---|---|---|
| 1 | **Commander voice** — `vo-welcome`, `vo-mission`, `vo-stay-sharp`, `vo-watch-six`, `vo-move-out` (5 files) | **Unverified.** The manifest records that the original recording arrived "with no source or licence attached". Nobody has written down who recorded or generated it, or on what terms. | Find out where the recording came from and whether it may be sold as part of a game. If it is a real person's voice, get their written permission. If you cannot establish this, replace these lines. |
| 2 | **Generated commander lines** — the other 51 `vo-*.ogg` files | **Unverified, and depends on #1.** They were generated with Chatterbox (model and code MIT) by cloning the voice in #1. The right to clone and sell a voice comes from the person whose voice it is, not from the tool. They are also AI-generated content, which Steam asks you to disclose (see the store checklist). | Settle #1 first. If #1 cannot be cleared, these 51 lines go too. The game already has a "Commander voice" switch and runs without the files being played, but shipping files you have no right to is still shipping them. |
| 3 | **Menu music** — `menu-music.mp3`, "Tactical Action Hums" by Restum-Anoush, Pixabay track 421970 | **As recorded, not confirmed.** The manifest infers the Pixabay Content License from the download's file name and says the track page was not checked. Pixabay's licence summary (read today) allows free use without credit and forbids distributing the content on its own. Its summary does not mention games, and says some content "may be subject to additional intellectual property rights". | Open the track's page while signed in, confirm it is still offered under the Pixabay Content License, and save a dated copy of the page and of the licence. Check the track is not registered with a content-identification system that would claim your trailer. |
| 4 | **Real firearm names** — MK18, M870, MP7, M110, M249, AS-12, M32, P226, AT4 and others, as item names | **Low risk, your decision.** These are real product designations, some of them trademarks. Many games use them without a licence; some publishers rename them. | Decide whether to keep them. Nothing in the game uses a maker's logo. |
| 5 | **"™" after the title** on the main menu, and the name itself | See the store checklist: another Steam game was released as *Blackout Protocol*. | Take advice on the name before using a trademark symbol with it. |

## Register

| Asset (in `blackout/assets/` unless noted) | Creator and source | Licence | Sold in a game? | Credit required? | Changes allowed? | Evidence |
|---|---|---|---|---|---|---|
| `characters.png`, `characters.json` — soldier animations (365 frames) | Riley Gombart (rileygombart), [OpenGameArt](https://opengameart.org/content/animated-top-down-survivor-player) | CC BY 3.0 | Yes | **Yes**: name the author, link the licence, say what was changed | Yes | **Confirmed** on the source page today ("CC-BY 3.0", attribution notice "Riley Gombart"). Credit is in the settings dialog and in `THIRD-PARTY-NOTICES.txt` beside the exe. |
| `props.png`, `props.json` — crates, vents, foliage, debris | Kenney, [Top-down Shooter](https://kenney.nl/assets/top-down-shooter) | CC0 1.0 | Yes | No | Yes | **Confirmed** by the licence text that ships with the game (`licenses/kenney-props.txt`). |
| Footsteps, impacts, bell, plate, punch (`footstep-*`, `metal`, `body`, `wood`, `glass`, `bell`, `plate`, `punch`) | Kenney, Impact Sounds | CC0 1.0 | Yes | No | Yes | **Confirmed** by `licenses/kenney-impact.txt`. |
| `explosion`, `rumble`, `radio`, `laser`, `laser-large`, `forcefield`, `door` | Kenney, Sci-fi Sounds | CC0 1.0 | Yes | No | Yes | **Confirmed** by `licenses/kenney-scifi.txt`. |
| `pistol`, `rifle`, `shotgun`, `smg`, `empty`, `pickup`, `heal`, `points`, `healthpack`, `boom`, `wind`, `ambience`, `flow` | FacadeGaikan, [Residue-sfx](https://opengameart.org/content/residue-sfx) | CC0 | Yes | No (the author asks for a visit to their site) | Yes | **Confirmed** on the source page today. Which file became which sound is **as recorded** in the manifest. No licence text ships for this pack; CC0 does not require one. |
| `reload-rifle.wav`, `reload-pistol.wav`, `reload-shotgun.wav` | SpringySpringo, [Gun reload sounds](https://opengameart.org/content/gun-reload-sounds) | CC0 | Yes | No ("Credit isn't required, but appreciated") | Yes | **Confirmed** on the source page today. |
| `menu-music.mp3` | Restum-Anoush, Pixabay | Pixabay Content License | See problem 3 | No | Yes | **As recorded.** |
| `vo-*.ogg` (56 files) | Supplied by the project owner; 51 generated with Chatterbox | Unknown | See problems 1 and 2 | Unknown | Unknown | **Unverified.** |
| `fonts/*.woff2` — Barlow Condensed, IBM Plex Mono, Inter | The Barlow Project Authors; IBM Corp.; The Inter Project Authors | SIL Open Font License 1.1 | Yes, bundled with software | The licence text must travel with the fonts | Yes, under the OFL's naming rules | **Confirmed** by `licenses/fonts-OFL.txt`, shipped inside the game and in `licenses/` beside the exe. |
| `cover.svg`, `helicopter.svg`, `icon.svg`, and everything drawn by `icons.js`, `render.js`, `menu-scene.js`, `style.css` | The project | Project-original | — | — | — | **As recorded**: the manifest calls it "handwritten vector illustration, not generated imagery". If any of it was written with an AI assistant, that is for you to state (see the store checklist). |
| `menu/*.jpg` — mode and killhouse pictures | Screenshots of this game | Project-original; they show the CC BY characters and CC0 props above | Yes | Covered by the character credit | — | **As recorded.** |
| `blackout/vendor/phaser.js` — Phaser 3.90.0 | Richard Davey, Phaser Studio Inc. | MIT | Yes | The copyright and licence notice must be included | Yes | **Confirmed**: `blackout/vendor/LICENSE.md` ships inside the game and as `licenses/phaser-LICENSE.md`. |
| Electron 33.4.11 and Chromium (the exe and its DLLs) | Electron contributors; The Chromium Authors and others | MIT; BSD and others | Yes | Notices must be included | — | **Confirmed**: `LICENSE.electron.txt` and `LICENSES.chromium.html` are beside the exe (checked by the build). `ffmpeg.dll` is Electron's standard build. |
| Interface tones, heartbeat, breathing, bullet whiz, drone score | Synthesised by the game while it runs | Project-original | — | — | — | Read in `blackout/audio.js`: Web Audio oscillators and noise, no samples. |

## Not shipped

`blackout/assets/source/` (the original downloads), `blackout/tools/voice/` (voice reference recordings and the
generation script), `blackout/qa/`, tests and documents stay out of the released game. The build check fails if any
of them is found in the archive.

## Corrections made to the existing manifest

`blackout/ASSET_MANIFEST.md` had a last row saying the typefaces are "hosted font service only; font binaries are not
redistributed here". That was true of an earlier version. The fonts are now bundled, as an earlier row of the same
table says. The stale row has been removed.
