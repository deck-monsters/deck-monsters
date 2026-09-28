---
type: Roadmap
title: Heal, Stat Cards, and Class Balance
description: Active plan for the heal INT-penalty fix, boost and curse cards since they began moving rolls, and a class rebalance to the owner's 35-75% band.
status: draft
audience: internal
tags: [roadmap, balance, cards]
---
# 33 — Heal, Stat Cards, and Class Balance

**Status:** In progress on branch `claude/heal-penalty-and-stat-card-balance`, started
2026-09-28 from an owner report: a Unicorn's Heals rolled `1d4 − 2` all fight after a
Concussion.

## Tasks

| # | Slice | Status | Commit |
|---|---|---|---|
| 1 | Heal: an INT penalty never reduces a heal; a bonus still fades (10b #198). Roadmap 10: J and A closed by the owner, F re-scoped to indentation and spacing with a first example | Done | 0f5d3f7 |
| 2 | Boost and curse cards since #175 (temporary DEX, STR, and INT changes move rolls): measure what each is worth per play and whether any needs a small tweak | Done: ±5 cap on temporary DEX/STR/INT changes, and curse attacks curse only on a hit | f9fbbc5, 9b15e87, this commit |
| 3 | Baseline class curves after tasks 1-2, random and likely hands; why some monsters seem to always carry their signature card | In progress | |
| 4 | Rebalance to the owner's band: every monster wins 35-75% at every level (ancient dragons up to 80); brutes stronger early, casters stronger late. Candidates: a per-card copy limit for area spells, level scaling | Planned | |

## Decisions (owner, 2026-09-28)

| Question | Decision |
|---|---|
| Heal and an INT penalty | Reads as a bug on a 1d4; fix it. Curse of Loki stays |
| Boost and curse cards | "Mostly fine", but test for minor tweaks; each play is an automatic stat change |
| Stacking cap | A temporary DEX, STR, or INT change caps at ±5 (was `level + 1`); AC keeps `level + 1` |
| Curse attacks | Apply the curse only when the hit lands (owner's suggestion, measured below) |
| Class balance band | No monster below 35% or above 75% at any level; ancient dragons may reach 80%. Gladiator and Basilisk stronger early, Clerics and Wizards stronger late. The Weeping Angel and Jinn at ~93% were "wild" |

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

## Evidence: class curves after tasks 1-2 (`sim:rings curves`, 120 fights per cell)

Each monster as a human against a random other monster at its level; share of decisive
fights won. **Bold** is outside the owner's 35-75% band.

| Monster | Random hands L1 / L3 / L5 / L10 / L15 / L20 | Likely hands L1 / L3 / L5 / L10 / L15 / L20 |
|---|---|---|
| Basilisk (Barbarian) | 68 / 66 / 61 / 49 / 55 / 50 | **77 / 79** / 55 / **25 / 19 / 34** |
| Gladiator (Fighter) | 43 / 41 / 44 / 52 / 39 / 52 | 60 / 60 / 74 / 62 / **33** / 41 |
| Jinn (Bard) | 45 / 44 / 57 / 55 / 51 / 44 | 59 / **87** / 65 / 51 / **91 / 85** |
| Minotaur (Barbarian) | 60 / 48 / 64 / 58 / 41 / 43 | 54 / 54 / 51 / 62 / 47 / **32** |
| Weeping Angel (Cleric) | 44 / 42 / 43 / 60 / 61 / 56 | **80** / 73 / 56 / **85 / 84 / 93** |
| Unicorn (Cleric) | **76** / 59 / 62 / 61 / 75 / 73 | 63 / 35 / **17** / 40 / 49 / **24** |
| Dragon (Wizard) | **32** / 45 / 57 / 41 / 56 / 64 | **4 / 9 / 6 / 35** / 56 / **81** |

Random hands are nearly inside the band already. Likely hands, which follow the handbook's
builds and each monster's signature cards, are where the extremes live; they are also the
harness's guesses at what players equip.

## Why some monsters seem to always carry their signature card

Nothing equips a player's hand automatically. Every starting deck (`getMinimumDeck`) holds
one copy of each monster's signature card, and only that monster (or class) can hold it,
so every player has exactly one from the start. Extra copies only come from drops, and the
rarities differ: Blast (any Cleric) is abundant (65), Fire Breath common (40), Sticketh rare
(15), and Sandstorm, Blink, and Battle Focus epic (5). An Angel collects Blasts quickly; a
Jinn usually has the one Sandstorm, and its players equip it because it is the Jinn's best
card. For bosses, the hand is a random slice of the eligible deck: 70-73% carry their
signature card, the Weeping Angel 96% and the Dragon 86% because Blast and Fire Breath also
arrive through fills.

Bosses drop Flee, Harden, Heal, Hit, and Whiskey Shot from that deck (`randomCharacter`).
The list dates from the original JavaScript engine with no recorded reason; its effect is
that a boss holds no filler. It predates newer basics (Scotch, Turkey Thigh, Basic Shield,
Thick Skin), so a boss can still hold those.
