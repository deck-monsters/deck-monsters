---
type: Architecture
title: Events, prompts, and replay
description: Event flow, prompt lifecycle, persistence, and replay for one room.
status: stable
audience: internal
tags: [events, prompts, replay]
---
# Events, prompts, and replay

Read before: changing `GameEvent`, `RoomEventBus`, connector delivery, prompt transport,
event persistence, feed history, reconnect cursors, or fight replay.

## Event flow

Each loaded room owns one `RoomEventBus`. Engine announcements publish a serializable
`GameEvent` containing:

- a `${epochMs}-${suffix}` string id, `roomId`, and timestamp;
- an event `type`, `public|private` scope, and optional `targetUserId`;
- stable structured payload data plus player-facing text.

The bus fans public events to every subscriber in that room. Private events go only to a
subscriber with the matching `userId`, unless a trusted room-internal projection explicitly
sets `includePrivate`. Subscriber failures do not crash the engine.

The web server exposes one `game.ringFeed` subscription per terminal and room. It validates
membership, emits a handshake, replays missed events, then streams live events and
20-second heartbeats. `useRingFeed` owns the room cursor and fans one subscription out to
the Ring, Console, Workshop, and other mounted surfaces.

The Discord connector resolves a guild user's validated room through `GuildRoomManager`,
subscribes to that room, sends public events to its configured guild channel, and delivers
matching private events and prompts to the user. Connector rendering may use structured
payloads, but narration text remains the fallback.

**Mechanic tags.** Four public lines announce a rule a new player may not know: a ring
event (`payload.ringEvent.id`), an ambush and bosses turning on each other (the ring's
`narration`), and a boss arrival that says its temperament (`ring.add`). The last three
carry `payload.mechanic` (`ambush`, `boss-rivals`, `boss-temperament`) so the web can
show a one-time note without matching prose (`apps/web/src/lib/mechanic-notes.ts`). The
tag is additive: persistence and replay store it like any payload field, and the Discord
connector reads payload fields by name, so it ignores it. The engine adds no text for it.

## Visibility and persistence

`EventPersister` is a trusted `includePrivate` subscriber. It writes room, type, scope,
target, payload, text, event id, and creation time to `room_events`, preserving publish
order with a per-room write chain and bounded retries.

These transient state-sync frames are not persisted:

- `ring.state`
- `handshake`
- `system.gap`
- `quick_actions`

Do not add a rendered or audit-relevant event to that list: it will disappear from durable
history and reconnect fallback.

All viewer-facing event queries filter by `room_id` and
`eventVisibilityFor(viewerUserId)`. Public history can explicitly filter to public scope;
Console history explicitly filters private scope and the current target user.

## Prompts

A line typed into the equip card prompt is not always an answer. `equipMonster`'s chooser
re-asks (prompt stays open) when the line names no card. If the line is a command
(`isCommand()` in `commands/index.ts`, which asks the real dispatcher), the reply is
`"<text>" is a command, not a card. Cancel this question first, then run it.`; otherwise
it says the text isn't one of the cards. Neither answer finishes the hand (10b #189).

`sendPrompt(userId, question, choices)` publishes a private `prompt.request`, records the
request in memory, and returns a promise:

- `respondToPrompt(requestId, answer, callerId)` resolves it only for its owner;
- the 120-second default timeout publishes `prompt.timeout` and rejects;
- cancellation publishes `prompt.cancel` and resolves with `PROMPT_CANCELLED`.

The cancellation sentinel must never reach game selection logic. Every channel wrapper
translates it immediately to `PromptCancelledError`; expected cancellation and timeout are
then suppressed by the command pipeline.

Prompt answers are deliberately outside engine serialization lanes. A response must be
able to settle the command that currently holds the user's lane. Connector failures or a
non-string prompt result cancel the request so it cannot hang until timeout.

