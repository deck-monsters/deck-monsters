# Backend Hosting and State Storage Strategy

**Category**: Infrastructure  
**Priority**: High (required by all connector work)  
**Status**: Done — all infrastructure is live in production. Supabase project provisioned, Railway deployment running, deck-monsters.com live. Event bus, engine refactoring, Drizzle schema, RoomManager, tRPC router, Fastify server, Docker multi-stage build, and all deployment docs complete.

## Background

The game currently persists state via a callback (`stateSaveFunc`) provided by the adapter — the adapter stores the blob however it likes. The legacy Slack connector stored this in Hubot Brain (Redis). A secondary S3 backup existed as a safety net but is no longer needed — Supabase Postgres with managed backups replaces both.

This single-callback model worked fine for a single private Slack workspace but won't scale to multi-room, multi-connector, or multi-user scenarios.

### Why the Current Architecture Doesn't Work for Multiple Clients

The engine was built around a single-callback model: one `publicChannelFn` for broadcast, one `channel` callback per player for DMs. Several assumptions baked into the code break down when multiple clients need to observe and interact with the same game room:

**Single callback, no fan-out.** `Game` takes one `publicChannelFn` and registers it as the sole `PUBLIC_CHANNEL`. If both a Discord bot and a web browser need to see ring events from the same room, there's no mechanism to deliver to both — the engine pushes to exactly one callback.

**Connector callbacks embedded in combat state.** When a player sends a monster to the ring, the `Ring` stores `{ monster, character, channel, channelName }` on the `Contestant` object. The `channel` here is a live function reference pointing back to the originating connector (e.g., a Discord DM function). This means: (a) a player connected via Discord and web simultaneously can only receive fight updates on whichever connector they sent from, and (b) function references can't be serialized, so contestant state can't move across processes.

**No event history.** Web and mobile clients disconnect (phone goes to sleep, tab is closed, network drops). When they reconnect, there's no way to catch up on what happened — the engine fires callbacks in real time and forgets them.

**Full-blob serialization on every mutation.** Every `setOptions` call on any `BaseClass` descendant fires `globalSemaphore.emit('stateChange')`, which gzips and base64-encodes the entire `Game` object. With more rooms and more frequent mutations, this becomes both slow and wasteful.

**Single-process, no horizontal scaling path.** All game state lives in-memory JavaScript objects. Running multiple rooms across multiple processes isn't possible without rethinking how state is owned and shared.

## Hosting Decision

**Supabase Cloud** for auth, database, and storage. **Railway** for application runtime.

### Why This Split

Supabase provides managed Postgres with integrated auth — JWT tokens map directly to database-level Row-Level Security (RLS) policies. This keeps identity and data in one trust boundary, eliminating a class of security bugs that arise when auth and data are managed separately.

Railway provides flexible container hosting for the application layer — API server, game engine, WebSocket connections, workers, and connector bots. It supports Node.js and WebSockets natively, with a straightforward deployment model for small teams.

Supabase handles *who the user is* and *where data lives*. Railway handles *what the game does* and *how events flow*.

### How Railway Connects to Supabase Postgres

Railway connects to Supabase Postgres via a standard connection string — the same way any application connects to an external Postgres database:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool);
```

Supabase provides the connection credentials (host, port, database, user, password) via its dashboard. These are stored as environment variables on Railway. From the application's perspective, it's just a Postgres database.

The Supabase client SDK and REST API are not required for backend data access. The backend treats Supabase as "managed Postgres + auth layer" and uses Drizzle ORM for all queries.

### Why Supabase Postgres Over Railway Postgres

Railway also offers managed Postgres. Using Supabase Postgres has specific advantages for this project:

| Concern | Supabase Postgres | Railway Postgres |
|---------|-------------------|------------------|
| Auth integration | JWT ↔ `auth.uid()` built in | Must implement user/auth mapping manually |
| Row-Level Security | Policies tied to authenticated user | Must enforce access checks in application code |
| Identity + data boundary | Same system | Split across Supabase (auth) and Railway (data) |
| Connector identity | `user_connectors` co-located with auth | Glue code to bridge auth and data |
| Backups | Managed, automatic | Managed, but decoupled from auth |

The game needs multi-connector identity (Discord, web, Slack all map to one user), room-scoped permissions, and per-user data isolation. With Supabase Postgres, RLS policies handle a significant portion of this at the database level:

```sql
CREATE POLICY "Users see their rooms"
ON rooms FOR SELECT
USING (user_id = auth.uid());
```

With Railway Postgres, every access check must be implemented and maintained in application code — more surface area for security bugs.

### What Goes Where

**Supabase Cloud** (durable state):
- Auth: OAuth providers, email/password, JWT issuance
- Postgres database: users, rooms, events, state snapshots
- Storage: user assets, if needed later

**Railway** (application runtime):
- Backend API server (Fastify + tRPC)
- Game engine instances (one per active room)
- WebSocket connections for real-time ring feed
- Connector bots (Discord, later Slack)
- Background jobs (state snapshots, event pruning)

```
Client (web / Discord / mobile)
  ↓ login
