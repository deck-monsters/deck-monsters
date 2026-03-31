# Modernize Slack Connector (Jane)

**Category**: Maintenance / Connector  
**Priority**: Low-Medium (preserve existing functionality)

## Background: Jane

The original Slack connector was a Hubot script named **Jane**. It ran inside a Hubot instance connected to a private Slack workspace. Key things Jane did:

- Listened for messages starting with `dm ` (case-insensitive) and stripped that prefix to get the command string
- Called `game.handleCommand({ command })` — a natural language parser in the engine that returned an action function
- Called that action function with `{ channel, channelName, isAdmin, isDM, user }` to execute it
- Stored game state in **Hubot Brain** (Redis) as the primary store; S3 was a safety-net backup
- Used `robot.sendDelayedMessage` with a 1200ms delay between messages to pace Slack output
- Used a `hubot-conversation` library for multi-turn dialogs (interactive questions with a 120-second timeout)
- Had one admin command: `permanently delete all deck monsters game state` (role-gated)

```javascript
// Jane's channel callback — dual-purpose: announce or question
const channel = ({ id, msg }) => ({ announce, question, choices }) => new Promise((resolve, reject) => {
  if (announce) {
    robot.sendDelayedMessage({ roomId: id, message: announce, delay: 1200 })
      .then(() => resolve(announce))
  } else if (question && msg) {
    // hubot-conversation dialog with 120-second timeout
    const dialog = conversation.startDialog(msg, 120000)
    // ... prompt user, resolve with answer
  }
})
```

## The `handleCommand` Gap

Jane called `game.handleCommand({ command })` to parse natural language commands. **This method does not exist in the current engine source.** It was most likely defined in Jane's own helpers (the `../helpers/` directory referenced in the imports) — a command parser that mapped strings like `"spawn monster"` to the appropriate `player.*` action method and returned it as a function for Hubot to call.

When the Jane helpers are found, check for a command-routing/parsing file that maps command strings to action methods. This is the implementation reference for rebuilding `handleCommand`.

It needs to be either:

1. Re-added to the engine (recommended for chat-based connectors like Slack and Discord text commands) — parses strings like `"spawn monster"`, `"send a monster to the ring"`, `"look at basilisk"` and returns the matching action function
2. Or replaced by explicit command routing in the connector (each command wired up separately with its own regex)

Option 1 is cleaner because the command vocabulary lives in the engine, not scattered across connectors. It also means all chat connectors (Slack, Discord) share the same command parsing.

## Modern Slack Approach

Rebuild Jane using Slack's official **Bolt SDK** (`@slack/bolt`), replacing Hubot:

- Socket Mode or Events API (not the deprecated RTM API Hubot used)
- Same `dm <command>` text trigger, or optionally slash commands
- Same channel callback pattern — post with delay, handle interactive questions
- State stored in shared Postgres DB (see hosting issue), not Hubot Brain

```typescript
// Modern equivalent of Jane's channel function
const makeChannel = (channelId: string, client: WebClient) =>
  async ({ announce, question, choices }: ChannelArgs) => {
    if (announce) {
      await sleep(1200)
      await client.chat.postMessage({ channel: channelId, text: announce })
      return announce
    }
    if (question) {
      await client.chat.postMessage({ channel: channelId, text: question })
      return waitForReply(channelId, choices, 120_000) // 2-min timeout
    }
  }
```

## Multi-Workspace Support

- Each Slack workspace gets its own room by default
- Workspace ID serves as `room_id` for the default room
- Sub-rooms could be created per Slack channel for different groups within a workspace (see multi-room issue)

## Admin Commands

Preserve the admin reset command. Gate it behind a config-driven admin user list (not Hubot roles):

- `permanently delete all deck monsters game state` — reset the game for a room
- Future: `list rooms`, `force-save state`, etc.

## Tasks

- [ ] Re-add `handleCommand` to the engine (or add a command-routing module)
- [ ] Create `connector-slack` package in the monorepo
- [ ] Initialize Bolt app (Socket Mode recommended for simplicity)
- [ ] Implement the dual-purpose channel callback with message delay
- [ ] Implement multi-turn dialog (question/choices) using Bolt's `say` + reply listener
- [ ] Wire `dm <command>` text trigger to `handleCommand`
- [ ] Integrate with shared Postgres state storage
- [ ] Implement admin commands with config-driven role checking
- [ ] Document setup for workspace admins (bot token scopes, Socket Mode setup)
- [ ] Test in a real Slack workspace
