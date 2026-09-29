---
type: Roadmap
title: Room state as Postgres jsonb
description: Plan to replace the gzip and base64 room state blob with a queryable jsonb column, covering key order, NUL bytes, ordered saves, a reversible dual-write rollout, a backfill script, and read-only query views.
status: draft
audience: internal
tags: [roadmap, database, persistence, server, engine]
---
# 37 — Room state as Postgres `jsonb`

**Status:** Planned (2026-09-29). Ready to pick up once PR #412 (roadmap 36) merges. Nothing is
built yet. Read [rooms and identity](../architecture/rooms-and-identity.md) and
[engine concurrency and timing](../architecture/engine-concurrency-and-timing.md) first. Every
query here stays scoped to one room, and saves are part of the timing contract.

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
- **Save order comes from a version column,** not from locks. It is a monotonically increasing
  `state_version`, and the update only lands if it is newer. Details are in task 4.
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
   bytewise. The engine reads some saved objects in key order:
   - `BeastmasterCharacter.getMonsterPresets` (`characters/beastmaster.ts`) lists a monster's
     presets with `Object.entries(presets)`. Presets would come back sorted by name length, not
     in the order the player made them. This is visible in the Workshop.
   - `lookAtCharacterRankings` and `lookAtMonsterRankings` (`game.ts`) fall back to ranking
     `Object.values(characters)` when analytics is absent. Ties would break differently.
   - Other iteration over `characters`, `bossSummons`, and `shop` needs checking in the audit.
   Arrays keep their order, so decks, cards, items and monsters are safe.
2. **The NUL character.** `jsonb` rejects the escaped `\u0000` in a string, and the whole save
   fails. A monster or character name typed with a NUL (a paste, a connector bug) would silently
   stop the room saving, because the save is fire-and-forget. The text column accepts it today.
3. **Out-of-order saves** (above). This is not new, but the rewrite is the time to close it.
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
  - builds `const state = toSerializedGame(this)`, which is `JSON.parse(JSON.stringify(this,
    stripNul))`;
  - passes `state` to the store;
  - passes `JSON.stringify(state)` to `stateSaveFunc`. This is plain JSON, not gzip, and
    `restoreGame` already reads it. The setter's type stays `(state: string) => void`.
  - `zlib` leaves the save path. It stays in `getOptions` for legacy input.
- **`stripNul`** is a `JSON.stringify` replacer. It removes `\u0000` from every string value and
  key, then counts and logs once per save with the room id. A test proves a name containing NUL
  saves, restores without the NUL, and logs. Names are free text elsewhere, so this is a repair,
  not a validation error.
- **Key-order independence (task 1).** Anything shown to a player, or anything that decides an
  outcome, must not depend on object key order after a round trip through sorted keys.
  - **Presets.** Keep the object (it is the admin `edit character` shape) and add
    `presetOrder: string[]`, maintained on create, rename and delete. `getMonsterPresets` returns
    entries in `presetOrder` order, with any key missing from it appended in `localeCompare` order.
    Old saves with no `presetOrder` must get one from their original key order *before* any
    `jsonb` round trip loses it. Two places do this, and both read the decoded blob, where
    `JSON.parse` keeps insertion order:
    - the engine, when it restores a room from `state_blob`;
    - the backfill script (task 5), for rooms it converts without loading them.
    A room that reaches `state` without `presetOrder` gets its presets in sorted order. That is
    tolerable, but the two seeding points should make it not happen.
  - **Rankings fallback.** Break ties by name, then by id.
  - **The audit.** Grep `Object.keys|values|entries` and `for…in` over everything reachable from
    saved `options`. Record each hit in this plan as order-safe (with the reason) or fixed.
  - **The guard test.** Build a game with several characters, presets made in a non-sorted order,
    a boss-summon ledger, a shop, and ring refs. Serialize it, re-sort every object's keys the way
    `jsonb` does (length, then bytewise), restore, and assert:
    - the Workshop preset list;
    - rankings;
    - the shop listing;
    - `JSON.stringify` of the restored game, compared with keys sorted on both sides.

### Server (task 4)

- **`PostgresStateStore`:**
  - It holds `version`, loaded with the row, and every save increments it before writing.
  - `save(roomId, state)`:

    ```sql
    update rooms
       set state = $state, state_version = $v, updated_at = now()
           -- release 1 only:
           , state_blob = $legacyBlob
     where id = $roomId and state_version < $v
    ```

    `$legacyBlob` is `base64(gzip(JSON.stringify(state)))`. It is built in the server, not the
    engine, and deleted by task 6.
  - If no row updates, the save was stale. Count it in `room_state_saves_stale_total` and do not
    retry. A newer save has already landed.
  - The store is created per room load, so the version starts from the loaded row. The server runs
    a single instance. If it ever runs several, this guard still refuses a stale write from another
    process, which becomes a stale-save count.
- **`_loadRoom`:**
  - It selects `state, state_version, state_blob`, and prefers `state`, falling back to
    `state_blob`.
  - It passes the version into the store.
  - Quarantine moves whichever column was the source into its quarantine column
    (`quarantined_state` or `quarantined_blob`), and nulls both live columns.
