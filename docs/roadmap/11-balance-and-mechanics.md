# Balance and Mechanics Improvements

**Status:** Active backlog. Use evidence from the simulation harness and live telemetry
before changing combat or economy values.

The September progression and economy analysis shipped. Its current behavior and fixed
defects are recorded in [analytics and history](../architecture/analytics-and-history.md)
and [`10b-bugs-fixed.md`](10b-bugs-fixed.md), not repeated here.

## Measurement first

- [ ] **Simulation harness — owner: Engine.** Build repeatable, seeded fight simulations
  that expose outcome, turn count, card use, XP, and coin distributions. Make it the gate
  for mechanics proposals below.
- [ ] **Economy telemetry — owner: Analytics.** Measure coins earned, spent, and held per
  active player-room; first-purchase time; outcome mix; and unaffordable expired stock.
  Include new-player 1/5/20-fight and purchase-sink scenarios in the harness.
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
- [ ] **Initiative — owner: Ring.** Evaluate replacing entry-order play with a per-encounter
  initiative roll and a SPEED modifier, including tie behavior and narration.
- [ ] **Crit failures — owner: Cards.** Audit cards for natural-1 outcomes and add
  thematically appropriate consequences, including the time-shift failure case.
- [ ] **Crit ticks — owner: Engine.** Track each monster's natural 20s (upstream #164).
  On level-up, show those crit ticks and roll d100 per tick; a 100 grants one bonus
  stat point of the player's choice.
- [ ] **Card balance — owner: Cards.** Audit power by level tier; define intentional
  counterparts, saving throws, or class weaknesses where a card lacks counterplay.
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
