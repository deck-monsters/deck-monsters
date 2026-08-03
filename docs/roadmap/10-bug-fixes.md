# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt
**Priority**: Medium — content pass plus Discord/concurrency follow-ups from the 2026-08-03 audit.
**Status**: Active. Fixed items from this pass are archived in [`10b-bugs-fixed.md`](10b-bugs-fixed.md) (#51–#58, #59–#62, #63, #64, #65–#69, #70–#72, #73, #74–#78). What's open here: #3 (DMG/CARDS content).

## Code Quality Issues

### 3. `DMG.md` and `CARDS.md` are near-duplicates — content pass still open

Both files still exist at the repository root. The Dungeon Master Guide should contain different content (game master / advanced info) than the player-facing card reference. The build script headers are already differentiated — see #3 in `10b-bugs-fixed.md`.

**Status**: Open. Regenerating the `.md` files requires running `node ./build` after further content differentiation.
**Action**: Fully differentiate DMG vs. CARDS content (not just headers). Consider adding a how-to-run-the-game section to DMG per upstream #265.

## Audit follow-ups (2026-08-03) — tracked for a future pass

These were found during a full-stack bug audit. Clear, localized bugs from that pass were fixed as #51–#58 (see `10b-bugs-fixed.md`). The items below need more design, broader test coverage, or intentional product decisions before coding.

### 59. Discord free-text prompts (`question` without `choices`) are dropped — FIXED

`GuildRoomSubscription.buildPrivateChannel` only handled `question && choices` (button prompts). Engine flows that ask free-text questions (spawn name/color, character creation) returned `undefined` immediately on Discord.

**Fixed**: `PromptHandler.sendFreeTextDmPrompt` collects the next DM via `createMessageCollector`, filtering the exact Discord user + DM channel, cleaning up on answer/timeout/cancel. `buildPrivateChannel` handles `question` without choices, translates `PROMPT_CANCELLED` to `PromptCancelledError`, and preserves button prompts + requestId timeout cancellation. See [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §2 / Discord notes.

**Status**: Fixed. See `10b-bugs-fixed.md`.

### 60. Discord commands bypass engine serialization / `activeFlows` — FIXED

Web `command` uses per-user `runSerializedEngineWork` + `activeFlows`. Discord slash/DM paths previously `await`ed `action(...)` directly with no lane and no flow lock.

**Fixed**: shared `command-flow.ts` coordinator (`discordActiveFlows` ownership tokens + `runDiscordCommandAction`) used by both slash (`dispatchCommand`) and free-text (`dispatchFreeTextCommand`) paths. Actions run in `runSerializedEngineWork(`${roomId}:${userId}`)`; a second same-user flow throws `DiscordFlowBusyError` with actionable text; other users remain independent. Prompt collectors resolve outside the lane. See [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §2.

**Status**: Fixed. See `10b-bugs-fixed.md`.

### 61. Workshop mutations and console commands can interleave for the same user — FIXED

Workshop paths used a **room-wide** lane; console commands used a **per-user** lane. `activeFlows` blocked workshop when a console flow was active, but not the reverse — Workshop UI `equipCards` could run while a console equip flow was in flight for the same user.

**Fixed**: `activePromptFreeMutations` (`roomId:userId`, ownership token) is acquired synchronously at the start of `runSerializedMutation` and released in `.finally()`. The `command` mutation checks it before taking `activeFlows`, rejecting with a clear message when a workshop operation is in flight. Other users are unaffected. Covered by `router.test.ts` (deferred workshop, same-user console rejection, other-user acceptance, cleanup on resolve/reject).

**Status**: Fixed. See [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §2.

### 62. Cross-user concurrent engine access on web — DECIDED

Per-user console lanes mean two members of the same room can mutate one shared `Game` in parallel. Ring fights also run outside server lanes (timer chain). Multi-player rooms have a real race surface for deck/ring mutations.

**Decision**: Keep per-user lanes for interactive console flows (prevents #20 starvation). Workshop mutations that touch shared room state retain the room-wide lane. Cross-user prompt flows remain concurrent by design; fights remain outside lanes. Documented in [`docs/engine-concurrency-and-timing.md`](../engine-concurrency-and-timing.md) §2. Revisit only if a specific mutation class needs stronger ordering — add it to the room lane rather than moving console commands room-wide.

**Status**: Decided and documented.

## Investigated — not bugs (left for the record)

- **Discord `registerUser` subscriber “leak”** — `RoomEventBus.subscribe` uses a `Map.set` by id; re-register replaces the previous subscriber.
- **`fight-stats-subscriber` `log.error`** — the module-level `createLogger` is used inside handlers; the `(err) => void` parameter only shadows inside `attachFightStatsSubscriber` for `.catch(log)`.
- **`activeFlows` check-then-set race** — no `await` between `has` and `set` on the Node event loop, so concurrent HTTP handlers cannot interleave there.
- **`hydrateDeck` alphabetical sort (#65)** — intentional for character inventory UX (mirrors live `addCard`); equipped monster card order is already preserved by `monsters/helpers/hydrate.ts`. See `10b-bugs-fixed.md`.
- **Lucky Strike / Rehit / Horn Swipe discarded-roll crits (#69)** — intentional: Stroke of Luck / Curse of Loki apply only to the selected roll. Documented in player/DM materials. See `10b-bugs-fixed.md`.

## Tasks

- [ ] Audit and differentiate `DMG.md` vs `CARDS.md` full content; add how-to-run section (upstream #265) (#3)
- [x] Discord free-text prompt support (#59)
- [x] Discord serialization / `activeFlows` parity (#60)
- [x] Unify web `ringFeed` subscription / cursor (#63)
