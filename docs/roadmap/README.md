# Deck Monsters — Roadmap

**Last updated**: April 2026

This directory tracks all planned, active, and completed work on the Deck Monsters revival.
Each document covers one area; this README is the authoritative index of status and priority.

---

## Status at a Glance

| Doc | Area | Status |
|-----|------|--------|
| [01 — Modernize Stack](01-modernize-stack.md) | TypeScript, Mocha, pnpm/Turborepo, CI | ✅ Done |
| [02 — Backend Hosting](02-backend-hosting.md) | Supabase, Railway, Drizzle ORM, tRPC | ✅ Done — live in production |
| [03 — Auth & Identity](03-auth-and-identity.md) | JWT, Supabase Auth, Discord + Google OAuth | ✅ Phase 1 + 2 done; Apple deferred |
| [04 — Multi-Room/Groups](04-multi-room-groups.md) | RoomManager, invite codes, web UI, Discord | ✅ Done |
| [15 — Ring Feed Timestamps](15-ring-feed-timestamps.md) | `timeago.js`, hover tooltips | ✅ Done |
| [06a — Web App](06a-web-app.md) | Terminal UI, ring feed, lobby, rooms | ✅ Done — live at deck-monsters.com |
| [13 — Leaderboard](13-leaderboard.md) | Player/monster stats, web UI | ✅ Done |
| [16 — Card Management](16-card-management.md) | Inventory, presets, web workshop | ✅ Done — card workshop shipped |
| [Boss Encounters](../boss-encounters.md) | Boss summoning, ring events, teams/targeting | ✅ Done — architecture doc, not a roadmap item |
| [10 — Bug Fixes](10-bug-fixes.md) | Open bugs, UX polish, cleanup | ✅ Archive — all audit items resolved |
| [10b — Bugs Fixed (Archive)](10b-bugs-fixed.md) | Resolved bugs, historical record | ✅ Archive — nothing to action |
| [05 — Discord Connector](05-discord-connector.md) | Slash commands, event bus, embeds | 🔧 Active — deployed, not heavily used; admin role + tests remaining |
| [14 — Fight Stats](14-fight-stats.md) | Fight summaries, catch-up feed | ✅ Done — core shipped; optional enhancements remain |
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
- **Monorepo** — pnpm workspaces + Turborepo; packages: `engine`, `server`, `connector-discord`, `harness`, `shared-ui`; apps: `web`
- **CI** — GitHub Actions: typecheck + lint + tests on every push and PR
- **Production infrastructure** — Supabase project provisioned (Postgres + Auth + Realtime), Railway deployment configured, deck-monsters.com live
- **Hosting architecture** — Drizzle ORM + tRPC API + Fastify server + Docker multi-stage build; deployment docs complete
- **Auth** — Supabase Auth + JWT validation; `user_connectors` table; Discord auto-creation; web email/password; Google OAuth; Discord OAuth — all live
- **RoomManager** — lazy load/unload, invite codes, idle room sweeps, room-scoped character data
- **Discord connector** — slash commands (`/spawn`, `/ring`, `/equip`, `/shop`, `/buy`, `/sell`, `/use`, `/status`, `/monsters`, `/dismiss`, `/revive`, `/ring-status`, `/create-room`, `/join-room`, `/help`), event bus bridging, button/select-menu prompts, guild-room mapping, embed rendering
- **Web app** — all three phases complete and live at deck-monsters.com: terminal aesthetic, ring pane, console pane, inline choices, quick-action suggestions, responsive layout, tab shortcuts, room lobby, room settings, account page, theme picker (phosphor + amber + CRT toggle), mobile input dock, accessibility pass, reduced-motion/contrast support; `apps/web-legacy` removed
- **Ring feed timestamps** — `timeago.js` integration, absolute-time hover tooltips, key-event markers, opt-in toggle in Account settings
- **Leaderboard** — `room_player_stats` / `room_monster_stats` tables, `FightStatsSubscriber`, tRPC procedures, win-streak tracking, web leaderboard page
- **Fight stats** — `fight_summaries` table, `FightSummaryWriter`, catch-up text command, web fight log page with expandable detail, last-fight ticker in ring pane
- **Card workshop** — full card management shipped: unequip/move commands, preset save/load/delete, drag-and-drop web workshop at `/workshop`
- **Battle history persistence** — stored in `options.battles`, capped at 20, survives restarts
- **Boss encounters** — player boss summoning (3 per rolling 24h, per room) and Ring Events: random encounter modifiers that trigger multi-boss gauntlets, free-for-alls, player alliances, and team battles by surfacing the engine's existing team/targeting machinery. `victoryMode: 'last-team'` for Common Cause and House War: combat ends when one faction survives and all survivors win. Centralized activation (`Ring.activateRingEvent`), quorum-drop event clearing, free-for-all centralized in `getTarget`, contestant-level XP team overrides, and restart-gap fix for the boss summon quota (`bossSummonsPending`). Documented in [`docs/boss-encounters.md`](../boss-encounters.md)
- **Bug fixes** — all tracked audit items resolved; see `10b-bugs-fixed.md` for the archive, including DMG/CARDS content differentiation (#3), batch-equip UX (#19), per-room card shop scoping (#26), boss-sentinel leaderboard fixes (#27–#33), combat/event findings (#34–#50), and the 2026-08-03 audit fixes (#51–#58, #59–#63, #64, #65–#69, #70–#73, #74–#81).

---

## Active Work — In Order of Priority

Real-time sync bugs, quick actions, batch-equip UX, card shop room-scoping, DMG/CARDS content differentiation (#3), and the 2026-08-03 audit fixes (#51–#81) are all archived in `10b-bugs-fixed.md`. `10-bug-fixes.md` has no remaining active items.

### 1. Discord connector polish (05-discord-connector.md)

The connector is deployed but has not been heavily used or tested in production. Remaining work before it can be considered solid:

- Admin role support — map Discord guild owner/admin role → `isAdmin: true` in commands; currently hardcoded `false`
- Slash command integration tests
- `/preset` command for saved deck presets (the engine support exists; needs the slash command wired up)

### 2. Balance & mechanics (11-balance-and-mechanics.md)

Design doc is ready. Blocked on a battle simulation harness for safe regression testing. Key items: crit fail for all cards, stat variance reform, initiative rolls, saving throws. Start by building the sim harness, then iterate.

### 3. New content backlog (12-new-content-backlog.md)

New cards (10+ designs documented), two new monster types (Time Lord / Wizard, Bureaucrat / Cleric), equipment slots, adventures/job board, tournaments. Post-launch, driven by player demand.

### 4. Pixel art fight animations — SNES theme (17-pixel-art-fight-animations.md)

A fun post-launch enhancement: a retro SNES theme that layers pixel art fight animations on top of the text ring feed. All other themes stay clean and text-only — this is pure progressive enhancement. The animation module only loads when the SNES theme is active, so there's no cost for everyone else. Monster sprites (one idle + attack + hit + faint per monster type) can be generated with PixelLab and refined in Aseprite. See `docs/pixel-art-animations-in-js.md` for the full technical reference.

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

