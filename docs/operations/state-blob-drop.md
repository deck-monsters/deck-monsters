---
type: Runbook
title: State Blob Drop (Step B)
description: The migration that drops the legacy room state blob column — why it was a separate deploy, its guard, the lock note and rollback.
status: stable
audience: internal
tags: [deployment, postgres, roadmap-37]
---
# Step B: dropping `rooms.state_blob`

Status: **shipped in #418** (live 2026-09-30 22:15 UTC; the column is gone in production). Step A (#417: no code references the column, and stale blobs
are cleared) went live on both services on 2026-09-30. A read-only check before this migration
was written found 7 rooms, all with `state` and none with a blob. Context:
[deployment runbook](deployment.md#room-state-migration-to-jsonb-roadmap-37).

The migration is `supabase/migrations/20260930150000_drop_state_blob.sql`. Its tests are the
`drop_state_blob guard` block in `packages/server/src/migrate.pg.test.ts`. The pg suites for
`state-store` and `room-manager` assert that the column is gone.

## Why it was a separate deploy

The pre-deploy runner applies migrations while the previous release is still serving. Release 2
still selected `state_blob`, set it to null on reset and quarantine, and Drizzle lists **every**
schema column in an `insert` (`... "state_blob", "quarantined_blob" ... values (default, default ...)`),
so even code that never mentions the column fails on `column "state_blob" does not exist` at
room load, room creation, reset and quarantine. Dropping it while release 2 served (or kept
serving after a failed healthcheck) would have been an outage, and the drop cannot be undone
without a backup. Step A removed the column from `schema.ts` and every query first. The same
order applies to any column removal here: stop writing, stop referencing, then drop.

## The guard

The migration raises `rooms still unconverted (state null, state_blob present)` if any room has
`state` null and a blob, because that blob is the room's only copy. The migration runs in one
transaction, so nothing changes. A reset room (state and blob both null) passes: nothing is
lost. If the guard trips, the room it names was never converted. Either convert it by hand
(`base64 -d | gunzip` of the blob into `rooms.state`; the engine's `restoreGame` accepts the
decoded JSON) or, if the room is disposable, reset it and then clear its blob with
`update rooms set state_blob = null where id = '<id>'`. Then retry the deploy.

`quarantined_blob` stays: it holds recovered copies for inspection.

## Lock note

`drop column` takes `ACCESS EXCLUSIVE` on `rooms`. It queues behind in-flight transactions there
(saves, the fight-summary writer) and, while queued, blocks every new `rooms` query for up to
the runner's 10 s `lock_timeout`. After that the migration rolls back cleanly, the deploy fails
and the previous release keeps serving. Retry the deploy; nothing was changed. The drop itself
is instant.

## Rollback

After the drop, a rollback to any release that references the column (release 2 or earlier)
breaks room load, create and reset. Going back means restoring the column and its contents from
a backup (Supabase daily backups), which also discards every room save since. Roll **forward**.
