---
type: Roadmap
title: Room state as Postgres jsonb
description: Plan to replace the gzip and base64 room state blob with a queryable jsonb column, covering key order, NUL bytes, ordered saves, a reversible dual-write rollout, a backfill script, and read-only query views.
status: draft
audience: internal
tags: [roadmap, database, persistence, server, engine]
---
# 37 — Room state as Postgres `jsonb`

**Status:** In progress (2026-09-29) on branch `claude/unicorn-monster-cards-cigpmw`. Read
[rooms and identity](../architecture/rooms-and-identity.md) and
[engine concurrency and timing](../architecture/engine-concurrency-and-timing.md) first. Every
query here stays scoped to one room, and saves are part of the timing contract.

**PRs.** The budget rule is four or five tasks a PR, so the pass ships in three:
1. **Expand, tasks 1–5.** Nothing changes for players, and a redeploy of the previous release
   still works.
2. **Views, task 7.** A small PR after the backfill has run in production, so the views are
   checked against real rows.
3. **Contract, task 6.** After the one-week window.

## Why

The owner (2026-09-29): "those base64 blobs for state are an artifact of the infrastructure
that the game ran on long ago. Should we re-design now to be Postgres native?"

Each room's whole game is stored as `rooms.state_blob`, a `text` column. It holds
`base64(gzip(JSON.stringify(game)))`. It dates from when the game kept state as a string in
whatever store the host offered. The costs today:

- **SQL cannot see inside it.** Roadmap 36 asked a simple question: which Dragons own Enchanted
  Faceswap? The answer took copying every blob out of the database and decoding it by hand.
  Questions like "which cards do level 3 Unicorns hold" or "how many coins are in circulation"
  are the same.
- **Debugging a room means decoding first.** This covers a quarantined blob, a player's report,
  and a restore that fails.
- **CPU on the event loop.** `persistState()` runs `zlib.gzipSync` on the game thread every save.
  That is small at today's sizes, but it is work for nothing once Postgres compresses large
  values itself (TOAST).

Storage size is **not** a reason. The measurement below shows gzip+base64 is smaller than plain
JSON for today's rooms, and every size involved is a few kilobytes.

## How it works today

Facts from the code on 2026-09-29, with file references so the next pass can check them.

### Write path

- `Game.persistState()` (`packages/engine/src/game.ts`) snapshots the ring's non-boss
  contestants into `optionsStore.ringContestantRefs`. It then builds
  `zlib.gzipSync(JSON.stringify(this))`, base64-encodes it, and hands that string to:
  - `this.stateStore.save(roomId, string)`, fire-and-forget, where a failure only logs;
  - `this.stateSaveFunc(string)`, the legacy `game.saveState = fn` setter, which only tests use
    today.
- **When it saves:**
  - `scheduleSave()` debounces every `stateChange` by `SAVE_DEBOUNCE_MS` (30 s).
  - It also saves **immediately** in three places:
    - the mega boss's due time (`setScheduledAt`, at least daily, and every 30 s while it waits
      out a fight);
    - boss-summon refunds (`_refundSingleBossSummon`, and the pending-summon refund at
      construction);
    - the first attach of a store after unsaved construction-time changes (the `stateStore`
      setter and `_unsavedSinceConstruction`).
  - `RoomManager._detachRoomEntry(entry, { flushState: true })` calls `game.saveState()` on
    unload.
- `PostgresStateStore.save` (`packages/server/src/state-store.ts`) runs
  `update rooms set state_blob = $state, updated_at = now() where id = $roomId`.
- **There is no ordering guard.** Two saves in flight (an immediate mega-boss save and a
  debounced save, for example) run on different pool connections and can land in either order.
  An older snapshot can overwrite a newer one. This has not been seen in production, but nothing
  prevents it.

### Read path

- `RoomManager._loadRoom` (`packages/server/src/room-manager.ts`) selects `state_blob` for the
  room.
  - If a blob exists, it calls `restoreGame(blob, log)`.
  - If `restoreGame` throws, the blob moves to `quarantined_blob`, `state_blob` is set to null, a
    fresh `Game` starts, and `roomHydrationFailures` is incremented.
- `restoreGame` → `getOptions(gameJSON)` (`packages/engine/src/index.ts`) tries `JSON.parse`
  first, then falls back to gunzip+base64. **So the engine already accepts plain JSON.** It then
  validates with `gameStateSchema` and rebuilds the characters.
