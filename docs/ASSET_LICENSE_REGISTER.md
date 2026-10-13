# Blackout Protocol — asset licence register

Written 13 October 2026 for version 0.2.0 and brought up to date on 14 October 2026 (menu music confirmed, the
opening's four recordings added, voice lines recounted). It covers what is inside the released game
(`release/win-unpacked/resources/app.asar` and the files beside the exe). The build check confirms the released
archive holds exactly the files listed in `blackout/assets/` and nothing from `blackout/assets/source/`.

This is a record of the evidence, not legal advice. **"Confirmed"** means the licence was read on the source's own
page today, or its text ships with the game. **"As recorded"** means the only evidence is what
`blackout/ASSET_MANIFEST.md` says. **"Unverified"** means there is no evidence to rely on.

## Needs your attention before release

| # | Asset | Problem | What to do |
|---|---|---|---|
| 1 | **Commander voice** — `vo-welcome`, `vo-mission`, `vo-stay-sharp`, `vo-watch-six`, `vo-move-out` (5 files) | **Unverified.** On 14 October 2026 the project owner said the original recording (`commander_voice over.mp3`) was **downloaded from a website**. Which website, who the speaker or maker is, and on what terms it was offered have not been recorded, so there is nothing to show it may be used in a game, sold, or cloned. | Write down the page it came from and read its licence. It must allow commercial use and derivative works; for the cloned lines (#2) it should also allow the voice itself to be imitated, which most "free sound effect" licences do not address and a real performer has rights in regardless. If the source cannot be found or does not allow this, replace these lines. |
| 2 | **Generated commander lines** — the other 104 `vo-*.ogg` files (counted 14 October 2026; 51 when this was first written) | **Unverified, and depends on #1.** They were generated with Chatterbox (model and code MIT) by cloning the voice in #1. The right to clone and sell a voice comes from the person whose voice it is and from the terms the recording was offered under, not from the tool. They are also AI-generated content, which Steam asks you to disclose (see the store checklist). | Settle #1 first. If #1 cannot be cleared, these 104 lines go too: they could be regenerated from a voice you do have the right to (your own, or one licensed for cloning) with the same script, `blackout/tools/voice/voice_lines.py`. The game already has a "Commander voice" switch and runs without the files being played, but shipping files you have no right to is still shipping them. |
| 3 | **Menu music** — `menu-music.mp3`, "Tactical Action Hums - Free to Use" by Restum-Anoush, [Pixabay track 421970](https://pixabay.com/music/electronic-tactical-action-hums-free-to-use-421970/) | **Licence confirmed; one open risk.** The track's page was read on 14 October 2026 (link supplied by the project owner): "Free for use under the Pixabay Content License". That licence allows free use without credit, in commercial work, and adaptation; it forbids selling or distributing the track "on a Standalone basis". Inside the game it is one part of a larger work, which is allowed. **Open risk:** the unmodified MP3 is also in the public repository `github.com/willy3000/neon-arcade`, where anyone can download it by itself. The owner was told this on 14 October 2026 and chose to leave it. | To close the risk, make the repository private or stop tracking the file (it would still be in the history until that is rewritten). Keep a dated copy of the track page and of the licence. If a trailer uses the track on YouTube or Steam, check first that it is not registered with a content-matching service. |
| 4 | **Real firearm names** — MK18, M870, MP7, M110, M249, AS-12, M32, P226, AT4 and others, as item names | **Low risk, your decision.** These are real product designations, some of them trademarks. Many games use them without a licence; some publishers rename them. | Decide whether to keep them. Nothing in the game uses a maker's logo. |
| 5 | **"™" after the title** on the main menu, and the name itself | See the store checklist: another Steam game was released as *Blackout Protocol*. | Take advice on the name before using a trademark symbol with it. |

## Register

| Asset (in `blackout/assets/` unless noted) | Creator and source | Licence | Sold in a game? | Credit required? | Changes allowed? | Evidence |
|---|---|---|---|---|---|---|
| `characters.png`, `characters.json` — soldier animations (365 frames) | Riley Gombart (rileygombart), [OpenGameArt](https://opengameart.org/content/animated-top-down-survivor-player) | CC BY 3.0 | Yes | **Yes**: name the author, link the licence, say what was changed | Yes | **Confirmed** on the source page today ("CC-BY 3.0", attribution notice "Riley Gombart"). Credit is in the settings dialog, in `THIRD-PARTY-NOTICES.txt` beside the exe and in `licenses/characters-CC-BY-3.0.txt`, with the licence link and the changes made. |
| `props.png`, `props.json` — crates, vents, foliage, debris | Kenney, [Top-down Shooter](https://kenney.nl/assets/top-down-shooter) | CC0 1.0 | Yes | No | Yes | **Confirmed** by the licence text that ships with the game (`licenses/kenney-props.txt`). |
| Footsteps, impacts, bell, plate, punch (`footstep-*`, `metal`, `body`, `wood`, `glass`, `bell`, `plate`, `punch`) | Kenney, Impact Sounds | CC0 1.0 | Yes | No | Yes | **Confirmed** by `licenses/kenney-impact.txt`. |
| `explosion`, `rumble`, `radio`, `laser`, `laser-large`, `forcefield`, `door` | Kenney, Sci-fi Sounds | CC0 1.0 | Yes | No | Yes | **Confirmed** by `licenses/kenney-scifi.txt`. |
| `rifle`, `shotgun`, `smg`, `empty`, `pickup`, `heal`, `points`, `healthpack`, `boom`, `wind`, `ambience`, `flow` | FacadeGaikan, [Residue-sfx](https://opengameart.org/content/residue-sfx) | CC0 | Yes | No (the author asks for a visit to their site) | Yes | **Confirmed** on the source page today. Which file became which sound is **as recorded** in the manifest. CC0 does not require a notice; one ships all the same, in `licenses/opengameart-sfx.txt`. |
| `pistol.wav` — pistol and magnum report | The project (`blackout/tools/make-pistol.cjs`) | Project-original | — | — | — | **Confirmed**: the script synthesises it from seeded noise and a sine and reads no other file. It replaced the Residue pack's pistol on 13 October 2026. |
| `reload-rifle.wav`, `reload-pistol.wav`, `reload-shotgun.wav` | SpringySpringo, [Gun reload sounds](https://opengameart.org/content/gun-reload-sounds) | CC0 | Yes | No ("Credit isn't required, but appreciated") | Yes | **Confirmed** on the source page today. |
| `menu-music.mp3` | Restum-Anoush, [Pixabay](https://pixabay.com/music/electronic-tactical-action-hums-free-to-use-421970/) | Pixabay Content License | Yes, as part of the game; not by itself (see problem 3) | No | Yes | **Confirmed** on the track's page on 14 October 2026. Terms summarised in `licenses/music-pixabay.txt`, which ships with the game. |
| `vo-*.ogg` (109 files) | A recording downloaded by the project owner, source not recorded; 104 generated from it with Chatterbox | Unknown | See problems 1 and 2 | Unknown | Unknown | **Unverified.** |
| `intro-chopper.ogg`, `intro-rain.ogg`, `intro-thunder.ogg`, `intro-drone.ogg` — the opening's helicopter, rain, thunder and low drone | aquinn ([Helicopter Sounds](https://opengameart.org/content/helicopter-sounds)); Ylmir ([Rain (loopable)](https://opengameart.org/content/rain-loopable)); rubberduck ([100 CC0 SFX #2](https://opengameart.org/content/100-cc0-sfx-2)); Paul Wortmann ([Dark Cavern Ambient](https://opengameart.org/content/dark-cavern-ambient)) | CC0 1.0 | Yes | No | Yes | **Confirmed** on each source page on 14 October 2026, the day they were downloaded. Cut, cross-faded to loop and re-encoded. Recorded in `licenses/opengameart-storm.txt`, which ships with the game. |
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
