---
type: Reference
title: Roadmap 35 PR D confirmation, part 2 (raw)
description: Raw matrix report comparing the new searched hands with the PR C hands, both on PR D code.
status: stable
audience: internal
tags: [balance, harness, reports, raw]
---
# Roadmap 35 PR D confirmation, part 2 (raw)

Raw output from the owner's run. The readable summary is [2026-09-29-confirm-35d.md](2026-09-29-confirm-35d.md).

## Level 1

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 52% → 45% | -7.1 | Dragon 20% | Minotaur 58% | under 20% (Dragon) |
| Minotaur | 48% → 46% | -1.3 | WeepingAngel 38% | Jinn 63% | in band |
| Unicorn | 61% → 43% | -17.9 | Dragon 16% | Gladiator 54% | under 20% (Dragon) |
| Gladiator | 50% → 47% | -3.1 | WeepingAngel 27% | Jinn 65% | in band |
| Jinn | 44% → 39% | -4.6 | WeepingAngel 32% | Unicorn 47% | in band |
| WeepingAngel | 68% → 67% | -1.0 | Minotaur 62% | Dragon 74% | in band |
| Dragon | 28% → 63% | +35.0 | WeepingAngel 26% | Unicorn 84% | in band |

## Level 3

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 50% → 45% | -5.2 | Dragon 27% | Minotaur 59% | in band |
| Gladiator | 47% → 43% | -3.6 | WeepingAngel 29% | Minotaur 58% | in band |
| Jinn | 48% → 45% | -3.3 | WeepingAngel 33% | Minotaur 51% | in band |
| Minotaur | 42% → 40% | -1.8 | Dragon 32% | Jinn 49% | in band |
| WeepingAngel | 67% → 63% | -4.3 | Dragon 51% | Gladiator 71% | in band |
| Unicorn | 50% → 51% | +1.0 | Dragon 32% | Minotaur 61% | in band |
| Dragon | 46% → 63% | +17.3 | WeepingAngel 49% | Basilisk 73% | in band |

## Level 5

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 53% → 51% | -2.2 | WeepingAngel 36% | Gladiator 61% | in band |
| Gladiator | 40% → 37% | -3.3 | WeepingAngel 21% | Minotaur 52% | in band |
| Jinn | 58% → 56% | -1.5 | Basilisk 51% | Minotaur 60% | in band |
| Minotaur | 39% → 36% | -2.8 | WeepingAngel 15% | Gladiator 48% | under 20% (WeepingAngel) |
| WeepingAngel | 61% → 66% | +4.9 | Jinn 45% | Minotaur 85% | over 85% (Minotaur) |
| Unicorn | 49% → 47% | -2.6 | Dragon 24% | Gladiator 67% | in band |
| Dragon | 51% → 59% | +7.5 | Jinn 45% | Unicorn 76% | in band |

## Level 7

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 38% → 43% | +5.0 | Jinn 22% | Gladiator 53% | in band |
| Gladiator | 49% → 49% | +0.1 | WeepingAngel 46% | Minotaur 52% | in band |
| Jinn | 68% → 67% | -0.2 | Gladiator 49% | WeepingAngel 80% | in band |
| Minotaur | 45% → 43% | -2.0 | Jinn 32% | Dragon 53% | in band |
| WeepingAngel | 51% → 54% | +2.4 | Jinn 20% | Dragon 67% | in band |
| Unicorn | 58% → 57% | -1.0 | Jinn 24% | Dragon 97% | over 85% (Dragon) |
| Dragon | 42% → 38% | -4.3 | Unicorn 3% | Gladiator 50% | under 20% (Unicorn) |

## Excitement and hope

| Measure | Before | After | Change | Guardrail |
|---|---|---|---|---|
| rounds per fight | 1.690 | 1.641 | -3% | ok |
| Curse of Loki per fight | 0.829 | 0.797 | -4% | ok |
| strokes of luck per fight | 0.841 | 0.819 | -3% | ok |
| turnarounds from 25 behind (share of decisive fights) | 0.235 | 0.238 | 1% | ok |
| turnarounds from 50 behind (share of decisive fights) | 0.019 | 0.020 | 4% | ok |
