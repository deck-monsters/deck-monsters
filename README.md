# Deck Monsters

A turn-based monster-battling RPG game engine. Spawn monsters, equip them with action card decks, and send them into the ring to auto-battle. The engine is platform-agnostic — it exposes a clean JavaScript API that connector adapters plug into to bring the game to any platform (Slack, Discord, web, mobile, etc.).

Originally built to run inside a private Slack workspace. Now being revived and expanded.

---

## Gameplay

- **Spawn monsters** — 5 monster types (Basilisk, Gladiator, Jinn, Minotaur, Weeping Angel), each with randomized base stats
- **Build decks** — equip monsters with a deck of 60+ action cards (melee, healing, control, stat boosts, utility)
- **Fight** — send monsters into the ring; battles auto-resolve every 60 seconds, cards play in deck order
- **Level up** — earn XP and coins from victories, unlock stronger cards, buy items from the shop
- **Explore** — send monsters on expeditions to discover cards, loot, or hazards

See [PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md) for commands and build strategies, [MONSTERS.md](MONSTERS.md) for monster stats, and [CARDS.md](CARDS.md) for the full card catalog.

---

## Architecture

The engine has no platform-specific code. Connectors instantiate the `Game` class and relay platform events (slash commands, messages, button presses) to game methods.

```
Platform (Slack / Discord / Web / Mobile)
    ↓ commands
  Connector Adapter
    ↓ method calls
  Game Engine (this repo)
    ↓ message callbacks
  Platform (posts results)
```

### Quick Start (building a connector)

```javascript
const { Game, restoreGame } = require('deck-monsters')

// Called whenever the engine has something to say publicly
const publicChannel = async (message) => { /* post to channel */ }

// Restore a previously saved game (or create a fresh one)
const game = savedState
  ? restoreGame(publicChannel, savedState, console.log)
  : new Game(publicChannel, {}, console.log)

// Save state whenever it changes
game.on('stateChange', () => {
  const state = game.saveState  // base64-gzipped JSON
  db.save(state)
})

// Get or create a player character
const privateChannel = async (message) => { /* DM the player */ }
const character = await game.getCharacter(privateChannel, userId, { id, name })

// Map platform commands to game actions
await character.spawnMonster({ type: 'Basilisk', name: 'Fang' })
await character.sendMonsterToTheRing({ monsterName: 'Fang' })
```

---

## Development

### Prerequisites

- Node.js (see `.nvmrc` or `package.json` for required version)

### Install

```bash
npm install
```

### Test

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:debug    # debug in Chrome DevTools
```

### CLI Demos

```bash
node wander.js        # exploration demo
node battlefield.js   # ring combat demo
```

### Regenerate Docs

```bash
node ./build          # rebuilds CARDS.md, DMG.md, and probability tables
```

---

## Documentation

| File | Contents |
|------|---------|
| [PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md) | All player commands + sample deck builds |
| [MONSTERS.md](MONSTERS.md) | Monster types and stat distributions |
| [CARDS.md](CARDS.md) | Full card catalog with levels, descriptions, and MSRP |
| [CLAUDE.md](CLAUDE.md) | Codebase guide for AI-assisted development |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `HUBOT_DECK_MONSTERS_AWS_ACCESS_KEY_ID` | S3 state backup (optional) |
| `HUBOT_DECK_MONSTERS_AWS_SECRET_ACCESS_KEY` | S3 state backup (optional) |

---

## Status

The project is actively being revived. Planned work includes:

- Discord, web, and mobile connectors
- Authentication and multi-group/room support
- Modern hosting and database-backed state storage
- Node.js and dependency upgrades
- Simple graphics for web and mobile UIs

See the [issue tracker](../../issues) for the full roadmap.
