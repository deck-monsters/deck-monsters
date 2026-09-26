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
- [ ] **Realistic harness rings — owner: Engine.** The owner's view (September 2026): balance
  is "not terrible", and the harness is close to useful but still unrealistic. It now uses
  shuffled draws (#183) and keeps Flee out of random decks, because Flee is a
  special-purpose card and in a simulation it only turns fights into draws. Still to do, in
  rough order of value:
  - **Likely decks, not uniform draws.** Real decks are built, not drawn. Weight harness
    decks toward what players actually equip: seed them from equipped-deck telemetry when it
    exists, and until then from a few hand-written archetypes per class (for example, a
    Cleric healer and a Cleric Blast deck). Keep a uniform-draw mode as the control.
  - **Mixed ring sizes.** Real rings hold 2–6 monsters. Sample the count per fight rather than
    running only 1v1, because AOE cards (Blast, Sandstorm, Mesmerize) and retaliation cards
    (Delayed Hit) change value sharply with the number of opponents.
  - **Mixed team composition.** Sample free-for-all, one team against solos, and two teams,
    including uneven teams. `SimMonsterSpec.team` supports this; nothing samples it yet.
  - **Mixed levels in one ring.** Players of different levels share rooms. Sample level
    spreads within a ring, not only mirrored levels, to see whether a low-level monster can
    still contribute.
  - **Bosses and ring events.** The harness turns ring events off. Add runs that keep them on,
    so Gauntlet, Blood Feud, Common Cause, and The Reckoning are measured the way players
    meet them.
  - **Report per class curve.** Summarize results as a win-rate curve per class across levels
    (see the balance target below) rather than a single pairwise matrix.
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

**Balance target (owner decision).** Do not aim for 50/50 at every level. As in D&D, each
class should have a power curve across levels: casters (Cleric, Bard) start fragile and grow
very strong as they level; brutes (Barbarian, Fighter) are strongest early and stay useful
but fall behind later. Judge a matchup against that curve, not against a flat band. The
35–65% flag in `sim:winrates` and `sim:unicorn` marks rows to look at, not a pass/fail gate,
and matchup outcomes depend heavily on the ring (see the Blast notes below).
A problem is a class that is dominant across the whole level range, or one whose curve runs
the wrong way.

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
- [ ] **Blast and Cleric power — notes, no decision yet — owner: Cards.** An earlier report
  that Clerics win ~95% with Blast came from a harness bug (fixed-bug #183), not from the
  game. With realistic draws the level 5 matrix is 39–65.5% for every pair, and a spot check
  (200 fights) had the Weeping Angel at 30% against a Basilisk and 43% against a Minotaur at
  level 1. That fits the caster curve above and the owner's experience at levels 0–1.
  Nothing needs changing now. Things to weigh if Blast is revisited:
  - Blast's value depends on the ring. 1v1 it is 3 + level to one target. With four
    opponents it deals four times that, but it also draws their attention: several Delayed
    Hits that land on the caster can each hit harder than 3. Sandstorm (redirected
    targets), Blink, invisibility, and braced AC change the trade again. Balance behaves
    more like poker or chess than a damage table.
  - The harness underrepresents that context. It runs mostly 1v1; cards play in deck order
    with no player choices; boss decks drop Hit, Heal, Flee, Harden, and Whiskey Shot; and
    targeting follows each monster's strategy scroll. Treat `sim:*` numbers as a smoke
    alarm for outliers, not a verdict on a card.
  - Before changing Blast, measure by level (`sim:levelscaling`, `sim:unicorn`) and in
    three- and four-monster rings (`SimMonsterSpec.team` or a free-for-all). Check whether
    the Cleric curve runs the right way: modest early, strong late.
  - If it does need a change, the choices are a to-hit roll or save, a lower rarity, or less
    level scaling. The first two soften it everywhere. The last one flattens the late-game
    caster payoff the balance target wants to keep.
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
