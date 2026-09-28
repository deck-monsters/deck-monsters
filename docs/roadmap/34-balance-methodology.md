---
type: Roadmap
title: Balance Methodology — Measure Before Tuning
description: Plan for a principled, long-lived balance methodology and harness suite (engine facts, a reference chassis, idealized action classes, a card-value unit, collections, skilled-hand search, win-rate matrices, excitement metrics) before any further card changes.
status: draft
audience: internal
tags: [roadmap, balance, harness, methodology]
---
# 34 — Balance Methodology: Measure Before Tuning

**Status:** In progress (2026-09-28): PR A on branch `claude/balance-methodology-a`,
after PR #407 merged. Follows [33](../archive/roadmap/33-heal-and-stat-cards.md), whose evidence is the
starting point. Revised the same day after a deeper review of the engine and the owner's
answers below.

## The owner's direction

> Take a principled approach. Cards have different names and stats, but they fall into
> classes of action. Test the value of an idealized version of each class, how it scales,
> and how hand order affects the outcome, in an idealized world with short hands. Use that
> to decide what to test with real cards, classes, and full hands. Count up the value of the
> cards each class can carry, to find a class that is short or a card that is far above the
> rest. Do not change cards until the data is in hand: build the testing theory, the
> methodology, and the harnesses, and write up how to use them so they last. Look at what
> Magic: The Gathering, D&D, other games, and casinos do. Do not neuter the excitement.

**Rule for this pass: no card, monster, or balance-constant changes.** The deliverables are
measurement tools, a long-lived reference doc, and a findings report with ranked candidate
changes for the owner to choose from. Changes come in the next pass, one decision at a time.

## Decisions

### Owner (2026-09-28)

