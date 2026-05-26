<div align="center">

<img src="https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/assets/icons/cngm_icon.svg" width="80" alt="CNGM Icon">

# Cafe Neurotico Game Manager

**A beautiful, portable, offline-first game library manager for Linux.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux-orange.svg)](#installation)

[🌐 Website](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/) · [📖 Manual](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/manual.html) · [❓ FAQ](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/faq.html) · [🕹️ CREMA](https://github.com/shampoo-is-a-lie/CREMA)

</div>

---

![CNGM Gallery View](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/assets/images/cngm_scr_01.jpg)

## About

CNGM is the desktop half of the **Cafe Neurotico ecosystem** — detail-focused, neurotic about your library, and built to handle all the heavy lifting. It imports your entire game collection from Steam, Heroic (Epic, GOG, Amazon Games), and beyond, then lets you perfect every entry with custom artwork, YouTube trailers, ProtonDB ratings, HLTB data, and rich metadata scraped from Steam and IGDB.

Everything lives in a single portable `GameManagerConfig` folder. Back it up, move it to a new machine, and your entire curated library travels with it — covers, logos, trailers, screenshots and all.

> Pair it with **[CREMA](https://github.com/shampoo-is-a-lie/CREMA)** — the fullscreen, gamepad-driven companion app. Place both AppImages in the same folder and they share the same library automatically.

## Screenshots

| | | |
|:---:|:---:|:---:|
| ![](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/assets/images/cngm_scr_02.jpg) | ![](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/assets/images/cngm_scr_03.jpg) | ![](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/assets/images/cngm_scr_04.jpg) |
| ![](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/assets/images/cngm_scr_05.jpg) | ![](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/assets/images/cngm_scr_06.jpg) | ![](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/assets/images/cngm_scr_07.jpg) |

## Features

- **Store Sync** — Native Heroic integration (Epic, GOG, Amazon) + Steam API import. Launch commands are filled in automatically for every game, installed or not.
- **Auto-Fetch** — One click pulls cover art, hero art, transparent logo, screenshots, description, HLTB, ProtonDB, Metacritic, co-op info and franchise data.
- **SteamGridDB** — Browse and apply fan-made community art for any asset. Manual search for precise game editions.
- **YouTube Trailers** — Search, pick and download trailers locally via bundled yt-dlp. Trailers play instantly and entirely offline from the Gamepage.
- **Installed Status** — Live Steam library watcher (no manual refresh needed) + Heroic detection. Green/orange indicator on every game card.
- **IGDB Integration** — Richer metadata and a scraping fallback for games not on Steam.
- **50+ Themes** — Full theme picker with live preview. Categories include Linux ricing classics (Dracula, Gruvbox, Nord, Catppuccin…), retro consoles, sci-fi universes, horror aesthetics, and more.
- **Welcome & Setup Guide** — Interactive first-run screen with inline action buttons for every setup step.
- **Portable & Backupable** — One-click ZIP backup and restore. Move your entire library between machines or to a Steam Deck effortlessly.
- **CSV Import / Export** — Full spreadsheet round-trip for bulk library management.
- **Multiple Views** — Gallery (cover art grid with Ken Burns hero header) and List (high-density spreadsheet) views with live filtering by store, category, install status, favourites, and more.

## Installation

1. Download the latest `CNGM.AppImage` from the [Releases](https://github.com/shampoo-is-a-lie/CafeNeuroticoGameManager/releases) page.
2. Make it executable:
   ```bash
   chmod +x CNGM.AppImage
   ```
3. Run it:
   ```bash
   ./CNGM.AppImage
   ```

On first launch, CNGM creates a `GameManagerConfig` folder in the same directory. All your data stays there — no hidden system folders.

**Adding CREMA:** place `CREMA.AppImage` in the same folder as `CNGM.AppImage`. A *Go Fullscreen With CREMA* button appears automatically at the bottom of the sidebar.

**Desktop integration:** open CNGM, go to **Tools → System → Add to Application Menu** to register both apps in your desktop launcher (GNOME, KDE, XFCE…) with icons. No terminal required.

## Requirements

- Linux (x86_64)
- [Heroic Games Launcher](https://heroicgameslauncher.com/) for Epic / GOG / Amazon sync *(optional)*
- A free Steam Web API key for Steam library import *(optional)*
- A free IGDB / Twitch dev key for enriched metadata *(optional)*
- A free SteamGridDB API key for custom artwork *(optional)*

> yt-dlp and FFmpeg are bundled — no extra installs needed.

## Third-Party Software

CNGM bundles the following tools:

| Tool | License |
|---|---|
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | [The Unlicense](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE) (Public Domain) |
| [FFmpeg](https://ffmpeg.org) | [GPL v2+](https://ffmpeg.org/legal.html) |

## The Cafe Neurotico Ecosystem

```
  CNGM  ◈        Central hub — PC game library, store sync, launches all companion apps
    │
    ├──▸  CREMA       Fullscreen / gamepad counterpart for CNGM + EmuLatte
    │
    ├──▸  GRINDER     GOG & Epic install engine — feeds games back into CNGM
    │
    ├──▸  EmuLatte    ROM library manager — emulation counterpart to CNGM
    │
    └──▸  CN Clock    Floating desktop clock — shows art from CNGM + EmuLatte
```

Place all AppImages in the same folder. CNGM auto-detects its companions and integrates them — no configuration needed.

## License

Copyright (C) 2026 J.R.A. (Shampoo is a Lie)

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License v3.0** as published by the Free Software Foundation.

See the [LICENSE](LICENSE) file for the full license text.

---

<div align="center">
<sub>Built with love for Linux gamers. Part of the <a href="https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/">Cafe Neurotico ecosystem</a>.</sub>
</div>
