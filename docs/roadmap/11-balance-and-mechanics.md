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
- [ ] **Realistic harness rings, what is left — owner: Engine.** Pass B
  ([31](../archive/roadmap/31-pass-b-rings-and-bosses.md)) added human contestants with player decks, real
  bosses, `sim:bosses`, and `sim:rings` (per-class curves, and sampled rings of mixed sizes,
  levels, teams, and bosses). Pass C ([32](../archive/roadmap/32-pass-c-mega-boss-and-balance.md)) added
  hand-written likely decks (`deckStyle: 'likely'`, `sim:rings --likely`) and ring events
  (`ringEvents`, `sim:rings --events`). Still to do:
  - **Likely decks from telemetry.** The likely decks are guesses; seed them from
    equipped-deck telemetry once it exists.
  - **Telemetry-weighted sampling.** `sim:rings`' ring sizes and levels are guesses (mostly
    two or three monsters, levels 0-6); replace them with the real distribution.
- [ ] **Class curves from `sim:rings` (September 2026) — owner: Engine.** With player decks,
  each monster against a random other at the same level (share of decisive fights):
  the Weeping Angel climbs 37% → 67% from level 1 to 20 (the caster curve the target asks
  for) and the Barbarians start strong and fade, but the **Unicorn is strong at every level**
  (56–71%) and the **Gladiator is weak early** (40% at level 1). Pass C
  ([32](../archive/roadmap/32-pass-c-mega-boss-and-balance.md#task-3-findings)) re-measured with likely decks and
  both findings reversed (Gladiator 52–70% early, Unicorn 17–38% at levels 5–10), so neither
  is a card problem the harness can see; no change. What held under both deck models is
  the Blast item below.
- [ ] **Principled balance methodology — owner: Engine (next pass, owner 2026-09-28).** No
  card changes until this data exists. Cards fall into classes of action (strike, area
  strike, heal, boost, curse, control, confusion, delayed damage); measure an idealized
  version of each class, how it scales with level, and how hand order changes outcomes, in
  small idealized hands first, then real cards and full hands. Express a card's value in a
  common unit so each monster's holdable cards can be totalled, to find classes that are
  short of good cards and cards that are far above the rest. Draw on game-design and
  probability practice (card evaluation in Magic: The Gathering, damage-per-round and
  action economy in D&D, expected value and variance as casinos use them). Write the
  harnesses and their use up as long-lived reference. Owner's balance band: every monster
  wins 35-75% at every level with informed hands on both sides (ancient dragons up to 80);
  brutes stronger early, casters late; a good build and card order should pay off a lot,
  but the monster type alone must not decide nearly every fight. Keep the excitement: a fix
  for Sandstorm should read like a roll (for example, a d20 per opponent to catch them in
  the storm, with natural 20s), not a flat halving. Starting evidence (informed-hand curves,
  why the Jinn wins duels, stat-card values) is in
  [33](../archive/roadmap/33-heal-and-stat-cards.md). The plan is
  [34 — Balance methodology](34-balance-methodology.md).
- [ ] **Economy telemetry — owner: Analytics.** Measure coins earned, spent, and held per
  active player-room; first-purchase time; outcome mix; and unaffordable expired stock.
  The harness has the new-player scenario; a purchase-sink scenario is still open.
- [ ] **Progression review — owner: Engine/economy.** Reassess early XP, coin, and drop
  boosts from telemetry; prefer targeted onboarding adjustments over permanent payout
  inflation.
- [ ] **Healing prices — owner: Economy.** Keep the 60–90 coin shop price for a 50-coin
  healing item until use telemetry exists. Do not cut that price without the telemetry:
  cheaper healing makes bounded mid-fight items routine.

## Next balance pass (carried from roadmap 35)

**In progress in [36](36-pins-and-dragon-resistance.md)** (2026-09-29), which owns them until it closes. The owner deferred these from [roadmap 35](../archive/roadmap/35-balance-fixes.md) on 2026-09-29. Use 35's
method: variants behind class settings, the card swapped into searched hands, duels, crowds,
**and team battles** (`SideSpec.team` in the batch runner), plus the per-fight split for any
all-or-nothing effect. The [Helm of Awe and Dissonant Voice study](../archive/studies/2026-09-helm-of-awe-and-dissonant-voice.md)
and the [Gloaming Rest study](../archive/studies/2026-09-gloaming-rest.md) are the worked
examples. Keep the natural 1 and natural 20 rule: advantage and disadvantage are fine,
widened Loki or luck ranges are not.

- [ ] **Pinned monsters are easier to hit — owner idea — do first.** A pinned monster gets a
  status that gives every attack against it advantage, like D&D's restrained condition.
  Pinned means Coil, Constrict, Immobilize, Entrance, Enthrall, Mesmerize, Horn Gore's hold,
  the Forked Stick and Rod, and Helm of Awe's awe. Dissonant Voice's rattle is not a pin,
  because the monster still acts. Build one shared "is pinned" check (the ward's
  `isOpponentHold` is half of it) and reuse Dissonant Voice's roll-twice code for the
  advantage. It changes every hold at once, so measure it as a whole-field before/after on
  the same seeds, probably on the owner's machine. Expected to be modest, since roll changes
  move little here. It comes first because it changes what Mesmerize and Enthrall are worth.
- [ ] **Mesmerize and Enthrall (Weeping Angel) — optional.** About 0.2 of a useful card in
  every context in 35's catalogue. Two things waste them: Mesmerize holds everyone, *including
  its own caster* ("Your beauty mesmerizes everyone, including yourself"), and the creature-type
  rules make them useless against the Jinn and weak against the Minotaur and Weeping Angel. The
  owner thinks they are probably fine, since the Angel has many good cards, but simple fixes are
  welcome. Candidate first fix: Mesmerize stops catching its caster, or catches it only on a
  natural 1, which keeps the joke as a rare Loki moment. Acceptance: each at least 0.8 in its
  best context, and the Weeping Angel's field average does not rise (the confirmation run in 35
  decides whether the Angel needs a trim instead).
- [ ] **Harden — leave unless trivial.** 0.4 in the catalogue. The owner: "fine if a bit weak".
  Change it only if a one-line fix reaches the target without new rules.
- [ ] **The level 7 Dragon folds to the Unicorn's Blasts (3%).** Pre-existing (2% in PR C's run).
  A diagnosis on the searched hands ([PR D's confirmation](../reference/balance-reports/2026-09-29-confirm-35d.md#open-items-this-run-surfaced))
  found the Unicorn's four Blasts are the cause:
  - even a Dragon holding nine Hits wins only 8%;
  - replacing the Unicorn's Blasts with Hits lifts the Dragon to 26%;
  - other Blast users, such as the Weeping Angel, beat the Dragon only 62–67%.
  Find what in the Dragon's level 7 body or hand makes Blast so decisive against it (HP, youth
  AC gone at 7, the three Take Wings) before changing anything. It breaks the owner's 85% cap.
- [ ] **Watch the level 1 Dragon with Faceswap.** With every new card owned, the Dragon beats the
  Unicorn 84% and the Basilisk 80% at level 1. That is under the cap but outside 20–80%. Faceswap
  is rare and not for sale, so it is a ceiling. Recheck when real collections include it
  (production data) before trimming.
- [x] **Harness: a per-fight split for card effects** (done in 36: unit `probes` and `sim-split-report`). The split that exposed Gloaming Rest's
  full heal was a one-off probe (`simulate({ fights: 1, seed })` in a loop with the card's
  method wrapped). A runner option that tags each fight with "effect X happened" would make
  the check routine for all-or-nothing cards. See the
  [simulation harness](../reference/simulation-harness.md#averages-hide-all-or-nothing-cards).
- [ ] **A strong group-fight card, if wanted.** In 35's 2v2 and 3v3 runs, every support-card
  variation sat within about ±2 points: line-up decides team fights. Dissonant Voice ships as
  "at par in groups, modest alone". A card that is truly powerful in team battles would need a
  different kind of effect (turns denied or damage landed across the team), not a bigger roll
  change.

## Combat design

The balance target (a power curve per class across levels, not 50/50 everywhere) is a
current rule in [cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).
Judge each item below against it.

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
  - Before changing Blast, measure by level (`sim:levelscaling`, `sim:monster`) and in
    three- and four-monster rings (`SimMonsterSpec.team` or a free-for-all). Check whether
    the Cleric curve runs the right way: modest early, strong late.
  - **Measured in Pass C** ([32](../archive/roadmap/32-pass-c-mega-boss-and-balance.md#task-3-findings)): at
    level 15 Blast deals 18.9 a hit and Sandstorm 16 (both `damage + 1 × level`), against
    11.7 for a Hit, so with likely decks the Weeping Angel (two Blasts) wins 95–99% and the
    Jinn 82–96% at levels 15–20. Random decks, which rarely hold two, show the Angel at 67%.
    The owner chose half scaling past level 10 (`scaledCasterLevel`): the Angel fell to 84%
    at level 15 and 94% at 20. The **Jinn did not move** (96% and 85%): its late strength is
    Sandstorm's confusion, which makes opponents attack the wrong target, not its damage.
    Open: whether the confusion needs a limit late (an owner decision).
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
