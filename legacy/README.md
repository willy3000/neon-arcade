# Legacy assets

Retired art kept in case it is needed again. **Nothing in this folder ships with the game**: the desktop package takes
only `blackout/`, `electron/` and `blackout-protocol.html`, and the static web build copies only the game folders by name.
Nothing in the game loads these files, and `blackout/tools/verify-static.cjs` fails if the atlas reappears in the shipped
assets without the game being changed to use it.

## `sprites/` — the original field character atlas

| File | What it is |
|---|---|
| `characters.png` | 1792 × 2576 atlas: 365 frames of 112 × 112, the operator seen from above |
| `characters.json` | Phaser atlas data (frame names such as `rifle/idle/0`, `feet/walk/5`) |
| `LICENSE-CC-BY-3.0.txt` | The licence and attribution notice that must go with these files |

- **Source:** "Animated Top Down Survivor Player" by Riley Gombart,
  <https://opengameart.org/content/animated-top-down-survivor-player>.
- **Licence:** Creative Commons Attribution 3.0 Unported, which requires credit. Our changes: resized to 28%,
  desaturated, re-centred and packed into one atlas.
- **Frames:** rifle, shotgun, handgun and knife sets (idle 20, move 20, reload 20 (handgun 15), shoot 3, melee 15) and
  separate feet (idle 1, walk / run / strafe_left / strafe_right 20 each).
- **Retired:** October 2026. The field now draws every character itself (`BPIcons.fieldSheet` in `blackout/icons.js`) in
  a realistic top-down style that can wear each player's avatar. The frame names and counts were kept, so the game's
  animation code did not change.

### Still used as a pose reference

`blackout/tools/make-field-poses.cjs` reads `characters.png` to measure how this soldier holds and moves - hand positions,
the angle of the gun, the knife's blade, the turn of the torso and the boots' steps, frame by frame - and writes those
numbers into `blackout/icons.js` (`FIELD_POSES`). The game's own drawn soldier is posed from them, so it holds its
weapons as naturally as this one did. Only numbers go into the game; the atlas itself stays here, unshipped. Run the
tool again after changing it (`node blackout/tools/make-field-poses.cjs --check out.png` also draws what it measured over
the reference frames).

### Bringing them back

1. Move `characters.png` and `characters.json` back to `blackout/assets/`.
2. Load them in `Render.preload` (`blackout/render.js`) with `scene.load.atlas('characters', …)`, and stop
   `hostileSheet` / `operatorSheet` from drawing that texture.
3. Restore the credit: the settings dialog (`blackout-protocol.html`), `build/THIRD-PARTY-NOTICES.txt`, the licence file
   in `blackout/assets/licenses/`, the list in `build/verify-package.cjs`, the entries in `blackout/assets/integrity.json`,
   `blackout/ASSET_MANIFEST.md` and `docs/ASSET_LICENSE_REGISTER.md`.
4. Remove the check that refuses the atlas in `blackout/tools/verify-static.cjs`.

## `menu-stills/` — the lobby's old mode pictures

`mode-<mode>.jpg` for holdout, tdm, arms, uplink, hunted, breach, extract and trials (460 × 200): screenshots of each mode
in play, taken with the old character atlas. They were replaced by drawn key art (`blackout/assets/menu/mode-*.svg`,
made by `blackout/tools/make-mode-art.cjs`). These pictures show the CC BY characters above, so reusing them needs the
same credit.

## `tools/`

`mode-shots.cjs` captured the pictures in `menu-stills/`. It still runs (`node legacy/tools/mode-shots.cjs [mode …]`)
and now writes here, but it photographs whatever the field currently looks like, not the old characters.