- `resetRoomState` also moves the blob to `quarantined_blob`.
- `packages/server/scripts/backfill-leaderboard-from-state.ts`, a one-off, reads every room's
  blob through `restoreGame`.

### Schema

- `rooms` is defined in `supabase/migrations/20260101000000_initial.sql`, and
  `quarantined_blob text` was added in `20260406000000_quarantined_blob.sql`.
- Drizzle mirrors both in `packages/server/src/db/schema.ts`. The driver is `node-postgres`
  (`drizzle-orm/node-postgres`).
- Migrations are applied with `supabase db push --linked`
  ([deployment](../operations/deployment.md)).
- The RLS policy "Room members can view rooms" lets a member select their room's row, blob
  included, through the Supabase API. The web app does not read `rooms` directly; it goes through
  tRPC. This plan does not change what a member can read.

### Shape and size (production, read-only, 2026-09-29)

- There are 6 rooms. Blobs range from 136 to 5,556 base64 characters, and the largest room has
  12,243 `room_events`.
- One room decoded to **5,245 bytes of JSON from 1,732 base64 characters**. So `jsonb` rows
  will be about 3× the text they replace: tens of kilobytes at most. Postgres compresses any value
  over about 2 kB.
- The shape is the `BaseClass.toJSON()` form, `{ name, options }`, all the way down:
  - `options`: `characters`, `shop`, `roomId`, `bossSummons`, `bossSummonsPending`,
    `megaBossAt`, and `ringContestantRefs` while a ring is occupied.
  - `characters`: keyed by user id. Each is `{ name, options }`, and its `options` hold `xp`,
    `coins`, `deck[]`, `items[]`, `monsters[]`, `battles`, and so on.
  - Each monster is `{ name: <type, e.g. "Dragon">, options }`. Its `options` hold `stableId`,
    `xp`, `cards[]`, `items[]`, `presets`, `battles`, `color`, and so on.
  - Each card is `{ name: <class name>, options }`.

## Goals and non-goals

**Goals**

1. Room state is stored as `jsonb`, so read-only SQL can answer questions about it in one query.
2. No player-visible change: the same state restores and the same things appear in the same
   order.
3. A rollback to the previous release works at every step until the final cleanup.
4. Saves are ordered: an older snapshot can never overwrite a newer one.
5. The engine stays free of database code. It hands the server a plain object; only the server
   knows about Postgres.

**Non-goals**

