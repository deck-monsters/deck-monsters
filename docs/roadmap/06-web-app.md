# Web App Connector

**Category**: Feature / Connector  
**Priority**: Medium-High

## Overview

A browser-based interface for Deck Monsters. Players visit the site, log in, join or create a room, and play the game in real time without needing Slack or Discord.

## Design Philosophy

Keep the charm of the original — the game is fundamentally a text feed of battle events. The web UI should make that feed readable and navigable without over-designing it. Think IRC client aesthetic, not mobile game UI.

## Architecture

```
Browser (React or vanilla JS)
  ↕ WebSocket (real-time ring feed)
  ↕ REST API (commands: spawn, ring, equip, shop, etc.)
Node.js HTTP + WS Server
  ↕ method calls
Game Engine (this repo)
  ↕ callbacks
  Messages → WebSocket broadcast / user-specific push
```

## Suggested Tech Stack

- **Server**: Node.js with Fastify (or Express)
- **Real-time**: native `ws` library or socket.io for the ring feed
- **Frontend**: React (lightweight, or even just vanilla JS + htmx for minimal bundle)
- **Styling**: Simple CSS — keep it clean, maybe a dark terminal theme

## Core Views

| View | Description |
|------|-------------|
| Ring Feed | Live scrolling battle log — the main screen |
| My Monsters | Cards showing each monster's stats, deck, items, level |
| Deck Builder | Card selection UI for equipping a monster |
| Shop | Browse and buy items with current coin balance |
| Spawn | Form to create a new monster (choose type, name) |
| Explore | Send a monster on an expedition, see result |
| Room Lobby | Create/join rooms, see who's playing |

## Real-Time Design

- `publicChannel` callback → WebSocket broadcast to all clients in the room
- `privateChannel` callback → WebSocket message to the specific user's connection
- Events appear in the ring feed as they happen, no page refresh needed
- New players joining mid-battle catch up via a recent-messages buffer (last N events)

## Graphics (Optional Enhancement)

See the graphics issue. The web app is the best place to add simple visual polish:
- Small monster sprite/icon next to monster names in the feed
- Card art thumbnails in the deck builder
- HP bar on monster status cards

All optional — the text works fine on its own.

## Tasks

- [ ] Set up Node.js HTTP server project structure
- [ ] Implement WebSocket broadcast for public channel messages
- [ ] Implement REST endpoints for all game commands
- [ ] Build ring feed view (WebSocket client)
- [ ] Build my monsters view
- [ ] Build deck builder view
- [ ] Build shop view
- [ ] Build spawn + explore views
- [ ] Build room management views
- [ ] Add auth integration (JWT)
- [ ] Deploy to chosen hosting platform
- [ ] Responsive design (mobile browser should work reasonably well)
