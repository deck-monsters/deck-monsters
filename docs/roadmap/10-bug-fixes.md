# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt  
**Priority**: High (fix before major new development)  
**Status**: Active — one open bug: fight log sync (#15). Resolved: console history on reconnect (#16), event ring buffer gap detection (#17), quick actions emission (#18), engine timing/sync/multi-step crashes (#20), and the engine half of deck equip batch flakiness (#19 — batch RPC / UI flicker work still open). Two low-priority cleanup items remain (#3 DMG/CARDS, #5 creatures/base.ts).

## Active Bugs

### 15. Fights not being written to fight_summaries — HIGH

New fights are not appearing in the fight log at all — the problem is on the **write side**, not the UI refresh side. The `FightSummaryWriter` subscribes to `ring.fightResolved` and performs a DB insert, but there are several places where the insert can fail silently and the fight is lost permanently.

**Confirmed failure paths (in `packages/server/src/fight-summary-writer.ts`):**

1. **Data deleted before write** (line ~69): `pendingByRoom.delete(roomId)` runs synchronously before the async DB transaction completes. If the transaction throws, the `startedAt` timestamp and pending data are permanently lost.
2. **Errors silently swallowed** (line ~44): `void onFightResolved(...).catch(log)` — any DB error (constraint violation, connection failure, type mismatch) is only logged, never retried or escalated. The fight disappears without a trace beyond a log line.
3. **Possible UUID type mismatch**: `winnerOwnerUserId` / `loserOwnerUserId` are UUID columns in Postgres. If `ownerUserId` in the ring event payload is a non-UUID string (e.g. a Discord snowflake ID), the insert fails with a type error — silently swallowed per point 2.
4. **Concurrent fight race**: `pendingByRoom` is a plain `Map`. If two fights in the same room finish in close succession, the second `fightBegins` can overwrite the first's `startedAt`, and both `fightResolved` handlers operate on the same map entry.

The UI-side query (`queryRecentFights` in `analytics-queries.ts`) is simple and correct — if rows exist, they appear. The issue is that rows are not being created.

**Status**: Open. See GitHub issue for full plan.

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

### 19. Deck equip flaky with batches (workshop + console) — MEDIUM (investigation)

**Symptoms reported**: Equipping one card at a time works; multi-card flows (workshop multi-select / drag batch, console `equip … with "A", "B"` or interactive multi-pick) fail more often. Suspected escaping or “multiple bugs.”

**Findings (code review + server paths):**

1. **Server serialization (same room)** — Every card-management tRPC mutation runs inside `runSerializedMutation` → `RoomManager.runSerializedEngineWork` → `createKeyedPromiseQueue()` per `roomId`. **Sequential `await` calls from one browser tab cannot interleave** with each other on the engine object; state stays consistent. **Another tab or client** in the same room can still enqueue work between your mutations — rare for one user, possible for shared-room testing.

2. **Workshop batch + React Query** — `handleBatchMove` still runs **N mutations** for batch unequip / cross-monster move (`unequipCard` / `moveCard` in a loop). Each success **invalidates** `myInventory` / `myMonsters`, so the UI may **refetch between steps**. That usually causes **stale selection or flicker**, not wrong server state, unless the user acts again on outdated UI. **`equipCards` and `loadPreset` are single mutations** (good). Mitigations: batch RPC for multi-unequip / multi-move, or `mutateAsync` + single `invalidate` after the loop (defer invalidation in `useDeckWorkshop`).

3. **`loadPreset` copy cap (real bug, fixed)** — In `Beastmaster.loadPreset`, per-slot duplicate enforcement used `getItemKey(card) === requestedCard` (raw string from preset). **`equipCards` uses `getItemKey` on both sides** (via `selectedCard`). Presets saved via `savePreset` use `getCardName` (normal casing), but **legacy or edited presets** with different casing meant `selectedCount` stayed **0** for every entry, so **`MAX_CARD_COPIES_IN_HAND` never tripped** — you could exceed the per-card copy limit when loading a preset. **Fixed**: compare `normalize(getItemKey(card))` to `normalize(String(requestedCard))`.

4. **Console interactive equip vs typed `equipCards`** — `equipMonster` + `cardSelection` in `packages/engine/src/monsters/helpers/equip.ts` used strict `cardType` equality; **`equipCards` / `isSameCardName`** are more forgiving. **Aligned**: `cardSelection` resolution now uses `getItemKey` + trimmed lowercase.

5. **`getArray` parsing** (`packages/engine/src/helpers/get-array.ts`) — For `equip M with …`, strings wrapped in **double quotes** split only on `"(?:[\s,]|or|and)+"` — a card name containing **`"`** inside the list breaks parsing. Single-quoted lists split on `'(?:[\s,]|or|and)+'` — names with **`'`** (apostrophe) as delimiter are unsafe. Unquoted fallback strips **all** quotes via `/([^"']+)/`, which can mangle names that include quotes. Prefer JSON array input for exotic names; worth a doc note in player-facing help.

6. **InlineChoices + `chooseItems`** — Multi-select answers are comma-separated **indices** parsed by `getArray`; typed free-text answers in the console could still misfire if they do not match expected patterns.

**Suggested next steps**: (a) Optional **batch `unequipMany` / `moveMany` tRPC** + deferred invalidation to reduce workshop flicker. (b) Harness / unit tests for `getArray` with apostrophe card names and for preset load with mixed-case duplicate keys. (c) Reproduce multi-tab same-room if issues persist.

**Status**: Open for UX / batch API work; **preset copy-limit and `equip.ts` name matching** addressed in engine.

---

### 20. Engine timing / command-sync / multi-step command failures — FIXED

Three long-standing complaints traced to root causes and fixed together:

1. **Fights fly by in the live feed** — `Ring.fight()`'s normal card-play path paced card-to-card transitions with `subEventDelay()` (~0.7–1.3s) instead of the configured `veryShortDelay` (2–4s) used by every other fight path. The pacing system in `helpers/delay-times.ts` (deliberately doubled "to make ring fights easier to follow") was never consumed by the main loop. **Fixed**: the played-card path now waits `veryShortDelay(round)` between plays when delays aren't skipped; test/harness mode (`DECK_MONSTERS_SKIP_DELAYS`) is unchanged.

2. **Commands not followed / room appears out of sync** — the tRPC `command` mutation ran interactive actions inside the **room-wide** serialized engine lane. A single user's multi-prompt flow (up to 120s per prompt) held the lane for minutes, silently starving every other member's commands and hanging all awaited workshop mutations in the room. **Fixed**: command actions now serialize per `roomId:userId` lane (same-user ordering is what matters; `activeFlows` already prevents concurrent flows per user). Workshop mutations keep the room lane but now fail fast with `PRECONDITION_FAILED` when the caller has a console flow in progress, instead of hanging and interleaving.

3. **Complex multi-step commands crash/abort** — two compounding bugs: (a) cancelling a flow resolved pending prompts with the literal string `'__cancelled__'`, which no game code recognized, so it was parsed as a card/item selection; (b) `items/helpers/choose.ts` only accepted numeric indices — typing a card *name* produced `Number(name) → NaN` and aborted the entire flow via `Promise.reject(channel(...))` (rejecting with a Promise, so even the log was `[object Promise]`). **Fixed**: the engine exports `PROMPT_CANCELLED` + `PromptCancelledError`; the server channel wrapper translates the sentinel into a clean abort (suppressed in logs like prompt timeouts); `chooseItems` accepts indices **or** case-insensitive item names, skips invalid entries with an announce instead of aborting, and re-prompts via the existing flow when nothing valid was selected.

**Status**: Fixed. The full mental model of how pacing, serialization lanes, `activeFlows`, and the prompt lifecycle interact is documented in [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) — read it before changing any of these systems.

---

## Known Bugs (original list)

### 1. "Barely blocked" message fires incorrectly (upstream #181)

In `announcements/miss.ts`, the "barely blocked" flavor text fires when `attackResult > 5`. This means any miss with a roll above 5 says "barely blocked" — even when the attack wasn't close to hitting. The check should compare how close the roll was to the target's AC, not the raw roll value.

**Status**: Deferred — already resolved in the clean-room regeneration. The guard is correctly ordered; behavior matches original intent.  

### 2. curseOfLoki in cards/hit.ts — not dead code

The original doc flagged `curseOfLoki` as an unused variable. Investigation shows it is a real game mechanic (natural 1 / crit fail), used extensively across many cards: `hit.ts`, `heal.ts`, `berserk.ts`, `horn-gore.ts`, `lucky-strike.ts`, `cloak-of-invisibility.ts`, `immobilize.ts`, `rehit.ts`, and others. The `curseOfLoki` flag is computed in `helpers/chance.ts` and propagated through hit checks.

**Status**: Not a bug. This is a working mechanic.  
**Action**: Remove from the bug list. Document the Curse of Loki mechanic in the player handbook or DMG.

### 3. `DMG.md` and `CARDS.md` are near-duplicates

Both files still exist at the repository root. The Dungeon Master Guide should contain different content (game master / advanced info) than the player-facing card reference.

**Status**: Partially addressed. `build/card-catalogue.js` now generates a player-facing reference ("Player Reference: Cards available in the game — name, description, cost, and rarity"), while `build/dungeon-master-guide.js` generates a game master reference ("Full card stats, modifier math, damage-per-turn tables"). The headers differentiate the purpose. Regenerating the `.md` files requires running `node ./build` after further content differentiation.  
**Action**: Consider further: add a how-to-run-the-game section to DMG per upstream #265.

### 4. Battle history not persisted

`ring.battles = []` — battle history is reset on every `Ring` construction. Lost on every restart.

**Status**: Fixed. Battle history now stored via `setOptions({ battles })` and capped at the last 20 fights. Because it lives in `options`, it is automatically included in `BaseClass.toJSON()` and restored when `restoreGame()` is called. A `get battles()` accessor provides read access. A future event bus (`room_events`) could supplement this with a full persistent log.

## Code Quality Issues

### 5. `creatures/base.ts` is still large (~977 lines)

Reduced from ~2000 lines during the TypeScript migration, but still handles attack resolution, defense, item effects, stat modifiers, healing, and more in a single file.

**Status**: Partially addressed. Down from ~2000 to ~977 lines.  
**Action**: Continue incremental decomposition — extract focused modules like `creatures/combat.ts`, `creatures/stats.ts`, `creatures/items.ts`. Do this with test coverage to avoid regressions.

### 6. Hardcoded time constants — Done

Healing rate and resurrection time were magic numbers.

**Status**: Fixed. Extracted to `constants/timing.ts` as `TIME_TO_HEAL_MS` (300000) and `TIME_TO_RESURRECT_MS` (600000).

### 7. Hubot-specific AWS environment variable names — Done

**Status**: Fixed. `helpers/aws.ts` now reads `DECK_MONSTERS_AWS_ACCESS_KEY_ID` and `DECK_MONSTERS_AWS_SECRET_ACCESS_KEY`, with backward-compat fallback and deprecation warning for the old `HUBOT_` prefix.

### 8. CI configuration — Done

**Status**: Fixed. `.github/workflows/ci.yml` runs three parallel jobs: TypeScript type-check, lint, and tests. Triggers on push to `main` and all PRs.

## Small UX Fixes (Upstream)

These are small, self-contained improvements from the upstream issue tracker worth including in the initial revival:

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

## Tasks

- [ ] Fix fight log not updating after new fights complete (#15)
- [x] ~~Fix console pane not replaying history on reconnect~~ (done — cold-buffer DB fallback, #16/#17)
- [x] ~~Fix event ring buffer gap not signalled on reconnect~~ (done — `EventsSinceResult.status`, #17)
- [x] ~~Wire quick actions event emission after game commands~~ (done — `server/src/quick-actions.ts`, #18)
- [ ] Audit and differentiate `DMG.md` vs `CARDS.md`; add how-to-run section (upstream #265) — build headers differentiated, full content pass still todo
- [ ] Continue incremental decomposition of `creatures/base.ts`
- [x] ~~Fix "barely blocked" threshold~~ (already correct in TS migration)
- [x] ~~Battle history lost on restart~~ (done — stored in `options.battles`, capped at 20)
- [x] ~~Extract hardcoded time constants to `constants/`~~ (done — `constants/timing.ts`)
- [x] ~~Rename Hubot AWS env vars~~ (done — `helpers/aws.ts` with backward-compat)
- [x] ~~Add GitHub Actions CI workflow~~ (done — `.github/workflows/ci.yml`)
- [x] ~~Investigate curseOfLoki~~ (working mechanic, not a bug)
- [x] ~~Shop: show item ownership count~~ (done — `[own N]` appended in buy.ts)
- [x] ~~`look at cards`: numbered list display~~ (done — monsters/base.ts and characters/base.ts)
- [x] ~~Level-up public announcement~~ (done — `creature.levelUp` event + `announceLevelUp`)
- [x] ~~Monster manual: show stat ranges~~ (done — `src/build/monster-manual.ts`)
- [x] ~~Editable name/color fields~~ (done — `editSelf()` + `edit my character` command)
- [x] ~~Draw announcement at round 10~~ (done — PR #286)