**When the web Console treats a question as over** (`ConsolePane.tsx`, roadmap 43 I4, 10b
#217). A question ends on its `prompt.timeout` or `prompt.cancel` event, or on an answer.
Events can be missed during a reconnect, so the `pendingPrompt` poll is the backstop:

- an empty poll that **started** after the question arrived clears it at once, because the
  server registers a prompt before it publishes one, so that poll must have seen it;
- an empty poll that started earlier needs a second empty poll, so an in-flight poll can't
  erase a question that has only just arrived (#142);
- a question cleared by a poll is **not** marked resolved, so a later poll that still lists it
  brings it back. The poll's start time is read a render after the request leaves, so a
  question can arrive in that gap and be cleared wrongly; this keeps that from sticking
  (Codex on #422);
- an answer the server rejects as no longer active (`PRECONDITION_FAILED`) clears the
  question, but only when the follow-up poll **succeeded**. On a network failure the cached
  poll can read empty while the question is still live, and burying it would leave the
  player stuck until the server's timeout (#153);
- a `prompt.request` stamped **before this connection's handshake** is replay, not news, and
  is ignored (the poll is asked at once and brings the question back if it is still open).
  Answering publishes no event, so a replayed request for an answered question looks exactly
  like an open one; arming it made the first command after a reload go out as its answer
  ("Prompt is no longer active"), and the next real question then retired it as "Action
  cancelled." (roadmap 44 K6);
- a new question retires any older one still showing, since a player has at most one open
  question (the `roomId:userId` lane and `activeFlows`). If a flow ever prompts again after
  `cancelFlow`, revisit this.

`setActivePromptId` is the only writer of `activePromptIdRef`, and writes it synchronously,
so a request and its timeout replayed in one burst can't leave the input armed.

Answer encoding is a separate protocol: read
[the prompt/answer contract](../reference/prompt-answer-contract.md) before changing labels,
choices, or connector response values. Read
[engine concurrency and timing](engine-concurrency-and-timing.md) before changing prompt
lifetime, lanes, cancellation, or fire-and-forget command execution.

## Reconnect handshake and cursor

The subscription first yields a private `handshake` containing protocol/build versions,
server time, viewer id, and the current ring timer/roster state. Synthetic handshake,
heartbeat, and gap ids keep the `${epochMs}-${suffix}` shape even though they are not
persisted.

The client advances its reconnect cursor on stream events, but never on handshake or
heartbeat transport frames. Cursor updates are monotonic by the leading epoch. Both panes
fetch their own durable initial history and may seed the shared cursor with the history
tail; a seed never moves it backwards.

The in-memory bus retains 200 events and classifies a cursor:

- `found`: replay events after it;
- `ahead`: client is already beyond the buffer tail;
- `evicted`: events passed through this live buffer but the cursor fell out;
- `cold`: the room was newly loaded and memory has no answer.

For `evicted` and `cold`, `RoomManager` resolves the event id in `room_events` and pages
forward. If the anchor row is absent, it compares event ids inside a 24-hour window, then a
7-day window. Replays are capped; hitting the cap yields a private `system.gap`.

An empty durable result after `cold` is normal and produces no warning. An empty result
after `evicted` means replay data was lost and does produce a gap. The live subscriber is
attached before replay starts; events that arrive during the query are buffered and
deduplicated by id before live delivery.

The client treats any inbound frame as proof the connection is alive. A 50-second
watchdog resubscribes from the last cursor when frames stop, and is reset when a background
tab becomes visible so browser timer suspension is not mistaken for a dead connection.

## Initial history and catch-up are different

- `ringHistory` and `consoleHistory` populate pane history on page load. They read up to
  24 hours first and fall back to a small 7-day minimum.
- reconnect replay resumes one continuous event stream from an event id.
- `catchUp` and the Fights panel read completed `fight_summaries`, answering what happened
  over a longer absence without replaying every narration line.

See [analytics and history](analytics-and-history.md) for summaries and projections.

## Chat frames

Room chat (roadmap 41) rides the `ringFeed` connection but is not a game event. The server
subscribes to `ChatService` for the room and user when a feed opens, and yields each message
the user may see as an **untracked** frame, `{ type: 'chat', id: 'chat-<messageId>', payload:
<ChatMessage> }`, with no `data` wrapper (game frames are `tracked(id, GameEvent)`).

- **It never moves the cursor.** tRPC remembers the id of every *tracked* frame and sends it
  back as `lastEventId` on reconnect; a tracked chat id would point the game cursor at an id
  the event log has never heard of. The web `useRingFeed` handles chat frames first and
  returns: they skip the room guard, the cursor and the pane fan-out, and reach only
  `subscribeChat` listeners (`useChat`).
- **The chat subscription attaches before the handshake is yielded**, and frames buffer until it is out, so a message sent after the client's history fetch is never lost between fetch and subscription.
- **It is not replayed.** Chat frames are not in the bus buffer or `room_events`. After every
  handshake `useChat` calls `chat.history` with `afterId` set to the newest id it holds and
  merges by id (paging until a short page, so a long disconnect leaves no gap), so a missed message is recovered and a duplicate is harmless.
- **Visibility is the service's job.** `ChatService.subscribe(roomId, userId, listener)`
  delivers only room messages and DMs the user sent or received. See
  [`rooms-and-identity.md`](rooms-and-identity.md#chat).
- **A frame still proves the connection is alive**, so it resets the web heartbeat watchdog.

## Feed lines: `text` and `payload.lines`

A feed event has two forms of the same content.

- **`text`** is the contract for Discord, which sends it verbatim and relies on its ``` fences,
  `*`/`_` markup and newlines; for pacing, which sizes the pause after an event from its length
  (`helpers/pacing-context.ts`); and for every consumer that predates lines (the fight log, the
  web's fallback, sprite mentions). It keeps the layout of the Slack era: indents, blank lines,
  ASCII rules, several lines bundled into one event. **Do not change its layout** to suit a
  renderer.
- **`payload.lines`** (`FeedLine[]`, `packages/engine/src/events/types.ts`; helpers in
  `events/feed-lines.ts` and the `…Line` siblings in `helpers/card.ts`) is its clean twin:
  every line on its own, no layout whitespace, rules or fences, each with a `kind` and the facts
  a renderer needs (round, actor, card, a roll's natural, bonus, total, target and result, damage,
  HP, a card frame's title). Lines keep the inline markup and the icon spacing of `text`. A
  `card` line is the one multi-line kind: the frame's body, without rules or fences. Lines are
  built where the text is built, from the same values, never parsed from text, and are plain JSON
  (they are persisted in `room_events.payload` and replayed).

Renderers prefer `lines` and fall back to `text`, because events stored before lines existed have
none. The web does this in `FeedEventBody` (`components/FeedLines.tsx`): lines become the
blocks in `utils/feed-lines.ts`, and a missing `lines` array renders `text` as before.
Millefleur composes some kinds (a round divider, "A plays Card", one roll sentence, a rose
", bloodied" inside an HP sentence). The other four themes draw one block per line in the
engine's words. `announcements/feed-lines.test.ts` runs a real fight and holds the invariant: every feed
event carries lines, each line is clean, and the lines' text equals `text` with its layout
removed, so the two cannot drift. Private command replies (`look at` listings, ring errors, the
countdown hints) and protocol events (`ring.state`, `prompt.*`, `handshake`, `heartbeat`,
`quick_actions`, `system.gap`) carry no lines.

Added in roadmap 46 (task 7), so the Millefleur theme could style or replace lines by kind, as its
mock did (the round as a divider, a play's card name, the roll as a quieter line). The web
half is task 8. The composed sentences are display only; they are not a second copy of `text`.

## Change checklist

- [ ] Payloads remain JSON-safe and narration-independent where clients need structure.
- [ ] Every event has the correct room, scope, and private target.
- [ ] A connector subscribes with a viewer id; only trusted projections use `includePrivate`.
- [ ] Persisted event types have replay value; ephemeral types do not.
- [ ] Viewer history combines room and private-visibility filters.
- [ ] Prompt cancellation becomes `PromptCancelledError` before game code.
- [ ] Cursor frames retain the timestamp-prefixed id shape.
- [ ] Live subscription is attached before asynchronous replay.
- [ ] Room changes reset the client cursor, listeners, watchdog, and pending frames.