| Question | Decision |
|---|---|
| What the band applies to | **Field average.** Each monster's average against every other monster at its level stays in 35-75% (ancient dragons, Dragons at level 10+, up to 80%). Single matchups may range 20-80% so counters (Coil against Gladiators and Minotaurs, Horn Gore against Minotaurs) still mean something; none may exceed 85% (no auto-wins) |
| Whose hands | **Realistic collection.** The best hand and order a search finds from the cards a typical player owns by that level. The band applies there. The unconstrained best (any legal card, up to the copy limit) is reported too, with an 85% ceiling, and drives copy-limit decisions |
| How to fix | **Smallest change.** The lever that brings the most cells into the band while touching the fewest cards and keeping the excitement numbers; raise weak cards toward the Hit anchor where possible, trim only clear outliers |
| Rarity | **A modest premium, with copy limits.** Rarer cards may be somewhat stronger per play (epic up to 1.5× its action-class median, rare up to 1.25×) and per-hand copies may scale with rarity (for example epic at most 2), like Hearthstone's one-copy limit on legendaries ([Hearthstone deck rules](https://hearthstone.wiki.gg/wiki/Deck)), so a strong rare card cannot be stacked |
| Brutes and casters | Brutes (Barbarian, Fighter) stronger early; casters (Cleric, Wizard) stronger late |
| Skill | A good build and a good card order should pay off a lot; the monster type alone must not decide nearly every fight |
| Telemetry | **Read-only production queries are always allowed**, for any reason, as often as needed. This pass uses them for the level distribution of active monsters and the hands players actually equip (weights findings by where players are; gives the "typical hand" for skill expression) |
| Excitement | Keep swings, big moments, and natural 20s. A fix should read like a roll (the owner's Sandstorm idea: a d20 per opponent to catch them in the storm), not a flat nerf |

### Technical decisions (made in planning; the owner can override any)

| Question | Decision | Why |
|---|---|---|
| Primary metric | **Expected score**: win 1, draw ½, loss 0, over all fights; flee counts as a loss for the monster that fled. Draw rate reported beside it | Win share over decisive fights hides a card that turns losses into draws; draws run 8-27% with random hands at levels 1-20 today |
| Turn order | **Random per fight, as the game does**, and every comparison played in seat-swapped pairs on the same seed. The initiative edge is reported as its own number | The harness fixes turn order (`DECK_MONSTERS_DETERMINISTIC_RING`), so the first-listed monster always acts first. Every curve in 32 and 33 listed the monster under test first; in Hit mirrors that alone gave 51-65% (57-65% for the brutes) |
| Primary levels (owner, 2026-09-28) | **Levels 0-7 are the primary tuning target**; 8-20 are the long tail, watched so a change does not break them, not tuned toward | Very few players reach level 10, let alone 20: level 10 takes about 800 fights and level 15 about 9,000 (below) |
| Levels sampled | **Every level 0-7**, plus **10, 12, 15, 20** for the tail | Dense where players are; the tail at its mechanical breakpoints (DEX stops at 10, AC at 12, ancient dragons from 10, HP to 20) |
| Level weighting | Report every sampled level; **rank findings by where players actually are**, from telemetry (levels 0-7 first by default) | The band is checked at every level, but a problem at levels 0-7 outranks one at 15-20 |
| Hand size | Test hands are **9 cards**, the real slot count, on both sides. Short hands (3-4) only in Layer 1, and never against a longer hand | Each round every monster plays its whole hand, so slots are action economy: a 4-card hand acts 4 times a round against a 9-card hand's 9 |
| Scope | **Duels and crowds, not bosses, items, or ring events** for the band. Bosses keep their own targets (`sim:bosses`, the mega boss at about 20%); items are bounded and player-triggered; ring events are checked in Layer 5 only | They have their own tuning and their own targets |
| Where the band is judged | **Directly, by simulation of whole hands (Layer 4).** The card-value unit explains and ranks; it never gates a decision on its own | A summed card value can miss synergy; the full fight cannot |

## Engine facts the method depends on

Measured or read from the code on 2026-09-28 (details in 33 and the sources named).

- **Rounds play whole hands.** `Ring.fight()` plays card index 0 for every contestant in a
  fixed order, then index 1, and so on; a round ends when every contestant is out of cards,
  and hands restart. At round 10 the fight is a draw. Fights last about 2-3 rounds, so each
  card in a 9-card hand is played two or three times, and the first cards of a hand get one
  more play when a fight ends mid-round.
- **Turn order is fixed within a fight.** The game shuffles contestants as they join; the
  harness does not. The first mover's edge is large: 51-65% in Hit mirrors (57-65% for the brutes).
- **The chassis stops growing before the hand does.** HP grows by 3 per level to level 20
  (28 → 88 before variance). AC grows to level 12. The +1-per-level stat bonus stops at
  STR 6, INT 8, and DEX 10 (`MAX_BOOSTS`). A temporary DEX, STR, or INT change caps at ±5.
  So past level 10 a Hit's accuracy and damage are flat while HP keeps rising, and the only
  cards that keep pace are level-scaled ones (Blast, Sandstorm, Fire Breath). This is the
  likeliest structural cause of casters running away late, and Layer 0 should confirm it.
- **Progression is steep.** Level thresholds grow roughly like Fibonacci: level 5 needs
  380 XP, 10 needs 4,450, 15 needs 49,350, 20 needs 547,300. At 10 XP a win and 1 a loss
  (character XP; monsters earn about 10-16 a win), that is roughly 70, 800, 9,000, and
  100,000 fights at a 50% win rate.
- **Collections grow by one card a win.** The drop is a rarity-weighted draw from the cards
  the winning monster can hold (`cards/helpers/draw.ts`), with an early-level boost, plus the
  signature-card catch-up (#407). The starting deck has 20 cards, including one of each
  monster's signature card. Coins buy shop cards. There are 61 card types: 45 limited to
  certain monsters or classes, 16 open; 7 epic (5), 4 very rare (10), 12 rare (15), 18
  uncommon (25), 17 common (40), 3 abundant (65-75).
- **Throughput.** One process runs about 20-55 fights a second (slower at high level and
  with 9-card human hands); this container has 4 cores.

## What other fields already know

- **Magic: The Gathering: the vanilla test and "rate".** A card is judged against a
  reference card with no abilities; its abilities are what it is worth above or below that
  line ([Star City Games](https://articles.starcitygames.com/articles/how-to-evaluate-magic-cards/),
  [The Vanilla Test](https://blackdeckwins.tumblr.com/post/129568175299/the-vanilla-test)).
  Here the reference card is the plain **Hit**. Magic also separates a card's *rate* from its
  *synergy*, and treats the curve as a property of the deck; here, hand order and hand
  composition.
- **Hearthstone: copy limits by rarity.** Two copies of a card, one of a legendary
  ([Hearthstone deck rules](https://hearthstone.wiki.gg/wiki/Deck)). Scarcity plus a copy
  limit is what lets a rare card be stronger without being stacked.
- **D&D: damage per round and action economy.** DPR is hit chance × damage averaged over
  the whole attack roll, and consistency beats peak damage over a fight
  ([RPGBOT](https://rpgbot.net/dnd5/characters/damage-per-round/)). More turns win, which is
  why four small monsters are not one big one
  ([Tabletop Joab](https://tabletopjoab.com/action-economy-in-dd-5e-explained/),
  [DMDave](https://dmdave.com/encounter-building-math/)). Here: hand size is action economy,
  control cards take turns away, and area cards scale with the crowd.
- **Casinos: return, hit frequency, volatility.** A slot is specified by three separate
  numbers, return to player, hit frequency, and volatility, and is simulated until each is
  stable ([slot math](https://www.gammastack.com/blog/the-basic-mathematics-of-slot-game-machines/),
  [volatility](https://twinwingames.com/what-does-volatility-mean-in-slots/)). The same three
  describe a card play. Volatility is the excitement the owner wants kept.
- **Simulation practice: common random numbers.** Compare two versions on the same random
  streams so the difference is the change and not the dice; it is the most used variance
  reduction for comparing alternatives, and combining it with antithetic streams can backfire
  ([KSL, variance reduction](https://rossetti.github.io/KSLBook/ch9VRTs.html),
  [Management Science](https://pubsonline.informs.org/doi/abs/10.1287/mnsc.21.10.1176)).
- **Competitive balance research: win-rate matrices.** Balance is read from a head-to-head
  win-rate matrix treated as a zero-sum payoff matrix, not from one average
  ([metagame autobalancing](https://arxiv.org/pdf/2006.04419),
  [balancing zero-sum games](https://www.cs.cornell.edu/~ajul/zerosum/zerosum.pdf)); Elo
  misleads when matchups are not transitive
  ([Elo under misspecification](https://arxiv.org/html/2502.10985v1)).

## Vocabulary

- **Action class.** What a card does, independent of its name:

  | Action class | Engine lineage | Examples |
  |---|---|---|
  | Strike | `HitCard` and most subclasses | Hit, Hit Harder, Lucky Strike, Wooden Spear, Pound |
  | Multi-strike / reroll | `Rehit`, `BerserkCard`, `BattleFocusCard` | Rehit, Berserk, Battle Focus |
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

- **Reference chassis.** A harness-only monster with the median stats of the seven real
  monsters at each level, no creature type, and permission to hold any card (the level gate
  still applies). It separates what a card is worth from the body holding it.
- **Chassis value.** A real monster's expected score, holding a standard hand, against the
  reference chassis holding the same hand. The body's share of a monster's strength.
- **Hit-equivalent (HE).** How many plain Hits a card is worth in a hand, measured by
  substitution on a calibration ladder (Layer 1). Two scales:
  - **sHE** on the reference chassis against the reference field: comparable across every
    card and monster. Used for the catalogue, action-class medians, and inventories.
  - **HE** on a real monster that can hold the card: what the card is worth *to that
    monster*, relative to that monster's own Hit. Used for hand building. (A caster's Hit is
    weak, so its spells look larger in HE than in sHE; both are reported.)
- **Stacking curve.** A card's value with 1, 2, and 3 copies in the hand. Linear means
  copies are independent; above linear flags a stacking problem (Sandstorm), below
  linear means diminishing returns.
- **Per-play profile.** The casino triple for one play: expected value, hit frequency
  (share of plays that change anything), and volatility (spread of outcomes).
- **Order sensitivity.** Expected score of a hand's best ordering minus its average
  ordering.
- **Inventory.** The sHE of the best 9 cards a monster can hold at a level, from a given
  collection, and how steeply the next cards fall off.
- **Realistic collection.** The cards a player typically owns when their monster reaches
  level L: the starting deck, one rarity-weighted drop per win (from what the monster can
  hold), the catch-up drop, and, as a sensitivity check, shop purchases. Sampled, not
  averaged, so the spread of real collections is kept.

## Method, in layers

Each layer answers one question and hands the next a shorter list of things to test.
Every experiment uses the statistics section below.

### Layer 0: closed-form math and the chassis table (no fights)

From the engine's own constants, per level: each monster's HP, AC, and stat modifiers; hit
chance of a strike against the level's typical AC; expected damage, hit frequency, and
variance per play for each action class (including level scaling, `scaledCasterLevel`, and
the ±5 cap); and expected turns to kill. This is D&D's DPR done properly. It is cheap, it
explains the simulations, and it tests the hypothesis above (flat strikes against rising HP
past level 10). Where formula and simulation disagree, the difference is a mechanic nobody
modelled, and that is a finding.

### Layer 1: idealized action classes

Harness-only **synthetic cards**, one parameterized class for each in-fight action class:
`IdealStrike`, `IdealMultiStrike`, `IdealDelayed`, `IdealAreaStrike`, `IdealHeal`,
`IdealStrikeHeal`, `IdealBoost`, `IdealCurseStrike`, `IdealControl`, `IdealConfuse`, and
`IdealHide`. They are built on the engine's own base classes so combat, pacing, and effects
are real, with their numbers set by the experiment. They are never registered in the card
catalogue and cannot drop or be equipped in the game; a test proves it.

The twelfth class, **economy / other** (Pick Pocket, Destroy, Random Card, Bad Batch), has
no idealized model because its value is mostly outside the fight or borrowed from other
cards. Those cards are judged in Layer 2 against the Hit alone, with their out-of-fight
value (coins or cards gained, cards destroyed, per play) reported beside their in-fight
HE, and they have no class median.

1. **Calibration ladder.** On the reference chassis, 9-card hands of *k* Hits and 9−*k*
   null cards (a synthetic card that does nothing) against a 9-Hit reference opponent, *k* =
   0..9, at each sampled level. The curve maps any expected score back to HE. A null card
   still takes a slot, so the ladder measures what a play is worth with action economy
   held constant.
2. **Exchange rates.** For each synthetic class, sweep its parameters (damage, heal amount,
   boost size, turns of control) and find the value worth 1.0 HE at each level: a price list
   ("at level L, a heal is on rate at N hp").
3. **Scaling.** Each class's HE from level 1 to 20 with its parameters fixed. The direct
   evidence for brutes-early / casters-late.
4. **Hand order.** In 3- and 4-card synthetic hands (both sides the same size), every
   ordering (6 or 24). Hypotheses: control before strikes beats strikes before control; a
   boost is worth more early in the hand; a heal is worth more late. Then in 9-card hands,
   a sample of orderings. If order barely matters, that is a finding for the owner: "order
   should have a huge impact" may need design (combos, cards that read the previous play),
   not tuning.
5. **Crowd factor.** Area strike and confusion against 1, 2, 4, and 7 opponents: action
   economy measured. Decides whether an area card needs a duel rule, a crowd rule, or
   neither.
6. **Per-play profiles.** The casino triple for each synthetic class, the baseline the
   excitement rule compares against.

### Layer 2: the real-card catalogue

All 61 card types, at each sampled level, in duels and in a 4-contestant crowd:

- **sHE** on the reference chassis (every card), and **HE** on each real monster that can
  hold it.
- The **stacking curve** (1, 2, 3 copies) to measure copies directly and to amplify the
  signal: one card in nine barely moves the score, so single-copy values come from the fit
  across copies where the curve is linear, and stand on their own where it is not.
- The per-play profile and a sample of order sensitivity.
- Outliers flagged against the action-class median, allowing for the rarity premium above.

The opponent is the **reference field**: the reference chassis with a mixed standard hand
(strikes, a heal, an INT strike, a control card), not a pure Hit hand, because a Hit-only
opponent never reads INT and so undervalues INT cards (33's Concussion reading). After
Layer 4, the catalogue is rerun against the searched field, and the two passes are compared.

`sim:statcards` and `sim:cardpower` become filters of the catalogue.

### Layer 3: chassis, collections, and inventories

- **Chassis value** of each monster at each level (standard hand on each body).
- **Collection model.** Sample realistic collections at each level from the real drop code
  (starting deck, wins at a 50% rate, the catch-up rule, the early drop boost); report how
  many copies of each card a typical player holds, and at what level each card's copies
  saturate the copy limit. Hypothesis to confirm: past level 8 or so a player owns almost
  every common card in multiples, and only epics stay scarce.
- **Inventories** from the realistic collection and from an unconstrained one: the best 9
  cards' sHE per monster and level, and the fall-off after them. A monster short of sHE is
  short of good cards; one whose best card far exceeds its second depends on one card.
- **Decomposition.** Monster strength ≈ chassis value + inventory + synergy; Layer 4 checks
  how much the first two explain.

### Layer 4: skilled hands and the win-rate matrix (where the band is judged)

- **Search.** For each monster and level, the best 9-card hand and order from its realistic
  collection (and separately from the unconstrained one): seeded from the inventory, then
  hill-climbing swaps and reorderings, from several random starting hands. Objective:
  expected score against the field (every other monster's current best hand, equal weight).
  A search that tests dozens of moves on the same data will accept some that only looked
  better by chance, so:
  - The search runs on **search seeds** only. A move is accepted when its paired lower bound
    clears zero at 99%, and it is then **confirmed on a fresh batch** of seeds before the
    search builds on it.
  - The final hand and the best runners-up from every restart are rescored on **validation
    seeds** the search never saw, in fixed-size samples. The reported hand and its score come
    from those seeds only.
  - If a runner-up beats the chosen hand on validation seeds, the search is flagged as having
    followed a false branch, and that hand is taken instead.
- **Best response, repeated.** Best hands depend on what the others hold. Iterate the search
  two or three rounds (fictitious play) until hands stop changing, and report whether they
  converged.
- **Matrix.** 7×7 per level, best hand against best hand, 95% intervals: the field average
  per monster (the band), every single matchup (20-80%, none over 85%), the equilibrium mix,
  and ancient dragons judged at 80%.
- **Skill expression.** The searched hand against a random legal hand of the same monster
  (choice), and the searched order against random orders of the same cards (order). The
  owner wants both to matter a lot; proposed floors are below.

### Layer 5: real rings

Sampled rings (sizes, levels, teams, bosses, ring events) as `sim:rings` does, with searched
hands instead of the hand-written likely decks. Checks the crowd rule and that duel
conclusions hold where fights actually happen.

### Layer 6: excitement

Measured on the Layer 4 hands, so a later change can be checked against them:

- **Fight length**: rounds and plays per fight, distribution not just mean.
- **Initiative edge**: the first mover's expected score in mirrors.
- **Comebacks**: the share of fights won by the monster behind on HP after the first round.
- **Swing plays**: plays that move the estimated win chance by 20 points or more. A model of
  HP and round alone would give pure control, confusion, boost, hide, and delayed-effect
  plays no swing, which are the moments this layer exists to protect. So the
  win-probability model's state includes: HP fractions; round and position in the hand;
  whose turn it is; active effects (immobilized, confused, hidden, delayed damage pending,
  and each temporary stat change); cards left in the round; monster types and level. It is
  fitted on some fights and **calibrated on held-out fights** (Brier score and a reliability
  table, reported per action class). The 20-point threshold is used only for action classes
  whose calibration passes; the rest get their swing from a counterfactual (the same seed
  with that play replaced by a null card) on a sample of fights.
- **Big moments**: natural 20s, strokes of luck, and Curse of Loki per fight; each card's
  share of plays in the top 5% of per-play value.

## Statistics and experimental design

- **Precision.** A 95% interval on an expected score is about ±5 points at 385 fights and ±3
  at 1,067. Anything that gates a decision (Layer 4, candidate changes) is measured to ±3;
  exploration may use ±5.
- **Common random numbers, measured (task 1).** A/B comparisons still run on the same seeds,
  but the engine draws every roll from one global stream, so two versions stay in step only
  until they first play a different card. Swapping a Hit for a Heal in the ninth slot, the
  shared seeds removed 99% of the variance of the difference (ratio 0.01); in the first
  slot they removed none (ratio 1.00). So budgets assume independent samples, and a paired
  interval is used only where it is measurably narrower. Per-contestant random streams in
  the engine's dice helpers (a harness mode, no gameplay change) would restore the pairing;
  it is an option for later, not part of this pass.
- **Seat-swapped pairs.** Each seed is played twice with the turn order reversed, so the
  first-mover edge cancels exactly instead of on average.
- **Sequential stopping is for triage, not for the reported number.** An interval computed
  from data that was also used to decide when to stop does not have its stated coverage. So
  adaptive stopping (a sequential test, or an anytime-valid confidence sequence) only decides
  where to spend fights. Every **reported** interval, and every in-band or out-of-band
  verdict, comes from a **fixed-size sample on fresh seeds** collected after triage.
- **Replication and multiple comparisons.** Hundreds of cells mean some fall outside by
  chance. A cell is out of band only when two independent fixed-size samples both put its
  interval outside; rankings use Holm-corrected intervals.
- **Validation of the value unit.** Before HE is used for anything, test it: (a) the
  ladder is monotone and repeatable across seed sets; (b) predicted scores of 30 held-out
  9-card hands (from summed, position-weighted HE) match their simulated scores with a mean
  absolute error of 5 points or less. If (b) fails, HE stays a diagnostic and the report
  says where synergy breaks it.
- **Reproducibility.** Every report prints its seeds, fight counts, commit SHA, profile, and
  flags, and writes JSON beside its table, so a result can be rerun and diffed.
- **Runtime.** A worker pool (one engine per worker thread) runs independent cells in
  parallel. Two profiles: **quick** (about 30 minutes, ±5, fewer levels) for development,
  and **full** (±3, all levels) for decisions, run overnight on the runner below.

### The runner: a standalone black box (owner, 2026-09-28)

There is no scheduler, and a cloud agent session cannot hold a command open overnight. So
every experiment runs on one **standalone batch runner** that needs only raw compute: no
network, no model inference, no database, no services.

- **Plans in, results out.** `sim:batch <plan.json> --out <dir>`. A plan lists **work
  units**, each one cell (a matchup, hands, level, fight count, and its seeds), plus the
  commit SHA and profile. Planners (`sim:catalogue --plan`, `sim:search --plan`, and so on)
  only write plans; the runner only runs them. Adaptive steps (search, triage) run as a
  sequence of plans, each written from the results of the last.
- **Incremental, append-only output.** One JSON line per finished unit in
  `results.jsonl`, written and flushed as it completes, with the unit's id, seeds, counts,
  paired results, and timings. A manifest records the plan's hash, commit, and start time;
  a heartbeat file is touched every minute. A run that dies keeps every finished unit.
- **Resumable and chunkable.** Rerunning the same plan into the same directory skips units
  already in `results.jsonl`. `--max-minutes N` stops cleanly after the current unit, and
  `--units a..b` or `--shard i/n` runs a slice, so a 30-minute agent session can take a run
  forward in chunks and an overnight machine can take all of it. Throughput per chunk is
  logged so the chunk size can be tuned by experiment.
- **Deterministic.** A unit's result depends only on its plan entry and the commit, so a
  unit rerun anywhere gives the same line, and results from several machines or chunks merge.
- **Readers.** `sim:report <dir>` aggregates whatever is present (partial runs included) into
  the tables and JSON the layers describe, and marks missing units rather than failing.

Task 1 builds this runner first, and every later script is a planner plus a report on top
of it.

### Compute budget (estimated at about 150 fights a second on 4 workers; measured 114 in task 1, so scale the times below by 1.3)

| Work | Fights (full) | Full | Quick |
|---|---:|---:|---:|
| Ladder: 8 levels × 10 rungs × 1,000 | 80,000 | ~10 min | ~3 min |
| Exchange rates: 8 classes × 6 settings × 8 levels × 1,000 | 384,000 | ~45 min | ~10 min |
| Catalogue: 61 cards × 8 levels × 2 contexts × 3 copy counts × 600 | 1,760,000 | ~3.3 h | ~20 min |
| Search: 7 monsters × 8 levels × ~60 candidates × 6 opponents × 200 (with early stopping) | ~4,000,000 per round | ~7.5 h per round | levels 1, 6, 12 only |
| Matrix: 8 levels × 21 pairs × 1,100 | 185,000 | ~20 min | ~5 min |

The search is the expensive part; the full run of it is an overnight job, and the quick
profile keeps day-to-day work under half an hour. Task 1 replaces these estimates with
measured ones.

## Proposed working targets

Adopted as working targets for this pass (they rank findings; the owner confirms them
before they gate a change in the next pass):

| Target | Value |
|---|---|
| Noise | Out of band only when two independent seed sets agree |
| Curve shape | Brutes 55-70% at levels 1-6 and 40-55% at 15-20; casters the mirror; the Bard between, crossing near levels 8-12 |
| Crowds | In sampled mixed rings each monster's win share stays within 0.7-1.4× its fair share |
| Progression | The same monster two levels up scores 65-75% |
| Card rate | No card above 1.5× its action-class median sHE at its level (rarity premium: epic 1.5×, rare 1.25× on top of the class median); none below 0.5× |
| Skill: choice | A searched hand scores at least 70% against a random legal hand of the same monster and level |
| Skill: order | A hand's best order scores at least 58% against its random orders (a first guess; Layer 1 will show what order can do) |
| Excitement | A change may not cut fight-level swing plays or comebacks by more than 20%, or a card's volatility by more than a third, without the owner's agreement |
| Initiative | The first mover's edge in mirrors is measured and reported; a target is set once the baseline is known |

## Harness plan (packages/harness)

| Module or script | Layer | What it does |
|---|---|---|
| `scripts/sim-batch.ts`, `src/balance/runner.ts` | all | The standalone runner: plans in, append-only `results.jsonl` out, resume, `--max-minutes`, `--units`, `--shard`, heartbeat |
| `scripts/sim-report.ts` | all | Aggregates any results directory, partial or complete, into tables and JSON |
| `src/balance/stats.ts` | all | Wilson and paired-difference intervals, SPRT, Holm; tested against known values |
| `src/balance/pairs.ts` | all | Seat-swapped pairs on common seeds; random turn order per fight (replacing the fixed order for balance runs) |
| `src/balance/pool.ts` | all | Worker-thread pool, one engine per worker; deterministic seed assignment |
| `src/balance/reference.ts` | 1-3 | The reference chassis, the null card, and the reference field |
| `src/balance/synthetic-cards.ts` | 1 | The `Ideal*` cards; a test proves they never reach the game's catalogue |
| `src/balance/ladder.ts` | 1-2 | Calibration ladder and score → HE conversion |
| `src/balance/profile.ts` | 1, 2, 6 | Per-play capture from engine events: value, hit frequency, volatility |
| `src/balance/collection.ts` | 3 | Realistic collection sampler from the real drop code |
| `src/balance/winprob.ts` | 6 | Win-probability model from fight states, for swing plays and comebacks |
| `scripts/sim-formula.ts` | 0 | Closed-form and chassis tables, no fights |
| `scripts/sim-archetypes.ts` | 1 | Exchange rates, scaling, crowd factor, profiles |
| `scripts/sim-order.ts` | 1, 2 | Order sensitivity |
| `scripts/sim-catalogue.ts` | 2 | Every card's sHE, HE, stacking curve, profile |
| `scripts/sim-inventory.ts` | 3 | Chassis values, collections, inventories |
| `scripts/sim-search.ts` | 4 | Skilled-hand search with best-response rounds |
| `scripts/sim-matrix.ts` | 4 | Matrices, the band check, skill expression |
| `scripts/sim-excitement.ts` | 6 | The excitement report |
| `reports/` (gitignored) and `docs/reference/balance-reports/` (checked-in summaries) | all | JSON for machines; a short Markdown summary per run that informs a decision |

Existing scripts stay (`sim:rings`, `sim:mega`, `sim:bosses`, `sim:statcards`,
`sim:cardpower`); `sim:rings` gains the searched hands and random turn order.

## Documentation deliverables

- `docs/reference/balance-methodology.md` (new, long-lived): vocabulary, layers,
  statistics, which script answers which question, how long each takes, how to read the
  output, and the tuning protocol below. Linked from `AGENTS.md` and `docs/README.md`.
- `docs/reference/simulation-harness.md`: the new scripts, flags, and fields, and a note
  that results before this pass were measured with a fixed first mover.
- `docs/architecture/cards-and-encounter-effects.md`: the balance rules, restated in sHE once
  the owner confirms the targets.
- The findings report (in this plan, then folded into roadmap 11): ranked candidate
  changes, each with its evidence, expected effect on the band, excitement cost, and the
  number of cards it touches.

## The tuning protocol (for the next pass)

1. From Layer 4, list the out-of-band cells (two seed sets agree).
2. Attribute each: chassis (Layer 3), a card or a few cards (Layer 2 outliers, the
   inventory's single-card dependencies), stacking (copy curves), or structure (Layer 0's
   flat strikes against rising HP).
3. List candidate levers for each cause, smallest first: a number on one card; a rarity or
   rarity copy limit; level scaling; a class permission; a chassis stat; a redesign.
4. A/B each candidate on common seeds against the whole matrix, not just the cell it fixes,
   and on the excitement report.
5. Choose by the owner's rule: most cells into band, fewest cards touched, excitement kept.
6. Owner approves; the change ships with tests and a full rerun, and the report is checked in.

**Excitement-preserving redesign patterns** to reach for before a flat nerf:

- A roll per target (the owner's Sandstorm idea: a d20 per opponent, caught on 7 or more).
- An opposed roll (caster's INT against the target's INT or DEX) so stats matter.
- A crit tail: a natural 20 does something extra, a natural 1 backfires.
- Diminishing repeats: a second copy in the same round is weaker, instead of a copy limit.
- Scaling on the roll rather than a flat bonus, so variance grows with power.

## Tasks

Three PRs, each within the budget rule in `AGENTS.md`. Each task is one commit and push (or
a few), with this table updated in the same commit.

| # | PR | Task | Acceptance | Status | Commit |
|---|---|---|---|---|---|
| 1 | A | The standalone runner (plans, append-only results, resume, chunks, shards, report); statistics; seat-swapped pairs with random turn order; worker pool. Measure throughput and chunk sizes an agent session can finish, and the variance common seeds remove; re-baseline the 33 curves without the fixed first mover | A run killed mid-way resumes without losing finished units; stats tests pass against known values; measured budget replaces the estimates; corrected curves checked in | Done: runner, stats, and corrected curves ([report](../reference/balance-reports/2026-09-28-class-curves.md)); a hard kill after 54 of 168 units lost nothing; 114-195 fights a second on 4 workers, and a 27k-fight plan ran in 4 minutes in an agent session. Common seeds help only while the two versions play the same cards (above). A first taste of order: a Heal in place of the first Hit cost 12.6 points; in place of the ninth, nothing | 98b253b, 5720593, this commit |
| 2 | A | Layer 0: `sim:formula` and the chassis table | Tables per level; the flat-strike hypothesis confirmed or refuted | Done: confirmed. A Hit's turns to kill doubles from level 10 to 20 (it lands less and hits softer as AC outgrows DEX and STR) while Blast's falls to about 5; [report](../reference/balance-reports/2026-09-28-formula.md) | this commit |
| 3 | A | Reference chassis, null card, synthetic cards, calibration ladder | Ladder monotone and repeatable across two seed sets; synthetic cards provably absent from the game | Done: reference chassis, `Ideal:Null` and `Ideal:Strike` (the other synthetic classes come with task 5, where they are used); the ladder (96,000 fights) is monotone at every level in both seed sets, mean difference between sets 2.3 points. 6 of 96 interior rungs differ by more than chance, because each unit shuffles where its nulls sit and position matters (task 4), so the full ladder averages more shuffles per rung | 7e40df3, this commit |
| 4 | A | Validate HE: stacking linearity on synthetic cards; 30 held-out hands predicted within 5 points | A pass/fail statement, and what HE can and cannot be used for | Done: **at the mark, not under it** (80 held-out synthetic hands, mean absolute error 5.1 against a mark of 5, noise floor 2.1; first reported as 4.9 until a Codex review found the slot weighting applied twice) after two fixes from a first failing run (13.5): a two-sided ladder, and fitted slot weights. Stacking is linear. Slot position is first-order at levels 4-7 (slot 1 worth up to about 4 times slot 9). HE ranks and explains; decisions stay on whole-hand simulation; repeat on real cards in task 6. [Report](../reference/balance-reports/2026-09-28-ladder-and-he.md) | 1fc3cb1, 522e493, this commit |
| 5 | B | Layer 1 experiments: exchange rates, scaling, crowd factor, profiles, order | The idealized price list, and what order can and cannot do | Planned | |
| 6 | B | Layer 2: `sim:catalogue` over all 61 cards | Catalogue JSON and tables; outliers flagged | Planned | |
| 7 | B | Layer 3: chassis values, collection model, inventories | Per-monster strength decomposed | Planned | |
| 8a | B | Layer 6 tooling: excitement metrics, the win-probability model with its state features, held-out calibration, and the counterfactual fallback, exercised on provisional hands (the likely decks) | Calibration report per action class; tooling tested | Planned | |
| 9 | C | Layer 4: search with best-response rounds, matrices, skill expression; catalogue rerun against the searched field | The band check per level (realistic and unconstrained) | Planned | |
| 8b | C | Layer 6 baseline: the excitement report on the searched hands from task 9 | Baseline excitement report | Planned | |
| 10 | C | Layer 5: rings on searched hands | Crowd rule checked | Planned | |
| 11 | C | Reference doc, findings report with ranked candidates, roadmap 11 updated, this plan archived | `balance-methodology.md`; the next pass's decision list | Planned | |

Order: 1 → 2 and 3 (in parallel) → 4 → 5, 6, 7, 8a (in parallel, separate scripts) → 9 →
8b and 10 (in parallel) → 11. Every task gets an independent read-only review of its diff; the statistics module and
the synthetic-card isolation get the closest look.

## Starting evidence (from 33, to be re-measured in task 1)

All of it was measured with the monster under test moving first, so absolute numbers run
high for that monster; the comparisons within a table (one card against another, the same
seeds) stand.

- Informed-hand curves: the Weeping Angel and Jinn at 80-93%, the Dragon at 4-9% early, the
  Basilisk at 19-34% late, the Unicorn at 17% at level 5. Random hands were nearly inside
  the band.
- The Jinn's duel strength is Sandstorm's target redraw: in a duel about 77% of a confused
  monster's next attacks hit itself, and a confused heal goes to the Jinn 70% of the time.
- Copies of area spells in an informed hand, against informed hands of every other monster
  (60 fights per opponent):

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

  Readings to confirm: extra copies of area spells push the late game past the band, so a
  rarity copy limit is a live candidate; the Dragon's early problem is its hand, not Fire
  Breath; Blast carries the Angel only in multiples.

## Candidate changes to evaluate in the next pass (not this one)

- **Sandstorm as a roll**, and a softer redraw, compared on rate and excitement.
- **Roll for initiative** (owner, 2026-09-28): in real fights, turn order is a hidden coin
  flip (the ring shuffles contestants as they join, and the order holds for the whole
  fight). A visible roll at the start of a fight (d20 + DEX modifier) would make it a moment
  and give DEX another use. Owner's shape: the lowest-XP monster in the ring rolls with
  advantage (an underdog's edge); a natural 20 earns a glory announcement only, with no
  gameplay change; no extra actions, since acting twice would disturb hand order. Measure
  first: the initiative edge per matchup and level (Layer 6), how much DEX and the
  underdog's advantage would shift it, and once per fight against each round. Across all pairs with
  likely and random hands, going first is worth 53% (task 1 baseline), far less than the
  51-65% of Hit mirrors, so this is mainly for excitement and stat value, not fairness.
- **Rarity copy limits** (epic 2, or 1) if Layers 2-4 confirm stacking.
- **Level scaling** of area strikes past level 10, re-measured after the ±5 cap.
- **Late-game strikes.** If Layer 0 confirms flat strikes against rising HP, a structural fix
  (strikes scaling a little past level 10, or HP growth slowing) may beat nerfing casters.
- **Inventory gaps.** Where a monster's best hand is short, a new card or a cheaper rarity
  for an existing one.
- **Hand guidance.** If the Dragon's early problem is its hand, better defaults or handbook
  builds may fix it without touching a card.

## Open questions

None open. Scheduled runs are replaced by the standalone runner: the owner starts long runs
on any machine, and agent sessions take quick runs forward in chunks.
