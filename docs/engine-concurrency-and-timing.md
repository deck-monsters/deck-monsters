# Engine Concurrency, Timing, and Prompt Flows

Read this before touching fight pacing, the command pipeline, or anything that
awaits user input. These systems interact in non-obvious ways and have caused
the most persistent production bugs (fights flying by, commands appearing
ignored, multi-step flows crashing). See `docs/roadmap/10-bug-fixes.md` #20 for
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

3. **Per-room workshop lane** — non-interactive card-management mutations
   (`equipCards`, `unequipCard`, `moveCard`, `reorderCards`, presets, …) run
   through `runSerializedMutation(roomId, userId, …)`, which serializes
   per-room AND first rejects with `PRECONDITION_FAILED` if the caller has an
   `activeFlows` entry. Rationale: these are awaited HTTP calls that must never
   (a) hang behind a minutes-long interactive flow, nor (b) interleave with the
   caller's own in-flight flow mutating the same deck. Silent channels
   (`createSilentChannel`) throw on any `question` — workshop paths must stay
   non-interactive.

**Rules of thumb**: anything that may call `channel({ question })` belongs in
the per-user lane and must be fire-and-forget. Anything awaited by HTTP must
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

## 5. Other timing machinery worth knowing

- **Fight timer**: `startFightTimer()` clears and restarts the 60s countdown
  on every ring add/remove — the fight fires 60s after the *last* membership
  change (legacy behavior, intentional). `nextFightAt` / `nextBossSpawnAt` are
  published via `ring.state` events for client countdowns.
- **State saves**: `Game.scheduleSave()` debounces 30s off `stateChange`
  events; `RoomManager.unloadRoom` flushes via `game.saveState()`. Direct
  mutation of `options`-backed arrays (e.g. `contestants.splice`) does not
  emit `stateChange` — use `setOptions` if persistence matters.
- **Global semaphore**: all `Game`/creature events ride one process-wide
  emitter (`helpers/semaphore.ts`). `announcements/index.ts` gates listeners
  by ownership (`createRoomScopedEventGuard`) so multi-room servers don't
  cross-announce. Ring listeners are instance-scoped and skip the guard.
- **Timers must be disposed**: `Game.dispose()` → `Ring.dispose()` +
  per-creature `disposeTimers()`. Any new `setTimeout`/`setInterval` on a
  long-lived object needs a dispose path or unloaded rooms keep firing.
