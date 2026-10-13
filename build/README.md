Build resources for the Windows package (`npm run dist:win`). Nothing in this folder ships inside the game.

- `icon.ico` / `icon.png` — the game's logo. The ICO holds 16 to 256 px and is used for the exe, the installer, the
  uninstaller and the shortcuts (`build.win.icon` and the `nsis` icons in `package.json`).
- `installerSidebar.bmp`, `installerHeader.bmp`, `portableSplash.bmp` — the installer's side panel and header and the
  portable exe's splash. Drawn from `icon.png` and the game's typefaces by `make-installer-art.cjs`
  (`npm run dist:art`); run it again if the logo changes. `installer-art-preview.png` shows all three.
