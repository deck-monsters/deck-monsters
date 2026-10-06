---
type: Architecture
title: Room chat
description: How in-room messaging works — the server-side ChatService, its tables and retention, msg and dm in the Console, the Chat tab, and the seam for future connector bridges.
status: stable
audience: internal
tags: [chat, server, web, architecture]
---
# Room chat

Players in a room can talk to everyone (`msg`, `message`, `m`) or to one player (`dm`), from
the Console or the Chat tab. Built in [roadmap 41](../roadmap/41-room-chat.md) because the web
app, now the main way to play, had lost the chat that Slack and Discord gave the game for free.

Other docs hold these rules; this page doesn't repeat them:

- **Scoping and privacy** (room filters, DM visibility, the shared name matcher, no browser
  access to the tables) are in [rooms and identity](rooms-and-identity.md#chat).
- **Live delivery** (chat frames on `ringFeed`, never tracked and never replayed) is in
  [events, prompts, and replay](events-prompts-and-replay.md#chat-frames).
- **Why chat skips the command lock** is in
  [engine concurrency and timing](engine-concurrency-and-timing.md).
- **The Chat surface,** its unread badge and when it marks messages read, are in
  [web workspace](web-workspace.md).

## Why it lives in the server

Chat is not game state, so the engine never sees it:

- **It must never be refused because a player is mid-question.** `game.command` refuses any
  command while that player has a flow running, so chat is caught before that check.
- **It must not ride the room's game event stream.** Every public event there is posted to the
  room's Discord channel and counts toward fight pacing. The persisted event log also has its
  own retention, which chat doesn't share.

The engine has one chat handler, a fallback. It answers `msg` and `dm` on connectors that have
no chat (Discord) with "Room chat is in the web app's Chat tab…", and it keeps the catalogue
test, which checks that every entry reaches a handler, honest.

## Data

`room_messages` holds:

- `room_id`;
- `sender_user_id`;
- `recipient_user_id` (null for the whole room);
- `text`;
- `fight_number`, set when a fight was on, as the room's counter plus one, since the counter
  only advances when a fight ends;
- `source` (`web` today);
- `created_at`.

`room_message_reads` holds each player's `last_read_id` per room. `markRead` never moves it
backwards, and caps it at the room's newest message.

When a message is sent, it is:

- trimmed, with newlines and other whitespace collapsed to single spaces;
- refused if empty, including when it holds only zero-width characters;
- refused if longer than 500 characters, counted in code points;
- refused if the player has sent 5 messages in the last 10 seconds.

Every refusal returns the exact text from the plan.

## Retention

`ChatService.sweep` runs hourly, beside `sweepIdleRooms` in `packages/server/src/index.ts`. A
message is deleted when any of these is true:

1. It is older than 30 days.
2. It is beyond the newest 500 in its room.
3. It is older than 7 days and every member seen in the room within the last 14 days has read
   past it. "Seen" is `room_members.last_seen_at`, touched when a feed opens and by
   `ChatService.send` (so the Console and the Chat tab both count). For a DM, only its recipient counts, since a sender has read their own
   message.

The owner chose "keep until seen, within limits": someone away for a few days still finds the
conversation, and nothing piles up forever.

## Commands and the DM-routing rule

The Console catches `msg`, `message`, `m` and `dm` in the server, before the command lock. While
a question is open, only `msg`, `message` and `dm` go to chat, so "M Jones" can still answer a
naming question.

**Who a DM goes to is visible before it is sent** (owner, 2026-10-01). Longest-match alone
cannot tell "dm Anthony Bourdain is too powerful" from a message to a player named Anthony
Bourdain, and a player could rename themselves to catch messages on purpose. So:

- picking a name from the suggestions sends by that player's id, and the text is never
  re-parsed;
- a typed name the preview resolves to one player is sent by that id as well, so the preview
  and the send cannot differ if the member list changed meanwhile;
- a typed name shows a highlighted **To:** preview, from the same engine matcher and the same
  candidate names as the server (`chat.dmNames`). The preview warns when another name also
  fits, and the typed path refuses identical names;
- quotes force an exact name: `dm "Anthony" Bourdain is too powerful`;
- suggestions list, without repeats: the player you last sent a DM to, then the player who last
  sent you one if different, then players with a monster in the ring, then everyone else
  alphabetically.

## The bridge seam

Every send and every delivery goes through `ChatService`. A future connector, such as a Discord
bridge, would:

- **send outward** by subscribing to the service, the way `ringFeed` does;
- **bring messages in** by calling `send` with its own `source`.

Before that can work, Discord's free-text `dm <command>` prefix in `connector-discord/src/bot.ts`
needs a decision, because a bridged `dm` would collide with it. The bridge and moderation stay
on [roadmap 41's backlog](../roadmap/41-room-chat.md#backlog). A ping when the page is closed
is [roadmap 48](../roadmap/48-notifications.md).
