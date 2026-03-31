# Backend Hosting and State Storage Strategy

**Category**: Infrastructure  
**Priority**: High (required by all connector work)

## Background

The game currently persists state two ways:
1. A callback (`stateSaveFunc`) provided by the adapter — the adapter stores the blob however it likes
2. An ad-hoc S3 backup (throttled 5 min, keyed by timestamp) as a safety net

This worked fine for a single private Slack workspace but won't scale to multi-room, multi-connector, or multi-user scenarios.

## Database: Drizzle ORM + PostgreSQL

Use **Drizzle ORM** as the TypeScript-native database layer:

- Schema-as-TypeScript (no code generation step, just types)
- Excellent Postgres support; lightweight compared to Prisma
- Works well with the hosting options below

### Schema

```typescript
// rooms — one game instance per room
rooms: {
  id: uuid primary key,
  name: text,
  owner_id: uuid references users,
  invite_code: text unique,
  connector_type: text,  // 'slack' | 'discord' | 'web'
  external_id: text,     // guild ID, workspace ID, etc.
  state_blob: text,      // base64-gzipped game state
  updated_at: timestamp
}

// users — see auth issue
users: { id, email, password_hash, created_at }

// user_connectors — cross-connector identity
user_connectors: { user_id, connector_type, external_id }
```

### State Storage Flow

```
game.on('stateChange') 
  → serialize (gzip + base64, already done by engine) 
  → db.update(rooms).set({ state_blob }).where(eq(rooms.id, roomId))
```

On startup: `restoreGame(publicChannelFn, room.state_blob, logger)`

Retire the timestamp-keyed S3 backup. If point-in-time recovery is needed, rely on managed Postgres backups.

## API Layer: tRPC

For the web app and mobile app (both TypeScript clients), use **tRPC**:

- Procedures defined in the backend are automatically typed in the frontend
- No OpenAPI schema generation, no client code generation, no drift between API and client
- Works great with React (web) and React Native (mobile) via `@trpc/react-query`
- Real-time ring feed stays as WebSocket (tRPC has WebSocket subscription support)

```typescript
// Backend procedure definition
const sendToRing = protectedProcedure
  .input(z.object({ monsterName: z.string(), roomId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const character = await getCharacter(ctx.userId, input.roomId)
    await character.sendMonsterToTheRing({ monsterName: input.monsterName })
  })

// Frontend — fully typed, no boilerplate
const mutation = trpc.sendToRing.useMutation()
mutation.mutate({ monsterName: 'Fang', roomId: currentRoom.id })
```

Discord and Slack connectors don't use tRPC — they call the engine directly in-process.

## Hosting

**Recommendation: Railway or Fly.io** (managed containers with Postgres included)

- Deploy as a single Docker container (monorepo → one image for the backend)
- Managed Postgres on the same platform — no separate DB hosting to configure
- Both support WebSockets natively (important for the real-time ring feed)
- Railway: simpler DX, great for small projects; scales up fine
- Fly.io: more control, better for multi-region if ever needed

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
CMD ["node", "packages/connector-web/dist/index.js"]
```

**Alternative: Hetzner VPS + Docker Compose** — cheapest option (~€5/mo), more maintenance

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

- [ ] Add Drizzle ORM + `drizzle-kit` for migrations
- [ ] Define initial database schema (`rooms`, `users`, `user_connectors`)
- [ ] Implement `StateStore` interface in the engine (replaces direct S3 calls)
- [ ] Implement Postgres adapter for `StateStore`
- [ ] Set up tRPC router with all game command procedures
- [ ] Add WebSocket subscriptions for ring feed via tRPC
- [ ] Add Docker + docker-compose for local development
- [ ] Write deployment docs (Railway / Fly.io)
- [ ] Generalize env var names; add deprecation warning if old Hubot names detected
