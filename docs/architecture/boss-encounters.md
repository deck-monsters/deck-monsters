---
type: Architecture
title: Boss Encounters, Summoning, and Ring Events
description: Boss creation, summoning, teams, targeting, and ring-event rules.
status: stable
audience: internal
tags: [bosses, summoning, ring]
---
# Boss Encounters, Summoning, and Ring Events

Read before: touching `packages/engine/src/ring/`, `helpers/bosses.ts`,
`helpers/targeting-strategies.ts`, `helpers/boss-summons.ts`, boss persistence, or ring
events.

This document covers how NPC bosses are built, when they appear, how players call one in,
and how ring events reshape a fight.

Related: [rooms and identity](rooms-and-identity.md) (all of this is room-scoped) and
[engine concurrency and timing](engine-concurrency-and-timing.md) (timers, lanes, and the
global semaphore).

---

## 1. What a boss is

`randomContestant()` in `packages/engine/src/helpers/bosses.ts` is the only factory. It builds
a throwaway `Beastmaster` and returns a `Contestant`:

```ts
const BOSS_USER_ID = 'boss';
const BOSS_TEAM = 'Boss';
// -> { monster, character, userId: 'boss', isBoss: true }
```

> **The generated owner is never shown to players.** `randomCharacter` gives a boss a
> plausible-looking beastmaster name, and the announcement layer used to credit it — so
> every boss arrival named a player who does not exist, and a timer-spawned boss claimed a
> player had sent it in when nobody had. Boss announcements now credit the house instead
> (`RING_PATRON` in `constants/lore.ts`, rendered `👑 The Editor`), and the ring roster
> reports `owner: null` for a boss. See `docs/roadmap/10b-bugs-fixed.md` #102. The
> generated character itself is unchanged — it still carries the boss's stats and team.

Boss-specific behaviour is applied in `characters/helpers/random.ts` (`randomCharacter`):

- `monster.targetingStrategy` is a **temperament** drawn from `BOSS_PERSONALITIES`
  (`helpers/boss-personalities.ts`): a bully (the weakest challenger), a glory-seeker (the
  strongest), a grudge-holder (whoever hit it last), or a wild card (random). The arrival
  line says which, so players can plan around it. Every boss used to share
  `TARGET_HUMAN_PLAYER_WEAK` and act alike (owner, September 2026). All four strategies
  respect teams, and bosses share the Boss team, so a boss still only goes for challengers
  while any are standing.
- `monster.canHold` is wrapped to reject cards with `static noBosses = true`
  (`fight-or-flight`, `flee`, `kalevala`).
- Bosses press the attack rather than run or stall, but still hold some basic cards (owner,
  roadmap 33). The original engine's weak list (Flee, Harden, Heal, Hit, Whiskey Shot) is
  filtered from the starting deck and the first refill, and a last refill tops the deck up,
  which leaves basics in about 17% of boss hand slots. On top of that a boss never holds
  Flee, and a hand holds at most `BOSS_MAX_HEALS` (1) plain heal, a heal any monster can hold
  (`isPlainHeal`, `pickBossHand`); monster-specific heals such as Gloaming Rest are uncapped.
  Every remaining card is `levelUp(random(0, 6))`'d.
- Level comes from XP: either fully random, or capped via `{ xp: random(0, getXpCapForLevel(cap)) }`.

### `userId: 'boss'` is a sentinel, and it is not a uuid

This is the single most common source of bugs in this area. Boss contestants flow into
`ring.fightResolved` participants (`ownerUserId: 'boss'`) and into private `ring.win` /
`ring.loss` events (`targetUserId: 'boss'`). Several DB columns that receive those values are
`uuid` with a foreign key to `public.profiles`, so **every write path must filter first**.

