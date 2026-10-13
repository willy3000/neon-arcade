# Blackout Protocol — Steam store page and release checklist

Written 13 October 2026 for version 0.2.0. Each line says what the game actually does today, so that the store page
describes this build and nothing more. Nothing here has been entered into Steamworks. Items marked **YOU** can only be
done or confirmed by you.

## 1. Decide first: the name

**"Blackout Protocol" has already been used on Steam.** Ocean Drive Studio announced a co-op twin-stick roguelite
shooter under that name in 2022, released it in Steam Early Access in July 2023
([Gematsu](https://www.gematsu.com/2022/09/co-op-twin-stick-shooter-roguelite-blackout-protocol-announced-for-consoles-pc),
[Co-Optimus](https://www.co-optimus.com/amparticle/17366/roguelike-horror-shooter-blackout-protocol-arrives-on-steam-early-access.html)),
and renamed it *Section 13* in 2024
([press release](https://gamedeveloper.com/press-release/section-13-a-new-era-of-roguelite-shooters-emerges)). It is
the same genre as this game: a top-down co-op shooter.

- **YOU:** search the Steam store and the trademark registers of the countries you will sell in for "Blackout
  Protocol", and take advice before releasing under this name. A name clash with an earlier game in the same genre
  on the same store can lead to a takedown request or confused buyers. Whether that studio holds or kept any rights
  in the name was not established here.
- The main menu prints "™" after the title. Do not use that symbol unless you have decided to claim the name as a
  trademark and have checked that you can.
- "A NEON ARCADE ORIGINAL" appears on the menu and "Neon Arcade" is the publisher name inside the exe. **YOU:**
  confirm that is the name on your Steamworks account, or change it.

## 2. What the store page may say about this build

| Field | What is true of version 0.2.0 |
|---|---|
| Genre | Top-down tactical action shooter. |
| Single-player | **Yes.** Six-operation campaign, HOLDOUT (endless waves on seven maps, six of them unlocked through the campaign), a firing range, an armory with 17 firearms, 8 gadgets and permanent upgrades, daily contracts, ranks. |
| Co-op | **Online co-op and LAN co-op, 2 players, HOLDOUT mode only.** The campaign is single-player. Tested with exactly two players; the game and the relay accept no more. |
| How online co-op connects | One player hosts and reads out a five-character room code; the other types it in. There is no matchmaking, no friends list, no invites and no accounts. Say so, so nobody expects Steam invites. |
| PvP | None. |
| Cross-platform multiplayer | Not applicable: Windows only. |
| Controller support | **Partial.** Play and every menu, including QUIT, work on a controller in the standard Xbox layout, with Xbox and PlayStation button prompts. Typing a callsign, a room code, a LAN address or a chat message needs a keyboard, and the Controller setting itself can only be switched off with mouse or keyboard. Verified with a simulated controller only — see "not verified" below. |
| Steam Cloud | **No**, unless you configure and test Auto-Cloud (`docs/STEAM_RELEASE.md`). |
| Achievements, trading cards, Workshop, leaderboards, Remote Play Together | **No.** Not implemented. |
| Steam overlay | Do not claim. Not tested. |
| Languages | **English only**: interface, subtitles and voice. The typefaces bundled are Latin-only. |
| Operating system | **Windows 10 or 11, 64-bit.** No 32-bit build, no macOS or Linux build. |
| Steam Deck | Do not claim anything. Only Valve assigns Verified or Playable. See the readiness report. |
| Accessibility features that exist | Rebindable keys and controller buttons, reduced flash, adjustable camera shake, separate effects volume, music and voice switches, aim assist on a controller, four difficulty levels. The game also follows the system "reduce motion" setting. |
| Known weakness to be honest about | Small text. At 1366×768 most labels are 7–8 px tall; see the readiness report. |

## 3. System requirements

**No performance testing was done on anything but one development machine**, where the built game ran a training
run at about 58 frames per second in a 1366×768 window. That is one data point, not a requirement. Do not publish
frame-rate figures from it.

What can be stated as fact:

- Windows 10 or later, 64-bit (the minimum for the Electron 33 runtime the game is built on).
- About 250 MB of disk space (the game folder is 240 MB).
- A graphics adapter with WebGL; the game falls back to slower software drawing without one.
- An internet connection only for online co-op. Everything else, LAN co-op included, works offline; the built game
  made no outside network request while starting, in the menus or in a solo run.

**YOU:** try the build on the weakest PC you intend to support and write the minimum and recommended specifications
from that.

## 4. Graphics and video you need to supply

None of these exist in the project. Sizes are Valve's and change now and then: read the current list in Steamworks
under *Store Page → Graphical Assets* before making them.

- [ ] Header capsule, small capsule, main capsule, vertical capsule
- [ ] Library capsule, library header, library hero, library logo (transparent)
- [ ] Page background (optional)
- [ ] Community icon and client icon (`build/icon.ico` and `build/icon.png` hold the game's emblem)
- [ ] At least five screenshots of real play, at 1920×1080 or larger. The captures in `blackout/qa/` are 1366×768
      test images — take new ones. Show what a buyer gets: a campaign operation, HOLDOUT, the armory, the co-op
      lobby. Do not use the menu's painted cover as a "screenshot".
- [ ] A trailer of real play. If it uses the menu music, clear that track first (licence register, item 3).

Capsule art must not carry review quotes, award laurels or discount text, and must show the game's actual logo.

## 5. Text you need to write

- [ ] Short description (about 300 characters) and the long "About this game" section. Describe only what is in the
      table above. The line on the main menu — "top-down tactical action" — is accurate.
- [ ] Release date and price. **YOU.**
- [ ] If you release as Early Access, Valve's Early Access questionnaire. **YOU.** Version "0.2" on the main menu
      reads as unfinished; decide whether this is a 1.0 or an Early Access release and number it to match.
- [ ] Support contact: an e-mail address or site that someone reads. The game has none in it today. **YOU.**
- [ ] Privacy: the game has no accounts, analytics, advertising or crash uploads. Online co-op sends your callsign,
      chat and game state to the other player through your relay, which keeps nothing on disk but does see each
      player's IP address and logs room open/close events. If you publish a privacy policy, say that.
- [ ] Third-party credits. Already in the game (settings dialog) and beside the exe (`THIRD-PARTY-NOTICES.txt`). If
      you list credits on the store page, copy them from there.

## 6. Content survey — answers you must give yourself

These are your declarations to Valve. What follows is what the code and assets show, to help you answer truthfully.

- **Violence:** the whole game is gunfights between soldiers seen from above, with explosions and melee finishers.
  Characters are small sprites; there is no blood or gore effect in the art that was reviewed and no dismemberment.
  **YOU:** play it through and confirm before answering.
- **Sexual content, nudity:** none found.
- **Drugs:** a "stim injector" heals the player. It is fictional first aid, not a real drug. Mention it if the survey
  asks about drug references.
- **Language:** no profanity was found in the mission text or voice lines that were read. Lobby chat is free text
  between two players who chose to play together; there is no filter. Declare user-to-user chat if asked.
- **Gambling, real-money purchases:** none. "Credits" are earned in play only; the game has no shop that takes money.
- **Real-world weapons:** real firearm designations are used as item names (licence register, item 4).
- **AI-generated content — this needs a careful, truthful answer.**
  - 51 of the 56 commander voice lines were generated with a voice-cloning model (Chatterbox), from a recording whose
    origin is not documented. That is pre-generated AI content that players hear. Reporting on Valve's January 2026
    wording says this is exactly what must be disclosed
    ([summary](https://legalmoveslawfirm.com/steam-ai-policy/)); read the current wording of the survey itself at
    [partner.steamgames.com](https://partner.steamgames.com/doc/gettingstarted/contentsurvey).
  - The same reporting says help from AI coding tools does not need disclosing, but art, audio or text that players
    see or hear does. **YOU** know how the artwork, mission text and code of this game were made; this document does
    not. Answer for all of it, not only the voice.
  - Valve also asks you to confirm the game contains nothing illegal or infringing. The unresolved voice and music
    items in the licence register stand in the way of that statement.
  - Nothing is generated by AI while the game runs.
- **Anti-cheat, DRM, third-party accounts, EULA:** none.

## 7. Accounts, legal and review — not technical, all YOU

- [ ] Steamworks partner account, identity and tax interview, bank details, the app fee.
- [ ] App created; store page and build submitted for Valve's review (allow for their stated review time and for a
      second round).
- [ ] The store page must be public as "Coming soon" for the period Valve requires before release.
- [ ] Decide on code signing for the stand-alone installer, if you will hand it out outside Steam.
- [ ] Age ratings, if you sell in countries that require them.
- [ ] Resolve the name (section 1) and the licence register's open items.

Nobody can promise that Valve will approve the page or the build. This list is there so that nothing in the build
contradicts what the page says.
