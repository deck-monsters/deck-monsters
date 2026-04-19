# CLAUDE.md — Deck Monsters

## Project Overview

Deck Monsters is a turn-based monster-battling RPG game engine (think Pokémon meets deck-building). Players spawn monsters, equip them with action card decks, and send them into an auto-battling arena. The engine is platform-agnostic and driven by external connector adapters (Discord, web, and others).

Originally built to run inside a private Slack workspace (via a Hubot bot named Jane). The project has been revived with a modern TypeScript monorepo, Supabase + Railway hosting, Discord and web connectors, auth, and multi-room support.

## Repository Layout

pnpm monorepo managed by Turborepo:

```
packages/
  engine/          # @deck-monsters/engine — core game logic (TypeScript, ESM)
  server/          # @deck-monsters/server — Fastify + tRPC API, RoomManager, event persistence
  connector-discord/  # @deck-monsters/connector-discord — Discord.js v14 slash commands
  harness/         # @deck-monsters/harness — CLI battle harness and integration test scenarios
  shared-ui/       # @deck-monsters/shared-ui — CSS custom properties, shared theme tokens

apps/
  web/             # @deck-monsters/web — Vite + vanilla TS web app (terminal aesthetic)

supabase/          # Supabase migrations and local dev config
scripts/           # Repo-level setup scripts (setup:local, etc.)
docs/              # Architecture docs, roadmap, archive
  roadmap/         # All roadmap docs + README.md index
  room-scoping.md  # Critical architectural rule — read this
```

### Engine source layout (`packages/engine/src/`)

```
index.ts           # Public API: Game, restoreGame, resetGame, getOptions
game.ts            # Main Game class (orchestrator, state serialization)
commands/          # Text command parser: monster, character, look-at, store, presets, history, help
cards/             # 60+ action card types; base class in cards/base.ts
monsters/          # 5 monster types (Basilisk, Gladiator, Jinn, Minotaur, Weeping Angel)
creatures/base.ts  # BaseCreature — core combat/stat logic (~977 lines, being decomposed)
characters/        # Beastmaster player character + hydration helpers
items/             # 25+ items: potions, scrolls, store inventory
ring/              # Battle arena (2–12 monsters, auto-battle every 60s)
channel/           # ChannelManager: message queue + batching for adapters
helpers/           # XP, leveling, targeting, timing, AWS backup
constants/         # Stats, coin values, creature types, card classes, timing
announcements/     # Message generation for game events
events/            # GameEvent types
schemas/           # Zod schemas for state deserialization and validation
```

## Tech Stack

- **Runtime**: Node.js v22 LTS
- **Language**: TypeScript (strict mode, ESM throughout)
- **Monorepo**: pnpm workspaces + Turborepo
- **Database**: Supabase (Postgres) + Drizzle ORM
- **API**: Fastify + tRPC (type-safe end-to-end)
- **Auth**: Supabase Auth — JWT validation, Discord OAuth, web email/password
- **Hosting**: Railway (server + Discord connector), Supabase (DB + Auth + Realtime)
- **Testing**: Mocha (engine, server, discord, harness) + Vitest (web)
- **Linting**: `@typescript-eslint` + Prettier
- **CI**: GitHub Actions — typecheck + lint + tests on every push and PR

## Development Commands

```bash
# Build all packages (required before first test run on a fresh checkout)
pnpm build

# Test everything
pnpm test

# Per-package
pnpm --filter @deck-monsters/engine test
pnpm --filter @deck-monsters/server test
pnpm --filter @deck-monsters/web test       # Vitest

# Watch mode (web)
pnpm --filter @deck-monsters/web test:watch

# Type-check all packages
pnpm typecheck

# Lint
pnpm lint

# Local Supabase stack (requires Docker)
pnpm setup:local --skip-install   # starts Supabase, runs migrations, seeds test user, writes .env.local files

# Start server + web app (after sourcing env)
set -a && source .env.local && set +a
pnpm --filter @deck-monsters/server dev   # port 3000
pnpm --filter @deck-monsters/web dev      # port 5173

# Regenerate CARDS.md / DMG.md / probability docs
node ./build
```

