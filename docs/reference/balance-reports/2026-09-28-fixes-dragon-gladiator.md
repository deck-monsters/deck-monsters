---
type: Reference
title: Dragon, Gladiator, and Tsunami fixes, 2026-09-28
description: Roadmap 35 tasks 2 and 3, the variants tried for the Dragon, the Gladiator, and Tsunami on the searched hands, and the combined before/after check that chose the changes.
status: stable
audience: internal
tags: [balance, harness, reports, monsters, cards]
---
# Dragon, Gladiator, and Tsunami fixes, 2026-09-28

Roadmap 35 tasks 2 and 3 ([plan](../../roadmap/35-balance-fixes.md)).

**Method.** Every candidate is an experiment variant (`harness/src/balance/variants.ts`)
played in a fixed-hand matrix: the searched hands from the
[search report](2026-09-28-search.md) at levels 1, 3 and 5, every pair, seat-swapped, 400
fights a pair, on the same seeds as the "before" run. That is 25,200 fights per variant,
0 failed. Read with `sim-matrix-report <before> <after>`. The chosen changes are then written
into the engine.

## Candidates

Field average, before → after, at levels 1 / 3 / 5. The band's floor is 35%.

| Variant | Dragon | Gladiator |
|---|---|---|
| (before) | 23 / 33 / 32% | 39 / 37 / 31% |
| +3 HP | 27 / 38 / 36% | **45 / 40 / 36%** |
| +1 AC | 26 / 36 / 34% | 42 / 40 / 34% |
| Youth AC 2 (+2 to level 3, +1 to level 6) | 34 / 40 / 33% | 48 / 44 / 34% |
| +1 STR (over the +2 modifier budget) | 39 / 40 / 41% | 50 / 44 / 38% |
| STR +1 for INT −1 (inside the budget) | 36 / 37 / 32% | — |
| No winded AC after Fire Breath | 23 / 33 / 34% (no effect) | — |
| **+3 HP and youth AC 2** | **38 / 44 / 39%** | **53 / 47 / 38%** |

**Tsunami** in the Dragon's searched hand, in place of a Hit, against every other monster's
searched hand. This is the change in field score, points, at levels 1 / 3 / 5 (1,800 fights
per cell):

| Tsunami | L1 | L3 | L5 |
|---|---|---|---|
| As it was (5 to everyone, the Dragon too) | −3.9 | −7.0 | +2.4 |
| **The Dragon rolls 1d20 + DEX vs 10 to ride its own wave** | +1.7 | −0.3 | +6.6 |
| The Dragon takes half | −1.4 | −4.6 | +3.7 |

## Choices

- **The Dragon: +3 HP and youth AC 2.** It stays inside the modifier budget every monster
  shares, and it is the best result that does.
  - Trading INT for STR helped only at level 1; a caster needs its INT later.
  - Fire Breath's winded penalty is not the problem: removing it changed nothing, so Fire
    Breath is untouched. That keeps its dodge roll, the card's own excitement.
- **The Gladiator: +3 HP and youth AC 2.** It is strong early and fading by level 7, the
  owner's "brutes strong early". +3 HP alone was the smallest change that reached the band,
  and the youth AC makes the early edge the owner asked for.
- **Tsunami: ride the wave.** It went from worse than the Hit it replaces to about a Hit, a
  little more at level 5. The owner's "slight tweak, not overpowered" holds. The self-risk
  stays as a roll the Dragon can win.

## Combined check (all three, one matrix)

### Level 1

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 62% → 57% | -5.1 | WeepingAngel 38% | Jinn 68% | in band |
| Minotaur | 55% → 49% | -6.6 | Basilisk 37% | Jinn 63% | in band |
| Gladiator | 39% → 49% | +10.9 | WeepingAngel 30% | Jinn 61% | in band |
| WeepingAngel | 71% → 69% | -1.9 | Minotaur 58% | Dragon 94% | over 85% (Dragon) |
| Jinn | 43% → 38% | -5.1 | Unicorn 28% | Dragon 60% | in band |
| Unicorn | 57% → 53% | -4.1 | WeepingAngel 34% | Jinn 72% | in band |
| Dragon | 23% → 34% | +11.9 | WeepingAngel 7% | Gladiator 45% | below band; under 20% (WeepingAngel) |

### Level 3

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 52% → 48% | -3.5 | WeepingAngel 34% | Dragon 61% | in band |
| Gladiator | 37% → 45% | +8.4 | WeepingAngel 32% | Dragon 52% | in band |
| Jinn | 52% → 49% | -2.7 | WeepingAngel 39% | Dragon 60% | in band |
| Minotaur | 58% → 54% | -4.6 | WeepingAngel 37% | Jinn 58% | in band |
| WeepingAngel | 68% → 64% | -3.5 | Jinn 61% | Gladiator 69% | in band |
| Unicorn | 51% → 48% | -3.5 | WeepingAngel 39% | Gladiator 52% | in band |
| Dragon | 33% → 42% | +9.3 | WeepingAngel 35% | Unicorn 50% | in band |

### Level 5

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 54% → 53% | -1.1 | Unicorn 34% | Dragon 65% | in band |
| Gladiator | 31% → 37% | +6.2 | WeepingAngel 23% | Dragon 61% | in band |
| Jinn | 69% → 67% | -1.5 | Basilisk 49% | Dragon 82% | in band |
| Minotaur | 36% → 34% | -2.1 | WeepingAngel 10% | Gladiator 56% | below band; under 20% (WeepingAngel) |
| WeepingAngel | 66% → 63% | -2.8 | Jinn 31% | Minotaur 90% | over 85% (Minotaur) |
| Unicorn | 61% → 58% | -3.1 | Jinn 39% | Gladiator 73% | in band |
| Dragon | 32% → 37% | +4.4 | Jinn 18% | Minotaur 55% | under 20% (Jinn) |

### Excitement and hope

| Measure | Before | After | Change | Guardrail |
|---|---|---|---|---|
| rounds per fight | 2.273 | 2.401 | 6% | ok |
| Curse of Loki per fight | 1.139 | 1.221 | 7% | ok |
| strokes of luck per fight | 1.149 | 1.217 | 6% | ok |
| turnarounds from 25 behind (share of decisive fights) | 0.324 | 0.337 | 4% | ok |
| turnarounds from 50 behind (share of decisive fights) | 0.051 | 0.056 | 9% | ok |

## What is left

- **The Dragon at level 1 (34%)** and **the Minotaur at level 5 (34%)** sit just under the
  floor. In both cases the cause is the Weeping Angel: it beats the Dragon 94% at level 1
  and the Minotaur 90% at level 5. The Angel's over-85% matchups are the next item: roadmap
  35 said to watch them and let the confirmation run decide.
- **Every other monster is in band at every level, and the guardrails rose slightly:**
  rounds, Curse of Loki, strokes of luck, and turnarounds from 25 and 50 points behind are
  all up 4-9%.
- **The owner's confirmation run** (task 4) repeats this on newly searched hands, with the
  fixed starting hands and the new engine, at levels 1, 3, 5 and 7 with more fights.
