---
type: Roadmap
title: Room state close-out and open bugs
description: Pass plan to finish roadmap 37 (stop the dual-write, query views, drop the blob) and fix open bug items G, H and I.
status: draft
audience: internal
tags: [roadmap, pass, database, ci, harness]
---
# 40 — Room state close-out and open bugs

**Status:** In progress (2026-09-30). Owner: "Do the 37 close out and bug fixes and then let's
tackle 39 next."

## Tasks

| # | Task | Area / files | Can run beside | Status | Commit |
|---|---|---|---|---|---|
| 1 | **Roadmap 37 task 6, release 2:** stop writing `state_blob`, load from `state` only, drop the blob quarantine and the server's legacy-blob builder. The column stays until task 5 | Server: `state-store.ts`, `room-manager.ts`, `db/schema.ts`; tests | 2, 3 | Done. Review found a blocker: a blob-only room loaded as a fresh game, and its first save lost the room. Release 2 therefore keeps a **read-only** blob fallback (the room converts on its next save), a reset still keeps the blob in `quarantined_blob`, `--from-blob` is removed, and the leaderboard backfill reads `state` only. Server 308 passing with Postgres | 40254ac2, d177d7d9 |
| 2 | **Roadmap 37 task 7:** read-only query views, the `card_types` table, and a test that fails when a registered card is missing | A migration; a server test; `rooms-and-identity.md` | 1, 3 | Done. Review fixes: cards join monsters on `(room_id, owner_user_id, monster_index)`, because `stable_id` is missing for a monster nothing has read yet; the exposure test grants Supabase-style default privileges so a missing revoke fails it; numeric casts are guarded | 3005521b, 7f74d621 |
| 3 | **Item I:** find and fix the simulation memory leak | Harness `simulate.ts`, engine | 1, 2 | Planned | |
| 4 | **Item G:** a reset reaches every process's copy of the room (a generation in the save guard) | Server: `state-store.ts`, `room-manager.ts`, a migration | after 1 | Planned | |
| 5 | **Item H:** real-Postgres tests run in CI | `.github/workflows/ci.yml` | any | Done: bug 206. Checked by running the CI steps on a fresh local database (13 migrations applied, server 312 passing with no pg suite skipped) | (this commit) |
| 7 | **Save crash (found in this pass):** a restored room's refilled deck could hold a card whose options pointed back at the deck, so the next save threw "circular structure" from a timer and killed the server (production, 2026-09-24). Fix the draw options, stop two cards keeping foreign options, and keep a save failure from crashing the process | Engine: `characters/helpers/hydrate.ts`, `cards/ecdysis.ts`, `game.ts`; tests | 1, 2 | Done: bug 207. The server counter for `game.persistState` rides with task 4 (same file) | 0de59968, 9ca4193c |
| 6 | **Roadmap 37 task 6, the drop:** a migration drops `state_blob` | Migration, Drizzle, docs | A separate PR after task 1 is deployed. It also removes the read-only fallback, and the migration refuses to run while any room has `state` null and a blob | Planned | |

## Decisions

- **The window is shortened.** The owner asked to close roadmap 37 out on 2026-09-30, a day
  after the expand release; plan 37 allowed "a shorter window if nothing looks wrong".
  Production then had 5 of 7 rooms on `state`, with nothing quarantined.
- **The two blob-only rooms convert by being opened.** They are Test Room A and B, idle since
  2026-09-28. A load does not save, but the idle unload flushes the room, and that write fills
  `state`. Cursor uses those rooms, so the owner asks it to open each one; no hand-written
  production write is needed.
- **Stop writing and drop are two deploys.** The migration runner applies migrations before
  the new release takes traffic, while the old release still serves. A release that dropped
  `state_blob` would fail the old release's last saves, including its shutdown flush. So
  release 2 stops using the column, and the drop ships after it is live.
- **The save crash was found by the views task.** Its test seeds hit a circular-structure error
  that matched a real crash in the production logs (2026-09-24 13:18 UTC; the server restarted).
  No saved room holds a bad card, because every save that met one threw; so the fix needs no data
  repair.