Use `profileUuidOrNull` / `isProfileUuid` from `packages/server/src/db/profile-id.ts`. It is
already applied in `fight-summary-writer.ts`, `fight-stats-subscriber.ts`, and
`event-persister.ts`. Two shipped bugs came from missing it — see
`docs/roadmap/10b-bugs-fixed.md` (#27, #28).

Bosses are also excluded from ring persistence: `Game.persistState()` filters
`c => !c.isBoss` when snapshotting `ringContestantRefs`, so bosses vanish on restart.

---

## 2. Spawn cadence

All constants live at the top of `packages/engine/src/ring/index.ts`. There is no cron, env
var, or DB config — timing is per-`Ring` instance, in-process.

| Constant | Value | Meaning |
|---|---|---|
| `BOSS_SPAWN_MIN/MAX_DELAY_MS` | 20–35 min | Normal spawn window |
| `BOSS_SPAWN_BEGINNER_MIN/MAX_DELAY_MS` | 12–22 min | Used when the ring is empty or every player monster is ≤ level 2 |
| `BOSS_WARNING_DELAY_MS` | 2 min | Gap between the "a boss will enter the ring" warning and the spawn |
| `BOSS_DESPAWN_DELAY_MS` | 10 min | Despawn timer, armed on a 50/50 coin flip |
| `MAX_BOSSES` | 5 | Per ring |

`startBossTimer()` is a self-rescheduling two-stage chain: outer delay → `bossWillSpawn`
warning → 2 min → `spawnBoss()` → re-arm. **The warning and the spawn must agree**: the
ring's capacity is evaluated once, when the warning is due, and the same decision gates the
spawn. Deciding twice let a fight that ended inside the warning window produce an unannounced
boss.

Because `nextBossSpawnAt` is a plain instance field it is *not* persisted; a restart or an
idle-room eviction restarts the cadence from a fresh random delay. No bosses spawn while a
room is unloaded.

### Level scaling

`determineBossLevelCap(playerLevels, roll, bossLevels)` with `roll = random(1, 100)`. The
boss's XP is then drawn from 0 up to that level's cap, so it is often lower.

| Roll | Cap |
|---|---|
| 1–35 | highest human level + 1 |
| 36–100 | floor(average human level) |

Both bands are then held to a **level budget**: the bosses' combined levels may not exceed
the humans' combined levels + 1 (`BOSS_LEVEL_BUDGET_SLACK`), less what bosses already in the
ring use. The owner's rule of thumb (September 2026): three level 3 humans (9) against bosses
of 4, 3, and 2 is a fair fight; `sim:bosses` measured it at 44%.

There used to be a third band: 20% of spawns ignored the players entirely, which is how a
level 5 boss met a level 1 player. It was removed with the budget (roadmap 31).

Levels come from the ring's human monsters, falling back to the room's living monsters via
the `getRoomMonsterLevels` provider injected by `Game`. Timing stays ring-focused, so an
empty ring keeps beginner pacing.

### Despawn

`removeBoss()` despawns when **no player monster is left in the ring** — not merely when the
boss is alone. Two or more bosses alone never trigger a fight either (see the quorum rule
below), so the older "last contestant" check let an idle ring silently fill to `MAX_BOSSES`
and stay clogged.

### Quorum

`startFightTimer()` counts **all bosses together as one monster**:

```ts
numberOfMonstersInRing = playerContestants.length + (hasBoss ? 1 : 0)
```

So 1 player + 4 bosses starts a fight; 3 bosses and no players never does.

### Boss count: one per human

`sim:bosses` showed that outnumbering decides these fights, not levels: one human against one
boss of its level wins about half the time, against two bosses 0–3%, and a level 3 against
two level 1 bosses still only 12%. So (owner, September 2026):

- **One boss per human.** `canAcceptBoss()` refuses with `boss_quota` once `bossCount`
  reaches `bossAllowance()`: the humans in the ring, or 1 for an empty ring (a boss may wait
  for a challenger). Summons are refused before the charge is spent ("Bring a friend into
  the ring, then summon another").
- **An ambush.** A timer spawn has a 10% chance (`BOSS_AMBUSH_CHANCE_PERCENT`), rolled once
  when the warning is due so the warning and the spawn agree, of one boss beyond that. It
  arrives as a lesser minion at a third of its HP and says so; the ring sets that HP again
  as the fight starts, since passive healing ticks through the countdown
  (`Contestant.minion`). Still harsh for a lone human
  (about 6%); it is a rare scare.
- **The Gauntlet** is the designed exception: its extra bosses ignore the quota, but still
  come out of the level budget, so the more of them there are, the weaker each is.
- **A human leaving** is the only way bosses come to outnumber humans, so `removeMonster`
  calls `dismissExtraBosses()`. It keeps the oldest full-strength bosses up to one per human
  (plus an armed Gauntlet's extras) and at most one ambush minion (`Contestant.minion`);
  the newest of the rest slip away, and a summoned one refunds its charge. The two are
  counted apart: counting the ambush slot for any boss left one human against two
  full-strength bosses after the other human withdrew.

---

## 3. Player boss summoning

Players get **3 summons per rolling 24 hours, per room**, via `summon a boss`.
Admins keep the separate, unlimited `spawn a boss` (hidden from `COMMAND_CATALOG`).

### Where the quota lives, and why

The ledger is `game.options.bossSummons` (`Record<userId, epochMs[]>`), exposed as
`Game.bossSummons` and manipulated by the pure helpers in
`packages/engine/src/helpers/boss-summons.ts` (`summonAllowance`, `recordSummon`,
`addPendingSummon`, `refundPendingSummons`).

**The check is enforced in the engine command handler, not the tRPC router.** Discord
slash/DM dispatch also reaches the same handler (via `dispatchCommand` /
`dispatchFreeTextCommand`). A router-only limit would still be incomplete for any
connector that talks to the engine directly. Putting it in the handler gives one choke
point for every connector, room scoping for free, and no migration or RLS policy to write.

Two rules follow from that:

- **Check and record must be synchronous, with no `await` between them.** Web and Discord
  both serialize interactive commands per `roomId:userId`, but atomicity of the quota
  check still comes from the synchronous run inside the handler, not from the lane alone.
- **`Game.bossSummons`'s getter must not write.** Unlike `Game.shop`, it does no
  prune-on-read; pruning happens inside `recordSummon`. A getter that calls `setOptions()`
  broadcasts `stateChange` synchronously, which is exactly the re-entrancy hazard described
  in `engine-concurrency-and-timing.md` §7.

### Live pre-fight refund: last player withdraws or boss despawns

When the last player leaves the ring during the countdown, any player-summoned boss that was
waiting for that fight would never reach `fightBegins` — leaving the summoner's charge
permanently spent for nothing. The engine handles this in two layers:

**Contestant tagging**: `summonBossAction` passes `summonedByUserId` and `summonedAt` to
`ring.spawnBoss()`, which stores them on the ephemeral `Contestant` object (not in
`bossSummons` — purely in-memory). Timer- and admin-spawned bosses do not carry these fields.

**Proactive removal**: `Ring.removeMonster()` checks whether removing a player would leave
zero player contestants. If so, every player-summoned boss (identified by `summonedByUserId`)
is immediately removed from the ring and the `Ring.onSummonedBossRemoved(userId, timestamp)`
callback fires. `Game`'s constructor wires this callback to `_refundSingleBossSummon`, which
removes the matching timestamp from both `bossSummons` and `bossSummonsPending` and calls
`persistState()` immediately — so the refund is on disk before any subsequent restart.

**Despawn timer path**: If a summoned boss's own despawn timer fires while no player is in
the ring, `Ring.removeBoss()` detects `summonedByUserId` and fires the same callback.

Duplicate-refund guard: `_refundSingleBossSummon` uses the exact timestamp as the key. Once
removed, a second call for the same timestamp is a no-op (timestamp not found → no write, no
`persistState`). The rolling quota and room scoping are unaffected.

### The restart-gap fix: pending summons

There is a 30–60 s window between `summon a boss` recording the charge and the fight
starting (the boss is added to the ring, which re-arms the countdown). If the process
restarts inside that window the ephemeral boss vanishes, but the charge was already written
to `bossSummons`. Without a remedy, a successful summon followed by an immediate restart
permanently consumes a daily charge for nothing.

**Fix**: a second ledger `game.bossSummonsPending` (`Record<userId, epochMs[]>`) mirrors only
the timestamps recorded since the last fight started. The flow is:

1. `summon a boss` records the timestamp in both `bossSummons` (the main quota ledger, via
   `recordSummon`) and `bossSummonsPending` (via `addPendingSummon`), atomically in the same
   synchronous block.
2. When a fight actually begins (`ring.fight` / `fightBegins` event), `initializeEvents`
   clears `bossSummonsPending` by writing directly to `optionsStore` (no `stateChange`
   emission) and immediately calls `persistState()`, which flushes via `setImmediate` (one
   event loop tick — not the 30 s debounce). This ensures the cleared pending state reaches
   disk before any subsequent restart can see it. Without the immediate flush, a restart in
   the 30 s debounce window would load the old state (pending still set) and incorrectly
   refund a charge that was already used.
3. `Game`'s constructor (before `initializeEvents`) calls `_refundPendingBossSummons()`,
   which calls `refundPendingSummons` to remove from `bossSummons` any timestamps still in
   `bossSummonsPending`, then clears the pending ledger. A restart in step 1–2's window
   therefore gives the charge back automatically.

The two mechanisms are complementary: the live path covers withdrawals and despawns that
happen while the server is running; the restart path covers process crashes between summon
and `fightBegins`. Together they ensure no player is charged for a boss that never fought.

Bosses are not made persistent by this design — they remain ephemeral. Only the quota entry
is affected. The schema is backward-compatible: `bossSummonsPending` lives in `Game.options`
alongside `bossSummons` and the Zod schema's `passthrough()` accepts it without migration.

Ordinary pre-fight player actions (adding another monster to the ring, summoning an item)
cannot grant duplicate summons because neither touches `bossSummonsPending`.

### Command behaviour

`summon a boss` refuses, **without spending a charge**, when:

| Condition | Message |
|---|---|
| No monster of yours in the ring | "You need a monster in the ring before you can summon a boss…" |
| `ring.inEncounter` | "A fight is already underway…" |
| `MAX_BOSSES` reached | "There are already as many bosses in the ring as it can hold." |
| Ring at `MAX_MONSTERS` | "The ring is full!…" |

Requiring a monster in the ring is both better UX (the fight actually starts) and what keeps
an idle ring from accumulating summoned bosses.

Refusals use `announceAndThrow(channel, message)` — a bare `Promise.reject(new Error(...))`
is swallowed by the router's `.catch`, leaving the player staring at a console that appears
to have ignored them.

Note that summoning calls `addMonster()`, which restarts the 60 s countdown — the documented
"fight fires 60 s after the last membership change" behaviour.

### Surfaces

- `COMMAND_CATALOG` entry (category `ring`) buys web autocomplete, the help panel, and the
  `help` command.
- `RoomManager.getRingState(userId, roomId)` returns `bossSummonsRemaining`,
  `bossSummonLimit`, and `bossSummonResetAt`. This is per-user and membership-checked, which
  is why the quota goes here and **not** into the public `ring.state` event.
- `buildQuickActions` offers a "Summon a boss" chip when the player has a monster in the ring,
  no opponent is present, and charges remain.
- Discord: `/summon-boss` (`connector-discord/src/slash-commands/summon-boss.ts`) dispatches
  the same command string, so quota and messaging are shared.

---

## 4. Ring events

A ring event is a random encounter modifier rolled while the fight countdown is arming.
Defined declaratively in `packages/engine/src/ring/ring-events.ts`.

| Event | Effect | Victory mode | Eligible when |
|---|---|---|---|
| **The Gauntlet** | Pulls up to 2 extra bosses into the ring, past the one-per-human quota (still within the level budget) | `last-contestant` (default) | ≥1 player |
| **Blood Feud** | Free-for-all — teams ignored, and bosses turn on each other | `last-contestant` (default) | ≥3 contestants |
| **Common Cause** | Every player joins `ALLIANCE_TEAM`; players only hit bosses | `last-team` | ≥2 players and ≥1 boss |
| **House War** | Players split round-robin across two Sorting Hat houses | `last-team` | ≥3 players **and 0 bosses** |
| **The Reckoning** | Bosses switch to `TARGET_HIGHEST_XP_PLAYER` — they hunt the strongest | `last-contestant` (default) | ≥1 boss, ≥2 players |

`RING_EVENT_CHANCE_PERCENT` is 25. **The pick is by weight among all events**
(`RING_EVENT_RULES.globalWeights`, roadmap 38): if the event picked is not eligible for the
roster, no event fires. It used to pick among the eligible events only, so in a ring with one
human and one boss (only the Gauntlet eligible) every event roll was a Gauntlet: a quarter of
all lone boss fights. Now a lone player meets it at 25% × 30/100 = 7.5% of countdowns, and
bigger rings are barely changed (the full table is in the
[Gauntlet report](../reference/balance-reports/2026-09-29-gauntlet.md)).

### Bosses that outnumber the humans turn on each other

At fight start, if the bosses outnumber the humans (ambush minions count as bosses), every boss
fights for itself (`GAUNTLET_RULES.rivalsWhenOutnumbered`, roadmap 38; `Ring.gauntletRivals`).
Each boss gets its own team, `rival:<its id>`, so boss personalities, which already respect
teams, turn on one another. No Challengers alliance forms. The humans keep their real teams:
two players already on one team stay allies, and teamless players fight for themselves. The
room sees one line before the first turn: "Outnumbered is not outmatched. The bosses turn on
one another."

It is not a free-for-all like Blood Feud: an earlier version was, and it broke up teamed
players, which the owner did not want ("if the players are already allies we don't have to
break that"). `RIVAL_TEAM_PREFIX` and `isRivalTeam` keep these one-boss teams out of the
roster snapshot and the turn line, where they would read as noise.

- **Why:** a lone human won 1 Gauntlet in 25 in production, because three bosses on one team all
  went for the one challenger. Measured on the harness, the rule moves a lone human against the
  Gauntlet from 0/0/1/8% to 25/36/60/71% at beginner and levels 1, 3 and 5; two humans from 1%
  and 14% to 36% and 50% at levels 1 and 3; and an ambush (one boss and one minion) from 15% and
  35% to 59% and 68%. It stays harder than a plain boss fight, as a scare should.
- **Decided once**, from the roster when the fight starts; withdrawals and deaths do not change
  it mid-fight.
- **Skipped for:** a mega boss's fight (its party is a designed pack that keeps the
  Challengers' alliance); Blood Feud and any other `freeForAll` event (already every monster
  for itself); `last-team` events such as Common Cause and House War (their factions are the
  point); and The Reckoning.
- **Not without a human:** a fight with no human has nobody to be outnumbered, and keeps its
  teams (the harness's boss-only team fights rely on this).
- **Teamed players:** two humans on one team win 67% and 83% against the Gauntlet at levels 1
  and 3, against 36% and 50% for two teamless humans. Level 3 is near the top of the band; the
  owner chose to ship it as is (2026-09-30).
- **Considered and dropped:** rivals only when exactly one human is in the fight (does nothing for
  two humans against the Gauntlet), and the Gauntlet's extras arriving as minions (on its own it
  left a beginner at 1%; with rivals it made the Gauntlet no harder than a plain boss fight).

### Victory modes: `last-contestant` vs `last-team`

`RingEventDefinition` carries an optional `victoryMode` field (`'last-contestant' | 'last-team'`).
The default is `last-contestant` — the original semantics: last monster standing wins.

`last-team` is for events where the narrative is about factions rather than individuals:

- Combat ends when all active contestants belong to **one faction**.
- A faction is determined by `contestant.team` (ring-event override first), then
  `monster.team`, then `character.team`, then the contestant's own `userId` (every
  unaffiliated monster is its own faction).
- **Every surviving member** of the winning faction is marked `won: true` — but only when
  the fight actually *decided* a winner (see below). This is the critical difference from
  `last-contestant`, where at most one monster wins.
- An empty active list falls through to the existing draw/clean-sweep logic, which counts
  deaths and uses `fightResolved` correctly.

#### Deciding a winner, and labelling the outcome

A death is not a victory. `fightConcludes` computes `hasDecisiveWinner` before it labels
anything:

- **`last-team`**: exactly one living (non-dead, non-fled) faction remains — or the
  fled-with-zero-deaths path, where every opposing faction fled.
- **`last-contestant`**: someone died *and* exactly one living contestant remains.

Without that, a round-cap fight that ended with survivors on both sides marked **every**
living contestant `won: true`, producing fight-log entries reading "win" with winners on
two opposing teams (bug #74).

The fight-level `outcome` on `ring.fightResolved` follows a deliberate precedence, and only
its final arm depends on decisiveness:

| Condition | `outcome` |
|---|---|
| Any contestant `destroyed` | `permaDeath` |
| Anyone fled **and** (a death occurred or a winner was decided) | `fled` |
| A decisive winner | `win` |
| Otherwise | `draw` |

`permaDeath` leads because a permanent destruction is the most significant fact about the
fight, and it matches `participantOutcome`, which checks `destroyed` first. The `fled` arm
needs its guard so an all-fled/no-death fight stays a `draw` rather than reading as a flee
victory. `isDraw` on the `fightConcludes` emit is derived from this same value, so the
public announcement can never disagree with the fight log.

Per-participant outcomes are independent of the fight label: a dead contestant always
records `loss`, a fled contestant always records `fled`, and survivors record `win` only
when `hasDecisiveWinner` — otherwise `draw`.

Common Cause and House War both use `last-team`. Blood Feud, The Gauntlet, and The Reckoning
do not — in those events the team assignments are either absent or irrelevant to when combat
ends, and individual survival is the right measure.

**Important distinction**: `team` on a contestant controls _targeting allegiance_ (who can be
selected as an attack target); `victoryMode` controls _when the fight ends_. These are
orthogonal: Blood Feud uses `freeForAll` (ignores team for targeting) but keeps
`last-contestant` victory; Common Cause uses team targeting AND `last-team` victory.

### The hard rule: overrides go on the `Contestant`, never on the monster

`monster.team` and `monster.targetingStrategy` are `options`-backed and persist into the
room's saved state. Writing them from a ring event would permanently re-sort a player's monster
and fight the Sorting Hat scroll. So `Contestant` carries optional `team` and
`targetingStrategy` fields, and:

- `getTarget()` resolves a team as `contestant.team || monster.team || character.team`.
- `Ring.fight()` uses `playerContestant.targetingStrategy ?? playerContestant.monster.targetingStrategy`.

`clearRing()` wipes contestants after every fight, so the overrides are inherently
per-encounter. There is a test asserting `apply()` leaves the monster untouched — keep it.

### Lifecycle

1. **Roll** — `rollRingEvent()`, called inside `startFightTimer()` when quorum is met, runs
   in three phases (in order):

   a. **Eligibility re-check** (runs in all modes, including deterministic/test): if an
      event is already armed, check whether it is still eligible for the current roster via
      `ringEvent.eligible(buildRingEventContext(contestants))`. If eligible → return
      immediately, preserving the armed event with no re-roll. If ineligible → clear it
      silently (no public announcement, just a log entry) and fall through. This handles
      mid-countdown roster changes — e.g. a boss joining after House War was rolled makes it
      ineligible.

   b. **Randomness gates**: bail if `ringEventsEnabled` is false,
      `DECK_MONSTERS_DETERMINISTIC_RING` is set, `inEncounter` is true, or the random roll
      does not beat `RING_EVENT_CHANCE_PERCENT`.

   c. **Select**: call `selectRingEvent(buildRingEventContext(contestants))` and activate
      the result via `activateRingEvent()`.

   The eligibility re-check (phase a) is a correctness invariant, not a randomness source,
   which is why it precedes the determinism guard. In test mode, clearing a stale event still
   happens; only phase c (the new roll) is suppressed.

   The Gauntlet's `spawnBoss()` calls re-enter `startFightTimer()` via `addMonster()`. Those
   boss contestants carry `team: 'Boss'` which the Gauntlet's own eligibility check already
   accounts for, so the eligibility re-check short-circuits correctly and no second event is
   rolled.

2. **Activate** — Both natural rolls and the admin `trigger ring event` command call the
   single `Ring.activateRingEvent(ringEvent)` method. It first checks `this.ringEvent`: if one
   is already armed, it returns immediately (log entry, no emission, no boss spawn) so
   activation is idempotent and repeat calls cannot overwrite or re-emit. Otherwise it sets
   `this.ringEvent`, emits `ringEvent`, and spawns any `extraBosses` with
   `deferFightTimer: true`. Using one path prevents natural and admin activations from
   drifting apart.
3. **Spawn** — Gauntlet's extra bosses are added with `deferFightTimer: true`. Without that
   flag the nested `addMonster()` arms a second fight timer that the enclosing
   `startFightTimer()` then orphans, and the same countdown fires two fights.
4. **Announce** — `ring.emit('ringEvent', { ringEvent })` → `announcements/ringEvent.ts`
   publishes a public `announce`. Deliberately *not* a new `EventType`: `announce` already
   renders in the web console and ring feed, already survives a reload (it is not in the
   persister's `EPHEMERAL_TYPES`), and already reaches Discord.
5. **Apply** — `startEncounter()` calls `ringEvent.apply(this.contestants)` against the final
   roster, since contestants may have joined or left during the countdown.
6. **Record** — the event's name rides `ring.fightResolved` → `fight_summaries.ring_event`.
7. **Clear** — `clearRing()` sets `ringEvent = undefined`. `startFightTimer()` also clears
   `ringEvent` when the quorum drops below `MIN_MONSTERS` — see the quorum-drop guard below.

### Quorum-drop guard

Before this fix, a ring event rolled for a valid roster (e.g. 3 players → House War) persisted
on `this.ringEvent` even if all but one player then left before the fight fired. The sole
remaining player, joined later by a different player, would inherit the House War event from a
completely different roster.

`startFightTimer()` now clears `this.ringEvent` whenever quorum is not met. If quorum is
later restored, `startFightTimer()` runs again and `rollRingEvent()` executes the eligibility
re-check (phase a above): an armed event that is still valid for the new roster is preserved;
one that has become ineligible (e.g. a remaining player left and a different event was rolled
for a roster that no longer exists) is cleared. Only if nothing is armed does a fresh roll
occur.

### Admin `trigger ring event`

`trigger ring event <id|name>` (admin-only, hidden from the catalog) calls
`Ring.activateRingEvent()` directly, producing the same announcement, boss spawns (for the
Gauntlet), and metric as a natural roll. Two refusal conditions are enforced, both of which
announce the reason and do not record the event:

- **Encounter in progress** — the event would be applied too late (apply fires in
  `startEncounter()` against the final roster, which has already run). The command responds:
  `"Cannot force a ring event while an encounter is in progress — the event would have no
  effect."`
- **Event already queued** — overwriting would re-run boss-spawn side effects and confuse the
  fight log. The command responds: `"A <EventName> is already queued — the new event was not
  applied."`
- **Roster ineligible** — the requested event's `eligible()` predicate returns false for the
  current contestants (e.g. `trigger ring event house-war` with a boss in the ring). The
  command responds: `"<EventName> cannot be forced right now — the current roster does not
  meet its requirements (need: <event-id>)."` No public announcement is emitted, no boss is
  spawned, no metric is recorded. The refusal message is private to the admin's channel only.

### Determinism

`DECK_MONSTERS_DETERMINISTIC_RING=1` disables both the contestant shuffle and ring-event
rolls. Both engine and server test setups set it, because a 25% chance of the Gauntlet adding
two bosses makes any test that counts contestants flaky. Tests that *want* an event set
`ring.ringEvent` directly. The `ringEvents: false` constructor option is the per-`Ring`
equivalent.

### Adding a new ring event

1. Add a `RingEventDefinition` to `RING_EVENTS`. Keep `apply()` pure over the contestant array.
2. Set `victoryMode: 'last-team'` if the event is fundamentally faction-based. Leave it unset
   (defaults to `last-contestant`) for events where individual survival is the right measure.
3. Anything beyond contestant overrides (extra spawns, and so on) belongs as a declarative
   field consumed by `Ring.activateRingEvent()`, not as a side effect inside `apply()`.
4. Never assign `TARGET_ALL_CONTESTANTS` as a monster strategy — it resolves to an *array*.
   `Ring.fight()` guards against it, but the guard is a safety net, not a licence.
5. Add eligibility, apply, and victoryMode tests to `ring/ring-events.test.ts`.

---

## 5. Teams and targeting

`packages/engine/src/helpers/targeting-strategies.ts` holds 15 strategies. Points worth
knowing:

- `team: false` means "ignore teams entirely" (free-for-all). `team: undefined` means "derive
  it from the contestant".
- `TARGET_ALL_CONTESTANTS` returns an **array**; every other strategy returns one contestant.
- There is a free-for-all fallback: if filtering by team leaves no valid opponent, the
  resolution retries with `team: false`. This is what lets a boss-only harness fight work.
- Wraparound in `TARGET_NEXT_PLAYER` / `TARGET_PREVIOUS_PLAYER` must use the **filtered**
  list's length. Using the raw input length overruns the array in any team fight and returns
  `undefined` — a fixed bug worth not reintroducing.
- Outside ring events, a team is set by the Sorting Hat scroll, cleared by the Hat's "No
  team" choice or the free `leave team` command, set on bosses at creation, and lent to
  teamless humans by the Challengers alliance below. The only things that set a strategy are
  the targeting scrolls in `items/scrolls/` and a boss's temperament.

### How a player joins, leaves, and inherits a team

A contestant's team is its contestant override (ring events, the alliance), else
`monster.team`, else `character.team` (`teamOf`). So a Sorting Hat worn by the character
covers every monster without a team of its own, and a hat worn by one monster covers only
that monster. The hat offers the houses other than the wearer's effective team, and "No
team" only where clearing leaves the wearer teamless: clearing a monster's own team while its
beastmaster has one would only drop it back to that team. `leave team`
(`commands/character.ts`) clears the character and every monster, and is refused while any
of them is in a fight. Every shop keeps one hat, free, restocked on purchase
(`withSortingHat`).

In a normal fight a team changes only **targeting**: teammates, area cards included, go
after everyone else first and fall back to each other when nobody else is left; the last
monster standing still wins alone. Only Common Cause and House War make a team win together
(the table below). Players read this in the handbook's Teams and Bosses section
(`build/player-handbook-content.ts`), which must stay in step with this section.

### Humans unite against bosses, then settle it

Bosses share the Boss team; humans without a team used to treat each other as fair game, so
two humans who had not arranged a team hit each other while the bosses worked together
(`sim:bosses`: two level 1s against L1 + L2 bosses won 1%). Now, at the start of every fight
with a boss in it, `Ring.fight()` puts each human with no team of its own on
`CHALLENGERS_TEAM` (a contestant-level override, like a ring event's). They never target each
other while any boss is still fighting; the moment the last boss is down the override comes
off, a line says the alliance is over, and the humans left finish a normal free-for-all. A
mega boss's minions are the exception (`holdsChallengersAlliance`): the alliance ends when the
mega boss itself falls, and the humans then fight each other and any minions left. The
same two level 1s now win 29% (with boss temperaments), level with a pre-arranged team's
28%.

- A team a player or ring event set is never replaced; Blood Feud keeps its free-for-all.
- No alliance forms when the bosses outnumber the humans: the bosses are rivals then (§4).
- This replaced a forced Common Cause (shared win) whenever two or more bosses met two or
  more teamless humans; the owner chose "unite, then settle" over a shared win. Common Cause
  remains an ordinary ring event.
- The override is removed before `fightConcludes`, so XP counts the humans as each other's
  opponents, as it did before.

### Team allegiance vs. victory mode (these are orthogonal)

`team` on a contestant controls **targeting allegiance** — who can be chosen as an attack
target. `victoryMode` on a `RingEventDefinition` controls **when the fight ends**. The two
concepts interact but are independent:

| Event | Team targeting | Victory mode |
|---|---|---|
| Common Cause | Players share `ALLIANCE_TEAM` and never target each other | `last-team` — fight ends when one faction survives |
| House War | Players split across two named houses (bosses excluded — see §4) | `last-team` — fight ends when one house survives |
| Blood Feud | `freeForAll: true` — teams ignored for targeting | `last-contestant` — last monster standing wins |
| The Gauntlet / The Reckoning / none | Normal team rules | `last-contestant` — last monster standing wins |

### Centralized free-for-all policy (Blood Feud)

Before this fix, Blood Feud's `freeForAll` flag was only applied to the initial target
selection in `Ring.fight()`. Cards that call `getTarget()` internally (Blast, Enthrall,
Fists of Villainy, Fists of Virtue, Pick Pocket, etc.) used their own team filtering, so
team-mates were still excluded from their targeting during a Blood Feud — contrary to the
event's intent.

**Fix — two-layer approach**:

1. **Primary targeting** (`Ring.fight()`): for each card play, `Ring.fight()` checks
   `ringEvent.freeForAll` directly and explicitly passes `team: false` to `getTarget()`.
   This is the per-turn target selection that happens once per card.

2. **Card-level retargeting** (Blast, Enthrall, Fists of Villainy, Fists of Virtue, Pick Pocket,
   etc.): cards that call `getTarget()` internally now pass the ring instance. `getTarget()`
   accepts an optional `ring?: { encounterFreeForAll?: boolean }` parameter; if
   `ring.encounterFreeForAll` is `true`, it forces `team: false` for that call.
   `Ring.encounterFreeForAll` is a getter: `this.ringEvent?.freeForAll === true`. Bosses that
   outnumber the humans do not use it; they get one-boss teams instead (see §4).

Both layers are needed because the primary targeting call in `Ring.fight()` and the secondary
calls inside cards are separate `getTarget()` invocations. Normal team targeting is unaffected
outside a Blood Feud encounter.

### XP calculations and contestant-level team overrides

`calculateXP` in `helpers/experience.ts` determines opponent count by checking whether two
contestants are on the same team. It now prioritizes `contestant.team` (the ring-event
override) over `monster.team` and `character.team`. Without this, Common Cause's team
override was invisible to XP math — players on the same alliance team still counted each
other as opponents.

---

## 6. Boss-only cleanup pacing

When an encounter still has at least two active bosses but no active human contestant, the
remaining boss-versus-boss cleanup runs at **2× speed**. The multiplier is derived from the
live room-scoped roster rather than persisted state, switches as soon as the last human is
defeated or flees, and remains active through the end of that fight even after only one boss
remains. It applies to turn/card boundaries, nested plays, rolls, hits, damage, healing and
death narration; test and harness delay-skip mode remains instantaneous.

---

## 7. Observability

| Metric | Meaning |
|---|---|
| `dm_boss_spawns_total` | Every boss entering the ring (timer, admin, summon, Gauntlet) |
| `dm_boss_summons_total` | Player-initiated summons only |
| `dm_ring_events_total{event}` | Ring events triggered, labelled by id |

`dm_boss_summons_total` and `dm_ring_events_total` are collected off the ring's own emitter
(`bossSummoned`, `ringEvent`), the same way boss spawns hang off `add` — see
`packages/server/src/metrics/collector.ts` and `ring-event-args.ts`.

## 8. The mega boss

A rare, announced boss event (owner, 2026-09-27; built in Pass C,
[32](../archive/roadmap/32-pass-c-mega-boss-and-balance.md)). `ring/mega-boss.ts` holds the rules and
the timer; `Game` owns one `MegaBossEvent` wherever timed bosses run (`ring.spawnBosses`).

- **Schedule.** About once a day per room: the next one is 20–28 hours after the last
  (`MEGA_BOSS_MIN_INTERVAL_MS`..`MAX`). The due time lives in the room's saved state
  (`options.megaBossAt`), so a restart or deploy picks it up instead of rolling a new day. A
  time rolled while the Game is built is saved as soon as the server attaches its store (the
  `stateStore` setter), not at the next unrelated save; a
  restart more than `MEGA_BOSS_LATE_GRACE_MS` (10 minutes) after it was due reschedules. While
  it waits out a running fight the saved time moves to now on each retry, so a restart during
  a long fight still owes it rather than rolling tomorrow. That write is saved at once, not
  on the debounce, which combat keeps resetting. A restart already past its time brings it at
  once without announcing it as a minute away. `Game` starts the event last in its
  constructor, after the narration bridge and the restored ring, so a restart inside the
  announcement window is heard.
- **Announcement.** 30 minutes ahead, then reminders at 10 and 2 minutes. `ring.nextMegaBossAt`
  is set only inside that window and rides `ring.state`, the handshake, and `ringState`; the
  web ring header shows `MEGA BOSS in mm:ss` over the ordinary boss timer. A restart inside
  the window announces again.
- **The hold.** In its last `MEGA_BOSS_HOLD_MS` (2 minutes) no ordinary fight countdown is
  armed (`Ring.holdForMegaBoss`): challengers gathering for it would otherwise fight each other
  and leave the ring empty. The check runs before the countdown is armed, and the 2-minute
  reminder stops one already running, so the ring header never counts down a fight that will
  not happen and no ring event is rolled for it. Its arrival restarts the countdown.
- **Arrival.** Due during a fight, it waits for the fight to end (`MEGA_BOSS_RETRY_MS`). With
  fewer than `MEGA_BOSS_MIN_HUMANS` (2) humans in the ring it is called off with a line of
  scorn and `spawnBoss()` sends a regular boss instead. Otherwise regular bosses waiting in the
  ring step aside (refunding any summon) and `Ring.addMegaBoss` brings the party, flagged
  `Contestant.mega`: exempt from the boss quota and from `dismissExtraBosses`. It has no
  despawn timer, so when the last human withdraws before the fight, `removeMonster` sends the
  whole party away; otherwise a lone newcomer would walk into a fight fitted for a crowd.
  It brings as much of its party as the ring's twelve slots hold (boss first); with no room
  even for the boss it is called off and the fight countdown restarts; party members left out
  are disposed, since nothing else would stop their healing timers. The party joins with its
  countdowns deferred, and the arrival line comes before the one fight countdown it arms
  (each `addMonster` otherwise told every player a fight was starting). An armed ring event is
  cleared when it arrives and none is rolled while its party is in the ring, since Blood Feud
  would turn off the alliance and a Gauntlet would add bosses to a fitted fight.
- **Fitting.** `fitMegaBoss` reads the humans in the ring when it arrives: level two above the
  strongest, minions at the weakest human's level at a third of their HP, and HP a share of
  the humans' combined HP, `0.25 + 0.15 × humans + 0.11 × strongest level`
  (`megaBossHpShare`). The owner chose "humans win about 20%"; `sim:mega` measures 19% over
  two to four humans at levels 1–10. A single share left two level 1s near 3% and three level
  10s near 53%, because more humans and higher levels deal damage faster than HP keeps up.
- **Relics.** A crown of black iron (+2 AC) and a war-horn of the old kings (+2 STR) on a boss
  that is discarded after the fight. The crown goes on `acVariance`, because pre-battle AC
  never reads permanent modifiers (a permanent AC modifier would be narration only); the horn
  is a permanent STR modifier, which STR does read.
- **Reward.** When it falls, every challenger still standing then gets
  `MEGA_BOSS_REWARD_COINS` (25) coins, `MEGA_BOSS_REWARD_XP` (25) monster XP, and a card of
  rare or scarcer rarity (`Game.rewardMegaBossChallenger`), on top of the fight's own rewards.
  Who earned it is decided at its death, because the Challengers then settle it among
  themselves and only one would be left standing at the end; it is paid at `fightConcludes`,
  because monster XP levels a monster at once and a mid-fight level-up changed live combat.
