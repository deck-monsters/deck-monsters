# Discord Connector Adapter

**Category**: Feature / Connector  
**Priority**: High

## Overview

Build a Discord bot adapter that makes Deck Monsters playable in any Discord server. This is the highest-priority new connector as Discord is where most gaming communities live.

## How It Fits the Engine

The game engine is connector-agnostic. The Discord adapter provides two channel callbacks with this shape:

```typescript
type ChannelFn = (args: { announce?: string; question?: string; choices?: string[] }) => Promise<string | undefined>
```

- `{ announce }` — post the string to the channel/DM
- `{ question, choices }` — prompt the user and resolve with their answer; timeout after ~2 minutes

Discord adapter responsibilities:
1. `publicChannel` → posts to a designated `#deck-monsters` text channel
2. `privateChannel` → sends a Discord DM or ephemeral reply; handles interactive questions
3. Maps slash commands to `player.*` action object methods (from `game.getCharacter()`)
4. Persists game state via the shared state store (see hosting issue)

See the Slack connector doc for notes on `handleCommand` — the same gap applies here if we want text-based `dm <command>` style interaction in addition to slash commands.

## Suggested Tech Stack

- `discord.js` v14
- Slash command registration via Discord's application command API
- Ephemeral message responses for private game feedback

## Slash Commands to Implement

| Command | Maps to |
|---------|---------|
| `/spawn [type] [name]` | `character.spawnMonster()` |
| `/ring [monster]` | `character.sendMonsterToTheRing()` |
| `/equip [monster]` | `character.equipMonster()` |
| `/explore [monster]` | `character.explore()` |
| `/shop` | `character.shop()` |
| `/buy [item]` | `character.buyItem()` |
| `/use [item] [target]` | `character.useItem()` |
| `/status` | `character.lookAtCard()` / monster status |
| `/monsters` | List player's monsters |
| `/ring-status` | Show current ring contestants |
| `/create-room [name]` | Create a new game room |
| `/join-room [code]` | Join a room |

## UI Considerations

- Use Discord **embeds** for monster stat cards and card displays — much more readable than plain text
- Use Discord **buttons** (message components) for confirmations (e.g., "Send to ring? [Yes] [No]")
- Use **autocomplete** on `/equip` and `/ring` to show the player's available monsters
- The ring feed (public channel) remains as plain text messages — this preserves the original feel

## Multi-Server Support

- Each Discord guild (server) gets its own room by default
- Players in a guild can optionally create sub-rooms for different friend groups (see multi-room issue)
- Guild ID is used as the `room_id` for the default room

## Tasks

- [ ] Initialize discord.js bot project structure
- [ ] Implement slash command registration
- [ ] Implement `publicChannel` → channel message mapping
- [ ] Implement `privateChannel` → ephemeral or DM mapping
- [ ] Implement all slash commands (see table above)
- [ ] Add embed formatting for monster/card displays
- [ ] Add message component buttons for confirmations
- [ ] Integrate with auth (Discord OAuth — Discord users are already authenticated)
- [ ] Integrate with state storage
- [ ] Write setup/deployment docs for server admins adding the bot

## Notes

- Discord users are already authenticated by Discord — no additional auth needed for the Discord connector
- The Discord user ID becomes the `userId` passed to `game.getCharacter()`
