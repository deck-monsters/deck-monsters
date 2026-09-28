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
| 2 | Boost and curse cards since #175 (temporary DEX, STR, and INT changes move rolls): measure what each is worth per play and whether any needs a small tweak | Done: ±5 cap on temporary DEX/STR/INT changes, and curse attacks curse only on a hit | f9fbbc5, 9b15e87, this commit |

## Decisions (owner, 2026-09-28)

| Question | Decision |
|---|---|
| Heal and an INT penalty | Reads as a bug on a 1d4; fix it. Curse of Loki stays |
| Boost and curse cards | "Mostly fine", but test for minor tweaks; each play is an automatic stat change |
| Stacking cap | A temporary DEX, STR, or INT change caps at ±5 (was `level + 1`); AC keeps `level + 1` |
| Curse attacks | Apply the curse only when the hit lands (owner's suggestion, measured below) |

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

## Evidence: the cap and curse-on-hit (300 fights per cell)

Swing against four Hits a side, with the ±5 cap in place. Columns: Minotaur L1, L5, L10,
L20, then Gladiator L1, L5, L10, L20. "On hit" is the shipped rule.

| Hand | Curse always | Curse on hit |
|---|---|---|
| Molasses ×1 | +6 −1 +2 +8 / +1 +6 +1 +10 | −2 +3 +2 −2 / −1 +1 −3 −2 |
| Molasses ×2 | +2 +0 −1 +17 / +2 +7 +3 +18 | +3 −1 −2 −6 / +6 +4 −4 −3 |
| Soften ×1 | −1 +8 +7 +7 / −1 +7 +6 +7 | −2 −6 −8 −1 / +2 +2 −2 −3 |
| Concussion ×1 | −3 −6 −5 −14 / +2 −0 −9 −13 | −3 −4 −5 −11 / −2 −4 −13 −11 |

The cap alone left two Molasses at level 20 at +17 and +18: past the cap each play became
up to 4 extra damage, even on a miss. With the curse on the hit, Molasses and Soften sit
level with a Hit at every level. Concussion reads low against Hits because Hit never uses
INT; that is the probe, not the card.
