---
type: Roadmap
title: Pass B — Realistic Rings and Boss Balance
description: Active pass plan for realistic harness rings, boss-versus-human balance, and the boss targeting behaviour.
status: draft
audience: internal
tags: [roadmap, harness, balance, bosses]
---
# 31 — Pass B: Realistic Rings and Boss Balance

**Status:** In progress on branch `claude/pass-b-harness-and-bosses`, started 2026-09-27.
Pass B from [27](27-next-passes.md), widened by the owner to include the computer bosses.

## Why

The owner's report (2026-09-27): several bosses in the ring with one human are close to
hopeless, because every boss is on one Boss team and attacks humans, while humans without a
pre-arranged team treat each other as fair game. "A level 2 against two beginners is
reasonable, or a level 1 against a level 1 or 2 by itself, but a level 1 fighting a
beginner, a level 1, and a level 5, all working together, is hopeless." He likes that it
pushes players to bring a friend, but two humans who did not pre-arrange teams still do not
collaborate while the bosses do. No specific answer is required; this pass measures first.

Found while scoping:

- **The harness builds every contestant as a boss** (`buildContestant` calls
  `randomContestant({ isBoss: true })`), so every "random legal deck" was a boss deck, which
  drops Flee, Harden, Heal, Hit, and Whiskey Shot. No run so far measured a player's deck.
- **Boss card level-ups are almost all no-ops.** `randomCharacter` calls
  `card.levelUp(random(0, 6))` on every boss card, but only Kalevala implements `levelUp`.
- **How a boss chooses a target:** `TARGET_HUMAN_PLAYER_WEAK` takes the ordinary next-player
  target and, if that is a boss, a random human instead. With one human, every boss hits that
  human every turn.

## Tasks

| # | Slice | Status | Commit |
|---|---|---|---|
| 1 | Harness roles: a spec can be a **human** (player-like starting deck, default targeting, own faction) or a real **boss** (Boss team, boss deck, boss targeting). `sim:bosses` runs the owner's scenarios and reports the human side's win rate | Done | this commit |
| 2 | Realistic rings: player-like decks by default, mixed ring sizes (2–12), team shapes, and level spreads, and a per-class win-rate curve across levels (Pass B tasks 1–3 and 5) | Not started | — |
| 3 | Boss balance: options measured in `sim:bosses`, owner's choice implemented | Not started | — |
| 4 | Boss behaviour review: targeting variety, the no-op level-ups, and anything else the runs show | Not started | — |
| 5 | Docs, generated references, independent review | Not started | — |

## Evidence before any change (`sim:bosses`, 200 fights per row)

| Scenario | Human wins |
|---|---|
| L1 vs one L1 boss | 52% |
| L1 vs one L2 boss | 19% |
| L1 vs one beginner boss | 80% |
| L2 vs two beginner bosses | 24% |
| L1 vs two L1 bosses | 2% |
| L3 vs two L1 bosses | 12% |
| L1 vs beginner + L1 + L5 bosses | 0% |
| two L1s, no team, vs L1 + L2 bosses | 1% |
| two L1s, one team, vs L1 + L2 bosses | 29% |
| two L2s, one team, vs two L2 bosses | 51% |
| three L1s, one team, vs L1 + L2 + L3 bosses | 10% |

- **Outnumbering decides these fights more than levels do.** One-on-one is fair; a level 3
  against two level 1 bosses still wins only 12%.
- **Bosses as rivals** (no Boss team, default targeting) changed nothing: a lone human is
  still hit and must outlast everyone.
- **Humans allied** fix the two-human case (1% to 29%; 51% at even numbers).

## Decisions (owner, 2026-09-27)

| Question | Decision |
|---|---|
| Humans without a team | **Unite, then settle it.** While any boss is still fighting, teamless humans are one side and never target each other. Once the bosses are down, the alliance ends and the remaining humans finish a normal free-for-all. |
| Boss count | **Normally one boss per human**, with a lower chance of an extra boss (an ambush). |
| Boss levels | **Generally the highest human's level + 1**, and a **level budget**: the bosses' combined levels must not exceed the humans' combined levels. The owner's example: three level 3 humans (9) against level 5, 3, and 1 bosses (9) is fair. The budget is also what keeps an ambush beatable: an extra boss comes in weaker. |
| Boss behaviour | **Varied personalities**: each boss gets a temperament when it spawns (the weakest, the strongest, a grudge, or unpredictable) and says so as it enters. |
