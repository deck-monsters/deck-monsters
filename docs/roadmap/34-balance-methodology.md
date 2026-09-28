---
type: Roadmap
title: Balance Methodology — Measure Before Tuning
description: Plan for a principled, long-lived balance methodology and harness suite (idealized action classes, a common card-value unit, hand order, class inventories, skilled-hand search, win-rate matrices) before any further card changes.
status: draft
audience: internal
tags: [roadmap, balance, harness, methodology]
---
# 34 — Balance Methodology: Measure Before Tuning

**Status:** Planned (2026-09-28). Owner's direction, given while PR #407 was open; picked up
after #407 merges, on its own branch and PR. Follows
[33](../archive/roadmap/33-heal-and-stat-cards.md), whose evidence is the starting point.

## The owner's direction

> Take a principled approach. Cards have different names and stats, but they fall into
> classes of action. Test the value of an idealized version of each class, how it scales,
> and how hand order affects the outcome, in an idealized world with short hands. Use that
> to decide what to test with real cards, classes, and full hands. Count up the value of the
> cards each class can carry, to find a class that is short or a card that is far above the
> rest. Do not change cards until the data is in hand: build the testing theory, the
> methodology, and the harnesses, and write up how to use them so they last. Look at what
> Magic: The Gathering, D&D, other games, and casinos do. Do not neuter the excitement.

**Rule for this pass: no card, monster, or balance constant changes.** The deliverables are
measurement tools, a reference doc, and a findings report with ranked candidate changes for
the owner to choose from. Changes come in a later pass, one decision at a time.

## Balance targets (owner, with proposed refinements)

| Target | Source |
|---|---|
| Every monster wins 35-75% of decisive fights at every level, informed hands on both sides; ancient dragons up to 80% | Owner |
| Brutes (Barbarian, Fighter) stronger early; casters (Cleric, Wizard) stronger late | Owner |
| A good build and card order should pay off a lot; the monster type alone must not decide nearly every fight | Owner |
| Keep the excitement: swings, big moments, natural 20s. A fix should read like a roll, not a flat nerf | Owner |
| *Proposed:* a cell is out of band only when two independent seed sets both put its 95% interval outside the band | Noise rule |
| *Proposed:* curve shape. Brutes 55-70% at levels 1-5 and 40-55% at 15-20; casters the mirror; the Bard in between, crossing near levels 8-12 | Shape rule |
| *Proposed:* crowded rings. In sampled mixed rings each monster's win share stays within 0.7-1.4× its fair share | Crowd rule |
| *Proposed:* level gaps matter. The same monster two levels up wins 65-75% | Progression rule |
| *Proposed:* card rate. No card is worth more than 1.5× the median of its action class at the same level (in the value unit below) | Card rule |
| *Proposed:* excitement floor. A change may not cut a card's volatility (spread of outcomes per play) by more than a third unless the owner agrees | Excitement rule |

The proposed rows need the owner's yes before they gate anything.

## What other fields already know

