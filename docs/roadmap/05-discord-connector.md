# Discord Connector Adapter

**Category**: Feature / Connector  
**Priority**: High (first connector to ship)  
**Status**: Substantially complete — core infrastructure, event bus bridging, prompt handling, guild-room management, embed wiring, and slash command surface are implemented. Remaining: admin role support, `/preset`, slash command tests, and deployment hardening.

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
| `/sell [item]` | `character.sellItem()` |
| `/use [item] [target]` | `character.useItem()` |
| `/status` | `character.lookAtCard()` / monster status |
| `/monsters` | List player's monsters |
| `/dismiss [monster]` | `character.dismissMonster()` |
| `/revive [monster]` | `character.reviveMonster()` |
| `/ring-status` | Show current ring contestants |
| `/preset [monster] [name]` | Switch a monster's active deck to a saved preset loadout |
| `/create-room [name]` | Create a new game room |
| `/join-room [code]` | Join a room |

Additionally, the connector can support free-text commands via a `dm <command>` message pattern, routing through `game.handleCommand()` — the command system is fully migrated and uses Zod validation.

## UI Considerations

- Use Discord **embeds** for monster stat cards and card displays — rendered from `GameEvent.payload` data
- Use Discord **buttons** (message components) for confirmations and interactive prompts (replaces the old callback-based question/choices pattern)
- Use **autocomplete** on `/equip`, `/ring`, and `/preset` to show the player's available monsters and saved presets
- The ring feed (public channel) uses `GameEvent.text` as plain text messages — preserves the original feel
- Consider posting fight narration in **threads** (see balance and mechanics doc, "fights in threads") to avoid flooding the main channel

## Tasks

- [x] Create `packages/connector-discord` in the monorepo
- [x] Initialize discord.js bot with slash command registration (`src/bot.ts` — REST API registration on startup)
- [x] Implement event bus subscription for public events → guild channel (`src/guild-room-subscription.ts`)
- [x] Implement event bus subscription for private events → DM / ephemeral (`src/guild-room-subscription.ts`)
- [x] Implement prompt handling via Discord buttons/select menus (`src/prompt-handler.ts` — 2-min timeout, button cap at 5)
- [x] Implement all slash commands — 12 commands: spawn, ring, equip, explore, shop, buy, use, status, monsters, ring-status, create-room, join-room, help (`src/slash-commands/`)
- [x] Integrate with auth (auto-create Supabase user records for Discord users, populate `user_connectors`) — via `ensureConnectorUser` in `src/bot.ts`
- [x] Integrate with RoomManager (guild ID → room mapping, room lifecycle) — `src/guild-room-manager.ts`
- [x] Wire up rich embed builders — `buildMonsterCardEmbed` and `buildCardDisplayEmbed` are now called from `guild-room-subscription.ts`
- [x] Add missing slash commands: `/sell`, `/dismiss`, `/revive`
- [x] Handle `/explore` gracefully (exploration system is archived — returns "coming soon")
- [ ] Add admin support — commands currently pass `isAdmin: false`; guild owner/admin role detection needed
- [ ] Write tests for slash command handlers (`src/slash-commands/` have no test coverage)
- [x] Write setup/deployment docs for server admins adding the bot to their guild _(added to `docs/deployment.md` section 3)_

## Auth Integration

Discord users are already authenticated by Discord — no additional login step is needed for the Discord connector itself. The connector maps Discord user IDs to canonical Supabase user IDs via the `user_connectors` table:

1. Discord command arrives with Discord user ID
2. Connector looks up `user_connectors(connector_type='discord', external_id=<discord_id>)`
3. If found → use the existing `user_id`
4. If not found → auto-create a Supabase user record and `user_connectors` entry

This auto-creation means Discord users can start playing immediately without signing up on the web. If they later sign into the web app with Discord OAuth (via Supabase Auth), the accounts merge because the same Discord identity resolves to the same user.

## Notes

- The connector package depends on `@deck-monsters/engine` for types but does not run game logic directly — it goes through `RoomManager`
