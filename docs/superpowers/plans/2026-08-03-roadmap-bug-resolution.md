# Roadmap Bug Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the remaining actionable bugs in `docs/roadmap/10-bug-fixes.md`, close stale or intentional items with evidence, and update the existing PR with tested fixes.

**Architecture:** Keep interactive command flows in per-`roomId:userId` lanes so one user's prompt cannot starve a room. Add narrow same-user coordination for prompt-free workshop work, connector-local flow coordination for Discord, durable room selection for Discord multi-room, and bounded persistence retries. Preserve room scoping at every database and event boundary.

**Tech Stack:** TypeScript strict ESM, pnpm/Turborepo, Mocha, Vitest, Fastify/tRPC, Drizzle/Postgres, discord.js v14.

## Global Constraints

- Every game-data query and event remains room-scoped; every room API validates membership.
- Never put a user-input wait in a room-wide lane.
- Interactive command actions use a `${roomId}:${userId}` lane and one active flow per room/user.
- Prompt cancellation must translate `PROMPT_CANCELLED` to `PromptCancelledError` before game code sees it.
- Use TDD for every behavior change: failing regression test, minimal fix, passing targeted suite.
- Keep each logical task in its own commit and run its package tests before review.
- No new dependency unless the existing platform/library cannot support the fix.

---

## Task 1: Fix environmental-death XP and phantom encounter state (#67, #68)

**Files:**
- Modify: `packages/engine/src/helpers/experience.ts`
- Modify: `packages/engine/src/creatures/encounter.ts`
- Add/modify tests near those modules
- Update: `docs/roadmap/10-bug-fixes.md`, `docs/roadmap/10b-bugs-fixed.md`

- [ ] Add a failing test proving a dead contestant without `killedBy` receives no “last one standing” XP.
- [ ] Add a failing test proving a read of `encounterModifiers` outside combat does not create `self.encounter`.
- [ ] Change XP calculation so survivor XP is only for living survivors/fleers.
- [ ] Return a shared immutable empty modifier view on reads; materialize encounter modifiers only on writes.
- [ ] Run targeted engine tests, then the full engine suite.
- [ ] Archive #67/#68 as fixed.
- [ ] Commit.

## Task 2: Preserve unknown cards without random mutation; close stale order/crit items (#65, #66, #69)

**Files:**
- Modify: `packages/engine/src/cards/helpers/hydrate.ts`
- Add: focused unknown-card representation under `packages/engine/src/cards/helpers/`
- Modify: hydrate tests and monster hydrate tests
- Modify: player/DM documentation for best-roll crit semantics
- Update roadmap archives

- [ ] Add failing tests proving unknown serialized cards are not replaced randomly and serialize back with their original identity.
- [ ] Implement an inert, visible unknown-card placeholder that cannot crash combat and retains original serialized data for repair.
- [ ] Add regression coverage proving equipped monster card order already survives hydrate unchanged.
- [ ] Keep character inventory alphabetical behavior; rewrite #65 as investigated/not a combat bug.
- [ ] Document that Lucky Strike/Rehit/Horn Swipe apply critical success/failure to the selected roll; close #69 as intentional.
- [ ] Run targeted and full engine tests.
- [ ] Commit.

## Task 3: Add bounded ordered retries to event persistence (#64)

**Files:**
- Modify: `packages/server/src/event-persister.ts`
- Modify: `packages/server/src/event-persister.test.ts`
- Reuse patterns from: `packages/server/src/fight-summary-writer.ts`
- Update roadmap

- [ ] Add failing tests for retry-then-success, exhaustion, preserved order, and detach during backoff.
- [ ] Implement bounded injectable backoff while retaining the single write queue.
- [ ] Ensure detach prevents delayed writes from surviving room unload/delete.
- [ ] Emit/log failure only after retries are exhausted.
- [ ] Run targeted and full server tests.
- [ ] Commit.

## Task 4: Prevent deleted-room resurrection and dispose deleted games (#71)

**Files:**
- Modify: `packages/server/src/room-manager.ts`
- Modify: `packages/server/src/room-manager.test.ts`
- Update roadmap

- [x] Add a controlled deferred-load regression test for delete racing `_loadRoom`.
- [x] Add a test proving `deleteRoom` disposes active games/subscribers/timers.
- [x] Add a deletion generation/tombstone (or equivalent) so stale loads cannot publish to `active`.
- [x] Ensure failed/stale loaded games are disposed.
- [x] Run targeted and full server tests.
- [x] Commit.

## Task 5: Enforce one Discord default room and persist each user's active room (#70, #72)