- **`resetRoomState`:** the same, and it resets `state_version` to 0.
- **`backfill-leaderboard-from-state.ts`:** read `state ?? state_blob`.
- **Metrics** (`packages/server/src/metrics.ts`, and add them to [observability](../operations/observability.md)):
  - `room_state_save_bytes` (histogram, from `Buffer.byteLength(JSON.stringify(state))`);
  - `room_state_save_failures_total`;
  - `room_state_saves_stale_total`;
  - `room_state_source_total{source="state"|"blob"}` on load, to watch the backfill finish.
  Every label is a room id or a source, never user data.
- **Room scope.** Every statement keeps `where id = $roomId`. No app code queries across rooms.
  The cross-room queries in task 7 are read-only operator tooling.

### Backfill (task 5)

A one-off script, `packages/server/scripts/migrate-room-state-to-jsonb.ts`, run with
`DATABASE_URL=… pnpm exec tsx`:

1. Select `id` from `rooms` where `state is null and state_blob is not null`.
2. For each room, decode the blob (gunzip+base64, or a plain JSON string) **without** calling
   `restoreGame`, so the stored content is what was saved, apart from the two repairs in
   step 3.
3. Strip NUL characters the same way the engine does, and seed `presetOrder` on every monster
   that lacks one, from the decoded object's key order (task 1). Both repairs come from one
   engine export (`repairSerializedGame`), so the script and the engine cannot drift apart.
4. Write it with this guard:

   ```sql
   update rooms
      set state = $s, state_version = greatest(state_version, 1)
    where id = $id and state is null
   ```

   The guard means that if the server saved the room meanwhile (it now writes `state` too), the
   script skips it.
5. A blob that will not decode is **not** quarantined by the script. It is reported, and it is
   left for the server's normal load path to quarantine.

- Flags: `--dry-run` (decode and report only), `--room <id>`, and `--from-blob`. The last
  converts rooms whose `state` is already set too, for the rollback case below, and sets
  `state_version = state_version + 1`.
- Output: counts of converted, already converted, empty, and failed rooms, with byte sizes.
- It is idempotent: a second run converts nothing.
- Run it after release 1 is live. Then check with:

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
| 1 | **Key-order independence.** Audit every key-order read of saved `options`. Add `presetOrder`, with first-load seeding. Break rankings ties. Add the sorted-keys round-trip guard test | Engine: `characters/beastmaster.ts`, `game.ts`, and any audit hits; a new `state-roundtrip.test.ts` | The guard test fails on `main` for presets, then passes. The audit table is in this plan | 3 | Planned | |
| 2 | **The engine serializes an object.** `SerializedGame`, the new `StateStore` signature, `persistState` without gzip, the `stripNul` replacer, and `saveState` handing out plain JSON | Engine: `game.ts`, `types/state-store.ts`, `index.ts` (exports); `game.test.ts` updated where it decodes saves | Engine tests pass. A NUL name saves and restores. `restoreGame` accepts an object, a JSON string, and a legacy blob (one test each) | 3 (after 1: both touch `game.ts`) | Planned | |
| 3 | **Schema.** The migration and the Drizzle columns | `supabase/migrations/`, `packages/server/src/db/schema.ts` | `supabase db reset` locally applies cleanly. Drizzle types compile | 1, 2 | Planned | |
| 4 | **Server store and load path.** Versioned dual-write, load preferring `state`, quarantine and reset for both columns, the leaderboard backfill script, and metrics | `packages/server/src/state-store.ts`, `room-manager.ts`, `metrics.ts`, `scripts/backfill-leaderboard-from-state.ts`; tests | Unit tests: prefer `state`, fall back to the blob, quarantine each source, and the stale-save guard (an older version does not overwrite). **Against local Postgres** (`supabase start`): a saved row's `jsonb_typeof(state) = 'object'`, not `'string'`, and a restart restores it. Server tests pass | none (after 2, 3) | Planned | |
| 5 | **The backfill script and runbook** | `packages/server/scripts/migrate-room-state-to-jsonb.ts`; [deployment](../operations/deployment.md) runbook section | A dry run and a real run on local data seeded with legacy blobs, including one corrupt blob, which is reported and not written. A second run converts 0 | 7 | Planned | |
| 6 | **Contract** (second PR, after the window). Stop dual-writing, drop the load fallback, back up, and drop `state_blob` | Server, migration, docs | Production shows `room_state_source_total{source="blob"}` at 0 for the whole window. A backup exists. Tests pass | — | Planned | |
| 7 | **Read-only query views** and the "Querying room state" doc section | A migration with the views; `rooms-and-identity.md` | The Faceswap query above returns the same answer as decoding by hand, on local data | 5 | Planned | |

## Verification

**Before merging the expand PR:**

- `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm run build:docs`, and `pnpm docs:check`.
- A local end-to-end check with `supabase start` and the server
  ([local testing](../operations/local-testing.md)):
  - create a room;
  - play a fight;
  - make two presets in a non-alphabetical order;
  - restart the server;
  - check the presets keep their order, the room restores, and
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
is written, so `state` goes stale. **Before redeploying release 1 after a rollback,** run the
backfill script with `--from-blob`. It rewrites `state` from `state_blob` for every room, and
bumps `state_version` past the stored value. During the dual-write window `state_blob` is the
fallback of record, so the flag is always safe. The runbook in task 5 carries this step.

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
