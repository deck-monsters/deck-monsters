---
type: Roadmap
title: The Gauntlet against a lone player
description: Plan to fix the Gauntlet ring event, which a lone human wins about 4% of the time and which fires in about a fifth of all fights.
status: draft
audience: internal
tags: [roadmap, balance, bosses, ring-events]
---
# 38 — The Gauntlet against a lone player

**Status:** In progress (2026-09-30). First measurements done; the owner chose to measure
"rivals when outnumbered" before anything ships.

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

## First results (2026-09-30)

Measured in a worktree (commits 91153eda and ffb6048a on the study branch, report
`2026-09-29-gauntlet.md` there, not yet merged). A lone human with a likely deck, 1,000 fights
per monster type per level per variant (7,000 per mean, standard error under 1 point).

| Level | One boss, no event (reference) | Gauntlet today | Rivals when alone | Extras as minions | Rivals + minions |
|---|---|---|---|---|---|
| Beginner | 45 | 0 | 25 | 1 | 48 |
| 1 | 59 | 0 | 36 | 4 | 57 |
| 3 | 70 | 1 | 60 | 18 | 69 |
| 5 | 72 | 8 | 71 | 32 | 74 |

- **Rivals is the fix that matters.** Boss personalities already respect teams, so ignoring
  teams (as Blood Feud does) is enough for bosses to turn on each other; no targeting override
  was needed.
- **Two humans are broken too:** 1% at level 1 and 14% at level 3 against the Gauntlet
  (65% and 77% with no event). "Rivals when alone" cannot help them by design; minions lift
  them to 17% and 42%.
- **Frequency:** with `event-weights-global` the Gauntlet fires at 7.5% of countdowns on every
  roster; a lone player's event rate falls from 25% to 7.5%.

**Owner's choice (2026-09-30): measure "rivals when outnumbered"** (bosses fight each other
whenever they outnumber the humans, which covers one human against three and two against four),
with and without minion extras, and the ambush case it also touches, before shipping.

## Acceptance

- A lone human's Gauntlet win rate inside the owner's 20–80% band at beginner level and at
  levels 1, 3 and 5, and no single matchup over 85%.
- The Gauntlet still reads as a scare: the boss side should keep the edge.
- The Gauntlet is well under a fifth of lone-player fights.
- Two-player Gauntlets measured too, so a fix for one human does not make two humans trivial.

## Tasks

| # | Task | Status | Commit |
|---|---|---|---|
| 1 | Engine switches for the variants (class or module settings, off by default) and a harness plan: a lone human at beginner and levels 1, 3, 5 against the ring's own boss spawns with the Gauntlet forced, plus two-human rings; 2,000 fights a cell | First pass done at 1,000 a cell (above); "rivals when outnumbered" being measured | 91153eda, ffb6048a (study branch) |
| 2 | Frequency: measure the event mix per roster shape under today's rule and `event-weights-global`, by simulation or by counting eligible sets | Done by arithmetic (in the study report) | ffb6048a (study branch) |
| 3 | The owner picks from the results; ship the chosen rules on, remove the losers, update `boss-encounters.md` and the handbook text | Planned | |
