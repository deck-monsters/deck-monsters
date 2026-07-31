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

**Known residual gap (accepted)**: a fight that errors mid-combat takes `Ring.fight()`'s `.catch` path, which clears the ring without publishing `ring.fightResolved` — cancelled fights intentionally never reach history. A server restart mid-fight likewise loses that fight.

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

### 5 (partial). `creatures/base.ts` size reduction — TypeScript migration pass

Reduced from ~2000 lines to ~977 lines during the TypeScript migration by extracting focused logic. It still handles attack resolution, defense, item effects, stat modifiers, healing, and more in a single file.

**Status**: This reduction is done. Continued incremental decomposition (`creatures/combat.ts`, `creatures/stats.ts`, etc.) is tracked as open work in `10-bug-fixes.md` (#5).

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
