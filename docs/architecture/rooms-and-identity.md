---
type: Architecture
title: Rooms and identity
description: Room lifecycle, membership, and identity boundaries for one game room.
status: stable
audience: internal
tags: [rooms, identity, scoping]
---
# Rooms and identity

Read before: changing game state, database queries, room membership, invites, connector
room selection, profiles, characters, or event subscriptions.

## Boundary

A room is one isolated game universe. Its `Game`, event bus, ring, characters, shop,
summon quota, state snapshot, events, analytics rows, and connector subscriptions must not
leak into another room.

`RoomManager` is the server boundary between a `roomId` and the active engine objects.
Connectors and tRPC procedures resolve a room through it; they do not use a global
character or game instance.

## Room-scoping rules

1. Every query for one room's game data includes `room_id = ?`. An explicitly global
   leaderboard aggregate is a separate public query, not an omitted room filter.
2. Every room-scoped tRPC read or mutation validates membership. Owner-only operations
   additionally check `room_members.role` or `rooms.owner_id`.
3. Every `GameEvent` carries `roomId`. Every client or connector subscription is attached
   to one room and is torn down or reset when that room changes.
4. A room owns one `public` event stream. Never reuse a room callback, event bus, shop, or
   mutable engine resource across rooms.
5. Characters are room-local. The same profile can have different characters, monsters,
   cards, items, progress, and aliases in different rooms.
6. Room admin authority is local. It does not grant authority in another room.
7. A room member may read public events and only private events addressed to that member.
   Membership alone is not permission to read another member's private narration,
   rewards, or prompts.

For a query over `room_events` on a viewer's behalf, combine the room filter with
`eventVisibilityFor(userId)`. The shared predicate permits public rows plus private rows
whose `target_user_id` matches the viewer. History-by-time-window needs the same predicate:
a fight window can contain unrelated private events.

### Review checklist

- [ ] Every room-local DB query filters by `room_id`.
- [ ] Every room-local tRPC procedure validates membership before reading or mutating.
- [ ] Owner-only actions check the owner role.
- [ ] Every event and subscription is tied to the intended `roomId`.
- [ ] Private-event reads apply viewer visibility, not membership alone.
- [ ] Character and mutable engine lookups start from the room's `Game`.
- [ ] Client state, caches, invalidation, and retained surface state reset or key by room.
- [ ] Connector default/active-room mappings are validated before dispatch.

## Room lifecycle

`RoomManager.createRoom()` creates the `rooms` row, inserts the owner membership, creates a
fresh `Game({ roomId })`, attaches persistence, metrics, fight-stat, fight-summary, and
debug subscribers, and adds the room to the active cache.

Rooms load lazily. `_getOrLoad()` joins concurrent loads for one `roomId`. `_loadRoom()`
first awaits any unload flush still in flight for the room (`pendingFlush`), then restores
`rooms.state` (`jsonb`) only (roadmap 37). A room with `state` null, including one that only
has a stale legacy `state_blob`, starts fresh; the blob is never read. If the state cannot
hydrate, it moves it to `quarantined_state`, stamps a new `state_version`, and starts fresh
(both paths also null the stale `state_blob`, so a rollback to release 1 cannot restore it).
A deletion epoch prevents an in-flight load from publishing a room after its database row
was deleted.

State changes schedule debounced snapshots. Each save is stamped with `nextStateVersion()`,
a process-wide monotonic clock, and only lands where the stored `state_version` is lower, so
an older snapshot never overwrites a newer one. Saves write `state` and
`state_version` only; `state_blob` is no longer written (it is dropped by a later migration). `unloadRoom()`
removes the cache entry, detaches subscribers, flushes with `Game.flushState()`, disposes
the game, and awaits the flush before it returns. It refuses to unload while
`ring.inEncounter`, because the timer-driven fight and its projection subscribers must
finish together. `sweepIdleRooms()` retries on a later sweep.

Room deletion is owner-only. It evicts the active game without saving, then deletes the
room; foreign-key cascades remove memberships, events, connector mappings, summaries, and
room analytics. Room reset first evicts the active game and awaits its flush, then clears
projections and summaries, zeroes the fight counter, quarantines the old state, and stamps a
new `state_version` as a tombstone. A save still in flight from the old game is then stale
and cannot bring the room back (bugs 200–202 in the ledger).

**One cache per process, not one overall.** The server and the Discord connector each run a
`RoomManager` with its own active cache over the same `rooms` table. The ordering guarantees
above hold within one process. A reset in one does not evict the room from the other, whose
next save would outrank the tombstone; that is open as item G in
[10 — bug fixes](../roadmap/10-bug-fixes.md).

## Membership and invitations

`room_members` is keyed by `(room_id, user_id)` and stores `owner|member`, join time, and
the catch-up `last_seen_at`. Creating a room inserts the owner. Joining resolves the unique
eight-character invite code and idempotently inserts a member. Owners cannot leave; they
must delete the room or gain a future ownership-transfer flow.

Rooms are connector-agnostic. Discord stores the mapping separately:

- `guild_rooms` maps a guild to its rooms and permits one default per guild.
- `guild_user_active_rooms` stores each canonical user's active room in that guild.
- active-room resolution validates both the guild mapping and current membership, then
  repairs stale mappings by selecting the guild default;
- first use creates the guild default. A partial unique index and orphan cleanup make
  concurrent creators converge on one room.

Web clients select rooms directly from membership and invite APIs.

## Profile identity and room characters

`profiles.id` is the canonical Supabase user id. `user_connectors` maps an external
connector identity, such as a Discord user id, to that profile. Connector ids are not
character ids and do not make a room global.

`profiles.display_name` is global public identity for membership lists and global
leaderboards. Values that still look like the signup email are masked by
`publicDisplayName()` before they reach another player.

A `Beastmaster.givenName` is a room-local alias. New characters are seeded from the
profile display name. When the profile name changes, the server updates only room
characters whose rendered name still equals the previous seeded value; an alias chosen
with `edit my character` remains untouched. Historical event text, fight participants,
and monster-stat snapshots remain historical.

Room leaderboards prefer the current room character name. Global player leaderboards use
the profile display name.

## Common failures

| Symptom | Boundary that was missed |
|---|---|
| One room's shop changes another | Mutable shop state escaped the room's `Game` |
| A feed survives room navigation | Subscription/cursor state was not reset by `roomId` |
| A fight detail reveals rewards or prompts | Time-window query omitted `eventVisibilityFor` |
| A room member reads another room | Procedure trusted its input without membership validation |
| Character changes cross rooms | Character was looked up outside the room's `Game` |
| Discord dispatches to a stale room | Active mapping was not joined to guild mapping and membership |

Related contracts:
[events, prompts, and replay](events-prompts-and-replay.md) and
[engine concurrency and timing](engine-concurrency-and-timing.md).
