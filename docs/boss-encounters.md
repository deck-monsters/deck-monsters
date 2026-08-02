# Boss Encounters, Summoning, and Ring Events

Everything about NPC bosses: how they are built, when they appear, how players call one in,
and how ring events reshape a fight. Read this before touching `packages/engine/src/ring/`,
`helpers/bosses.ts`, `helpers/targeting-strategies.ts`, or `helpers/boss-summons.ts`.

Related: [`room-scoping.md`](room-scoping.md) (all of this is room-scoped) and
[`engine-concurrency-and-timing.md`](engine-concurrency-and-timing.md) (timers, lanes, and the
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

Boss-specific behaviour is applied in `characters/helpers/random.ts` (`randomCharacter`):

- `monster.targetingStrategy = TARGET_HUMAN_PLAYER_WEAK` — bosses attack players, not bosses.
- `monster.canHold` is wrapped to reject cards with `static noBosses = true`
  (`fight-or-flight`, `flee`, `kalevala`).
- The deck drops weak card types (`Flee`, `Harden`, `Heal`, `Hit`, `Whiskey Shot`) and every
  remaining card is `levelUp(random(0, 6))`'d.
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

`determineBossLevelCap(playerLevels, roll)` with `roll = random(1, 100)`:

| Roll | Cap |
|---|---|
| 1–20 | uncapped — a fully random boss |
| 21–50 | highest player level + 1 |
| 51–100 | floor(average player level) |

Levels come from the ring's player monsters, falling back to the room's living monsters via
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

---

## 3. Player boss summoning

Players get **3 summons per rolling 24 hours, per room**, via `summon a boss`.
Admins keep the separate, unlimited `spawn a boss` (hidden from `COMMAND_CATALOG`).

### Where the quota lives, and why

The ledger is `game.options.bossSummons` (`Record<userId, epochMs[]>`), exposed as
`Game.bossSummons` and manipulated by the pure helpers in
`packages/engine/src/helpers/boss-summons.ts` (`summonAllowance`, `recordSummon`).

**The check is enforced in the engine command handler, not the tRPC router.** The Discord
connector's `dispatchCommand` (`connector-discord/src/slash-commands/helpers.ts`) calls
`game.handleCommand()` directly — it does not go through `activeFlows` or
`runSerializedEngineWork`. A router-side limit would be bypassed from Discord. Putting it in
the handler gives one choke point for every connector, room scoping for free, and no
migration or RLS policy to write.

Two rules follow from that:

- **Check and record must be synchronous, with no `await` between them.** The web path also
  runs inside the per-user engine lane, but the Discord path has no lane at all, so
  atomicity comes from the synchronous run, not from serialization.
- **`Game.bossSummons`'s getter must not write.** Unlike `Game.shop`, it does no
  prune-on-read; pruning happens inside `recordSummon`. A getter that calls `setOptions()`
  broadcasts `stateChange` synchronously, which is exactly the re-entrancy hazard described
  in `engine-concurrency-and-timing.md` §7.

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

| Event | Effect | Eligible when |
|---|---|---|
| **The Gauntlet** | Pulls up to 2 extra bosses into the ring | ≥1 player |
| **Blood Feud** | Free-for-all — teams ignored, and bosses turn on each other | ≥3 contestants |
| **Common Cause** | Every player joins `ALLIANCE_TEAM`; players only hit bosses | ≥2 players and ≥1 boss |
| **House War** | Players split round-robin across two Sorting Hat houses | ≥3 players |
| **The Reckoning** | Bosses switch to `TARGET_HIGHEST_XP_PLAYER` — they hunt the strongest | ≥1 boss, ≥2 players |

`RING_EVENT_CHANCE_PERCENT` is 25.

### The hard rule: overrides go on the `Contestant`, never on the monster

`monster.team` and `monster.targetingStrategy` are `options`-backed and persist into the
room's state blob. Writing them from a ring event would permanently re-sort a player's monster
and fight the Sorting Hat scroll. So `Contestant` carries optional `team` and
`targetingStrategy` fields, and:

- `getTarget()` resolves a team as `contestant.team || monster.team || character.team`.
- `Ring.fight()` uses `playerContestant.targetingStrategy ?? playerContestant.monster.targetingStrategy`.

`clearRing()` wipes contestants after every fight, so the overrides are inherently
per-encounter. There is a test asserting `apply()` leaves the monster untouched — keep it.

### Lifecycle

1. **Roll** — `startFightTimer()`, at the moment the countdown is armed, and **only when
   `this.ringEvent == null`**. That guard is load-bearing: the Gauntlet's `spawnBoss()` calls
   re-enter `startFightTimer()` via `addMonster()`, and without it the roll would recurse.
2. **Spawn** — Gauntlet's extra bosses are added with `deferFightTimer: true`. Without that
   flag the nested `addMonster()` arms a second fight timer that the enclosing
   `startFightTimer()` then orphans, and the same countdown fires two fights.
3. **Announce** — `ring.emit('ringEvent', { ringEvent })` → `announcements/ringEvent.ts`
   publishes a public `announce`. Deliberately *not* a new `EventType`: `announce` already
   renders in the web console and ring feed, already survives a reload (it is not in the
   persister's `EPHEMERAL_TYPES`), and already reaches Discord.
4. **Apply** — `startEncounter()` calls `ringEvent.apply(this.contestants)` against the final
   roster, since contestants may have joined or left during the countdown.
5. **Record** — the event's name rides `ring.fightResolved` → `fight_summaries.ring_event`.
6. **Clear** — `clearRing()` sets `ringEvent = undefined`.

### Determinism

`DECK_MONSTERS_DETERMINISTIC_RING=1` disables both the contestant shuffle and ring-event
rolls. Both engine and server test setups set it, because a 25% chance of the Gauntlet adding
two bosses makes any test that counts contestants flaky. Tests that *want* an event set
`ring.ringEvent` directly. The `ringEvents: false` constructor option is the per-`Ring`
equivalent.

### Adding a new ring event

1. Add a `RingEventDefinition` to `RING_EVENTS`. Keep `apply()` pure over the contestant array.
2. Anything beyond contestant overrides (extra spawns, and so on) belongs as a declarative
   field consumed by `Ring.rollRingEvent()`, not as a side effect inside `apply()`.
3. Never assign `TARGET_ALL_CONTESTANTS` as a monster strategy — it resolves to an *array*.
   `Ring.fight()` guards against it, but the guard is a safety net, not a licence.
4. Add eligibility and apply tests to `ring/ring-events.test.ts`.

Admins can force one with `trigger ring event <id|name>` (hidden from the catalog, like
`spawn a boss`).

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
- Outside ring events, the only things that set a team are the Sorting Hat scroll and boss
  creation; the only things that set a strategy are the targeting scrolls in `items/scrolls/`.

---

## 6. Observability

| Metric | Meaning |
|---|---|
| `dm_boss_spawns_total` | Every boss entering the ring (timer, admin, summon, Gauntlet) |
| `dm_boss_summons_total` | Player-initiated summons only |
| `dm_ring_events_total{event}` | Ring events triggered, labelled by id |

`dm_boss_summons_total` and `dm_ring_events_total` are collected off the ring's own emitter
(`bossSummoned`, `ringEvent`), the same way boss spawns hang off `add` — see
`packages/server/src/metrics/collector.ts` and `ring-event-args.ts`.