> **Important**: `pnpm build` must run before `pnpm test` on a fresh checkout. The server, discord, and web packages import from `@deck-monsters/engine` via its `dist/` output.

## Environment Variables

### Server (`packages/server`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable API key |
| `SUPABASE_SECRET_KEY` | Supabase service role key |
| `CONNECTOR_SERVICE_TOKEN` | Inter-service auth token (Discord connector → server) |
| `PORT` | Server port (default: 3000) |
| `CORS_ORIGINS` | Comma-separated allowed origins (default: `http://localhost:5173`) |

### Web app (`apps/web`)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` but Vite-prefixed |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as `SUPABASE_PUBLISHABLE_KEY` but Vite-prefixed |
| `VITE_SERVER_URL` | tRPC server URL (blank = same origin via Vite proxy) |

### Engine (optional)

| Variable | Purpose |
|----------|---------|
| `DECK_MONSTERS_AWS_ACCESS_KEY_ID` | S3 backup credentials (optional) |
| `DECK_MONSTERS_AWS_SECRET_ACCESS_KEY` | S3 backup credentials (optional) |

> The old `HUBOT_DECK_MONSTERS_AWS_*` names are still accepted with a deprecation warning for backward compatibility.

## How the Game Engine Works

### Adapter Pattern

The engine has no Discord/HTTP/database code. Connectors instantiate the game and provide two callbacks:

1. `publicChannel` — broadcasts ring events to the whole room
2. `privateChannel` — sends a DM to a specific player; also handles interactive prompts

Both share the same signature: `({ announce, question?, choices?, delay? }) => Promise<string | void>`

- `{ announce }` — fire-and-forget message
- `{ question, choices }` — interactive prompt; the connector must present choices to the user and resolve with their answer

```ts
import { Game, restoreGame } from '@deck-monsters/engine'

const publicChannel = ({ announce }) => postToChannel(roomChannel, announce)

const privateChannel = ({ announce, question, choices }) => {
  if (announce) return sendDM(userId, announce)
  if (question) return promptUser(userId, question, choices) // resolves with user's answer
}

const game = savedState
  ? restoreGame(publicChannel, savedState, log)
  : new Game(publicChannel, {}, log)

game.saveState = (state) => db.save(state) // engine calls this on every stateChange

// Dispatch a text command
const action = game.handleCommand({ command: 'send a monster to the ring' })
if (action) await action({ channel: privateChannel, channelName, isAdmin, isDM, user })
```

### `handleCommand`

`game.handleCommand({ command })` parses a natural language string and returns an action function, or `null`. Command handlers live in `packages/engine/src/commands/`:

- `monster.ts` — spawn, equip, ring, dismiss, revive, look at monster(s)
- `character.ts` — look at character, rankings, edit character
- `look-at.ts` — look at card, item, handbook, ring
- `store.ts` — buy, sell
- `presets.ts` — save/load/delete deck presets
- `history.ts` — catch-up fight history text command
- `help.ts` — in-game help
- `catalog.ts` — card catalog lookup

Admin alias feature: `"<command> as <name>"` runs a command as another character (admin-only). New connectors can register additional commands via `registerHandler(matcher, action)`.

### Game Loop

1. Monsters join ring → `ring.addMonster()`
2. ≥2 monsters triggers `startFightTimer()` (encounter every 60s)
3. Each encounter: monsters play next card in their deck (wraps when exhausted)
4. Cards resolve: 1d20 + modifiers vs AC for hit check, then damage/effects
5. Victory/Loss/Flee events → XP + coins awarded, possible card drop
6. Ring loops; players can swap/update decks between fights

### State Serialization

Game state is gzip+base64 encoded JSON, stored in Postgres (primary) and optionally S3 (backup). `game.saveState` is a getter/setter:

