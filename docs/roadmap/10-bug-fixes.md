# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt
**Priority**: Medium — content pass plus Discord/concurrency follow-ups from the 2026-08-03 audit.
**Status**: Active. Fixed items from this pass are archived in [`10b-bugs-fixed.md`](10b-bugs-fixed.md) (#51–#58, #74–#77). What's open here: #3 (DMG/CARDS content) and #59–#73 (audit follow-ups that need a design pass).

## Code Quality Issues

### 3. `DMG.md` and `CARDS.md` are near-duplicates — content pass still open

Both files still exist at the repository root. The Dungeon Master Guide should contain different content (game master / advanced info) than the player-facing card reference. The build script headers are already differentiated — see #3 in `10b-bugs-fixed.md`.

**Status**: Open. Regenerating the `.md` files requires running `node ./build` after further content differentiation.
**Action**: Fully differentiate DMG vs. CARDS content (not just headers). Consider adding a how-to-run-the-game section to DMG per upstream #265.

## Audit follow-ups (2026-08-03) — tracked for a future pass

These were found during a full-stack bug audit. Clear, localized bugs from that pass were fixed as #51–#58 (see `10b-bugs-fixed.md`). The items below need more design, broader test coverage, or intentional product decisions before coding.

### 59. Discord free-text prompts (`question` without `choices`) are dropped

`GuildRoomSubscription.buildPrivateChannel` only handles `question && choices` (button prompts). Engine flows that ask free-text questions (spawn name/color, character creation) return `undefined` immediately on Discord. The web router supports free-text via `sendPrompt`.

**Action**: Add a DM text collector or modal path; translate timeout/cancel to `PromptCancelledError` like the web channel wrapper.

### 60. Discord commands bypass engine serialization / `activeFlows`

Web `command` uses per-user `runSerializedEngineWork` + `activeFlows`. Discord slash/DM paths `await action(...)` directly with no lane and no flow lock. Concurrent commands from the same user (or fights + commands) can interleave on one `Game`.

**Action**: Mirror web's per-`roomId:userId` lane and flow lock (or document Discord as intentionally best-effort and add minimal serialization).

### 61. Workshop mutations and console commands can interleave for the same user

Workshop paths use a **room-wide** lane; console commands use a **per-user** lane. `activeFlows` blocks workshop when a console flow is active, but not the reverse — Workshop UI `equipCards` can run while a console equip flow is in flight.

**Action**: Shared `${roomId}:${userId}` lane for both, or block console dispatch while a workshop mutation from the same user is in flight.

### 62. Cross-user concurrent engine access on web

Per-user lanes mean two members of the same room can mutate one shared `Game` in parallel. Ring fights also run outside server lanes (timer chain). Multi-player rooms have a real race surface for deck/ring mutations.

**Action**: Decide whether room-wide serialization (with careful prompt lane exceptions) is required, or which mutation classes must be room-serialized.

### 63. Dual `ringFeed` subscriptions per web client

`RingPane` and `ConsolePane` each subscribe independently with separate cursors/`seenRef`. Double server subscribers, double replay on connect, panes can diverge after partial reconnect. `Terminal.tsx` still has a TODO for unified tracking.

**Action**: Lift subscription (or at least cursor tracking) to `Terminal` and fan out events to both panes.

### 64. Failed event persistence is silently dropped

`event-persister.ts` logs insert failures and continues with no retry. Permanent holes in `room_events` cause reconnect gaps and stale history.

**Action**: Bounded retries (same pattern as fight-summary-writer) before dropping; metric on exhaustion.

### 65. `hydrateDeck` re-sorts alphabetically — deck play order not preserved

`cards/helpers/hydrate.ts` alphabetically sorts after hydrate. Ring combat uses `player.cards[cardIndex]` in array order, so restore/restart can change fight outcomes vs the saved deck order.

**Action**: Confirm whether alphabetical order is intentional for inventory UX; if not, preserve saved order for equipped decks (sort only for display catalogs).

### 66. Unknown card names on restore become a random draw

`hydrateCard` falls through to `draw({}, monster)` when the card class is missing. Renames/removals silently mutate decks.

**Action**: Fail closed, quarantine the card, or preserve a stub with the original name for admin repair — never silently replace with a random card.

### 67. Dead monsters without `killedBy` can get “last one standing” XP

`die()` only sets `killedBy` when `assailant` is a real creature. Synthetic / admin death paths leave it unset; `calculateXP` then takes the survivor branch.

**Action**: Treat `monster.dead && !killedBy` as a defeat with no survivor XP (or always set a sentinel `killedBy`).

### 68. `getEncounterModifiers()` materializes encounter state outside combat

Reading `encounterModifiers` creates `self.encounter` even when not in a fight, which can confuse `inEncounter` / serialization boundaries.

**Action**: Return a read-only empty object when `!self.encounter` instead of allocating.

### 69. Lucky Strike / Rehit can ignore Curse of Loki on discarded rolls

Only the “winning” roll’s crit flags are used. A natural 1 on a discarded first roll does not trigger Curse of Loki.

**Action**: Product decision — keep “best of N ignores discarded crit fails” or apply curse if *any* roll is a natural 1.

### 70. Guild default-room creation race

`guild_rooms` PK is `(guild_id, room_id)` with no uniqueness on `is_default`. Concurrent first-time `getOrCreateDefaultRoom` calls can create two default rooms for one guild.

**Action**: Unique partial index on `(guild_id) WHERE is_default`, plus transactional create-or-get.

### 71. `deleteRoom` vs concurrent `_loadRoom` can resurrect a deleted room in memory

A load that already read the DB row can finish after `deleteRoom` removed the `active` entry and DB row, then `active.set` a ghost room.

**Action**: Recheck room existence (or a generation token) before inserting into `active`.

### 72. Discord always targets the guild default room

`resolveUser` always calls `getOrCreateDefaultRoom`. `/join-room` adds membership elsewhere, but subsequent slash commands still hit the default room.

**Action**: Track per-user active room for the guild (or require an explicit room option on commands).

### 73. Test harness lane key does not match production

`createRoomCommandRunner` serializes by `roomId` only; production console commands use `${roomId}:${userId}`. Integration tests can hide cross-user interleaving.

**Action**: Align harness helpers with production lane keys and `PROMPT_CANCELLED` translation in `createTestChannel`.

## Investigated — not bugs (left for the record)

- **Discord `registerUser` subscriber “leak”** — `RoomEventBus.subscribe` uses a `Map.set` by id; re-register replaces the previous subscriber.
- **`fight-stats-subscriber` `log.error`** — the module-level `createLogger` is used inside handlers; the `(err) => void` parameter only shadows inside `attachFightStatsSubscriber` for `.catch(log)`.
- **`activeFlows` check-then-set race** — no `await` between `has` and `set` on the Node event loop, so concurrent HTTP handlers cannot interleave there.

## Tasks

- [ ] Audit and differentiate `DMG.md` vs `CARDS.md` full content; add how-to-run section (upstream #265) (#3)
- [ ] Discord free-text prompt support (#59)
- [ ] Discord serialization / `activeFlows` parity (#60)
- [ ] Workshop ↔ console same-user interleave guard (#61)
- [ ] Decide room-wide vs per-user engine serialization for multi-player (#62)
- [ ] Unify web `ringFeed` subscription / cursor (#63)
- [ ] Event persister retries (#64)
- [ ] Preserve equipped deck order on hydrate (#65)
- [ ] Fail closed on unknown card hydrate (#66)
- [ ] XP for deaths without `killedBy` (#67)
- [ ] Lazy `getEncounterModifiers` (#68)
- [ ] Lucky Strike / Rehit curse semantics (#69)
- [ ] Guild default-room uniqueness (#70)
- [ ] `deleteRoom` / `_loadRoom` race (#71)
- [ ] Discord active-room tracking (#72)
- [ ] Align test harness lanes with production (#73)
