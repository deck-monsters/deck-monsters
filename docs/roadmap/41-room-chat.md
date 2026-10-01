---
type: Roadmap
title: Room chat
description: Plan for in-room messaging on the web — msg and dm from the Console, a Chat tab, fight and time dividers, and retention that keeps messages until players have seen them — with the connector seam for later bridges.
status: draft
audience: internal
tags: [roadmap, chat, web, server, social]
---
# 41 — Room chat

**Status:** Planned (2026-10-01).

## Why

The owner (2026-10-01): the game began on Slack, which had chat built in, and Discord has its
own too. The web app, now the main way to play, has no messaging. That lost the live fight
commentary players used to have.

## Decisions

Made with the owner on 2026-10-01:

- **Web only for now.** The design must leave room for bridges and connectors later, because
  rooms can mix web and Discord players. The bridge is tracked below as its own item.
- **Messages stay until seen, within limits.** See Retention.
- **A sixth tab, Chat,** with an unread count. Chat lines also show in the Console.
- **Commands, not free text.** Text that isn't a command stays an error, so typos never go out
  as messages. `msg`, `message` and `m` say something to the room. `dm <player> <message>` sends
  a message only that player sees.
- **Dividers, not timestamps on every line.** A divider appears when the time jumps (30 minutes
  or more, or a new day). A second kind marks the fight that was on when messages were sent.
- **Moderation waits.** Reporting and moderation go to the backlog below. The group is small
  and knows each other.

Made by the orchestrator, from the survey of the code:

- **Chat lives in the server, not the engine.** It isn't game state, and it must never be
  refused because a player is halfway through a question. The server's `game.command` refuses
  any command while that player has a flow in progress, so chat is caught before that check,
  and the server stores and sends it itself.
- **Chat never goes on the room's game event stream.** Every public event is posted to the
  Discord channel and counted for fight pacing, and the event log has its own retention. So
  chat gets its own table. It rides the existing `ringFeed` connection: the server adds chat
  frames to each subscriber's stream, with no second connection and no engine involvement.
  Room scoping is unchanged. Only members receive a room's chat, and a DM goes only to its
  two players.
- **Bridge seam.** All sends and deliveries go through one `ChatService` in the server. Each
  message records its `source` (`web` now). A future connector subscribes to the service to
  post outward, and calls `send` with its own `source` for inbound messages.
- **Names.** `dm` matches the longest player name, either character name or display name, that
  the rest of the line starts with, ignoring case. That handles names with spaces, such as
  "Anthony Bourdain". The recipient must be a member of the room.
- **Limits.** A message is at most 500 characters. A player can send at most 5 messages in any
  10 seconds.
- **Fight stamp.** A message sent while a fight is on records that fight's number, which is
  the room's fight counter plus one, since the counter only advances when a fight ends.
- **One server process.** Live delivery uses an in-process emitter. If the server ever runs
  more than one instance, chat delivery needs a shared channel (Postgres `LISTEN/NOTIFY`).
  Say so in the architecture doc.

## Retention

A message can be deleted once any of these is true:

1. It is older than 30 days.
2. The room has more than 500 messages, and this one is among the oldest beyond 500.
3. It is older than 7 days, and every member seen in the room within the last 14 days has
   read past it. Read position is per player and room.

A DM counts only its two players.

The server's hourly sweep follows the pattern of `sweepIdleRooms`. A player who comes back
sees a marker line, **New since you were last here**, at their last read position.

## Tasks