Supabase Auth (OAuth, email/password → JWT)
  ↓ JWT
Railway API (validates JWT, runs game logic)
  ↓ SQL over TCP (connection string)
Supabase Postgres (RLS-enforced data access)
```

### Non-Goals

- **Self-hosted Supabase**: the Railway Supabase template is explicitly incomplete (no edge functions, no logs, flaky dashboard features) and adds significant DevOps overhead for no benefit at this stage.
- **Firebase**: Firestore is NoSQL, which conflicts with the Drizzle/relational model. Vendor lock-in is high and cost escalates unpredictably.
- **Split auth + data providers** (e.g., Supabase Auth + Railway Postgres): creates a split trust boundary with more glue code and more failure modes. Not worth the complexity.
- **S3 backup**: the legacy S3 safety-net backup is no longer needed. Supabase provides managed daily backups and point-in-time recovery on paid plans. The `helpers/aws.ts` code and `@aws-sdk/client-s3` dependency should be removed.

### Future Scaling Path

If the project outgrows Railway (latency requirements, multi-region), migrate the application layer to Fly.io. The database stays on Supabase — only the compute layer moves. This is a clean upgrade because Supabase is accessed via a standard connection string, not platform-specific integrations.

Self-hosting Supabase becomes relevant only if full data sovereignty or compliance requirements emerge. Not needed now.

If additional backup redundancy beyond Supabase's managed backups is ever wanted, options include periodic `pg_dump` to object storage or Supabase's database branching feature. Evaluate post-launch if needed.

## Architecture: Event Bus Between Engine and Connectors

The engine has been refactored (PR [#287](https://github.com/deck-monsters/deck-monsters/pull/287)) to decouple event production from event delivery. Instead of calling connector callbacks directly, it publishes structured events. Connectors subscribe.

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

The engine replaces the old string-based `announce` messages with structured events that carry both machine-readable data and a pre-rendered text representation:

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

The current implementation is an in-process `EventEmitter` with subscriber list:

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

If horizontal scaling is ever needed, swap the in-process bus for Postgres `LISTEN/NOTIFY` or Redis pub/sub. The `GameEvent` format doesn't change; only the transport does. This is a connector-infrastructure concern, not a game-engine concern.

### Engine Changes Completed (PR #287)

1. **Callback storage removed from `Contestant`.** The ring no longer holds function references. `Contestant` uses `{ userId }` instead of `{ channel, channelName }`. The event bus handles routing.

2. **`ChannelManager` replaced with `eventBus.publish()`.** All 21 announcement modules publish `GameEvent` objects. Batching/throttling is now a connector-side concern (each platform has different rate limits).

3. **`publicChannelFn` removed from `Game` constructor.** Connectors subscribe to the room's event bus after creating or restoring the game. A `ConnectorAdapter` (`channel/connector-adapter.ts`) bridges the new event bus to legacy callback-based connectors.

4. **Interactive prompts use the event bus.** The old blocking `{ question, choices }` callback pattern is replaced with a prompt mechanism on the event bus. Prompt requests are emitted as events; connectors respond asynchronously.

### Reconnection and Catch-Up

Store recent events per room (either in-memory ring buffer or in the database):

```typescript
interface RoomEventLog {
  getEventsSince(eventId: string): GameEvent[];
  getRecentEvents(count: number): GameEvent[];
}
```

When a web/mobile client reconnects, it sends its last-seen `eventId`. The server replays everything since then. For short disconnects (< 5 minutes), an in-memory ring buffer of the last ~200 events per room is sufficient. For longer disconnects, fall back to the database event log.

## Database: Drizzle ORM + Supabase PostgreSQL

Use **Drizzle ORM** as the TypeScript-native database layer:

- Schema-as-TypeScript (no code generation step, just types)
- Lightweight compared to Prisma
- Connects to Supabase Postgres via standard connection string

### Schema

Supabase manages its own `auth.users` table (handles passwords, OAuth tokens, sessions). Game-specific data lives in the `public` schema, referencing `auth.users(id)` for the foreign key:

```typescript
// profiles — game-specific user data, linked to Supabase auth
profiles: {
  id: uuid primary key references auth.users(id),
  display_name: text,
  created_at: timestamp default now()
}

// user_connectors — cross-connector identity mapping
user_connectors: {
  id: uuid primary key,
  user_id: uuid references profiles(id),
  connector_type: text,     // 'discord' | 'slack' | 'web'
  external_id: text,        // Discord user ID, Slack user ID, etc.
  created_at: timestamp default now()
}
// unique index on (connector_type, external_id)

