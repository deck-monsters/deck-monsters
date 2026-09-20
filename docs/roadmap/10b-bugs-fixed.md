# Bug Fixes and Code Quality — Fixed / Archived

**Category**: Bug / Tech Debt
**Status**: Archive. Everything on this page is done and not expected to need revisiting. For what's still open, see [`10-bug-fixes.md`](10-bug-fixes.md).

This document was split off from `10-bug-fixes.md` on 2026-07-31 to keep the active doc focused on remaining work. Items that were only partially done were split: the completed portion is recorded here, and the remaining portion stays in `10-bug-fixes.md`.

## Fixed Bugs

### 15. Fights not being written to fight_summaries — FIXED

Of the four failure paths originally documented, two had already been addressed in a prior hardening pass (per-room write serialization; `profileUuidOrNull` guard for non-UUID owner ids such as Discord snowflakes) and two remained:

1. **Cross-fight pending race (path 4, only half-fixed)** — writes were serialized, but `pendingByRoom` was still *read inside* the queued async write and deleted after it. If fight B's `fightBegins` arrived while fight A's write was queued (slow transaction, retry backoff, boss fights), A picked up B's `startedAt` (wrong duration) and A's post-write cleanup deleted B's pending — so B then wrote with zero duration and a spurious warning. **Fixed**: the pending snapshot is captured and cleared *synchronously* at `ring.fightResolved` delivery time and passed into the queued write, so each fight is permanently paired with its own start.
2. **No retry (path 2, partially addressed)** — failures were logged with a metric but the row was still dropped forever on any transient DB hiccup. **Fixed**: bounded retries with short backoff (default 1s, 5s; injectable for tests). The failure metric and error log now fire only when retries are exhausted — i.e. when a row is actually lost.

Also fixed: the module-level `pendingByRoom` / `fightSummaryWriteQueues` maps were never cleaned when rooms unloaded, growing one entry per room ever seen for the life of the server. The detach function returned by `attachFightSummaryWriter` now clears both.

Verified along the way: the `ring.cardDrop` enrichment chain is sound — `announceCardDrop` publishes with the exact type/scope/payload key the writer matches, and card drops are emitted synchronously during the `fightConcludes` contestant loop, *before* `ring.fightResolved` is published, so the snapshot always contains them.

Covered by 7 new tests in `fight-summary-writer.test.ts` (happy path, UUID guard, the cross-fight race, retry-then-success, retry exhaustion, restart-mid-fight, fightConcludes filtering).

**Residual gap, since closed**: a fight that errored mid-combat used to take `Ring.fight()`'s `.catch` path without publishing `ring.fightResolved`, so cancelled fights never reached history. Fixed on 2026-07-31 — see the cancelled-fight entry below. A server restart mid-fight still loses that fight (out of scope; no in-flight fight state survives a restart today).

**Status**: Fixed.

### 16 & 17. Reconnect replay dropped across restarts / gap not signalled — FIXED

Both bugs had the same root cause, and it was on the **server**, not the client. The web panes were already correct: each tracks the last received event id (skipping `handshake`/`heartbeat` frames) and re-subscribes with it as `lastEventId` on error, and both `system.gap` and DB-backed history queries were already handled in the UI.

`RoomEventBus.getEventsSince()` returned `{ truncated: false }` whenever its in-memory ring buffer was **empty**, with the comment "Fresh room after restart … do not treat as buffer truncation." But an empty buffer is exactly the state after a server restart or an idle-room eviction — the single most common reason a player returns to a stale pane. Because `truncated` was false, `ringFeed`'s durable-storage fallback (`getEventsSinceForRingFeed`) never ran, so the client silently received **nothing** for the entire period it was away, and no gap marker either.

**Fixed** by separating "can memory resolve this cursor?" from "should we warn the user?". `EventsSinceResult` now carries a `status` of `found` / `ahead` / `evicted` / `cold`:

- `cold` (buffer empty after restart/eviction) → `truncated: true`, so the DB replay runs. An empty DB result is *not* reported as a gap — an idle room is why it was evicted, and warning there would fire on every deploy.
- `evicted` (cursor aged out while the room stayed loaded) → DB replay runs, and an empty result **does** emit `system.gap`, because events demonstrably passed through the buffer.

Also hardened: the synthetic frames the router yields but never persists (`handshake`, `heartbeat`, the gap marker) now use the same `${epochMs}-${suffix}` id shape as real events. The old `system-gap-…` / `heartbeat-…` ids put the timestamp in the second segment, so if a client ever echoed one back as its cursor, both the in-memory timestamp parse and the DB's lexicographic `event_id` comparison would fail to resolve it — producing a permanent no-replay-plus-gap-warning loop on every subsequent reconnect.

Covered by tests in `packages/engine/src/events/room-event-bus.test.ts` (status per outcome) and `packages/server/src/trpc/router.test.ts` (all three replay paths end-to-end through the subscription).

**Status**: Fixed.

---

### 18. Quick actions suggestions not emitted after commands — FIXED

The web console's chip strip was fully wired (`quick_actions` → `setQuickActions` → clickable chips that dispatch the command) but the server never emitted the event; only a TODO sat in `router.ts`.

**Fixed**: added `packages/server/src/quick-actions.ts` — a pure, defensively-typed `buildQuickActions(game, userId)` that reads character/monster/ring state and returns up to four `{ label, command }` suggestions ordered by likely next move: spawn (no monsters) → look at the ring (own monster fighting) → send an idle monster → revive a dead one → equip when unequipped cards exist → look at monsters / visit the shop. Commands are drawn from `COMMAND_CATALOG` syntax so every chip dispatches a command the parser actually accepts, and equip/send are only offered for monsters outside the ring (the engine rejects equipping a fighting monster).

Emitted after the command action settles — success *or* failure — so suggestions reflect the state the user is looking at; wrapped in try/catch so a suggestion bug can never break the command pipeline. `quick_actions` was added to the event persister's `EPHEMERAL_TYPES`: suggestions describe one instant, and replaying a stale set would surface chips that no longer apply. 11 unit tests in `quick-actions.test.ts`.

**Status**: Fixed.

---

### 19 (partial). Deck equip flaky with batches — engine-side bugs fixed

Two concrete engine bugs found during that investigation were fixed:

1. **`loadPreset` copy cap (real bug, fixed)** — In `Beastmaster.loadPreset`, per-slot duplicate enforcement used `getItemKey(card) === requestedCard` (raw string from preset). **`equipCards` uses `getItemKey` on both sides** (via `selectedCard`). Presets saved via `savePreset` use `getCardName` (normal casing), but **legacy or edited presets** with different casing meant `selectedCount` stayed **0** for every entry, so **`MAX_CARD_COPIES_IN_HAND` never tripped** — you could exceed the per-card copy limit when loading a preset. **Fixed**: compare `normalize(getItemKey(card))` to `normalize(String(requestedCard))`.
2. **Console interactive equip vs typed `equipCards`** — `equipMonster` + `cardSelection` in `packages/engine/src/monsters/helpers/equip.ts` used strict `cardType` equality; **`equipCards` / `isSameCardName`** are more forgiving. **Aligned**: `cardSelection` resolution now uses `getItemKey` + trimmed lowercase.

