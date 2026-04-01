# Modernize Slack Connector (Jane)

**Category**: Maintenance / Connector  
**Priority**: Low (deferred — ships after Discord and web connectors are stable)  
**Status**: Not started

## Background: Jane

The original Slack connector was a Hubot script named **Jane**. It ran inside a Hubot instance connected to a private Slack workspace. Key things Jane did:

- Listened for messages starting with `dm ` (case-insensitive) and stripped that prefix to get the command string
- Called `game.handleCommand({ command })` — a natural language parser in the engine that returned an action function
- Called that action function with `{ channel, channelName, isAdmin, isDM, user }` to execute it
- Stored game state in **Hubot Brain** (Redis) as the primary store; S3 was a safety-net backup
- Used `robot.sendDelayedMessage` with a 1200ms delay between messages to pace Slack output
- Used a `hubot-conversation` library for multi-turn dialogs (interactive questions with a 120-second timeout)
- Had one admin command: `permanently delete all deck monsters game state` (role-gated)

## handleCommand — Available in the Engine

The `handleCommand` method has been re-added to the engine. `Game.handleCommand({ command })` delegates to the `commands/` module, which validates input with Zod (`commandInputSchema`) and dispatches to four handler modules: `monster.ts`, `character.ts`, `look-at.ts`, and `store.ts`.

Chat-based connectors (Slack, Discord text commands) can use this directly — no need to reimplement command parsing.

## How It Fits the Event Bus

Like the Discord connector, the Slack connector subscribes to a room's `RoomEventBus` and translates `GameEvent` objects into Slack messages:

```
Slack message: "dm send fang to the ring"
  → connector strips "dm " prefix
  → looks up room for this workspace+channel (via RoomManager)
  → looks up userId for this Slack user (via user_connectors)
  → calls game.handleCommand({ command: "send fang to the ring" })
  → engine processes command, publishes GameEvents
  → Slack connector (subscribed to bus) receives events
  → posts to #deck-monsters channel (public) or DMs the user (private)
  → adds 1200ms delay between messages to respect Slack rate limits
```

### Prompt Handling

Interactive prompts (equipping, shopping) are modeled as `PromptRequest` events on the bus. The Slack connector handles these by:
1. Posting the question text to the user's DM
2. Listening for a reply within a 120-second timeout (matching Jane's original behavior)
3. Sending the answer back as a `PromptResponse`

Alternatively, use Slack's **Block Kit** interactive components (buttons, select menus) for a more modern UX — but the text-reply pattern should work as a baseline.

## Modern Slack Approach

Rebuild Jane using Slack's official **Bolt SDK** (`@slack/bolt`), replacing Hubot:

- Socket Mode or Events API (not the deprecated RTM API Hubot used)
- Same `dm <command>` text trigger
- State stored in shared Postgres DB (see backend hosting doc), not Hubot Brain
- Message pacing handled by the connector (1200ms between batched messages), not the engine

```typescript
// The Slack connector subscribes to the event bus and posts messages
const slackEventHandler = (event: GameEvent) => {
  if (event.scope === 'public') {
    await sleep(1200);
    await client.chat.postMessage({ channel: ringChannelId, text: event.text });
  } else if (event.scope === 'private') {
    const slackUserId = await lookupSlackId(event.targetUserId);
    await client.chat.postMessage({ channel: slackUserId, text: event.text });
  }
};
```

## Multi-Workspace Support

- Each Slack workspace gets its own default room
- Workspace ID serves as the external ID for room lookup (managed by the connector)
- Sub-rooms could be created per Slack channel for different groups within a workspace (see multi-room doc)

## Admin Commands

Preserve the admin reset command. Gate it behind a config-driven admin user list (not Hubot roles):

- `permanently delete all deck monsters game state` — reset the game for a room
- Future: `list rooms`, `force-save state`, etc.

## Tasks

- [ ] Create `packages/connector-slack` in the monorepo
- [ ] Initialize Bolt app (Socket Mode recommended for simplicity)
- [ ] Implement event bus subscription for public events → channel messages
- [ ] Implement event bus subscription for private events → DMs
- [ ] Implement prompt handling (text reply or Block Kit interactive components)
- [ ] Wire `dm <command>` text trigger to `game.handleCommand()`
- [ ] Add 1200ms message pacing
- [ ] Integrate with RoomManager (workspace+channel → room mapping)
- [ ] Integrate with Supabase Auth (Slack OAuth provider, Slack user ID → canonical userId via `user_connectors`)
- [ ] Implement admin commands with config-driven role checking
- [ ] Document setup for workspace admins (bot token scopes, Socket Mode setup)
- [ ] Test in a real Slack workspace
