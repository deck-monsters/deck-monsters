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
| 1 | Heal: an INT penalty never reduces a heal; a bonus still fades (10b #198). Roadmap 10: J and A closed by the owner, F re-scoped to indentation and spacing with a first example | Done | 0f5d3f7 |
| 2 | Boost and curse cards since #175 (temporary DEX, STR, and INT changes move rolls): measure what each is worth per play and whether any needs a small tweak | Measured; one tweak awaits the owner | f9fbbc5, this commit |

## Decisions (owner, 2026-09-28)

| Question | Decision |
|---|---|
| Heal and an INT penalty | Reads as a bug on a 1d4; fix it. Curse of Loki stays |
| Boost and curse cards | "Mostly fine", but test for minor tweaks; each play is an automatic stat change |

## Evidence: stat cards (`sim:statcards`, 300 fights per cell)

Mirror matches. One side swaps a Hit in a four-Hit hand for the card; the number is that
side's decisive win share minus the four-Hits mirror's (59/65/57, 58/59/57, 51/52/55: the
first side has an edge). Mean over Minotaur, Gladiator, and Weeping Angel at levels 1, 5,
and 10. "Before #175" reran the same seeds with temporary DEX/STR/INT deltas left out of the
rolls (a local switch, not committed).

| Card | Now | Before #175 |
|---|---:|---:|
| Adrenaline Rush / Ecdysis (+1 DEX, +1 STR, self) | −4.6 | −32.0 |
| Calisthenics (+2 DEX, self) | −20.0 | −29.2 |
| Feline Companion (+2 INT, self) | −27.1 | −27.1 |
| Concussion (a hit, −1 to −2 INT) | −5.3 | −5.3 |
| Molasses (a hit, −1 DEX) | +2.2 | −5.4 |
| Harden (+1 AC, self), reference | −22.9 | −22.9 |
| Soften (a hit, −1 AC), reference | +2.9 | +2.9 |
| Basic Shield / Thick Skin (+2 AC), reference | −14.6 | −14.6 |

A hand of Hits only is a floor for the INT cards: Hit never reads INT, so Feline Companion
and Concussion show no change here. Two copies a hand at the highest caps:

| Two copies, four-card hand | Minotaur L10 | Minotaur L20 | Gladiator L10 | Gladiator L20 |
|---|---:|---:|---:|---:|
| Adrenaline Rush | −39 | −20 | −28 | −12 |
| Calisthenics | −52 | −44 | −42 | −41 |
| Molasses | −5 | +12 | +4 | +26 |

## Findings

- #175 made the DEX and STR boosts playable rather than strong: none is worth the Hit it
  replaces on average, even with two copies at level 20. No boost needs a nerf.
- Molasses is the one that grows. It is a Hit plus −1 DEX that stacks toward the target's
  cap (`level + 1`, so −21 at level 20) over a long fight, and DEX is both the target's
  accuracy and its defense. Two copies at level 20 win 12–26 points more than Hits.
- Options for the owner: leave it (it is a Hit with a rider, and only level 15+ stacks
  enough to matter); cap a temporary DEX/STR/INT change at a fixed size (for example ±5)
  instead of `level + 1`; or let Molasses's own curse stop at a smaller cap.
