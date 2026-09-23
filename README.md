# Deck Monsters

A turn-based monster RPG game engine — think Pokémon meets deck-building. Players collect monsters, equip them with action card decks, and send them into a shared ring for automated fights while everyone watches.

The engine is platform-agnostic: a connector adapter plugs in and brings the game to any chat platform or app. The original connector was a Slack bot called **Jane**, which ran the game inside a private Slack workspace. The ring fights appeared in a shared channel; everything else (training monsters, building decks, buying items) happened through DMs with Jane.

The TypeScript monorepo, room-scoped Postgres state, Railway deployment, Discord connector, and web workspace are shipped. Open work and deferred product boundaries are in the [roadmap](docs/roadmap/README.md).

---

## How It Plays

1. **DM the bot** to build your roster — train monsters, equip them with card decks, buy items from the shop, level them up over time
2. **Send a monster to the ring** — a shared channel where everyone's monsters fight automatically
3. **Watch the ring** — fights play out every 60 seconds, narrated in the channel; wins earn XP and coins
4. **Iterate** — swap cards, upgrade monsters, build toward stronger strategies

See [PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md) for commands and sample deck builds,
[MONSTERS.md](MONSTERS.md) for monster stats, [CARDS.md](CARDS.md) for cards, and
[ITEMS.md](ITEMS.md) for item use, targeting scrolls, inventory and the room shop.
Card and monster counts live in those generated references.

---

## Architecture

The engine has no platform-specific code. Every loaded `Game` belongs to one `roomId` and
publishes structured events through its `RoomEventBus`. The server package's `RoomManager`
owns room-scoped create, restore, and persistence. An in-process connector resolves a
validated `roomId`, then bridges that room's event bus with `ConnectorAdapter`.

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

`RoomManager` creates fresh state with `new Game({ roomId }, log)` and restores persisted
state with `restoreGame(gameJSON, log)`. A connector must not load or save a blob without
its `roomId`. Web clients use authenticated, membership-checked tRPC procedures.

The callback answer is a protocol boundary; read
[`docs/reference/prompt-answer-contract.md`](docs/reference/prompt-answer-contract.md).
Read [`docs/architecture/rooms-and-identity.md`](docs/architecture/rooms-and-identity.md)
before adding any room mapping or subscription. Current subsystem contracts start at
[`docs/README.md`](docs/README.md).

---

## Development

Node.js v22 LTS (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm setup:local          # local Supabase, env files, and a test user
pnpm build                # required before the first test on a fresh checkout
pnpm test
pnpm typecheck
pnpm lint

pnpm --filter @deck-monsters/server dev    # API, port 3000
pnpm --filter @deck-monsters/web dev       # web app, port 5173
pnpm run build:docs       # regenerate the player references from engine source
```

`pnpm build` comes first because `server`, `connector-discord`, and `web` import
`@deck-monsters/engine` from `dist/`. Root `pnpm dev` only rebuilds packages. Local
Supabase options, Cursor Cloud, production variables, and reusable test rooms are in
[`docs/operations/cloud-development.md`](docs/operations/cloud-development.md),
[`docs/operations/deployment.md`](docs/operations/deployment.md), and
[`docs/operations/local-testing.md`](docs/operations/local-testing.md).

```bash
node battlefield.js   # ring combat demo, no services required
```

---

## Documentation

| File | Contents |
|------|---------|
| [PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md) | Generated player commands, rules, and sample deck builds |
| [MONSTERS.md](MONSTERS.md) | Generated monster types and stat distributions |
| [CARDS.md](CARDS.md) | Generated card and item catalogue |
| [DMG.md](DMG.md) | Generated operator reference for stats, pacing, and formulas |
| [ITEMS.md](ITEMS.md) | Authored item, inventory, and shop rules |
| [AGENTS.md](AGENTS.md) | Repository rules and trigger-based doc router (`CLAUDE.md` is a symlink) |
| [docs/README.md](docs/README.md) | Current architecture, operations, reference, and agent-document index |
| [docs/roadmap/](docs/roadmap/) | Open work and the status index |

Generated Markdown files say so at the top. Change them by editing
`packages/engine/src/build` and running `pnpm run build:docs`.
