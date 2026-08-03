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

---

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

Full investigation notes and the still-open batch-UX work are in `10-bug-fixes.md` (#19). Two concrete engine bugs found during that investigation were fixed:

1. **`loadPreset` copy cap (real bug, fixed)** — In `Beastmaster.loadPreset`, per-slot duplicate enforcement used `getItemKey(card) === requestedCard` (raw string from preset). **`equipCards` uses `getItemKey` on both sides** (via `selectedCard`). Presets saved via `savePreset` use `getCardName` (normal casing), but **legacy or edited presets** with different casing meant `selectedCount` stayed **0** for every entry, so **`MAX_CARD_COPIES_IN_HAND` never tripped** — you could exceed the per-card copy limit when loading a preset. **Fixed**: compare `normalize(getItemKey(card))` to `normalize(String(requestedCard))`.
2. **Console interactive equip vs typed `equipCards`** — `equipMonster` + `cardSelection` in `packages/engine/src/monsters/helpers/equip.ts` used strict `cardType` equality; **`equipCards` / `isSameCardName`** are more forgiving. **Aligned**: `cardSelection` resolution now uses `getItemKey` + trimmed lowercase.

**Status**: Fixed (these two items only — see #19 in `10-bug-fixes.md` for what's still open).

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

`packages/engine/src/items/store/shop.ts`'s `getShop()` was a module-level `throttle()`-wrapped function with a single `currentShop` variable, regenerated once per 8 hours **for the entire process**, not per room. Every room on a multi-room server shared the exact same shop inventory, closing time, and prices — one room buying out an item mutated the shared `shop.items`/`shop.cards`/`shop.backRoom` arrays via `.splice()`/`.push()` in `buy.ts`/`sell.ts`, affecting every other room simultaneously. This directly conflicted with `CLAUDE.md`'s room-scoping rule.

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

- **`pnpm typecheck` did not exist.** `CLAUDE.md` documented it as a development command, but no package defined a `typecheck` script, so the command failed outright and CI's type-checking had to be reproduced by hand as per-package `tsc --noEmit` invocations. Added a `typecheck` script to all five packages plus a root `turbo run typecheck` (with `dependsOn: ["^build"]`, since the non-engine packages type-check against `engine/dist`).
- **`README.md`'s engine example** called `player.buyItems()` with no arguments; the per-room shop work made `channel` and the `ShopHost` required, so a JavaScript consumer copying it would dereference `host.shop` on `undefined`. Updated to `player.buyItems(privateChannel, game)`.
- **Player handbook said the merchant rotates every 8 hours**, which was the old throttle period — it is 6 now, and per-room. Fixed in both generators (`packages/engine/src/build/player-handbook.ts` for the in-game `look at player handbook`, and `build/player-handbook.js` for `PLAYER_HANDBOOK.md`) and regenerated.

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

### 3 (partial). `DMG.md` and `CARDS.md` are near-duplicates — build headers differentiated

The Dungeon Master Guide should contain different content (game master / advanced info) than the player-facing card reference. `build/card-catalogue.js` now generates a player-facing reference ("Player Reference: Cards available in the game — name, description, cost, and rarity"), while `build/dungeon-master-guide.js` generates a game master reference ("Full card stats, modifier math, damage-per-turn tables"). The headers differentiate the purpose.

**Status**: Headers fixed. The remaining full-content differentiation pass and the how-to-run-the-game section are tracked as open work in `10-bug-fixes.md` (#3).

### 4. Battle history not persisted

`ring.battles = []` — battle history is reset on every `Ring` construction. Lost on every restart.

**Status**: Fixed. Battle history now stored via `setOptions({ battles })` and capped at the last 20 fights. Because it lives in `options`, it is automatically included in `BaseClass.toJSON()` and restored when `restoreGame()` is called. A `get battles()` accessor provides read access. A future event bus (`room_events`) could supplement this with a full persistent log.

### 5. `creatures/base.ts` size reduction — FIXED

Reduced from ~2000 lines to ~977 lines during the TypeScript migration by extracting focused logic (`stats.ts`, `health.ts`, `encounter.ts`, `items.ts`). By the time this pass revisited it, attack/defense resolution already lived in `health.ts`/`cards/` — there was no "combat" logic left in `base.ts` to extract into a `creatures/combat.ts`, so a further pass extracted the two things that actually had content: `creatures/types.ts` (the ~100 lines of exported interfaces/type aliases — `CardInstance`, `CreatureOptions`, `Encounter`, `ChannelFn`, etc. — re-exported from `base.ts` via `export * from './types.js'` so no downstream import changes) and `creatures/edit.ts` (`editSelf`/`edit`, following the existing free-function-taking-the-creature pattern already used by `health.ts`/`items.ts`). `base.ts` is now ~420 lines of getters/setters and thin one-line delegation to sibling modules.

**Status**: Fixed.

### 6. Hardcoded time constants — Done

Healing rate and resurrection time were magic numbers.

**Status**: Fixed. Extracted to `constants/timing.ts` as `TIME_TO_HEAL_MS` (300000) and `TIME_TO_RESURRECT_MS` (600000).

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

**Fixed**: `useRingFeed` / `RingFeedProvider` in `Terminal` owns the single subscription, shared cursor (skips `handshake`/`heartbeat`; advances on live events; `onError` resumes from the latest tracked id), room guard, and handshake. Live events fan out once to pane listeners via `useRingFeedListener` (listener identity is ref-stable so callback churn cannot restart the subscription). Each pane keeps its own DB history fetch, merge/dedup (`seenRef`), and filters. Room navigation resets the shared cursor and tears down the old subscription input. Covered by `useRingFeed.test.ts` and `terminal-ring-feed.test.tsx`.

**Status**: Fixed. See [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §5.
