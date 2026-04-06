# Web App Connector

**Category**: Feature / Connector  
**Priority**: High (ships alongside the Discord connector)  
**Status**: Implemented (initial version) — `apps/web` scaffolded with React + Vite + `@trpc/react-query`, Supabase auth, room lobby, ring feed subscription, and core gameplay views (monsters, deck builder, shop, spawn).

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
| Deck Builder | Card selection UI with drag-and-drop reordering and preset deck management (see below) |
| Shop | Browse and buy items with current coin balance |
| Spawn | Form to create a new monster (choose type, name) |
| Explore | Deferred (exploration is currently archived in revival scope) |
| Room Lobby | Create/join rooms, see who's playing, invite friends |

### Deck Builder

The deck builder is the most interactive view in the web app. Two key capabilities:

- **Drag-and-drop card reordering**: players drag cards to set play order within a 7-card deck. This is the most natural interaction model for the web — significantly easier than typing card positions in chat.
- **Deck presets**: players can save multiple named loadouts (e.g., "Defensive", "Aggressive", "Anti-Basilisk") and swap between them with one click before sending a monster to the ring. See the new content backlog for the full design. The web UI is the primary surface for creating/editing presets, but chat connectors will support swapping via commands too.

### Ring Feed Rendering

The ring feed renders `GameEvent` objects. For most events, display the `text` field in a monospace font — this preserves the original ASCII card aesthetic. For events where the client wants richer rendering (monster stat cards, HP bars), use `type` and `payload` to build custom components. Start with text-only and add rich rendering incrementally.

## Graphics (Optional Enhancement)

See the graphics doc. The web app is the best place to add visual polish:
- Small monster sprite/icon next to monster names in the feed
- Card art thumbnails in the deck builder
- HP bar on monster status cards

All optional — the text works fine on its own.

## Tasks

- [x] Create `packages/server` — Fastify + tRPC router + WebSocket server
- [x] Implement tRPC procedures for all game commands (via RoomManager)
- [x] Implement tRPC WebSocket subscription for ring feed with reconnection support
- [x] Create `apps/web` — React app with `@trpc/react-query`
- [x] Build ring feed view (WebSocket subscription → monospace text rendering)
- [x] Build my monsters view
- [x] Build deck builder view (drag-and-drop reordering + preset management foundation)
- [x] Build shop view
- [x] Build spawn view
- [ ] Build explore view (feature intentionally deferred while exploration remains archived)
- [x] Build room management views (create, join, list)
- [x] Integrate Supabase Auth (login/register pages with Discord OAuth and email/password)
- [x] Responsive design (mobile browser baseline support)
- [ ] Deploy to chosen hosting platform (see backend hosting doc)

## UX Improvements Backlog

The following improvements are tracked here for later — they are non-blocking for initial launch but would meaningfully improve player experience:

- **Structured game state API**: Expose a read-only query endpoint that returns character + monster data (name, type, HP, level, stats) as structured JSON, so the web UI doesn't have to parse free-form announce text to render monster cards. This also enables the "look at monsters" page to be data-driven rather than triggering a side-effectful game command.

- **Flow progress indicator**: When the user is in a multi-step interactive flow (spawn, equip, shop), show which step they are on (e.g. "Step 2 of 4 — Choose a name"). The engine knows the flow structure; this metadata could be included in the `prompt.request` payload.

- **Prompt context labels**: Show which flow a prompt belongs to (e.g. "Spawning your monster" vs. "Character setup") so users aren't confused when a prompt appears unexpectedly (e.g. first-time character creation triggered by any command).

- **Graceful prompt timeout handling**: The server-side `sendPrompt` times out after 120 seconds. When a prompt times out, notify the user in the UI (e.g. "The game stopped waiting for your answer — start a new command to try again."). Currently the user has no feedback that their flow was abandoned.

- **First-time onboarding**: Detect new users (no character yet) and surface a clear "Create your character" flow on first login, rather than requiring them to discover it by accident via a game command.

- **Cross-view event isolation**: Private `announce` events from one game flow (e.g. spawn) currently leak into other views' ring feed subscriptions. Views should filter events to only those relevant to the flow they initiated.

- **Cancel in-flight prompt**: Add a server-side mechanism for users to cancel a pending prompt (abandon the current flow) without waiting for the 120s timeout. This could be a `game.cancelPrompt` tRPC mutation.
