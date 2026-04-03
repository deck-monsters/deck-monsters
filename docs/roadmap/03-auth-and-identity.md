# Authentication and User Identity

**Category**: Feature / Security  
**Priority**: High (required for web and Discord connectors)  
**Status**: Phase 1 complete (code) — JWT validation, connector identity mapping, and web app auth UI are implemented; Supabase project provisioning remains manual.

## Background

The original game ran in a private enterprise Slack workspace. Slack already handled authentication — every message came from an authenticated Slack user ID, so the game never needed its own auth.

With a web app, public Discord server, or mobile client, the game needs its own identity layer.

## Design Goals

- **Don't reinvent auth**: use a managed service that handles OAuth, password hashing, session management, and token issuance — not a hand-rolled solution
- **Connector-agnostic**: the game engine identifies players by an opaque `userId` string — auth just needs to produce that consistently
- **Multi-connector**: the same player should optionally be able to link their Discord identity and their web account to the same game character

## Provider Decision: Supabase Auth

Use **Supabase Auth** as the identity provider. This is a direct consequence of the hosting decision (see backend hosting doc) — auth and database share one trust boundary in Supabase, which eliminates a class of security bugs and reduces custom code.

### Why Supabase Auth Over DIY

| Concern | Supabase Auth | DIY (passport.js, lucia, better-auth) |
|---------|---------------|---------------------------------------|
| OAuth providers | Built-in (Google, Discord, Slack, GitHub, etc.) | Must configure each provider manually |
| Password hashing | Handled (bcrypt, configurable) | Must implement correctly |
| JWT issuance | Automatic, tied to `auth.uid()` | Must implement token lifecycle |
| Session management | Built-in (refresh tokens, expiry) | Must implement refresh flow |
| Rate limiting | Built-in on auth endpoints | Must add middleware |
| RLS integration | JWT claims usable in Postgres policies | No database-level integration |
| Maintenance | Managed service | Own the code forever |

The tradeoff is less control over auth internals. That's acceptable — auth is not a differentiator for this project, and the risk of a custom auth bug outweighs the flexibility benefit.

### Why Not Auth0 or Firebase Auth

- **Auth0**: capable but expensive at scale, and adds a third provider alongside Supabase and Railway. Keeping auth co-located with the database reduces moving parts.
- **Firebase Auth**: excellent standalone, but couples you toward the Firebase ecosystem (Firestore, Functions). The project uses Postgres and Drizzle, so Firebase Auth alone would create a split that's hard to justify.

## How Auth Relates to the Event Bus

The event bus (see backend hosting doc) routes events by `userId`. Auth is what produces that `userId` consistently across connectors:

- **Web/mobile**: user logs in via Supabase Auth → JWT contains `sub` (the Supabase user ID) → server uses it when subscribing to the room event bus and when dispatching commands to the engine
- **Discord**: Discord's own auth provides a Discord user ID → mapped to a Supabase `userId` via `user_connectors`
- **Slack**: Slack's own auth provides a Slack user ID → same mapping

Private events (DMs, prompt requests) are routed to `targetUserId` on the event bus. The connector that owns that user's active session delivers the event. If a user is connected on multiple connectors simultaneously, each connector receives the event — the user sees it wherever they're currently active.

## Auth Phases

Phases are ordered to match the connector rollout: Discord and web ship first, mobile and Slack come later.

### Phase 1 — Discord + Web Foundation

Ship with the Discord connector and web app:

- **Email + password** via Supabase Auth (fallback for users without Discord)
- **Discord OAuth** via Supabase Auth (primary for Discord users, natural for gaming)
- JWT-based sessions: Supabase issues short-lived access tokens + refresh tokens
- Railway backend validates JWTs using `SUPABASE_JWT_SECRET`
- The `sub` claim in the JWT is the canonical `userId` used by the engine and event bus

Discord OAuth is prioritized because the Discord connector ships first and Discord users already expect OAuth login flows.

### Phase 2 — Google OAuth + Web Polish

- **Google OAuth** via Supabase Auth (broadens web onboarding beyond Discord-only users)
- Supabase handles provider configuration — adding a new OAuth provider is a dashboard setting + a few lines of client code

### Phase 3 — Cross-Connector Identity Linking

Ship when the Slack connector is ready:

