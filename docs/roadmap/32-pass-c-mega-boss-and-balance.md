---
type: Roadmap
title: Pass C — Mega Boss, Class Balance, and Harness Decks
description: Active pass plan for the mega boss event, likely-deck harness rings with ring events, Unicorn and Gladiator balance, and the doubled Workshop console lines.
status: draft
audience: internal
tags: [roadmap, bosses, balance, harness]
---
# 32 — Pass C: Mega Boss, Class Balance, and Harness Decks

**Status:** In progress on branch `claude/pass-c-mega-boss-and-balance`, started 2026-09-27,
after Pass B ([31](../archive/roadmap/31-pass-b-rings-and-bosses.md), PR #403). The owner
asked for the leftovers in [11](11-balance-and-mechanics.md) and
[12](12-new-content-backlog.md#mega-boss-event), plus the doubled Workshop lines in the
Console, in one new branch and PR.

## Tasks

| # | Slice | Status | Commit |
|---|---|---|---|
| 1 | Workshop actions echo into the Console twice (the engine's lines plus the server's summary); keep one line per action (10b #195) | Done | 1b56fb7 |
| 2 | Harness: likely-deck archetypes per class beside the random hand (`deckStyle`), and ring events (`ringEvents`), both as `sim:rings` flags | Done | this commit |
| 3 | Balance: the Unicorn strong at every level, the Gladiator weak early, measured with task 2 against the class-curve target | Not started | — |
| 4 | The mega boss event | Not started | — |
| 5 | Docs close-out, generated references, independent review | Not started | — |

## Decisions (owner, 2026-09-27)

| Question | Decision |
|---|---|
| Mega boss frequency | **About once a day** per room, at a random time |
| Announcement | **30 minutes** ahead, with reminders, and a countdown players can see |
| Difficulty | Fitted to the humans in the ring when it starts so humans win **about 20%** |
| Reward | Every surviving challenger gets **bonus coins and XP and a guaranteed rare card** |
| Cancellation (from [12](12-new-content-backlog.md#mega-boss-event)) | No more than one human in the ring when it is due: cancelled with flavour, and a regular boss instead |

## Evidence: class curves, random against likely decks (`sim:rings curves`, 120 fights per cell)

Each monster as a human against a random other at its level, share of decisive fights won.

| Monster | Random decks L1 / L3 / L5 / L10 / L15 / L20 | Likely decks L1 / L3 / L5 / L10 / L15 / L20 |
|---|---|---|
| Basilisk (Barbarian) | 70 / 58 / 59 / 55 / 57 / 52 | 73 / 79 / 55 / 25 / 17 / 29 |
| Gladiator (Fighter) | 40 / 42 / 46 / 47 / 45 / 52 | 54 / 60 / 74 / 56 / 33 / 41 |
| Jinn (Bard) | 49 / 44 / 52 / 54 / 45 / 49 | 65 / 86 / 64 / 50 / 97 / 83 |
| Minotaur (Barbarian) | 61 / 53 / 63 / 57 / 53 / 47 | 54 / 54 / 51 / 60 / 43 / 30 |
| Weeping Angel (Cleric) | 37 / 48 / 49 / 58 / 53 / 67 | 83 / 68 / 56 / 83 / 93 / 99 |
| Unicorn (Cleric) | 71 / 56 / 58 / 64 / 67 / 66 | 66 / 34 / 17 / 41 / 52 / 36 |
| Dragon (Wizard) | 38 / 46 / 61 / 39 / 50 / 55 | 4 / 9 / 6 / 24 / 47 / 51 |

The deck model moves the verdict more than any card does: with likely decks the Gladiator is
fine early and the Unicorn weak, the reverse of the random-deck finding in 11, and the Dragon
collapses early while the Weeping Angel and Jinn run away late. The likely decks are guesses,
so no card changes on this alone; task 3 looks for causes that hold under both.
