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
The engine has **no Slack/Discord/HTTP code**. Connectors instantiate the game and provide two things:
1. A `publicChannel` callback — the engine calls this to broadcast ring events to everyone
2. A `privateChannel` callback — the engine calls this to DM a specific player

Both callbacks share the same signature: `({ announce, question?, choices?, delay? }) => Promise`

- `{ announce }` — fire-and-forget message (most calls)
- `{ question, choices }` — interactive prompt; the connector must ask the user and resolve with their answer. Used during multi-step flows like equipping a monster or shopping.

```javascript
const { Game, restoreGame } = require('deck-monsters')

// publicChannel is called for ring broadcasts
const publicChannel = ({ announce }) => postToChannel('#ring', announce)

// privateChannel is called for DMs; must also handle interactive questions
const privateChannel = ({ announce, question, choices }) => {
  if (announce) return sendDM(userId, announce)
  if (question) return promptUser(userId, question, choices) // must return Promise<answer>
}

// Initialize
const game = savedState
  ? restoreGame(publicChannel, savedState, log)
  : new Game(publicChannel, {}, log)

// Wire up state persistence
game.saveState = (state) => db.save(state) // called automatically on stateChange

// Get the action object for a player
const player = await game.getCharacter(privateChannel, userId, { id, name })
```

### `getCharacter()` returns an action object

`game.getCharacter(privateChannel, channelName, { id, name, type, gender, icon })` resolves with an object of bound action methods — not a Character class. All actions go through this object:

```javascript
player.spawnMonster({ /* options */ })
player.equipMonster({ monsterName, cardSelection })
player.sendMonsterToTheRing({ monsterName })
player.callMonsterOutOfTheRing({ monsterName })
player.lookAt(thing)              // look at a card, monster, item, handbook, etc.
player.lookAtCards({ deckName })
player.lookAtMonster({ monsterName })
player.lookAtMonsters({ inDetail })
player.lookAtRing({ ringName })
player.buyItems()
player.sellItems()
player.giveItemsToMonster({ monsterName, itemSelection })
player.takeItemsFromMonster({ monsterName, itemSelection })
player.useItemsOnMonster({ monsterName, itemSelection })
player.useItems({ itemSelection })
player.dismissMonster({ monsterName })
player.reviveMonster({ monsterName })
player.editCharacter({ characterName })
player.editMonster({ monsterName })
```

### `handleCommand` — missing from current engine

The original Jane connector used `game.handleCommand({ command })` to parse natural language strings like `"spawn monster"` or `"send a monster to the ring"` and return an action function. **This method is not in the current engine source.** It is a gap that needs to be filled for the revival. Options:

- **Re-add `handleCommand` to the engine** — useful for chat-style connectors (Slack, Discord text) that receive free-form text
- **Each connector maps its own commands** — appropriate for Discord slash commands, web REST endpoints, and mobile buttons, which don't need NL parsing

### State Serialization

```javascript
// `game.saveState` is a getter/setter pair:

// Setting it stores the save function:
game.saveState = (base64GzipString) => db.save(base64GzipString)

// Getting it returns a function that serializes and calls the stored function:
//   zlib.gzipSync(JSON.stringify(game)) → base64 → stateSaveFunc() + aws.save()
// The engine calls this.saveState() automatically on every 'stateChange' event.

// Restore from saved state:
restoreGame(publicChannel, base64GzipString, logger)
// Hydrates characters → monsters → cards → items recursively
```

Jane stored state in Hubot Brain (Redis) as primary storage; S3 was a safety-net backup. For the revival, Postgres is the primary store and S3 backup is optional.

### Game Loop
1. Monsters join ring → `ring.addMonster()`
2. ≥2 monsters triggers `startFightTimer()` (encounter every 60s)
3. Each encounter: monsters play next card in their deck (wraps when exhausted)
4. Cards resolve: 1d20 + bonuses vs AC for hit, then damage/effects
5. Victory/Loss/Flee events → XP + coins awarded, possible card drop
6. Ring loops; players can swap/update decks between fights

### Channel Manager
The engine queues and batches outgoing messages (3000-char max per batch) to respect platform rate limits. The connector's `publicChannel` callback is called with already-batched strings. Jane additionally added a 1200ms delay between messages; new connectors should implement similar pacing appropriate to their platform.

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

See "How the Game Engine Works" above for the full API details. Quick checklist:

1. Implement the channel callback: `({ announce, question?, choices?, delay? }) => Promise`
   - `announce` — post the string to the channel/DM; return after sending
   - `question` + `choices` — prompt the user and resolve with their text answer; timeout after ~2 minutes
2. Initialize the game: `restoreGame(publicChannel, savedState, log)` or `new Game(publicChannel, {}, log)`
3. Set the save function: `game.saveState = (state) => db.save(state)` — engine calls this automatically
4. Get a player's action object: `await game.getCharacter(privateChannel, userId, { id, name })`
5. Map platform inputs (slash commands / button presses / text) to action object methods

The `question`/`choices` pattern is used during interactive multi-step flows (choosing which monster to equip, which item to buy, etc.). Connectors that only support one-shot commands (e.g., REST endpoints) will need to either break these into separate requests or trigger a guided flow via DM.

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
