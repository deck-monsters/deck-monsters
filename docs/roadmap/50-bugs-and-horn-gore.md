---
type: Roadmap
title: Bugs from roadmap 10 and Horn Gore
description: A small pass after roadmap 49 — archive 49, roadmap 10's reset cleanup (J), slow sims (K) and feed spacing (F), and Horn Gore's matchup to-hit.
status: draft
audience: internal
tags: [roadmap, bugs, cards, balance]
---
# 50 — Bugs from roadmap 10, and Horn Gore

**Status:** Built on `claude/roadmap-49-archive-and-fixes`, ready for a PR. Started 2026-10-13.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Archive roadmap 49; record the Horn Gore question on roadmap 11 | Done | `f363fbe` |
| 2 | Roadmap 10 J, first half: dispose stops the fight loop, cancels prompts, refuses saves (10b #251) | Done | `fb9228d` |
| 3 | Three matchup tiers (weak < neutral < strong) for the whole hold family; Weeping Angels strong for Horn Gore; card text lists neutral (10b #253) | Done | `c12e8a4` |
| 4 | Roadmap 10 K: per-fight timing and a slow-fight warning; 6,240 boss fights showed no slow seed, only per-row output (10b #255) | Done | `1adf713`, this commit |
| 6 | Effects whose caster falls: grips, spells and gazes end at once with "<caster> has fallen, and …"; burns, poison, curses outlive the caster (10b #254) | Done | `9a639f1` |
| 7 | Review fixes: a reset during the final card, every save path refused after dispose, prompts answered after close, self-Blink, payload-only events in the fight log; the harness repro test ignores wall-clock timing | Done | this commit |
| 5 | Roadmap 10 F: the fight log draws events as the Ring feed does, no type labels or truncation (10b #252) | Done | `9a639f1` |

## Balance check (task 3)

`sim:monster`, 300 fights a row, random decks, before (`fb9228d`) and after (`c12e8a4`):

| Monster | Mean decisive win share | Shift by level (L1 / L5 / L10 / L15 / L20) |
|---|---|---|
| Minotaur (Horn Gore) | 44.6% → 50.6% | +2.7 / +7.3 / +6.6 / +7.8 / +5.9 |
| Gladiator (can hold the Forked Metal Rod) | 45.7% → 45.1% | within noise |

The Minotaur moves from below par to par. The largest single change is against the Weeping
Angel, now a strong matchup: 57% → 67% at level 5 and 53% → 68% at level 10, just over the
sim's 35–65% flag band. The owner keeps it (Angels have very powerful cards).

## Decisions

- Owner, 2026-10-13: smooth Horn Gore's inconsistency and consider a small buff; then, every
  hold card gets explicit strong and weak lists and three tiers, weak < neutral < strong.
  Weeping Angels are statues, so a horn is strong against them. The Minotaur's 67-68% against
  the Angel at levels 5 and 10 stays: Angels have very powerful cards.
- Owner, 2026-10-13: decide effects whose caster falls from the game world and "reality",
  and make each outcome obvious in the feed. Effects whose target falls are a separate question. A level 3
  Minotaur's AC 7 is the low end of its random variance, not a bug.
