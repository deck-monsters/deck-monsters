# Backend Hosting and State Storage Strategy

**Category**: Infrastructure  
**Priority**: High (required by all connector work)

## Background

The game currently has two state persistence mechanisms:
1. A callback (`stateSaveFunc`) provided by the adapter — adapter is responsible for storing the blob
2. An ad-hoc S3 backup (throttled 5 min, keyed by timestamp) as a safety net

This worked fine for a single private Slack workspace but won't scale to multi-room, multi-connector, or multi-user scenarios.

## Proposed Architecture

### Game State Storage

Replace the ad-hoc S3 backup with a proper database:

- Each **room/group** has one serialized game state stored as a blob
- Use PostgreSQL (JSONB column) or DynamoDB for the state blob
- Keep gzip+base64 serialization format (engine already handles this) — just change the storage layer
- Store: `{ room_id, connector_type, state_blob, updated_at }`
- Retire the timestamp-keyed S3 backup pattern; use proper versioned backups if needed

### Hosting Options

**Option A — Managed container (recommended for simplicity)**
- Deploy as a Docker container to Railway, Render, or Fly.io
- One container runs all connector adapters + a shared HTTP/WS layer
- Managed Postgres included on all these platforms

**Option B — Serverless (if stateless per-request is feasible)**
- AWS Lambda or Cloudflare Workers
- Harder because the game engine holds in-memory state between events; would require loading state on every request (fine for low traffic)

**Option C — VPS (cheapest)**
- Single DigitalOcean / Hetzner droplet with Docker Compose
- Postgres container + app container + nginx

### Environment Variables

Generalize the Hubot-specific env var names:

```
# Replace:
HUBOT_DECK_MONSTERS_AWS_ACCESS_KEY_ID
HUBOT_DECK_MONSTERS_AWS_SECRET_ACCESS_KEY

# With generic names:
DECK_MONSTERS_AWS_ACCESS_KEY_ID
DECK_MONSTERS_AWS_SECRET_ACCESS_KEY
DATABASE_URL
```

## Tasks

- [ ] Design database schema for multi-room game state storage
- [ ] Implement a `StateStore` abstraction in the engine (replaces direct S3 calls)
- [ ] Implement a Postgres adapter for `StateStore`
- [ ] Add Docker + docker-compose setup for local development
- [ ] Choose and document target hosting platform
- [ ] Generalize AWS env var names (remove Hubot prefix)
- [ ] Add database migrations tooling (e.g., `node-pg-migrate` or `drizzle`)