// rooms — one game instance per room
rooms: {
  id: uuid primary key,
  name: text,
  owner_id: uuid references profiles(id),
  invite_code: text unique,
  state_blob: text,         // base64-gzipped game state (full snapshot)
  created_at: timestamp,
  updated_at: timestamp
}

// room_events — append-only event log for reconnection and audit
room_events: {
  id: bigserial primary key,
  room_id: uuid references rooms,
  type: text,               // event type enum
  scope: text,              // 'public' | 'private'
  target_user_id: uuid,     // null for public events
  payload: jsonb,
  text: text,               // pre-rendered message
  created_at: timestamp default now()
}
// index on (room_id, id) for catch-up queries
// consider TTL / retention policy — prune events older than N days

// room_members — tracks which users belong to which rooms
room_members: {
  room_id: uuid references rooms,
  user_id: uuid references profiles(id),
  joined_at: timestamp default now(),
  role: text               // 'owner' | 'member'
}
```

A database trigger (or Supabase hook) creates a `profiles` row when a new user signs up via Supabase Auth, so the game-specific table stays in sync with the auth layer.

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
const command = protectedProcedure
  .input(z.object({ roomId: z.string().uuid(), command: z.string().min(1) }))
  .mutation(async ({ input, ctx }) => {
    const game = await roomManager.getGame(input.roomId);
    const action = game.handleCommand({ command: input.command });
    if (!action) return { ok: false, message: 'Command not recognized' };
    await action({ channel, channelName: input.roomId, isDM: true,
                   user: { id: ctx.userId, name: ctx.userId } });
    return { ok: true };
  })

// Subscription — async generator, tRPC v11, with catch-up via lastEventId
const ringFeed = protectedProcedure
  .input(z.object({ roomId: z.string().uuid(), lastEventId: z.string().optional() }))
  .subscription(async function* ({ input, ctx, signal }) {
    const eventBus = await roomManager.getEventBus(input.roomId);

    // Catch-up: replay missed events
    if (input.lastEventId) {
      for (const event of eventBus.getEventsSince(input.lastEventId)) {
        if (event.scope === 'public' || event.targetUserId === ctx.userId) {
          yield tracked(event.id, event);  // tracked() enables client-side cursor
        }
      }
    }

    // Live: subscribe until client disconnects
    const queue: GameEvent[] = [];
    let wake: (() => void) | null = null;
    const unsub = eventBus.subscribe(`trpc:${ctx.userId}`, {
      userId: ctx.userId,
      deliver(event) { queue.push(event); wake?.(); wake = null; },
    });
    try {
      while (!signal?.aborted) {
        while (queue.length) yield tracked(queue[0]!.id, queue.shift()!);
        await new Promise<void>((res) => { wake = res; });
      }
    } finally { unsub(); }
  })
```

Discord and Slack connectors don't use tRPC — they call the engine directly in-process and subscribe to the room event bus.

## Deployment

Deploy the server as a single Docker container on Railway. A multi-stage `Dockerfile` is at the repo root:

```
Stage 1 (deps)    — install all workspace dependencies (pnpm + frozen lockfile)
Stage 2 (builder) — compile engine + server TypeScript via Turborepo
Stage 3 (runner)  — production image, only production deps + compiled dist/
```

A `docker-compose.yml` at the repo root provides a local dev stack: the server container connects to the Supabase CLI local stack running on the host (default: `localhost:54322`). See `docs/deployment.md` for the full step-by-step setup guide.

Railway handles container orchestration, health checks, and zero-downtime deploys. The container connects to Supabase Postgres over the network via the connection string in environment variables.

### Scaling Considerations

For the foreseeable future, a single process handles all rooms. Rooms are independent — they don't share state, and fights within a room are sequential. The main scaling dimensions are:

- **Memory**: each `Game` instance is a few MB. Hundreds of rooms fit comfortably in a single process.
- **CPU**: fights are turn-based with short bursts of computation. Not CPU-bound.
- **WebSocket connections**: a single Node.js process can handle thousands of concurrent WebSocket connections.

If this ever becomes insufficient, rooms are naturally shardable. Each room's `Game` instance can be assigned to a specific process, with the event bus routing handled by Redis pub/sub or similar. But design for that later — premature distributed-systems complexity is the main risk here, not premature scaling limits.

## Environment Variables

```bash
DATABASE_URL               # Postgres connection string (from Supabase dashboard — use Transaction pooler URL for Railway)
SUPABASE_URL               # Supabase project URL — used for JWKS endpoint (JWT verification) and admin auth calls
SUPABASE_PUBLISHABLE_KEY   # Supabase Publishable key (sb_publishable_...) — safe for client-side use
SUPABASE_SECRET_KEY        # Supabase Secret key (sb_secret_...) — server-only, bypasses RLS
PORT                       # HTTP + WebSocket port (Railway injects this; default 3000)
```