| # | Task | Area | Can run beside | Status | Commit |
|---|---|---|---|---|---|
| M1 | **Chat core.** Migration (`room_messages`, `room_message_reads`); `ChatService` (send, history, mark read, unread count, name resolution, limits, retention sweep); a `chat` tRPC router with membership checks; chat frames merged into `ringFeed`; and a web `useChat` hook (history, live frames deduped by id, unread count, mark read). Includes pg tests | Server, migration, web hook | — | Planned | |
| M2 | **The Console and commands.** Catalogue entries in a new **Chat** category; an engine fallback handler for connectors without chat (Discord); `game.command` catches `msg`, `message`, `m` and `dm` before the flow check, without echoing them; the Console shows chat lines, and while a question is open, a line starting with a chat command goes to chat, not to the answer | Engine catalogue, server router, ConsolePane | M3 | Planned, after M1 | |
| M3 | **The Chat tab.** Surface and description; the panel with time and fight dividers, the new-since marker, DM styling, a To picker, and an unread badge on the tab; marks read while visible; six tabs fit at 390 px | Web | M2 | Planned, after M1 | |
| M4 | **Help and docs.** A "Talking to other players" handbook section; a new `docs/architecture/room-chat.md`; help inventory; and Cursor's live checklist | Engine build, docs | — | Planned, last | |

## The text (orchestrator)

Implementers use these exactly. Anything else is a `DRAFT(41)` placeholder.

**Catalogue** (new category `chat`, label **Chat**):

| Command | Description | Example |
|---|---|---|
| `msg [message]` | `Say something to everyone in the room. message and m work too` | `msg nice hit, Fang!` |
| `dm [player] [message]` | `Send a message only that player can see` | `dm Ada good luck tonight` |

**Console lines:**
- A room message reads `💬 {name}: {text}`. Your own reads `💬 You: {text}`.
- A DM to you reads `✉️ {name} to you: {text}`. One you sent reads `✉️ You to {name}: {text}`.

**Console refusals:**
- An empty `msg` gets `Say something after msg, like: msg nice hit, Fang!`
- A `dm` with no name match gets `Nobody in this room goes by that name. Use the name as it shows in Chat, like: dm Ada good luck.`
- A `dm` to yourself gets `That's you. Pick someone else.`
- A `dm` with no message gets `Add a message after the name, like: dm {name} good luck.`
- A message that is too long gets `Messages can be up to 500 characters. That one has {n}.`
- Sending too fast gets `Easy there. Wait a few seconds before the next message.`
- The engine fallback, used on Discord, says `Room chat is in the web app's Chat tab. Here on Discord, talk in the channel.`

**Chat tab:**
- **Description** (tab title and subtitle): `Talk with everyone in this room, or send a message to one player.`
- **Empty state:** `No messages yet. Say hello, or cheer on a fight.`
- **Composer:**
  - The To picker is labelled `To`, with `Everyone` first, then the room's players.
  - The input placeholder is `Message everyone…` or `Message {name}…`.
  - The button is `Send`, with the title `Send this message`.
- **Time divider:** the local date and time. Same day: `Today, 6:42 PM`. Previous day: `Yesterday, 9:10 PM`. Older: `Mon 28 Sep, 9:10 PM`, via `toLocaleString`.
- **Fight divider:** `During fight #{n}`.
- **Unread:**
  - Marker line: `New since you were last here`.
  - Tab badge: the count, capped at `99+`.
  - The tab's accessible name: `Chat, {n} unread`.
- **DM tags:** `to you`, or `you to {name}`.

**Handbook,** a "Talking to other players" section:

> Every room has its own chat. Open the Chat tab, or type in the Console:
>
> - `msg` and your message (or `message`, or just `m`) to say something to everyone in the room.
> - `dm`, a player's name, and your message to send something only they can see.
>
> Messages show in the Chat tab and in the Console. They stay until everyone who has played in
> the room lately has had a chance to read them, and never longer than 30 days.

## Backlog

- **Bridges and connectors** (owner: track it so it isn't lost). Post web chat to a room's
  Discord channel, and bring channel messages into web chat. The rooms are mixed, so both
  directions matter. It needs the bot's Message Content permission, a `source` per message
  (in place from M1), and a decision on Discord's existing free-text `dm <command>` prefix
  (`connector-discord/src/bot.ts`), which would collide with a bridged `dm`.
- **Reporting and moderation:** report a message, let the room owner delete one, mute a
  player. Held while the group is small.
- **Notifications:** a sound or browser notification for a DM.
