# Deck Monsters

A turn-based monster RPG game engine — think Pokémon meets deck-building. Players collect monsters, equip them with action card decks, and send them into a shared ring for automated fights while everyone watches.

The engine is platform-agnostic: a connector adapter plugs in and brings the game to any chat platform or app. The original connector was a Slack bot called **Jane**, which ran the game inside a private Slack workspace. The ring fights appeared in a shared channel; everything else (training monsters, building decks, buying items) happened through DMs with Jane.

The revived game currently ships through Discord and the web app. A mobile client remains
deferred.

---

## How It Plays

1. **DM the bot** to build your roster — train monsters, equip them with card decks, buy items from the shop, level them up over time
2. **Send a monster to the ring** — a shared channel where everyone's monsters fight automatically
3. **Watch the ring** — fights play out every 60 seconds, narrated in the channel; wins earn XP and coins
4. **Iterate** — swap cards, upgrade monsters, build toward stronger strategies

The game has 5 monster types, 60+ action cards across 4 classes (melee, healing, control, utility), and 25+ items. Monsters level up with experience, and stronger cards unlock at higher levels.

See [PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md) for all commands and sample deck builds,
[MONSTERS.md](MONSTERS.md) for monster stats, [CARDS.md](CARDS.md) for cards, and
[ITEMS.md](ITEMS.md) for item use, targeting scrolls, inventory and the room shop.

---

## Architecture

The engine has no platform-specific code. Every loaded `Game` belongs to one `roomId` and
publishes structured events through its `RoomEventBus`. The server package's `RoomManager`
abstraction owns room-scoped create/restore/persistence; an in-process connector resolves
a room through its own manager instance, then bridges the event bus to platform channels
with `ConnectorAdapter`.

```
Discord: guild/user mapping → roomId → RoomManager → Game + RoomEventBus
                                                     ↓
                                      ConnectorAdapter → Discord channels

Web: authenticated tRPC → membership check → roomId → RoomManager → Game + RoomEventBus
```

### Building a Connector

The current Discord connector is in-process: it creates one `RoomManager`, resolves a
guild/user to a validated `roomId`, and asks the manager for that room's game and event bus.
`ConnectorAdapter` translates public/private events and prompt requests into platform
callbacks:

```ts
import { ConnectorAdapter } from '@deck-monsters/engine'
import { RoomManager } from '@deck-monsters/server/room-manager'

const roomManager = new RoomManager(db, log)
const game = await roomManager.getGame(roomId)
const eventBus = await roomManager.getEventBus(roomId)
const adapter = new ConnectorAdapter(eventBus, publicChannel, `my-connector:${roomId}`, log)
adapter.registerUser(userId, privateChannel)

const action = game.handleCommand({ command })
if (action) await action({ channel: privateChannel, channelName, isAdmin, isDM, user })
```

`RoomManager` creates fresh state with `new Game({ roomId }, log)`, restores persisted state
with `restoreGame(gameJSON, log)`, and attaches a room-keyed `StateStore`. A connector must
not load a blob globally or persist without its `roomId`. Web clients use authenticated,
membership-checked tRPC procedures rather than constructing a browser-side `Game`.

The callback answer is a protocol boundary; read
[`docs/reference/prompt-answer-contract.md`](docs/reference/prompt-answer-contract.md).
Read [`docs/architecture/rooms-and-identity.md`](docs/architecture/rooms-and-identity.md)
before adding any room mapping or subscription.

Start at [`docs/README.md`](docs/README.md) for current subsystem contracts.

---

## Development

### Prerequisites

- Node.js v22 LTS (see `.nvmrc`)
- pnpm

### Install

```bash
pnpm install
```

### One-command local bootstrap (Supabase + env + test user)

```bash
pnpm setup:local
```

This script now bootstraps the full local environment by:
- installing workspace dependencies
- ensuring a working container runtime (Docker recommended; Podman fallback supported)
- starting/resetting local Supabase
- writing `.env.local`, `packages/server/.env.local`, and `apps/web/.env.local`
- creating a reusable local auth test user (default: `localtester@example.com`)

Common options:

```bash
bash scripts/setup-local.sh --runtime docker
bash scripts/setup-local.sh --runtime podman
bash scripts/setup-local.sh --skip-seed-user
bash scripts/setup-local.sh --seed-user-email you@example.com --seed-user-password 'strong-password'
bash scripts/setup-local.sh --dry-run
```

### Test

```bash
pnpm test              # mocha (all packages via Turborepo)
pnpm test:watch        # mocha --watch
pnpm test:coverage     # mocha + c8 coverage

# Web app (Vitest)
pnpm --filter @deck-monsters/web test          # vitest run
pnpm --filter @deck-monsters/web test:watch    # vitest --watch
pnpm --filter @deck-monsters/web test:coverage # vitest run --coverage
```

### Web App

The web app is a terminal workspace with five registered surfaces: Ring, Console,
Workshop, Fights, and Leaders. It keeps two distinct selectable slots; at 1024px and wider
both are visible, while narrower containers show one slot through tabs. Workshop, Fights,
and Leaders also have full-page routes. See
[`docs/architecture/web-workspace.md`](docs/architecture/web-workspace.md).

```bash
# Start the Vite dev server (proxies /trpc to localhost:3000)
pnpm --filter @deck-monsters/web dev

# Production build
pnpm --filter @deck-monsters/web build
```

Use the canonical
[`deployment environment table`](docs/operations/deployment.md#production-environment-variables)
for variables. For local or Cursor Cloud startup, follow
[`docs/operations/cloud-development.md`](docs/operations/cloud-development.md) and
[`docs/operations/local-testing.md`](docs/operations/local-testing.md).

---

### CLI Demos

```bash
node battlefield.js   # ring combat demo
```

### Regenerate Docs

```bash
pnpm run build:docs   # builds engine, then regenerates CARDS.md, DMG.md, MONSTERS.md, PLAYER_HANDBOOK.md, cards.html
```

---

## Documentation

| File | Contents |
|------|---------|
| [PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md) | All player commands + sample deck builds by level |
| [MONSTERS.md](MONSTERS.md) | Monster types and stat distributions |
| [CARDS.md](CARDS.md) | Player-facing card and item reference (name, description, rarity) |
| [DMG.md](DMG.md) | Dungeon Master / operator reference (stats, pacing, concurrency) |
| [AGENTS.md](AGENTS.md) | Codebase guide for AI-assisted development (`CLAUDE.md` is a symlink to it) |
| [docs/README.md](docs/README.md) | Current architecture, operations, reference, and agent-document index |
| [docs/roadmap/](docs/roadmap/) | Remaining-work index and active/backlog plans |
| [docs/archive/roadmap/](docs/archive/roadmap/) | Shipped roadmap plans and their design reasoning |

---

## Environment Variables

Server, web, and Discord connector variables are listed in
[`docs/operations/deployment.md`](docs/operations/deployment.md). The engine itself reads
only `DECK_MONSTERS_SKIP_DELAYS` (tests and the harness); the old AWS/S3 backup and its
`DECK_MONSTERS_AWS_*` variables were removed in the stack modernisation.

---

## Status

The TypeScript monorepo, Postgres/Supabase state, Railway deployment, tRPC API, auth,
multi-room model, Discord connector, and web workspace are shipped. Current work focuses
on gameplay, reliability, and presentation rather than rebuilding that platform.

The exploration system (expeditions), mobile client, and Slack connector are deferred; the
core game is Ring combat. See [`docs/roadmap/README.md`](docs/roadmap/README.md) for current
work and [`docs/archive/README.md`](docs/archive/README.md) for historical reasoning.
