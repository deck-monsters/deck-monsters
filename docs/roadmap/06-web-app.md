# Web App Connector

**Category**: Feature / Connector  
**Priority**: High (ships alongside the Discord connector)  
**Status**: Not started

## Overview

A browser-based interface for Deck Monsters. Players visit the site, log in, join or create a room, and play the game in real time without needing Slack or Discord. The web app and Discord connector are the two launch connectors — they share the same backend, auth system, and event bus.

## Design Philosophy

Keep the charm of the original — the game is fundamentally a text feed of battle events. The web UI should make that feed readable and navigable without over-designing it. Think IRC client aesthetic, not mobile game UI.

## Architecture

```
Browser (React)
  ↕ tRPC client (@trpc/react-query)
  ↕ WebSocket subscription (ring feed — GameEvents in real time)
  ↕ tRPC mutations (commands: spawn, ring, equip, shop, etc.)
Server (packages/server)
  ↕ tRPC router + WebSocket server
  ↕ RoomManager
  ↕ Game Engine (event bus publishes GameEvents)
```

The web app is a thin client. No game logic runs in the browser — all game state lives on the server.

### How It Connects to the Event Bus

The web connector is the cleanest event bus consumer because it was designed alongside the event bus architecture:

1. User authenticates via Supabase Auth (Discord OAuth, Google OAuth, or email/password)
2. Client opens a tRPC WebSocket subscription to `ringFeed` for their current room
3. Server validates the Supabase JWT and subscribes to the room's `RoomEventBus` on behalf of this client
4. Public `GameEvent` objects are forwarded to all subscribed WebSocket clients in the room
5. Private `GameEvent` objects are forwarded only to the matching `targetUserId`
6. Prompt requests (equip choices, shop purchases) are sent as private events; the client renders a UI and responds via a tRPC mutation

### Reconnection

When a WebSocket disconnects and reconnects, the client sends its `lastEventId`. The server replays any missed events from the in-memory ring buffer (or database event log for longer disconnects). This is handled transparently by the tRPC subscription — see the backend hosting doc for details.

## Suggested Tech Stack

- **Server**: `packages/server` — Fastify with tRPC adapter (HTTP + WebSocket)
- **Frontend**: React with `@trpc/react-query` for fully typed API calls
- **Styling**: Simple CSS — dark terminal theme, monospace for card/combat rendering
- **Auth**: Supabase Auth via `@supabase/supabase-js` (handles OAuth flows, token refresh, session persistence)

## Core Views

| View | Description |
|------|-------------|
| Ring Feed | Live scrolling battle log — the main screen. Renders `GameEvent.text` in a monospace container. |
| My Monsters | Cards showing each monster's stats, deck, items, level |
| Deck Builder | Card selection UI for equipping a monster |
| Shop | Browse and buy items with current coin balance |
| Spawn | Form to create a new monster (choose type, name) |
| Explore | Send a monster on an expedition, see result |
| Room Lobby | Create/join rooms, see who's playing, invite friends |

### Ring Feed Rendering

The ring feed renders `GameEvent` objects. For most events, display the `text` field in a monospace font — this preserves the original ASCII card aesthetic. For events where the client wants richer rendering (monster stat cards, HP bars), use `type` and `payload` to build custom components. Start with text-only and add rich rendering incrementally.

## Graphics (Optional Enhancement)

See the graphics doc. The web app is the best place to add visual polish:
- Small monster sprite/icon next to monster names in the feed
- Card art thumbnails in the deck builder
- HP bar on monster status cards

All optional — the text works fine on its own.

## Tasks

- [ ] Create `packages/server` — Fastify + tRPC router + WebSocket server
- [ ] Implement tRPC procedures for all game commands (via RoomManager)
- [ ] Implement tRPC WebSocket subscription for ring feed with reconnection support
- [ ] Create `apps/web` — React app with `@trpc/react-query`
- [ ] Build ring feed view (WebSocket subscription → monospace text rendering)
- [ ] Build my monsters view
- [ ] Build deck builder view
- [ ] Build shop view
- [ ] Build spawn + explore views
- [ ] Build room management views (create, join, invite, member list)
- [ ] Integrate Supabase Auth (login/register pages with Discord OAuth, Google OAuth, and email/password)
- [ ] Responsive design (mobile browser should work reasonably well)
- [ ] Deploy to chosen hosting platform (see backend hosting doc)