- **Slack OAuth** via Supabase Auth
- **Account linking**: allow a player to connect multiple OAuth providers to one account
- Unified `userId` means the same characters/monsters across all connectors
- Connector-specific IDs stored in `user_connectors`: `{ user_id, connector_type, external_id }`
- When a Discord command arrives, look up `user_connectors` to find the canonical `userId`; if no link exists, auto-create a user record (Discord users are already authenticated by Discord)

### Identity Flow

```
Discord slash command from Discord user 981234567
  → lookup user_connectors(connector_type='discord', external_id='981234567')
  → found: user_id = 'abc-def-789'
  → engine.getCharacter({ id: 'abc-def-789', ... })

Web login with email (or Discord OAuth on the web)
  → Supabase Auth issues JWT with sub = 'abc-def-789'
  → same user, same character, different connector
```

For Discord users who have never logged into the web app, the Discord connector auto-creates a Supabase user record and `user_connectors` entry on first interaction. If they later sign up on the web with the same email, account linking merges the identities.

## JWT Validation on Railway

The Railway backend validates every request by checking the Supabase JWT:

```typescript
import { createClient } from '@supabase/supabase-js';
// or, for lighter weight: verify the JWT directly using the secret

import jwt from 'jsonwebtoken';

function validateToken(token: string): { userId: string } {
  const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!);
  return { userId: payload.sub as string };
}
```

This is used in the tRPC middleware to create a `protectedProcedure` that requires a valid JWT and injects `ctx.userId` into all downstream handlers.

For WebSocket connections, the JWT is validated on initial connection. If the token expires mid-session, the client refreshes via Supabase and reconnects.

## Database Tables

Auth-related tables in the `public` schema (Supabase manages `auth.users` internally):

```typescript
// profiles — game-specific user data, created via trigger on Supabase Auth signup
profiles: {
  id: uuid primary key references auth.users(id),
  display_name: text,
  created_at: timestamp default now()
}

// user_connectors — maps external platform IDs to canonical user
user_connectors: {
  id: uuid primary key,
  user_id: uuid references profiles(id),
  connector_type: text,     // 'discord' | 'slack'
  external_id: text,        // platform-specific user ID
  created_at: timestamp default now()
}
// unique index on (connector_type, external_id)
```

A Supabase database trigger creates the `profiles` row automatically when a new user signs up, keeping the auth and game-data layers in sync without application code.

## Tasks

### Phase 1 — Discord + Web
- [ ] Create Supabase project, enable email/password and Discord OAuth providers _(manual infra — not automated)_
- [ ] Configure Discord OAuth app (client ID, secret, redirect URI) in Supabase dashboard _(manual infra — not automated)_
- [x] Implement JWT validation middleware in `packages/server` (tRPC `protectedProcedure`) _(done in 01/02)_
- [x] Create `profiles` table and signup trigger in Supabase _(done in 01/02)_
- [x] Create `user_connectors` table _(done in 01/02)_
- [x] Implement auto-creation of user records for Discord users on first interaction (`auth.registerConnectorUser` tRPC procedure + `ensureConnectorUser` service in `packages/server/src/auth/connector-users.ts`)
- [x] Add auth to web app (Supabase client SDK for login/register/OAuth) _(implemented in `apps/web`)_
- [x] Add auth to tRPC WebSocket connections (JWT on connect via `?token=` query param fallback in `packages/server/src/trpc/context.ts`)

### Phase 2 — Google OAuth
- [ ] Enable Google OAuth in Supabase dashboard
- [ ] Add Google login button to web app
- [ ] Test account linking when same email is used across providers

### Phase 3 — Slack + Identity Linking
- [ ] Enable Slack OAuth in Supabase dashboard
- [ ] Implement link/unlink endpoints for connecting providers to existing accounts
- [ ] Auto-create user records for Slack users on first interaction
- [ ] Test cross-connector identity: same character accessible from Discord, web, and Slack

## Security Considerations

Supabase handles the most security-sensitive operations (password hashing, token issuance, session management, rate limiting on auth endpoints). Remaining application-level concerns:

- HTTPS everywhere (Railway provides SSL termination)
- Store `SUPABASE_JWT_SECRET` securely in Railway environment variables; rotate via Supabase dashboard
- WebSocket connections validate JWT on connect and require reconnection on token expiry
- RLS policies on Supabase Postgres provide defense-in-depth — even if application code has a bug, the database enforces access boundaries
- The `user_connectors` unique index on `(connector_type, external_id)` prevents duplicate identity mappings
