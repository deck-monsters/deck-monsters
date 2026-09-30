---
type: Reference
title: Simulation harness
description: What packages/harness measures, how simulate() is instrumented, and its CLI scripts.
status: stable
audience: internal
tags: [harness, simulation, balance, economy, testing]
---
# Simulation harness

Read before: adding a `sim:*` balance/economy script, changing `SimResult`, instrumenting
`simulate()`/`ring.fight()` from outside the engine, or touching `packages/harness/src`.
Verified: 2026-09-24 against `packages/harness/src/simulate.ts`.

`packages/harness` runs the real engine (`@deck-monsters/engine`'s `Game`/`Ring`, not a
model of it) without Discord, HTTP, or a database, for repeatable balance and economy
measurement. See [roadmap 11](../roadmap/11-balance-and-mechanics.md) ("Measurement first")
for why this exists and what it gates.

## Determinism

- `DECK_MONSTERS_HARNESS_RANDOM_SEED` (read by `set-env.ts`, applied before the engine loads)
  seeds `Math.random` with `rng.ts`'s `mulberry32` for lazy engine init (color/emoji/deck
  helpers resolved once at import time).
- `simulate({ seed })` and `simulateNewPlayerProgression({ seed })` additionally swap in
  their own `mulberry32(seed)` for the fight(s) themselves, restoring the previous
  `Math.random` afterwards — so two calls with the same `seed` in the same process are
  reproducible, and calls without a `seed` don't perturb a caller's own RNG state.
- Both functions force `DECK_MONSTERS_DETERMINISTIC_RING` for the duration of the run
  (restored in a `finally`), so contestant order and ambiguous round-cap endings don't add
  extra randomness on top of the seeded RNG. They **clear** `DECK_MONSTERS_DETERMINISTIC_DRAW`
  for the run: that mode sorts the card pool alphabetically and keeps the first card that
  passes its rarity roll, which crowds decks with early-alphabet cards. Until September 2026
  the harness forced it on, and harness Weeping Angels carried about 6 Blast/Blast II cards
  in 9 slots instead of about 1.2. Every pre-fix report that showed Clerics winning ~95%
  measured that bias. A shuffled draw under the seeded `Math.random` is still reproducible.
- `set-env.ts` also forces `DECK_MONSTERS_SKIP_DELAYS`, so fights run at full speed.
- Random decks never keep a card listed in `HARNESS_EXCLUDED_CARD_TYPES` (currently Flee).
  Each one is swapped for a fresh legal draw, so the hand stays full. Flee is a
  special-purpose card; in a simulation it only turns fights into draws and hides the
  matchup being measured. An explicit `SimMonsterSpec.deck` is used exactly as given.

### Reading a report

- **Sim 1 always acts first.** The deterministic ring fixes turn order. In a mirror match
  with a fixed fixture deck both monsters play the same cards in lockstep, so any tempo
  effect is magnified: a Dragon mirror of nine Fire Breaths gives the first mover 90%, and
  the Dragon's fixture mirror gave Sim 2 over 80%, while the Unicorn's is 50/50. Read a
  lopsided fixture mirror as turn-order tempo, not as a card problem.
- **A fixture deck against random decks** measures a built deck against unbuilt ones, so its
  rows run higher than a real ring would; judge the curve's shape, and compare random-deck
  rows with other monsters' random-deck rows.
- **"1993-09-7202 18:58" in the damage columns is not a bug.** It is the `cardType` of
  Prion Disease, a joke card (the questionable milkshakes), and it hits hard.

## `simulate()` — `packages/harness/src/simulate.ts`

Runs `config.fights` independent 1-shot ring encounters with a fixed monster lineup (each
fight gets brand-new `Contestant`s — see `buildContestant()`) and returns a `SimResult`:

