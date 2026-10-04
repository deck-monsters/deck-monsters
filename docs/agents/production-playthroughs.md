---
type: Agent Guide
title: Production playthroughs
description: How to run a phone and desktop browser playthrough of Deck Monsters without reading the engine first.
status: stable
audience: internal
tags: [verification, web, onboarding, agents]
---

# Production playthroughs

Use this when the task is to play the game and write down what a person saw.
A new-player walk reads only the brief, then the game. Code and the other docs
come after, and only to explain a finding.

## Setup

- Production is <https://deck-monsters.com>. Local play uses the app from
  [local testing](../operations/local-testing.md). Do not set
  `DECK_MONSTERS_SKIP_DELAYS` against production. A fight countdown is about 60
  seconds, and the fight itself runs at full pacing.
- Sign in with the test account already in the environment. Never print the
  password, an invite code, an email, or a user id. Suggested character names
  can embed an account-id fragment. Quote that name as `Beastmaster-<id>` and
  do not commit a screenshot that shows the fragment.
- Create a new room. Do not enter Game Night, Test Room A, or Test Room B.
  Delete the scratch room from Room settings before finishing. The settings
  page shows the invite code, so do not screenshot it.
- Phone is 390×844. Repeat the layout that changed, or any moment that was
  only seen on the phone, at 1440×900. At 1440 the room is a top nav plus two
  panes, not the six phone tabs.
- Headed Chrome on this VM is `/usr/bin/google-chrome` with `DISPLAY=:1`.
  `playwright-core` (1.55) drives it. Keep `storageState` and reload with it.
  The Console input is `#console-input`. Phone tabs are `#tab-ring`,
  `#tab-console`, `#tab-chat`, `#tab-workshop`, `#tab-fights`,
  `#tab-leaderboard`.

## While you are in a room

- `body` innerText includes the command reference even when it is closed.
  Quote what a screenshot shows, or text from the pane you are looking at.
- A prompt lives about two minutes. After it dies, the choices can still
  look tappable, and the next Enter is answered with `Prompt is no longer
  active.` Cancel action before typing the next command.
- Several controls with the same label can be in the DOM. Click the one
  whose box is on screen. A DOM `click()` on a hidden copy submits the
  wrong prompt.
- The Workshop's monsters are a wrapping grid (`.workshop-monster-row`).
  At 390 they stack in one column, so scroll the page down to the second
  monster. At 1440 they sit side by side.
- Do not treat a fight as over because a card's flavour contains the word
  "victory". Wait for the win line or a monster at 0 HP.

## What to commit

- Findings go in a `docs/reference/` note with OKF front matter, a row in
  [the documentation map](../README.md), and `pnpm docs:check`.
- Screenshots live beside that note. Drop any frame that shows an email,
  the name David, a user id, a password, an invite code, or a suggested
  display name that includes an account-id fragment.
- This kind of visit does not change game code and does not need a pull
  request unless the task asks for one.
