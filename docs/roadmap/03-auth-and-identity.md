# Authentication and User Identity

**Category**: Feature / Security  
**Priority**: High (required for web and mobile connectors)

## Background

The original game ran in a private enterprise Slack workspace. Slack already handled authentication — every message came from an authenticated Slack user ID, so the game never needed its own auth.

With a web app, mobile app, or public Discord server, the game needs its own identity layer.

## Design Goals

- **Simple to start**: don't over-engineer; a username + password or social OAuth is enough initially
- **Connector-agnostic**: the game engine identifies players by an opaque `userId` string — auth just needs to produce that consistently
- **Multi-connector**: the same player should optionally be able to link their Discord identity and their web account to the same game character

## How Auth Relates to the Event Bus

The event bus (see backend hosting doc) routes events by `userId`. Auth is what produces that `userId` consistently across connectors:

- **Web/mobile**: user logs in → JWT contains `userId` → server uses it when subscribing to the room event bus and when dispatching commands to the engine
- **Discord**: Discord's own auth provides a Discord user ID → mapped to a `userId` via `user_connectors`
- **Slack**: Slack's own auth provides a Slack user ID → same mapping

Private events (DMs, prompt requests) are routed to `targetUserId` on the event bus. The connector that owns that user's active session delivers the event. If a user is connected on multiple connectors simultaneously, each connector receives the event — the user sees it wherever they're currently active.

## Proposed Approach

### Phase 1 — Basic Auth for Web/Mobile

- Email + password with bcrypt hashing
- JWT-based sessions (short-lived access token + refresh token)
- Library: `better-auth`, `lucia`, or `passport.js`
- Store users in the same Postgres DB as game state
- JWT `userId` claim is the canonical user identifier used by the engine and event bus

### Phase 2 — OAuth (Social Login)

- Support Google and/or Discord OAuth as login options
- Simplifies onboarding significantly (no email/password to manage)
- Discord OAuth is especially natural since Discord users are already gaming-oriented

### Phase 3 — Cross-Connector Identity Linking

- Allow a player to link their Discord ID to their web/mobile account
- Unified `userId` means the same characters/monsters across all connectors
- Store connector-specific IDs in the `user_connectors` table: `{ user_id, connector_type, external_id }`
- When a Discord command arrives, look up `user_connectors` to find the canonical `userId`; if no link exists, auto-create a user record (Discord users are already authenticated by Discord)

### Identity Flow

```
Slack message from U12345
  → lookup user_connectors(connector_type='slack', external_id='U12345')
  → found: user_id = 'abc-def-789'
  → engine.getCharacter({ id: 'abc-def-789', ... })

Web login with email
  → JWT issued with user_id = 'abc-def-789'
  → same user, same character, different connector
```

## Tasks

- [ ] Add `users` table to database schema
- [ ] Implement email + password registration / login endpoints
- [ ] Implement JWT issuance and validation middleware
- [ ] Add auth to the web/mobile tRPC layer (protected procedures)
- [ ] Phase 2: Add Google OAuth
- [ ] Phase 2: Add Discord OAuth
- [ ] Phase 3: Cross-connector identity linking (link/unlink endpoints)
- [ ] Phase 3: Auto-create user records for Discord/Slack users on first interaction

## Security Considerations

- Never store plaintext passwords (bcrypt with cost factor >= 12)
- HTTPS everywhere (terminate at load balancer or reverse proxy)
- Rate-limit auth endpoints to prevent brute force
- Rotate JWT secrets via environment variables; support key rotation
- WebSocket connections should validate JWT on connect and re-validate on token refresh
