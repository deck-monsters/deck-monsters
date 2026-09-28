---
type: Roadmap
title: Heal Penalty and Stat-Card Balance
description: Active plan for the heal INT-penalty fix and a measured look at boost and curse cards since they began moving rolls.
status: draft
audience: internal
tags: [roadmap, balance, cards]
---
# 33 — Heal Penalty and Stat-Card Balance

**Status:** In progress on branch `claude/heal-penalty-and-stat-card-balance`, started
2026-09-28 from an owner report: a Unicorn's Heals rolled `1d4 − 2` all fight after a
Concussion.

## Tasks

| # | Slice | Status | Commit |
|---|---|---|---|
| 1 | Heal: an INT penalty never reduces a heal; a bonus still fades (10b #198). Roadmap 10: J and A closed by the owner, F re-scoped to indentation and spacing with a first example | Done | this commit |
| 2 | Boost and curse cards since #175 (temporary DEX, STR, and INT changes move rolls): measure what each is worth per play and whether any needs a small tweak | Planned | |

## Decisions (owner, 2026-09-28)

| Question | Decision |
|---|---|
| Heal and an INT penalty | Reads as a bug on a 1d4; fix it. Curse of Loki stays |
| Boost and curse cards | "Mostly fine", but test for minor tweaks; each play is an automatic stat change |