## Tasks

### Event Bus and Engine Refactoring — Done (PR [#287](https://github.com/deck-monsters/deck-monsters/pull/287))
- [x] ~~Define `GameEvent` type and `EventType` enum~~ (`packages/engine/src/events/types.ts`)
- [x] ~~Implement `RoomEventBus` (in-process pub/sub with subscriber management)~~ (`packages/engine/src/events/room-event-bus.ts`, 200-event ring buffer)
- [x] ~~Remove `channel` / `channelName` from `Contestant` — replace with `userId`~~
- [x] ~~Replace `ChannelManager.queueMessage()` calls with `eventBus.publish()` in `Ring`, `Game`, and announcements~~ (all 21 announcement modules updated)
- [x] ~~Implement `PromptRequest` / `PromptResponse` pattern for interactive flows~~ (prompt mechanism in event bus)
- [x] ~~Add in-memory event ring buffer per room for reconnection catch-up~~ (200-event buffer with `getEventsSince`)
- [x] ~~Update `Game` constructor to no longer require `publicChannelFn`~~ (connectors subscribe via event bus; `ConnectorAdapter` bridges legacy callbacks)
- [x] ~~Throttle snapshot saves~~ (30s debounce in `Game`)

### Database and State Storage — Done
- [x] ~~Add Drizzle ORM + `drizzle-kit` for migrations~~ (`packages/server/src/db/schema.ts`, `packages/server/drizzle.config.ts`)
- [x] ~~Define initial database schema~~ (`profiles`, `user_connectors`, `rooms`, `room_events`, `room_members` — in `db/schema.ts` + `supabase/migrations/20260101000000_initial.sql`)
- [x] ~~Create Supabase project and configure connection~~ (production Supabase project live)
- [x] ~~Set up database trigger to create `profiles` row on Supabase Auth signup~~ (in initial migration SQL)
- [x] ~~Implement `StateStore` interface in the engine~~ (`packages/engine/src/types/state-store.ts`, exported from `@deck-monsters/engine`)
- [x] ~~Implement Postgres adapter for `StateStore`~~ (`packages/server/src/state-store.ts` — `PostgresStateStore` writes to `rooms.state_blob`)
- [x] ~~Remove legacy S3 backup code (`helpers/aws.ts`, `@aws-sdk/client-s3` dependency)~~
- [x] Write `room_events` rows to the database on publish (implemented via server-side event persister subscriber)

### API Layer — Done
- [x] ~~Set up tRPC router with game command procedures~~ (`packages/server/src/trpc/router.ts` — `room.*` + `game.command` procedures)
- [x] ~~Add tRPC WebSocket subscriptions for ring feed with catch-up support~~ (`game.ringFeed` subscription with `lastEventId` catch-up and `tracked()` for client-side cursor)
- [x] ~~Implement `RoomManager` that maps room IDs → Game instances and event buses~~ (`packages/server/src/room-manager.ts` — create/join/leave/list/load rooms, lazy `Game` restore from snapshot)

### Infrastructure — Done
- [x] ~~Add Docker + docker-compose for local development~~ (`Dockerfile` multi-stage build; `docker-compose.yml` targeting Supabase CLI local stack)
- [x] ~~Set up Supabase CLI for local development~~ (`supabase/config.toml`, `supabase/migrations/` directory created; run `supabase start` to boot local stack)
- [x] ~~Evaluate Supabase CLI migrations alongside `drizzle-kit`~~ (decided: Supabase CLI owns DDL via `supabase/migrations/`; Drizzle is for type-safe queries only — `drizzle.config.ts` points to the same migrations folder)
- [x] ~~Write deployment docs for Railway~~ (`docs/deployment.md` — full guide: Supabase project setup, schema push, auth providers, Railway deploy, env vars, health check)
- [x] ~~Configure Railway environment variables and deploy~~ (running in production at deck-monsters.com)

## Open Questions

- **Event retention policy**: How long to keep `room_events` rows? A rolling window (e.g., 7 days) keeps the table small. Older history could be archived or simply discarded — battle results are reflected in character/monster stats regardless.
- **Interactive prompts across connectors**: If a player is connected via both Discord and web, and the engine needs to ask them a question (e.g., "which monster to equip?"), which connector gets the prompt? Simplest answer: whichever connector initiated the action. But worth thinking about.
- **Event granularity**: How fine-grained should events be? One event per `announce` call (matches current behavior) vs. one event per game-mechanical action (e.g., `card.played`, `damage.dealt`, `monster.died`). Finer granularity enables richer client rendering but is more work upfront. Start coarse, refine later.
- **Supabase connection pooling**: Supabase offers both direct connections and a connection pooler (Supavisor). For Railway, the pooler is recommended for production to avoid exhausting Postgres connection limits under load. Evaluate during deployment.
