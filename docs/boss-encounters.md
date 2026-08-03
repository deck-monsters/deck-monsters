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
`packages/engine/src/helpers/boss-summons.ts` (`summonAllowance`, `recordSummon`,
`addPendingSummon`, `refundPendingSummons`).

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
| **The Gauntlet** | Pulls up to 2 extra bosses into the ring | `last-contestant` (default) | ≥1 player |
| **Blood Feud** | Free-for-all — teams ignored, and bosses turn on each other | `last-contestant` (default) | ≥3 contestants |
| **Common Cause** | Every player joins `ALLIANCE_TEAM`; players only hit bosses | `last-team` | ≥2 players and ≥1 boss |
| **House War** | Players split round-robin across two Sorting Hat houses | `last-team` | ≥3 players **and 0 bosses** |
| **The Reckoning** | Bosses switch to `TARGET_HIGHEST_XP_PLAYER` — they hunt the strongest | `last-contestant` (default) | ≥1 boss, ≥2 players |

`RING_EVENT_CHANCE_PERCENT` is 25.

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
room's state blob. Writing them from a ring event would permanently re-sort a player's monster
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
- Outside ring events, the only things that set a team are the Sorting Hat scroll and boss
  creation; the only things that set a strategy are the targeting scrolls in `items/scrolls/`.

### Team allegiance vs. victory mode (these are orthogonal)

`team` on a contestant controls **targeting allegiance** — who can be chosen as an attack
target. `victoryMode` on a `RingEventDefinition` controls **when the fight ends**. The two
concepts interact but are independent:

| Event | Team targeting | Victory mode |
|---|---|---|
| Common Cause | Players share `ALLIANCE_TEAM`; ignore bosses as targets | `last-team` — fight ends when one faction survives |
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
   `Ring.encounterFreeForAll` is a getter: `this.ringEvent?.freeForAll === true`.

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

## 6. Observability

| Metric | Meaning |
|---|---|
| `dm_boss_spawns_total` | Every boss entering the ring (timer, admin, summon, Gauntlet) |
| `dm_boss_summons_total` | Player-initiated summons only |
| `dm_ring_events_total{event}` | Ring events triggered, labelled by id |

`dm_boss_summons_total` and `dm_ring_events_total` are collected off the ring's own emitter
(`bossSummoned`, `ringEvent`), the same way boss spawns hang off `add` — see
`packages/server/src/metrics/collector.ts` and `ring-event-args.ts`.
