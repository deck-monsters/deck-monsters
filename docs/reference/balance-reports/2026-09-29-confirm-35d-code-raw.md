---
type: Reference
title: Roadmap 35 PR D confirmation, part 1 (raw)
description: Raw matrix report comparing PR D code with the PR C run on the same searched hands.
status: stable
audience: internal
tags: [balance, harness, reports, raw]
---
# Roadmap 35 PR D confirmation, part 1 (raw)

Raw output from the owner's run. The readable summary is [2026-09-29-confirm-35d.md](2026-09-29-confirm-35d.md).

## Level 1

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 52% → 52% | -0.0 | Unicorn 36% | Dragon 67% | in band |
| Minotaur | 47% → 48% | +0.1 | WeepingAngel 40% | Dragon 67% | in band |
| Jinn | 44% → 44% | +0.3 | Unicorn 31% | Dragon 62% | in band |
| Gladiator | 49% → 50% | +0.4 | WeepingAngel 26% | Dragon 70% | in band |
| Unicorn | 61% → 61% | -0.5 | WeepingAngel 47% | Dragon 73% | in band |
| WeepingAngel | 69% → 68% | -0.7 | Unicorn 53% | Dragon 93% | over 85% (Dragon) |
| Dragon | 28% → 28% | +0.4 | WeepingAngel 7% | Jinn 38% | below band; under 20% (WeepingAngel) |

## Level 3

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 50% → 50% | +0.3 | WeepingAngel 33% | Minotaur 60% | in band |
| Gladiator | 47% → 47% | +0.3 | WeepingAngel 28% | Minotaur 62% | in band |
| Minotaur | 43% → 42% | -1.1 | WeepingAngel 34% | Dragon 49% | in band |
| Jinn | 48% → 48% | -0.0 | WeepingAngel 31% | Dragon 59% | in band |
| WeepingAngel | 66% → 67% | +0.9 | Unicorn 64% | Gladiator 72% | in band |
| Unicorn | 51% → 50% | -0.5 | WeepingAngel 36% | Gladiator 56% | in band |
| Dragon | 45% → 46% | +0.2 | WeepingAngel 34% | Unicorn 51% | in band |

## Level 5

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 53% → 53% | -0.6 | WeepingAngel 42% | Gladiator 61% | in band |
| Gladiator | 39% → 40% | +0.9 | WeepingAngel 32% | Minotaur 52% | in band |
| Jinn | 58% → 58% | -0.1 | Basilisk 51% | Minotaur 60% | in band |
| Minotaur | 38% → 39% | +0.2 | WeepingAngel 24% | Gladiator 48% | in band |
| WeepingAngel | 60% → 61% | +0.8 | Jinn 41% | Minotaur 76% | in band |
| Unicorn | 49% → 49% | +0.1 | WeepingAngel 34% | Gladiator 67% | in band |
| Dragon | 52% → 51% | -1.3 | Jinn 40% | Unicorn 62% | in band |

## Level 7

| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |
|---|---|---|---|---|---|
| Basilisk | 38% → 38% | +0.3 | Jinn 21% | Gladiator 47% | in band |
| Minotaur | 46% → 45% | -0.7 | Unicorn 32% | Basilisk 54% | in band |
| Gladiator | 49% → 49% | +0.2 | Minotaur 46% | Basilisk 53% | in band |
| Jinn | 67% → 68% | +0.5 | Gladiator 49% | WeepingAngel 80% | in band |
| WeepingAngel | 52% → 51% | -0.4 | Jinn 20% | Dragon 62% | in band |
| Unicorn | 58% → 58% | -0.2 | Jinn 24% | Dragon 97% | over 85% (Dragon) |
| Dragon | 42% → 42% | +0.2 | Unicorn 3% | Basilisk 65% | under 20% (Unicorn) |

## Excitement and hope

| Measure | Before | After | Change | Guardrail |
|---|---|---|---|---|
| rounds per fight | 1.688 | 1.690 | 0% | ok |
| Curse of Loki per fight | 0.829 | 0.829 | 0% | ok |
| strokes of luck per fight | 0.839 | 0.841 | 0% | ok |
| turnarounds from 25 behind (share of decisive fights) | 0.236 | 0.235 | -1% | ok |
| turnarounds from 50 behind (share of decisive fights) | 0.019 | 0.019 | 1% | ok |
