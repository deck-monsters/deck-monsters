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
`rooms.state` (`jsonb`) (roadmap 37). Only when `state` is null and a legacy `state_blob`
exists does it restore, read-only, from the blob (warn log, `source="blob"`); the blob is
never written and the room's next save fills `state`. Removed with the column drop. If the
source cannot hydrate, it moves it to its own quarantine column (`quarantined_state` or
`quarantined_blob`), stamps a new `state_version`, and starts fresh.
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
above (flush, tombstone, `resetting` gate) hold within one process only. Across processes a
room has a **generation** (`rooms.state_generation`, bug G):

- A loaded room remembers the generation it was loaded at; the load reads it in the same row
  as the state, so the two are one snapshot. Every save's guarded update requires
  `state_generation = <loaded>` in addition to the `state_version` guard.
- A reset (and a hydration-failure quarantine) bumps `state_generation` in the same update that
  writes the tombstone. The resetting process has already detached and flushed its own copy
  (bug 202's order), so its own saves are never refused by the bump; its next load reads the
  new generation.
- Another process's copy keeps saving at the old generation. Its next save matches no row.
  `PostgresStateStore` then probes the row: a moved generation means "reset elsewhere", so
  `RoomManager` drops that copy without flushing (a flush would be refused too), counts
  `dm_room_state_generation_drops_total`, and logs a warning. The next request reloads the reset
  room. A missing row (deleted room) or an unchanged generation is an ordinary stale save.
- A drop tears the copy down exactly as a same-process reset does (`_detachRoomEntry`, no
  flush), so what a reset leaves behind (a running fight timer chain, unanswered prompts,
  long-lived bus subscribers) a drop leaves behind too.
- The reset wins by design. The other process serves its stale copy until that copy next saves,
  so an action taken on it in that window (a command that reported success) is lost when the
  save is refused and the copy dropped.
- Overlaps: a save in flight when the reset lands is refused by the tombstone version and
  the generation both, and the drop is a no-op if the room already left `active`. A fight in
  the dropped copy is discarded, since the room it belonged to no longer exists.
- Compatibility: a release that does not know the column writes with the version guard only.
  The tombstone version still refuses its stale saves as before, but it neither notices nor
  reacts to a reset. The generation check protects only between processes running this release.
  A deploy that upgrades the server before the connector leaves that window open.

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

## Querying room state

Each room's whole game is stored as jsonb in `rooms.state` (roadmap 37). Three views flatten
it for **read-only operator use** in the SQL editor: `room_state_monsters`,
`room_state_monster_cards`, and `room_state_characters`. They span every room on purpose, so
they are the one place a query may leave out `room_id`. App code must not use them: it keeps
reading state through a room id (the room's `Game`, or a query with `where room_id = ?`).

They are `security_invoker` and revoked from `anon` and `authenticated`, so the Supabase API
cannot reach them. `card_types` (class name to display name) is the same, with RLS on and no
policy. Which Dragons own Enchanted Faceswap:

```sql
select m.room_id, m.given_name, m.level
  from room_state_monsters m
  join room_state_monster_cards c using (room_id, owner_user_id, monster_index)
 where m.monster_type = 'Dragon' and c.card_type = 'Enchanted Faceswap';
```

- **`level` is computed** by `room_state_level_for_xp`, which holds the engine's XP thresholds
  (`helpers/levels.ts`), not read from `room_monster_stats`. That table updates only after a
  fight, so it lags or misses a monster. A test compares the function with `getLevel` at every
  threshold; retuning the curve means a new migration.
- **`stable_id` can be null.** The engine mints it on the first read of `monster.stableId`, so
  a monster nothing has read yet is saved without one, and `null = null` never joins. Join
  monsters to their cards on `owner_user_id` + `monster_index`, as above; `stable_id` is only
  for cross-referencing with `room_monster_stats.monster_id`.
- **`given_name` is the raw saved name.** The game displays it title-cased, and a monster with
  no saved name shows a generated one; here it is the stored string or null.
- **A new card needs a `card_types` row.** Add a migration with
  `insert into public.card_types (class_name, card_type) values (...) on conflict (class_name) do update ...`.
  The class name is the JavaScript class (`HitCard`, `DelayedHit`; not uniform), and the display
  name is the card's static `cardType`. `room-state-views.test.ts` fails when a card in
  `allCards` has no row; until it exists, the view shows the raw class name.

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
