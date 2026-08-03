# Engine Concurrency, Timing, and Prompt Flows

Read this before touching fight pacing, the command pipeline, or anything that
awaits user input. These systems interact in non-obvious ways and have caused
the most persistent production bugs (fights flying by, commands appearing
ignored, multi-step flows crashing). See `docs/roadmap/10b-bugs-fixed.md` #20 for
the incident history.

## 1. Fight pacing (`packages/engine/src/helpers/delay-times.ts`)

All fight pacing flows through one module. There are two kinds of delay:

- **`veryShortDelay` / `shortDelay` / `mediumDelay` / `longDelay`** — pacing
  *between* game beats (card-to-card, round-to-round). Midpoints are 3s / 4.5s /
  6s / 9s, sampled uniformly in [⅔·mid, 4/3·mid], overridable per-kind via
  `DECK_MONSTERS_*_DELAY_MIDPOINT_MS` / `_CAP_MS` env vars.
- **`subEventDelay`** — ~1s pacing between sub-events *within* a single card
  play (roll → hit → damage → death). Used inside `cards/hit.ts`,
  `cards/base.ts`, `creatures/health.ts`.

`DECK_MONSTERS_SKIP_DELAYS=1` zeroes everything (tests/harness). It is checked
at **call time**, not module load time, so test setup files can set it late.

**Invariant**: the main fight loop in `ring/index.ts` (`doAction`) must pace
card-to-card transitions with `veryShortDelay(round)` and round transitions
with `shortDelay(round)`. A past regression used `subEventDelay` between card
plays, which made whole fights scroll past in seconds. If you add a new
continuation path to `doAction` (there are several: played, invalid card, play
error, end-of-deck), give it the same pacing treatment as its siblings — in
skip mode use `queueMicrotask`/resolved promise, otherwise a real timer.

Note: the fight is a promise/timer chain, **not** awaited by anything in the
server. `Ring.fightTimer` fires `fight()` from a `setTimeout` completely
outside the server's serialization lanes (below). Fights interleave with
command handling by design; card plays mutate only fight-local state plus the
monsters in the ring.

## 2. Server command pipeline (`packages/server/src/trpc/router.ts`)

Three coordination mechanisms exist. Know which one you are touching:

1. **`activeFlows` (Set, key `roomId:userId`)** — one interactive console flow
   per user per room. Added before dispatch, removed in `.finally()`. A second
   `command` call while set returns `ok:false` + the pending prompt so the UI
   can re-surface it. `cancelFlow` force-clears it.

2. **Per-user engine lane** — the `command` mutation runs its action through
   `roomManager.runSerializedEngineWork(`${roomId}:${userId}`, …)` and is
   **fire-and-forget** (the HTTP request returns immediately; output arrives
   over the ringFeed WebSocket). The lane key MUST include the userId: an
   interactive flow legitimately holds its lane for minutes while waiting on
   `sendPrompt` answers. Keying by room alone starves every other member's
   commands (this was a real production bug — "the game ignores my commands").
   Harness helpers mirror this via `createRoomCommandRunner(roomId, userId, …)`;
   use `createRoomWideCommandRunner` only when you explicitly need room-wide
   serialization (workshop-style mutations).

