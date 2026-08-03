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
