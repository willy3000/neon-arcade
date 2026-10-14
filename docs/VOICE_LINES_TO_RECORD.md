# Commander lines to record

Lines the game has a place for but no recording yet. They are in the same voice and register as the existing commander
lines: short, clipped, an order or a fact, never a joke. Two takes of each mode line (the game picks one at random,
as it does for the existing `vo-mode-*` lines), one per new map.

Each file goes in `blackout/assets/audio/` as Ogg Vorbis, mono, at the same level as the existing `vo-mode-tdm.ogg`
(peak about -3 dBFS, a short fade in and out). Once the files are there, they need registering in three places:
- `blackout/audio.js`, the preload list;
- `VOICE` in `blackout/game.js`;
- `blackout/assets/integrity.json`.

Until then, these modes and maps are silent when chosen, by design: another mode's line would announce the wrong
mode.

**Before recording:** the right to use this voice is not yet established (see `docs/ASSET_LICENSE_REGISTER.md`,
item 1, and the commander rows of `blackout/ASSET_MANIFEST.md`). Every new line in the same voice carries the same
question. Settle where the voice came from and under what licence first, and record it in those files.

## Combat modes (announced when the mode is chosen in the lobby)

| File | Line |
|---|---|
| `vo-mode-arms.ogg` | Arms race. Every kill, a new weapon. Finish it with the knife. |
| `vo-mode-arms-2.ogg` | Twelve guns and a blade. Climb fast. |
| `vo-mode-uplink.ogg` | Uplink. Three relays. Take them, hold them. |
| `vo-mode-uplink-2.ogg` | Hold the relays and the points come to you. |
| `vo-mode-hunted.ogg` | Hunted. One of them can't be seen. Stay together. |
| `vo-mode-hunted-2.ogg` | Something is out there. Watch for the shimmer. |
| `vo-mode-breach.ogg` | Breach. Plant the charge or stop it. One life. |
| `vo-mode-breach-2.ogg` | Rounds. No respawns. Make every shot count. |
| `vo-mode-extract.ogg` | Extraction. Grab what you can and get to the bird. |
| `vo-mode-extract-2.ogg` | The longer you stay, the worse it gets. Know when to leave. |
| `vo-mode-trials.ogg` | Flow trials. Gates, targets, and the clock. |
| `vo-mode-trials-2.ogg` | Move clean. Move fast. Beat your ghost. |

## New maps (announced when the map is picked)

| File | Line |
|---|---|
| `vo-map-redline.ogg` | Canal district. Wet streets and long bridges. |
| `vo-map-citadel.ogg` | The Citadel. Guns on the gate, a drain on the west side. |
| `vo-map-blackout.ogg` | The summit. When the reactor goes, so do the lights. |
