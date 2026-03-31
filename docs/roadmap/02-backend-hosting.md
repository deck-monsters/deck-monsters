# Backend Hosting and State Storage Strategy

**Category**: Infrastructure  
**Priority**: High (required by all connector work)

## Background

The game currently persists state two ways:
1. A callback (`stateSaveFunc`) provided by the adapter — the adapter stores the blob however it likes
2. An ad-hoc S3 backup (throttled 5 min, keyed by timestamp) as a safety net

This worked fine for a single private Slack workspace but won't scale to multi-room, multi-connector, or multi-user scenarios.

### Why the Current Architecture Doesn't Work for Multiple Clients

The engine was built around a single-callback model: one `publicChannelFn` for broadcast, one `channel` callback per player for DMs. Several assumptions baked into the code break down when multiple clients need to observe and interact with the same game room:

**Single callback, no fan-out.** `Game` takes one `publicChannelFn` and registers it as the sole `PUBLIC_CHANNEL`. If both a Discord bot and a web browser need to see ring events from the same room, there's no mechanism to deliver to both — the engine pushes to exactly one callback.

**Connector callbacks embedded in combat state.** When a player sends a monster to the ring, the `Ring` stores `{ monster, character, channel, channelName }` on the `Contestant` object. The `channel` here is a live function reference pointing back to the originating connector (e.g., a Discord DM function). This means: (a) a player connected via Discord and web simultaneously can only receive fight updates on whichever connector they sent from, and (b) function references can't be serialized, so contestant state can't move across processes.

**No event history.** Web and mobile clients disconnect (phone goes to sleep, tab is closed, network drops). When they reconnect, there's no way to catch up on what happened — the engine fires callbacks in real time and forgets them.

**Full-blob serialization on every mutation.** Every `setOptions` call on any `BaseClass` descendant fires `globalSemaphore.emit('stateChange')`, which gzips and base64-encodes the entire `Game` object. With more rooms and more frequent mutations, this becomes both slow and wasteful.

**Single-process, no horizontal scaling path.** All game state lives in-memory JavaScript objects. Running multiple rooms across multiple processes isn't possible without rethinking how state is owned and shared.

## Architecture: Event Bus Between Engine and Connectors

The fundamental change is to decouple event production from event delivery. Instead of the engine calling connector callbacks directly, it publishes structured events. Connectors subscribe.

```
Game Engine
  ↓ emits structured GameEvents
Room Event Bus (per room)
  ↓ fan-out to all subscribers
  ├→ WebSocket connections (web / mobile clients)
  ├→ Discord bot (posts to guild channels / DMs)
  └→ Slack bot (posts to workspace channels / DMs)
```

### GameEvent: Structured Event Format

Replace the current string-based `announce` messages with structured events that carry both machine-readable data and a pre-rendered text representation:

```typescript
interface GameEvent {
  id: string;            // monotonic per room, for ordering and catch-up
  roomId: string;
  timestamp: number;
  type: EventType;       // 'ring.add' | 'ring.fight' | 'ring.win' | 'card.played' | ...
  scope: 'public' | 'private';
  targetUserId?: string; // for private/DM events
  payload: Record<string, unknown>;
  text: string;          // pre-rendered text (preserves the original game's voice)
}
```

The `text` field means connectors that just want to post a string (Slack, Discord text channels) can use it directly. Connectors that want richer rendering (web app with HP bars, mobile app with sprites) use `type` and `payload` to build custom UI.

### Event Bus: Start Simple, Scale Later

Phase 1 — in-process `EventEmitter` with subscriber list:

```typescript
class RoomEventBus {
  private subscribers: Map<string, EventSubscriber> = new Map();

  publish(event: GameEvent): void {
    for (const subscriber of this.subscribers.values()) {
      if (event.scope === 'public' || subscriber.userId === event.targetUserId) {
        subscriber.deliver(event);
      }
    }
  }

  subscribe(id: string, subscriber: EventSubscriber): void { ... }
  unsubscribe(id: string): void { ... }
}
```

This is enough to support multiple connectors watching the same room in a single process — which is the expected deployment model for a long time.

Phase 2 — if horizontal scaling is ever needed, swap the in-process bus for Postgres `LISTEN/NOTIFY` or Redis pub/sub. The `GameEvent` format doesn't change; only the transport does. This is a connector-infrastructure concern, not a game-engine concern.

### Engine Changes Required

1. **Remove callback storage from `Contestant`.** The ring should not hold function references. Replace `{ channel, channelName }` on `Contestant` with `{ userId, connectorId }`. The event bus handles routing.

