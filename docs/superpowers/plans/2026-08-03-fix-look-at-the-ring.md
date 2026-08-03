# Fix: `look at the ring` silent no-op

## Root cause

`packages/engine/src/commands/look-at.ts` passes the **channel function** into `game.lookAtRing` / `lookAtRingCards`, which expect a **string `userId`**. `Ring.look` publishes private events with that value as `targetUserId`. A Function never matches any subscriber's string `userId`, so announces are undelivered. The web console still shows the command echo (server-published separately) but no response.

## Approach

Pass `user?.id` (string) instead of `channel` for the three ring look cases. Match the pattern used by `sendMonsterToTheRing({ userId: user?.id })`.

## Files

| File | Change |
|------|--------|
| `packages/engine/src/commands/look-at.ts` | Destructure `user`; pass `user?.id` to `lookAtRing` / `lookAtRingCards` |
| `packages/server/src/integration/command-flow.test.ts` | Add integration tests: empty ring + ring with contestant |

## TDD

1. RED: Add test that runs `look at the ring` via `runCommand`, subscribes to event bus with `userId`, asserts private `announce` with correct `targetUserId` and text containing "empty" (empty ring) / contestant info (non-empty).
2. Confirm failure (no announces with matching targetUserId, or wrong target).
3. GREEN: Fix `look-at.ts`.
4. Re-run tests.

## Out of scope

- Refactoring `Ring.look` to use channel callbacks
- Web UI changes (filtering is correct)
- Docs roadmap archive (optional follow-up)
