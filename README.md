# Deck Monsters

A turn-based monster-battling RPG game engine — think Pokémon meets deck-building. Players collect monsters, equip them with action card decks, and send them into a shared ring to auto-battle while everyone watches.

The engine is platform-agnostic: a connector adapter plugs in and brings the game to any chat platform or app. The original connector was a Slack bot called **Jane**, which ran the game inside a private Slack workspace. The ring fights appeared in a shared channel; everything else (spawning monsters, building decks, buying items) happened through DMs with Jane.

The project is being revived with new connectors (Discord, web, mobile) and modern infrastructure.

---

## How It Plays

1. **DM the bot** to build your roster — spawn monsters, equip them with card decks, buy items from the shop, level them up over time
2. **Send a monster to the ring** — a shared channel where everyone's monsters fight automatically
3. **Watch the ring** — battles play out every 60 seconds, narrated in the channel; wins earn XP and coins
4. **Iterate** — swap cards, upgrade monsters, build toward stronger strategies

The game has 5 monster types, 60+ action cards across 4 classes (melee, healing, control, utility), and 25+ items. Monsters level up with experience, and stronger cards unlock at higher levels.

See [PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md) for all commands and sample deck builds, [MONSTERS.md](MONSTERS.md) for monster stats, and [CARDS.md](CARDS.md) for the full card catalog.

---

## Architecture

The engine has no platform-specific code. A connector provides two callbacks (public channel + private DM) and maps platform events to game method calls.

```
Platform (Slack / Discord / Web / Mobile)
     ↓  slash commands / messages / button presses
  Connector Adapter  (Jane, discord-connector, web-connector, …)
     ↓  character.spawnMonster(), character.sendMonsterToTheRing(), …
  Game Engine  (this repo)
     ↓  publicChannelFn("Fang attacks…"), privateChannelFn("You earned 10 coins")
  Platform
```

### Building a Connector

Both channel callbacks share the same shape. The engine calls them with either an announcement or an interactive question:

```javascript
const { Game, restoreGame } = require('deck-monsters')

// Both channel callbacks take { announce?, question?, choices?, delay? }
// announce  → post the string to the channel; resolve when sent
// question  → prompt the user and resolve with their answer (2-min timeout)
const publicChannel = ({ announce }) => postToChannel('#ring', announce)

const privateChannel = ({ announce, question, choices }) => {
  if (announce) return sendDM(userId, announce)
  if (question) return promptUser(userId, question, choices)
}

// Initialize (restore from DB or create fresh)
const game = savedState
  ? restoreGame(publicChannel, savedState, console.log)
  : new Game(publicChannel, {}, console.log)

// Wire up persistence — engine calls this automatically on every state change
game.saveState = (state) => db.saveRoomState(roomId, state)

// Get the action object for a player (creates character on first call)
const player = await game.getCharacter(privateChannel, userId, { id: userId, name })

// Map platform inputs to action methods
await player.spawnMonster({ /* prompts user interactively via privateChannel */ })
await player.sendMonsterToTheRing({ monsterName: 'Fang' })
await player.equipMonster({ monsterName: 'Fang', cardSelection: [...] })
await player.buyItems()   // interactive: shows shop, prompts for selection
await player.lookAt('basilisk')
```

See [CLAUDE.md](CLAUDE.md) for the full action method list and deeper architecture notes.

---

## Development

### Prerequisites

- Node.js v22 LTS (see `.nvmrc`)
- pnpm

### Install

```bash
pnpm install
```

### Test

```bash
pnpm test              # vitest run (all packages)
pnpm test:watch        # vitest --watch
pnpm test:coverage     # vitest run --coverage
```

### CLI Demos

```bash
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
| [PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md) | All player commands + sample deck builds by level |
| [MONSTERS.md](MONSTERS.md) | Monster types and stat distributions |
| [CARDS.md](CARDS.md) | Full card catalog with levels, descriptions, and MSRP |
| [CLAUDE.md](CLAUDE.md) | Codebase guide for AI-assisted development |
| [docs/roadmap/](docs/roadmap/) | Detailed plans for each planned enhancement |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string for state storage |
| `JWT_SECRET` | Auth token signing |
| `AWS_ACCESS_KEY_ID` | S3 backup (optional) |
| `AWS_SECRET_ACCESS_KEY` | S3 backup (optional) |

> Legacy: the engine previously used `HUBOT_DECK_MONSTERS_AWS_*` names from an old Hubot integration. These are being retired.

---

## Status

The project is actively being revived. The core engine is stable. Current focus:

- **TypeScript migration** — converting the JS codebase to TypeScript, replacing internal test infrastructure with Vitest, setting up CI
- **Monorepo** — reorganizing engine + connectors + apps into a pnpm workspace
- **Infrastructure** — Postgres-backed state storage, containerized hosting, tRPC API layer for web/mobile
- **New connectors** — Discord bot, web app, iOS/Android app (React Native)
- **Auth + multi-room** — user identity, invite-based friend groups

The exploration system (expeditions) has been archived for now — it's a concept that could be revived later, but the core game is the ring combat.

See [docs/roadmap/](docs/roadmap/) for detailed plans on each of these.
