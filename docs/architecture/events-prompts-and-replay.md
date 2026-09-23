# Events, prompts, and replay

Status: Current
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
- `catchUp` and the Fight Log read completed `fight_summaries`, answering what happened
  over a longer absence without replaying every narration line.

See [analytics and history](analytics-and-history.md) for summaries and projections.

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
