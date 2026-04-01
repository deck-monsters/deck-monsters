# Discord Connector Adapter

**Category**: Feature / Connector  
**Priority**: High (first connector to ship)  
**Status**: Not started

## Overview

Build a Discord bot adapter that makes Deck Monsters playable in any Discord server. This is the first connector to ship — Discord is where most gaming communities live, and Discord OAuth is the primary login method for the web app as well.

## How It Fits the Architecture

The Discord connector is a subscriber on the event bus. It does not call `publicChannelFn` or store callbacks — it subscribes to a room's `RoomEventBus` and translates `GameEvent` objects into Discord messages.

```
Discord user sends /ring command
  → connector looks up room for this guild (via RoomManager)
  → connector looks up userId for this Discord user (via user_connectors)
  → connector calls game.getCharacter({ id: userId, ... })
  → game engine processes the command, publishes GameEvents to the room's event bus
  → Discord connector (subscribed to that bus) receives events
  → posts to the #deck-monsters channel (public events) or DMs the user (private events)
```

### Event Delivery

- **Public events** (`scope: 'public'`): posted to the designated `#deck-monsters` text channel in the guild
- **Private events** (`scope: 'private'`, `targetUserId` matches): sent as a Discord DM or ephemeral reply
- **Prompt requests**: when the engine needs player input (equipping, shopping), the connector sends an ephemeral message with Discord buttons/select menus, then responds to the engine with the player's choice

The connector uses the `GameEvent.text` field for text channels (preserves the original game voice). For embeds (monster stat cards, card displays), it can use `GameEvent.type` and `GameEvent.payload` to render richer formatting.

### Multi-Guild Support

- Each Discord guild gets its own room by default (guild ID → room mapping managed by the connector)
- Players in a guild can optionally create sub-rooms for different friend groups (see multi-room doc)
- The connector maintains subscriptions to the event bus for each active guild's room

## Suggested Tech Stack

- `discord.js` v14
- Slash command registration via Discord's application command API
- Ephemeral message responses for private game feedback
- Message components (buttons, select menus) for interactive prompts

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

Additionally, the connector can support free-text commands via a `dm <command>` message pattern, routing through `game.handleCommand()` — the command system is fully migrated and uses Zod validation.

## UI Considerations

- Use Discord **embeds** for monster stat cards and card displays — rendered from `GameEvent.payload` data
- Use Discord **buttons** (message components) for confirmations and interactive prompts (replaces the old callback-based question/choices pattern)
- Use **autocomplete** on `/equip` and `/ring` to show the player's available monsters
- The ring feed (public channel) uses `GameEvent.text` as plain text messages — preserves the original feel
- Consider posting fight narration in **threads** (see balance and mechanics doc, "fights in threads") to avoid flooding the main channel

## Tasks

- [ ] Create `packages/connector-discord` in the monorepo
- [ ] Initialize discord.js bot with slash command registration
- [ ] Implement event bus subscription for public events → guild channel
- [ ] Implement event bus subscription for private events → DM / ephemeral
- [ ] Implement prompt handling via Discord buttons/select menus
- [ ] Implement all slash commands (see table above)
- [ ] Add embed formatting for monster/card displays using event payload data
- [ ] Integrate with auth (auto-create Supabase user records for Discord users, populate `user_connectors`)
- [ ] Integrate with RoomManager (guild ID → room mapping, room lifecycle)
- [ ] Write setup/deployment docs for server admins adding the bot to their guild

## Auth Integration

Discord users are already authenticated by Discord — no additional login step is needed for the Discord connector itself. The connector maps Discord user IDs to canonical Supabase user IDs via the `user_connectors` table:

1. Discord command arrives with Discord user ID
2. Connector looks up `user_connectors(connector_type='discord', external_id=<discord_id>)`
3. If found → use the existing `user_id`
4. If not found → auto-create a Supabase user record and `user_connectors` entry

This auto-creation means Discord users can start playing immediately without signing up on the web. If they later sign into the web app with Discord OAuth (via Supabase Auth), the accounts merge because the same Discord identity resolves to the same user.

## Notes

- The connector package depends on `@deck-monsters/engine` for types but does not run game logic directly — it goes through `RoomManager`