2. **Replace `ChannelManager.queueMessage()` with `eventBus.publish()`.** The `ChannelManager` currently batches strings and calls callbacks. Replace this with publishing `GameEvent` objects. Batching/throttling moves to the connector side (each platform has different rate limits).

3. **Replace `publicChannelFn` with event bus subscription.** The `Game` constructor no longer takes a callback. Instead, the connector subscribes to the room's event bus after creating or restoring the game.

4. **Interactive prompts (question/choices).** The current `{ question, choices }` pattern is a synchronous request-response between the engine and a specific player's connector. This still needs a direct channel, but it only happens during player-initiated flows (equipping, shopping) — not during ring combat. Model this as a separate `PromptRequest` that the engine emits and the connector responds to via a `PromptResponse`, rather than a blocking callback.

### Reconnection and Catch-Up

Store recent events per room (either in-memory ring buffer or in the database):

```typescript
interface RoomEventLog {
  getEventsSince(eventId: string): GameEvent[];
  getRecentEvents(count: number): GameEvent[];
}
```

When a web/mobile client reconnects, it sends its last-seen `eventId`. The server replays everything since then. For short disconnects (< 5 minutes), an in-memory ring buffer of the last ~200 events per room is sufficient. For longer disconnects, fall back to the database event log.

## Database: Drizzle ORM + PostgreSQL

Use **Drizzle ORM** as the TypeScript-native database layer:

- Schema-as-TypeScript (no code generation step, just types)
- Lightweight compared to Prisma
- Works well with the hosting options below

### Schema

```typescript
// rooms — one game instance per room
rooms: {
  id: uuid primary key,
  name: text,
  owner_id: uuid references users,
  invite_code: text unique,
  state_blob: text,      // base64-gzipped game state (full snapshot)
  created_at: timestamp,
  updated_at: timestamp
}

// room_events — append-only event log for reconnection and audit
room_events: {
  id: bigserial primary key,
  room_id: uuid references rooms,
  type: text,              // event type enum
  scope: text,             // 'public' | 'private'
  target_user_id: uuid,    // null for public events
  payload: jsonb,
  text: text,              // pre-rendered message
  created_at: timestamp default now()
}
// index on (room_id, id) for catch-up queries
// consider TTL / retention policy — prune events older than N days

// users — see auth doc
users: { id, email, password_hash, created_at }

// user_connectors — cross-connector identity
user_connectors: { user_id, connector_type, external_id }

// room_members — tracks which users belong to which rooms
room_members: { room_id, user_id, joined_at, role }
```

The `connector_type` and `external_id` columns that were on the `rooms` table in the original design are removed — a room is connector-agnostic. Any connector can connect to any room. The mapping from external identifiers (Discord guild ID, Slack workspace+channel) to room ID is handled by the connector, not the database schema.

### State Storage: Snapshots + Events

Two complementary persistence strategies:

**Snapshots** (the existing blob model, refined): Periodically serialize the full game state to `rooms.state_blob`. This is the restore point for cold starts. Throttle to every 30-60 seconds of inactivity or on graceful shutdown, rather than on every mutation.

**Event log** (`room_events`): Append-only log of game events. Serves three purposes:
1. Client reconnection catch-up (replay events since last seen)
2. Audit trail / battle history (replaces the lost `ring.battles = []` data)
3. Potential future event-sourcing if full snapshot serialization ever becomes a bottleneck

On startup: `restoreGame(room.state_blob)` restores the game from the last snapshot. Events emitted after the snapshot was taken are lost (fights resolve in < 60 seconds, so the window is small). This is acceptable — a fight in progress at the time of a crash was going to be interrupted anyway.

## API Layer: tRPC

For the web app and mobile app (both TypeScript clients), use **tRPC**:

- Procedures defined in the backend are automatically typed in the frontend
- No OpenAPI schema generation, no client code generation, no drift between API and client
- Works great with React (web) and React Native (mobile) via `@trpc/react-query`
- Real-time ring feed via tRPC WebSocket subscriptions

```typescript
// Command procedure — typed end-to-end
const sendToRing = protectedProcedure
  .input(z.object({ monsterName: z.string(), roomId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const game = roomManager.getGame(input.roomId);
    const character = await game.getCharacter({ id: ctx.userId, ... });
    await character.sendMonsterToTheRing({ monsterName: input.monsterName });
  })

// Subscription — client receives GameEvents in real time
const ringFeed = protectedProcedure
  .input(z.object({ roomId: z.string(), lastEventId: z.string().optional() }))
  .subscription(({ input }) => {
    return observable<GameEvent>((emit) => {
      const bus = roomManager.getEventBus(input.roomId);

      // Catch-up: replay missed events
      if (input.lastEventId) {
        for (const event of bus.getEventsSince(input.lastEventId)) {
          emit.next(event);
        }
      }

      // Live: subscribe to new events
      const unsub = bus.subscribe(emit.next);
      return unsub;
    });
  })
```

