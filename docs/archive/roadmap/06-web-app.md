# Web App Connector

> Historical record. Current code and documents linked from `docs/README.md` are
> authoritative. Any remaining work has been copied to the active roadmap.

> **Archived** — shipped; kept for the reasoning and constraints. Leftovers, if any, are tracked in [22 — Small Leftovers](../../roadmap/22-small-leftovers.md).

**Category**: Feature / Connector  
**Priority**: High (ships alongside the Discord connector)  
**Status**: Rebuilt — see [`06a-web-app.md`](06a-web-app.md) for the current implementation. The initial view-based implementation has been archived to `apps/web-legacy`; the new two-pane terminal UI is at `apps/web`.

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
The deferred Explore view is now a product decision in
[`docs/roadmap/12-new-content-backlog.md`](../../roadmap/12-new-content-backlog.md).
- [x] Build room management views (create, join, list)
- [x] Integrate Supabase Auth (login/register pages with Discord OAuth and email/password)
- [x] Responsive design (mobile browser baseline support)
Deployment subsequently shipped; current procedure is
[`docs/operations/deployment.md`](../../operations/deployment.md).

## UX notes from the first web app

Written before the terminal rebuild. Shipped items below are history. Flow-step indicators
and prompt-context labels are the remainder, tracked in
[`docs/roadmap/22-small-leftovers.md`](../../roadmap/22-small-leftovers.md).

Shipped since this note:

- **Structured game state.** Workshop and ring surfaces read character and monster fields
  from tRPC queries instead of parsing announce text.
- **Prompt timeout.** `sendPrompt` still times out after 120 seconds. The server publishes
  `prompt.timeout`, and the console marks that prompt timed out and unlocks input.
- **First-run training.** A player with no character gets a workshop form before training
  a monster, instead of discovering character creation only by issuing a command.
- **Cancel.** `game.cancelPrompt` abandons a pending prompt without waiting out the timeout.
- **Cross-view isolation.** The terminal puts public narration in the Ring pane and private
  replies in the Console, filtered by `targetUserId`. The old per-view ring subscriptions
  are gone.

Remainder, owned in small leftovers:

- Flow-step indicators for multi-step spawn, equip, and shop flows.
- Prompt-context labels that name which flow a prompt belongs to.
