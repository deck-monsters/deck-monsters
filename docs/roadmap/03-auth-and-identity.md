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

## Proposed Approach

### Phase 1 — Basic Auth for Web/Mobile

- Email + password with bcrypt hashing
- JWT-based sessions (short-lived access token + refresh token)
- Library: `better-auth`, `lucia`, or `passport.js`
- Store users in the same Postgres DB as game state

### Phase 2 — OAuth (Social Login)

- Support Google and/or Discord OAuth as login options
- Simplifies onboarding significantly (no email/password to manage)

### Phase 3 — Cross-Connector Identity Linking

- Allow a player to link their Discord ID to their web/mobile account
- Unified `userId` means the same characters/monsters across all connectors
- Store connector-specific IDs in a `user_connectors` table: `{ user_id, connector_type, external_id }`

## Tasks

- [ ] Add `users` table to database schema
- [ ] Implement email + password registration / login endpoints
- [ ] Implement JWT issuance and validation middleware
- [ ] Add auth to the web app connector
- [ ] Add auth to the mobile app
- [ ] Phase 2: Add Google OAuth
- [ ] Phase 2: Add Discord OAuth
- [ ] Phase 3: Cross-connector identity linking

## Security Considerations

- Never store plaintext passwords (bcrypt with cost factor ≥ 12)
- HTTPS everywhere (terminate at load balancer or reverse proxy)
- Rate-limit auth endpoints to prevent brute force
- Rotate JWT secrets via environment variables; support key rotation