Discord and Slack connectors don't use tRPC — they call the engine directly in-process and subscribe to the room event bus.

## Hosting

**Recommendation: Railway or Fly.io** (managed containers with Postgres included)

- Deploy as a single Docker container (monorepo → one image for the backend)
- Managed Postgres on the same platform — no separate DB hosting to configure
- Both support WebSockets natively (required for real-time ring feed)
- Railway: simpler DX, great for small projects; scales up fine
- Fly.io: more control, better for multi-region if ever needed

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
CMD ["node", "packages/server/dist/index.js"]
```

**Alternative: Hetzner VPS + Docker Compose** — cheapest option (~€5/mo), more maintenance

### Scaling Considerations

For the foreseeable future, a single process handles all rooms. Rooms are independent — they don't share state, and fights within a room are sequential. The main scaling dimensions are:

- **Memory**: each `Game` instance is a few MB. Hundreds of rooms fit comfortably in a single process.
- **CPU**: fights are turn-based with short bursts of computation. Not CPU-bound.
- **WebSocket connections**: a single Node.js process can handle thousands of concurrent WebSocket connections.

If this ever becomes insufficient, rooms are naturally shardable. Each room's `Game` instance can be assigned to a specific process, with the event bus routing handled by Redis pub/sub or similar. But design for that later — premature distributed-systems complexity is the main risk here, not premature scaling limits.

## Environment Variables

Generalize all env var names (remove Hubot prefix):

```bash
# Remove:
HUBOT_DECK_MONSTERS_AWS_ACCESS_KEY_ID
HUBOT_DECK_MONSTERS_AWS_SECRET_ACCESS_KEY

# Add:
DATABASE_URL
JWT_SECRET
# AWS vars only needed if keeping S3 as backup option:
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

## Tasks

### Event Bus and Engine Refactoring
- [ ] Define `GameEvent` type and `EventType` enum
- [ ] Implement `RoomEventBus` (in-process pub/sub with subscriber management)
- [ ] Remove `channel` / `channelName` from `Contestant` — replace with `userId`
- [ ] Replace `ChannelManager.queueMessage()` calls with `eventBus.publish()` in `Ring`, `Game`, and announcements
- [ ] Implement `PromptRequest` / `PromptResponse` pattern for interactive flows (equip, shop, etc.)
- [ ] Add in-memory event ring buffer per room for reconnection catch-up
- [ ] Update `Game` constructor to no longer require `publicChannelFn` — connectors subscribe via event bus

### Database and State Storage
- [ ] Add Drizzle ORM + `drizzle-kit` for migrations
- [ ] Define initial database schema (`rooms`, `room_events`, `users`, `user_connectors`, `room_members`)
- [ ] Implement `StateStore` interface in the engine (replaces direct S3 calls)
- [ ] Implement Postgres adapter for `StateStore`
- [ ] Throttle snapshot saves (30-60s debounce instead of every mutation)
- [ ] Write `room_events` on publish for reconnection and history

### API Layer
- [ ] Set up tRPC router with game command procedures
- [ ] Add tRPC WebSocket subscriptions for ring feed with catch-up support
- [ ] Implement `RoomManager` that maps room IDs → Game instances and event buses

### Infrastructure
- [ ] Add Docker + docker-compose for local development
- [ ] Write deployment docs (Railway / Fly.io)
- [ ] Generalize env var names; add deprecation warning if old Hubot names detected

## Open Questions

- **Event retention policy**: How long to keep `room_events` rows? A rolling window (e.g., 7 days) keeps the table small. Older history could be archived or simply discarded — battle results are reflected in character/monster stats regardless.
- **Interactive prompts across connectors**: If a player is connected via both Discord and web, and the engine needs to ask them a question (e.g., "which monster to equip?"), which connector gets the prompt? Simplest answer: whichever connector initiated the action. But worth thinking about.
- **Event granularity**: How fine-grained should events be? One event per `announce` call (matches current behavior) vs. one event per game-mechanical action (e.g., `card.played`, `damage.dealt`, `monster.died`). Finer granularity enables richer client rendering but is more work upfront. Start coarse, refine later.
