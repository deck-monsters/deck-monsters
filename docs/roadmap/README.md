# Deck Monsters — Roadmap

**Last updated**: April 2026

This directory tracks all planned, active, and completed work on the Deck Monsters revival.
Each document covers one area; this README is the authoritative index of status and priority.

---

## Status at a Glance

| Doc | Area | Status |
|-----|------|--------|
| [01 — Modernize Stack](01-modernize-stack.md) | TypeScript, Mocha, pnpm/Turborepo, CI | ✅ Done |
| [02 — Backend Hosting](02-backend-hosting.md) | Supabase, Railway, Drizzle ORM, tRPC | ✅ Done (manual infra remaining) |
| [03 — Auth & Identity](03-auth-and-identity.md) | JWT, Supabase Auth, Discord + web email | ✅ Phase 1 done |
| [04 — Multi-Room/Groups](04-multi-room-groups.md) | RoomManager, invite codes, idle sweeps | ✅ Server code done |
| [15 — Ring Feed Timestamps](15-ring-feed-timestamps.md) | `timeago.js`, hover tooltips | ✅ Done |
| [10 — Bug Fixes](10-bug-fixes.md) | Code quality, UX, fight-log sync | 🔧 Active — 2 cleanup items + new sync bugs |
| [05 — Discord Connector](05-discord-connector.md) | 14 slash commands, event bus, embeds | 🔧 Active — admin role, `/preset`, tests |
| [06a — Web App](06a-web-app.md) | Terminal UI, ring feed, lobby, rooms | 🔧 Active — Phase 3 polish |
| [13 — Leaderboard](13-leaderboard.md) | Player/monster stats, web UI | 🔧 Nearly done |
| [14 — Fight Stats](14-fight-stats.md) | Fight summaries, catch-up feed | 🔧 Active — sync bugs being fixed |
| [16 — Card Management](16-card-management.md) | Inventory, presets, web workshop | 📋 Proposed |
| [11 — Balance & Mechanics](11-balance-and-mechanics.md) | Stat reform, initiative, saving throws | 📋 Backlog (needs battle sim harness) |
| [12 — New Content](12-new-content-backlog.md) | Cards, monsters, items, adventures | 📋 Post-launch backlog |
| [09 — Graphics](09-graphics.md) | Sprites, icons, optional visual polish | 📋 Post-launch, low priority |
| [17 — Pixel Art Fight Animations](17-pixel-art-fight-animations.md) | SNES theme only, progressive enhancement | 📋 Post-launch, fun |
| [07 — Mobile App](07-mobile-app.md) | React Native + Expo | ⏸️ Deferred indefinitely |
| [08 — Slack Connector](08-modernize-slack-connector.md) | Bolt SDK, replace Jane/Hubot | ⏸️ Deferred indefinitely |

---

## What's Done

Everything below shipped and is not expected to need revisiting:

- **TypeScript migration** — all JS converted (303 `.ts` files), strict mode, ESM
- **Monorepo** — pnpm workspaces + Turborepo; packages: `engine`, `web`, `discord`, `api`
- **CI** — GitHub Actions: typecheck + lint + tests on every push and PR
- **Hosting** — Supabase (Postgres + Auth + Realtime) + Railway (API + connectors); Drizzle ORM; tRPC API
- **Auth** — Supabase Auth + JWT validation; `user_connectors` table; Discord auto-creation; web email/password
- **RoomManager** — lazy load/unload, invite codes, idle room sweeps, room-scoped character data
- **Discord connector** — 14 slash commands, event bus bridging, button/select-menu prompts, guild-room mapping, embed rendering
- **Web app (Phases 1 & 2)** — terminal aesthetic, ring pane with live updates, console pane with input, inline choice rendering, quick-action suggestions, responsive layout (side-by-side / tabbed), tab keyboard shortcuts, room lobby, room settings, account page, Supabase Auth UI
- **Ring feed timestamps** — `timeago.js` integration, absolute-time hover tooltips, key-event markers, opt-in toggle in Account settings
- **Leaderboard** — `room_player_stats` / `room_monster_stats` tables, `FightStatsSubscriber`, tRPC procedures, win-streak tracking, web leaderboard page
- **Fight stats** — `fight_summaries` table, `FightSummaryWriter`, catch-up text command, web fight log page with expandable detail, last-fight ticker in ring pane
- **Battle history persistence** — stored in `options.battles`, capped at 20, survives restarts
- **Bug fixes** — 12 of 14 items complete (see `10-bug-fixes.md`)

