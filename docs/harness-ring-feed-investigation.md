# Ring feed ordering and harness motivation

This note records **why** the local simulation harness (`@deck-monsters/harness`) was added: to reproduce and study **public ring message ordering** and related stability issues without running the full web stack.

## Initial issue (reported)

Users observed the browser **Ring** pane showing **battle narration in a logically inconsistent order**. Examples from real sessions included:

- **HP and outcomes appearing out of sync** — e.g. lines suggesting a creature was killed or at a given HP adjacent to text that implied a different game state (healing, damage, or "killed" lines not reading as a single coherent timeline).
- **Turn / round headers** (`round N, turn M`) sometimes appearing **next to the wrong actions** relative to a strict turn-by-turn reading.
- **Interleaved or duplicated-looking blocks** when multiple narrations were active in one fight.
- Separate reports that the experience **"potentially also caused crashes"** (client or server not fully pinned down at the time of investigation).

The legacy **`battlefield.js`** demo exercised an older API surface and did not mirror the **event bus → WebSocket ring feed** path the web app uses today, so it was a poor fit for validating ordering hypotheses.

## Root cause analysis

### 1. Concurrent engine entry points — confirmed root cause

The tRPC router's `game.command` handler fires the engine action without awaiting it:

```typescript
// packages/server/src/trpc/router.ts
void action({ channel, channelName, isAdmin, isDM, user })
    .catch((err) => { ... })
    .finally(() => { activeFlows.delete(flowKey); });

return { ok: true, commandId };  // returns immediately
```

The `activeFlows` lock key is `${roomId}:${userId}` — **per-user, not per-room**. This means:

- User A and User B can both call `game.handleCommand()` on the **same `Game` instance** simultaneously with no throttling between them.
- Each command's async chain (`ring.fight()` / `card.play()` / `eventBus.publish()`) runs concurrently.
- Events from User A's fight narration and User B's command response interleave freely in the event bus.

**This is the primary cause of out-of-order narration.** The fix is a per-room lock:

```typescript
// Change the lock key from:
const flowKey = `${input.roomId}:${ctx.userId}`;
// To:
const flowKey = input.roomId;
```

This serializes all commands in a room, eliminating concurrent Game access. The trade-off — User B waits for User A's command to complete — is acceptable because interactive commands resolve in seconds. The ring's own auto-fight timer is unaffected since `startFightTimer` fires independently of the command path.

### 2. Async combat loop widens the interleave window

The `ring.fight()` method is a long promise chain with `setTimeout` delays between every card play (150–300ms, configured in `helpers/delay-times.ts`). Each `setTimeout` yields the Node.js event loop, creating a window where other `eventBus.publish()` calls can execute mid-fight.

With a per-room lock (fix above), this ceases to be a problem — no other command can run while a fight is in progress. Without the lock, the delays make interleaving almost certain in any active room.

### 3. Weak total ordering on events — local ordering is fine, reconnect is not

**Local delivery** is correct: `RoomEventBus.publish()` delivers synchronously to all subscribers in insertion order:

```typescript
// packages/engine/src/events/room-event-bus.ts
for (const subscriber of this.subscribers.values()) {
    subscriber.deliver(fullEvent);  // synchronous, Map iteration = insertion order
}
```

The real ordering weakness is on **client reconnect**. The event bus maintains a ring buffer of the 200 most recent events (`RING_BUFFER_SIZE`). When a client reconnects with a `lastEventId`, it receives buffered events since that ID. If more than 200 events were published while the client was disconnected, the buffer has already discarded the oldest — and **the client receives no signal that history is incomplete**. It simply gets a partial replay that reads as if events were dropped.

Additionally, event IDs are `${Date.now()}-${randomUUID().slice(0, 8)}`. Events published in the same millisecond share a timestamp, so timestamp-based sorting alone cannot reconstruct causal order after a gap.

**Fix for reconnect truncation:** send a synthetic `gap` event as the first item when the requested `lastEventId` is no longer in the buffer, so clients can show "you missed some events" rather than silently presenting incomplete narration.

### 4. Exploration and creature timers — process hygiene, not an ordering cause

Long-lived `setInterval` / `setTimeout` loops (exploration tick, passive creature healing, respawn waits) were found to keep the Node process alive during early harness experiments. This is a **separate issue from ordering** and has been partially addressed in this PR via `Exploration.dispose()`, `BaseCreature.disposeTimers()`, and the updated `Game.dispose()` and `Ring.clearRing()`. It does not contribute to the narration ordering bugs.

## What the harness is for

- Run **extended, repeatable** ring scenarios locally (`DECK_MONSTERS_SKIP_DELAYS` for fast fights).
- Capture the **public** `RoomEventBus` stream **in delivery order** (`capturePublicFeed`) to test ordering hypotheses.
- Add scenarios that mirror **production wiring** (`createTestGame`, `runCommand`, auto-responders) without HTTP or Postgres.
- Support **seeded RNG** (`--seed`) for deterministic fight replays when investigating race conditions vs. logic bugs.

Future harness scenarios should assert on **semantic event ordering** (e.g. that round headers precede card plays, that a "killed" event is not followed by damage events for the same creature) rather than just checking that events were captured.

## Related code (starting points)

| Area | Role |
|------|------|
| `packages/server/src/trpc/router.ts` | `game.command` — fire-and-forget actions, per-user `activeFlows` lock (needs to become per-room) |
| `packages/engine/src/events/room-event-bus.ts` | Synchronous fan-out; order is correct locally but ring buffer (`RING_BUFFER_SIZE = 200`) causes silent truncation on reconnect |
| `packages/server/src/trpc/router.ts` (`ringFeed`) | WebSocket subscription queue; reconnect path uses `getEventsSince(lastEventId)` with no gap signal |
| `packages/engine/src/ring/index.ts` | `fight()` — long async chain with `setTimeout` delays between each card play |
| `packages/engine/src/channel/index.ts` | Legacy `ChannelManager` batching (Slack-era); not the web ring path |
| `packages/harness/` | CLI + public feed capture + scenarios |

## Status

| Issue | Status | Next step |
|-------|--------|-----------|
| Per-user lock allows concurrent Game access | **Root cause, unresolved** | Change `activeFlows` key to `roomId` only |
| Async fight delays widen interleave window | Resolved by per-room lock above | — |
| Ring buffer truncation silent on reconnect | **Unresolved** | Send `gap` event when `lastEventId` is not in buffer |
| Weak timestamp ordering | Mitigated by synchronous delivery; only affects reconnect gaps | Addressed alongside ring buffer fix |
| Process-exit timer leaks | **Addressed in this PR** | Monitor for remaining leaks |

Update this document when a root cause is confirmed fixed or a new issue is identified.
