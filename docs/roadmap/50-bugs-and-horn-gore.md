---
type: Roadmap
title: Bugs from roadmap 10 and Horn Gore
description: A small pass after roadmap 49 — archive 49, roadmap 10's reset cleanup (J), slow sims (K) and feed spacing (F), and Horn Gore's matchup to-hit.
status: draft
audience: internal
tags: [roadmap, bugs, cards, balance]
---
# 50 — Bugs from roadmap 10, and Horn Gore

**Status:** In progress on `claude/roadmap-49-archive-and-fixes`. Started 2026-10-13.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Archive roadmap 49; record the Horn Gore question on roadmap 11 | Done | `f363fbe` |
| 2 | Roadmap 10 J, first half: dispose stops the fight loop, cancels prompts, refuses saves (10b #251) | Done | this commit |
| 3 | Horn Gore: smooth the matchup to-hit so "strong against" is not worse than neutral, and a modest buff, with `sim:monster Minotaur` before and after | Next | |
| 4 | Roadmap 10 K: time long sim runs, find the slow seeds | Open | |
| 5 | Roadmap 10 F: card box blank lines and list markers in the fight log | Open | |

## Decisions

- Owner, 2026-10-13: smooth Horn Gore's inconsistency and consider a small buff. A level 3
  Minotaur's AC 7 is the low end of its random variance, not a bug.