3. **Per-room workshop lane + same-user guards** — non-interactive card-management
   mutations (`equipCards`, `unequipCard`, `moveCard`, `reorderCards`, presets, …)
   run through `runSerializedMutation(roomId, userId, …)`, which:
   - serializes per-room via `runSerializedEngineWork(roomId, …)` (short,
     prompt-free work shared across members);
   - rejects with `PRECONDITION_FAILED` if the caller has an `activeFlows`
     entry (workshop must not interleave with the caller's console flow);
   - acquires `activePromptFreeMutations` (`roomId:userId`, ownership token)
     synchronously before any `await` and releases in `.finally()` — a second
     workshop call from the same user fails fast instead of queueing behind
     itself in the room lane.
   The `command` mutation checks `activePromptFreeMutations` before taking
   `activeFlows`, so a slow workshop HTTP call blocks the same user's console
   dispatch without affecting other members. Silent channels
   (`createSilentChannel`) throw on any `question` — workshop paths must stay
   non-interactive.

**Cross-user policy (#62)**: per-user console lanes mean two members can mutate
the same `Game` concurrently. That is intentional for interactive flows — each
user's prompts only block themselves. Workshop mutations that touch shared room
state (ring roster, shop, etc.) retain the room-wide lane so those classes stay
serialized. Ring fights also run outside server lanes (timer chain in
`Ring.fight()`). Full room-wide serialization for every mutation would reintroduce
the starvation bug from #20; the current split is a deliberate trade-off documented
here. If a future mutation class needs stronger ordering, add it to the room lane
(or a dedicated guard) rather than moving console commands back to a room-wide
lane.

**Rules of thumb**: anything that may call `channel({ question })` belongs in
the per-user lane and must be fire-and-forget on web (HTTP must not wait).
Discord may await the action for interaction lifetime, but still uses the same
`${roomId}:${userId}` lane + connector-local flow lock (`command-flow.ts`);
prompt collectors must resolve outside that lane. Anything awaited by HTTP must
be prompt-free and short. Never hold any lane across a user-input wait that
other requests in the same lane depend on.

## 3. Prompt lifecycle (`packages/engine/src/events/room-event-bus.ts`)

`sendPrompt(userId, question, choices)` publishes a `prompt.request` event and
returns a promise that settles one of three ways:

- **answered** — `respondToPrompt(requestId, answer, callerId)` resolves it
  with the user's text. (tRPC `respondToPrompt` — deliberately NOT serialized
  in any engine lane, or answers could never reach a flow that holds a lane.)
- **timeout** — 120s default; the promise **rejects** with
  `Error('Prompt timed out …')`. Expected when users walk away; the router
  suppresses it from error logs.
- **cancelled** — `cancelPrompt`/`cancelAllUserPrompts` **resolve** (not
  reject) with the exported sentinel `PROMPT_CANCELLED` (`'__cancelled__'`).
  Resolving lets the in-flight action chain settle and release `activeFlows`.

**The sentinel must never reach game code as an answer.** The router's channel
wrapper converts it to a thrown `PromptCancelledError` (exported from the
engine) immediately after `sendPrompt` resolves, and the fire-and-forget catch
suppresses that error like a timeout. `items/helpers/choose.ts` has a
defensive check too. If you build a new connector channel that awaits
`sendPrompt` (directly or via `ConnectorAdapter`), replicate the translation.
`createTestChannel` in `packages/engine/src/testing/index.ts` mirrors the same
translation for harness/integration tests.

`ConnectorAdapter` delivers `prompt.request` events to registered private
channels. On channel rejection or a non-string resolution it must call
`cancelPrompt` so `sendPrompt` settles promptly (via the cancel sentinel) rather
than hanging until the 120s timeout. Pass an optional `onChannelError` callback
to surface connector failures without unhandled rejections — the adapter never
treats `undefined` or other non-strings as user answers.

## 4. Multi-step selection parsing (`packages/engine/src/items/helpers/choose.ts`)

`chooseItems` (and `chooseCards` wrapping it) is the backbone of equip, store
buy, and similar flows. Answers pass through `helpers/get-array.ts` (quoted
lists, JSON arrays, comma/whitespace splitting) and are then resolved against
the displayed catalog as **numeric indices or case-insensitive item names**.
Invalid entries are announced and skipped — never abort the whole flow on a
typo; an empty selection falls through to the caller, which re-prompts
(equip) or proceeds harmlessly (store). Historical bug: index-only parsing
plus `Promise.reject(channel({announce}))` — note that idiom rejects with a
*Promise* as the reason, which logs as `[object Promise]`; don't add new uses.

## 5. Reconnect replay (`ringFeed`)

Clients resume the event stream with a cursor. Three layers cooperate, and the
failure mode when they disagree is silent (the user sees an empty pane), so be
careful here.

- **Client** (`ConsolePane.tsx` / `RingPane.tsx`): each pane keeps
  `latestTrackedEventIdRef` updated on every event **except** `handshake` and
  `heartbeat` (those are transport frames, not stream positions), and on
  `onError` copies it into the subscription input so the reconnect carries a
  cursor. DB-backed history (`consoleHistory` / `ringHistory`) is fetched once
  on mount and merged under a `historyApplied` guard — it covers page loads,
  not reconnects.
- **In-memory buffer** (`RoomEventBus.getEventsSince`): a 200-event ring buffer
  per room. Returns a `status` — `found`, `ahead`, `evicted`, or `cold` — and
  `truncated: true` for anything memory cannot resolve.
- **Durable fallback** (`RoomManager.getEventsSinceForRingFeed`): resolves the
  cursor to a `room_events` row, then returns everything after it; if the anchor
  row is missing it falls back to a lexicographic `event_id` comparison inside a
  24h-then-7d window.

**Invariants**:
1. `cold` (empty buffer after a restart or idle eviction) MUST still hit durable
   storage — this was the #16/#17 bug — but MUST NOT raise a `system.gap`
   warning when storage is also empty, or every deploy shows a false alarm.
   `evicted` is the opposite: an empty result there means real events were lost.
2. Any id a client might echo back as a cursor MUST start with `${epochMs}-`.
   Both resolution layers key off that leading timestamp (`parseTs`, and
   Postgres text ordering on `event_id`). Synthetic frames — `handshake`,
   `heartbeat`, the gap marker — follow this shape even though they are never
   persisted, so a stray cursor degrades to a time-based match instead of
   becoming permanently unresolvable.
3. Events with no replay value belong in the persister's `EPHEMERAL_TYPES`
   (`ring.state`, `handshake`, `system.gap`, `quick_actions`). Anything added
   there is invisible to the DB fallback — fine for state-sync signals, wrong
   for anything the console renders as history.

## 6. Quick actions (`packages/server/src/quick-actions.ts`)

`buildQuickActions(game, userId)` produces the console's chip strip after each
command settles. Two rules: every `command` string must be real parser syntax
(chips dispatch verbatim — keep them aligned with `COMMAND_CATALOG`), and the
builder must never throw, since it runs inside the command pipeline. Suggestions
are emitted on both success and failure paths and are deliberately not
persisted.

## 7. The global semaphore and room-scoped guarding (read before adding ANY `game.on(...)` listener)

All `Game`/creature/card/item/ring events ride one **process-wide**
`EventEmitter` (`helpers/semaphore.ts`'s `globalSemaphore`). `Game` is
constructed with `super(options, globalSemaphore)`, so **any** `this.on(...)`
registered inside `Game` (directly, or via `BaseClass.on`) receives **every**
matching event from **every** loaded room and creature in the process, not
just this one. `Ring`/`Monster`/`Character` instances default to their own
private `EventEmitter` instead, so this only bites listeners registered
directly on `Game`.

**Every listener `Game.initializeEvents()` registers on a `creature.*` or
`stateChange` event MUST be wrapped with `createRoomScopedEventGuard`**
(exported from `announcements/index.ts`) before doing anything with its
arguments. This was a real, shipped bug: the reward-granting listeners
(`creature.win`/`loss`/`permaDeath`/`fled` → `handleWinner`/etc.) were
unwrapped for a long time, so a single fight's outcome granted its reward
once *per currently-loaded room on the server* — XP, coins, and drawn cards
all multiplied by room count. `stateChange` had the same gap (see below).
`announcements/index.ts`'s own listeners were already correctly guarded; if
you add a new `Game`-level listener, follow that pattern, not the
now-fixed-but-easy-to-regress shortcut.

**The guard itself must stay side-effect-free.** `createRoomScopedEventGuard`
decides ownership by checking whether the emitted arguments are (or contain)
one of this game's own characters/monsters/cards/items. It reads a raw
`optionsStore` value for each of those (`rawArray()` in
`announcements/index.ts`), deliberately **not** the public getters
(`character.deck`, `monster.cards`, etc.). Several of those getters lazily
initialize themselves on first read by calling `setOptions()` internally
(e.g. `BaseCharacter.cards` builds a starter deck the first time it's
touched) — and `setOptions()` broadcasts `stateChange` synchronously. Reading
one of those getters from inside the guard, while already inside another
`stateChange` broadcast triggered by that same lazy init, re-enters the
still-uninitialized getter and recurses without bound until the stack
overflows. This is exactly the failure mode a fresh character's first card
draw hits if the guard is ever changed back to reading live getters — keep
new ownership checks reading `optionsStore` directly.

- **Fight timer**: `startFightTimer()` clears and restarts the 60s countdown
  on every ring add/remove — the fight fires 60s after the *last* membership
  change (legacy behavior, intentional). `nextFightAt` / `nextBossSpawnAt` are
  published via `ring.state` events for client countdowns.
- **State saves**: `Game.scheduleSave()` debounces 30s off `stateChange`
  events, now correctly room-scoped (see above) so one room's activity can't
  keep resetting another's debounce indefinitely. Any direct mutation of an
  `options`-backed array (e.g. `contestants.splice`, `items.splice`) instead
  of going through its setter skips `setOptions()` and so never emits
  `stateChange` — always build a new array and assign through the setter
  (`ring.contestants = updated`, `creature.items = remaining`, …) if the
  mutation needs to survive a restart. `RoomManager.unloadRoom` also flushes
  via `game.saveState()` before eviction, and now refuses to unload a room
  whose `ring.inEncounter` is true — a fight in progress keeps the room in
  the active cache until the next sweep.
- **Ring events**: `Ring.rollRingEvent()` fires from inside `startFightTimer()` when the
  countdown arms, and **only when `this.ringEvent == null`**. That guard is load-bearing —
  the Gauntlet event calls `spawnBoss()`, which re-enters `startFightTimer()` via
  `addMonster()`, so without it the roll recurses. Those spawns pass
  `addMonster({ deferFightTimer: true })` for the same reason: a nested `startFightTimer()`
  arms a second timer that the enclosing call then orphans, and one countdown fires two
  fights. The event is applied in `startEncounter()` (against the final roster) and cleared in
  `clearRing()`. `DECK_MONSTERS_DETERMINISTIC_RING=1` disables the roll along with the
  contestant shuffle; both test setups set it. See
  [`boss-encounters.md`](boss-encounters.md).
- **The boss summon quota is enforced in the engine command handler, not the router**, and its
  check-then-record must stay **synchronous with no `await` in between**. The web path runs
  commands inside the per-user lane. Discord slash/DM dispatch (`dispatchCommand` /
  `dispatchFreeTextCommand` in `connector-discord`) now also uses connector-local
  `discordActiveFlows` + `runSerializedEngineWork(`${roomId}:${userId}`)` via
  `command-flow.ts` — same per-user keying as web, with the Discord request allowed to
  await the action. Prompt answers still arrive outside that lane (DM/button collectors,
  ConnectorAdapter `respondToPrompt`). Free-text prompts use a filtered DM message
  collector; `PROMPT_CANCELLED` becomes `PromptCancelledError` before game code.
  Anything that must hold for every connector still belongs in the engine handler;
  do not reintroduce room-wide Discord lanes (starves other members — see #20).
- **Timers must be disposed AND tracked**: `Game.dispose()` → `Ring.dispose()`
  + per-creature `disposeTimers()`. Any new `setTimeout`/`setInterval` on a
  long-lived object needs both a stored handle *and* a dispose path — a timer
  that exists only as an anonymous closure (no handle kept anywhere) cannot
  be cancelled later no matter how thorough `dispose()` is. `Ring`'s
  `bossDespawnTimers` Set is the pattern to copy for anything similar.
