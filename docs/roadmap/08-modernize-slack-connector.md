# Modernize Slack Connector

**Category**: Maintenance / Connector  
**Priority**: Low-Medium (preserve existing functionality)

## Background

The original game was built for Slack but the Slack adapter code is not in this repository — it was presumably a Hubot plugin or separate integration. The engine is designed for this (adapter pattern), but the Hubot/Slack glue code needs to be rebuilt or modernized.

## Issues with Original Setup

- Used **Hubot** as the bot framework — Hubot is largely abandoned
- AWS env var names are Hubot-namespaced (`HUBOT_DECK_MONSTERS_*`)
- The Slack adapter likely relied on the legacy Slack RTM API (deprecated)
- State was probably stored in Hubot's brain (Redis) — no longer viable

## Modern Slack Approach

Rebuild the Slack connector using Slack's official Bolt SDK:

- **`@slack/bolt`** (Node.js) — Slack's recommended bot framework
- Uses Socket Mode or Event API (not deprecated RTM)
- Slash commands `/deck-monsters spawn`, `/deck-monsters ring`, etc.
- Or app home + modal UI for richer experience

## Architecture

Same pattern as Discord connector:

1. `publicChannel(message)` → `client.chat.postMessage({ channel, text })`
2. `privateChannel(message)` → `client.chat.postMessage({ channel: userId, text })`
3. Slash commands → `character.*` / `game.*` calls
4. State stored in shared DB (see hosting issue), not Hubot brain

## Tasks

- [ ] Create a new `connector-slack` package (or directory in a monorepo)
- [ ] Implement Bolt app with slash commands
- [ ] Implement public/private channel callbacks
- [ ] Integrate with shared state storage
- [ ] Integrate with auth (Slack user IDs as identity, or link to account)
- [ ] Update env var names to remove Hubot prefix
- [ ] Document setup for workspace admins
- [ ] Test with a real Slack workspace

## Notes

- Multi-workspace support: each Slack workspace gets its own room by default (see multi-room issue)
- Slack user IDs are stable and can serve as the `userId` for the game engine without additional auth