- **Magic: The Gathering: the vanilla test and "rate".** A card is judged against a
  reference card with no abilities: one point of power and toughness per mana is "on rate",
  and a card's abilities are what it is worth beyond or below that line
  ([Star City Games](https://articles.starcitygames.com/articles/how-to-evaluate-magic-cards/),
  [The Vanilla Test](https://blackdeckwins.tumblr.com/post/129568175299/the-vanilla-test)).
  Here the reference is the plain **Hit** at the same level, so every card has a rate in
  Hit-equivalents (below). Magic also separates *rate* from *synergy* and treats the mana
  curve as a property of the deck, not the card; the equivalents here are hand order and
  hand composition.
- **D&D: damage per round and action economy.** DPR is hit chance × damage, averaged over
  the whole attack roll, and consistency beats peak damage over a fight
  ([RPGBOT](https://rpgbot.net/dnd5/characters/damage-per-round/)). Action economy (more
  turns win) breaks challenge ratings: four small monsters are not one big one
  ([Tabletop Joab](https://tabletopjoab.com/action-economy-in-dd-5e-explained/),
  [DMDave](https://dmdave.com/encounter-building-math/)). Here that is Sandstorm and Blast
  in crowded rings, control cards that take a turn away, and the mega boss's minions.
- **Casinos: return, hit frequency, volatility.** A slot is specified by three separate
  numbers: return to player (expected value), hit frequency (how often anything pays), and
  volatility (how spread out payouts are), and a game is simulated until each is stable
  ([slot math](https://www.gammastack.com/blog/the-basic-mathematics-of-slot-game-machines/),
  [volatility](https://twinwingames.com/what-does-volatility-mean-in-slots/)). The same
  three numbers describe a card play: expected damage (or value), how often it does
  anything, and how swingy it is. Volatility is the excitement the owner wants kept.
- **Competitive balance research: win-rate matrices and metagames.** Balance is read from a
  head-to-head win-rate matrix treated as a zero-sum payoff matrix, not from one average
  ([metagame autobalancing](https://arxiv.org/pdf/2006.04419),
  [balancing zero-sum games](https://www.cs.cornell.edu/~ajul/zerosum/zerosum.pdf)).
  Elo is a summary, and it misleads when matchups are not transitive
  ([Elo under misspecification](https://arxiv.org/html/2502.10985v1)). Here: a 7×7 monster
  matrix per level, with its equilibrium mix and any matchup outside the band.

## Vocabulary

- **Action class.** What a card does, independent of its name. From the card class tree in
  `packages/engine/src/cards`:

  | Action class | Engine lineage | Examples |
  |---|---|---|
  | Strike | `HitCard` and most subclasses | Hit, Hit Harder, Lucky Strike, Wooden Spear, Pound |
  | Multi-strike / reroll | `Rehit`, `Berserk`, `Battle Focus` | Rehit, Berserk, Battle Focus |
  | Delayed strike | `DelayedHit` | Delayed Hit |
  | Area strike | `BlastCard` and subclasses, `FireBreathCard`, `TsunamiCard` | Blast, Sandstorm, Fire Breath, Tsunami |
  | Heal | `HealCard` and subclasses | Heal, Whiskey Shot, Scotch, Revive |
  | Strike and heal | `SurvivalKnifeCard` | Survival Knife, Turkey Thigh, Iocane |
  | Self boost | `BoostCard`, `EcdysisCard` | Harden, Calisthenics, Adrenaline Rush, Thick Skin |
  | Curse strike | `CurseCard` | Soften, Molasses, Concussion, Brain Drain |
  | Control (lose a turn) | `ImmobilizeCard` | Coil, Horn Gore, Forked Stick, Sticketh, Mesmerize |
  | Confusion / redirect | Sandstorm's effect, `EnchantedFaceswapCard` | Sandstorm, Enchanted Faceswap |
  | Evasion / hide | `CloakOfInvisibilityCard`, `FleeCard` | Cloak, Mood Scales, Flee |
  | Economy / other | `PickPocketCard`, `DestroyCard`, `RandomCard`, `BadBatchCard` | Pick Pocket, Destroy, Random Card, Bad Batch |

- **Hit-equivalent (HE), the value unit.** The number of plain Hits (same level, same
  monster) a card is worth in a hand. It is measured by substitution against a calibration
  ladder, below. A Hit is 1.0 HE by definition; a card that does nothing is 0.
- **Rate.** A card's HE at a level. **Class median**: the median rate of cards in one
  action class at that level.
- **Per-play profile.** The casino triple for one play: expected value (HE or expected
  damage), hit frequency (share of plays that change anything), and volatility (standard
  deviation of damage, or of HE across plays).
- **Order sensitivity.** How much a hand's win rate changes across orderings of the same
  cards.
- **Class inventory.** The HE of the best *k* cards a monster can hold at a level, where *k*
  is its card slots, and how steeply the next-best cards fall off.

## Method, in layers

Each layer answers one question and hands the next a shorter list of things to test.

### Layer 0: closed-form math (no fights)

For each level 1-20 and each action class, compute expected values from the engine's own
numbers: hit chance against the level's typical AC, damage dice plus modifiers, level
scaling (including `scaledCasterLevel`), and the ±5 temporary-change cap. Output: expected
damage per play, hit frequency, and variance, per class and level. This is D&D DPR done
properly. It is cheap, it explains the simulated results, and it catches a scaling mistake
(Blast's per-level damage) before any fight runs. Where the formula and the simulation
disagree, the difference is a mechanic nobody modelled, and it is a finding.

### Layer 1: idealized action classes (synthetic cards, real engine)

Harness-only **synthetic cards**, one parameterized class per action class
(`IdealStrike`, `IdealAreaStrike`, `IdealHeal`, `IdealBoost`, `IdealCurseStrike`,
`IdealControl`, `IdealConfuse`, `IdealDelayed`), built on the engine's own base classes so
combat, pacing, and effects are real, but with their numbers set by the experiment. They
never ship and are never registered in the card catalogue.

Experiments:

1. **Calibration ladder.** Mirror matches of hands built from Hits and a "null" card (a
   synthetic card that does nothing): 0-4 Hits in a 4-card hand. The win-share curve
   against a 4-Hit mirror maps any win share back to HE. Repeat at levels 1, 5, 10, 15, 20.
2. **Exchange rates.** For each synthetic class, sweep its parameters (damage, heal amount,
   boost size, control duration) and find the value that equals 1.0 HE at each level. That
   gives a price list: "a heal is on rate at N hp at level L".
3. **Scaling.** How each class's HE moves from level 1 to 20 with its parameters held fixed.
   This shows directly which classes grow with level and by how much, and is the evidence
   for brutes-early / casters-late.
4. **Hand order.** For 3- and 4-card hands of synthetic cards, run all orderings (6 or 24)
   and report the spread. Hypotheses to test: control before damage beats damage before
   control; a boost is worth more early in the cycle; a heal is worth more late.
5. **Crowd factor.** Area strike and confusion against 1, 2, 4, and 7 opponents. This is the
   action-economy question, and it decides whether an area card needs a duel-only rule or
   a crowd-only rule.
6. **Per-play profile.** Record the casino triple for each synthetic class, so a later
   change can be checked against the excitement rule.

### Layer 2: the real-card catalogue

Every real card's HE, per-play profile, and order sensitivity at levels 1, 5, 10, 15, 20,
in duels and in a 4-contestant crowd. Method: substitute the card for one Hit in a
4-card hand, in mirror matches for each monster that can hold it, with both seats played
(first-seat advantage cancels) and common random numbers (the same seeds with and without
the card). `sim:statcards` (PR #407) is the prototype of this for stat cards; it becomes one
filter of the catalogue.

Output: `reports/catalogue.json` and a sorted table per action class, flagging cards above
1.5× or below 0.5× their class median.

### Layer 3: class inventories

For each monster and level, sum the HE of the best *k* holdable cards (its slots), and list
the next few. A monster whose best hand is short of HE is short of good cards; a monster
whose best card is far above its second shows where a single card carries a class. Also
report how many copies of each top card a player can realistically own (rarity, drops, the
signature catch-up) and whether the per-hand copy limit changes the total.

### Layer 4: skilled hands and the win-rate matrix

"Informed" hands stop being hand-written guesses (`likely-decks.ts`) and become searched:
for each monster and level, a search over hands of holdable cards (greedy fill from the
catalogue, then hill-climbing swaps and reorderings, keeping a change only when its win
share against the field improves beyond its confidence interval). The result is the best
hand found, its order, and its win share. Then a 7×7 matrix per level of best hand against
best hand, with 95% intervals, the equilibrium mix of monsters, and every matchup outside
the band. This is the measurement the owner's band is judged on.

### Layer 5: real rings

Sampled rings (sizes, levels, teams, bosses, ring events, the mega boss), as `sim:rings`
does today, with searched hands instead of likely decks. This checks the crowd rule and
that Layer 4's duel conclusions hold where most fights actually happen.

## Statistics and experimental design

- **Sample size.** A win share's 95% interval (Wilson) is about ±5 points at 385 decisive
  fights and ±3 at 1,067. Current cells use 120 (±9). Layer 4 and anything that gates a
  decision use at least 400 per cell, or sequential testing (below).
- **Common random numbers.** Compare A and B on the same seeds, so the difference is the
  cards and not the dice. The harness already seeds `Math.random` (mulberry32); report the
  paired difference and its interval, not two separate rates.
- **Both seats.** The first seat wins about 55-65% of Hit mirrors (measured in 33). Every
  comparison runs both seats and averages, or reports the seat effect separately.
- **Draws.** Report the draw rate; win shares are over decisive fights, and a card that
  raises draws is flagged, not hidden.
- **Sequential stopping.** A sequential probability ratio test (SPRT) stops a cell early
  once it is clearly inside or outside a band edge, and spends fights where the answer is
  close. This is the tool for Layer 4's many cells.
- **Multiple comparisons.** With hundreds of cells some fall outside by chance. A finding
  needs two independent seed sets, or a Holm-corrected interval.
- **Reproducibility.** Every report prints its seed, fight count, commit SHA, and the harness
  flags, and writes JSON beside the table, so a result can be rerun and diffed.
- **Runtime.** Measure fights per second first. Run independent cells in parallel
  (`worker_threads`, one engine per worker). Keep a quick profile for development
  (about 5 minutes) and a full profile for decisions (a scheduled or overnight run).

## Harness plan (packages/harness)

| Module or script | Layer | What it does |
|---|---|---|
| `src/balance/stats.ts` | all | Wilson interval, paired difference, SPRT, Holm correction; unit-tested against known values |
| `src/balance/seats.ts` | all | Run a matchup in both seats with common random numbers; return the paired result |
| `src/balance/profile.ts` | 1, 2 | Per-play capture: expected value, hit frequency, volatility, from engine events |
| `src/balance/synthetic-cards.ts` | 1 | The `Ideal*` cards, harness-only, on engine base classes |
| `src/balance/ladder.ts` | 1, 2 | Calibration ladder and win share → HE conversion |
| `scripts/sim-formula.ts` | 0 | Closed-form tables; no fights |
| `scripts/sim-archetypes.ts` | 1 | Exchange rates, scaling, crowd factor, per-play profiles |
| `scripts/sim-order.ts` | 1, 2 | All orderings of a hand; order-sensitivity report |
| `scripts/sim-catalogue.ts` | 2 | Every real card's HE and profile; supersedes `sim:statcards` and `sim:cardpower` as the source of truth |
| `scripts/sim-inventory.ts` | 3 | Per-monster best-*k* HE and the fall-off |
| `scripts/sim-search.ts` | 4 | Skilled-hand search per monster and level |
| `scripts/sim-matrix.ts` | 4 | 7×7 matrix per level, intervals, equilibrium, band check |
| `reports/` (gitignored) and `docs/reference/balance-reports/` (checked-in summaries) | all | JSON for machines, a short Markdown summary per decision |

Existing scripts stay (`sim:rings`, `sim:mega`, `sim:bosses`, `sim:statcards`) and gain the
shared stats and seat helpers where it helps.

## Documentation deliverables

- `docs/reference/balance-methodology.md` (new, long-lived): the vocabulary, the layers,
  the statistics, which script answers which question, how long each takes, and how to
  read the output. Linked from `AGENTS.md`'s table and `docs/README.md`.
- `docs/reference/simulation-harness.md`: the new scripts, flags, and `SimResult` fields.
- `docs/architecture/cards-and-encounter-effects.md`: the balance rules, restated in HE
  once the targets are agreed.
- A findings report (in this plan, then folded into roadmap 11): ranked candidate changes,
  each with its evidence, expected effect on the band, and its excitement cost.

## Tasks

Each task is one commit and push (or a few), with the plan's table updated in the same
commit. Reviews scale to risk: the statistics module gets tests with known answers; the
synthetic cards get a review that they cannot leak into the game.

| # | Task | Output | Status | Commit |
|---|---|---|---|---|
| 1 | Statistics and seats: `stats.ts`, `seats.ts`, tests; measure fights per second and add worker parallelism | Helpers every later script uses; a runtime budget | Planned | |
| 2 | Layer 0: `sim:formula` from engine constants | Expected damage, hit chance, and variance per class and level | Planned | |
| 3 | Synthetic cards and the calibration ladder | HE defined and measured at five levels | Planned | |
| 4 | Layer 1 experiments: exchange rates, scaling, crowd factor, per-play profiles | The idealized price list | Planned | |
| 5 | Hand order: `sim:order` on synthetic, then real hands | Order-sensitivity findings | Planned | |
| 6 | Layer 2: `sim:catalogue` over every real card | Rates per class, outliers flagged | Planned | |
| 7 | Layer 3: `sim:inventory` | Class inventories, shortfalls, and single-card dependencies | Planned | |
| 8 | Layer 4: `sim:search` and `sim:matrix` | Skilled hands and the band check per level | Planned | |
| 9 | Layer 5: `sim:rings` on searched hands | Crowd and ring-event check | Planned | |
| 10 | Reference doc and findings report; ranked candidate changes for the owner | `balance-methodology.md`; decisions for the next pass | Planned | |

Tasks 1-3 are prerequisites. Tasks 4-7 can run in parallel once 3 lands (they touch
different scripts). Task 8 needs 6. Keep the PR to five or six tasks and split the rest into
a second PR if needed (budget rule in `AGENTS.md`).

## Starting evidence (from 33)

Informed-hand curves are in [33](../archive/roadmap/33-heal-and-stat-cards.md): the Weeping
Angel and Jinn run 80-93%, the Dragon 4-9% early, the Basilisk 19-34% late, and the Unicorn
17% at level 5. Random hands are nearly inside the band. The Jinn's duel strength is
Sandstorm's target redraw (about 77% of a confused monster's next attacks hit itself in a
duel).

Copies in an informed hand, against informed hands of every other monster (60 fights per
opponent, 2026-09-28):

| Hand | L5 | L15 | L20 |
|---|---:|---:|---:|
| Jinn, Sandstorm ×1 | 77% | 78% | 81% |
| Jinn, Sandstorm ×2 | 85% | 86% | 84% |
| Jinn, Sandstorm ×4 | 94% | 97% | 99% |
| Weeping Angel, Blast ×1 | 47% | 43% | 42% |
| Weeping Angel, Blast ×2 | 68% | 79% | 82% |
| Weeping Angel, Blast ×4 | 63% | 87% | 91% |
| Dragon, Fire Breath ×1 | 10% | 63% | 73% |
| Dragon, Fire Breath ×2 | 18% | 70% | 79% |
| Dragon, Fire Breath ×4 | 16% | 98% | 99% |

Readings to confirm in this pass, not to act on yet: extra copies of area spells push the
late game past the band (Sandstorm from one copy, Fire Breath and Blast at four), so a
per-hand limit for area strikes is a live candidate; the Dragon's early problem is its hand,
not Fire Breath; Blast carries the Angel only in multiples.

## Candidate changes to evaluate later (not in this pass)

Each is measured against the targets and the excitement rule before the owner chooses.

- **Sandstorm as a roll.** The owner's idea: the Jinn rolls a d20 for each opponent and
  catches them in the storm on, say, 7 or more; a natural 20 does something extra, and INT
  or level could modify the roll. Also measure a softer redraw (the confused monster keeps
  its intended target more often, and turns on itself less) to compare excitement and rate.
- **Per-hand copy limits** for area strikes (for example two of each), if Layer 2-4 confirm.
- **Level scaling** of area strikes past level 10, re-measured after the ±5 cap.
- **Class inventories.** Where a monster's best hand is short of HE, a new card or a
  cheaper rarity for an existing one, rather than nerfs elsewhere.
- **Hand guidance.** If the Dragon's problem is that its signature cards deal no damage,
  better defaults or handbook builds may fix it without touching a card.

## Open questions for the owner

1. Adopt the proposed targets (noise, shape, crowd, progression, card rate, excitement)?
2. What counts as a "skilled" hand for the band: the best hand the search finds, or a
   blend of the best and a typical hand?
3. Should bosses and the mega boss be judged with the same catalogue (they hold boss
   decks), or kept out of the band entirely?
4. Is a nightly or weekly full run worth scheduling, with a diff posted when balance moves?