| Field | Meaning |
|---|---|
| `winRates`, `drawRate`, `avgRounds`, `avgDamagePerCard`, `cardDropRate` | Combat-shape metrics from before this doc — see the `sim:winrates`/`sim:cardpower` scripts below. |
| `coinsByOutcome` | `Partial<Record<'win'\|'loss'\|'draw'\|'fled'\|'permaDeath', EconomyStats>>`. **Steady-state** coins credited to `contestant.character.coins` per fight, bucketed by that *contestant's own* outcome (not the fight's overall outcome — a mutual-kill fight is an overall `draw` but a `loss` for both contestants; only a true round-cap survive-and-survive ends with `draw` rows). A bucket is missing, not zero-filled, when a run produced none of that outcome. "Steady-state" — see the subsection below — means this is `COINS_PER_VICTORY`/`COINS_PER_DEFEAT` exactly, not what an actual new player sees; use `simulateNewPlayerProgression()` for the bonus-inclusive numbers. |
| `xpPerMonster` | `EconomyStats` over `monster.xp` gained per contestant per fight (the ring's own combat XP — `Ring.awardMonsterXP`/`calculateXP` — not the player-progression XP below), pooled across all outcomes. |
| `cancelledFights` | Count of fights `ring.fight()` cancelled internally (see "A second trap" below) and therefore excluded from `coinsByOutcome`/`xpPerMonster`. Non-zero means the run is under-sampled by that many fights, not a bug in the bucketing. |

`EconomyStats` is `{ count, mean, p50, p90, min, max }`; `summarizeSamples()` returns the
all-zero/`count: 0` shape for an empty sample set rather than throwing.

### Steady-state vs. bonus-inclusive: two different questions

`game.ts`'s `awardFightCoins` pays every fight's base outcome amount (`COINS_PER_VICTORY`/
`COINS_PER_DEFEAT`) plus two bonuses that fade with play: a once-daily +5 (gated on
`character.lastDailyFightCoinDay`) and a tapering early-battle bonus (`earlyCoinBonus`,
keyed on `character.battles.total`, zero once `battles.total` has passed
`EARLY_COIN_BONUS_TIERS`'s highest `untilFightsPlayed`). `simulate()` builds a brand-new
`Contestant` (and so a brand-new `Beastmaster`, via `randomCharacter()`) for every fight, and
`randomCharacter()` rolls `battles.total` uniformly in `[0, 180]` when no `statSeed` is given
— so left alone, `coinsByOutcome` would silently mix in the once-daily bonus on effectively
every fight and the early bonus on some random fraction of them, overstating the true
steady-state win/loss payout (observed: win read ~10 instead of `COINS_PER_VICTORY`'s 5, loss
~7 instead of `COINS_PER_DEFEAT`'s 2 — a 1.43:1 ratio instead of the real 2.5:1, which would
misread as a balance problem).

`simulate()` therefore pins every fresh contestant's `character.lastDailyFightCoinDay` to
today (via the exported `getUtcDay()`) and `character.battles` to
`STEADY_STATE_BATTLES_TOTAL` (`Math.max` over `EARLY_COIN_BONUS_TIERS`' `untilFightsPlayed`)
before each fight, so `coinsByOutcome` reads the payout the economy converges to for an
established player. `simulateNewPlayerProgression()` deliberately does the opposite — it
threads a persistent character's real `battles.total`/`lastDailyFightCoinDay` across fights
precisely so those bonuses show up and taper the way they would for a real new player (see
below). Use `coinsByOutcome` to ask "is the steady-state win/loss ratio balanced?" and
`simulateNewPlayerProgression()` to ask "what does a new player's wallet look like after N
fights?" — they answer different questions and should not be compared to each other directly.

### A second trap: a cancelled fight returns normally, with an empty `participants[]`

`ring.fight()` does not reject when something goes wrong mid-fight: its own internal
`.catch()` (`ring/index.ts`) logs the error, announces the cancellation, publishes a
`ring.fightResolved` event with `outcome: 'cancelled'` and `participants: []`, clears the
ring, and resolves normally. A caller `await`ing `ring.fight()` sees no error at all. The
pre-existing win-rate/round/card-drop counters already tolerate this silently (looping over
an empty array is a no-op); the per-contestant coin/XP bucketing does not have that luxury —
it needs to look each contestant up in `participants[]` — so it checks for the empty-array
case explicitly and counts it in `cancelledFights` instead of throwing the "no participant
found" error that's meant to catch a real bug in the lookup.

Both new fields are read as a **before/after diff around `await ring.fight()`** on the real
`character.coins` / `monster.xp` fields — never recomputed from `constants/coins.ts` or
`helpers/experience.ts` — specifically so a payout bug (wrong bonus, double award, a missing
daily cap) shows up as a distribution anomaly here rather than being hidden by a test that
only re-checks the constants were read correctly.

There are two separate, non-overlapping reward mechanisms in the engine, and this harness
measures both:

- **Player-character economy** (`game.ts`'s `handleWinner`/`handleLoser`/`handlePermaDeath`/
  `handleFled`/`handleDraw`, listening for the room-scoped `creature.win`/`.loss`/etc.
  broadcasts): coins (`awardFightCoins`, including the once-daily fight bonus and the
  tapering `earlyCoinBonus`) and `character.xp`.
- **Monster combat XP** (`Ring.awardMonsterXP` → `calculateXP`, in `fightConcludes()`): per-kill,
  per-death, per-flee, and "lasted N rounds against M opponents" XP added straight to
  `monster.xp`.

### A trap this measurement caught: don't read `Contestant.won`/`.lost`/`.fled` back

`Ring.addMonster()` copies the fields you give it (`monster`, `character`, `userId`,
`isBoss`, …) into its **own** internal `Contestant` object — it does not keep the one the
caller built. `Ring.fightConcludes()` then sets `won`/`lost`/`fled` **on that internal copy**.
A caller instrumenting fights from the outside (as `simulate()` does) that holds onto its own
`Contestant` reference and reads `.won`/`.fled` back after `await ring.fight()` will always
see them `undefined` — `monster.dead`/`.destroyed` still update correctly, since the
`monster` object itself is shared by reference, but the per-contestant win/loss/fled flags
never propagate back.

This first version of `coinsByOutcome` did exactly that and silently produced zero `'win'`
and zero `'fled'` samples on every run — caught only because the existing `winRates` field
(computed correctly, from the `ring.fightResolved` event) disagreed with it. The fix, and the
pattern to reuse: read the outcome from the `ring.fightResolved` event's `participants[]`
array (matched by `monsterId` = `monster.stableId`), which is the engine's own authoritative
per-contestant outcome computation (`ring/index.ts`'s private `participantOutcome()`), not a
local guess re-derived from flags that may not be the ones the ring actually mutated.

## `simulateNewPlayerProgression()` — the "new player" scenario

Roadmap 11's Economy telemetry item asks for "new-player 1/5/20-fight … scenarios in the
harness." `simulateNewPlayerProgression(config)` runs one player against a fixed-level
disposable opponent for `max(checkpoints)` fights (default checkpoints `[1, 5, 20]`) and
returns a `NewPlayerCheckpoint[]` with cumulative `coins`, `characterXp`, `monsterXpGained`,
`wins`, `losses`, and `cancelledFights` at each checkpoint. `afterFights` counts attempts,
so a non-zero `cancelledFights` means fewer rewarded fights than the row's label.
Checkpoints must be positive integers; anything else is rejected before a fight runs, because
the largest checkpoint bounds the fight loop.

The player's **character** (wallet, XP, battle record, `lastDailyFightCoinDay`) is threaded
by value onto a fresh disposable `Contestant` each fight, rather than reused as one object —
`game.ts`'s `awardFightCoins` keys the once-daily bonus and the early-battle-count taper off
`character.battles.total` and `character.lastDailyFightCoinDay`, so a genuinely fresh
character on every fight (the same shortcut the rest of `simulate()` takes) would trigger the
daily bonus on every single fight and never taper the early bonus — defeating the point of a
"new player" measurement. The player's **monster** is rebuilt fresh each fight instead of
reused: reusing the same monster object across fights would require simulating revival and
passive healing between bouts (real-time timers this harness deliberately skips), which is
unrelated to what this scenario measures. `monsterXpGained` is therefore a running sum of
each fight's `monster.xp` delta, not a single before/after read.

Win/loss counts use the same `ring.fightResolved`-participants pattern as `coinsByOutcome`
above, for the same reason.

## Timer cleanup on the last fight

`Ring.clearRing()` is what disposes a **transient** (boss/harness) contestant's timers —
`disposeTransientContestant()`, called once per contestant already in the ring, each time
`clearRing()` runs. Both `simulate()`'s and `simulateNewPlayerProgression()`'s loops call
`ring.clearRing()` at the *start* of each fight (to clear the previous one), so without an
extra call after the loop, the last fight's contestants keep live timers past the end of the
run — the `charMap.characters` bookkeeping that scopes `Game`'s reward listeners is unrelated
and doesn't reach them (`Game.dispose()` only disposes timers for characters still present in
`game.characters`, and the harness deliberately removes each fight's characters from that map
in the same fight's own `finally` block). Both functions now call `ring.clearRing()` once
more in their outer `finally`, after the loop, to dispose the last fight's contestants too.

## CLI scripts (`packages/harness/package.json`)

| Script | What it prints | Typical runtime |
|---|---|---|
| `sim:winrates` | Every monster type against every other at a fixed level (200 fights each; six monsters make 36 pairs); flags win rates outside 35–65%. | ~130s — this is real work, not a hang; don't re-flag it as one if it takes a while to return. |
| `sim:cardpower` | Average damage dealt per card type; top/bottom 10%. | ~20s |
| `sim:levelscaling` | Same matchup at levels 1/5/10/15/20, to spot scaling drift. | ~20s |
| `sim:economy` | `coinsByOutcome`/`xpPerMonster` distributions, plus the new-player 1/5/20-fight checkpoint table. | ~10s |
| `sim:bosses` | Humans against real bosses in the owner's scenarios (a level 1 against one boss, two bosses, a beginner + L1 + L5 pack; two humans with and without a team). Humans carry a player's starting deck; bosses are built and target exactly as the ring spawns them. Monster types are random per batch. Prints how often a human wins. `SIM_BOSSES_FIGHTS` sets fights per batch (8 batches per row, default 25). | ~1.5 min |
| `sim:mega` | The mega boss against two to four humans (half likely decks, half random) at levels 1–10, built with the engine's own `fitMegaBoss`, `empowerMegaBoss`, and `megaMinionHp`. Prints how often a human won, against the owner's 20% target. `SIM_MEGA_HP_SCALE` multiplies the fitted HP to calibrate; `SIM_MEGA_FIGHTS` sets fights per batch (default 20). | ~4 min |
| `sim:statcards` | What a boost or curse card is worth per play: mirror matches (Minotaur, Gladiator, Weeping Angel at levels 1, 5, 10) where one side swaps a Hit in a four-Hit hand for the card, reported as the swing in decisive win share against four Hits a side. AC cards are a reference. The first-listed monster always moves first, so the rows are comparisons, not absolute rates (roadmap 34). `SIM_STATCARD_FIGHTS` sets fights per cell (default 300). | ~10 min |
| `sim:batch`, `sim:report`, `plan:curves` | The standalone runner and its report, and the class-curve planner (every pair of monsters at levels 1, 3, 6, 8, 10, 12, 15, 20, likely and random hands, seat-swapped). See the runner section below. | ~5 min for `--fights 40` |
| `sim:formula` | Layer 0 of the balance methodology: each monster's HP, AC, and stat modifiers by level (from real engine instances), and a Hit's and a Blast's per-play damage and turns to kill against the field, sampled from the cards' own roll methods. No fights. `--json out.json`. | ~7 s |
| `plan:ladder` | The calibration ladder (roadmap 34 tasks 3-4), two-sided, on the reference chassis: rungs 0-9 are k Hits and 9-k null cards against 9 Hits; rungs 10-18 are 9 Hits against an opponent missing k-9 Hits, so a hand worth more than 9 Hits can be measured. Six shuffles per rung by default (slot position matters). `sim:report` prints the curve per level and whether it is monotone; `balance/ladder.ts` converts scores to Hit-equivalents and back. | ~5 min for four levels |
| `plan:validate-he`, `sim:validate-he` | Validates the Hit-equivalent on synthetic strikes: slot weights, each strike measured in every slot, stacking, and held-out hands predicted from single values weighted by slot (`--weights raw\|smooth\|uniform`, default smooth). Pass mark: mean absolute error 5 points. `sim-validate-he <ladder-run> <validate-run>`. | ~5 min |
| `plan:catalogue`, `sim:catalogue` | Layer 2: every card (Flee excluded) in each slot of 8 Hits on the reference chassis, against 9 Hits and against the reference field hand, per level (`--levels`, default 1,3,5,7,12; `--fights`, default 25 per seat order). The report converts through the ladder to Hit-equivalents and flags cards far from their action class's median, with the rarity premium. `sim-catalogue <catalogue-run> <ladder-run>... [--json] [--md]`. | ~22 min |
| `plan:holders`, `sim:holders` | Layer 3: each monster's body value (the reference field hand on the real body against the reference chassis) and each restricted card on its real holders, in each slot of 8 Hits against the same monster's 9 Hits. `sim-holders <run> <catalogue.json> <ladder-run>... [--json]`. | ~15 min |
| `sim:collection` | Layer 3, no fights: what a player owns by each level from the engine's starting deck and drop code (`--xp-per-fight`, default 9 from production; `--win-rate` 0.5; no shop), and the best-9 inventory by catalogue sHE against the unconstrained best. `--catalogue <catalogue.json>` is required. | ~3 min |
| `plan:contexts`, `sim:contexts` | Layer 2 contexts (task 6b): every card in a caster hand, a brute hand, against an opponent that drinks, against an opponent that holds (added for roadmap 35), and in a three-opponent crowd, valued against a Hit in the same slot of the same context. The report names each card's best context and flags context cards, cards weak everywhere, and traps. `sim-contexts <run> <catalogue.json> [--json]`. | ~1.5 h |
| `sim:search`, `sim:search-report` | Layer 4, lean (task 9): searches each monster's best hand and order from the typical collection against the field of every other monster's current best hand (paired search seeds, a 99% gain to propose a move, confirmed on fresh seeds), for `--rounds` of best response, then plays the final hands against each other on validation seeds (the band check) and against their own typical hands. Resumable: state is saved after every phase, each phase is a runner plan, and `--max-hours` stops between phases. `sim-search --out <dir> --collection <layer3-collection.json>`. | ~4 h at defaults |
| `plan:matrix`, `sim:matrix-report` | Before/after checks (roadmap 35): a fixed-hand matrix (every pair of given hands per level, seat-swapped, excitement recorded) on fixed seeds. Run the same plan at two commits and compare: field averages, matchups, and the excitement and hope guardrails (rounds, Curse of Loki and strokes of luck per fight, turnarounds from 25 and 50 points behind), with a drop over 20% flagged for the owner. `plan-matrix --hands <search.json> --out plan.json`; `sim-matrix-report <before> [<after>]`. | ~3 min at 200 fights |
| `sim:rings` | Realistic rings with player decks. `curves`: each monster as a human against a random other at the same level, levels 1-20 (a per-class curve). `rings`: 120 rings sampled the way rooms fill (mostly 2-3 monsters, levels mostly 0-6, some pre-arranged pairs, 40% with bosses spawned by the ring's rules), each monster's wins against its fair share, and how often humans beat bosses. Pass `curves` or `rings` to run one; `--likely` gives humans likely decks and `--events` rolls ring events. `SIM_RINGS_FIGHTS` sets fights per batch (default 20). | ~5 min each |
| `sim:monster <type>` | One monster (`pnpm --filter @deck-monsters/harness sim:monster Dragon`; any class name or creature type) against every other monster at levels 1/5/10/15/20 with random decks, and with its thematic fixture deck when its report has one. Then a mirror, a 2v2 team fight, and a crowded free-for-all with every other monster once, where area damage shows. Prints win rate, share of decisive fights, draws, rounds, top damage per card, and the monster's card counters. Flags rows outside 35–65% of decisive fights (fixture rows only, when there is a fixture). `SIM_MONSTER_FIGHTS` sets fights per row (default 100). `sim:unicorn` is `sim:monster Unicorn`. | ~2 min per monster |
| `sim-gauntlet` (`node dist/scripts/sim-gauntlet.js`) | Roadmap 38: a human against the ring's own boss spawns with a ring event forced (`SimConfig.forceRingEvent`), per monster type and level. `--lone <levels>` (one human against the Gauntlet), `--pair <levels>` (two humans), `--ambush <levels>` (one human against a boss and an ambush minion, `SimMonsterSpec.minion`), `--variant none` (the shipped rules), `reference` (one boss, no event), `no-rivals-outnumbered` or `event-weights-eligible` (the rules before roadmap 38), `--fights`, `--pair-fights`, `--out`. A long process leaks memory (roadmap 10, item I), so run one process per cell. | ~1 min a cell at 1,000 fights |

Each of these is `node dist/scripts/<name>.js` — run `pnpm --filter @deck-monsters/harness
build` first. **Every one of them calls `process.exit(...)` at the end of `main()`.** Loading
`@deck-monsters/engine` leaves the process with zero entries in
`process._getActiveHandles()`/`_getActiveRequests()` (reproduces even with zero simulated
fights — just `await engineReady` and return), yet it still won't exit on its own; something
in the dynamically-imported color/emoji/monster/deck helpers (`characters/helpers/random.ts`)
holds a reference Node's own exit bookkeeping doesn't see. `cli-entry.ts`'s `cli-main.ts` and
this package's own test script (`"test": "mocha --exit"`) already work around the same root
cause. `sim:winrates`, `sim:cardpower`, and `sim:levelscaling` had no such workaround before
this doc's change and hung indefinitely after printing their reports when run as a plain
`node dist/scripts/…` (rather than under a harness that kills the process after it sees the
expected output) — they now call `process.exit(0)` (or `process.exitCode ?? 0` for
`sim:winrates`, which sets a non-zero `exitCode` on a balance warning) too.

## The standalone runner (`sim:batch`) — `packages/harness/src/balance/`

The balance methodology ([roadmap 34](../roadmap/34-balance-methodology.md)) runs on one
batch runner that needs only raw compute: no network, no model inference, no database. A
long run is a black box on any machine; a short agent session takes it forward in chunks.

```bash
cd packages/harness
node dist/scripts/plan-curves.js --out plan.json --fights 40      # a planner writes work units
node dist/scripts/sim-batch.js plan.json --out run/ [--max-minutes 25] [--units 0..100] [--shard 0/4] [--workers 4]
node dist/scripts/sim-report.js run/ [--json summary.json]         # works on partial runs
```

- **Plans.** A plan (`balance/units.ts`) lists units: sides (`SimMonsterSpec`s), fights per
  seat order, a seed, and optional `group` and `tags`. Planners only write plans; the runner
  only runs them.
- **Seat order.** `simulate()` plays sides in the order listed, and the first mover's edge in
  Hit mirrors is 51-65%. A unit plays every rotation of its sides on the same seed and
  credits each side by identity, so the edge cancels exactly. Every curve measured before
  this (roadmaps 32 and 33, `sim:rings`, `sim:statcards`) listed the monster under test first,
  so its absolute numbers run high for that monster; comparisons within one table stand.
- **Output.** `results.jsonl` gets one line per finished unit, written as it completes
  (wins, draws, losses, and expected score per side, per rotation, and timings). A run that
  dies keeps every finished unit; a torn last line is ignored. `manifest.json` records the
  plan hash and commits; `heartbeat.json` is rewritten every minute.
- **Resume, chunks, shards.** Rerunning a plan into the same directory skips finished units;
  a directory holding a different plan is refused, and so is a resume at a different commit
  from the one the run started at (`--allow-commit-change` overrides; uncommitted edits are
  not detected, so run long plans from a clean checkout). `--max-minutes` stops after the
  units in flight; `--units a..b` and `--shard i/n` run a slice.
- **Cancelled fights fail the unit.** A fight the engine cancels (an internal error
  `ring.fight()` swallows) would otherwise score as a draw; the unit is recorded as failed
  and runs again on resume.
- **Excitement.** A unit with `excitement: true` runs `simulate()` with `trackExcitement` and
  returns an `ExcitementTally`: rounds, Curse of Loki and stroke-of-luck rolls, and
  turnarounds (decisive fights whose winner once trailed its best opponent by 25 or 50 points
  of HP fraction, read from the public combat payloads). It guards the owner's "please get a
  Loki" hope moments when a change is measured.
- **Workers.** One engine per worker thread (`balance/worker.ts`), so `simulate()`'s global
  seeded `Math.random` never crosses units. About 100 fights a second on 4 cores with 9-card
  human hands (measured 2026-09-28).
- **Statistics** (`balance/stats.ts`): Wilson and mean intervals, sample sizes, Holm, and an
  SPRT for triage. Tested against textbook values.
- **Reference chassis** (`balance/reference.ts`): `SimMonsterSpec.chassis: 'reference'` gives
  a contestant the median stat offsets and median HP and AC variance of the seven real
  monsters, and no creature type, so no card is strong or weak against it. `type` still picks
  the class the engine builds. The medians are computed once on their own fixed seed, so a
  unit's result never depends on what ran before it.
- **Synthetic cards** (`balance/synthetic-cards.ts`): a hand entry `Ideal:<Kind>` or
  `Ideal:<Kind>:<JSON options>` builds a harness-only card on the engine's own classes
  (`Ideal:Null` takes a slot and does nothing; `Ideal:Strike` is a Hit with its dice set by
  options). They are never registered with the engine, so they cannot drop or be equipped;
  `balance/synthetic.test.ts` proves it. Every other hand entry is an engine card type.

## Humans and bosses (`SimMonsterSpec.role`)

Until September 2026 every harness contestant was built by `randomContestant({ isBoss: true })`
and then given its own faction and default targeting. So every "random legal deck" was a
**boss** deck, which drops Flee, Harden, Heal, Hit, and Whiskey Shot, and no run measured a
player's deck or a real boss. A spec's `role` now says what it is:

- **omitted**: the classic sim contestant above, kept so earlier reports stay comparable;
- **`human`**: a player: the starting deck (`getInitialDeck`) plus two random cards per
  level, nine legal cards equipped at random (Flee excluded), its own faction, default
  targeting. A floor for how well a human plays, since players build their hands;
- **`boss`**: a real boss, untouched: the Boss team, a boss deck, and a boss temperament
  (its targeting strategy; see [boss encounters](../architecture/boss-encounters.md#1-what-a-boss-is)).

A human's `deckStyle` chooses its hand. `random` (the default) is the floor above. `likely`
is the other end, a player who knows the monster: `likely-decks.ts` lists each monster's
signature cards and the handbook's example builds in preference order, the monster keeps the
ones it may hold at its level, and a random legal fill completes the hand. Every human hand
obeys `MAX_CARD_COPIES_IN_HAND` (four of one card), as a player's equip does. The lists are
hand-written until equipped-deck telemetry exists, so a report on likely decks measures
those lists as much as the monsters; read it beside the random-deck report.

`SimConfig.ringEvents` rolls the ring's own events before each fight, at
`RING_EVENT_CHANCE_PERCENT` from the events eligible for that roster, with a seeded pick
(the ring's own roll stays off under the harness's determinism switch). `SimResult.ringEvents`
counts them by name. A Gauntlet's extra bosses are no sim slot, so their wins count under
`EXTRA_BOSS_LABEL` ("Extra boss") in `winnersByFight`. A run with teams in its specs ignores
the flag, since it already runs under its own team event.
  Bosses only behave realistically beside at least one human.

`SimConfig.onContestants` lets a test inspect each fight's contestants before it starts.

## Team fights

`SimMonsterSpec.team` puts a contestant on a faction; a classic sim contestant without one
gets a faction of its own (`solo:Sim N`), never the shared boss team, and a `human` without
one stays teamless, as a player is (so the ring's humans-unite rule applies). For classic
contestants the harness also clears the boss targeting strategy `randomContestant` gives
them: the old shared strategy (`TARGET_HUMAN_PLAYER_WEAK`) fell back to a team-blind target
with no human in the ring, and in a 2v2 run 44% of hits landed on allies. The default
next-player strategy respects teams. When any spec sets one, `simulate()`
runs every fight under a harness-only ring event whose only effect is `victoryMode:
'last-team'`, the mode Common Cause and House War use. The team is written to both the
character and the monster: `randomContestant` puts every harness contestant on the boss
team, and `factionOf` reads the monster's team before the character's, so writing only the
character left all four contestants on one faction and every fight ended at once with every
contestant credited a win. `winRates` stays per contestant, and a team win credits every
surviving member, so a side's win rate cannot be rebuilt from `winRates` (summing
overcounts, the best member undercounts). Use `winnersByFight`, each fight's winning labels,
through `sideWinRate(res, labels)`; `sim:bosses` and `sim:rings` do.

The batch runner (`sim:batch`) takes a `team` on each side of a unit and scores the same way:
a side wins when its team wins, including a member that died during the fight
(`balance/units.ts`). Before roadmap 35 the runner omitted `team`, and scoring by surviving
labels would have counted a fallen teammate as a loss.

## Card-level counters

`sim:monster` counts card events by wrapping the card classes' prototype methods inside its
own process. Nothing in the engine is instrumented for this. Prefer that pattern over adding
counters to engine code.

Each monster's counters live in `packages/harness/src/scripts/monster-reports/`. A monster
with its own report (the Unicorn's counts Sticketh stick rate, ward triggers, cleanses,
rattles, and rest completion) registers it in `monster-reports/index.ts`, with an optional
thematic fixture deck. Any other monster gets `signatureCardReport`: how often it played each
card whose permitted types name it.

## One roster

The harness takes its monsters from the engine's `allMonsters` (`SIM_MONSTER_TYPES` in
`simulate.ts`); `sim:winrates` and `sim:monster` read that list, and `parseMonsterType`
accepts any of its class names or creature types. A new monster needs no harness change to
appear in every report. It used to be listed by hand in five places, and a monster missing
from one was silently left out of that report. `harness.test.ts` checks the list matches
`allMonsters` and that every monster can fight.

## Averages hide all-or-nothing cards

A card whose effect either lands in full or not at all can show a healthy average win rate
while each fight turns on one coin flip. For such a card, also split fights by whether the
effect landed. Calibrate the split with a weak version of the same card: fights where it
landed are biased toward fights already going well. [The Gloaming Rest study](../archive/studies/2026-09-gloaming-rest.md)
is the worked example.

The runner does the split (roadmap 36). Give a unit `probes`, for example
`"probes": ["rest-completed"]`. Each probe in `balance/probes.ts` wraps one card method for the
length of the unit and marks the creature the effect touched:

| Probe | Effect it marks |
|---|---|
| `rest-completed` | A Gloaming Rest completed |
| `awed` | Helm of Awe awed the side |
| `rattled` | Dissonant Voice rattled the side |
| `held` | Any hold landed on the side |

The result's `split` gives each side's win, draw, and loss in fights where its probe fired
and in fights where it did not; the two always sum to the side's totals.
`sim-split-report <run>` (`pnpm sim:split-report`) prints them, summed over units that share
their tags (`--by card,v,level` to choose, `--side` for a side other than 0). To track a new
effect, add a probe there, not a one-off script. Hook a card method rather than matching
narration text, which breaks when the wording changes (10b #199).

## Adding a new economy/balance measurement

- Extend `SimResult` **additively** — new optional/present-when-applicable fields only, never
  change or remove an existing one, since `harness.test.ts` and the `sim:*` scripts all read
  it positionally.
- Read the real, engine-credited value (a before/after diff on the actual object field, or
  the `ring.fightResolved` event's own computed data) — never recompute from a constant. The
  entire point of this harness is to catch the engine crediting something other than what the
  constants say it should.
- If you need a contestant's fight-outcome label, use the `ring.fightResolved` participants
  array (see the trap above) — do not read `won`/`lost`/`fled` off a `Contestant` object your
  own code built and passed to `ring.addMonster()`.
- Keep new `sim:*` scripts' `main()` ending in `process.exit(0)` (see above).
- Add a test in `harness.test.ts` with a small `fights` count and a fixed `seed`, asserting
  non-negativity and, where applicable, reproducibility across two same-seed calls.