---

## Active Work — In Order of Priority

### 1. Fight log and console feed sync (10-bug-fixes.md, 14-fight-stats.md) — HIGH

Two related real-time data problems that affect the core game loop experience:

- **Fight log not updating** — the fight log page shows the state at initial load but does not reflect new fights as they complete. Subscription or cache invalidation is broken.
- **Console missing history on return** — if a player navigates away and comes back (or reconnects after a disconnect), the console pane does not replay events that happened while they were gone. The reconnection-with-replay path is not delivering historical data.

Fix these before other polish work — stale data makes the game feel broken.

### 2. Discord connector polish (05-discord-connector.md)

- Admin role support (map Discord roles → `isAdmin`)
- `/preset` command for saved deck presets
- Slash command integration tests

### 3. Web app Phase 3 polish (06a-web-app.md)

- Theming refinements (CSS custom property overrides, user theme persistence)
- Mobile layout polish (single-column flow, touch targets)
- Accessibility pass (keyboard nav, ARIA roles on dynamic regions)

### 4. Card management system (16-card-management.md)

A fully proposed (not yet started) feature: unified inventory view, unequip/move commands, preset deck save/load, and a web `/workshop` route with drag-and-drop. High player-facing value; implement after connector polish.

### 5. Balance & mechanics (11-balance-and-mechanics.md)

Design doc is ready. Blocked on a battle simulation harness for safe regression testing. Key items: crit fail for all cards, stat variance reform, initiative rolls, saving throws. Start by building the sim harness, then iterate.

### 6. New content backlog (12-new-content-backlog.md)

New cards (10+ designs documented), two new monster types (Time Lord / Wizard, Bureaucrat / Cleric), equipment slots, adventures/job board, tournaments. Post-launch, driven by player demand.

### 7. Pixel art fight animations — SNES theme (17-pixel-art-fight-animations.md)

A fun post-launch enhancement: a retro SNES theme that layers pixel art fight animations on top of the text ring feed. All other themes stay clean and text-only — this is pure progressive enhancement. The animation module only loads when the SNES theme is active, so there's no cost for everyone else. Monster sprites (one idle + attack + hit + faint per monster type) can be generated with PixelLab and refined in Aseprite. See `docs/pixel-art-animations-in-js.md` for the full technical reference on Canvas sprite sheets, CSS-only animation, and the crisp-rendering rules for pixel art.

---

## Architecture Rule: Room-Level Scoping

**All game state, events, database queries, and API calls must be scoped to a room.**

Violations have caused bugs in the past — global state leaking across rooms, queries missing a `room_id` filter, events broadcasting to the wrong audience. See [`docs/room-scoping.md`](../room-scoping.md) for the full rule and checklist.

When touching anything that touches game data, always ask: _does this include the room?_

---

## Deferred Indefinitely

These are not on the active roadmap. They can be revisited if there is demand or a clear opportunity, but no work should be started or planned against them.

### Mobile App (07-mobile-app.md)

React Native + Expo for iOS and Android. The tRPC API is already mobile-compatible, so the technical path is clear when the time comes. Deferred until the game has a stable web presence and an active player base that wants a native app.

### Slack Connector (08-modernize-slack-connector.md)

Modernizing Jane (the original Hubot/Slack bot) with the Bolt SDK and the new event bus. Slack is not the focus of the revival. Deferred indefinitely; can be revisited if there is a specific workspace that wants to run the game.

---

## Open Infrastructure Tasks

These are not code tasks — they require manual setup in external services:

- [ ] Create production Supabase project (enable Realtime, set up OAuth providers)
- [ ] Configure Railway deployment (env vars, service links, health checks)
- [ ] Enable Discord OAuth in Supabase Auth dashboard
- [ ] Enable Google / Apple OAuth (Phase 2 of auth plan)
- [ ] Set `DECK_MONSTERS_AWS_*` env vars if S3 backup is desired (optional)