```ts
// Store the save function
game.saveState = (base64GzipString) => db.save(base64GzipString)
// Engine calls this.saveState() automatically on every 'stateChange' event

// Restore
restoreGame(publicChannel, base64GzipString, logger)
// Hydrates: characters → monsters → cards → items (recursive)
```

### Channel Manager

The engine batches outgoing messages (3000-char max per batch) to respect platform rate limits. Connectors should implement appropriate pacing — Discord uses interaction followups; the original Slack connector used 1200ms delays between messages.

### Event Bus

The server maintains a `GameEvent` stream per room. Events flow:

```
Game (engine) → publicChannel callback → server subscriber → Supabase Realtime / tRPC subscription → web/Discord clients
```

`FightSummaryWriter` persists fight results to `fight_summaries`. `FightStatsSubscriber` updates `room_player_stats` and `room_monster_stats` for the leaderboard.

## Critical Architecture Rule: Room-Level Scoping

**All game state, events, database queries, and API calls must be scoped to a room.**

Every DB query on game data needs a `where room_id = ?` clause. Every tRPC procedure must validate room membership before returning data. Every event emission carries a `roomId`; every subscriber filters by it. WebSocket/SSE subscriptions must be gated to the current room and torn down when navigating away.

See [`docs/room-scoping.md`](docs/room-scoping.md) for the full rule with code examples, a code-review checklist, and a table of common failure patterns. Past bugs have been caused by missing room filters — treat this as a hard constraint, not a guideline.

## Architecture Notes for New Connectors

1. Implement the channel callback: `({ announce, question?, choices?, delay? }) => Promise`
   - `announce` — post to channel/DM; return after sending
   - `question` + `choices` — prompt the user; resolve with their text answer (timeout ~2 min)
2. Initialize: `restoreGame(publicChannel, savedState, log)` or `new Game(publicChannel, {}, log)`
3. Set the save function: `game.saveState = (state) => db.save(state)`
4. For chat-style connectors: strip bot prefix → `game.handleCommand({ command })` → call returned action with `{ channel, channelName, isAdmin, isDM, user }`
5. For slash command / REST connectors: call `game.getCharacter({ channel, id, name })` directly, then invoke specific action methods
6. Connect to the server's event bus (via `CONNECTOR_SERVICE_TOKEN`) to receive and forward `GameEvent` objects to platform channels

## Known Issues

- **Fight log not updating** — the web fight log page goes stale after initial load; new fights don't appear without a manual refresh. Subscription or cache invalidation is not wired correctly. (#15 in `docs/roadmap/10-bug-fixes.md`)
- **Console missing history on reconnect** — the console pane doesn't replay events from while the user was away. The reconnect-with-replay path exists but isn't delivering historical data. (#16 in `docs/roadmap/10-bug-fixes.md`)
- **`creatures/base.ts` still large** — ~977 lines after the TypeScript migration (down from ~2000). Continue incremental decomposition into `creatures/combat.ts`, `creatures/stats.ts`, etc.
- **`DMG.md` / `CARDS.md` differentiation** — build scripts differentiate the headers but a full content pass distinguishing DM-facing vs. player-facing content hasn't happened yet.

## Archived / Deferred

- **Exploration system** (`exploration/`) — monster expeditions (find loot, hazards, death cards). Archived for the revival; the core game is ring combat. See `docs/archive/exploration-system.md`.
- **Mobile app** — React Native + Expo. Deferred indefinitely. The tRPC API is mobile-compatible when the time comes. See `docs/roadmap/07-mobile-app.md`.
- **Slack connector** — Bolt SDK modernization of Jane/Hubot. Deferred indefinitely. See `docs/roadmap/08-modernize-slack-connector.md`.

## Roadmap

See [`docs/roadmap/README.md`](docs/roadmap/README.md) for the full picture — status of every area, what's done, what's active, what's next in priority order, and what's deferred indefinitely.