- Normalized tables for characters, monsters or decks. That is step 2, and only if it earns its
  place (see [Later](#later-step-2-normalized-tables)).
- Changing when or how often the game saves. The debounce, the immediate saves and the unload
  flush stay as they are.
- Changing `room_events`, the analytics tables, or what an RLS policy exposes.

## Decisions

### Made in this plan

- **`jsonb`, not `json`.** `jsonb` is what makes the state queryable: path operators, `@>`
  containment, `jsonb_path_query`, and GIN or expression indexes all work on it directly. `json`
  keeps the text exactly, but every query would need a `::jsonb` cast and it cannot be indexed
  directly. The two risks `jsonb` brings (key order and the NUL character, below) are handled by
  tasks 1 and 2. **Fallback:** if task 1's key-order audit turns up more than a day's work, ship
  `json` instead, with the same rollout. It is a one-word change in the migration, and the
  queries cast.
- **Expand, migrate, contract.** A dual-write release goes first. It is followed by a backfill
  and, later, a release that drops the old column. This keeps every step reversible by an
  ordinary redeploy.
- **The engine serializes to an object, and the server stores it.** `StateStore.save` receives
  the plain JSON object (what `JSON.parse(JSON.stringify(game))` gives). Gzip and base64 leave the
  engine's save path. `restoreGame` keeps accepting all three forms (object, JSON string, legacy
  gzip+base64 string), because connectors and tests call it with strings and old backups exist.
- **Save order comes from a version column,** not from locks. Each snapshot is stamped with a
  version from one process-wide monotonic clock when it is taken, and the update lands only if
  the stored version is lower. Nothing ever rewinds the version: not a reload, a reset, or the
  backfill. Unloading a room waits for its last save before the room can load again. Details are
  in task 4.
- **Decoding old blobs happens in TypeScript.** Postgres cannot gunzip in SQL. A one-off,
  idempotent script converts rooms that have not been loaded since the deploy, and rooms that are
  loaded convert themselves by saving.

### For the owner (defaults in bold, so the pass can start without waiting)

1. **The dual-write window: one week** of normal play after the backfill before dropping
   `state_blob`. A shorter window works if nothing looks wrong.
2. **A backup before the drop:** a `pg_dump` of `rooms` (id, `state_blob`,
   `quarantined_blob`) kept with the other backups. Supabase's daily backups also cover it.
3. **Read-only query views (task 7): included.** They make "which Dragons own Faceswap" one line.

## Risks found while planning

1. **Key order.** `jsonb` does not keep object key order: keys come back sorted by length, then
   bytewise. Arrays keep their order, so decks, cards, items and monsters are safe. Object keys
   read in order, from a grep on 2026-09-29:
   - **Presets are already safe.** Every surface sorts them by name: the Workshop
     (`apps/web/src/components/PresetControl.tsx` sorts `Object.keys(presets)` with
     `localeCompare`) and `look at presets` (`commands/presets.ts`). The tRPC payload passes the
     object through. The plan's first draft proposed a `presetOrder` field; Codex's review of
     #412 showed it would have *changed* the order players see, so it is dropped.
   - **The rankings fallback** (`lookAtCharacterRankings` and `lookAtMonsterRankings` in
     `game.ts`) ranks `Object.values(characters)` when analytics is absent. Ties would break
     differently.
   - **Preset lookup** (`beastmaster.ts`, the `Object.keys(presets).find(...)` by normalized
     name) returns the first match. If two saved names normalize the same way, a different one
     wins after a round trip.
   - **Admin menus.** `creatures/edit.ts` and `helpers/choices.ts` list `Object.keys(options)` in
     the admin `edit` prompts. The order changes, but nothing player-facing does.
   - **Still to check:** `announcements/index.ts` (`Object.values` over characters), `game.ts`
     `getRoomMonsterLevels` and the character loop, `bossSummonsPending` (count only), and
     `BaseClass` option copying (order-free).
2. **The NUL character.** `jsonb` rejects the escaped `\u0000` in a string, and the whole save
   fails. A monster or character name typed with a NUL (a paste, a connector bug) would silently
   stop the room saving, because the save is fire-and-forget. The text column accepts it today.
   NUL can appear in object **keys** too: preset names are keys, and they accept any string. A
   repair that deletes the NUL can merge two keys (`ab` and `a\u0000b`) and lose a preset.
   **An unpaired UTF-16 surrogate fails the same way** (found in task 5, when the backfill's test
   used one to force a failed write). Text cut in the middle of an emoji leaves one. The repair
   replaces both with U+FFFD.
3. **Out-of-order and stale saves.** A per-store counter is not enough (Codex review of #412):
   - Two saves in flight from one game (an immediate mega-boss save and a debounced save) can
     land in either order today.
   - An unload flushes with a fire-and-forget save and drops the room. A load straight after can
     read the row before the flush lands, restore the older state, and then race the flush.
   - `resetRoomState` writes the database before it detaches the game. A save still in flight
     from the old game can land after the reset and bring the room back.
4. **Driver serialization.** With `node-postgres`, Drizzle's `jsonb()` column passes a JS object
   through `JSON.stringify`. The known double-encoding bug (a JSON *string* stored as a `jsonb`
   string) affects `postgres-js`, not this driver. It must still be proven by a test against real
   Postgres (task 4), because a stored `"{\"name\":…}"` string would restore fine through
   `getOptions` and hide the bug.
5. **Rollback after the contract release.** Once `state_blob` stops being written, a redeploy of
   an older release would restore stale blobs. The contract release (task 6) must say so in its
   notes, and it comes only after the dual-write window.
6. **Hot-row write size.** Each save rewrites the whole row either way; `jsonb` makes it about
   3× bigger before TOAST. At 30-second debounce and 6 rooms this is noise. Watch it with the
   save metrics (task 4) if rooms grow 100×.

## Design

### Schema (task 3)

A new migration, `supabase/migrations/2026MMDD000000_room_state_jsonb.sql`:

```sql
alter table public.rooms
  add column if not exists state jsonb,
  add column if not exists state_version bigint not null default 0,
  add column if not exists quarantined_state jsonb;

comment on column public.rooms.state is
  'The room''s serialized Game ({ name, options }), written by the server''s PostgresStateStore. Replaces state_blob (roadmap 37).';
comment on column public.rooms.state_version is
  'Monotonic save sequence; a save lands only if newer (roadmap 37).';
comment on column public.rooms.state_blob is
  'DEPRECATED (roadmap 37): gzip+base64 JSON. Dual-written until the contract release drops it.';
```

- There is no index yet. At six rooms a sequential scan is instant. Task 7 adds expression or GIN
  indexes only when a query needs them.
- Drizzle, in `schema.ts`:
  - `state: jsonb('state').$type<SerializedGame>()`
  - `stateVersion: bigint('state_version', { mode: 'number' }).notNull().default(0)`
  - `quarantinedState: jsonb('quarantined_state')`

### Engine (tasks 1 and 2)

- **A new exported type, `SerializedGame`:** `{ name: string; options: Record<string, unknown> }`,
  in `types/state-store.ts`.
- **`StateStore`** becomes:

  ```ts
  export interface StateStore {
    save(roomId: string, state: SerializedGame): Promise<void>;
    load(roomId: string): Promise<SerializedGame | string | null>;
  }
  ```

  `load` may return a legacy string, and `restoreGame` handles both.
- **`persistState()`:**
  - builds `const state = repairSerializedGame(JSON.parse(JSON.stringify(this)))`;
  - passes `state` to the store;
  - passes `JSON.stringify(state)` to `stateSaveFunc`. This is plain JSON, not gzip, and
    `restoreGame` already reads it. The setter's type stays `(state: string) => void`.
  - `zlib` leaves the save path. It stays in `getOptions` for legacy input.
- **`repairSerializedGame(state)`** is a recursive walk, not a `JSON.stringify` replacer (a
  replacer cannot rename the key it is visiting). It is exported, so the backfill script uses the
  same code.
  - It replaces `\u0000` with U+FFFD in every string value and every key.
  - If a repaired key collides with an existing key in the same object, it appends ` (2)`,
    ` (3)`, and so on, so nothing is dropped.
  - It returns the number of repairs, and `persistState` logs that once per save with the room
    id.
  - Tests cover a NUL in a value, in a key, and the `ab` / `a\u0000b` preset collision (both
    presets survive).
  - **The input side.** Also strip control characters where names enter the game: character and
    monster names, and preset names on save. The repair is then a backstop for old data and
    connector bugs, not the main path.
- **Key-order independence (task 1).** Anything shown to a player, or anything that decides an
  outcome, must not depend on object key order after a round trip through sorted keys.
  - **Rankings fallback.** Break ties by name, then by id.
  - **Preset lookup.** When several saved names match the normalized name, prefer the exact
    match, then the first in `localeCompare` order.
  - **The audit.** Finish the "still to check" list in risk 1 and grep for any
    `Object.keys|values|entries` and `for…in` over saved `options` that the list missed. Record
    each hit in this plan as order-safe (with the reason) or fixed.
  - **The guard test.** Build a game with several characters, presets saved in a non-sorted
    order, a boss-summon ledger, a shop, and ring refs. Serialize it, re-sort every object's keys
    the way `jsonb` does (length, then bytewise), restore, and assert:
    - the Workshop preset list and `look at presets`, alphabetical before and after;
    - rankings;
    - the shop listing;
    - `JSON.stringify` of the restored game, compared with keys sorted on both sides.

### Server (task 4)

- **Versions come from one clock.** `nextStateVersion()` in `state-store.ts` returns
  `max(last + 1, Date.now() * 1000)`. `Date.now() * 1000` is about 1.8e15, inside
  `Number.MAX_SAFE_INTEGER` and `bigint`. It is process-wide, not per store, so a room that
  unloads and reloads keeps counting upward. A restart continues from the clock. The one
  assumption is that the server clock does not step back by more than the gap between two saves
  of the same room across a restart; note it in the store's comment.
- **`PostgresStateStore.save(roomId, state)`:**
  - It takes the version **synchronously**, when `persistState` takes the snapshot, before any
    `await`. So version order is snapshot order.
  - It writes:

    ```sql
    update rooms
       set state = $state, state_version = $v, updated_at = now()
           -- release 1 only:
           , state_blob = $legacyBlob
     where id = $roomId and state_version < $v
    ```

    `$legacyBlob` is `base64(gzip(JSON.stringify(state)))`. It is built in the server, not the
    engine, and deleted by task 6.
  - If no row updates, the save was stale: a newer snapshot or a reset already landed. Count it
    in `dm_room_state_saves_stale_total` and do not retry.
  - It returns the write's promise.
- **Waiting for the last save.**
  - The engine keeps the promise of its latest store write, and adds
    `Game.flushState(): Promise<void>`, which takes a snapshot now and resolves when that write
    has settled.
  - `RoomManager` keeps a `pendingFlush` map from room id to that promise:
    - `_detachRoomEntry(entry, { flushState: true })` sets it;
    - `unloadRoom` awaits it;
    - `_loadRoom` awaits any pending flush for the room **before** it selects the row, so a
      reload never reads state older than the flush.
  - This ties into the per-room lanes in
    [engine concurrency and timing](../architecture/engine-concurrency-and-timing.md). Read that
    doc first, and add the flush to its unload section.
- **`_loadRoom`:**
  - It selects `state` and `state_blob`, and prefers `state`, falling back to `state_blob`.
  - Quarantine moves whichever column was the source into its quarantine column
    (`quarantined_state` or `quarantined_blob`), nulls both live columns, and sets
    `state_version = nextStateVersion()`. So any save still in flight from before is stale.
- **`resetRoomState`** detaches the game and awaits its flush **first**, then writes the
  database. The write is: live columns to null, the old state to the quarantine columns, and
  `state_version = nextStateVersion()`. The version is a tombstone and never rewinds to 0.
  Today's order, database first and detach second, is the race in risk 3.
- **`backfill-leaderboard-from-state.ts`:** read `state ?? state_blob`.
- **Metrics** (`packages/server/src/metrics/index.ts`, and in [observability](../operations/observability.md)),
  with the `dm_` prefix every other metric uses:
  - `dm_room_state_save_bytes` (histogram, from `Buffer.byteLength(JSON.stringify(state))`);
  - `dm_room_state_save_failures_total`;
  - `dm_room_state_saves_stale_total`;
  - `dm_room_state_source_total{source="state"|"blob"}` on load, to watch the backfill finish.
  Every label is a room id or a source, never user data.
- **Room scope.** Every statement keeps `where id = $roomId`. No app code queries across rooms.
  The cross-room queries in task 7 are read-only operator tooling.

### Backfill (task 5)

A one-off script, `packages/server/scripts/migrate-room-state-to-jsonb.ts`, run with
`DATABASE_URL=… pnpm exec tsx`:

1. Select `id` and `state_blob` from `rooms` where `state is null and state_blob is not null`.
2. For each room, decode the blob (gunzip+base64, or a plain JSON string) **without** calling
   `restoreGame`, so the stored content is what was saved, apart from the repair in step 3.
3. Run `repairSerializedGame` (the NUL repair, task 2) from the engine, so the script and the
   engine cannot drift apart.
4. Write it with this guard:

   ```sql
   update rooms
      set state = $s
    where id = $id and state is null and state_blob = $blobRead
   ```

   - **It never touches `state_version`** (Codex review of #412). A live store's snapshots are
     always newer than whatever is stored, so the backfill must not take a version a live save
     would use.
   - If the server saved the room meanwhile, `state` is no longer null and the script skips it.
   - The `state_blob = $blobRead` compare-and-swap means a newer blob written since the read is
     not overwritten with an older decode. A room skipped this way is re-read and retried once,
     then reported.
5. A blob that will not decode is **not** quarantined by the script. It is reported, and it is
   left for the server's normal load path to quarantine.

- Flags:
  - `--dry-run`: decode and report only.
  - `--room <id>`: one room.
  - `--from-blob`: the rollback case below. It converts rooms whose `state` is already set, and
    swaps the null check for `state_blob = $blobRead` alone. It sets
    `state_version = state_version + 1`, not a clock stamp: the script runs on the operator's
    machine, and a clock ahead of Railway's would make the server's next saves look stale
    (review of task 5). It also clears a stale `state` whose blob the old release nulled in a
    reset or quarantine, so a rollback cannot bring a reset room back (whole-branch review).
- Output: counts of converted, already converted, empty, and failed rooms, with byte sizes.
- It is idempotent: a second run converts nothing.
- Run it after release 1 is live on both services that write room state, the server and the
  Discord connector. Then check with:

  ```sql
  select count(*) filter (where state is null and state_blob is not null) as unconverted,
         count(*) filter (where state is not null) as converted
    from rooms;
  ```

### Contract (task 6, a separate PR after the window)

1. **Release 2** stops writing `state_blob` and drops the read fallback in `_loadRoom`, which now
   reads `state` only. The engine's `getOptions` keeps its legacy decode, because it is public
   API. The quarantine of a legacy blob goes too.
2. **Take the backup** (decision 2).
3. **A migration** runs `alter table rooms drop column state_blob;`. `quarantined_blob` stays
   until it is empty or explicitly archived. Today it is null in all six rooms.
4. **Update Drizzle and the docs,** and delete the server's legacy-blob builder.

### Read-only query views (task 7)

Views for operators and the SQL editor. They use `security_invoker`, and no grant to `anon` or
`authenticated`, so the API does not expose them:

- `room_state_monsters`: `room_id`, `owner_user_id`, `monster_type` (`name`), `stable_id`,
  `given_name`, `xp`, and `level`. The level is computed with the same XP thresholds as the
  engine, or read from `room_monster_stats` by join, whichever the pass finds exact.
- `room_state_monster_cards`: `room_id`, `stable_id`, `card` (the serialized class name), and
  `card_type` (the display name), one row per card in the monster's hand.
- `room_state_characters`: `room_id`, `user_id`, `coins`, `xp`, and `deck_size`.

Example, the Faceswap watch from roadmap 36 in one query:

```sql
select m.room_id, m.given_name, m.level
  from room_state_monsters m
  join room_state_monster_cards c using (room_id, stable_id)
 where m.monster_type = 'Dragon' and c.card_type = 'Enchanted Faceswap';
```

A card's serialized `name` is its JavaScript class name, and the names are not uniform: a
production deck holds `HitCard`, `BattleFocusCard`, and `DelayedHit`. So `card_type` comes from a
`card_types(class_name, card_type)` table, seeded by a migration written from the engine's card
registry. A test in task 7 fails when a registered card is missing from it, so a new card cannot
fall out of the view silently. Document the
views in a short "Querying room state" section of
[rooms and identity](../architecture/rooms-and-identity.md). The section says these views are for
read-only operator use, and that app code keeps querying through a room id.

## Tasks

Keep the pass to one PR for tasks 1–5 and 7, the expand release. Task 6 is a second, small PR
after the window.

| # | Task | Area / files | Acceptance | Can run beside | Status | Commit |
|---|---|---|---|---|---|---|
| 1 | **Key-order independence.** Finish the audit of key-order reads of saved `options`. Break rankings ties. Make preset lookup deterministic. Add the sorted-keys round-trip guard test | Engine: `game.ts`, `characters/beastmaster.ts`, and any audit hits; a new `state-roundtrip.test.ts` | The guard test fails on `main` for rankings ties, then passes. Presets stay alphabetical on every surface. The audit table is in this plan | 3 | Done: see the audit below. The guard test fails on the old code for each fix (rankings tie, monster-name collision, preset case collision) and passes now | 973b0d81, b6c33499, 8b76208a, 68a4765e, 2ce9df56 |
| 2 | **The engine serializes an object.** `SerializedGame`, the new `StateStore` signature, `persistState` without gzip, `repairSerializedGame` (collision-safe NUL repair), control characters stripped where names enter, `Game.flushState()`, and `saveState` handing out plain JSON | Engine: `game.ts`, `types/state-store.ts`, `index.ts` (exports); `game.test.ts` updated where it decodes saves | Engine tests pass. A NUL in a value and in a key saves and restores, and the `ab` / `a\u0000b` preset collision keeps both. `flushState` resolves after the store write. `restoreGame` accepts an object, a JSON string, and a legacy blob (one test each) | 3 (after 1: both touch `game.ts`) | Done: `persistState` hands the store a repaired plain object and `saveState` plain JSON; `repairSerializedGame` and `SerializedGame` are exported; `flushState()` waits for the write; control characters are stripped in character and monster naming, the name edit, and preset save. The server still writes the old blob until task 4 | c4380aff, 2ce9df56, 68aadd9d, 129a8dd6 |
| 3 | **Schema.** The migration and the Drizzle columns | `supabase/migrations/`, `packages/server/src/db/schema.ts` | `supabase db reset` locally applies cleanly. Drizzle types compile | 1, 2 | Done: every migration applies in order on a local Postgres 16 (Supabase `auth` schema and roles stubbed), and the new one re-runs as a no-op. Drizzle types compile | a54bceff |
| 4 | **Server store and load path.** Clock-versioned dual-write, the `pendingFlush` wait on unload and load, load preferring `state`, quarantine and reset for both columns with a tombstone version (reset detaches and flushes first), the leaderboard backfill script, and metrics | `packages/server/src/state-store.ts`, `room-manager.ts`, `metrics.ts`, `scripts/backfill-leaderboard-from-state.ts`; tests | Unit tests: prefer `state`, fall back to the blob, quarantine each source, and the stale-save guard (an older version does not overwrite). **Race tests,** with the store write held open: an unload then an immediate reload reads the flushed state, not the older one; a reset while an old save is in flight is not undone by it; two saves from one game landing in reverse order keep the newer. **Against local Postgres** (`supabase start`): a saved row's `jsonb_typeof(state) = 'object'`, not `'string'`, and a restart restores it. Server tests pass | none (after 2, 3) | Done. Server 284 passing with `TEST_DATABASE_URL` at the end of the pass (the three real-Postgres tests: a jsonb object not a string, an older write after a newer one does not land, a tombstone blocks an earlier save). One deliberate change from the design: a failed restore of `state` also quarantines a dual-written `state_blob` into `quarantined_blob`, instead of nulling it unkept. `PostgresStateStore.write(roomId, state, version)` is public only as a test seam. Bugs 200–202 in the ledger | ae089093, 6f0ba8dd, c4a9a35c |
| 4b | **Flush every room on shutdown** (found in this pass). The server has no `SIGTERM` handler, so a deploy kills the process with up to 30 s of debounced changes unsaved in every active room. On `SIGTERM` or `SIGINT`: stop taking requests, `flushState()` every active room (without unloading a fight in progress), await the flushes within the platform's grace period, then close the pool | `packages/server/src/index.ts`, `room-manager.ts` | A test: shutdown awaits every room's flush before the pool closes; a flush that hangs past the deadline does not block exit | 5 | Done: `RoomManager.flushAll` and `createShutdown` (`shutdown.ts`), wired for SIGTERM and SIGINT. Also from task 4's review: a reset now waits out concurrent loads (`resetting` gate plus load-epoch invalidation), with tests | c4a9a35c, b4cfd58b |
| 5 | **The backfill script and runbook** | `packages/server/scripts/migrate-room-state-to-jsonb.ts`; [deployment](../operations/deployment.md) runbook section | A dry run and a real run on local data seeded with legacy blobs, including one corrupt blob, which is reported and not written. A second run converts 0. With a room loaded in a running release 1, the script does not change `state_version`, and the live save after it still lands. A blob changed between read and write is not overwritten | 7 | Done: `room-state-backfill.ts` (tested module) and the CLI. 11 real-Postgres tests, including a live save during the backfill, a blob changed between read and write, and `--from-blob`. Review fixes: `--from-blob` sets `state_version + 1` (a laptop clock ahead of Railway's would have made the server's saves look stale), failure reasons carry no player data, unknown flags are refused. The engine repair now also replaces unpaired surrogates. The runbook is in [deployment](../operations/deployment.md#room-state-migration-to-jsonb-roadmap-37) | 0a1ca6b6, 1a32efb4, 9262fc28, 129a8dd6 |
| 6 | **Contract** (second PR, after the window). Stop dual-writing, drop the load fallback, back up, and drop `state_blob` | Server, migration, docs | Production shows `room_state_source_total{source="blob"}` at 0 for the whole window. A backup exists. Tests pass | — | Planned | |
| 7 | **Read-only query views** and the "Querying room state" doc section | A migration with the views; `rooms-and-identity.md` | The Faceswap query above returns the same answer as decoding by hand, on local data | 5 | Planned | |

### Task 1 audit (2026-09-29)

Every read of a saved object's keys in `packages/engine/src`, and whether its order matters.

| Where | What it iterates | Verdict |
|---|---|---|
| `game.ts` `getCreatureRankings` | characters, or monsters from the lookup | **Fixed:** ties break by name, then id |
| `game.ts` `getAllMonstersLookup` | characters, to key monsters by lowercased name | **Fixed:** characters in id order, so a name two players share resolves to the same monster every time |
| `beastmaster.ts` `resolvePresetKey` | a monster's presets, by case-insensitive name | **Fixed:** exact match first, then the alphabetically first |
| `beastmaster.ts` `getMonsterPresets`, `commands/presets.ts`, `PresetControl.tsx` | presets | Order-safe: every surface sorts by name |
| `beastmaster.ts` preset count (`MAX_PRESETS`) | presets | Order-safe: a count |
| `game.ts` `getRoomMonsterLevels`, the dispose loop | characters | Order-safe: levels feed an aggregate; dispose touches all |
| `game.ts` boss-summon finalizer | `bossSummonsPending` | Order-safe: a count |
| `announcements/index.ts` | characters | Order-safe: a membership check |
| `index.ts` `getOptions` | characters | Order-safe: rebuilds the same map |
| `shared/baseClass.ts` | option copying | Order-safe: copies every key |
| `creatures/edit.ts`, `helpers/choices.ts` | a creature's options | Admin `edit` menu only: the order of the prompt changes, nothing player-facing |
| `monsters/helpers/spawn.ts` | names from the lookup | Order-safe: a name-taken check |
| `game.ts` `findCharacterByName` | characters, first name match | **Fixed:** characters in id order. Duplicate names are refused at creation (`characters/helpers/create.ts`), so only old data could hit it |
| `creatures/items.ts`, `beastmaster.ts` deck list | counts built at runtime | Order-safe: not saved objects |

The guard test (`state-roundtrip.test.ts`) also found two things that are not key order and
are left as they are:
- A first save omits empty defaults (`deck: []`, `items: []`), and restore fills them in.
- Restore sorts a character's deck by card name.

Neither changes after a `jsonb` round trip, so the test compares a settled save with its
re-sorted round trip.

The plan asked the guard test for a shop and ring refs too. They are left out: the shop's cards
and items are arrays, `ringContestantRefs` is an array, and `megaBossAt` is a number, so a key
re-sort cannot move them. The full-state comparison still covers them. The preset test asserts
the same `localeCompare` listing `look at presets` prints, and resolves differently cased names
through `resolvePresetKey`, the path `save`, `load` and `delete preset` use.

The one-time effect on existing rooms: `getAllMonstersLookup` and `findCharacterByName` now
walk characters in id order. So where two monsters, or two characters, already share a name
(only possible in old data, since both are refused at creation), the one a name finds may
change once, at deploy.

## Verification

**Before merging the expand PR:**

- `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm run build:docs`, and `pnpm docs:check`.
- A local end-to-end check with `supabase start` and the server
  ([local testing](../operations/local-testing.md)):
  - create a room;
  - play a fight;
  - make presets whose names sort differently by length and by alphabet;
  - restart the server;
  - check the presets still list alphabetically, the room restores, and
    `select jsonb_typeof(state), state_version from rooms` shows an object and a growing version.
- Load a room that has only a legacy `state_blob` (seed one from a decoded production-shaped
  fixture, never a real player's data in the repo). It restores, and the first save writes
  `state`.

**Production rollout (the runbook in task 5):**

1. Apply the migration (`supabase db push --linked`). It is additive, so the old release keeps
   working.
2. Deploy release 1.
3. Run the backfill script with `--dry-run`, then for real.
4. Run the read-only checks:
   - the unconverted/converted count above;
   - `select id, jsonb_typeof(state), pg_column_size(state), state_version from rooms;`
   - a spot check that `state->'options'->'characters'` has the expected number of keys per
     room.
5. Watch the metrics for the window: stale saves (expect roughly 0), save failures (expect 0),
   and source=blob loads (expect 0 after the backfill).

**Rollback, until task 6:** redeploy the previous release. It reads `state_blob`, which
release 1 keeps current, and it ignores the new columns. While rolled back, only `state_blob`
is written, so `state` goes stale. **Rolling forward again needs a short write drain** (Codex
review of #412). If the old release is still serving, it can write a newer blob between the
script's read and its write:

1. Stop the service (Railway: remove the deployment's replicas or pause the service), so no
   release is writing.
2. Run the backfill script with `--from-blob`. Its compare-and-swap on the exact blob read is a
   second guard, not a replacement for the drain.
3. Deploy release 1.

This is a minute or two of downtime, only in the rare case of rolling forward after a rollback.
The runbook in task 5 carries these steps.

## Docs to update in the same PRs

- [rooms and identity](../architecture/rooms-and-identity.md): the load, quarantine, and reset
  paths (lines about `rooms.state_blob`), plus the new "Querying room state" section.
- [engine concurrency and timing](../architecture/engine-concurrency-and-timing.md): the
  save-ordering guard next to the unload flush.
- [boss encounters](../architecture/boss-encounters.md): the "room's state blob" wording.
- [observability](../operations/observability.md): the new metrics.
- [deployment](../operations/deployment.md): the rollout runbook and the contract-release warning.
- [`README.md`](../../README.md): the connector note on `restoreGame` and saving, which accepts an
  object or a JSON string.
- `10b-bugs-fixed.md`: the out-of-order save race, as fixed, with its root cause, and the NUL
  save failure, as prevented.

## Later: step 2, normalized tables

Split characters, monsters and decks into their own tables only when a real need appears that
`jsonb` paths plus an index cannot meet. Examples: per-monster writes from several processes, or
queries across thousands of rooms on a hot path. It would turn the engine's one serialized game
into rows the server must keep consistent inside a transaction, and move identity rules
(`stableId`, ownership) into the schema. Analytics already has its own tables
(`fight_summaries`, `room_monster_stats`, `room_player_stats`). Prefer adding a projection there
over normalizing game state.
