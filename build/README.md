Build resources for the Windows package (`npm run dist:win`). Nothing in this folder ships inside the game's archive;
`THIRD-PARTY-NOTICES.txt` is copied beside the exe.

- `after-pack.cjs` — sets the exe's Electron fuses once electron-builder has assembled the game.
- `verify-package.cjs` — checks the built folder: contents, no development files or credentials, fuses, checksum.
- `stage-steam.cjs` — writes the SteamPipe build scripts into `release/steam/` (see `docs/STEAM_RELEASE.md`).
- `THIRD-PARTY-NOTICES.txt` — credits and licences, shipped beside the exe.

- `icon.ico` / `icon.png` — the game's logo. The ICO holds 16 to 256 px and is used for the exe, the installer, the
  uninstaller and the shortcuts (`build.win.icon` and the `nsis` icons in `package.json`).
- `installerSidebar.bmp`, `installerHeader.bmp`, `portableSplash.bmp` — the installer's side panel and header and the
  portable exe's splash. Drawn from `icon.png` and the game's typefaces by `make-installer-art.cjs`
  (`npm run dist:art`); run it again if the logo changes. `installer-art-preview.png` shows all three.
