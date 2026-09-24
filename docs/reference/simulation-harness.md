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
- Both functions force `DECK_MONSTERS_DETERMINISTIC_RING` and `DECK_MONSTERS_DETERMINISTIC_DRAW`
  for the duration of the run (restored in a `finally`), so contestant order and ambiguous
  round-cap endings don't add extra randomness on top of the seeded RNG.
- `set-env.ts` also forces `DECK_MONSTERS_SKIP_DELAYS`, so fights run at full speed.

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
| `sim:winrates` | All 5×5 monster-type matchups at a fixed level (200 fights each, 25 pairs); flags win rates outside 35–65%. | ~90s — this is real work, not a hang; don't re-flag it as one if it takes a while to return. |
| `sim:cardpower` | Average damage dealt per card type; top/bottom 10%. | ~20s |
| `sim:levelscaling` | Same matchup at levels 1/5/10/15/20, to spot scaling drift. | ~20s |
| `sim:economy` | `coinsByOutcome`/`xpPerMonster` distributions, plus the new-player 1/5/20-fight checkpoint table. | ~10s |

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
