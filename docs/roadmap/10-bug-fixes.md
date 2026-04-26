# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt  
**Priority**: High (fix before major new development)  
**Status**: Active — 12 of 14 original items resolved. Five open bugs: fight log sync (#15), console history on reconnect (#16), event ring buffer gap detection (#17), quick actions emission (#18), and deck equip batch flakiness (#19). Two low-priority cleanup items remain (#3 DMG/CARDS, #5 creatures/base.ts).

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

### 16. Console pane missing historical data after returning — HIGH

When a player navigates away from the web app and returns (or reconnects after a disconnect), the console pane is empty — it only shows events that arrive after reconnection. Events that occurred while the player was absent are not replayed.

The reconnection-with-replay path was planned in `06a-web-app.md` (Phase 1: "reconnection with replay") but is apparently not delivering historical events in practice.

Likely causes:
- The replay cursor (last-seen event ID or timestamp) is not being sent on reconnect, so the server doesn't know what to replay
- Or the server-side replay query is not being triggered when a WebSocket/SSE client reconnects
- The tRPC subscription for room events may start from "now" rather than from the last-received event

**Investigation path**: Check the WebSocket reconnect handler in the web app — does it send a `since` parameter? Check the tRPC subscription procedure — does it accept and honor a `since` cursor? If both exist, check that they are wired together.

**Status**: Open.

---

### 17. Event ring buffer gap not signalled — MEDIUM

When a client reconnects with a `lastEventId` that has been evicted from the in-memory ring buffer (200-event cap, `packages/engine/src/events/room-event-bus.ts`), `getEventsSince()` returns an empty array silently. The client presents an incomplete replay with no indication that events were missed.

This is a direct contributing cause of bug #16 — for short disconnects the buffer is sufficient, but for longer absences (buffer evicted) the fallback to DB never fires.

**Fix needed**: When `lastEventId` is not found in the ring buffer, fall back to querying `room_events` in the database for the events since that ID. If the database also doesn't have them (older than retention window), emit a synthetic gap event so the client can show "some events were missed while you were away" rather than silently presenting a truncated stream.

**Status**: Open. Related to #16.

---

### 18. Quick actions suggestions not emitted after commands — MEDIUM

A TODO comment in `packages/server/src/trpc/router.ts` marks an unimplemented path: contextual `quick_actions` events should be emitted after each game command completes, populating the suggestions strip in the web console. Currently no `quick_actions` events arrive from the server after commands complete.

The web app already handles `quick_actions` events correctly — the suggestions strip is wired up — but it stays empty because the server never sends suggestions.

**Fix needed**: After `game.handleCommand` + action resolves, determine contextual suggestions (e.g. "look at ring", "look at monsters", "buy") based on game state and emit a `quick_actions` event to the requesting user's private channel.

**Status**: Open.

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
- [ ] Fix console pane not replaying history on reconnect (#16)
- [ ] Fix event ring buffer gap not signalled on reconnect (#17, contributes to #16)
- [ ] Wire quick actions event emission after game commands (#18)
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
