---
type: Roadmap
title: Dream Desktop, a System 7 theme
description: Brief for Dream Desktop, a theme in the spirit of classic Mac OS that came out of the Millefleur exploration, to be developed as its own theme.
status: draft
audience: internal
tags: [roadmap, web, theme, design]
---
# 47: Dream Desktop, a System 7 theme

**Status:** a brief, not a design. It came out of the Millefleur exploration
([roadmap 46](46-unicorn-theme.md)) as direction C. The owner called it "cool" and wants it
developed as a completely separate theme, rather than folded into Millefleur. Millefleur borrowed
a few of its shapes (folder tabs, a pinstriped title bar, the close box, the default ring); this
theme is where those shapes get to be themselves.

![Dream Desktop, the first sketch](../archive/studies/millefleur-theme/directions/c-dream-desktop.jpg)

The first sketch above is one Workshop screen
([HTML](../archive/studies/millefleur-theme/directions/c-dream-desktop.html)). Nothing else has been
drawn.

## The idea

The game, running on a Macintosh in 1991: crisp 1-pixel ink outlines, windows with pinstriped
title bars and a close box, rounded-rectangle buttons, the thick default-button ring, a dithered
desktop pattern, and Susan Kare's spirit in the icons. The pixel monsters already look as if
they belong there. Where Millefleur is soft and painted, Dream Desktop is precise, clean and
witty. A sister theme, not a sibling.

## What to borrow, and what not to copy

Research and licensing notes from the first proposal still apply
([archived](../archive/studies/millefleur-theme/first-proposal.md), §2.5):

- **Borrow:** the window anatomy (title bar, close box, zoom box), pinstripes, the default
  button, dithered patterns, the 1-bit discipline, the selection rectangle, and Platinum's
  gentle grey bevels for a later System 7.5 or 8 variant.
- **Do not copy:** the Chicago font file, Apple's icons (the Happy Mac, the Finder face, the
  watch cursor), the Apple logo, or Platinum's exact artwork. Never draw a close box where
  nothing closes.
- **Type:** a face that is not Chicago. Candidates from the first proposal: Pixelify Sans
  (OFL), or ChicagoFLF on its author's public-domain statement (to be verified before use).

## Questions to explore

1. **Palette.** True 1-bit black and white with one accent (as in a Mac Plus), the pastel
   lavender of the first sketch, or the System 7 colour accents (the coloured window controls of
   a Mac II)?
2. **Panes as windows.** Here the Ring, Console and Workshop can each be a window with a title
   bar. On a phone, does the tab row become a menu bar, a window switcher, or stay as tabs?
3. **The feed.** Keep JetBrains Mono, or a bitmap-style monospace that still measures 0.6 em
   (the feed's row height depends on it, see roadmap 46 §1)?
4. **Desktop pattern.** Which dither, and how loud behind text?
5. **Icons.** Small 1-bit icons for the tabs and actions, drawn by us in the Kare spirit?

## How to develop it

Follow what worked for Millefleur ([process](../reference/millefleur/process.md)): side-by-side
studies before any screen, then four screens (Workshop, Ring, a sheet, Chat) on a design canvas,
every one rendered and looked at before the owner sees it, with contrast checked before showing.
Then a design system page under `docs/reference/`, and a build plan here.

## Actionable remainder

- [ ] Studies: palette, window chrome on a phone, desktop pattern, type.
- [ ] Four screens on a canvas, rendered and reviewed, for the owner.
- [ ] A design system page and a build plan, once the owner approves a direction.
