---
type: Roadmap
title: The Gauntlet against a lone player
description: Plan to fix the Gauntlet ring event, which a lone human wins about 4% of the time and which fires in about a fifth of all fights.
status: draft
audience: internal
tags: [roadmap, balance, bosses, ring-events]
---
# 38 — The Gauntlet against a lone player

**Status:** Planned (2026-09-29). Measure first, on the harness, then the owner chooses.

## Why

The owner (2026-09-29), playing to test roadmap 37: "I keep ending up in battles like these
randomly … the bosses still only target me, not each other so it's pretty much impossible to
last long." The screenshots show one human against three beginner bosses.

Production, read-only, all fights to 2026-09-29:

| Ring event | Fights | Human wins | Boss wins | Draws |
|---|---|---|---|---|
| The Gauntlet | 25 | 1 (4%) | 22 | 1 |
| No event | 90 | 56 (62%) | 25 | 9 |
| Common Cause | 3 | 0 | 3 | 0 |
| Blood Feud | 2 | 2 | 0 | 0 |

The Gauntlet is 21% of all fights. Every four-monster fight in the last three days was a
Gauntlet with one human.

## Causes

- **It fires too often for a lone player.** A ring event rolls at 25% when the countdown arms,
  then picks by weight among the *eligible* events (`pickRingEvent`, `ring/ring-events.ts`).
  With one human and one boss the ring holds two monsters, and the Gauntlet (`playerCount >= 1`)
  is the only eligible event, since Blood Feud needs three contestants and the rest need two
  or more players. So every event roll in a lone boss fight is a Gauntlet: a quarter of them.
- **It is three against one.** The Gauntlet adds up to two bosses past the one-per-human quota.
  Bosses share the Boss team, so all three attack the human every turn.
- **The level budget cannot soften it at the bottom.** The extras come out of a level budget,
  so the more bosses there are, the weaker each is. At beginner level there is nothing lower,
  so all three arrive at full strength.

## Owner direction (2026-09-29)

"Run some harness tests. All of these feel reasonable."

- With one human, the bosses turning on each other "definitely feels like the right
  approach. Especially for a beginner boss." Not every Gauntlet has to be a Blood Feud.
- Minions are "an interesting idea too, either separately or in combination with that."
- Lone players can still meet a Gauntlet, but "20+ percent sounds way too often, and it
  *feels* like they're happening all the time."

## Candidates, each a harness variant off in play

| Variant | Change |
|---|---|
| `gauntlet-now` | Today's rules (the baseline) |
| `gauntlet-rivals-alone` | With one human, the Gauntlet's bosses are rivals: a free-for-all among bosses, as in Blood Feud. With two or more humans, unchanged |
| `gauntlet-minions` | The extras arrive as lesser minions at a third of their HP, as an ambush minion does |
| `gauntlet-rivals-minions` | Both |
| `event-weights-global` | Frequency: pick by weight among *all* events, and fire nothing if the one picked is not eligible. A lone player then meets a Gauntlet at 25% × 30/100 = 7.5% of countdowns, not 25%. Rings with more players are unchanged in which events can fire; only the "no event" share grows where few are eligible |

## Acceptance

- A lone human's Gauntlet win rate inside the owner's 20–80% band at beginner level and at
  levels 1, 3 and 5, and no single matchup over 85%.
- The Gauntlet still reads as a scare: the boss side should keep the edge.
- The Gauntlet is well under a fifth of lone-player fights.
- Two-player Gauntlets measured too, so a fix for one human does not make two humans trivial.

## Tasks

| # | Task | Status | Commit |
|---|---|---|---|
| 1 | Engine switches for the variants (class or module settings, off by default) and a harness plan: a lone human at beginner and levels 1, 3, 5 against the ring's own boss spawns with the Gauntlet forced, plus two-human rings; 2,000 fights a cell | Planned | |
| 2 | Frequency: measure the event mix per roster shape under today's rule and `event-weights-global`, by simulation or by counting eligible sets | Planned | |
| 3 | The owner picks from the results; ship the chosen rules on, remove the losers, update `boss-encounters.md` and the handbook text | Planned | |
