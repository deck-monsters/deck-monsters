# CLAUDE.md — Deck Monsters

## Project Overview

Deck Monsters is a turn-based monster-battling RPG game engine (think Pokémon meets deck-building). Players spawn monsters, equip them with action card decks, and send them into an auto-battling arena. The engine is platform-agnostic and designed to be driven by external connector adapters (Slack, Discord, web, mobile, etc.).

Originally built to run inside a private Slack workspace. The project is being revived with modern infrastructure, new connectors (Discord, web, mobile), auth, and multi-group/room support.

## Repository Layout

```
index.js               # Public API: Game, restoreGame, resetGame, getOptions
game.js                # Main Game class (orchestrator, state serialization)
cards/                 # 60+ action card types; base.js is the card base class
monsters/              # 5 monster types (Basilisk, Gladiator, Jinn, Minotaur, Weeping Angel)
creatures/base.js      # BaseCreature — core combat/stat logic (~2000 lines, monolithic)
characters/            # Player character (Beastmaster) + hydration helpers
items/                 # 25+ items: potions, scrolls, store inventory
ring/                  # Battle arena (2–12 monsters, auto-battle every 60s)
exploration/           # Monster exploration system (hazards, death cards)
channel/               # ChannelManager: message queue + batching for adapters
helpers/               # XP, leveling, targeting, delay-times, AWS backup
constants/             # Stats, coin values, creature types, card classes
announcements/         # Message generation for game events
build/                 # Doc generation scripts (card catalog, probabilities)
shared/                # BaseClass, test utilities (test-setup.js)
```

## Tech Stack

**Current (legacy JS)**
- **Runtime**: Node.js v8 (EOL — being upgraded to v22)
- **Key libs**: bluebird (promises), lodash (utilities), roll (dice), node-emoji, moment, word-wrap
- **State persistence**: gzip+base64 → external adapter callback + AWS S3 backup (throttled 5 min)
- **Testing**: Mocha via `@salesforce-mc/devtest` (internal Salesforce package — being replaced)
- **Linting**: ESLint with Salesforce SFMC config (being replaced)

**Target (TypeScript revival)**
- **Language**: TypeScript (strict mode, ESM, Node.js v22)
- **Testing**: Vitest (Jest-compatible API, native TS + ESM support, much faster)
- **Monorepo**: pnpm workspaces + Turborepo
- **Database**: Drizzle ORM + PostgreSQL
- **API**: tRPC (type-safe end-to-end for web + mobile clients)
- **Runtime validation**: Zod (state deserialization, incoming command validation)
- **Linting**: `@typescript-eslint` + Prettier

## How the Game Engine Works

### Adapter Pattern
The engine has **no Slack/Discord/HTTP code**. Connectors instantiate the game and relay commands:

```javascript
const { Game, restoreGame } = require('deck-monsters')

// Provide two channel callbacks: public (broadcast) and private (DM)
const game = new Game(publicChannelFn, options, logger)
const character = await game.getCharacter(privateChannelFn, userId, userInfo)

// Then map platform commands → character/game methods
await character.spawnMonster({ type: 'Basilisk', name: 'Fang' })
await character.sendMonsterToTheRing({ monsterName: 'Fang' })
```

### State Serialization
```javascript
// Save (triggered by stateChange events):
zlib.gzipSync(JSON.stringify(game)) → base64 string → stateSaveFunc + S3

// Restore:
restoreGame(publicChannel, base64GzipString, logger)
// Hydrates characters → monsters → cards → items recursively
```

### Game Loop
1. Monsters join ring → `ring.addMonster()`
2. ≥2 monsters triggers `startFightTimer()` (encounter every 60s)
3. Each encounter: monsters play next card in their deck (wraps when exhausted)
4. Cards resolve: 1d20 + bonuses vs AC for hit, then damage/effects
5. Victory/Loss/Flee events → XP + coins awarded, possible card drop
6. Ring loops; players can swap/update decks between fights

### Channel Manager
Messages are queued and batched (3000-char max per message) to respect platform rate limits. Connectors receive a callback that the engine calls with formatted strings.

## Development Commands

```bash
# Current (JS/legacy)
npm test              # Run all Mocha tests (requires @salesforce-mc/devtest)
node ./build          # Regenerate CARDS.md / DMG.md / probability docs
node battlefield.js   # CLI demo (ring combat)

# Target (TypeScript/pnpm monorepo)
pnpm test             # vitest run (all packages)
pnpm test:watch       # vitest --watch
pnpm test:coverage    # vitest run --coverage
pnpm build            # tsc --build (all packages via Turborepo)
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `HUBOT_DECK_MONSTERS_AWS_ACCESS_KEY_ID` | S3 backup credentials |
| `HUBOT_DECK_MONSTERS_AWS_SECRET_ACCESS_KEY` | S3 backup credentials |

Note: AWS env var naming is Hubot-legacy and should be generalized.

## Known Issues / Technical Debt

- `creatures/base.js` is ~2000 lines and handles too many concerns — split into attack, defense, items
- `cards/hit.js` has an unused `curseOfLoki` variable (dead code or incomplete feature)
- `DMG.md` and `CARDS.md` are near-duplicates — consolidate
- Battle arrays are not persisted (`ring.battles = []` — history lost on restart)
- AWS env var names are Hubot-specific (`HUBOT_DECK_MONSTERS_*`); needs generalization
- Node.js 8 is EOL — upgrading to v22 LTS
- No CI configuration exists
- `@salesforce-mc/devtest` is an internal Salesforce test runner — being replaced with Vitest

## Archived Features

- **Exploration system** (`exploration/`) — monster expeditions (find loot, hazards, death cards). Archived for the revival; the core game is the ring combat. See `docs/archive/exploration-system.md`.

## Architecture Notes for New Connectors

When building a new connector:
1. Implement `publicChannelFn(message): Promise` — posts to the shared channel/room
2. Implement `privateChannelFn(message): Promise` — sends a DM to the player
3. Map platform events (slash commands, messages) to `character.*` and `game.*` methods
4. Implement `stateSaveFunc(base64GzipString)` and persist it (DB, file, etc.)
5. On startup, load the saved string and pass to `restoreGame()`

The engine emits `stateChange` whenever anything significant happens; listen for it and trigger your save.

## Planned Enhancements

See `docs/roadmap/` for detailed plans. Summary:

- TypeScript migration + Vitest + monorepo (pnpm + Turborepo) — `01-modernize-stack.md`
- Postgres state storage + tRPC API + containerized hosting — `02-backend-hosting.md`
- Auth system (JWT, OAuth) — `03-auth-and-identity.md`
- Multi-room/group support — `04-multi-room-groups.md`
- Discord connector (discord.js v14, slash commands) — `05-discord-connector.md`
- Web app (Fastify + React + WebSocket ring feed) — `06-web-app.md`
- Mobile app (React Native + Expo, iOS + Android) — `07-mobile-app.md`
- Modernize Slack connector (Bolt SDK, remove Hubot) — `08-modernize-slack-connector.md`
- Simple graphics/sprites for web and mobile — `09-graphics.md`
- Bug fixes and code quality — `10-bug-fixes.md`