**Status**: Fixed (engine-side bugs below; full batch-UX work completed in the #19 entry later in this archive).

---

### 20. Engine timing / command-sync / multi-step command failures — FIXED

Three long-standing complaints traced to root causes and fixed together:

1. **Fights fly by in the live feed** — `Ring.fight()`'s normal card-play path paced card-to-card transitions with `subEventDelay()` (~0.7–1.3s) instead of the configured `veryShortDelay` (2–4s) used by every other fight path. The pacing system in `helpers/delay-times.ts` (deliberately doubled "to make ring fights easier to follow") was never consumed by the main loop. **Fixed**: the played-card path now waits `veryShortDelay(round)` between plays when delays aren't skipped; test/harness mode (`DECK_MONSTERS_SKIP_DELAYS`) is unchanged.

2. **Commands not followed / room appears out of sync** — the tRPC `command` mutation ran interactive actions inside the **room-wide** serialized engine lane. A single user's multi-prompt flow (up to 120s per prompt) held the lane for minutes, silently starving every other member's commands and hanging all awaited workshop mutations in the room. **Fixed**: command actions now serialize per `roomId:userId` lane (same-user ordering is what matters; `activeFlows` already prevents concurrent flows per user). Workshop mutations keep the room lane but now fail fast with `PRECONDITION_FAILED` when the caller has a console flow in progress, instead of hanging and interleaving.

3. **Complex multi-step commands crash/abort** — two compounding bugs: (a) cancelling a flow resolved pending prompts with the literal string `'__cancelled__'`, which no game code recognized, so it was parsed as a card/item selection; (b) `items/helpers/choose.ts` only accepted numeric indices — typing a card *name* produced `Number(name) → NaN` and aborted the entire flow via `Promise.reject(channel(...))` (rejecting with a Promise, so even the log was `[object Promise]`). **Fixed**: the engine exports `PROMPT_CANCELLED` + `PromptCancelledError`; the server channel wrapper translates the sentinel into a clean abort (suppressed in logs like prompt timeouts); `chooseItems` accepts indices **or** case-insensitive item names, skips invalid entries with an announce instead of aborting, and re-prompts via the existing flow when nothing valid was selected.

**Status**: Fixed. The full mental model of how pacing, serialization lanes, `activeFlows`, and the prompt lifecycle interact is documented in [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) — read it before changing any of these systems.

---

### 21. Idle-room sweep can orphan an in-progress fight — FIXED

`RoomManager.sweepIdleRooms` → `unloadRoom` never checked `ring.inEncounter`. `Game.dispose()` clears `fightTimer`/`bossTimer`, but the fight loop itself (`doAction` in `ring/index.ts`) advances via untracked anonymous `setTimeout` chains — so a fight in progress at sweep time kept running to completion against an event bus whose DB subscribers had just been detached: announcements, stats, and the fight summary would all be lost.

**Fixed**: `unloadRoom` now checks `entry.game.ring.inEncounter` first and leaves the room active (no dispose, no cache eviction) when a fight is running, logging that the unload was skipped. Since `unloadRoom`'s only production caller is the 10-minute idle sweep (`packages/server/src/index.ts`), the room simply gets retried on the next sweep — ample time for any fight to finish. Covered by a new test in `room-manager.test.ts`.

**Status**: Fixed.

### 22. Boss despawn timer is never tracked or disposed — FIXED

`Ring.spawnBoss()` arms a 10-minute `setTimeout(removeBoss)` on a 50/50 coin flip, but the handle was never stored, so `Ring.dispose()` couldn't clear it — an orphaned timer would fire against an already-disposed ring after the room unloaded.

**Fixed**: pending despawn timers are tracked in a `bossDespawnTimers` Set on the `Ring` instance, added when scheduled and removed when they fire; `dispose()` now clears all of them alongside `fightTimer`/`bossTimer`. Also hardened the despawn callback with `.catch(() => {})` — `removeBoss` → `removeMonster` rejects if the boss is no longer in the ring (e.g. cleared by an intervening fight), which was an unhandled-rejection risk before. Covered by a new test that forces the despawn branch via retry (not by pinning `Math.random`, which breaks the recursive card-probability retry in `cards/helpers/draw.ts` — see the test's comment for why).

**Status**: Fixed.

### 23. Cross-room stateChange save amplification — FIXED

`Game` passes the process-wide `globalSemaphore` to `BaseClass`, so `this.on('stateChange', …)` in `initializeEvents` heard **every** `stateChange` from **every** room and creature in the process and rescheduled *this* room's 30s save debounce each time. Beyond wasted work, this was a real correctness risk on a busy server: another room's continuous activity could keep resetting a quiet room's debounce indefinitely, delaying its actual flush well past 30s.

**Fixed**: `setOptions()` now passes the mutating instance to the broadcast (`globalSemaphore.emit('stateChange', this)`, previously zero args), and `Game.initializeEvents()` wraps the `stateChange` listener with `createRoomScopedEventGuard` (now exported from `announcements/index.ts`) exactly like every other cross-cutting `creature.*` listener already was — **except it wasn't**, see #25. Covered by a new test proving 25 seconds of another room's activity does not delay this room's own save past its original 30s mark.

Fixing this exposed two further bugs, both fixed in the same pass — see #25 and the reentrancy note below.

**Status**: Fixed.

### 24. Direct mutations bypass the stateChange persistence signal — FIXED

Two spots mutated `options`-backed structures in place instead of via `setOptions`, so no `stateChange` fired from the mutation itself — harmless while #23 made *every* mutation anywhere trigger *every* room's save regardless, but a real "lost/resurrected on restart" risk once #23 scopes saves correctly:

- **`Game.getCharacter`** — `game.characters[id] = character` for a newly created character. **Fixed**: an explicit `game.emit('stateChange')` after the assignment.
- **`Ring.removeMonster`** — `this.contestants.splice(...)` mutated the live array in place; a monster withdrawn from a still-populated ring (not emptying it, so `clearRing()` never ran either) left the last-persisted `ringContestantRefs` unchanged, meaning **the withdrawn monster could be resurrected into the ring on the next restart**. **Fixed**: builds a new array and assigns through the `contestants` setter, matching the pattern `addMonster` already used.
- **Found while auditing the rest of the codebase for the same pattern**: `creatures/items.ts`'s `removeItem` had the identical bug (`self.items.splice(...)` in place, unlike its sibling `addItem` which already went through the setter) — a removed item could similarly reappear after a restart. **Fixed** the same way. A broader sweep of `.splice()`/`.push()` call sites across the engine (`characters/beastmaster.ts`'s equip/move/reorder/preset paths, `items/helpers/transfer.ts`, `items/helpers/use.ts`) found only local-copy patterns (`[...creature.field]` before mutating) — no other instances.

**Status**: Fixed.

### 25. Cross-room reward duplication via unscoped `creature.win`/`loss`/`permaDeath`/`fled` listeners — FIXED (CRITICAL, found while fixing #23)

While wiring the room-scoping guard onto `stateChange` (#23), the same `Game.initializeEvents()` method turned out to already have **four** listeners with the identical unscoped-`globalSemaphore` problem, pre-dating this work and far more severe: `creature.win` → `handleWinner`, `creature.loss` → `handleLoser`, `creature.permaDeath` → `handlePermaDeath`, `creature.fled` → `handleFled`. These were the *only* `creature.*` listeners in the whole engine that skipped the `createRoomScopedEventGuard` wrapping every other cross-cutting listener in `announcements/index.ts` already uses.

**Impact**: `Ring.handleWinner()` calls `contestant.monster.emit('win', {contestant})`, which — via `BaseClass.emit`'s `${eventPrefix}.${event}` broadcast — fires on the single process-wide `globalSemaphore`. Every currently-loaded `Game` instance's `handleWinner` ran against the *same* `contestant` object. On a server with N active rooms, a single fight's outcome in any one room granted its owner's character XP, coins, **and drew and appended N separate cards to their deck** — once per other loaded room, not once. The more concurrent rooms a deployment has, the worse the multiplication. This is likely the single most severe correctness bug found in this whole pass, and it had zero test coverage (no existing test ever constructed two simultaneous `Game` instances and checked a reward outcome).

**Fixed**: wrapped all four listeners (plus `stateChange`) with the same `wrapGameEvent`/`isRoomScopedEvent` guard in `Game.initializeEvents()`. Covered by two new end-to-end tests in `game.test.ts` that construct two rooms, fire a real `monster.emit('win'|'permaDeath', …)`, and assert the reward applied exactly once to the owning room's character.

**Bonus find in the same area**: `Ring.handlePermaDeath()` was missing the `contestant.monster.emit('permaDeath', {contestant})` call that its win/loss/fled siblings all have — a plain omission. Since `Game.handlePermaDeath` only listens for that broadcast, this meant **a permanently destroyed monster granted its owner no reward at all**, not even the ordinary loss amount, let alone the intended double "consolation" XP/coins for a permanent death. **Fixed**: added the missing emit, mirroring the sibling handlers exactly. Covered by a new `ring/index.test.ts` test asserting the emit now happens, plus the `game.test.ts` end-to-end permaDeath-reward test above (which would have failed with zero reward before this fix, and double reward before the #23/#25 guard fix).

**Status**: Fixed.

### Reentrancy hazard exposed by the #23 guard — FIXED

Wiring `createRoomScopedEventGuard` onto `stateChange` (the most frequently-fired event in the engine — it fires on *every* `setOptions()` call, including from inside other objects' constructors) surfaced a latent bug in the guard itself: `ownsDirectly()` checked ownership by reading `character.deck`/`character.monsters`/`character.items`/`monster.cards`/`monster.items` — **live getters**, several of which (`BaseCharacter.cards`/`.deck` specifically) lazily initialize themselves on first read by calling `this.deck = getInitialDeck()`, which itself calls `setOptions()`, which broadcasts another `stateChange` **synchronously, mid-computation**. If the guard's ownership check for *that* re-entrant broadcast reads the *same still-uninitialized* `character.deck` again, it retriggers the lazy init again before the outer call ever finishes — unbounded recursion ending in a stack overflow. This was reachable in production any time a brand-new character's first card draw happened while any `Game` instance's guarded `stateChange` listener was active (i.e. always, once #23 shipped) — caught immediately by the new #25 reward tests, which construct exactly this scenario (a freshly-built character whose deck has never been read).

**Fixed**: `ownsDirectly()` now reads straight from each instance's raw `optionsStore` (`(value as {optionsStore}).optionsStore?.[key]`) instead of the public getters — a pure, side-effect-free lookup that can never re-enter anything, and behaviorally equivalent for matching purposes (an array that's still unset genuinely cannot contain whatever is being checked against it either way). Applied to all five reads in `ownsDirectly` plus `game.characters`'s own (self-limiting, but fixed for consistency).

**Status**: Fixed. This is exactly the kind of side-effecting-getter trap that's easy to reintroduce — see the new doc comment on `rawArray` in `announcements/index.ts` before adding any new ownership checks there.

### Fixed in passing

Unused `or` import in `analytics-queries.ts` (was the only lint warning in the server package).

---

### 26. Card shop is a single process-wide singleton shared by every room — FIXED

`packages/engine/src/items/store/shop.ts`'s `getShop()` was a module-level `throttle()`-wrapped function with a single `currentShop` variable, regenerated once per 8 hours **for the entire process**, not per room. Every room on a multi-room server shared the exact same shop inventory, closing time, and prices — one room buying out an item mutated the shared `shop.items`/`shop.cards`/`shop.backRoom` arrays via `.splice()`/`.push()` in `buy.ts`/`sell.ts`, affecting every other room simultaneously. This directly conflicted with the room-scoping rule in `AGENTS.md` (then `CLAUDE.md`).

**Fixed** per the design decided 2026-07-31:

1. **Per-room shop.** `shop.ts` is now pure — `generateShop(now)` builds a shop and `resolveShop(stored, now)` returns the stored shop while it's still open or generates a fresh one. `Game.shop` (a new getter/`commitShop()` setter on `Game`, mirroring the existing `characters` accessor) resolves and persists the room's own instance; two `Game`s never share state.
2. **Persisted in room state.** `shop` is a `Game` option — round-tripped through `toJSON()`/`restoreGame()` like `characters`/`ringContestantRefs`. (The design doc's original precedent, `Ring.battles`, turned out not to actually be serialized — `Ring` is constructed with no persisted options — so `Game.characters` was the real pattern to copy.) New `items/store/hydrate.ts` rehydrates `items`/`backRoom` via `hydrateItems`, `cards` via `hydrateDeck`, and reconstructs `closingTime` as a `Date` (a raw string would make `closing-time.ts`'s `Number(closingTime)` arithmetic silently produce `NaN`).
3. **Refresh cadence: 6 hours, aligned to 00:00/06:00/12:00/18:00 America/Chicago.** New `items/store/refresh-boundary.ts` computes the next boundary via `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'` (DST-safe at the moment of computation; a boundary whose window a DST transition falls inside can be off by an hour and self-corrects at the next refresh — accepted).
4. **`buy.ts`/`sell.ts`** no longer import a singleton — they take a `host: ShopHost` (`{ shop, commitShop }`, satisfied by `Game`) threaded from `commands/store.ts` → `character.buyItems(channel, game)`/`sellItems(channel, game)`. Purchases/sales build new arrays and call `host.commitShop(...)` instead of `.splice()`/`.push()`-ing the shared arrays in place, then persist automatically via `setOptions`.
5. **Discord `/shop`, `/buy`, `/sell`** were found to be silently broken during this work — none of the three dispatched a command string matching the engine's `BUY_REGEX`/`SELL_REGEX` (`/shop` dispatched `'shop'`, `/buy` dispatched `` `buy ${item}` ``), so every invocation replied "The shop is unavailable right now." Fixed alongside the room-scoping work: all three now dispatch `'visit the shop'` / `'sell to the shop'`; `/buy` and `/sell` dropped their now-meaningless required `item` option since the underlying flow is interactive.

**Read-modify-write race, caught in review of the above.** The first cut of this captured `host.shop` once at the top of `buyItems`/`sellItems` and, after the interactive prompts, committed a mutation built on that snapshot. Because command actions run in per-`roomId:userId` lanes (deliberately — a room-wide lane starves other members, see #20), two players can be in the shop at the same time, and those prompts can be outstanding for minutes. The later commit clobbered the earlier one: purchased stock reappeared, sales vanished, and a shop that had rotated past its `closingTime` mid-flow was overwritten with the expired one. **Fixed**: both flows now re-read `host.shop` at commit time and apply their change to the *current* shop. `buyItems` additionally verifies each chosen item is still present before charging for it — anything that sold out (or was swept away by a rotation) is announced and dropped from the bill, and affordability is rechecked against the final total. Covered by two new `buy.test.ts` tests using a `shop` getter that returns different snapshots across reads.

Covered by `refresh-boundary.test.ts` (CST/CDT/DST-transition boundaries), a rewritten `shop.test.ts` (pure-function semantics replacing the old throttle-timing tests), `buy.test.ts`/`sell.test.ts` (shop mutation via `commitShop`, the commit-time re-read, and the sold-out path — none of which was covered before), and `game.test.ts` (shop round-trip through `restoreGame`, and two `Game`s getting independent shops).

**Status**: Fixed.

---

### 19. Deck equip flaky with batches (workshop + console) — FIXED

The engine-side root causes (preset copy-limit bug, `equip.ts` name-matching mismatch) were fixed first — see the entry above. The remaining UX/batch-API work is now also done:

1. **Workshop batch + React Query.** `unequipMany`/`moveMany` tRPC procedures were added, mirroring `unequipCard`/`moveCard` but looping the engine calls **inside a single `runSerializedMutation`** and publishing one aggregated result instead of N. `WorkshopView.tsx`'s `handleBatchMove` now calls one of these once per batch instead of looping `unequipCard`/`moveCard`, so `useDeckWorkshop`'s `onSuccess` invalidation fires once, not N times — no more mid-batch refetch/flicker.

   **Partial-failure handling, caught in review.** A batch is not atomic — the engine has no transaction to roll back to — so the first cut, which let an engine error propagate out of the loop, left the already-processed cards mutated while the procedure threw. The client's cache only invalidates `onSuccess`, so the user got an error message next to inventory that had silently changed underneath them. **Fixed**: both procedures now catch per-card failures, finish the rest of the batch, and return `failures: [{ cardName, reason }]` alongside the aggregated count, so the events still publish and the client still invalidates. A batch where *nothing* succeeded still throws `BAD_REQUEST`, since no state changed and the user should see a plain error. `WorkshopView` appends the skipped card names to its status message. Covered by two new `router.test.ts` tests (partial failure, total failure).
2. **`getArray` parsing.** No card or item name in the game currently contains an apostrophe or embedded quote (checked every `cardType`/`itemType`), so this was a latent risk, not a live bug. Added regression tests (`get-array.test.ts`) locking in the current behavior: single- and double-quoted lists and JSON arrays all handle an apostrophe-containing name correctly; the unquoted comma-separated fallback does **not** (truncates at the apostrophe, since it treats `'` the same as `"` when stripping quote characters) — documented as a known limitation, with the `equip … with [...]` catalog entry now noting JSON array form for exotic names.
3. **Mixed-case duplicate preset keys** — already covered by an existing test (`beastmaster.test.ts`: "loadPreset enforces max copies per card when preset strings differ in case from cardType"), no new test needed.

**Status**: Fixed.

---

### Cleanup items found alongside #19/#26 — FIXED

Five smaller observations from the #19/#26 investigation, all addressed on 2026-07-31:

- **`equip.ts` fire-and-forget announces.** The typed-selection (`cardSelection`) reduce in `monsters/helpers/equip.ts` now collects rejection messages into an array during the (still-synchronous) reduce, then `await`s one combined `channel({ announce })` before calling `addCard(...)` — deterministic ordering, one message instead of N unawaited ones.
- **`Promise.reject(channel({ announce }))` idiom.** This rejects with a *Promise* as the reason, which logs as `[object Promise]`. Promoted the existing `chooseItems`-adjacent `announceAndThrow` (previously local to `characters/beastmaster.ts`) to `helpers/announce-and-throw.ts` and replaced every remaining call site across the engine — `items/store/buy.ts`, `items/store/sell.ts`, `items/helpers/transfer.ts`, `items/helpers/use.ts`, `items/base.ts`, `creatures/items.ts`, `monsters/helpers/equip.ts`, `game.ts` (all its "I can find no X" look-up guards), and `characters/base.ts`/`characters/beastmaster.ts` (all their "you don't have any monsters to…" preconditions) — roughly 30 sites in total, more than the handful originally spotted.
- **`fight()` error path drops history.** `Ring.fight()`'s `.catch` now publishes a terminal `ring.fightResolved` event with `outcome: 'cancelled'`, `participants: []`, `deaths: 0`, and the round reached, before clearing the ring — so `FightSummaryWriter`'s pending `ring.fight` start (published when the fight began) resolves instead of leaking, and a cancelled fight now appears in the fight log. `FightStatsSubscriber` already no-ops on empty `participants`, so no change needed there. Both renderers needed a `'cancelled'` branch: web's `fight-display.ts`, and — caught in review — `analytics-queries.ts`'s `fightLine()`, whose final `else` treats anything that isn't `draw`/`fled` as a win, so a participant-less cancelled fight rendered in the catch-up feed as "Unknown defeated Unknown in N round(s)". Covered by a new `ring/index.test.ts` test that forces the catch path and asserts the event.
- **`activeFlows` rejection message.** Both the `command` mutation's "flow already in progress" response and `runSerializedMutation`'s `PRECONDITION_FAILED` now check `eventBus.getPendingPromptForUser(...)`: with a pending prompt, the message stays "answer the current prompt first"; without one (command queued but not yet prompting), it now reads "Still processing your previous command — try again in a moment." Covered by new `router.test.ts` tests for both branches.
- **Test-tooling gotcha, not a product bug** (documented, not "fixed" — nothing to change in product code): mixing a static top-level import and a dynamic `await import()` of the *same* module within one `tsx`-transformed mocha run can silently produce two separate module instances (confirmed for `helpers/semaphore.ts` — its module body evaluated twice, yielding two different `globalSemaphore` `EventEmitter`s). A test that relies on `someDynamicallyImportedInstance.emit(...)` reaching a statically-imported listener can fail with the event simply vanishing. Prefer static imports for classes whose own `BaseClass.emit()` needs to reach engine-wide listeners in a test. Not reachable in the real compiled build — only ever an artifact of the test transform.

**Status**: Fixed (four of five; the fifth is a documented test-tooling caveat, not a code change).

### Doc and tooling drift fixed alongside the above

- **`pnpm typecheck` did not exist.** `AGENTS.md` (then `CLAUDE.md`) documented it as a development command, but no package defined a `typecheck` script, so the command failed outright and CI's type-checking had to be reproduced by hand as per-package `tsc --noEmit` invocations. Added a `typecheck` script to all five packages plus a root `turbo run typecheck` (with `dependsOn: ["^build"]`, since the non-engine packages type-check against `engine/dist`).
- **`README.md`'s engine example** called `player.buyItems()` with no arguments; the per-room shop work made `channel` and the `ShopHost` required, so a JavaScript consumer copying it would dereference `host.shop` on `undefined`. Updated to `player.buyItems(privateChannel, game)`.
- **Player handbook said the merchant rotates every 8 hours**, which was the old throttle period — it is 6 now, and per-room. Fixed in `packages/engine/src/build/player-handbook-content.ts` (shared by in-game `look at player handbook` and root `PLAYER_HANDBOOK.md`) and regenerated.

---

### 27. Boss participants abort every leaderboard write for the fight — FIXED (found while building boss summoning)

`packages/server/src/fight-stats-subscriber.ts`'s `handleFightResolved` wrote each
`ring.fightResolved` participant's `ownerUserId` straight into `room_player_stats.user_id`
(`uuid`, FK → `profiles`). Boss contestants carry the sentinel `userId: 'boss'`
(`engine/src/helpers/bosses.ts`), so the insert threw. Because the participants were processed
in a sequential `for … await` loop and the whole function was only `.catch(log)`-ed at the
subscription site, **the first boss row aborted every remaining participant's stats** — and
since `Ring.addMonster` shuffles contestants, the boss's position was random, so a boss in
slot 0 dropped the entire fight. The net effect: the room leaderboard silently ignored every
fight a boss took part in, which is most of them in a quiet room. `fight-summary-writer.ts`
already defended against the same sentinel via a local `profileUuidOrNull`, which is why fight
summaries looked fine while the leaderboard drifted.

**Fixed**: the uuid guard moved to a shared `packages/server/src/db/profile-id.ts`
(`profileUuidOrNull` / `isProfileUuid` / `UUID_HEX_RE`) and is now applied by all three
subscribers. Participants without a profile owner are skipped (a disposable boss belongs on
no leaderboard), and each participant's writes are wrapped in their own try/catch so one bad
row can never cost anybody else their stats. `handleXpCoinsOnly` got the same guard. Covered
by `fight-stats-subscriber.test.ts`, whose Db double rejects non-uuid values the way Postgres
does and asserts a boss in slot 0 no longer costs the players behind it.

**Status**: Fixed.

---

### 28. Boss win/loss events silently failed to persist — FIXED

`event-persister.ts` wrote `targetUserId: event.targetUserId ?? null` into
`room_events.target_user_id` (`uuid`). Private boss `ring.win` / `ring.loss` events are
published with `targetUserId: 'boss'` (`ring/index.ts`), so each one threw and was dropped
with an error log. Less damaging than #27 — the write queue's `.catch` kept subsequent writes
going, and the lost events were boss-private ones nobody reads — but it produced a steady
trickle of error noise on every boss fight. **Fixed** with the same shared
`profileUuidOrNull` guard.

**Status**: Fixed.

---

### 29. `TARGET_PREVIOUS_PLAYER` returns `undefined` in team fights — FIXED

`helpers/targeting-strategies.ts` wrapped its previous-index lookup with
`contestants.length` — the *unfiltered* input — instead of `allContestants.length`, the
team-filtered list it was actually indexing into. `TARGET_NEXT_PLAYER` had always used the
filtered length correctly. Any fight where teams removed a contestant from the candidate list
made the filtered list shorter, so the wraparound indexed past the end and the strategy
returned `undefined`, which `Ring.fight()` immediately dereferenced. Latent until now (only
the Sorting Hat scroll ever assigned a team), and load-bearing the moment ring events started
assigning teams. **Fixed**, with a regression test.

**Status**: Fixed.

---

### 30. An idle ring could clog with bosses forever — FIXED

`Ring.removeBoss()` only despawned a boss when `contestants.length === 1`. Two or more bosses
alone therefore never despawned — and never fought either, because `startFightTimer()` counts
all bosses collectively as one monster for the two-monster quorum. So a room left alone could
accumulate bosses up to `MAX_BOSSES` and sit there permanently, with the ring showing a crowd
and nothing ever happening. **Fixed**: `removeBoss` now despawns whenever no *player* monster
is left in the ring. Covered by two new tests (despawns with bosses only; does not despawn
while a player is present).

**Status**: Fixed.

---

### 31. Bosses could spawn with no warning — FIXED

`Ring.startBossTimer()` gated the two-minute `bossWillSpawn` warning on
`!inEncounter && bossCount < MAX_BOSSES`, but the inner timer that actually spawned re-checked
only `inEncounter`. The condition was therefore evaluated twice, two minutes apart: a fight
that ended inside the warning window produced a boss nobody had been warned about. **Fixed**:
capacity is evaluated once, when the warning is due, and the same decision gates the spawn.
The check itself moved into a reusable `Ring.canAcceptBoss()`, which the summon command also
uses to refuse without spending a charge. Covered by a regression test.

**Status**: Fixed.

---

### 32. Multi-party fights lost winner and loser attribution — FIXED

`Ring.fightConcludes()` only populated `winnerMonsterId` / `loserMonsterId` (and their name
and owner fields) when `contestants.length === 2`. Every fight with three or more
contestants — already possible with multiple bosses, and now routine with ring events — wrote
a `fight_summaries` row and a `ring.fightResolved` payload with no winner or loser at all.
**Fixed**: attribution is derived from the outcome flags rather than the contestant count,
and stays conservative — an identity is only claimed when exactly one contestant holds it, so
genuinely ambiguous fights are still left blank rather than guessed at.

**Status**: Fixed.

---

### 33. Small cleanups alongside the above

- **Dead branch in `Ring.addMonster`**: `if (this.contestants.length > MAX_MONSTERS)` sat
  inside a block already guarded by `< MAX_MONSTERS`, so it was unreachable. Removed.
- **`calculateXP` crash guard**: `helpers/experience.ts` read `opponents[0].monster.givenName`
  without checking `opponents.length`. Unreachable today (fights need two contestants) but a
  one-line guard now.
- **Unhandled `TARGET_ALL_CONTESTANTS` in `Ring.fight()`**: `getTarget()` returns a
  `Contestant[]` for that strategy while every other returns a single contestant, and the
  fight loop cast unconditionally. Harmless while only scrolls assigned strategies; now that
  ring events assign them programmatically, the loop handles the array case and logs +
  skips a turn rather than dereferencing `undefined`.
- **Admin `spawn a boss` was invisible to the player**: it rejected with a bare
  `Promise.reject(new Error(...))`, which the router's `.catch` swallows, so a non-admin got
  no feedback at all. Switched to `announceAndThrow`, the pattern the rest of the codebase
  already uses.

**Status**: Fixed.

---

---

### 34. Common Cause and House War fights kept going after one faction survived — FIXED

`Ring.fight()`'s doAction loop used a uniform `active.length <= 1` condition to decide when
combat was over. In events like Common Cause (all players vs one boss) or House War (two
player factions), the "last contestant standing" criterion is wrong: combat should end once
all remaining active contestants belong to one faction, even if several of them survive.

**Fixed** with an explicit `victoryMode` field on `RingEventDefinition` (`'last-contestant'
| 'last-team'`, default `last-contestant`). Common Cause and House War are marked
`last-team`. `Ring.fight()` now calls `isLastTeamVictory(activeContestants)` — which checks
`ringEvent.victoryMode === 'last-team'` and then checks that all active contestants map to
the same faction via `factionOf()` — and resolves the fight when it returns `true`. Every
surviving faction member is marked `won: true` in `fightResolved` participants, so the fight
log and leaderboard both reflect team victories correctly.

Covered by new tests in `ring/index.test.ts` (last-team ends combat when one faction
survives; all survivors marked won) and `ring/ring-events.test.ts` (victoryMode values per
event).

**Status**: Fixed.

---

### 35. Blood Feud's free-for-all did not apply to cards that call getTarget internally — FIXED

The `freeForAll` flag set on Blood Feud's `RingEventDefinition` was only consumed by
`Ring.fight()` when selecting the initial proposed target. Cards that call `getTarget()`
internally — Blast, Enthrall, Fists of Villainy, Fists of Virtue, Pick Pocket — used their
own team filtering and still excluded team-mates, so Blood Feud's "all enemies, no allies"
intent was only partially enforced.

**Fixed** centrally: `getTarget()` in `helpers/targeting-strategies.ts` now accepts an
optional `ring?: { encounterFreeForAll?: boolean }`. If `ring.encounterFreeForAll` is `true`,
`getTarget` forces `team: false` before any further resolution, making free-for-all apply to
every target selection in the encounter without modifying each card. The five affected cards
now pass the ring instance through. `Ring.encounterFreeForAll` is a getter:
`this.ringEvent?.freeForAll === true`. Normal team targeting is unaffected outside Blood Feud.

Covered by new tests in `ring/index.test.ts` (encounterFreeForAll reflects ringEvent).

**Status**: Fixed.

---

### 36. Admin `trigger ring event` diverged from natural activation — FIXED

The admin `trigger ring event <id>` command set `ring.ringEvent` directly and called
`startFightTimer()`, while the natural path (inside `rollRingEvent`) additionally emitted the
`ringEvent` announcement, spawned the Gauntlet's extra bosses, and let the enclosing timer
arm exactly once. The two paths could drift independently as new ring events were added.

**Fixed** by centralizing activation in `Ring.activateRingEvent(ringEvent: RingEventDefinition)`:
sets `this.ringEvent`, emits `ringEvent` (consumed by `announcements/ringEvent.ts` and the
metrics collector), and spawns any `extraBosses` with `deferFightTimer: true`. Both
`rollRingEvent()` and the admin command now call this method exclusively. The admin command
also refuses when a fight is already in progress (returning an error announce) and does not
record an unapplied event.

Covered by new tests in `ring/index.test.ts` (activateRingEvent sets ringEvent, emits once,
spawns extraBosses for the Gauntlet; non-boss event emits once, no extra spawns; refuses
during an encounter).

**Status**: Fixed.

---

### 37. Ring event persisted past a quorum drop, contaminating a later roster — FIXED

A ring event rolled for a valid multi-player roster (e.g. 3 players → House War) was never
cleared when players subsequently left before the fight fired. The remaining solo player,
joined later by a stranger, would inherit the House War event from a completely different
group.

**Fixed**: `startFightTimer()` now clears `this.ringEvent = undefined` in both the
"quorum gone" branch (ring totally empty) and the "below quorum but not empty" branch (ring
has at least one monster but not enough for a fight). If quorum is later restored,
`startFightTimer()` re-runs and `rollRingEvent()` rolls a fresh event for whoever is actually
in the ring. The event is preserved when the countdown is immediately re-armed with a valid
roster (the `if (this.ringEvent)` guard in `rollRingEvent` prevents overwriting a still-valid
event in the same arm).

Covered by new tests in `ring/index.test.ts` (ringEvent cleared when player leaves and
quorum drops; preserved when quorum immediately re-arms after a membership change).

**Status**: Fixed.

---

### 38. XP team calculations ignored contestant-level ring-event overrides — FIXED

`calculateXP` in `helpers/experience.ts` counted opponents by comparing `monster.team` and
`character.team`. Ring events like Common Cause assign teams at the `contestant.team` level
(the override field on `Contestant`, which is intentionally ephemeral — see the hard rule in
`docs/boss-encounters.md §4`). `monster.team` and `character.team` are never written by a
ring event. So XP math counted team-mates as opponents during Common Cause fights, inflating
XP rewards.

**Fixed**: `calculateXP` now resolves a contestant's team as `contestant.team ||
monster.team || character.team`, prioritizing the ring-event override. Covered by new tests
in `helpers/experience.test.ts` that distinguish same-team allies (via contestant override)
from opponents.

**Status**: Fixed.

---

### 39. Boss summon charge consumed but boss lost on process restart — FIXED

`summon a boss` atomically checks the quota and records the charge in `game.bossSummons`,
then calls `ring.addMonster()`, which re-arms the 60 s fight countdown. If the process
restarted in that 30–60 s window the ephemeral boss vanished (bosses are never serialized)
while the charge remained in the persisted `bossSummons` ledger — a permanent net loss of
one daily charge.

**Fixed** with a minimal pending/finalized mechanism: a second ledger `bossSummonsPending`
is written alongside `bossSummons` in the same synchronous block. When the fight actually
begins (`ring.fight` / `fightBegins` via the event bus), `bossSummonsPending` is cleared and
`persistState()` is called immediately — not on the 30 s debounce. `persistState()` then
dispatches to the registered storage backend: the production `stateStore.save()` is invoked
synchronously inside `persistState()` itself, while the legacy `stateSaveFunc` callback is
scheduled one event-loop tick later via `setImmediate`; either way the cleared state reaches
disk well before the next debounce window. `Game`'s constructor calls
`_refundPendingBossSummons()` before `initializeEvents`, which uses `refundPendingSummons`
(a new pure helper in `helpers/boss-summons.ts`) to strip the pending timestamps from
`bossSummons` and clear the pending ledger. A restart in the 30–60 s window therefore gives
the charge back.

**Durability detail (Grok follow-up)**: the original implementation used `setOptions()` to
clear `bossSummonsPending`, which scheduled a 30 s debounced save. A restart in that 30 s
window could load the still-pending state and incorrectly refund a charge that was already
used. Fixed by writing directly to `optionsStore` (no `stateChange` emission) and calling
`persistState()` immediately on `fightBegins`. The `persistState()` call is unconditional on
the storage backend: `stateStore.save()` fires synchronously on the call stack; `stateSaveFunc`
fires after one `setImmediate` tick — either is orders of magnitude faster than the 30 s debounce.

The schema is backward-compatible (`bossSummonsPending` lives in `Game.options`, and the Zod
schema's `passthrough()` accepts it without migration). Bosses remain ephemeral — only the
quota entry is affected. Ordinary pre-fight player actions cannot accidentally grant duplicate
summons because they do not touch `bossSummonsPending`.

Covered by new tests in `helpers/boss-summons.test.ts` (addPendingSummon, refundPendingSummons
pure-helper behavior) and `game.test.ts`:
- `stateSaveFunc` path (legacy/test): pending cleared after `fightBegins`; save fires after one
  `setImmediate` tick (verified by yielding with a second `setImmediate`); restored game retains charge.
- `stateStore.save` path (production): pending cleared synchronously inside `persistState()` on
  `fightBegins`; `stateStore.save()` is invoked on the call stack without a `setImmediate` yield
  (verified immediately after `eventBus.publish()`); restored game retains charge.
- Backward-compat: no `bossSummonsPending` field → charge is preserved, nothing refunded.
- Refund on restore: pending present → charge is refunded.

**Status**: Fixed.

---

### 40. `doAction` infinite recursion in last-team mode with ≥2 same-faction survivors — FIXED

In `ring/index.ts`, the combined condition at the top of `doAction` was:

```typescript
if (activeContestants.length <= 1 || isLastTeamVictory(globalActive)) {
    ...
    } else {
        activeContestants = globalActive;
        next(); // ← recursive call to doAction
    }
}
```

When `isLastTeamVictory(globalActive)` was true AND the batch had ≥2 survivors (all same
faction), the nested condition `activeContestants.length === 1 && !isLastTeamVictory(...)` was
always false, so the `else` branch called `next()`, which called `doAction` again with the
same state — infinite Promise-chain recursion. The recursion eventually overflowed the call
stack, which `ring.fight()`'s `.catch()` silently swallowed by calling `clearRing()` instead
of `fightConcludes()`. No contestant ever received `won = true`.

**Fixed** by separating the two cases:

```typescript
if (isLastTeamVictory(globalActive)) {
    resolve(undefined); // terminate immediately — no recursion
    return;
}
if (activeContestants.length <= 1) {
    // normal batch-rebuild logic (unchanged)
}
```

Covered by a new regression test in `ring/index.test.ts` (`fight() resolves without
recursion: allied survivors both get won=true`) that sets up 3 contestants (2 allied, 1 dead
enemy), runs `fight()`, and verifies both survivors have `won === true` — impossible if the
stack overflow took the `.catch()` path.

**Status**: Fixed.

---

### 41. Admin `trigger ring event` could overwrite an already-armed event — FIXED

`ring.activateRingEvent()` had no guard against repeat activation. An admin calling
`trigger ring event <id>` while a different event was already queued would overwrite it and
re-run its side effects (boss spawns, announcements, metrics). Natural rolls were safe because
`rollRingEvent()` bails on `if (this.ringEvent)`, but the admin command path bypassed that.

**Fixed**: `activateRingEvent()` now returns immediately (with a log entry) if `this.ringEvent`
is already set. The command handler in `commands/monster.ts` additionally checks `ring.ringEvent`
before calling `activateRingEvent()` and surfaces a user-facing refusal:
`"A <EventName> is already queued — the new event was not applied."`.

Covered by a new test in `ring/index.test.ts` that arms one event, attempts to arm a second,
and verifies the first is unchanged and the `ringEvent` emission count remains 1.

**Status**: Fixed.

---

### 42. Discord `/summon-boss` expected refusals swallowed by generic error handler — FIXED

`announceAndThrow` called `channel({ announce })` to send the refusal message, then threw a
plain `Error`. In the Discord connector, this propagated through `dispatchCommand` to
`DiscordBot.handleSlashCommand`'s catch block, which always replaced the error with
`"Something went wrong. Please try again."` — hiding the actual reason (quota exhausted, no
monster in ring, fight active, boss/ring cap). On the web console path the message was visible
(the `channel()` call fired before the throw and posted to the event bus), but the Discord path
had a second problem: `channel({ announce })` sends a DM, which is silently discarded if the
player has DMs blocked — so both the DM and the ephemeral interaction became useless.

**Fixed** with a new `CommandRefusalError` class (`engine/src/helpers/command-refusal-error.ts`)
and a corresponding export from the engine. `announceAndThrow` now throws `CommandRefusalError`
instead of plain `Error`. `DiscordBot.handleSlashCommand` catches `CommandRefusalError` and
edits the deferred ephemeral interaction with `err.message` — the exact refusal text — rather
than the generic fallback. Unexpected infrastructure errors still fall through to the generic
message and are logged. The router's fire-and-forget `.catch()` also suppresses `CommandRefusalError`
from server-side error logs (the message was already delivered to the web console via the event
bus before the throw). The fix is shared: every slash command that uses `dispatchCommand` (or
whose action throws `CommandRefusalError`) benefits automatically.

Covered by tests in `engine/src/helpers/announce-and-throw.test.ts` (direct unit test: channel
receives the message, `CommandRefusalError` is thrown — not plain `Error` — and carries the exact
text) and `connector-discord/src/__tests__/bot.test.ts` (4 integration-level tests): exact message
shown without logging on `CommandRefusalError`; generic message plus log on unexpected error; correct
`reply` vs `editReply` path depending on deferred state; blocked-DM scenario where `announceAndThrow`
is called through a channel that silently resolves — interaction always shows the exact refusal text,
and the detection uses the `isCommandRefusal` sentinel so instanceof boundary mismatches are handled.

**Status**: Fixed.

---

### 43. `getEventsSinceForRingFeed` returns `limitReached: true` when the replay contains exactly `maxTotal` events and no more exist — FIXED

The pagination loop in `RoomManager.getEventsSinceForRingFeed` returned `limitReached: true`
whenever the accumulated event count hit `maxTotal` AND the last page was full (`page.length ===
pageSize`). A full page meant "the DB returned as many rows as we asked for", not "there are more
rows after this". If the room had exactly `maxTotal` events (e.g. exactly 2000) the last full
page was also the last page in the DB — but the loop returned `limitReached: true` and the
client displayed a spurious "replay truncated" gap marker.

**Fixed** by probing for one additional row after hitting the cap. When `events.length >= maxTotal`
and the last page was full, `_fetchRingFeedPage` is called once more with `limit: 1` anchored
at the last event's id. If the probe returns 0 rows, `limitReached: false` (no more events);
if it returns 1 row, `limitReached: true` (rows beyond the cap exist). The probe row is never
included in the output. All other guarantees are unchanged: membership validation, public/private
visibility filtering, cursor ordering, and the `maxTotal` output cap.

Covered by 2 new tests in `room-manager.test.ts`: "exactly at cap → false" verifies the probe
fires and returns false when the DB has nothing after the last page; "cap+1 → true" verifies
the probe finds the extra row and returns true without including it in the output.

**Status**: Fixed.

---

### 44. Discord connector tests required `DATABASE_URL` during module collection — FIXED

`auth/connector-users.ts` imported the server's default database singleton at module evaluation
time to provide a default function argument. Importing `DiscordBot` therefore evaluated
`server/db/index.ts` before any connector test ran, even though the connector injects its own
database. In environments without server configuration, Mocha failed during collection with
`DATABASE_URL environment variable is required`.

**Fixed** by resolving the server singleton lazily only for callers that omit a database and by
passing the connector's injected database through both message and slash-command paths. A
subprocess regression test imports `DiscordBot` with `DATABASE_URL` explicitly absent.

**Status**: Fixed.

---

### 45. House War was eligible with bosses present — FIXED

`House War`'s eligibility check was `playerCount >= 3` with no constraint on bosses. In
`last-team` mode bosses form their own explicit `Boss` faction: every boss character carries
`team: 'Boss'` (set by `BOSS_TEAM` in `helpers/bosses.ts`), so `factionOf()` resolves them
all to the same `'Boss'` string. Once one player house was eliminated the surviving bosses
would still be active as the `Boss` faction, blocking the one-faction win condition from
ever firing — the fight would have to continue to last-contestant or draw instead of
resolving cleanly on house elimination.

**Fixed**: eligibility is now `playerCount >= 3 && bossCount === 0`. Common Cause remains the
dedicated boss-vs-player team event. The banner comment was updated to record the reason.

Covered by a new test in `ring/ring-events.test.ts` (`rejects House War when bosses are
present`).

**Status**: Fixed.

---

### 46. Last-team mode drew when all opponents fled and nobody died — FIXED

`fightConcludes()` determined whether a fight had a non-draw outcome solely by counting
deaths. In a `last-team` event where all opponents fled (zero deaths), the entire roster
received draw outcomes — no contestant ever got `won: true`, and no `ring.win` event was
published.

**Fixed**: `fightConcludes()` now computes `isLastTeamFledWin`:
```
deaths === 0
  && ringEvent.victoryMode === 'last-team'
  && contestants.some(c => c.fled)
  && activeSurvivors.length > 0
  && new Set(activeSurvivors.map(factionOf)).size === 1
```
where `activeSurvivors = contestants.filter(c => !c.monster.dead && !c.fled)`.

The one-active-faction requirement mirrors `isLastTeamVictory` exactly: if Slytherin flees
but Hufflepuff is still fighting alongside Gryffindor, two factions remain active and the
flag is false (fight concludes as a draw). Only when all opponents have fled *and* every
surviving, non-fled contestant belongs to the same faction does the flag trigger.

When the flag is set, surviving (non-dead, non-fled) contestants are marked `won: true` and
receive `ring.win`; fled contestants receive `ring.fled` (not loss — they escaped without
dying); and `participantOutcome` correctly returns `'win'` for survivors. The overall
`fightOutcome` in `ring.fightResolved` is `'fled'` (one faction fled) rather than `'draw'`.
`last-contestant` fights are unaffected — the flag requires `victoryMode === 'last-team'`
to be set.

`factionOf()` is extracted to module level so both `Ring.fight()` (for `isLastTeamVictory`)
and `Ring.fightConcludes()` (for `isLastTeamFledWin`) share the same resolution logic.

Covered by two new tests in `ring/index.test.ts`:
- `fightConcludes` unit test: three contestants, Gryffindor (2) vs Slytherin (1 fled), zero
  deaths → both Gryffindors win, Slytherin does not lose.
- `fight()` integration test: exercises the full `ring.fight()` path so that
  `lastContestant === undefined` (as `doAction` resolves on `isLastTeamVictory`) and the
  zero-deaths fled outcome propagates end-to-end.

**Status**: Fixed.

---

### 47. Player-summoned bosses not refunded when removed pre-fight — FIXED

`summon a boss` recorded a charge in `bossSummons` + `bossSummonsPending`, but there was no
path to cancel that charge if the boss was removed from the ring before a fight started. Two
scenarios caused this:

1. **Last player withdraws** — the boss is left waiting alone; `removeBoss` (which only acts
   when `!hasPlayerContestants`) would do nothing unless explicitly called; the charge was
   spent for nothing.
2. **Despawn timer fires** — the 10-minute despawn timer calls `removeBoss`, which now
   correctly refunds if no players are present, but previously had no refund path.

**Fix — three-layer approach**:

1. `Contestant` gained optional `summonedByUserId?: string` and `summonedAt?: number` fields,
   set by `summonBossAction` when calling `ring.spawnBoss({ summonedByUserId, summonedAt })`.
   These are ephemeral (live on the contestant, never serialized).
2. `Ring` gained an optional `onSummonedBossRemoved?: (userId, timestamp) => void` callback.
   `removeBoss()` invokes it when a player-summoned boss (`ringContestant.summonedByUserId`)
   is about to be removed with no players in the ring.
3. `Game` wires the callback to `_refundSingleBossSummon(userId, timestamp)`, a new private
   method that removes the timestamp from both ledgers using direct `optionsStore` mutation
   (no `stateChange` broadcast) and calls `persistState()` immediately. Idempotent — a
   timestamp already absent is a no-op.
4. `removeMonster()` now proactively removes player-summoned bosses when the last player
   withdraws (rather than waiting for their 10-minute despawn timers), so refunds land within
   the same event-loop turn as the withdrawal — not up to 10 minutes later.

Timer/admin/Gauntlet bosses (no `summonedByUserId`) are unaffected.

Covered by four new tests in `ring/index.test.ts` (`player-summoned boss refund`):
- Last player withdraws → summoned boss removed, both ledgers cleared.
- Player still present → `removeBoss` no-ops, ledgers unchanged.
- Despawn timer fires with no players → boss removed, ledgers cleared.
- Timer/admin boss removed with no players → unrelated ledger entries unchanged.

**Status**: Fixed.

---

### 48. `docs/boss-encounters.md` free-for-all centralization description was incomplete — FIXED

The "Centralized free-for-all policy (Blood Feud)" section described only the card-level
retargeting fix (the `ring.encounterFreeForAll` getter). The primary targeting path —
`Ring.fight()` explicitly passing `team: false` to `getTarget()` on each card play — was
not documented, making the two-layer design non-obvious and the comment "before this fix,
only applied to initial target selection" somewhat misleading.

**Fixed**: the section now explicitly describes both layers:

1. **Primary targeting** (`Ring.fight()`): checks `ringEvent.freeForAll` directly and
   passes `team: false` for the per-turn `getTarget()` call.
2. **Card-level retargeting** (Blast, Enthrall, etc.): passes the ring instance through
   to `getTarget()`; the `ring.encounterFreeForAll` getter forces `team: false` there.

Also fixed: a typo left the numbered list item label empty (`**Primary targeting** ():`).
Corrected to `(**Primary targeting** (`Ring.fight()`):)`.

**Status**: Fixed.

---

### 49. Armed ring events not evicted when the roster made them ineligible — FIXED

After a ring event was rolled during a fight countdown, a later roster change (e.g. a boss
joining mid-countdown) could leave an ineligible event armed. `rollRingEvent()` bailed out
early on `if (this.ringEvent) return` without checking whether the event was still valid.
The fight would then apply House War with a boss present — three factions, no clean
last-team win.

Two failure modes:
1. **Natural path**: boss joins or player leaves → `addMonster`/`removeMonster` → `startFightTimer` → `rollRingEvent` → early return → stale House War applied.
2. **Admin force path**: `trigger ring event house-war` with a boss in the ring — the command would set the event, announce it, spawn any extra bosses, and record a metric even though the roster could never produce a clean two-house outcome.

**Fixed**:

- `rollRingEvent()` now re-checks eligibility *before* the deterministic/events-disabled
  guards (it is a correctness invariant, not a randomness gate). If the armed event is
  ineligible for the current roster it is cleared and the normal re-roll path runs (which is
  suppressed in deterministic/test mode, leaving `ringEvent = undefined` — the right outcome).
- `triggerRingEventAction` (`commands/monster.ts`) computes `buildRingEventContext` against
  the current ring and refuses with an actionable message — including the event id — before
  calling `activateRingEvent`. No announcement, no metric, no boss spawn on refusal.

Covered by two new tests in `ring/index.test.ts` (`ineligible-event eviction on roster change`):
- House War armed then boss joins → ringEvent cleared, countdown still armed.
- Admin force House War with boss present → throws, no announcement or emit.

**Status**: Fixed.

---

### 50. `isLastTeamFledWin` fired when only some opponents had fled — FIXED

The `isLastTeamFledWin` computation in `fightConcludes()` checked
`contestants.some(c => c.fled)` — any flee was sufficient. If Slytherin fled but Hufflepuff
was still fighting alongside Gryffindor, two factions remained active. The flag incorrectly
resolved to `true`, crowning the Gryffindors as winners when the fight should have been a
draw (Hufflepuff never lost).

Additionally, the faction resolution used a different closure in `fight()` (`factionOf` local
arrow function) than was available in `fightConcludes()`. The two could drift apart if either
was edited independently.

**Fixed**:

- `factionOf()` is extracted to a module-level function (before the `Ring` class) so both
  `Ring.fight()` and `Ring.fightConcludes()` share identical faction resolution.
- `isLastTeamFledWin` now mirrors `isLastTeamVictory`: after excluding dead and fled
  contestants, the surviving active set must all belong to exactly one faction
  (`new Set(activeSurvivors.map(factionOf)).size === 1`). If multiple factions remain active,
  the flag is false and `fightConcludes` issues draws.

Covered by a new test in `ring/index.test.ts`: two Gryffindors + one Slytherin (fled) + one
Hufflepuff (alive) → no winner for any contestant; the genuine all-opponents-fled case
continues to pass.

**Status**: Fixed.

---

## Other Resolved Items

### 1. "Barely blocked" message fires incorrectly (upstream #181)

In `announcements/miss.ts`, the "barely blocked" flavor text fires when `attackResult > 5`. This means any miss with a roll above 5 says "barely blocked" — even when the attack wasn't close to hitting. The check should compare how close the roll was to the target's AC, not the raw roll value.

**Status**: Resolved — already correct in the clean-room regeneration. The guard is correctly ordered; behavior matches original intent.

### 2. curseOfLoki in cards/hit.ts — not dead code

The original doc flagged `curseOfLoki` as an unused variable. Investigation shows it is a real game mechanic (natural 1 / crit fail), used extensively across many cards: `hit.ts`, `heal.ts`, `berserk.ts`, `horn-gore.ts`, `lucky-strike.ts`, `cloak-of-invisibility.ts`, `immobilize.ts`, `rehit.ts`, and others. The `curseOfLoki` flag is computed in `helpers/chance.ts` and propagated through hit checks.

**Status**: Not a bug — removed from the bug list. Documenting the Curse of Loki mechanic in the player handbook or DMG is a nice-to-have, not tracked here.

### 3. `DMG.md` and `CARDS.md` content differentiation — FIXED

Both files were near-duplicates: verbose card stats appeared in both, and the DMG lacked operator-facing material.

**Fixed** (2026-08-03):

1. **Root build consumes engine `dist/`.** `pnpm run build:docs` runs `pnpm --filter @deck-monsters/engine build` first, then `node ./build/index.js`. All imports resolve through `packages/engine/dist/…` — not `src/*.js`.
2. **Shared generators in `packages/engine/src/build/`.** `root-docs.ts` drives `DMG.md`, `CARDS.md`, `MONSTERS.md`, `PLAYER_HANDBOOK.md`, and `cards.html`. In-game `look at dm guide` uses the same DM sections via `dungeon-master-guide.ts`.
3. **DM-only sections** (absent from `CARDS.md`): How to Run a Session (web + Discord connectors), Fight Pacing, Admin Commands, Stats Reference with per-monster-type modifiers, Combat Math, Operator Concurrency Notes.
4. **Player-facing `CARDS.md`** uses non-verbose card formatting (description + rarity only; no DPT / hit-chance tables).
5. **Deterministic `MONSTERS.md`** — stat-range reference per type instead of random sample instances (reproducible `build:docs` runs leave git clean).
6. **Automated test** in `packages/engine/src/build/root-docs.test.ts`: DM-only markers present in DMG only; verbose DPT tables in DMG only; byte-identical output across consecutive generations.

**Status**: Fixed.

### 4. Battle history not persisted

`ring.battles = []` — battle history is reset on every `Ring` construction. Lost on every restart.

**Status**: Fixed. Battle history now stored via `setOptions({ battles })` and capped at the last 20 fights. Because it lives in `options`, it is automatically included in `BaseClass.toJSON()` and restored when `restoreGame()` is called. A `get battles()` accessor provides read access. A future event bus (`room_events`) could supplement this with a full persistent log.

### 5. `creatures/base.ts` size reduction — FIXED

Reduced from ~2000 lines to ~977 lines during the TypeScript migration by extracting focused logic (`stats.ts`, `health.ts`, `encounter.ts`, `items.ts`). By the time this pass revisited it, attack/defense resolution already lived in `health.ts`/`cards/` — there was no "combat" logic left in `base.ts` to extract into a `creatures/combat.ts`, so a further pass extracted the two things that actually had content: `creatures/types.ts` (the ~100 lines of exported interfaces/type aliases — `CardInstance`, `CreatureOptions`, `Encounter`, `ChannelFn`, etc. — re-exported from `base.ts` via `export * from './types.js'` so no downstream import changes) and `creatures/edit.ts` (`editSelf`/`edit`, following the existing free-function-taking-the-creature pattern already used by `health.ts`/`items.ts`). `base.ts` is now ~420 lines of getters/setters and thin one-line delegation to sibling modules.

**Status**: Fixed.

### 6. Hardcoded time constants — Done

Healing rate and resurrection time were magic numbers.

**Status**: Fixed. Extracted to `constants/timing.ts`. `TIME_TO_HEAL_MS` was originally
300000 and is now 30000 following the #148 rest-healing balance pass;
`TIME_TO_RESURRECT_MS` remains 600000.

### 7. Hubot-specific AWS environment variable names — Done

**Status**: Fixed. `helpers/aws.ts` now reads `DECK_MONSTERS_AWS_ACCESS_KEY_ID` and `DECK_MONSTERS_AWS_SECRET_ACCESS_KEY`, with backward-compat fallback and deprecation warning for the old `HUBOT_` prefix.

### 8. CI configuration — Done

**Status**: Fixed. `.github/workflows/ci.yml` runs three parallel jobs: TypeScript type-check, lint, and tests. Triggers on push to `main` and all PRs.

### 9. Shop should show item ownership count (upstream #261) — Done

When browsing the shop, show how many of each item the player already owns.

**Status**: Fixed. `items/store/buy.ts` now appends `[own N]` to each line in the item selection question when the player already owns one or more of that item type.

### 10. `look at cards` should list cards with numbers (upstream #260) — Done

Simplify the card listing display to show numbered entries — easier to reference when equipping.

**Status**: Fixed. Both `monsters/base.ts` (monster card listing) and `characters/base.ts` (character deck listing) now prepend `1) `, `2) `, etc. to each entry.

### 11. Level-up should be celebrated publicly (upstream #86) — Done

When a character or monster levels up, announce it in the public ring channel. Currently level-ups are silent.

**Status**: Fixed. The `xp` setter on `BaseCreature` now detects level changes and emits a `levelUp` event. The `announcements/` module wires this to a public `announceLevelUp` broadcast.

### 12. Monster manual should show stat ranges (upstream #74) — Done

The monster manual (`dm look at monster manual`) should show the possible stat ranges for each monster type, not just the flavor text.

**Status**: Fixed. `src/build/monster-manual.ts` now shows HP, AC, STR, DEX, INT base values and variance ranges for each monster type, along with class bonuses.

### 13. Name and color fields should be editable (upstream #69) — Done

After creation, players should be able to edit their character's name and color/appearance fields.

**Status**: Fixed. Added `editSelf()` method to `BaseCreature` (restricted to `givenName` and `icon` fields) and wired to a new `edit my character` command in `commands/character.ts`. The existing admin `edit character <name>` command is unchanged.

### 14. Missing draw announcement at round 10 — Done

When a fight reaches round 10 without a winner, the draw/stalemate announcement was not firing.

**Status**: Fixed in PR #286.

## Completed Tasks

- [x] Fix fight log not updating after new fights complete (pending-snapshot race + retries, #15)
- [x] Fix idle-sweep orphaning in-progress fights (`unloadRoom` checks `ring.inEncounter`, #21)
- [x] Dispose pending boss despawn timers (`bossDespawnTimers` Set, #22)
- [x] Guard every `uuid` write path against the `'boss'` sentinel (`db/profile-id.ts`, #27/#28)
- [x] Isolate per-participant fight-stat writes so one bad row can't abort the rest (#27)
- [x] Fix `TARGET_PREVIOUS_PLAYER` wraparound to use the team-filtered list (#29)
- [x] Despawn bosses when no player monster remains, not only when alone (#30)
- [x] Make the boss spawn warning and the spawn itself agree (`canAcceptBoss()`, #31)
- [x] Derive winner/loser attribution from outcomes so multi-party fights keep it (#32)
- [x] Remove the unreachable `MAX_MONSTERS` branch in `addMonster`; guard `calculateXP` and the `getTarget` array case; surface `spawn a boss`'s admin refusal (#33)
- [x] Fix cross-room stateChange save amplification (room-scoped guard on the listener, #23)
- [x] Fix direct mutations bypassing stateChange (`getCharacter`, `Ring.removeMonster`, `removeItem`, #24)
- [x] Fix cross-room reward duplication (creature.win/loss/permaDeath/fled) (CRITICAL, found while fixing #23, #25)
- [x] Fix console pane not replaying history on reconnect (cold-buffer DB fallback, #16/#17)
- [x] Fix event ring buffer gap not signalled on reconnect (`EventsSinceResult.status`, #17)
- [x] Wire quick actions event emission after game commands (`server/src/quick-actions.ts`, #18)
- [x] Fix "barely blocked" threshold (already correct in TS migration)
- [x] Battle history lost on restart (stored in `options.battles`, capped at 20)
- [x] Extract hardcoded time constants to `constants/` (`constants/timing.ts`)
- [x] Rename Hubot AWS env vars (`helpers/aws.ts` with backward-compat)
- [x] Add GitHub Actions CI workflow (`.github/workflows/ci.yml`)
- [x] Investigate curseOfLoki (working mechanic, not a bug)
- [x] Shop: show item ownership count (`[own N]` appended in buy.ts)
- [x] `look at cards`: numbered list display (monsters/base.ts and characters/base.ts)
- [x] Level-up public announcement (`creature.levelUp` event + `announceLevelUp`)
- [x] Monster manual: show stat ranges (`src/build/monster-manual.ts`)
- [x] Editable name/color fields (`editSelf()` + `edit my character` command)
- [x] Draw announcement at round 10 (PR #286)
- [x] Preset load copy-limit bug fixed (mixed-case duplicate keys, #19)
- [x] `equip.ts` cardSelection name matching aligned with `equipCards` (#19)
- [x] Batch `unequipMany`/`moveMany` tRPC + deferred invalidation to remove workshop flicker (#19)
- [x] `getArray` regression tests for apostrophe card names + JSON array recommendation (#19)
- [x] Implement per-room, persisted, 6-hour-Central-time-aligned card shop scoping (#26)
- [x] Fix broken Discord `/shop`, `/buy`, `/sell` slash-command dispatch strings (found alongside #26)
- [x] Continue incremental decomposition of `creatures/base.ts` (`types.ts` + `edit.ts` extracted, #5)
- [x] Await `equip.ts`'s fire-and-forget rejection announces
- [x] Replace remaining `Promise.reject(channel({ announce }))` call sites with announce-then-real-`Error`
- [x] Publish a terminal `cancelled` event from `fight()`'s `.catch` path
- [x] Distinguish "still processing your previous command" from "answer the current prompt first" in `activeFlows` rejection messages
- [x] Add `victoryMode: 'last-team'` to Common Cause and House War; `Ring.fight()` ends combat when one faction survives and marks all survivors won (#34)
- [x] Centralize Blood Feud's free-for-all in `getTarget()` via optional `ring` param; pass ring from Blast, Enthrall, Fists, Pick Pocket (#35)
- [x] Centralize ring event activation in `Ring.activateRingEvent()`; admin `trigger ring event` now uses same path, refuses during encounter (#36)
- [x] Clear `ringEvent` when quorum drops in `startFightTimer()`; fresh event rolled when quorum later restored (#37)
- [x] Prioritize `contestant.team` over `monster.team`/`character.team` in `calculateXP` (#38)
- [x] Fix boss summon restart gap: `bossSummonsPending` ledger refunded on restore before fight start (#39)
- [x] Add production-shaped `stateStore.save` durability test for `bossSummonsPending` finalization (#39 follow-up)
- [x] Fix `doAction` infinite recursion in last-team mode with ≥2 same-faction survivors (`ring/index.ts`, #40)
- [x] Fix admin `trigger ring event` overwriting an already-armed event (`activateRingEvent()` guard, #41)
- [x] Fix Discord `/summon-boss` expected refusals masked by "Something went wrong" (`CommandRefusalError`, #42)
- [x] Fix `getEventsSinceForRingFeed limitReached` off-by-one: probe for one more row at the cap boundary (#43)
- [x] Remove Discord connector's import-time dependency on server `DATABASE_URL` (#44)
- [x] Exclude bosses from House War eligibility (`bossCount === 0`) to keep it a pure two-house player event (#45)
- [x] Fix last-team mode draw when all opponents fled with zero deaths (`isLastTeamFledWin`, #46)
- [x] Refund player-summoned boss charges removed pre-fight (`onSummonedBossRemoved` callback + `_refundSingleBossSummon`, #47)
- [x] Complete free-for-all docs: describe primary targeting layer in `Ring.fight()` and fix empty label typo (#48)
- [x] Evict stale ring events on roster change: `rollRingEvent()` re-checks eligibility; admin force refuses ineligible events with actionable message (#49)
- [x] Tighten `isLastTeamFledWin` to require exactly one active non-fled faction; extract `factionOf()` to module level for shared use (#50)
- [x] XP getter no longer floors at 1 — first award was +1 too high (#51)
- [x] Flee “10 or higher” matches checkSuccess (pass threshold 9) (#52)
- [x] Pick Pocket empty stealable deck narrates and no-ops instead of throwing (#53)
- [x] Ring fight batch rebuild no longer duplicates contestants / skews turns (#54)
- [x] `clearRing()` cancels pending boss despawn timers (#55)
- [x] Discord guild users auto-joined to default room via `ensureMember` (#56)
- [x] `respondToPrompt` rejects the `PROMPT_CANCELLED` sentinel as a client answer (#57)
- [x] Web room navigation remounts panes, filters by `event.roomId`, seeds history cursor, fixes stale prompt id (#58)
- [x] Event persister retries transient `room_events` insert failures before dropping (#64)
- [x] `deleteRoom` disposes active games and invalidates in-flight loads so deleted rooms cannot resurrect in memory (#71)
- [x] Round-cap / inconclusive fights no longer award wins to every living faction (#74)
- [x] `fightOutcome` keeps permaDeath / fled labels on inconclusive fights; `isDraw` derived from it (#74 follow-up)
- [x] Bad Batch "no effect on other cards" test no longer depends on Heal's 1% crit branches (#75)
- [x] Boss warning-suppression test pins the outer delay instead of observing re-armed cycles (#76)
- [x] XP floors at 0 so a negative encounter modifier can't drive it negative (#77)
- [x] Empty `encounterModifiers` view enumerates consistently with its reads (#83)
- [x] `ConnectorAdapter` re-checks `targetUserId` before prompting a user (#84)
- [x] Differentiate DMG vs CARDS content; add how-to-run + operator sections; deterministic doc generation (#3)

---

### 51. XP getter floored at 1 — FIXED

`getProp()` applied `Math.max(prop, 1)` to every property, including XP. A new monster with `options.xp = 0` (`STARTING_XP`) read as `1`, so the first `monster.xp += N` stored `N + 1`. Combat stats correctly keep the floor of 1.

**Fixed**: XP bypasses the floor; `getPreBattlePropValue` for XP uses nullish coalescing. Covered by `creatures/stats.test.ts`.

**Status**: Fixed.

---

### 52. Flee roll of exactly 10 failed — FIXED

`checkSuccess` uses strict `<` (tie goes to defender). Flee narrated “needs 10 or higher” but called `checkSuccess(roll, 10)`, so a natural 10 failed. Immobilize already compensates by narrating `threshold + 1`.

**Fixed**: Flee passes threshold `9` so a roll of 10 succeeds, matching the narration. Covered by a spy assertion in `flee.test.ts`.

**Status**: Fixed.

---

### 53. Pick Pocket crashed on empty stealable deck — FIXED

`randomHelpers.sample(...).clone()` threw when the highest-XP opponent’s deck was empty or only contained Pick Pocket. Independently confirmed during PR #358 verification: harnesses that sent unequipped `new Basilisk()` monsters into the ring saw 30–90% fight cancellations with `Cannot read properties of undefined (reading 'clone')`; fully decked `randomContestant` monsters did not. That cancel path was this crash bubbling to `Ring.fight()`’s `.catch`.

**Fixed**: Narrate an empty pocket and resolve successfully without playing a stolen card. Covered by `pick-pocket.test.ts`.

**Status**: Fixed.

---

### 54. Ring fight batch rebuild duplicated contestants — FIXED

When the local turn batch had one survivor but others remained globally active, the code rebuilt as `[...activeContestants, ...globalActive]`, duplicating the survivor and skewing turn order.

**Fixed**: Only rebuild when the local batch is empty (`activeContestants = globalActive`); a sole remaining contestant plays normally. Covered by a three-contestant fight regression in `ring/index.test.ts`.

**Status**: Fixed.

---

### 55. Boss despawn timers survived `clearRing()` — FIXED

`dispose()` cleared `bossDespawnTimers`; `clearRing()` did not. A fight that cleared the ring could still fire a stale `removeBoss` later.

**Fixed**: `clearRing()` clears despawn timers the same way as `dispose()`. Covered by `ring/index.test.ts`.

**Status**: Fixed.

---

### 56. Discord guild members not in `room_members` — FIXED

Only the first Discord user to trigger room creation was inserted into `room_members`. Later users shared the guild default `roomId` but failed `getMemberRole` (FORBIDDEN) on slash commands; free-text commands skipped membership entirely.

**Fixed**: `RoomManager.ensureMember` (idempotent); `GuildRoomManager.getOrCreateDefaultRoom` always ensures the interacting user is a member. Free-text and autocomplete paths that resolve the default room pick this up automatically. Covered by server + discord guild-room-manager tests.

**Status**: Fixed.

---

### 57. `PROMPT_CANCELLED` could reach game code via `respondToPrompt` — FIXED

Clients could submit the literal sentinel `__cancelled__` as a prompt answer; the router forwarded it verbatim, bypassing the channel-wrapper translation to `PromptCancelledError`.

**Fixed**: `respondToPrompt` returns `false` when the answer is `PROMPT_CANCELLED` (prompt stays pending). Cancel remains `cancelPrompt` / `cancelAllUserPrompts` only. Covered by `room-event-bus.test.ts`.

**Status**: Fixed.

---

### 58. Web room navigation bled state between rooms — FIXED

Navigating `/room/A` → `/room/B` reused pane instances: `historyApplied` stayed true, history for B never loaded, and live events had no `event.roomId` guard. History also never seeded the subscription cursor despite comments saying it should. Console timeout/cancel handlers closed over a stale `activePromptId`.

**Fixed**: `key={roomId}` on Ring/Console panes; filter events whose `roomId` mismatches; seed `subLastEventId` / `latestTrackedEventIdRef` from history; `activePromptIdRef` for timeout/cancel clearing.

**Status**: Fixed.

---

### 74. Round-cap / inconclusive fights awarded wins to every living faction — FIXED

Flagged during PR #358 verification: a 10-round-cap fight could end with `outcome=win`, multiple winners, and survivors still alive on both sides. Root cause: `fightConcludes` treated `deaths > 0` as a decisive outcome and marked **every** living non-fled contestant as `won`, with no check that only one contestant (classic) or one faction (last-team) remained. The round-10 empty-deck path announced a draw then still hit that path.

**Fixed**: Wins require a decisive survivor set — last-team: exactly one living faction (or the existing fled-with-zero-deaths path); classic: `deaths > 0` and exactly one living contestant. Inconclusive ends (round-cap with multiple living factions/individuals) publish draws for survivors while dead contestants still record as losses. Covered by `round-cap with deaths but multiple living factions…` in `ring/index.test.ts`.

**Follow-up (PR #361 review)**: the first cut over-applied the decisiveness test and left three loose ends, all fixed in the same PR:

- **`fightOutcome` swallowed two conclusive results.** Gating the whole label chain on `hasDecisiveWinner` downgraded a permanently destroyed monster, and "someone died, the survivors fled", to `draw`. Only the final `win` arm may depend on decisiveness. `permaDeath` now leads the chain (matching `participantOutcome`, which checks `destroyed` first), and the `fled` arm is guarded by `settled = deaths > 0 || hasDecisiveWinner` so an all-fled/no-death fight is still a draw rather than a flee. Three cases pinned by the `fightOutcome labelling` block in `ring/index.test.ts`.
- **`isDraw` still used the old predicate.** The `fightConcludes` emit passed `isDraw: deaths <= 0`, so `announcements/fightConcludes.ts` announced "with N dead" for a fight every other record classed a draw. Now derived as `fightOutcome === 'draw'` — one source of truth, so the announcement can't drift from the fight log again.
- **Dead branch in `participantOutcome`.** `deaths` is `deadContestants.length`, so a dead contestant guarantees `deaths > 0` and the `'draw'` arm was unreachable. Collapsed to `return 'loss'` and the now-unused `deaths` parameter dropped.

**Status**: Fixed.

---

### 75. Flaky test: Bad Batch "has no effect on other cards" — FIXED

`cards/bad-batch.test.ts` played a real `HealCard` and asserted the target's hp went *up*. `HealCard.checkSuccess` has a 1% Curse of Loki branch that flips the roll (`result *= -1`) and a 1% Stroke of Luck branch, so the test failed roughly 1 run in 100 with `expected 3 to be above 5` — the curse turned the heal into 2 points of damage. The assertion was never about healing: Bad Batch's contract is that a *non-target* card (anything but Whiskey Shot / Scotch) comes back untouched.

**Fixed**: Assert on the rewrite instead of the hp — the card is returned by identity, `card.effect` is not replaced, and the pending encounter effect stays armed for the next booze card. Deterministic, and a stronger assertion than the hp check it replaces.

**Status**: Fixed.

---

### 76. Flaky test: boss spawn warning suppression — FIXED

`ring/index.test.ts` "suppresses an unannounced spawn when the warning could not be sent" set `inEncounter = true`, ticked a fake clock 40 minutes, dropped `inEncounter`, ticked 3 more, and asserted no warning fired. But `startBossTimer()` re-arms itself after every cycle with a *random* outer delay — 12–22 min for a beginner ring, which this one is (no monsters). Forty minutes therefore ran two or three full cycles, and a legitimately re-armed warning could land inside the final 3-minute window. Failed ~1 run in 5.

**Fixed**: Pin the outer delay via a stub on `getBossSpawnOuterDelayMs`, restart the timer, and size the window to exactly one cycle. The test now exercises the thing it names — a warning suppressed mid-encounter must also suppress the spawn two minutes later — instead of accidentally observing later cycles. Verified over 20 consecutive suite runs.

**Status**: Fixed.

---

### 77. XP could be driven below zero after the floor was removed — FIXED

Hardening on #51. Removing `Math.max(prop, 1)` for XP was correct (it made a fresh monster read `1` and the first award land +1 high), but it also removed the only guard against a *negative* `encounterModifiers.xp` pushing a monster's XP below zero. No such modifier exists today, so this was unreachable rather than live.

**Fixed**: `getProp` floors XP at 0 rather than 1 — fails safe without reintroducing the off-by-one.

**Status**: Fixed.

---

### 64. Failed event persistence is silently dropped — FIXED

`event-persister.ts` logged insert failures via the `onError` callback on the first transient DB hiccup and continued with no retry. Permanent holes in `room_events` caused reconnect gaps and stale history.

**Fixed**: bounded retries with short backoff (default 1s, 5s; injectable for tests), matching the `fight-summary-writer` pattern. Writes stay serialized on the existing per-attachment queue so publish order is preserved through retries. The detach function sets a `detached` flag checked between attempts so delayed retries cannot land after room unload/delete. The `onError` callback and `dm_event_persist_failures_total` metric fire only when retries are exhausted.

Covered by 5 new tests in `event-persister.test.ts` (retry-then-success, exhaustion, no error on transient success, order preserved across retries, detach during backoff).

**Status**: Fixed.

---

### 71. `deleteRoom` vs concurrent `_loadRoom` could resurrect a deleted room — FIXED

A `_loadRoom` that had already read the DB row could finish after `deleteRoom` removed the `active` entry and deleted the DB row, then `active.set` a ghost room. Independently, `deleteRoom` unsubscribed event-bus handlers but never called `game.dispose()`, so ring timers and semaphore listeners could outlive the deleted room.

**Fixed**: a per-room `loadEpoch` bumped on delete; `_loadRoom` captures the epoch at start and refuses to publish into `active` (disposing any freshly constructed game / attached subscribers) when the epoch changed. `deleteRoom` now uses the same detach helper as unload/reset (`unsubscribe*` + `dispose`). Concurrent load deduplication via the `loading` map and its `finally` cleanup are preserved; the epoch entry is dropped once no in-flight load needs it. No second DB existence query is required for the race.

Covered by tests in `room-manager.test.ts` (dispose-on-delete; controlled deferred-load race that must not resurrect).

**Status**: Fixed.

---

### 70. Guild default-room creation race — FIXED

`guild_rooms` PK is `(guild_id, room_id)` with no uniqueness on `is_default`. Concurrent first-time `getOrCreateDefaultRoom` calls could create two default rooms for one guild.

**Fixed**: unique partial index `guild_rooms_one_default_per_guild_idx` on `(guild_id) WHERE is_default = true` (migration demotes any pre-existing extras). `getOrCreateDefaultRoom` catches unique violations (`23505`), deletes the losing orphan via `RoomManager.deleteRoom`, re-selects the winning default, and ensures membership there.

Covered by `on unique default race: returns winner and deletes orphan via RoomManager` in `guild-room-manager.test.ts`.

**Status**: Fixed.

---

### 72. Discord always targeted the guild default room — FIXED

`resolveUser` always called `getOrCreateDefaultRoom`. `/join-room` / `/create-room` changed membership elsewhere, but subsequent slash and free-text commands still hit the default.

**Fixed**: `guild_user_active_rooms` persists `(guild_id, supabase user_id) → room_id` with FK to `guild_rooms` (cascade). `/create-room` and `/join-room` select the resulting room; `resolveUser` and free-text dispatch use `resolveRoomForUser`, which returns a validated active room (guild mapping + membership) or falls back to the guild default and repairs the mapping.

Covered by GuildRoomManager resolve/active/join/create tests plus `helpers.test.ts` and `room-commands.test.ts`.

**Status**: Fixed.

---

### 61. Workshop ↔ console same-user interleave — FIXED

Workshop mutations used the room-wide engine lane; console commands used a per-user lane. `activeFlows` blocked workshop when the caller had a console flow in progress, but not the reverse — a Workshop UI `equipCards` could run while the same user's console equip flow was still in flight, interleaving deck mutations.

**Fixed**: `activePromptFreeMutations` (`roomId:userId`, ownership token) is acquired synchronously at the start of `runSerializedMutation` and released in `.finally()`. The `command` mutation checks it before taking `activeFlows`, rejecting with a clear message when a workshop operation is in flight. Other users are unaffected. A second concurrent workshop call from the same user also fails fast instead of queueing behind itself in the room lane.

Covered by `router.test.ts` (deferred workshop, same-user console rejection, other-user acceptance, cleanup on resolve/reject).

**Status**: Fixed. See [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §2.

---

### 62. Cross-user concurrent engine access on web — DECIDED

Per-user console lanes mean two members of the same room can mutate one shared `Game` in parallel. Ring fights also run outside server lanes (timer chain). Multi-player rooms have a real race surface for deck/ring mutations.

**Decision**: Keep per-user lanes for interactive console flows (prevents #20 starvation). Workshop mutations that touch shared room state retain the room-wide lane. Cross-user prompt flows remain concurrent by design; fights remain outside lanes. Revisit only if a specific mutation class needs stronger ordering — add it to the room lane rather than moving console commands room-wide.

Documented in [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §2.

**Status**: Decided and documented.

---

### 59. Discord free-text prompts dropped — FIXED

`GuildRoomSubscription.buildPrivateChannel` only handled `question && choices`. Free-text engine prompts (spawn name/color, character creation) returned `undefined` on Discord.

**Fixed**: `PromptHandler.sendFreeTextDmPrompt` uses a filtered DM `createMessageCollector` (exact user + channel; cleanup on answer/timeout/cancel). `buildPrivateChannel` routes choice-less questions there, translates `PROMPT_CANCELLED` → `PromptCancelledError`, and keeps button prompts + `pendingPromptRequestIds` timeout cancellation for ConnectorAdapter. Covered by `prompt-handler.test.ts` and `guild-room-subscription.test.ts`.

**Status**: Fixed.

---

### 60. Discord commands bypassed engine serialization / activeFlows — FIXED

Slash and free-text Discord paths `await`ed engine actions with no per-user lane and no flow lock, so concurrent same-user commands could interleave on one `Game`.

**Fixed**: connector-local `command-flow.ts` (`discordActiveFlows` ownership tokens + `runDiscordCommandAction`) shared by `dispatchCommand` and `dispatchFreeTextCommand`. Actions run through `RoomManager.runSerializedEngineWork(`${roomId}:${userId}`)`; a second same-user flow fails fast with `DiscordFlowBusyError`; other users stay independent. The Discord request may await the action, but prompt collectors resolve outside the lane. Expected timeout/cancel/busy aborts are not logged as infrastructure errors. Covered by `command-flow.test.ts`, `helpers.test.ts`, and `bot.test.ts`.

**Status**: Fixed. See [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §2.

---

### 65. `hydrateDeck` alphabetical re-sort — investigated, not a combat bug

`hydrateDeck` sorts alphabetically after hydrate. Ring combat uses equipped `monster.cards[cardIndex]` order, which is restored by `monsters/helpers/hydrate.ts` without sorting — so fight outcomes are not scrambled by inventory sort.

Character inventory intentionally sorts the same way live `addCard` does (`characters/base.ts` → `sortCardsAlphabetically`). Preserving raw JSON order for character decks would diverge from the in-session UX.

Regression coverage: `preserves equipped card play order on hydrate (not alphabetical) (#65)` in `monsters/helpers/hydrate.test.ts`; inventory sort retained in `cards/helpers/hydrate.test.ts`.

**Status**: Investigated — not a combat bug. Alphabetical inventory sort kept by design.

---

### 66. Unknown card names on restore became a random draw — FIXED

`hydrateCard` fell through to `draw({}, monster)` when the card class was missing, so renames/removals silently mutated saved decks into unrelated random cards.

**Fixed**: unknown class names hydrate to an inert `UnknownCard` placeholder (`cards/helpers/unknown-card.ts`) that keeps the original serialized `name`/`options`, remains visible as `Unknown Card (…)`, plays as a combat no-op (including the default `applyEffects` path), and serializes back with the original identity for repair. Repair lookup (`matchesCardLookupName`) accepts both the visible `cardType` and the original serialized class name; normal cards still match `cardType` only. Malformed payloads missing a `name` still hydrate to an inert placeholder (name defaults to `"Unknown"`) rather than a random draw. Character `hydrateDeck` still alphabetizes inventory; equipped monster order is unchanged. Covered by Game `restoreGame` round-trip coverage in `game.test.ts`.

Covered by tests in `cards/helpers/unknown-card.test.ts`, `cards/helpers/hydrate.test.ts`, `monsters/helpers/hydrate.test.ts`, and `game.test.ts`.

**Status**: Fixed.

---

### 69. Lucky Strike / Rehit discarded-roll Curse of Loki — intentional

Multi-roll cards (Lucky Strike, Horn Swipe, Rehit) apply Stroke of Luck / Curse of Loki only to the selected roll. A natural 1 (or 20) on a discarded roll does not crit — matching the card text (“use the best/selected roll”).

**Documented**: card `stats` strings, in-game player handbook / DMG combat math, `PLAYER_HANDBOOK.md`, and `DMG.md` now state that discarded rolls do not crit.

**Status**: Closed as intentional product behavior.

---

### 67. Dead monsters without `killedBy` can get “last one standing” XP — FIXED

`die()` only sets `killedBy` when the assailant is a real creature (`isRealCreature`). Environmental / synthetic death paths leave it unset. `calculateXP` treated “no `killedBy`” as the survivor branch, so a dead contestant could earn last-one-standing XP.

**Fixed**: survivor XP (last-one-standing or flee bonus) now runs only when `contestant.fled` or `!monster.dead`. Dead contestants without `killedBy` still receive kill / killed-by / rounds-survived XP as before, but no survivor bonus.

Covered by `assigns no last-one-standing XP when dead without killedBy (#67)` in `helpers/experience.test.ts`.

**Status**: Fixed.

---

### 68. `getEncounterModifiers()` materializes encounter state outside combat — FIXED

Reading `monster.encounterModifiers` called `getEncounterModifiers`, which allocated `self.encounter = { modifiers: {} }` even when the creature was not in a fight. That phantom encounter polluted serialization boundaries and could make `inEncounter` checks ambiguous.

**Fixed**: when `!self.encounter`, the getter returns a shared read-only empty view (a `Proxy` over a frozen `{}` that materializes `self.encounter.modifiers` only on property writes). Reads no longer allocate; writes during combat still work because `startEncounter` has already created `self.encounter`, and out-of-combat writes (e.g. `hit()` logging) materialize on first assignment.

Covered by `does not materialize encounter state when reading encounterModifiers outside combat (#68)` and `materializes encounter modifiers on write after a read-only empty view` in `creatures/encounter.test.ts`.

**Status**: Fixed.

---

### 73. Test harness lane key did not match production — FIXED

`createRoomCommandRunner` serialized by `roomId` only; production console commands use `${roomId}:${userId}`. Integration tests could hide cross-user starvation.

**Fixed**: `createRoomCommandRunner` now keys lanes as `${roomId}:${userId}`; `createRoomWideCommandRunner` is the explicitly named room-only helper for workshop-style paths. `createTestChannel` translates `PROMPT_CANCELLED` → `PromptCancelledError` like the tRPC router. Covered by `testing/testing.test.ts`, `server/src/integration/command-flow.test.ts`, and the harness concurrent-look-monsters scenario.

**Status**: Fixed. See [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §2.

---

### 78. ConnectorAdapter swallowed channel rejection / non-string answers — FIXED

`ConnectorAdapter` delivered `prompt.request` to private channels but only called `respondToPrompt` for string answers; rejections were caught and ignored, leaving `sendPrompt` pending until the 120s bus timeout.

**Fixed**: on channel rejection or non-string resolution, `ConnectorAdapter` calls `cancelPrompt` so the bus prompt settles promptly. Optional `onChannelError` callback surfaces connector failures without unhandled rejections. `registerUser` now subscribes with the target `userId` so private `prompt.request` / announce events are actually delivered (the adapter's prior catch-all subscriber could not see private events). Covered by `channel/connector-adapter.test.ts`.

**Status**: Fixed. See [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §3.

### 63. Dual `ringFeed` subscriptions per web client — FIXED

`RingPane` and `ConsolePane` each opened `trpc.game.ringFeed.useSubscription` with separate reconnect cursors and each ran `useHandshake`, so one Terminal meant two server subscribers, double reconnect replay, and diverging panes after a partial reconnect.

**Fixed**: `useRingFeed` / `RingFeedProvider` in `Terminal` owns the single subscription, shared monotonic reconnect cursor (skips `handshake`/`heartbeat`; advances by leading epoch on live events and history seeds; `onError` resumes from the latest tracked id), room guard, and handshake. Live events fan out once to pane listeners via `useRingFeedListener` (`useLayoutEffect` registration + pending buffer so early frames are not dropped; listener identity is ref-stable so callback churn cannot restart the subscription). Each pane keeps its own DB history fetch, merge/dedup (`seenRef`), and filters. Room navigation resets the shared cursor and tears down the old subscription input. Covered by `useRingFeed.test.ts`, `ring-feed-cursor.test.ts`, and `terminal-ring-feed.test.tsx`.

**Status**: Fixed. See [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §5.

---

## Whole-branch review hardening (2026-08-03)

Follow-up fixes from the Task 11 whole-branch review (`bba4b89` → `HEAD`). These harden edge cases found after the main audit pass; they do not reopen archived bugs.

### 79. Discord button collector hung when `interaction.update` failed — FIXED

`collectButtonResponse` awaited `btnInteraction.update()` before resolving. When Discord rejected the update (e.g. interaction already acknowledged), the promise never settled; `end` returned early because `collected.size > 0`, leaving `discordActiveFlows` locked.

**Fixed**: settle on collect immediately (preserve `customId`), `collector.stop` best-effort, and fire `update` without blocking settlement. Timeout/cancel paths use the same `settle` guard as free-text collectors. Covered by `prompt-handler.test.ts` (update rejection + flow-lock release).

**Status**: Fixed.

---

### 80. Concurrent `guild_rooms` mapping insert race — FIXED

`_ensureGuildRoomMapping` used check-then-insert without handling a concurrent inserter winning the `(guild_id, room_id)` PK race, surfacing `23505` to callers.

**Fixed**: `isGuildRoomMappingUniqueViolation` recognizes only `guild_rooms_pkey` (or matching detail); same-mapping races are treated as success. Unrelated `23505` (e.g. one-default-per-guild index) still propagate. Covered by `guild-room-manager.test.ts`.

**Status**: Fixed.

---

### 81. `createSubRoom` left orphan rooms on mapping insert failure — FIXED

If `guild_rooms` insert failed after `RoomManager.createRoom`, the new room row remained with no guild mapping.

**Fixed**: on non-recoverable insert failure, `deleteRoom(ownerId, roomId)` removes only the just-created orphan. Cleanup failure throws an actionable error with both mapping and cleanup causes. PK races on the mapping are idempotent (no delete). Covered by `guild-room-manager.test.ts`.

**Status**: Fixed.

---

### 82. Interactive equip flow could not finish a partial batch cleanly — FIXED

The interactive equip loop required players to fill every remaining slot or cancel the flow, which discarded the in-progress batch. Adding a finish response exposed a follow-up UX bug: `done` was converted to an empty selection and passed through the shared card chooser, so it announced `You selected no cards.` immediately before the committed-card summary.

**Fixed**: follow-up equip prompts accept `done`, `finished`, `enough`, and `stop`; the web prompt shows **Done equipping** only after a partial batch. Explicit finish answers now bypass card-selection parsing and its empty-result announcement. A truly empty first response still re-prompts, an empty continuation retains the partial-finish behavior, and cancellation still rejects before `monster.cards` is assigned so the batch rolls back. Existing slot and four-copy limits are unchanged.

Covered by `monsters/helpers/equip.test.ts` (clean finish announcement, first-prompt guard, aliases, empty-response behavior, cancellation rollback, slot/copy limits) and `InlineChoices.test.tsx` (follow-up-only Done button and submitted finish response).

**Status**: Fixed.

---

### 83. Empty `encounterModifiers` view enumerated as empty mid-encounter — FIXED

Follow-up review of #68. The lazy view returned by `getEncounterModifiers()` when a creature has no encounter proxied a **frozen** target. `Object.freeze({})` is non-extensible, and the Proxy invariants then forbid an `ownKeys` trap from reporting keys the target does not own — so no such trap could be added. The result: a view captured before `startEncounter()` kept forwarding single-property reads correctly (`view.ac === 3`) while `Object.keys(view)`, `{...view}`, and `'ac' in view` all reported nothing. Any caller that enumerated rather than reading one property at a time would silently see no modifiers at all.

Unreachable in shipped code — `BaseCreature.modifiers` re-reads `this.encounterModifiers` on every access, so it never holds a stale view — but a silent-wrong-answer trap for the next caller that stores one.

**Fixed**: proxy an extensible plain object and trap `has`, `ownKeys`, `deleteProperty`, and `getOwnPropertyDescriptor` (reporting `configurable: true`, as the invariants require when the target does not carry the key). Reads, writes, and enumeration now all resolve against the live `self.encounter.modifiers`. Covered by two regression tests in `creatures/encounter.test.ts` — one asserting enumeration agrees with reads across `startEncounter()`, one asserting enumeration alone still does not materialize an encounter.

**Status**: Fixed.

---

### 84. `ConnectorAdapter` prompt routing relied solely on the bus filter — FIXED

Follow-up review of #78. Moving prompt handling to per-user subscriptions dropped the old `event.targetUserId` check: `handlePrivateEvent` prompted `userId` for any `prompt.request` it received. `RoomEventBus.publish` delivers to a subscriber when the event is public **or** `subscriber.userId === targetUserId`, so a `prompt.request` published with `scope: 'public'` would reach every registered user's subscriber and prompt all of them, with their answers racing into `respondToPrompt`.

Safe in practice — `sendPrompt` is the only publisher and always uses `scope: 'private'` — but the guard that made it safe independently of that invariant was gone.

**Fixed**: re-check `event.targetUserId === userId` before prompting. Restores defense in depth without changing the per-user subscription model.

**Status**: Fixed.

---

### 85. Quick-action chips suggested sends the engine always refuses — FIXED

`buildQuickActions` offered `send {name} to the ring` for any living monster that was not already a ring contestant. The engine's `sendMonsterToTheRing` refuses in two further cases the chip builder did not model:

1. `monster.cards.length < monster.cardSlots` → *"Only an evil master would send their monster into battle without enough cards."* Because characters are room-scoped, a player fully set up in rooms A and B still has a freshly spawned, empty-decked monster in room C — exactly where the chip was most likely to be clicked.
2. `ring.contestants` already holds a contestant for that character → *"You already have a monster in the ring!"* The chip builder's `hasMonsterInRing` was computed over **living** monsters only, so a monster that died in the ring but had not yet been cleared left the guard false and a second send was offered.

**Fixed**: `readyToSend` is gated on a new `isDeckReady()` (`cards.length >= cardSlots`, defaulting to 9 when the field is missing on a partially hydrated entity), and `hasMonsterInRing` is derived from the player's ring contestants directly rather than from their living monsters — mirroring the engine's `contestant.character === character` test. The equip chip now targets the first idle monster that still needs cards, so it points at whatever is actually blocking the send instead of at an already-equipped monster. `send` / `call out of the ring` also pass `user.id` rather than `user?.id`, so a missing id fails loudly instead of turning private countdown and full-ring announces public (same hardening as the `look at the ring` fix).

Covered by `server/src/quick-actions.test.ts` — deck readiness at default and custom slot counts, equip-instead-of-send, second monster while one is in the ring, dead-contestant-still-in-ring, and equip targeting.

**Status**: Fixed.

---

### 86. Room Terminal HTTP batch 404s under Fastify default `maxParamLength` — FIXED

Opening a room (e.g. production Game Night) issued one `httpBatchLink` GET for seven procedures:

`room.info,game.ringHistory,game.recentFights,game.ringState,game.consoleHistory,game.pendingPrompt,game.myMonsters`

That path is **114 characters**. Fastify’s default `maxParamLength` is **100**, so the framework returned its own `404 Route GET:/trpc/…` **before** the tRPC plugin ran. Single-procedure and short batches still worked; the WebSocket `ringFeed` subscription still connected — so the UI looked half-alive (boss timer via WS) while history, prompts, and monster autocomplete stayed empty / flaky. Non-members separately saw sustained `403 Not a member of this room` and a permanent “RECONNECTING…” banner; that is membership gating, not this bug.

**Why it showed up after recent PRs**: room-mount query count grew (ring history + recent fights + console history + pending prompt + myMonsters + …) until the joined batch path crossed 100 characters. Not a bad deploy of game state — the blob and memberships for Game Night were intact.

**Fixed**: server bootstrap uses `createFastifyOptions` with `routerOptions.maxParamLength: 5000` (official `@trpc/server` Fastify adapter guidance). Documented in `docs/deployment.md` troubleshooting. Regression coverage in `packages/server/src/fastify-batch-path.test.ts` (default Fastify 404s the Terminal path; configured options serve it).

**Status**: Fixed.

---

### 87. Presets saved in the web workshop were unreachable from text / Discord commands — FIXED

Preset names reached the engine with two different casings depending on the connector:

- The text command parser lowercases the **entire** command string (`commands/index.ts` — `command = command.trim().toLowerCase()`), so `load preset Aggro on Stonefang` arrived as `aggro`.
- The web workshop calls `game.savePreset` through tRPC, which passes `presetName` **verbatim**, so a preset created there was stored under the key `Aggro`.

`loadPreset` and `deletePreset` then looked the name up with an exact, case-sensitive key test (`presets[trimmedName]` / `hasOwnProperty`). A preset saved as `Aggro` in the workshop therefore answered *"No preset named "aggro" exists for Stonefang"* from a DM or Discord — the preset was visible in `look at presets` but could never be loaded or deleted from a chat connector. Saving the same name from both surfaces also produced two near-duplicate presets (`Aggro` and `aggro`) that each counted against the `MAX_PRESETS` cap.

**Root cause**: preset keys are player-authored free text, but one connector normalizes case and the other does not — so storage keys and lookup keys came from different namespaces. The engine is the only shared layer, so the reconciliation belongs there rather than in either connector.

**Fixed**: a private `resolvePresetKey` helper on `Beastmaster` resolves a requested name to the key it is actually stored under, comparing with the existing `normalize` (trim + lowercase). `loadPreset` and `deletePreset` resolve through it; `savePreset` reuses a case-insensitively matching existing key so re-saving under different casing updates the preset in place instead of creating a duplicate. Stored keys keep their original casing for display.

Covered by two tests in `characters/beastmaster.test.ts` (cross-connector save/load/delete casing round-trip; re-save under different casing updates in place).

**Status**: Fixed.

---

### 88. Preset commands mis-parsed preset names containing the separator word — FIXED

The preset text commands captured the preset name lazily:

```
/save preset (.+?) for (?:a )?(.+?)$/i
```

Because both groups were non-greedy, the **first** separator split the command. `save preset tank for bosses for Stonefang` parsed as preset `tank` / monster `bosses for Stonefang` — the monster lookup then failed, and the player got a monster-choice prompt or an error for a command that read perfectly well. `load preset hold on on Stonefang` failed the same way on ` on `.

**Root cause**: the grammar is ambiguous when the player's preset name contains the separator, and lazy matching resolves that ambiguity in the wrong direction. The monster name is always the single trailing token, whereas a preset name is arbitrary player-authored text — so the **last** separator is the correct split point, not the first.

**Fixed**: the preset-name group is now greedy (`(.+)`) in `SAVE_PRESET_REGEX`, `LOAD_PRESET_REGEX`, and `DELETE_PRESET_REGEX`, so the trailing monster group claims only the final segment. A comment in `commands/presets.ts` records why, so the lazy form is not "tidied" back in.

Covered by a regression test in `commands/card-management.test.ts` asserting both the ` for ` and ` on ` cases split on the last separator.

**Status**: Fixed.

---

### 89. Nested card plays dumped un-paced card boxes and read as repeated turns — FIXED

Two cards put another card into play: `Random Play` draws one, `Pick Pocket` clones one from
the highest-XP opponent. Both did it by calling `innerCard.play(...)` **directly**.

Consequences in a live feed:

1. **No pacing.** `doAction` in `ring/index.ts` paces card-to-card transitions with
   `veryShortDelay(round)` (midpoint 3s), but a nested play inherited none of that. The inner
   card emitted its full announcement — a ten-line ASCII card box — immediately after the
   outer card's. A `Random Play` that drew `Pick Pocket`, which then stole a `Delayed Hit`,
   emitted **three** card boxes plus their roll lines inside the window normally given to one
   card. On a phone that is a screen-and-a-half of text appearing at once.
2. **Nothing marked it as a chain.** The nested card announced with the identical
   `"<player> lays down the following card:"` wording as a top-level play, so the feed read as
   one monster taking three turns in a row. `Random Play` was the worst case: it emitted no
   narration at all, so two card boxes appeared back to back with nothing connecting them.

This is the same class of regression `docs/engine-concurrency-and-timing.md` §1 warns about
(a past change used `subEventDelay` between card plays and made fights scroll past in
seconds) — except nested plays had no pacing at all, so they were worse than that regression.

**Fixed**: a shared `cards/helpers/nested-play.ts` (`playNestedCard`) gives a summoned card
the same `veryShortDelay(round)` beat the main loop gives a normal card-to-card transition,
and emits the narration explaining why another card is in play before it resolves. `Random
Play` narrates the scraps reassembling; `Pick Pocket` already narrated the steal, so it only
takes the pacing beat. Skip mode (`DECK_MONSTERS_SKIP_DELAYS`) resolves without a real timer,
matching how `doAction`'s continuation paths are treated, so tests and the harness stay fast.

Covered by `cards/helpers/nested-play.test.ts` — context forwarding, narration ordering
(narration before play), no narration when the caller already narrated, no wall-clock delay in
skip mode, and `Random Play` narrating its chain.

**Status**: Fixed.

---

### 90. The fight conclusion banner never said who won — FIXED

The concluding announcement read only `"The fight concluded with 4 dead after 2 rounds!"`. In
a five-way fight that omits the single most interesting fact: players had to scroll back
through the kill lines and work out by elimination who was still standing.

The information was never missing — `ring/index.ts` computes `hasDecisiveWinner`, `living`,
`lastContestant`, and sets `contestant.won`, all of which already drive the fight log, the
leaderboard, XP awards and the `ring.fightResolved` payload (`winnerMonsterName`). The
`fightConcludes` event even passed `lastContestant` to the announcement — which simply
ignored it and rendered the body count alone.

**Root cause**: the announcement was written against the death/round counters and never
updated when winner derivation was added for the fight log, so the one surface players
actually read during a fight was the only one that did not report the result.

**Fixed**: `Ring.fightConcludes` passes the `won` contestants (name + team) into the
`fightConcludes` event, and `announceFightConcludes` prefixes the banner with them — derived
from the same `c.won` flags as the fight log, so the banner can never disagree with the
recorded result. Handles one winner (`🏆 Mamu wins!`), a team win under the `last-team`
victory mode used by Common Cause and House War (`🏆 Alliance wins! (Mamu, Rivian)`),
multiple unaffiliated winners, and draws (no winner line).

Covered by `announcements/fightConcludes.test.ts` (all five shapes plus round-word
pluralisation) and an end-to-end assertion in `ring/index.test.ts` that runs a real
`ring.fight()` and checks the winner reaches the **published** banner text, not just the
contestant flags.

**Status**: Fixed.

---

### 91. Console `equip` never removed cards from the character deck — FIXED

`character.deck` is the **unequipped pool**. `unequipAll` returns a monster's cards to it
via `addCard`; `equipCards` (the web workshop path) and `loadPreset` both splice equipped
cards out of it. The console `equip` command was the one path that did neither:
`Beastmaster.equipMonster` delegates to `monsters/helpers/equip.ts`, which assigns
`monster.cards` but holds no reference to the character, so equipped cards stayed in the
deck as well — and the very same card **instances** sat in both places at once.

Two consequences:

1. **Unbounded duplication.** Every console `equip` → `clear deck` cycle permanently
   duplicated the equipped cards: equipping left them in the deck, and clearing added them
   back a second time. Measured on a three-card deck: 3 → 5 → 7 across two cycles, growing
   without bound in the persisted state blob and bloating the equip prompt's card list
   (which is rendered into a single question message) on every cycle.
2. **Aliased instances.** Because the deck kept the same objects the monster was holding,
   the workshop still offered an equipped card as available, and equipping it onto a second
   monster left one card instance shared between two monsters' hands.

**Root cause**: the deck-as-unequipped-pool invariant lived in three call sites
(`unequipAll`, `equipCards`, `loadPreset`) and was simply never applied to the fourth. The
split between `Beastmaster.equipMonster` (has the character) and the `equip` helper (has the
monster) is what let it go unnoticed — the helper cannot maintain an invariant it has no
access to.

**Fixed**: `Beastmaster.equipMonster` now reconciles the deck after the helper resolves, via
a private `reconcileDeckAfterEquip`: equipped cards are removed from the deck and anything
the monster previously held but no longer holds is returned through `addCard` (which sorts
and emits `cardAdded`, exactly as `unequipAll` does). Removal is **by object identity, not
by name** — duplicate card types are legitimate (up to four copies per hand), so matching by
name would evict the wrong instance. The return path checks identity before re-adding, so a
deck already corrupted by this bug converges as monsters are re-equipped rather than
degrading further.

Covered by `characters/equip-deck-accounting.test.ts` — removal from the deck, the
no-shared-instance invariant, card conservation across three equip → clear cycles, cards
returned when a monster is re-equipped with something else, and sort order preserved.

**Status**: Fixed.

---

### 92. An emptied deck silently refilled itself with a whole new starting deck — FIXED

`BaseCharacter.cards` lazily granted a character's starting deck:

```ts
if (this.options.deck === undefined || (this.options.deck as CardInstance[]).length <= 0) {
    this.deck = _getInitialDeck(undefined, this);
}
```

The constructor always seeds `{ deck: [] }`, so `deck === undefined` was never true in
practice — the `length <= 0` test was what actually granted new characters their deck. But
that test cannot distinguish **"never had a deck"** from **"spent or equipped every card"**,
so any legitimately emptied deck refilled itself with a complete new starting deck on the
very next read. An unbounded card fountain: empty your deck, read it again, get a free one.

It stayed largely latent only because of #91 — the console `equip` never removed cards from
the deck, so a player could not easily empty it. Fixing #91 made an empty deck reachable in
normal play and would have turned this latent bug into a live exploit, so the two had to be
fixed together.

**Fixed**: an explicit `deckInitialized` option records the grant, so an empty deck stays
empty. The flag is also set when a **non-empty** deck is read, which is what covers
characters saved before the flag existed: they are marked on their first deck read, while
they still hold cards, and so can never reach the refill path by emptying the deck later.
The flag is set *before* `_getInitialDeck` runs, deliberately — that assignment calls
`setOptions`, which broadcasts `stateChange` synchronously, and a listener reading this
getter mid-init previously re-entered it and recursed until the stack overflowed (see the
`rawArray` docblock in `announcements/index.ts`). With the flag set first, a re-entrant read
returns the empty array instead of re-triggering the grant, so this is strictly safer than
the old shape. `state.ts` schemas are `.passthrough()` and `BaseClass.toJSON` serializes the
whole options store, so the flag persists across save/restore with no migration.

Covered by `characters/equip-deck-accounting.test.ts` — a new character still gets a deck,
an emptied deck stays empty, equipping the entire deck does not mint a new one, and a
restored legacy character is marked on first read.

**Status**: Fixed.

---

### 93. `↓ Latest` button rendered over the wrong pane in side-by-side view — FIXED

`.jump-to-bottom` is `position: absolute`, but `.terminal-pane` never established a
positioning context, so it resolved against `.terminal-shell` — the **whole two-pane
grid**. `right: 1rem` therefore meant "1rem from the right edge of the entire terminal",
putting the Ring feed's jump button on top of the Console pane. It looked correct on
narrow screens only because the single visible pane fills the shell there.

The vertical offset was wrong for the Ring pane too: `bottom: calc(var(--input-height) +
0.75rem)` reserves room for the command input dock, which lives inside the **Console**
pane. The Ring pane has no input — it has the last-fight footer, whose height varies with
wrapping — so the button floated too high and still overlapped the footer on a long
"Last fight: A vs B vs C…" line.

**Fixed**: `.terminal-pane` is now `position: relative`, and both panes wrap their feed in
a `.pane-feed-area` (`position: relative; flex: 1; min-height: 0`). The button anchors to
the bottom of the *feed*, so it clears whatever follows — the Ring pane's footer, the
Console pane's quick actions and input dock — without hard-coding either height. The
Console pane's inline `bottom` override, which existed to compensate for the same
mis-anchoring, is gone.

**Status**: Fixed.

---

### 94. Rejected commands were never echoed, so the console showed an orphaned error — FIXED

The `command` mutation published its user-input echo event **after** the
`game.handleCommand` recognition check, so only *recognized* commands were echoed. A
rejected command produced a bare `Command not recognized` line with no record of what was
typed — and because the preceding echo belonged to an earlier, successful command, the
console read as though *that* command had failed.

This is not cosmetic: it makes the console actively misleading, and a screenshot of it
unreadable even to someone who knows the code. It cost real time diagnosing a report of
`send <monster> to the ring` "not being recognized" — the command parses fine; the visible
echo was a different, successful command, and the input that was actually rejected had
never been recorded.

**Fixed**: the echo is published before the recognition check, so every submitted command
appears in the console whether or not it is understood.

**Status**: Fixed.

---

### 95. Player email addresses were shown as in-game names — FIXED

`handle_new_user` fills `profiles.display_name` with
`coalesce(display_name, full_name, email, '')`
(`supabase/migrations/20260403000000_fix_profile_trigger.sql`). A web signup that never
set a display name therefore got their **full email address** as their profile name,
which `RoomManager.getDisplayName` handed to `game.getCharacter` as the character's
`givenName` — and from there into fight narration, the leaderboard and, most visibly, the
ring roster's owner line, where it sat on screen for every member of the room for the
whole fight.

**Root cause**: the email is a reasonable *last-resort* seed for a profile row, but
nothing masked it on the way out to other players. Adding the roster made an existing
leak continuously visible rather than creating it.

**Fixed**, in two places because the address is both produced and stored:

1. `publicDisplayName` (`packages/server/src/public-display-name.ts`) reduces an email to
   its local part, dropping any plus-address suffix, and `getDisplayName` routes through
   it — so an address never reaches a client. A name that merely contains `@` (e.g.
   `@stary`) is left alone.
2. Characters created before the fix already have the address saved as `givenName`, and
   the engine's existing name-healing branch only replaced the literal `'Player'`.
   `Game.getCharacter` now also heals a stored name that looks like an email, using the
   server-resolved one. Deliberately narrow: a player who renamed themselves with `edit
   character` keeps that name, since neither healed form can be produced that way.

Covered by `server/src/public-display-name.test.ts` (8 cases including plus-addressing,
multi-dot domains, and non-email `@` handles) and three `game.test.ts` cases for healing.

**Remaining**: rows already written to `room_player_stats.display_name` keep their old
value until the next fight updates them, and the profile trigger still seeds new rows from
the email. Neither is now visible to other players, but changing the trigger default is a
migration worth doing separately.

**Status**: Fixed.

---

### 96. Ring roster showed "Lvl 0" for beginner monsters — FIXED

`describeLevels` treats level 0 as `'beginner'`, and the monster stat card prints
`Level: beginner`. The roster rendered the raw number, so a fresh monster read `Lvl 0`
next to a card saying `beginner` — contradicting the rest of the game's vocabulary.

**Fixed**: `formatLevel` in `RingRoster.tsx` renders `beginner` for level 0 and `lvl N`
otherwise.

**Status**: Fixed.

---

### 97. Turn banner reprinted the full monster stat card every turn — FIXED

`announceTurnBegin` rendered `monsterCard(monster, contestant.lastMonsterPlayed !== monster)`,
intending a full card on a monster's first turn and something shorter afterwards. The
"shorter" form was not shorter: `formatCard` only swaps *which* of `description` / `stats`
it renders, so a repeat still printed the whole ~15-line stat block. In a two-monster
fight, turns alternate and every turn after the first is a repeat, so the feed was mostly
stat cards — and the ten-line card box for the card being played lands immediately after
the banner, so the two together dominated the screen.

Measured across 8 simulated fights: turn banners were **353 messages totalling 6,320
lines — 47% of every line in the feed**, averaging 17.9 rendered lines each.

**Fixed**: the full card prints only the first time a monster acts in a fight. A repeat
turn gets `monsterTurnLine` — one line carrying the name plus the values that actually
change (`🐍 Killer Killer — 30/35 hp · ac 7 · beginner`, plus the team when a ring event
assigned one). Everything else in the block is static for the length of a fight and was
already shown when the monster first appeared. Deliberately not dropped altogether: the
web app has the live roster panel, but Discord does not, and this is where those players
read current hp.

After: 304 messages totalling 1,376 lines — 19% of feed lines, 4.5 lines each. **Total
feed text fell 13,387 → 7,384 lines across the same 8 fights (-45%).** Mean gap between
messages also fell 3.23s → 2.89s, because content-aware pacing (#89 follow-up) gives
shorter messages proportionally shorter pauses — less text *and* a quicker read.

Covered by `announcements/playerTurnBegin.test.ts` (full card first, collapse on repeat,
live hp/ac preserved, full card again on monster switch, team shown) and two
`monsterTurnLine` cases.

**Status**: Fixed.

---

## September 16 2026 mobile UI pass (#98–#108)

Eight iPhone screenshots of a live Game Night room, triaged in two passes: first the
layout, then what the messages actually said. Screenshots are kept in
[`assets/ui-bugs-2026-09/`](assets/ui-bugs-2026-09/). #101 and #104 remain open in
`10-bug-fixes.md` — both are judgement calls about the game's voice, not defects.

Verified by tests and static render only. There is no live app in the dev container
(`pnpm setup:local` needs Docker/Supabase), so none of these was observed in a browser.

---

### 98. Both feeds clipped their own right-hand edge — FIXED

The console read `You summoned 🐗 Seeskane Orcbane — a level Minotaur!` with the level
number simply gone, and the ring feed lost the last word of long lines
(`…has entered the ring at the`). It looked like missing data. It was layout.

**Root cause**: `.event-feed` is the class handed to `<Virtuoso>`, so it lands on the
library's **scroller**, and it carried `padding: var(--pane-padding)`. react-virtuoso
styles that scroller `position: relative` and nests a viewport inside it with
`position: absolute; top: 0; width: 100%` (`dist/index.mjs:2503` and `:2613`). For an
absolutely positioned box the containing block is the ancestor's **padding box**, so
`width: 100%` resolved to *content + left padding + right padding* — 2 × 0.75rem wider
than the visible area — and `overflow-x: hidden` sliced the overflow away silently.

The left gutter looked right throughout, which is what made it read as a data bug: an
abspos box with no `left` starts at its static position, *inside* the padding. Only the
right-hand side ran over.

**Fixed**: padding moved to the `<ol>` (`.event-feed-list`), a normal-flow child that
measures against the content box, with `.event-feed-empty` covering the empty placeholder
that renders outside the list. `feed-layout.test.ts` asserts `.event-feed` declares no
padding and that the gutters live on the list, with the reasoning inline so a future
change does not quietly reintroduce it.

**Also fixed alongside**: `ConsolePane` built its Virtuoso `List` component inline in the
`components` prop, so every render produced a new component identity and remounted the
entire virtualized list.

**Status**: Fixed.

---

### 99. Engine markup was printed literally — FIXED

The fight log's event trace showed `*It's Santi Brainer's turn.*` with the asterisks and
a bare ``` fence.

**Root cause**, in two layers:

1. `FightLogView.tsx` rendered `ev.text.slice(0, 200)` as a plain text node. Every other
   surface routes engine text through `utils/format-event-text.tsx`; the fight log was
   never wired to it.
2. That formatter only ever handled ``` fences. The engine writes for Slack and emits
   `*bold*` and `_italic_` constantly — **every roll** is `rolled _13 +4 on 1d20_` — so
   those delimiters were being printed verbatim in the ring and console feeds too. The
   fight log made an existing gap visible rather than creating one.

**Fixed**: the formatter now renders both inline forms, deliberately **not** inside fenced
blocks, where `*` and `_` are ASCII card-box drawing characters rather than formatting. A
delimiter touching a word character is left alone so `room_player_stats` keeps its
underscores; boundaries are checked either side of the match rather than with lookbehind,
which Safari only gained in 16.4 and the players are on iPads.

`truncateEventText` replaces the raw slice: the old one cut mid-word
(`A powerful, gold, deser…`) and could cut *inside* a ``` fence, leaving it unbalanced so
everything after it rendered as one runaway card panel.

**Status**: Fixed. 10 cases in `format-event-text.test.tsx`.

---

### 100. Every one-round fight read "in 1 rounds" — FIXED

**Root cause**: `utils/fight-display.ts` interpolated `in ${f.roundCount} rounds` at two
call sites with no singular branch. Shared by the fight log and the ring pane's last-fight
footer, so it was visible in both.

**Status**: Fixed via a `pluralize` helper.

---

### 101. The turn banner opened with 21 unrenderable glyphs — FIXED

Both `nextTurn.ts` and `nextRound.ts` opened with
`⚀ ⚁ ⚂ ⚃ ⚄ ⚅ …` — 21 characters in U+2680–U+2685 (DIE FACE-1 … DIE FACE-6).

**Root cause**: JetBrains Mono does not ship die-face glyphs, so the browser fell back
per-glyph and drew tofu boxes. At ~41 characters the row also wrapped to two lines on a
phone — on **every turn**, one change after #97 cut turn banners by 45% for exactly that
reason.

**Fixed**: 🎲 is an *emoji*, not a symbol-block codepoint, so it renders from the system
emoji font. The dice motif survives at one glyph instead of twenty-one:
`🎲  round 1, turn 1`. Rounds are rarer and get the heavier beat — a rule plus the 🏁
flag. `banners.test.ts` asserts no dice-face codepoint survives in either banner and that
no banner line exceeds a phone width.

**Status**: Fixed.

---

### 104. The ring-exit line described the opposite of what happened — FIXED

`Dalfi was summoned from the ring by ⛄ Thunder Smasher.` You summon something *in*.

**Rejected, and worth recording**: "dismissed". `dismiss` is an existing command
(`DISMISS_REGEX`) and `beastmaster.ts` shows it is **permanent and legal only on dead
monsters** — it calls `dropMonster`. Reusing the word for a live monster stepping out of
the ring would make a reversible move read as a permanent roster deletion.

**Fixed** as part of a wider reframe, because the line could not be settled alone. The
player side read as livestock handling — a beastmaster with a *pack*, *sending* monsters
in. The arrival and departure lines are now a deliberate **minimal pair**: same sentence
shape, opposite consent.

| | |
|---|---|
| player, in | `A<adj> <type> answers the call of <icon> <name>.` |
| player, out | `<name> is called back from the ring by <identity>.` |
| boss, in | `A<adj> <type> enters the ring at the behest of 👑 The Editor.` |
| boss, out | `<name> is recalled to the gates by 👑 The Editor.` |

A player's monster comes willingly and is called back; a boss is commanded. "Call" is one
verb across both halves of the player pair, and it is the verb the command itself uses
(`call <monster> out of the ring`), so the feed teaches the command.

Also dropped the last of the ownership language: a dead monster is `laid to rest` rather
than `dismissed from your pack`.

**Status**: Fixed.

---

### 102. Every boss arrival credited a beastmaster who does not exist — FIXED

The feed said `A ferocious Weeping Angel has entered the ring at the behest of
🎡 Gorgeous Protector.` There is no such player.

**Root cause**: `announcements/contestant.ts` is the single join announcement for *every*
contestant and rendered `${character.icon} ${character.givenName}` — the monster's owner.
Bosses are handed a **randomly generated owner** by `characters/helpers/random.ts`
(`randomCharacter`) under `userId: 'boss'` (`docs/boss-encounters.md` §1). So the line
invented a plausible-looking beastmaster and attributed the boss to them.

Worst for a **timer-spawned** boss, where no player was involved at all and the feed still
told the room someone had sent it in. The screenshot is exactly that case: `A boss will
enter the ring in 2 minutes` immediately precedes it, so it is the 20–35 min spawn timer.

**Fixed**, in two passes. The first branched `announceContestant` on `contestant.isBoss`
and dropped the owner clause entirely — a boss simply entered the ring.

**Superseded**: dropping the clause removed the lie but also removed the sense that
*something* sent the boss, which is what an arrival line is for. Bosses are now credited
to the house instead: `RING_PATRON` in `constants/lore.ts`, rendered `👑 The Editor`.
The name is the Roman term rather than a pun — the *editor muneris* sponsored the games,
set the programme and gave the signal, which is exactly the role. It is one constant so
the house can be renamed in a single line.

The same pass found the bug **also existed on departures**: `announceContestantLeave`
credited the generated owner too, so a despawning boss named a beastmaster who does not
exist. Departures branch the same way (`is recalled to the gates by 👑 The Editor`).

**Status**: Fixed. Covered by `contestant.test.ts` and `contestantLeave.test.ts`.

---

### 103. A player-summoned boss was announced twice, out of order, under two names — FIXED

One `summon a boss` produced:

```
An enraged Minotaur has entered the ring at the behest of 🎎 Incredible Swan.
[ ~15-line Seeskane Orcbane stat card ]
Tweettypography has summoned a boss into the ring!
```

Two public messages naming two different beastmasters, only one of whom is real (#102
explains the other), with the explanation arriving last.

**Root cause**: `commands/monster.ts` called `ring.spawnBoss(...)` — which runs
`addMonster` → `announceContestant` and publishes the arrival **together with the stat
card** — and only afterwards published `${character.givenName} has summoned a boss into
the ring!`. Separated by a card block, the second line read as a second, unrelated summon
rather than as the explanation for the one above it.

**Fixed**: the summon line publishes first. Safe to reorder — the existing
`canAcceptBoss()` check upstream is the only reason `spawnBoss` returns undefined, and
nothing between them yields, so this cannot announce a summon that then fails to happen.
`summon-boss-order.test.ts` records publish order and the spawn on one timeline and
asserts the ordering, plus that the line is published exactly once.

**Status**: Fixed.

---

### 105. The boss warning was the only ring line with no full stop — FIXED

`announcements/bossWillSpawn.ts`. One character.

**Status**: Fixed.

---

### 106. A three-monster fight's summary silently dropped a contestant — FIXED

`#8 Everest vs Ford vs Death Blood` was summarised `Everest fled from Ford`.

**Root cause**: `fightSubtitle`'s `fled` branch built its sentence from only two
participant outcomes, `fled` and `win`. A third monster finishing with `loss` matched
neither filter and vanished — from a summary whose own title named it.

**Fixed**: any outcome the branch does not enumerate is now listed rather than filtered
away, so the subtitle always accounts for everyone in the title.

**Status**: Fixed.

---

### 107. Nothing marked a break in the feed, so unrelated sessions ran together — FIXED

A stat card ending `Battles fought: 0` sat directly above an unrelated Minotaur arrival
with 95 battles behind it: two sessions abutting with nothing between them.

**Rejected design, recorded so it is not re-proposed**: a divider between any two events
more than N minutes apart. The boss spawn window is **20–35 minutes**
(`BOSS_SPAWN_MIN/MAX_DELAY_MS`) and an empty ring is silent by design, so a long pause is
the feed's normal resting state. A gap rule would shred a quiet evening into dividers and
come to mean "nothing happened", which is the opposite of the point.

**Fixed** with three dividers, each from a signal the client already has *exactly*:

| Divider | Signal |
|---|---|
| `you joined here` | the history/live boundary in `RingPane`'s history merge |
| `connection lost` | the subscription's `onError` |
| `reconnected` | the handshake on the resumed subscription |

**The reconnect marker is held back rather than drawn at handshake time.** On reconnect
the client resubscribes with a resume cursor and the server replays from it — but the
handshake arrives *before* that replay, while the replayed events carry timestamps from
*during* the outage. Drawing the divider immediately would put it above the very events
the reader missed. It is instead emitted before the first event that actually postdates
the reconnect, which brackets the gap correctly using data already on the wire, with no
protocol change:

```
—— connection lost ——
     … the fights you missed, replayed …
—— reconnected ——
```

**Markers are per-viewer and never persisted.** "You lost connection" is not a fact about
the room, so they must not enter `room_events` or reach Discord, which has no scrollback
problem to solve. They are modelled as synthetic `GameEvent`s so they flow through the
feed's existing dedupe and virtualization unchanged, and are only ever added by the pane,
never by the subscription — so they cannot leak into the resume cursor.
`shouldAppendMarker` refuses to stack two dividers in a row or open the feed with one.

Not covered by `CatchUpBanner.tsx`, which is a dismissible overlay keyed to the viewer's
`lastSeenAt` — about the reader having been away, not the game having stopped.

**Status**: Fixed.

---

### 108. Nothing watched for the heartbeat stopping — FIXED

**Root cause**: the server sends a keep-alive `heartbeat` every 20s
(`trpc/router.ts`) and the client discarded it with
`if (event.type === 'heartbeat') return;`. **Nothing tracked their absence** — there was
no watchdog anywhere in `useRingFeed`. So `connected` only flipped false when the
transport itself raised `onError`.

A connection that dies silently — a backgrounded phone or iPad, or a network that
blackholes rather than resets — therefore left the app believing it was connected: no
"reconnecting…" banner, no resubscribe, and events quietly missed. The heartbeat exists
precisely to make this detectable and was being thrown away.

**Fixed**: any inbound frame re-arms a watchdog; 2.5× the server interval without one
takes the same path as `onError`, resuming from the last event id rather than replaying
from the beginning. Both paths share `handleConnectionLost` so they cannot drift.

Found as a prerequisite for #107 — a `connection lost` divider is only as good as the
client's ability to notice the drop.

**Status**: Fixed.

---

### 109. The fight log leaked other players' private events — FIXED

Found by asking why the fight log's event trace was labelled "Event trace (same window)".

**Root cause**: `room_events` carries no fight id, so a fight's events are resolved by
**time window** — everything between the summary's `startedAt` and `endedAt`. That is what
"same window" was hedging about. But the window also catches **private** events addressed
to individual players, which `event-persister.ts` stores complete with their `scope` and
`targetUserId`, and `loadFightEventsForSummary` filtered on neither.

So any room member who expanded a fight in the fight log received every other player's
private fight narration from that window — their XP and coin awards, their prompts.
`assertMember` gated the *room*; nothing gated the events within it. Room membership is
not entitlement to another member's private events.

**Fixed**: the query now takes the viewer and applies the same visibility predicate the
ringFeed replay uses. That predicate was duplicated in two files with a comment asking
them not to drift; it now lives once in `db/event-visibility.ts` as `eventVisibilityFor`,
which is where any future `room_events` query on behalf of a viewer belongs. The label is
now "Events during this fight" — what the panel shows, rather than a hedge about how it is
computed.

Covered by `analytics-queries.fight-events.test.ts`, which walks the drizzle predicate and
asserts it references `scope` and `target_user_id` and binds the caller — no database
required.

**Status**: Fixed. A new failure pattern for `docs/room-scoping.md`: scoped to the room
but not to the viewer.

---

### 110. Fight highlights in the console — NEW FEATURE

While a fight runs the ring feed scrolls past at reading pace and the console sat idle. It
now calls out the few moments worth looking up for: natural 20s, critical failures, a hit
that really landed, a kill, a monster fleeing. The ring still shows everything — this is
emphasis, not a second feed, so the classifier is deliberately stingy.

**Classification reads payloads, never prose.** Matching flavour text would break the
moment anyone rewrote a string. Rolls already carried the engine's own `strokeOfLuck` /
`curseOfLoki` flags; deaths and flights have their own event types.

**Hits did not.** `announceHit` published `payload: {}` — the one number the event is
*about* was recoverable only by parsing the sentence. It now carries `damage`, `prevHp`,
`hp`, `maxHp`, `bloodied`, `monsterName` and `assailantName`.

**A big hit is judged against the attacker, not the target.** The first rule used a ratio
of the *target's* max health and rewarded the wrong thing: a level 6 boss chipping a
beginner clears a quarter of their health constantly, while a beginner landing the best
hit of its short life on that boss barely moves the bar. A hit is big when it is at least
1.5× that attacker's own running average this session, with an absolute floor so a ratio
cannot make 1 → 2 damage a "150% outlier". The baseline is session-scoped and in memory:
the comparison should be against what *this viewer* has watched, and a stale
cross-session average would judge the opening hits of a fight against monsters long gone.

**Presentation**: the tag stacks *above* its line. Inline, tags of differing widths
(`NAT 20` / `CRIT FAIL` / `BIG HIT`) each pushed their text to a different left edge, and
a monospace feed's whole look is the straight left column — the ragged result read as
broken rather than emphasised.

**Status**: Shipped.

---

### 111. The item help taught the opposite of the rule — FIXED

Shipped and caught within the same session, by a review pass rather than by tests.

`help.ts`'s `ITEMS_NOTE` and `CommandReference.tsx`'s items banner were written to fix the
game's least-discoverable mechanic — that items still work once a fight starts. They said
so with no caveat: *"you can still use items on it"*.

**Root cause**: the copy was written one commit **before** the underlying rule was
corrected (#110's follow-up), and was never revisited when it was. The real rule is that
`items/helpers/use.ts` restricts the usable pool to `monster.items` once the monster is in
an encounter, and `items/helpers/transfer.ts` blocks handing anything over then — so only
what a monster carried into the ring is usable.

The result was worse than silence: a player who read the help reached for a pocket potion
mid-fight and got `"doesn't have any items that … can use on Fluffy"` with no explanation.
The one piece of copy written specifically to teach this mechanic was teaching it backwards.

**Why the tests did not catch it**: they asserted that `'mid-fight'` and
`'Targeting scrolls'` appeared in the output. That passes on accurate *and* misleading
wording alike — the assertion proved the text existed, not that it was true. Both tests now
assert the caveat itself, which is the part a regression would drop.

**Fixed**: both surfaces lead with the constraint and name the remedy — what a monster takes
into the ring is what it has, so stock it first with `give [item] to [monster]`.

**Lesson worth keeping**: when a rule is corrected, grep for the player-facing copy that
described it. The code comment, the roadmap and the help text were three separate
statements of the same fact, and only two got fixed.

**Status**: Fixed.

---

### 112. Every leaderboard showed players' raw email addresses — FIXED

Visible on the live site: the room player board listed `david+leyo@brainermail.com`,
plus-address and all, to every member of the room.

**Root cause**: `profiles.display_name` is seeded from the user's email by the
`handle_new_user` trigger, so a player who never set a name has their address stored there.
#95 added `publicDisplayName` and wired it into `RoomManager.getDisplayName`, which covers
names flowing *into the game*. But `analytics-queries.ts` reads
`profiles.display_name` **straight out of the database** for all four leaderboards — room
players, room monsters' owners, global players, global monsters' owners — and none of them
masked it.

`10-bug-fixes.md` claimed these rows were "masked on read too, so this is cosmetic history
rather than an active leak." **That claim was wrong**, and it is why the leak survived #95:
the follow-up item said the remaining exposure was already handled. A leaderboard is the
widest audience any name in this game reaches.

**Fixed**: all four queries route through `publicDisplayName`. The two owner lookups mask
as the name goes *into* the id→name map, so every read of that map is safe by
construction. Monster names are deliberately left alone — those are player-chosen, not
derived from an account.

Covered by `analytics-queries.names.test.ts`, which pins the masking contract and counts
the call sites: the failure mode is a *missing* call at one of four separate queries, which
a behavioural test would only catch for whichever query it happened to cover.

**Status**: Fixed.

---

### 113. The workshop collapsed to a 6px sliver with no monsters — FIXED

A player with cards but no monsters saw the workshop header, then a thin grey strip, then
their inventory. It read as a broken layout.

**Root cause**: `.workshop-monster-row` renders a bare `monsters.map(...)` with no empty
state. With zero monsters the row is an empty flex container, and #369's container query
gave it `padding-bottom: 0.35rem` — **measured at exactly 6px tall in Chromium at 393px**.
Before that container query the empty row was 0px and simply invisible, so the padding did
not cause the gap, it made an existing one visible.

Worth noting what it costs: this is the *first* thing a brand-new player sees. A deck of
cards, nothing to put them on, no hint that spawning is the next step, and no way to spawn
from this surface.

**Fixed**: an explicit empty state that names the command (`spawn a monster`) and does not
flash while the query is still loading. The row is not rendered at all when it would be
empty.

Diagnosed by rendering the real CSS in headless Chromium at 393px and measuring — the CSS
is correct in both hosts (panels lay out at 325×211 and scroll horizontally), which is what
ruled out a styling regression and pointed at the empty case.

**Correction**: this was found while investigating a "the workshop does not render
correctly" report, and was wrongly assumed to *be* that report. It is not — the reporter
had monsters, so this branch never ran for them. The measurement above only ever covered
a row short enough not to overflow, which is why it came back clean. What they were seeing
is #116. The empty state stands on its own; the inference from it did not.

**Status**: Fixed.

---

### 114. Leaderboard columns were clipped off the right edge — FIXED

On a phone the board showed `#` and `Name` and nothing else — not XP, wins, losses or
draws, which are the numbers it exists to show.

**Root cause**: the table is wider than a phone, and its wrapper
(`.leaderboard-table-region`) announces itself as a scrollable region — `role="region"`,
`tabIndex={0}`, an aria-label reading "Scrollable…" — but **had no CSS at all**. Nothing
made it scroll, so the overflow was simply clipped.

**Fixed**: the region scrolls horizontally, with the rank and name columns pinned so they
stay readable while the numbers scroll under them, and a focus ring since it is keyboard
reachable by design.

**Status**: Fixed.

---

### 115. "Send to ring" asked for confirmation, then failed — FIXED

Raised by Codex review on #369 and verified against the engine.

**Root cause**: the button was disabled only on `!monster.inRing`, i.e. based on *this*
monster. `Beastmaster.sendMonsterToTheRing` computes
`ring.contestants.filter(c => c.character === character)` and rejects if it is non-empty —
so **any** of the player's monsters in the ring blocks every other one, and a dead
contestant awaiting cleanup blocks too. Every benched monster therefore offered an enabled
button, raised a `window.confirm`, and then failed with "You already have a monster in the
ring!".

**Fixed**: the button is disabled when any owned monster is a contestant, and carries the
reason — one at a time, or "needs a full deck" — because a disabled control with no
explanation reads as a bug rather than a rule.

**Status**: Fixed.

---

### 116. The workshop crushed its own monster row instead of scrolling — FIXED

The bug actually behind the "workshop does not render correctly" report on #369. #113
(below) was found while looking for it and is real, but it only fires with **zero**
monsters — the reporter had monsters, so that fix never touched what they were seeing.

**Root cause**: `.workshop-view` is both the scroll container (`overflow-y: auto`) and a
flex column. Flex items shrink before a scroll container ever scrolls. Once the content
exceeded the viewport — which happens at phone width, where the card grid drops to two
columns and the inventory grows tall — the monster row was shrunk from the 433px its
panels need down to 142px, and the panel contents (header, actions, card grid, presets)
spilled out of the 136px box over the inventory below. Measured in Chromium at 393px:
`scrollHeight === clientHeight`, so the scrollbar never appeared at all. It looked like
overlapping, clipped panels rather than a page that needed scrolling.

The wider lesson: `overflow-y: auto` on a flex column is a half-written rule. The shrink
has to be turned off explicitly or the scroll never happens.

**Fixed**: `.workshop-view > * { flex: 0 0 auto; }`, with a regression test asserting both
halves of the pair (the column/overflow declarations and the pinned children), since a
jsdom test cannot measure layout.

**Status**: Fixed.

---

### 117. Fight summaries shipped raw emails to every room member — FIXED

Same class as #112, in the query the #112 fix did not touch.

**Root cause**: `fight_summaries.participants[].ownerDisplayName` is written by the engine
from `character.givenName` (`ring/index.ts`), which for a web signup that never chose a
name is the raw email `handle_new_user` seeded. `queryRecentFights`, `queryFightByNumber`,
`queryMonsterFightHistory` and `queryFightsSince` all `select()` the row and return it
whole, so the address reached every room member's fight log and catch-up payload. No web
component renders the field today, which is why it was invisible — but it was in the
response body, and "nothing renders it yet" is not a privacy boundary.

**Fixed**: one `maskFightParticipants` helper applied on the way out of all four queries,
mirroring what #112 did for the leaderboards.

**Status**: Fixed.

---

### 118. The room member list leaked the same emails — FIXED

**Root cause**: `RoomManager.getRoomMembers` selects `profiles.displayName` raw and
returns it to any member calling `room.members`. `RoomManager.getDisplayName`, two
functions below it in the same file, already masks and carries a comment explaining why;
this query was simply missed.

**Fixed**: masked through `publicDisplayName`, like its neighbour.

**Status**: Fixed.

---

### 119. Fight log and leaderboard rendered a bare frame when empty — FIXED

**Root cause**: both panels map straight over their result array with no zero-row branch.
An empty room showed "Fight log" and nothing else; the leaderboard showed column headers
over no rows. Pre-existing — the pre-extraction `FightLogView`/`LeaderboardView` had the
same gap and #369's extraction carried it forward — but it is the first thing a new room
shows, which is the worst possible moment for a surface to look broken.

**Fixed**: both name what produces rows (send two monsters to the ring) rather than just
reporting emptiness. Same reasoning as #113's workshop empty state.

**Status**: Fixed.

---

### 120. The card-slot meter was an unreadable block of colour — FIXED

Reported from an iPhone screenshot after #370 shipped: the meter in each monster panel
rendered as a solid yellow bar with no legible text.

**Root cause**: the label was `position: absolute; inset: 0` over the fill, drawn in
`--color-fg-bright` on a `--color-accent` background. Measured contrast: **1.02:1** in
phosphor, 1.14:1 in ember, 1.65:1 in amber — every theme pairs a light foreground with a
light accent, so the text was the same brightness as the bar behind it. It failed hardest
at a *full* deck, where the fill spans the whole label, which is exactly when a player
wants to read it. The dark-background themes hid this during development because the label
is readable until the fill grows under it.

Text on a fill whose width changes cannot be fixed by picking a different colour — one end
of the bar is always the wrong background. So the label moved off the bar entirely: the
count sits beside a slim track, on the panel background, and the bar became a
`role="progressbar"` rather than a shape with text on it.

**Status**: Fixed.

---

### 121. The same card rendered at two sizes on one screen — FIXED

**Root cause**: `.workshop-slot-grid` (the monster's equipped slots) is a fixed 3 columns,
but the container query at 520px set `.workshop-card-grid` (the inventory below it) to 2.
Cards are dragged from the second onto the first, so at phone width a player saw the same
card half again as wide in one place as the other — and 20 unequipped cards became ten tall
rows to scroll past. The container queries had been written for the inventory grid alone
and never revisited when the slot grid was added.

`.workshop-slot-grid` also had no narrow-width rule at all: its three `minmax(70px, …)`
columns need 222px plus the panel's padding, so in a pane under 280px it overflowed instead
of reflowing.

**Fixed**: the inventory is 3-up at phone width, matching the slots above it; the slot grid
drops to 2-up in a very narrow pane.

**Status**: Fixed.

---

### 122. Nothing said a player had a second monster on a phone — FIXED

**Root cause**: below 900px `.workshop-monster-row` becomes a scroll-snapped carousel, and
the only indication that more monsters existed was the ~44px sliver of the next panel
poking past the right edge. Cut mid-word (`Fo…`, `Wee…`, `PRE…`), it reads as a rendering
fault rather than an affordance — it was reported as one. A player with two monsters could
reasonably conclude the page was broken rather than scrollable.

**Fixed**: `.workshop-monster-dots` — one marker per monster, current one filled, shown only
with more than one monster and only inside the container query that makes the row scroll.
The dots are buttons that scroll their monster into view (honouring
`prefers-reduced-motion`) and are labelled with the monster's name rather than "2 of 3".

Worth recording, because it cost a render cycle to catch: the first attempt sized the
button itself and used `border-block: 18px solid transparent` for the 44px tap target. The
1px inline borders then ran the full height of the border box, so the dots rendered as tall
vertical bars. The tap target has to be a button that draws nothing, with the marker on a
`::before`. Invisible to jsdom; caught by screenshotting Chromium at 393px.

See `docs/roadmap/20-workspace-layout.md` §5g.

**Status**: Fixed.

---

### 123. The item use controls hung outside the panel — FIXED

Found while rendering the new use affordance (#124 work) at phone width, before it shipped.

**Root cause**: `.workshop-select` carries `min-width: min(100%, 12rem)` inside the 520px
container query. On a row with a target picker *and* a use button, 12rem plus the button
exceeded the row, and because the group did not wrap, the button rendered outside the
panel's own border. Measured in Chromium at 393px.

**Fixed**: the use group wraps, and the picker may shrink inside it rather than holding a
width the row cannot give. Guarded by a CSS assertion test, since jsdom cannot measure
layout — the same limitation that let #114, #116 and #122 through.

**Status**: Fixed.

---

### 124. Every line but two still credited a boss to an invented beastmaster — FIXED

**Confirmed from a screenshot**: with `Zhizzi [BOSS]` in the ring, the feed read
`It's Hopewing's turn.`, and a fight-log entry read `It's Santi Brainer's turn.`

**Root cause**: #102 fixed this at the two call sites it was reported from — boss arrival
and departure — by substituting `👑 The Editor` there. The invented name was still being
*generated*, so every other site that reads an owner's `givenName` kept printing it: the
turn banner (`announcements/playerTurnBegin.ts`), and `ownerDisplayName` on every persisted
fight participant. Patching call sites one at a time was always going to leave the next one
broken.

**Fixed** at the source, as the reporter suggested: `randomCharacter` now names the
generated owner after the house when `isBoss`, so `givenName` and `icon` are already correct
wherever they are read — including sites nobody has enumerated. An explicit name still wins,
so a caller can stage a named antagonist, and the boss *monster* keeps its own generated
name; only the owner is the house.

This makes #102's substitution redundant rather than adding a third special case. It is left
in place as belt-and-braces, producing the same string.

Verified end to end against the built engine: a generated boss owner is `👑 The Editor`, its
monster keeps its own name, ordinary characters are unaffected, and `{ name: 'Lady Vex' }`
still wins. Existing saved bosses keep their old names until the next summon generates a new
one; no migration, since bosses are generated per summon.

**Status**: Fixed.

---

### 125. Fight-log list markers sliced in half on iOS — FIXED (unconfirmed on device)

**Root cause (probable, not demonstrated)**: `.fight-log-detail ol` was both the list and
the scroll container (`max-height` + `overflow: auto`), while its markers are
`list-style-position: outside` and so are painted in its padding box. WebKit clips markers in
that position when the element is a scrollport; Blink does not.

**Honest limitation**: Chromium does not reproduce this. The real component with the real
stylesheets at 393px renders `1. 2. 3. 4.` correctly — `padding-left: 24px`,
`scrollWidth === clientWidth` — including with the wide pre-#101 dice-glyph text the
reporting screenshot contains. The reporter is on iOS Safari, and this environment has no
WebKit to check against.

**Fixed** by moving `max-height`/`overflow` onto a `.fight-log-events` wrapper so the `<ol>`
is never a scrollport. This removes the precondition instead of depending on how either
engine treats markers inside one, so it is the right shape of fix whichever engine was at
fault — but it has not been seen to fix anything, and wants confirmation on a real iPhone.

See the standing limitation recorded under `10-bug-fixes.md` G: all visual verification here
is Chromium-only, so a clean render is not evidence that a reported visual bug is absent.

**Status**: Fixed in code; unconfirmed on device.

---

### 126. Handbook quick links did nothing when the console was not in a slot — FIXED

**Root cause**: `insertCommand` was `insertFnRef.current?.(command)`, and only `ConsolePane`
sets that ref, on mount. Before the surfaces-in-slots work the console was always on screen,
so the optional chain never mattered. Once the console became one of five surfaces competing
for two slots, the handbook's quick links ("Monster Manual", "Handbook", "Card List") had two
ways to fail: with the console in neither slot the click did nothing at all and the reference
panel simply closed, and with the console mounted but not the active tab the command ran
somewhere the player could not see.

The general lesson, worth keeping: a deep link into a surface must now *ask for that surface
to be shown*. It can no longer assume the surface it targets is on screen, and a silent
optional chain turns that assumption into a no-op rather than an error.

**Fixed**: `Terminal` registers a `revealSurface` function with the command-insert context,
and `insertCommand` calls it for the console before inserting. Because revealing takes a
render, a command arriving with no console registered is held and flushed by the next
`registerInsertFn` instead of being dropped — and flushed exactly once, since `ConsolePane`
re-registers on re-render and replaying would re-run the command.

Generalised to `revealSurface(surfaceId)` rather than a console special case: that is the
shape every future deep link needs.

**Status**: Fixed.

---

### 127. "Reconnecting" on a healthy connection, and it never cleared — FIXED

Two defects, which together produced exactly what was reported: the banner appearing with
no disconnect, and no "reconnected" line after it.

**Why it tripped**: `HEARTBEAT_TIMEOUT_MS` is enforced with a `setTimeout`, and a locked
phone or backgrounded tab has its timers throttled or frozen. A timeout that came due while
suspended fires the instant the page is shown again, so the watchdog reported a dead
connection purely because time had passed in the background. No frames can arrive while the
page is suspended whether the socket is healthy or not, so silence across a background
period is not evidence of anything. #108's own test comment said a backgrounded phone
"looks like" a blackholing network — true, and that is precisely why the watchdog cannot
treat them the same.

**Why it never cleared**: giving up called `setSubLastEventId(latestTrackedEventIdRef.current)`
and nothing else. In a quiet room the cursor has not advanced since the last subscribe, so
that assigns the value it already holds. React bails out on an unchanged value, the
subscription input stays identical, tRPC does not re-subscribe, and the handshake that sets
`reconnecting` back to false is never requested. The recovery path silently did nothing in
exactly the case the watchdog fires in.

**Fixed**: on `visibilitychange` to visible the watchdog is re-armed with a fresh full
interval, so a genuinely dead connection still trips it one interval later while a return
from the background does not. And a resume bumps a `resumeAttempt` counter carried in the
subscription input, so the retry is always a distinct input and cannot be deduplicated. The
server takes the field and ignores it; its only job is to make the resume observable.

**Status**: Fixed.

---

### 128. A stranded "connection lost" divider with the feed scrolling past it — FIXED

Reported with a screenshot after #127 was written but before it deployed: `CONNECTION LOST`
in the ring feed, then a boss announcement, a monster entering, and a card — all *after* the
divider, with no "reconnected" line. The reporter's summary was exact: it is not only the
banner that gets stranded.

**Root cause**, and it is a third defect distinct from #127's two: `reconnecting` cleared
only on a handshake. When the watchdog trips on a subscription that was never actually dead
— which #127's first half explains — that subscription keeps delivering events perfectly
well, and the app stays in "reconnecting" while displaying them. The feed then reads as
something that broke and kept going.

The divider made it worse by being asymmetric: it *opened* on the `reconnecting` flag but
*closed* on a handshake. Any recovery that did not involve a handshake could therefore open
one and never close it.

**Fixed** in two matching halves:
- A frame is proof the connection is alive, whatever kind of frame it is. Any inbound frame
  now clears `reconnecting` and sets `connected`, via functional updaters that return the
  previous value unchanged so a healthy feed does not re-render once per frame.
- Whatever opens the divider closes it: `RingPane` draws "reconnected" on the
  `reconnecting` true→false transition as well as on a handshake, through the same grace
  timer, with `shouldAppendMarker` preventing a double.

Together with #127 this covers all three ways the pair could go wrong: tripping when nothing
was wrong, never re-subscribing, and never clearing while plainly connected.

**Status**: Fixed.

---

### 129. The console fought the reader's scroll — FIXED (unconfirmed on device)

**Root cause**: the console set `followOutput={false}` and drove its own scrolling — every
append ran `scrollToIndex({ index: 'LAST', behavior: 'smooth' })` inside a
`requestAnimationFrame`. An imperative smooth scroll is not cancel-aware. It keeps animating
while the reader drags against it, and during a fight the next event schedules another
before the previous has landed, so the view is pulled back to the bottom over and over. From
the reader's side the console simply will not scroll up.

The ring pane has always used Virtuoso's own `followOutput`, which stops following the
instant the reader leaves the bottom. That asymmetry is why only one pane was reported, and
it is the evidence the diagnosis rests on.

**Fixed** by converging the console onto `followOutput`, with the same policy the ring uses:
follow when at the bottom, or when `enable()` has forced it so a command you just sent
scrolls into view. The behavioural contract is unchanged — "follow new output only when
already at the bottom" — only the mechanism.

The test for that contract was pinning the *mechanism* (an imperative `scrollToIndex` per
append) rather than the behaviour, so it was rewritten to ask what the follow-output policy
decides, plus a guard that an append schedules no scroll of its own.

**Unconfirmed on device**: the failure is a touch drag racing a scroll animation, which
neither jsdom nor a headless Chromium render reproduces. See the standing limitation under
`10-bug-fixes.md` G.

**Status**: Fixed in code; unconfirmed on device.

---

### 130. A delayed hit landed with nothing tying it to the card that armed it — FIXED

**Root cause**: `DelayedHit` plays on one turn and resolves on a later one, when someone
else strikes. Both of its payoff narrations carry the card's 🤛; the setup line did not. So
a reader saw an unremarkable "X spreads his focus across the battlefield", and then, turns
later, a hit landing outside the normal turn order with only the reader's memory connecting
the two. Out-of-turn damage with no visible cause reads as the feed misbehaving rather than
as a card working.

**Fixed**: the setup line carries the icon too, so the same mark opens and closes the
sequence. Deliberately the smallest change that makes the link visible — no new wording,
since whether the trigger line should *name* the card is a voice decision and no card in the
engine currently names itself in narration.

**Found alongside it** (part of the "odd spacing" report): `delayed-hit.ts` held the only two
narrations in `cards/` that opened with a literal `\n`, which the feed rendered as stray
vertical space. Copy-paste drift — the other cards do not do it. Confirmed by sweeping the
directory.

**Also cleaned up while in there**: the trigger guard read
`!delayingTarget.encounterModifiers.timeShifted === true`, which parses as
`(!timeShifted) === true` — the same test, written as though comparing to `true`. Behaviour
unchanged; it now says what it means.

**Status**: Fixed.

---

### 131. A delayed hit fired with no stated cause — FIXED

Follow-up to #130, after the reporter pinned the confusion exactly: *"you play and see the
card in the feed like normal but then later the effect kicks in when someone else attacks
you. That later invocation is what can be confusing as to why it is happening."*

#130 had added the card's icon to the setup line so the same mark opened and closed the
sequence. That helps a reader who is looking for the link; it does not answer the question
being asked at the moment the hit lands. The trigger line read "X immediately responds to the
blow Y gave him" — which describes a spontaneous reaction, not a card resolving.

**Fixed**: both trigger lines name the card.

```
🤛 Stonefang spreads her focus across the battlefield, waiting for her enemy to reveal themselves.
…
🤛 Stonefang's Delayed Hit finds its moment: she immediately responds to the blow Emberclaw gave her.
```

Uses `this.cardType` rather than a literal, so a subclass narrates as itself.

**Why this is not a new house style**: `DelayedHit` is the only card whose effect resolves on
a turn that is not its own. Every other card resolves where it is played, so the reader infers
the cause from position in the feed and a self-naming line would be noise. The exception
exists because the inference is unavailable here, not because naming is generally better.

Verified by driving the real trigger path — register the encounter effect, have the other
monster strike, assert the narration names the card and the assailant — rather than by
asserting on the template.

**Status**: Fixed.

---

### 132. The console still re-pinned to the bottom — #129 fixed only half of it — FIXED

Found by Codex on the re-review of #372, and it is the more important of the two: #129's fix
was incomplete.

**Root cause**: `useFeedAutoScroll()` returned a fresh object literal on every render. Its
callbacks were memoised; the object holding them was not. `ConsolePane` depends on that
object in `useEffect(…, [isActive, autoScroll])`, so the effect re-ran on *every* render —
and appending a console event renders. For an active console that meant
`scrollToIndex({ index: 'LAST' })` plus `resetToBottom()` on every incoming event, so a
reader who had scrolled up was dragged back down by the next one.

That is the same symptom as #129, arriving through the "became active" path rather than the
append path. Removing the imperative scroll from the append path left this one untouched,
which is why the console would still have fought the reader after #129.

**Fixed**: `useFeedAutoScroll` memoises its return value, so the effect runs when `isActive`
actually changes — its stated purpose — and not on every render.

**The general lesson**: an unmemoised object returned from a hook is not a style question
once a consumer puts it in a dependency array. It silently converts "when this changes" into
"every render", and the effect here was one that moves the reader's viewport.

**Status**: Fixed.

---

### 133. A dead console swallowed the next handbook quick link — FIXED

Also from the #372 re-review, against #126's fix.

**Root cause**: `registerInsertFn` had no unregister. When a console unmounted — on a room
change, with the console in neither retained slot — its setter stayed in `insertFnRef`.
`insertCommand` then took the deliver-now branch, called into an unmounted component, and
therefore did *not* store the command as pending. The console that mounted a moment later
found nothing waiting for it, so the quick link did nothing: exactly the bug #126 set out to
fix, reintroduced through the stale-registration path.

**Fixed**: registration returns an unregister, and `ConsolePane`'s effect returns it as
cleanup. The unregister clears the ref only when it still points at that same registration,
so an older console's cleanup cannot clobber a newer console's.

**Status**: Fixed.

---

### 134. Naming an item to give selected it but never transferred it — FIXED

Found while reviewing the first-class items/shop work. The interactive `give item to
[monster]` path selected items and then entered the shared capacity-check and transfer
tail. The direct `give [item] to [monster]` path returned its selected array immediately,
skipping that tail entirely. The command could appear to succeed while inventories stayed
unchanged; it also bypassed the recipient's item-slot check.

**Fixed**: both named and interactive selection now converge before the encounter recheck,
slot trimming, announcement and transfer. Regression tests cover both the actual named
transfer and a full recipient, so the documented three-slot stocking rule is enforced for
the discoverable command as well as the prompt flow.

**Status**: Fixed.

---

### 135. Profile rows persisted full email addresses as display names — FIXED

The signup trigger stored `new.email` when identity metadata had no name. **Fixed**: it now
generates a stable pseudonymous handle, rejects email-shaped OAuth metadata, and migrates
existing email-shaped names. Read masking remains as defence in depth.

**Status**: Fixed.

---

### 136. Minimum damage rolls were highlighted as critical failures — FIXED

The console treated `naturalRoll.result === 1` as a critical failure without checking the
die, so an ordinary 1 on 1d6 received a `CRIT FAIL` badge. Inferred natural-1/natural-20
highlights now require `1d20`; explicit engine crit flags remain authoritative.

**Status**: Fixed.

---

### 137. Pane navigation and full-page navigation had no stated model — DECIDED

Six entry points had accumulated around workspace surfaces, making it unclear whether a
tab, shortcut or deep link should replace a pane or leave the room workspace.

**Decision**: ordinary in-app navigation reveals a surface in the workspace; only the
explicit “Open … as a full page” action navigates away. Direct standalone URLs remain
valid, mobile reveal selects its one visible slot, and returning restores persisted slots.
The implementation already followed this model; regression coverage and the workspace
design document now make it a contract rather than an accident.

**Status**: Decided and documented.

---

### 138. Prompt-free spawn passed a gender enum to an index-only helper — FIXED

The Workshop correctly submitted `female` / `male` / `androgynous`, but the engine spawn
helper treated every gender answer as an array index. A fully specified web spawn therefore
failed before constructing the monster even though the server mutation's mocked test passed.

**Fixed**: the engine helper accepts either a known enum string (typed callers) or the
existing numeric choice format (interactive channels), rejects unknown values clearly, and
has direct helper tests for all three paths. This closes the gap between the mocked router
test and the real engine call.

**Status**: Fixed.

---

### 139. Every leaderboard coin total stayed at zero — FIXED

Coin balances in engine state were changing, but the leaderboard's `coins_earned`
projection never saw those rewards. `ring.xp` reward events are private to the contestant;
the room event bus correctly delivered private events only to a subscriber with the matching
`userId`. The fight-stats subscriber has no player identity, so every reward skipped it and
every stats row retained the database default of zero. The event persister had the same
blind spot despite promising to persist every event, which also prevented a historical
reconstruction from durable events.

**Fixed**: the event bus now has an explicit `includePrivate` capability for trusted,
room-internal observers. The fight-stats projection and event persister opt in; ordinary
player/connector subscribers retain owner-only delivery. Tests prove that a private coin
reward updates the projection and persistence while remaining invisible to another player.

Existing lifetime totals cannot be reconstructed exactly: balances omit coins already
spent, and the missing private events were never persisted. Leaving every existing row at
zero was nevertheless not acceptable. On room load, the server now reconciles
`coins_earned` to at least the authoritative current character balance with a monotonic
`GREATEST(existing, balance)` upsert. This repairs all-zero/stale projections whenever a
player still holds coins, never lowers a valid total, and cannot double-count rewards. New
private reward events then accumulate normally; players whose historical balance was
already spent remain necessarily undercounted rather than being assigned invented coins.

Follow-up review found the same privacy boundary inside the ring: `ring-internal` dispatches
win/loss/draw/flee events into the stateful outcome handlers, but had not opted into private
delivery. Real draw events therefore never reached `handleTied`, even though a unit test that
emitted `creature.draw` directly passed. The dispatcher is now an explicit trusted private
subscriber, and the draw reward test exercises `Ring.fightConcludes` rather than bypassing
that production path.

**Status**: Fixed.

---

### 140. A partially failed card could freeze the live health bars — FIXED

The ring published `ring.state` after a card promise resolved, but not from its recovery
path. A card that changed HP or AC and then threw still produced narration and the fight
continued, while the persistent roster kept the snapshot from before that card. This made
health bars appear stuck near the end of a fight even as subsequent text described newer
damage and deaths.

**Fixed**: the card-failure path now publishes the resulting board before logging and
continuing, matching the success path. A regression card deals a finishing blow and then
throws; the test requires a public snapshot with the victim at zero HP and defeated.

**Status**: Fixed.

---

### 141. Boss-only cleanup kept full spectator pacing — FIXED

Once all human contestants were out, a multi-boss fight could spend many more full reading
pauses resolving a result no player could influence. The remaining encounter now runs at
2× speed whenever at least two active bosses and no active humans remain. The multiplier is
room-local and derived from live contestants, so simultaneous fights in other rooms retain
their own pacing. It covers card/turn gaps, nested cards and combat sub-events, then returns
to 1× for the next encounter. The speedup is latched through the current fight so defeating
one of the remaining bosses cannot make the final cleanup slow down again.

**Status**: Fixed.

---

### 142. A waiting Console prompt made autocomplete and Workshop controls look broken — FIXED

Interactive Console commands intentionally hold a per-player room lock while waiting for an
answer. During that wait, autocomplete is disabled (typed text is an answer, not a new
command) and prompt-free Workshop mutations such as Unequip are rejected to prevent engine
state from interleaving. The safety behavior was correct but almost invisible: the prompt
could be far above the mobile input, Workshop errors disappeared after five seconds, and a
Command Reference insertion could accidentally become the answer to the old question.

**Fixed**: the server exposes a membership-checked, room-scoped flow status. The Console
refreshes pending-prompt state, pins an explanation and Cancel action directly above the
input, and refuses command-link insertion while a question is active. The Workshop polls
the same status, disables its mutation controls, pins a clear blocking banner, distinguishes
a waiting question from a merely slow command, and can cancel the Console flow in place.
Two consecutive empty prompt polls also clear a stale local prompt after a reconnect where
the live cancel/timeout event was missed, without letting one older in-flight poll erase a
newly arrived question.

Follow-up review closed two gaps behind that banner: monster card slots and preset controls
now consume the shared busy state, and the inventory disables selection, equip and drop-zone
actions too. Mutation handlers also reject stale gestures locally before clearing selection,
so a control rendered just before flow status changed cannot still send doomed work.

**Status**: Fixed.

---

### 143. The shop's Items/Cards/Back Room menus were off by one, and one answer silently picked the wrong destination — FIXED

**Symptom**: clicking "1) Items" in the buy-menu prompt landed the player in the Back Room
instead; clicking "2) Cards" opened Items; clicking "3) Back Room" opened Cards. The sell
menu had the matching defect — "sell items" always sold cards instead.

**Root cause**: every other prompt in the engine renders its choices with `getChoices`
(`helpers/choices.ts`), which numbers options 0-based (`0) Foo`, `1) Bar`), and every other
dispatch site resolves the answer as that same 0-based index — `items/helpers/choose.ts`,
`creatures/edit.ts`, `monsters/helpers/spawn.ts`, `characters/helpers/create.ts`,
`characters/beastmaster.ts#chooseMonster`, and `items/scrolls/sorting-hat.ts` were all
audited and already followed this convention. The web client's `InlineChoices` component
(`apps/web/src/components/InlineChoices.tsx`) answers with that same 0-based index as a
string, so this convention is load-bearing, not incidental.

`items/store/buy.ts` and `items/store/sell.ts` were the only two call sites that hand-wrote
a 1-based numbered menu (`1) Items\n2) Cards\n3) Back Room`) and then dispatched with a
literal `Number(answer) === 1` / `=== 2` comparison — disagreeing with the question text
they themselves rendered. Because the final branch in both flows was reached by "none of
the above matched" rather than by an explicit check, the off-by-one didn't just show the
wrong menu — it silently routed the request to a *different, valid-looking* destination
(Back Room, or Cards) with no error and no indication anything had gone wrong. That's what
let it reach production: a numbering bug that produced a visible "no such option" error
would have been caught immediately, but one that quietly opens a different, working menu
looks like normal behavior to the player and passes a superficial test.

The existing tests reinforced the bug rather than catching it: they answered the prompt with
the same 1-based literal (`'1'`, `'2'`) the hand-written menu's *dispatch* code expected, so
they exercised the code's self-consistency, not its consistency with the labels it printed
or with what a connector actually sends back.

**Fixed**:
- Both menus now render their question text with `getChoices` and pass the same labels
  array as `choices`, so the printed numbering and the dispatch logic share one source of
  truth and cannot drift again.
- Answers are resolved with a new `resolveChoiceIndex(answer, labels)` helper
  (`helpers/choices.ts`) instead of a hand-written `Number(answer) === N` comparison. It
  accepts either the 0-based index (what the web client's `InlineChoices` sends) or the
  choice's label text case-insensitively (what the Discord connector's button `customId`
  sends back — see `packages/connector-discord/src/prompt-handler.ts`, which resolves with
  the button's label, never an index). `items/helpers/choose.ts` already accepted both
  forms for exactly this reason; `resolveChoiceIndex` generalizes that precedent so future
  hand-dispatched menus don't have to reinvent it.
- Both flows now dispatch explicitly on every valid choice (`selection === 0`,
  `=== 1`, `=== 2`) and end with an explicit `announceAndThrow` for anything that doesn't
  match, instead of letting an unrecognised answer fall through to the last branch. A
  malformed or stale answer is now a visible refusal, never a silent wrong destination.
- See `docs/prompt-answer-contract.md` for the protocol this documents (what a connector is
  expected to send back for a `{ question, choices }` prompt), and the "Prompt/Choices
  Answer Contract" note in `channel/index.ts` and `events/room-event-bus.ts`.
- Regression tests in `items/store/buy.test.ts` and `items/store/sell.test.ts` cover: the
  0-based index for each label reaching the matching branch (not the neighboring one), the
  Discord-style label answer reaching the same branch, and an unrecognised answer producing
  the explicit refusal rather than picking a branch. `helpers/choices.test.ts` covers
  `resolveChoiceIndex` directly (numeric index, numeric type, label case-insensitivity,
  out-of-range index, and unrecognised/empty answers).

**Status**: Fixed.

---

### 144. The Workshop shop never offered cards for sale — FIXED

**Symptom**: reported as "the shop seems to show different items based on whether you go
through console or workshop." The console's buy flow (`items/store/buy.ts`) has always
offered three menus — "Items", "Cards", "Back Room" — but the web Workshop's shop
(`ShopPanel.tsx`, backed by `router.ts`'s `summarizeShop`) only ever rendered `items` and
`backRoom`.

**Root cause**: `engine/src/items/store/shop.ts`'s `Shop` holds three independent stock
pools (`items`, `cards`, `backRoom`), but `summarizeShop` (`packages/server/src/trpc/
router.ts`) only summarized two of them, and `buyShopItem`'s `purchaseShopItem`
(`items/store/purchase.ts`) only knew how to complete a purchase from `items`/`backRoom` —
`ShopItemSection` didn't even have a `'cards'` variant. Any card the room shop had in stock
was invisible and unbuyable from the web app, full stop.

(At the time of this fix, `items/store/stock.ts#getCards` itself always returns `[]` —
cards for sale are not yet generated for *new* shops, a separate, pre-existing gap tracked
in `docs/roadmap/10-bug-fixes.md`. This fix closes the client-parity gap regardless: a
shop's `cards` pool can be non-empty from state persisted before that stub existed, or once
`getCards` is fixed, and the two clients reading the same room-scoped `Game.shop` must never
disagree about what's on sale.)

**Fixed**:
- `summarizeShop` now also summarizes `shop.cards`, priced at `shop.priceOffset * 2` — the
  same multiplier the console's `buy.ts` uses for its "Cards" menu (only the back room has
  its own, steeper `backRoomOffset`). Card ownership counts against `character.deck`, not
  `character.items` — the two inventories are unrelated, and counting a card against pocket
  items would always read "own 0" even when the player is carrying several.
- `ShopItemSection` (engine) and the `buyShopItem` procedure's input schema (server) gained
  `'cards'` alongside `'items'`/`'backRoom'`. `purchaseShopItem` now buys from `shop.cards`
  and calls `character.addCard` (not `addItem`) — cards go to the deck, items to the pocket
  inventory, reusing the same optimistic-concurrency guard (`expectedItemType`,
  `expectedClosingTime`) the other two sections already had.
- `ShopPanel.tsx` renders a "Cards for sale" section with the same list/price/owned/
  affordability treatment as "On the shelves", reusing the existing `.shop-stock-list`/
  `.shop-stock-row` classes (already responsive down to phone width — no new CSS needed).
- `useDeckWorkshop.ts`'s `buyShopItem` input type still only allowed `'items' |
  'backRoom'` — found while wiring the panel through; widened to match.
- Covered by `items/store/purchase.test.ts` (buy-a-card price/ownership/rejection cases),
  `trpc/router.test.ts` (shop summary includes cards; buying a card lands it in the deck,
  not the item list), and `ShopPanel.test.tsx` (renders cards, buys the exact stock token,
  shows "Sold out." when the section is empty).

**Status**: Fixed (Workshop/console parity). `getCards()` itself returning `[]` for newly
generated shops is a separate, pre-existing gap — see `docs/roadmap/10-bug-fixes.md`.

---

### 145. The Workshop wallet was invisible on load and up to 30 seconds stale after a fight — FIXED (but see correction: this was NOT the reported bug)

**Symptom**: reported as "I still see only 0 coins in the workshop view."

> **CORRECTION (2026-09-18, after this entry was written).** The conclusion below — that
> the reported `0` was not a data-integrity bug — is **WRONG**, and the staleness fix this
> entry describes does not resolve the player's report. The reporter subsequently confirmed
> 2 wins and 9 losses in the room with no shop purchases, which is at minimum 28 coins
> (2x5 + 9x2) before any daily bonus, yet the wallet still read 0. The investigation below
> reasoned from the reward path in isolation and never verified end-to-end that a *real*
> ring fight credits coins at all; it does not. See the open bug in
> [`10-bug-fixes.md`](10-bug-fixes.md) ("Fight rewards may never be credited") for the
> live investigation and the leading hypothesis. The staleness and visibility fixes below
> are still correct and still worth having — they are just not the bug that was reported.

**Investigation (superseded — see the correction above)**: the reported `0` was not a
data-integrity bug. `Game.awardFightCoins`
(`packages/engine/src/game.ts`) mutates `contestant.character.coins`, and `contestant.
character` is the exact same object reference as `game.characters[userId]` — confirmed by
tracing `sendMonsterToRing` (`trpc/router.ts` → `beastmaster.ts#sendMonsterToTheRing`, which
binds `character = this`) and by the existing coverage in `game.test.ts` (the cross-room-
leakage and daily-bonus tests assert on `character.coins` after emitting the same `win`/
`draw`/`permaDeath` events the ring emits, using that identical object). Coin persistence
round-trips correctly too: `coins` lives on `BaseCreature.options` (`creatures/base.ts`),
and both the state schema (`schemas/state.ts`'s `characters: z.record(z.string(),
z.unknown())`) and `hydrateCharacter` (`characters/helpers/hydrate.ts`) pass `options`
through unfiltered. A brand-new character genuinely starts at 0 coins (no starting-coins
constant sets a higher default), so "0 coins" for a player who has not yet completed a
fight is correct, not a bug.

The real defect was **staleness and visibility**, not correctness: `useDeckWorkshop.ts`'s
`shop` query only refreshed on a 30s `refetchInterval`, so a player who just finished a
fight could watch the coin reward announced in the feed and then wait up to half a minute
for the Workshop to agree — and the wallet was visible only inside the shop section, below
the monster row and inventory a player has to scroll past first.

**Fixed**:
- `WorkshopPanel` now listens for the room's private `ring.xp` event (emitted the instant
  `awardFightCoins` runs, for every fight outcome — see `Game.handleWinner`/`handleLoser`/
  `handlePermaDeath`/`handleFled`/`handleDraw`) and calls `refresh()` immediately when one
  arrives, instead of waiting for the next poll. It reads `RingFeedContext` directly rather
  than the throwing `useRingFeedListener`, because `WorkshopPanel` renders in two different
  contexts — inside a `Terminal` pane (which already wraps every pane in
  `RingFeedProvider`, per `docs/roadmap/20-workspace-layout.md`) and standalone via
  `WorkshopView`'s full-page route (which did not, until this fix — it now wraps its
  content in its own `RingFeedProvider`). Missing context is treated as "no live feed
  here," not an error, so the Workshop still works — just back to polling — wherever it is
  mounted.
- The coin balance is now also shown in the Workshop header (`.workshop-wallet`), visible
  without opening or scrolling to the shop section at all. It renders only once the shop
  query has actually resolved, so the loading window never displays a misleading "0 coins".
- Found in passing, not fixed: `.workshop-header-actions`'s mobile rule
  (`@container workshop (max-width: 520px)`) sets `justify-content: space-between;
  flex-wrap: wrap;`, but the class is never `display: flex` at any width, so those
  properties have always been a no-op — the header's buttons wrap via ordinary inline flow
  instead. Visually close enough that it was never reported, but real dead CSS. Left alone
  here (making the container an actual flex row is a layout change to a header shared by
  every Workshop screen, and `docs/roadmap/20-workspace-layout.md` already flags this
  header as one of the workshop's more mobile-regression-prone surfaces) — tracked in
  `docs/roadmap/10-bug-fixes.md`.
- Covered by `workshopPanel.wallet.test.tsx` (header wallet: hidden before the shop query
  resolves, singular/plural coin wording), `workshopPanel.liveWallet.test.tsx` (refreshes on
  `ring.xp`, ignores unrelated event types, does not throw without a provider), and the
  `workshopView.review-regressions.test.tsx` mock update for the new subscription.

**Status**: Fixed (liveness + visibility). No data bug found — see Investigation above.

---

### 146. Six prompt call sites resolved a Discord label answer as `NaN`, and `creatures/edit.ts#editSelf` renamed nothing — FIXED

Follow-up to #143 (item #4 in `10-bug-fixes.md`). The #143 audit found and fixed the two
call sites that had actually *drifted* from the engine's 0-based `getChoices` convention
(`items/store/buy.ts` / `sell.ts`). It also found six more call sites that were internally
consistent with that convention but resolved the answer as a **pure** index —
`array[Number(answer)]` — and therefore only worked for the web client. The Discord
connector's buttons answer with the choice's label text, never an index
(`packages/connector-discord/src/prompt-handler.ts#buildButtonRow`), so `Number("Basilisk")`
is `NaN` and `array[NaN]` is `undefined`.

**Root cause**: two connectors send different answer shapes for the same `{ question,
choices }` prompt, and until `docs/prompt-answer-contract.md` was written (as part of #143)
nothing said so — each call site was written against whichever connector its author had in
front of them at the time. `spawn.ts#askForGender` already carried an ad hoc label-or-index
workaround with a comment explaining why; every other site simply assumed an index.

**Fixed** — routed every one of the following through `resolveChoiceIndex(answer, labels)`
(`helpers/choices.ts`), with an explicit `announceAndThrow` for `-1` in place of letting
`undefined` fall through to whatever the next line did with it:

- `monsters/helpers/spawn.ts#askForCreatureType` — `allMonsters[answer as number]` was
  `undefined` on Discord, so spawning a monster failed outright. `askForGender`'s hand-rolled
  label-or-index handling now delegates to `resolveChoiceIndex` too, so there is exactly one
  implementation of that logic.
- `characters/helpers/create.ts#askForCreatureType`, `#askForGender`, `#askForAvatar` — same
  shape, same fix.
- `characters/beastmaster.ts#chooseMonster` — `monsters[answer as number]` was `undefined` on
  Discord, so every flow that asks "which monster" (equip, dismiss, revive, look-at when a
  player owns more than one) silently failed to resolve a monster.
- `items/scrolls/sorting-hat.ts` — `teamChoices[Number(answer)]` was `undefined` on Discord,
  and the very next line called `team.toUpperCase()` on it, throwing a raw `TypeError`
  instead of any user-facing message. The worst of the six: not a silent no-op like the
  others, an actual crash.
- `creatures/edit.ts#edit` — `optionKeys[index as unknown as number]` was `undefined` on
  Discord, propagating the literal string `"undefined"` into every subsequent question
  (`The current value of undefined is …`) instead of failing.

**A second, unrelated bug found and fixed in the same file while doing this**:
`creatures/edit.ts#editSelf`'s "Name" field was hardcoded to the option key `'givenName'`,
but the actual storage key `BaseCreature` reads from is `name` — the `givenName` getter in
`creatures/base.ts` reads `this.options.name`, never `this.options.givenName`. Every rename
through `editSelf` (the single-field "which field would you like to update" flow used by,
e.g., the `edit myself` command) therefore silently wrote a stray `givenName` option that
nothing ever read, and the character's or monster's display name never actually changed —
on either connector, independent of the index/label bug above. Caught by a regression test
that asserted the renamed value round-tripped through `.givenName` afterward, which failed
even with a correct numeric-index answer. Fixed by using the real key (`'name'`) while
keeping the "Name" label unchanged.

**Tests**: `monsters/helpers/spawn.test.ts`, `characters/helpers/create.test.ts` (new),
`characters/beastmaster.test.ts` (`chooseMonster` describe block, new), `creatures/edit.test.ts`
(new), and `items/scrolls/sorting-hat.test.ts` each cover, per site: a label answer (Discord
shape) reaching the right option, an index answer (web shape) reaching the right option, and
an unrecognised answer producing the explicit refusal rather than a crash or a silently wrong
pick. `docs/prompt-answer-contract.md` is updated to record these sites as compliant.

**Status**: Fixed.

---

### 147. Shop cards always empty — `getCards()` stubbed to `[]` behind a mis-diagnosed import cycle — FIXED

Item #5 in `10-bug-fixes.md`. `generateShop` (`items/store/shop.ts`) called `getCards()`
for every room shop, and `getCards()` was `(): any[] => []` — every shop's `cards` pool was
empty on both the console and the Workshop. The console shop menu's own item count ("We
have N items and M cards") always printed `M = 0`, and choosing "Cards" dead-ended on "We
don't have any cards here." The only route to new cards was random post-fight drops; buying
one was simply not implemented.

**Root cause, and why the stub survived**: the file carried an async `getCardsModule()`
behind a dynamic `import('../../cards/index.js')`, on the claim — asserted, never checked —
that a static import would create an import cycle between `items/store` and `cards`.
`getItems`/`getBackRoom`/`generateShop`/`resolveShop`/`Game#shop` are all synchronous, so
that async module could never actually be awaited from any of them; `getCards` was
hard-coded to `[]` specifically because there was no synchronous way to reach the
dynamically-imported module. The `try/catch` around the dynamic `import()` degraded to
`{ draw: () => null }` on any failure with no log line — silent by construction, which is
plausibly why a stubbed-out core feature (buying cards) went unnoticed long enough to ship
`ITEMS.md` copy and full server/web support (`summarizeShop`, `purchaseShopItem`,
`ShopPanel.tsx`) around a pool that could never contain anything.

**The cycle claim was checked and is false.** A dependency audit of everything under
`cards/` (every card file, `cards/base.ts`, and every file under `cards/helpers/`) found
that cards reach into `items/` only through `items/base.js` and individual
`items/helpers/*.js` files (`unique-items.js`, `is-matching.js`, `choose.js`) — never
through `items/index.ts` (the barrel `getCards`/`getItems` already import from for
`drawItem`/`sortItemsAlphabetically`) and never through `items/store/*`. There is no cycle.
Proven by actually doing it: `items/store/stock.ts` now statically imports `all`, `draw`,
and `sortCardsAlphabetically` from `cards/index.js`, `pnpm build` and `pnpm typecheck`
succeed across all five packages, and the full test suite (817/194/85/4/298 engine/server/
discord/harness/web) passes. The async `getCardsModule` indirection is deleted.

**Fixed**:
- `getCards()` draws a real inventory (`DEFAULT_MIN/MAX_CARD_INVENTORY_SIZE`, 4–10 — half
  of `getItems`'s 5–20 ceiling, because a card is a permanent deck upgrade rather than a
  consumable and the shop already lists cards in the same choice prompt as items, where a
  5–20 spread would make an already-long menu unreadable), filtered through the existing
  `canHoldStandard.canHoldCard` (`!notForSale && !neverForSale`) — previously defined but
  unused for this pool, same as items.
- The back room now stocks rare cards too, through `canHoldBackRoom.canHoldCard`
  (`notForSale && !neverForSale`) — also previously defined and unused. Sized smaller
  (1–2) than the back room's 1–3 items, priced through the same `backRoomOffset` (5.5–9.5x)
  as back-room items for consistency; most eligible cards already sit at the PRICEY/
  EXPENSIVE cost tiers (see `cards/*.ts`), so this is deliberately a rare treat, not a
  second full shelf.
- `cards/helpers/draw.ts#draw()` recurses forever if its creature-shaped filter excludes
  every card in the pool — unlike `drawItem`, it has no floor check, because it was only
  ever called with a real creature before, whose level gate always leaves *some* eligible
  card. A shop-stocking filter has no such guarantee. `stock.ts` now checks the eligible
  pool size up front (`drawEligibleCard`) and mirrors `drawItem`'s null-return contract
  instead of calling `draw()` on a filter that could exhaust the pool — contained entirely
  in `stock.ts`, `cards/helpers/draw.ts` itself is untouched.
- `getBackRoom()`'s mixed items+cards result is sorted as two independently-sorted blocks
  (items by `itemType`, cards by `cardType`) and concatenated, rather than sorted as one
  array on either key — items and cards don't share a sort key, so sorting the merged array
  on `itemType` (or `cardType`) leaves every entry of the other type comparing as
  `undefined` (always "equal") and stuck in draw order. That silently produces a
  half-sorted list rather than a visible failure, so it is called out here rather than
  patched over quietly.
- A second, related bug found and fixed in the same pass: `items/helpers/counts.ts#getItemCountsWithPrice`
  keyed strictly on `item.itemType`, so once the back room could contain cards (which have
  no `itemType`), every card in a priced choice list collapsed under the single key
  `"undefined"` and was priced/counted together instead of individually. `getItemCounts`
  (no price) and `getFinalItemChoices` already went through `getItemKey`
  (`itemType ?? cardType ?? name`); `getItemCountsWithPrice` was the one holdout. Fixed to
  use the same key.
- A third, independent bug found while wiring this up end-to-end: `characters/base.ts`'s
  `buyItems`/`sellItems` methods never passed `chooseCards` to `items/store/buy.ts`/
  `sell.ts` at all, so even with real stock the console/Discord Cards branch would still
  have dead-ended — on `buy.ts`'s "Cards are not available." refusal instead of "We don't
  have any cards here." `characters/base.ts` now statically imports `chooseCards` from
  `cards/helpers/choose.js` (safe for the same reason as above — nothing under `cards/`
  imports back into `characters/`) and passes it through on both methods.

**Pricing reality-check against early-game coin income (explicitly asked for, not
rebalanced here — a concurrent pass owns progression tuning)**: cards use the same cost
tiers as items (`helpers/costs.ts`: 10/20/30/50/80/130) and flow through the same
`priceOffset * 2` shelf markup (1.2–1.8x) as items, so the cheapest card costs the same
12–18 coins as the cheapest item — well inside a new player's reach per
`11-balance-and-mechanics.md`'s September 18 2026 economy audit (first win pays 10 coins
with the daily bonus; subsequent wins 5, losses 2, both with a tapering early-fight
bonus). No pricing problem found on the standard shelf. The back room is intentionally
steep: PRICEY/EXPENSIVE-tier cards (80/130) at 5.5–9.5x put back-room cards at roughly
440–1235 coins, matching the existing back-room-item economics exactly (same offset, same
tiers) — a deliberate rare-treat price, not a new imbalance introduced by this change.

**Tests**: `items/store/stock.test.ts` (`getCards` returns a non-empty, correctly-filtered
inventory; never leaks a `notForSale`/`neverForSale` card over repeated draws; `getBackRoom`
includes cards over enough draws), `items/helpers/counts.test.ts` (new — mixed item/card
pool pricing), and `items/store/buy.test.ts` (new end-to-end case: real `getCards()` stock
plus the real `chooseCards`, as `characters/base.ts` now wires it, reaches an actual card
purchase instead of either "not available" refusal).

**Status**: Fixed. `pnpm build`, `pnpm typecheck`, and `pnpm lint` (0 errors) all pass
repo-wide; `pnpm test` passes all five packages (817 engine / 194 server / 85 discord / 4
harness / 298 web, all green).

---

### 152. The Ring roster froze on stale numbers right when a fight concluded — FIXED

**Symptom**: a live-play screenshot showed the roster reading "2/3 standing" with a monster
at 4/31 HP directly under a feed banner announcing that fight had just concluded with 2
dead. The roster is supposed to be most trustworthy exactly at that moment — see
`18-live-ring-roster.md` — but instead it showed neither the truly final board nor an empty
one; it showed an unrelated, older snapshot.

**Root cause**: `Ring.clearRing()` runs after every fight, unconditionally, whether or not
any contestant survived — the ring always empties and players resend monsters for the next
one. It publishes the true final board (all deaths, final HP, `inEncounter: false`) via
`this.endEncounter()`, then immediately publishes a second, empty `ring.state` (`contestants:
[]`) once `this.contestants` is cleared. Both are correct and intentional on the engine side.

The bug was client-side, in `RingPane.tsx`'s derivation of which contestant list to render:

```ts
const rosterContestants = timerState.contestants && timerState.contestants.length > 0
  ? timerState.contestants
  : (ringState?.contestants ?? []); // the polled `game.ringState` query
```

This was written to mean "trust live pushes once they start arriving, otherwise seed from
the poll" (the comment above it said exactly that), but it actually tested
`.length > 0` — so a **legitimate empty push** (the second one from `clearRing()`) was
indistinguishable from "no live push has arrived yet," and the roster fell back to
`ringState`, a `refetchInterval: 60_000` query that could easily hold a snapshot from
before the fight even started. The true final board (the first push) may have rendered for
a moment, but the very next push — the empty one, sent synchronously right after — replaced
it with the stale poll data instead of with the intentional empty roster.

**Fixed**: a `hasLiveTimerStateRef` ref is set the first time any live `ring.state` (handshake
or push) is applied. Once set, `timerState.contestants` is used verbatim, including when it
is legitimately empty — the polled query is now only ever a cold-start seed before the first
live push, never a fallback that can override a live push arriving later.

**Test**: `apps/web/src/__tests__/ringPane-roster-freshness.test.tsx` — seeds a stale query
snapshot, pushes a live mid-fight `ring.state` with a death and confirms it wins over the
stale seed, then pushes the empty post-`clearRing()` `ring.state` and confirms the roster
goes empty rather than reverting to the stale seed.

**Status**: Fixed.

### 153. Answering a Console prompt could re-open its own "waiting for your answer" banner — FIXED

**Symptom**: a live-play screenshot showed the shop's Items/Cards/Back Room prompt with its
choice buttons visible and, directly below, "A command is waiting for your answer. Command
suggestions are paused." — for the very prompt the player was in the middle of answering via
those buttons.

**Root cause**: `ConsolePane` resumes prompts across reconnects with a 3-second
`pendingPrompt` poll (`trpc.game.pendingPrompt`, added in #142) alongside live
`prompt.request`/`prompt.timeout`/`prompt.cancel` events. `upsertPendingPrompt` — called from
both the poll effect and the reconnect handshake — unconditionally reset the matching
console event's `promptData` (`selectedAnswer: null, timedOut: false, cancelled: false`) and
re-armed `activePromptId` on every call, with no check for whether that requestId had already
been resolved locally.

A poll request already in flight when the player clicked a choice (or typed an answer, or
cancelled the flow) could land *after* `handleAnswer` had already cleared `activePromptId`,
still carrying the server's old "yes, this prompt is pending" snapshot from before the
answer was processed. Its stale response then re-armed `activePromptId` for the exact
requestId the player had just resolved — silently erasing the "you selected X" UI feedback
in the process — reopening the waiting banner for a prompt that, from the player's
perspective, was already done.

**Fixed**: a `resolvedPromptIdsRef` set records every requestId resolved locally —
`handleAnswer`, `handleCancelPrompt`, `handleCancelFlow`, the `prompt.timeout` and
`prompt.cancel` live-event handlers, and the poll's own two-consecutive-empty-polls
stale-clear all add to it at the point of resolution. `upsertPendingPrompt` checks the set
first and returns immediately for an already-resolved requestId, before touching
`consoleEvents` or `activePromptId` at all. (An earlier version of this fix tried to detect
"already resolved" by reading `consoleEvents` from inside the `setConsoleEvents` updater and
branching on it in code that ran immediately after — that does not work, because React does
not guarantee an updater function runs before the statement following the `setState` call;
the fix needed a plain ref set synchronously at the point of resolution instead.)

**Test**: `apps/web/src/__tests__/consolePane-scroll-behavior.test.tsx` — "does not reopen
the waiting banner when a stale poll echoes an already-answered prompt": answers a live
prompt by typing, confirms the banner clears, then replays the poll with the same requestId
still marked pending and confirms the banner stays closed.

**Status**: Fixed — but this was not the whole of what the screenshot showed. The same
capture recurred after this fix landed, and the remaining cause is #158: the banner was
*designed* to render for the entire unanswered life of a prompt, including while its choice
buttons are on screen.

### 154. Cloud Agent builds stopped at an unattended `fuse.conf` prompt — FIXED

**Symptom**: every recurring Cloud Agent environment build failed during the
Docker package installation with `INSTALL_FAILED`. The restored build had
`fuse3` and `fuse-overlayfs` unpacked but not configured, so dependency setup
never reached `pnpm install` or the monorepo build.

**Root cause**: the Cloud Agent base image already provides a locally managed
`/etc/fuse.conf` containing `user_allow_other`. Installing `fuse-overlayfs`
pulls in `fuse3`, whose package also owns that path. `apt-get install -y` does
not answer `dpkg` conffile questions; in an unattended environment build the
prompt received EOF, causing `dpkg` to fail and `apt-get` to exit with code
100.

**Fixed**: the Cloud Agent install runs `apt-get` with
`DEBIAN_FRONTEND=noninteractive`, `--force-confdef`, and `--force-confold`.
Package installation now resolves conffile decisions without a terminal while
preserving the base image's required `user_allow_other` setting. Other package
errors remain fatal under the script's existing `set -euo pipefail`.

**Test**: recovered the interrupted package state from failed build
`bld-20260919-8e276c16-17ef-496b-b22c-76e533c9db5f`, applied the same dpkg
policy, and confirmed that `fuse3` and `fuse-overlayfs` configured successfully,
`dpkg --audit` was clean, `/etc/fuse.conf` was unchanged, and Docker started.
Draft build `bld-20260919-f6f2a3ca-b8b3-41c7-8345-7b933fb6d9ce` then
completed from a fresh checkout with all five monorepo build tasks passing.

**Status**: Fixed.

### 155. Cloud Agent setup installed Railway into an unwritable global prefix — FIXED

**Symptom**: once Docker/FUSE package installation completed, the Cloud Agent
install stopped at `npm install --global @railway/cli` with `EACCES` while
trying to create `/usr/lib/node_modules`.

**Root cause**: the script's comment promised installation into the
NVM-managed Node prefix, but the command relied on npm's inferred global
prefix. Cursor exposes its own `/exec-daemon/node` before NVM's Node on
`PATH`; the NVM-managed npm executable therefore inferred the system prefix
from that Node runtime even though npm itself lived under
`~/.nvm/versions/node`. The unprivileged `ubuntu` user cannot write there.

**Fixed**: the install script derives the prefix from the resolved npm command
location and passes it explicitly with `--prefix`. Railway is installed beside
the NVM-managed npm binary, which is already on the agent's `PATH`, without
requiring root-owned global package state.

**Test**: with `node` resolving to `/exec-daemon/node` and npm resolving under
`~/.nvm`, the implicit global install reproduced `EACCES`; installing with the
derived NVM prefix succeeded and `railway --version` reported `5.30.3`. The
same installation completed without `EACCES` in the successful draft build.

**Status**: Fixed.

### 156. A revived monster sat at 1 hp for hours — every fight killed its healing timer — FIXED

**Symptom**: after a test battle a defeated monster was revived immediately, its revival
timer ran out, and it was still at 1 hp hours later. This is what PRs #380–#382 were
reaching for; they made healing wall-clock based (#151), which is why a server restart *did*
heal such a monster, and then stopped.

**Root cause**: `Ring.clearRing()` — which runs synchronously at the end of every fight, in
`fight().then(...)` right after `fightConcludes()` — called `disposeTimers()` on every
contestant's monster and character. `disposeTimers()` is `clearInterval(healingInterval)`
plus `clearTimeout(respawnTimeout)`. That was added in the April harness commit
(`3ca267a`) so throwaway simulation monsters would not keep the Node process alive, but
player monsters are not throwaway: they live on in their beastmaster's roster. So from a
monster's first fight onward its passive-healing interval was dead. Nothing called
`applyPassiveHealing()` again until the room was next restored from state, and the
respawn callback (`hp = 1, hpUpdatedAt = now`) had no interval behind it.

Sequence in the report: fight ends → `clearRing()` disposes Toyota's timers → owner types
`revive Toyota` → `respawn()` arms a fresh timeout (fine — `respawnTimeout` had been wiped)
→ timeout fires → 1 hp → no interval → 1 hp forever. #381/#382 never touched this because
their tests construct monsters directly and never run them through a ring.

**Fixed**: `clearRing()` and `removeMonster()` dispose only *transient* contestants
(`isBoss`, which also covers harness sim monsters — `buildContestant` marks them bosses).
Player monsters are torn down by their owners: `Game.dispose()` on room unload, and now
`Beastmaster.dropMonster()` on dismissal, which previously leaked the dropped monster's
interval and any pending revival. `disposeTransientContestant()` on `Ring` is the single
place that decides; see the ownership rule added to `engine-concurrency-and-timing.md`.

**Found alongside it**: the server's quick-action chips still offered `Revive X` for a
monster whose revival timer was already running. `Beastmaster.reviveMonster` has excluded
those since #380, so the chip could only answer "You don't have any monsters to revive."
`quick-actions.ts` now mirrors the same `respawnTimeout` exclusion.

**Tests**: `ring/index.test.ts` — "keeps passive healing and pending revivals running for
monsters the ring releases" (a wounded and a fallen player monster go through
`clearRing()`; the wounded one heals on the interval, the fallen one revives on schedule and
then heals). `beastmaster.test.ts` — "stops a dropped monster's background timers".
`quick-actions.test.ts` — "does not offer to revive a monster whose revival timer is already
running".

**Live verification** (Test Room A): Fang was killed in a three-way boss fight at 01:06:34,
`revive Fang` at 01:08:43 revived him instantly at 1 hp (beginner), and `look at monsters` at
01:11:45 read `hp: 6/30` — five ticks of `TIME_TO_HEAL_MS` after a fight had ended with
`clearRing()`. Chuvvo, left at 1 hp by an earlier fight in the same session, was back to
33/33 thirty-five minutes later. Both would have sat at 1 hp before this fix.

**Status**: Fixed.

### 157. A Delayed Hit fired after an unrelated card, answering a blow from a turn ago — FIXED

**Symptom** (live capture): Ben Franklin plays Heal and heals himself 3 hp. The next line is
"🤛 George Washington's Delayed Hit finds its moment: he immediately responds to the blow Ben
Franklin gave him." Ben gave no blow; he drank. Reported as delayed hits "playing at odd
times". #130/#131/#149 improved what the payoff *says*; none of them changed *when* it runs.

**Root cause**: the card arms a `ring.encounterEffects` closure that wraps every subsequent
card's `play()` and, after the play resolves, checks whether the delayer's newest hit from
someone else is newer than when the card was played. That check is per-wrapper and runs
once per play. When two Delayed Hits are armed — the default deck carries two copies, so a
two-monster fight where both decks hold one is routine — `applyEffects` nests the wrappers in
arming order, so the *earlier*-armed card's check runs before the *later*-armed card's
counter-attack lands. If that counter is itself the blow the earlier card was waiting for
(George armed first, Ben armed second, George strikes Ben, Ben's card answers by hitting
George), George's hit is recorded after George's wrapper already looked. It then sits
unanswered until the next card anyone plays — a Heal — whose wrapper finds it, fires, and
narrates it as a response to whatever that card was.

```
target arms Delayed Hit (T), then player arms Delayed Hit (P)
target strikes player            → chain is P(T(strike))
  T's check: no blow on target yet            → nothing
  P's check: target's strike                  → player counters, hits target   ← T missed this
next card anyone plays (a Heal)
  T's check: player's counter is newer        → fires, "responds to the blow"
```

Every other effect that deals damage (Immobilize's ongoing damage, Blink, Bad Batch) does so
*inside* the wrapped play, where the post-play check sees it; only another Delayed Hit's
counter lands after a check has already run.

**Fixed**: each armed effect exposes `settle()`; after any wrapped play, `settleDelayedHits`
runs every armed Delayed Hit in a loop until a full pass fires nothing. A counter that is
itself a qualifying blow is answered in the same play, immediately after it lands, which is
what "immediately hit the next player who hits you" says. Terminates because every counter
removes its own effect.

**Found alongside it**: `hit()` stamped `hitLog` entries with `Date.now()` while the card's
`whenPlayed` used `hitLogTimestamp()`. Under `DECK_MONSTERS_SKIP_DELAYS` (every test run and
every harness simulation) the latter is a small monotonic counter, so *every* recorded hit
looked newer than any Delayed Hit — the card fired on blows that landed before it was
played. Production was unaffected (both are `Date.now()` there), but the harness has been
mis-simulating this card since the counter was introduced. `hit()` now uses
`hitLogTimestamp()`.

**Residual, deliberately left**: Blink's `timeShifted` defers the check without clearing the
blow, so a hit taken just before a Blink is answered after the Blink ends, on whatever card
plays next. That is arguably the card working ("delayed"), and no report has named it.

**Test**: `cards/delayed-hit.test.ts` — "answers a blow dealt by another delayed hit in the
same play, not after the next unrelated card": arms target then player, strikes through the
real `play()` path, asserts both effects are spent and exactly one payoff fired, then plays a
Heal and asserts nothing fires.

**Status**: Fixed.

### 158. The "waiting for your answer" banner covered the very choices it was asking about — FIXED

**Symptom**: the shop's Items/Cards/Back Room prompt with its choice buttons on screen and,
pinned over the bottom of the feed, "A command is waiting for your answer. Command
suggestions are paused." Reported as the banner "displaying while you're actively trying to
answer questions for a multi-step command". The same screenshot had already been filed as
#153, which fixed a real stale-poll race but not this.

**Root cause**: the banner rendered on `activePromptId` alone — for the entire unanswered life
of every prompt. #142 introduced it because "the prompt could be far above the mobile
input", i.e. for a prompt the player *cannot see*; but nothing ever checked whether that was
the case. In the common case (`followOutput` keeps a new prompt as the last row, and the
banner is `position:absolute; bottom:100%` over the dock) the choices and the banner occupy
the same band of the screen, so the explanation for an invisible prompt sat on top of a
perfectly visible one. The header's own `Cancel action` button, gated the same way, made the
banner's button redundant there too.

**Fixed**: a `PromptVisibilitySentinel` is rendered at the end of the active prompt's row.
Virtuoso only mounts rows near the viewport, so unmounting is itself a "not visible" signal;
`IntersectionObserver` refines that for a mounted-but-scrolled row. The banner renders on
`activePromptId && !activePromptInView`. Where `IntersectionObserver` is unavailable, a
mounted row counts as visible.

**Test**: `apps/web/src/__tests__/consolePane-prompt-banner.test.tsx` — no banner while the
choices intersect the viewport; banner once they scroll out and gone again when they return;
banner for a prompt row Virtuoso has not mounted. The existing scroll-behavior tests never
mount rows and keep asserting the banner unchanged.

**Live verification** (Test Room A, 570px viewport): with an equip prompt's six choice
buttons on screen, `.command-blocked-banner` was absent; scrolling the console to the top
brought it in; scrolling back to the choices removed it again.

**Status**: Fixed.

### 159. The Ring and Console feeds stopped following on their own — and #148's fix made the Ring stop *silently* — FIXED

**Symptom**: during a live battle the Ring pane, in auto-scroll mode, would sit a line or
two above the newest narration and stay there while the fight went on. Reported after the
#148 "less likely to get stuck" pass as having got *worse* in an active battle.

**Root cause**, two layers:

1. The pane switched following off on *every* `atBottomStateChange(false)` from Virtuoso, as
   if the reader had scrolled up. But during a fight the bottom moves away on its own all the
   time: the roster gains a row or the items panel appears (viewport shrinks), a card box is
   measured after it renders (content grows), or a `smooth` follow scroll — which targets a
   fixed pixel offset — ends short because the next narration line landed mid-animation.
   Each of those flipped `shouldFollowOutputRef` to `false` in the busiest moments of a fight.
2. #148 tried to paper over that by raising `atBottomThreshold` from Virtuoso's default 4px to
   72px, so those small deviations would not count as leaving the bottom. But Virtuoso's own
   "list grew, snap back down" correction (`notAtBottomBecause === 'SIZE_INCREASED'` →
   `scrollToIndex('auto')`) only runs when it considers the list *not* at the bottom — and
   `isAtBottom` is `scrollTop + viewportHeight - scrollHeight > -threshold`. At 72px a follow
   scroll that ended up to three lines short was "at the bottom": never corrected, never a
   `↓ Latest` button, and the next event's smooth scroll got interrupted the same way. Hence
   worse specifically during bursts. (Virtuoso 4.18 source: `Uo` in `dist/index.mjs`.)

**Fixed** (`hooks/useFeedAutoScroll.ts`, used by both `RingPane` and `ConsolePane`): a
"not at bottom" report is treated as the reader leaving only if a scroll gesture — `wheel`
upward, `touchmove`, mouse `pointerdown` (scrollbar drag), or ArrowUp/PageUp/Home — happened
inside the feed within `USER_SCROLL_INTENT_WINDOW_MS` (1.5s). Otherwise the hook re-pins with
an instant `scrollToIndex('auto')` and reports "still at bottom", so `↓ Latest` does not
flash for the frame before the snap. The threshold is `AT_BOTTOM_THRESHOLD_PX = 8` on both
feeds — enough for fractional layout pixels, well under one line, so Virtuoso's
self-correction is live again. Jump-to-latest and tab activation clear the gesture stamp so
neither is mistaken for scrolling away a moment later. The listeners sit on
`.pane-feed-area` (spread from `gestureHandlers`) because Virtuoso owns the scroller element
and the events bubble.

**Console side, found during live verification**: the Console had the same rule and the
same failure through a different door — switching to the Console tab takes its viewport
from hidden to visible, Virtuoso reports that as "not at bottom", and the console parked one
screen above the reply to the command you had just typed, `↓ Latest` showing. The gesture
gate was therefore lifted into the shared hook rather than fixed in the Ring alone.

**Why the re-pin scrolls the DOM, not `scrollToIndex('LAST')`**: with the gate in place the
Console still sat exactly 52px short after a `look at monsters` reply. Instrumenting the
scroller showed both snaps (immediate, and one `REPIN_SETTLE_MS` later) targeting the same
offset, 52px above `scrollHeight - clientHeight`: `scrollToIndex` computes its target from
Virtuoso's size tree, which still held the 760px card row at an estimated height when the
callback fired. And because Virtuoso's own at-bottom state never returned to true, it
reported nothing further. The same thing left the `↓ Latest` jump 188px short — and since
both panes set `isAtBottom` optimistically on the click, the button was hidden *and* the
reader's next wheel-up produced no transition, so it never reappeared. The hook now takes
Virtuoso's `scrollerRef` and scrolls the element to its own `scrollHeight` (ground truth),
and `jumpToBottom` no longer claims "at bottom" — Virtuoso reports arrival itself, so the
button stays visible for the ~0.5s glide and disappears when the scroll actually lands.

**Live verification** (Test Room A, 570px viewport, a four-monster boss fight): 47 samples
over 70s of narration had the Ring feed within 2px of the true bottom in 46; the one 69px lag
(a smooth scroll in flight when a turn block landed) was gone by the next sample — the
self-correction the 72px threshold had been suppressing. 197 samples at 200ms after the
button fix: `↓ Latest` never rendered; five transient lags up to 160px (a card box landing)
all recovered within a second.

**Tests**: `apps/web/src/__tests__/ringPane-scroll-behavior.test.tsx` — re-pins when the
bottom moves with no gesture (and keeps the jump button hidden); wheel-up and touch-drag
disable following; a gesture 5s old is ignored; following resumes on return to the bottom;
jump-to-latest is not a scroll-away gesture; and the threshold is asserted ≤ 12px with a
comment on why. `consolePane-scroll-behavior.test.tsx` — the existing scroll-away cases now
perform a wheel gesture first, plus "re-pins instead of stopping when the bottom moves
without a reader gesture".

**Status**: Fixed.

### 160. Training a first monster from the workshop dead-ended without a character; players were asked to pick from one class — FIXED

**Symptom**: a brand-new player opens the Deck Workshop, sees "No monsters yet — cards need a
monster to live on", presses the one button on offer — **Train monster** — fills the form, and
gets an error banner: "Create your character before training a monster." Nothing in the
workshop creates a character. Separately, whoever did find their way to the console was asked,
as the very first question of the game, "Which type of character would you like to be?" over a
list containing exactly one entry.

**Root cause**: two independent gaps, both in the first sixty seconds of play.

1. `game.spawnMonster` (`packages/server/src/trpc/router.ts`) read `game.characters[userId]`
   and threw `NOT_FOUND` when it was missing. The console never hits this because
   `commands/index.ts` runs `game.getCharacter(...)` before every handler, which creates the
   character by *asking* for its details. Workshop mutations run on `createSilentChannel`,
   which throws on any `question` (docs/engine-concurrency-and-timing.md §2.3), so the
   workshop could not reuse that flow — and nobody had given it an alternative.
2. `createCharacter` (`packages/engine/src/characters/helpers/create.ts`) asked which class to
   be whenever `type` was not supplied, even though `characters/helpers/all.ts` has held
   exactly one entry (`Beastmaster`) for the whole life of the project.

A third bug surfaced while wiring the fix: `askForAvatar` resolved a *supplied* `icon` against
the seven **random** emoji it would have offered, as if it were an answer to the prompt. So any
caller that supplied an avatar was refused ("I don't recognize 🦊 as an avatar choice") unless
its pick happened to appear in that random seven. Nothing had ever supplied an icon before, so
the bug was invisible until the workshop form did.

**Fix**:

- **Engine** — `createCharacter` takes the only class without asking when `type` is undefined
  and `allCharacters.length === 1`; the prompt is left in place, commented, for a second class.
  A supplied `icon` is now used as-is. `randomAvatarChoices(count)` is exported (and re-exported
  from the package root) so the web offers the same avatars the console prompt does.
- **Server** — `game.spawnMonster` takes an optional `character: { name, gender, avatar }` and,
  inside the existing `runSerializedMutation`, creates the character via
  `game.getCharacter({ channel, id, name, type: 0, gender, icon })` — prompt-free because every
  question has its answer supplied. `game.findCharacterByName` is checked first, because the
  engine *re-prompts* on a name clash and that prompt would throw: a clash is a
  `CONFLICT "That name is already taken in this room."` The no-character-and-no-details error is
  now actionable rather than a dead end. `game.characterCreationChoices` supplies the form's
  genders/avatars/suggested name, and `myInventory.hasCharacter` lets the web tell "no
  character" from "no monsters".
- **Web** — with `hasCharacter === false` the empty state says the first Train will create the
  character, and the Train form grows an "About you" fieldset above the monster fields (name,
  pronouns labelled he/him · she/her · they/them over the engine's keys, avatar chips with a
  Shuffle). Players who already have a character see the form exactly as before.

**Tests**: `packages/engine/src/characters/helpers/create.test.ts` — the class question is never
asked, gender still is, the result is a Beastmaster, a supplied avatar survives, and
`randomAvatarChoices` offers seven. `packages/server/src/trpc/router.test.ts` — a real `Game`
ends up with a registered Beastmaster *and* the monster from one mutation; no details gives the
new actionable `NOT_FOUND`; a taken name is a `CONFLICT` with nothing created; an existing
character ignores the block; `characterCreationChoices` and `myInventory.hasCharacter` are
asserted. `apps/web/src/__tests__/workshopPanel.firstRun.test.tsx` — the fieldset appears only
for a first run, the payload carries the character block, Shuffle refetches without submitting,
and the existing-character form is unchanged.

**Status**: Fixed.
