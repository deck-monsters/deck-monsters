# Report: Fix `look at the ring` silent no-op

**Date:** 2026-08-03  
**Branch:** `cursor/fix-look-at-the-ring-42d2`  
**Plan:** [`2026-08-03-fix-look-at-the-ring.md`](./2026-08-03-fix-look-at-the-ring.md)

## Summary

`look at the ring` (and related `monsters in` / `cards in` ring look commands) published private `announce` events with `targetUserId` set to the **channel function** instead of the user's string id. Subscribers filter by string `userId`, so no output reached the web console.

**Fix:** Pass `user?.id` to `game.lookAtRing` / `game.lookAtRingCards` in `packages/engine/src/commands/look-at.ts`.

## TDD — RED

Added `describe('look at the ring', …)` to `packages/server/src/integration/command-flow.test.ts` with two cases subscribing to `game.eventBus` (not `channel.announces`).

### Run (before fix)

```text
$ pnpm --filter @deck-monsters/engine build
$ cd packages/server && pnpm exec mocha --config .mocharc.yml 'src/integration/command-flow.test.ts' --grep 'look at the ring'

  integration: command flow
    look at the ring
      1) announces an empty ring to the requesting user via the event bus
      2) announces ring contestants to the requesting user via the event bus

  0 passing (121ms)
  2 failing

  1) ... should publish private announces to USER_A
      + expected - actual

  2) ... should mention contestants: expected '\n\n' to match /contestant/i
```

**Interpretation:** With the bug, `Ring.look` called `pub(..., channel)` where `channel` is a function. Private announces were emitted with `targetUserId` equal to that function object, so `events.filter(e => e.targetUserId === USER_A)` matched nothing (test 1) or only unrelated bus traffic (test 2).

## TDD — GREEN

### Code change

`packages/engine/src/commands/look-at.ts`:

- Destructure `user` in `lookAtAction`.
- For `ring`, `monsters in`, and `cards in` cases: pass `user?.id` instead of `channel`.

### Test assertion fix

Ring `pub()` sets message text on `GameEvent.text`, not `payload.text`. Tests updated to use `e.text`.

### Run (after fix)

```text
$ pnpm --filter @deck-monsters/engine build
$ cd packages/server && pnpm exec mocha --config .mocharc.yml 'src/integration/command-flow.test.ts' --grep 'look at the ring'

  integration: command flow
    look at the ring
      ✔ announces an empty ring to the requesting user via the event bus
      ✔ announces ring contestants to the requesting user via the event bus

  2 passing (56ms)
```

### Broader verification

```text
$ pnpm --filter @deck-monsters/engine test
  657 passing (3s)

$ cd packages/server && pnpm exec mocha --config .mocharc.yml 'src/integration/command-flow.test.ts'
  134 passing (2s)
```

## Files changed

| File | Change |
|------|--------|
| `packages/engine/src/commands/look-at.ts` | Pass `user?.id` for ring look commands |
| `packages/server/src/integration/command-flow.test.ts` | New integration tests for empty and non-empty ring |
| `docs/superpowers/plans/2026-08-03-fix-look-at-the-ring-report.md` | This report |
