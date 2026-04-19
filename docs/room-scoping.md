# Room-Level Scoping — Architecture Rule

**All game state, events, database queries, and API responses must be scoped to a room.**

This is not a guideline — it is a hard architectural constraint. Several bugs in the project's history have been caused by code that forgot to filter by room, leaked state across rooms, or broadcast events to the wrong audience. When in doubt, the answer is always: include the room.

---

## Why This Matters

The game runs multiple independent instances simultaneously — each room is its own universe. Characters are room-scoped (the same Discord user can have a different monster and deck in room A vs. room B). Events in room A must never appear in room B's console or ring feed. Leaderboards have a room scope and a global scope; the former must never bleed into the wrong room.

---

## Rules

### 1. Every database query that touches game data must include `room_id`

No exceptions. Queries for monsters, characters, fight summaries, leaderboard stats, room events — all must be filtered by `room_id`.

```ts
// Wrong
db.select().from(fightSummaries)

// Right
db.select().from(fightSummaries).where(eq(fightSummaries.roomId, roomId))
```

If you are writing a query and you do not have a `room_id` in scope, stop and find out where it should come from. It should never be omitted.

### 2. Every tRPC procedure that returns room-scoped data must validate room membership

Before returning any data, confirm the calling user is a member of the room being queried. Do not rely on the client passing the correct `room_id` as the only guard — also check membership in the resolver.

```ts
// In the tRPC procedure
const membership = await db.query.roomMembers.findFirst({
  where: and(eq(roomMembers.roomId, input.roomId), eq(roomMembers.userId, ctx.userId)),
})
if (!membership) throw new TRPCError({ code: 'FORBIDDEN' })
```

### 3. Events are always emitted with a room context

The event bus carries a `roomId` on every event. Subscribers must filter by `roomId` — never handle an event without verifying it belongs to the room the subscriber is serving.

```ts
// Wrong — handles events from all rooms
eventBus.on('ring.fight', (event) => updateFeed(event))

// Right
eventBus.on('ring.fight', (event) => {
  if (event.roomId !== this.roomId) return
  updateFeed(event)
})
```

### 4. The `publicChannel` callback is room-scoped

Each `Game` instance (one per room) has its own `publicChannel` callback wired to that room's channel only. Never share a `publicChannel` callback across rooms.

### 5. Character data is room-scoped

A player's character (Beastmaster) is not global — it exists within a room. The same user can have completely different monsters, decks, and progress in different rooms. Lookups and mutations must always resolve the character within the context of the specific room, never from a global character store.

### 6. WebSocket/SSE subscriptions must subscribe to the correct room's feed

When a client subscribes to a real-time feed (ring events, console events), the subscription must be gated to the `room_id` the client is currently viewing. The client must re-subscribe when navigating between rooms. The server must reject or ignore subscription requests that do not include a valid `room_id`.

### 7. Admin operations are also room-scoped

Admin commands (edit character, kick monster, etc.) are scoped to the room they are issued in. An admin in room A cannot affect room B. Global admin actions (e.g., inspecting all rooms) are a separate escalated privilege, not a side effect of room admin status.

---

## Checklist for Code Review

When reviewing any PR that touches game data, ask:

- [ ] Does every DB query have a `where room_id = ?` clause?
- [ ] Does every tRPC procedure validate room membership before returning data?
- [ ] Does every event emission include a `roomId`?
- [ ] Does every event subscriber filter by `roomId`?
- [ ] Is the `publicChannel` callback isolated to one room?
- [ ] Are character lookups resolving within the room context?
- [ ] Do WebSocket/SSE subscriptions include and validate `room_id`?

---

## Common Failure Patterns

| Symptom | Likely cause |
|---------|-------------|
| Events from room A appear in room B's console | Event subscriber not filtering by `roomId` |
| Leaderboard shows stats from other rooms | DB query missing `room_id` filter |
| Fight log shows fights from wrong room | `fight_summaries` query missing `room_id` |
| Player can read another room's data via API | tRPC procedure not checking room membership |
| Character changes in one room affect another | Character loaded globally, not room-scoped |
| Real-time feed receives events after navigating rooms | Old WebSocket subscription not torn down on room change |