**Files:**
- Add: Supabase migration for default uniqueness and active-room mapping
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/connector-discord/src/guild-room-manager.ts`
- Modify: `packages/connector-discord/src/slash-commands/helpers.ts`
- Modify: create/join room commands and tests
- Update roadmap

- [x] Add failing tests for concurrent default creation and active-room selection after join/create.
- [x] Add a unique partial index for one default per guild.
- [x] Add a room-scoped, persistent `(guildId,userId) -> roomId` active-room mapping with foreign keys/cascade.
- [x] Make default creation tolerate the uniqueness race by re-selecting the winner and cleaning up any losing orphan room.
- [x] Make `/join-room` and `/create-room` select the resulting room; `resolveUser` uses active room then default.
- [x] Validate membership before returning an active room; fall back safely when stale.
- [x] Run server/Discord targeted and full tests.
- [x] Commit.

## Task 6: Coordinate same-user workshop and console mutations; document cross-user policy (#61, #62)

**Files:**
- Modify: `packages/server/src/trpc/router.ts`
- Modify: router tests
- Modify: `docs/engine-concurrency-and-timing.md`
- Update roadmap

- [ ] Add a failing test where workshop work is already running and the same user's console command attempts to start.
- [ ] Add a narrow same-user prompt-free mutation guard shared by workshop and console dispatch.
- [ ] Preserve the room-wide workshop lane for short shared mutations and per-user console lane for prompt flows.
- [ ] Explicitly document that cross-user prompt flows remain concurrent by design; shared mutation classes retain room-wide protection; fights remain outside lanes.
- [ ] Correct stale `RoomManager.runSerializedEngineWork` documentation.
- [ ] Run targeted and full server tests.
- [ ] Commit.

## Task 7: Support Discord free-text prompts and command serialization (#59, #60)

**Files:**
- Modify: `packages/connector-discord/src/prompt-handler.ts`
- Modify: `packages/connector-discord/src/guild-room-subscription.ts`
- Modify: `packages/connector-discord/src/slash-commands/helpers.ts`
- Modify: `packages/connector-discord/src/bot.ts`
- Add/modify tests
- Update concurrency docs and roadmap

- [ ] Add failing tests for a free-text DM answer, timeout/cancel translation, and a second concurrent same-user command.
- [ ] Implement a filtered Discord DM text collector using existing discord.js APIs.
- [ ] Ensure collectors accept only the expected Discord user/channel and clean up on timeout.
- [ ] Translate timeout/cancel to `PromptCancelledError`/expected refusal behavior.
- [ ] Add connector-local active flow ownership and dispatch actions through `RoomManager.runSerializedEngineWork(`${roomId}:${userId}`, ...)`.
- [ ] Keep prompt answers outside the lane so they can release the waiting action.
- [ ] Apply the same coordination to slash and free-text command paths.
- [ ] Run targeted and full Discord/server tests.
- [ ] Commit.

## Task 8: Align test harness with production command/prompt behavior (#73)

**Files:**
- Modify: `packages/engine/src/testing/index.ts`
- Modify: harness/engine integration tests
- Update roadmap

- [ ] Add failing tests for per-user lane keys and cancellation sentinel translation.
- [ ] Change the command runner API to include `userId` (or add a production-shaped helper and migrate callers).
- [ ] Translate `PROMPT_CANCELLED` to `PromptCancelledError` in test channels.
- [ ] Run engine and harness suites.
- [ ] Commit.

## Task 9: Unify the web ring feed subscription and cursor (#63)

**Files:**
- Modify: `apps/web/src/components/Terminal.tsx`
- Modify: `RingPane.tsx`, `ConsolePane.tsx`
- Add a shared hook/component if needed
- Add/modify Vitest component tests
- Update roadmap

- [ ] Add a failing test proving one `ringFeed` subscription serves both panes.
- [ ] Lift subscription, shared cursor, room guard, handshake handling, and reconnect ownership to `Terminal`/a shared hook.
- [ ] Keep pane-specific filtering/rendering/history merge logic; fan out each live event once.
- [ ] Ensure room navigation tears down the old subscription and resets cursor/history state.
- [ ] Run full web tests.
- [ ] Commit.

## Task 10: Differentiate DMG/CARDS content and finalize roadmap (#3)

**Files:**
- Modify: root build scripts and generated `DMG.md` / `CARDS.md`
- Modify/add build tests
- Update all roadmap indexes and active-known-bug docs

- [ ] Add a content/build test proving DM-only sections do not appear in CARDS.
- [ ] Add a concise “How to run the game” section and advanced rules/mechanics material to DMG generation.
- [ ] Regenerate documentation with `node ./build`.
- [ ] Remove resolved items from active bug tasks and archive each with root cause/tests.
- [ ] Run documentation/build checks.
- [ ] Commit.

## Task 11: Whole-branch review and final verification

- [ ] Generate a branch review package from `bba4b89` to `HEAD`.
- [ ] Run a Cursor Grok or Composer whole-branch review for correctness, room scoping, concurrency, and test quality.
- [ ] Fix and re-review every Critical/Important finding.
- [ ] Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm test`.
- [ ] Push all commits and update PR #361 with fixes, closed/tracked decisions, and test evidence.
