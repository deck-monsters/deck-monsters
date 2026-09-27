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
| 1 | Workshop actions echo into the Console twice (the engine's lines plus the server's summary); keep one line per action (10b #195) | Done | this commit |
| 2 | Harness: likely-deck archetypes per class beside the random hand, and ring events on in `sim:rings` | Not started | — |
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
