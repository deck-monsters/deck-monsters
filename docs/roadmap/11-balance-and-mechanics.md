---
type: Roadmap
title: Balance and Mechanics Improvements
description: Open combat, progression, and telemetry work that still needs evidence.
status: draft
audience: internal
tags: [balance, mechanics, roadmap]
---
# Balance and Mechanics Improvements

**Status:** Active backlog. Use evidence from the simulation harness and live telemetry
before changing combat or economy values.

The September progression and economy analysis shipped. Its tuning knobs live in
`packages/engine/src/constants/progression.ts` and `constants/coins.ts`; the before/after
numbers they were tuned against are archived in
[September 2026 progression and economy analysis](../archive/roadmap/11-progression-and-economy-2026-09.md).
Reward delivery is in [analytics and history](../architecture/analytics-and-history.md),
and fixed defects are in [`10b-bugs-fixed.md`](10b-bugs-fixed.md).

## Measurement first

- [x] **Simulation harness — owner: Engine.** Seeded fight simulations exist in
  `packages/harness`. Pass 25 added steady-state coin and XP distributions by outcome and a
  1/5/20-fight new-player scenario (`sim:economy`). See the
  [simulation harness](../reference/simulation-harness.md). `SimMonsterSpec.team` now runs
  team fights under last-team victory; a boss scenario for the Team XP item below is still
  missing.
- [ ] **Economy telemetry — owner: Analytics.** Measure coins earned, spent, and held per
  active player-room; first-purchase time; outcome mix; and unaffordable expired stock.
  The harness has the new-player scenario; a purchase-sink scenario is still open.
- [ ] **Progression review — owner: Engine/economy.** Reassess early XP, coin, and drop
  boosts from telemetry; prefer targeted onboarding adjustments over permanent payout
  inflation.
- [ ] **Healing prices — owner: Economy.** Keep the 60–90 coin shop price for a 50-coin
  healing item until use telemetry exists. Do not cut that price without the telemetry:
  cheaper healing makes bounded mid-fight items routine.

## Combat design

- [ ] **Stat reform — owner: Engine.** Design variance, modifier thresholds, level growth,
  and encounter modifiers as one model; choose a safe migration or reroll path for existing
  characters before implementation.
- [x] **Temporary-stat consistency — owner: Engine.** Addressed in #175. Temporary DEX, STR,
  and INT deltas change the raw stat and the rolls derived from it exactly once. This note
  does not close the stat-reform proposal above.
- [ ] **Initiative — owner: Ring.** Evaluate replacing entry-order play with a per-encounter
  initiative roll and a SPEED modifier, including tie behavior and narration.
- [ ] **Crit failures — owner: Cards.** Audit cards for natural-1 outcomes and add
  thematically appropriate consequences, including the time-shift failure case.
- [ ] **Crit ticks — owner: Engine.** Track each monster's natural 20s (upstream #164).
  On level-up, show those crit ticks and roll d100 per tick; a 100 grants one bonus
  stat point of the player's choice.
- [ ] **Card balance — owner: Cards.** Audit power by level tier; define intentional
  counterparts, saving throws, or class weaknesses where a card lacks counterplay.
- [ ] **Blast makes Clerics dominate — owner: Cards.** Blast is Cleric-only, `ABUNDANT`,
  never misses, and hits every opponent for 3 + caster level. Seeded harness runs on `main`
  (100–200 fights) show the Weeping Angel winning 94–98.5% against the Basilisk, Gladiator,
  and Minotaur at levels 1 and 5, and the Unicorn (also a Cleric) doing the same; Blast is
  the top damage card in those fights from level 10 up. Decide between a to-hit roll or save,
  a lower rarity, or less level scaling, then rerun `sim:winrates` and `sim:unicorn`. See
  [the Unicorn pass evidence](23-unicorn-pack.md#balance-evidence-slice-6).
- [ ] **Team XP — owner: Engine.** Simulate multi-player-versus-boss outcomes and revise the
  XP formula only if the data shows the current cross-team calculation is mis-scaled.
- [ ] **Fight threads — owner: Events/connectors.** Render each fight's narration under an
  optional `threadId` on `GameEvent` (upstream #83): a short summary in the main channel,
  full narration in a Discord thread or a collapsible web section. Connectors that ignore
  the field keep today's inline feed.

Read [engine concurrency and timing](../architecture/engine-concurrency-and-timing.md) for
fight execution changes, [boss encounters](../architecture/boss-encounters.md) for teams,
and [analytics and history](../architecture/analytics-and-history.md) for reward
projections.
