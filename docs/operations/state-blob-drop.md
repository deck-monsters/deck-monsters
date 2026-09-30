---
type: Runbook
title: State Blob Drop (Step B)
description: The staged, not-yet-shipped migration that drops rooms.state_blob, with its guard, tests, lock note and rollback.
status: draft
audience: internal
tags: [deployment, postgres, roadmap-37]
---
# Step B: dropping `rooms.state_blob` (ready to ship)

Status: **not shipped.** Step A (the code no longer references the column) ships first. This is
the second half of the roadmap 37 contract, kept here as a complete, tested-once change so it
is one copy-paste when step A is live. Context: [deployment runbook](deployment.md#room-state-migration-to-jsonb-roadmap-37).

## Why it is a separate deploy

The pre-deploy runner applies migrations while the previous release is still serving. Release 2
still selects `state_blob`, sets it to null on reset and quarantine, and Drizzle lists **every**
schema column in an `insert` (`... "state_blob", "quarantined_blob" ... values (default, default ...)`),
so even code that never mentions the column fails on `column "state_blob" does not exist` at
room load, room creation, reset and quarantine. Dropping it while release 2 serves (or keeps
serving after a failed healthcheck) is an outage, and the drop cannot be undone without a
backup. Step A removes the column from `schema.ts` and every query; only then is the drop safe.

## When to ship

Only after **both** services (server and Discord connector) run the step-A release and no
`stateBlob` reference remains in `packages/server/src/db/schema.ts`. Pre-ship check, must
return no rows:

```sql
select id from rooms where state is null and state_blob is not null;
```

## Migration

Add as `supabase/migrations/20260930140000_drop_state_blob.sql` (or any timestamp after the
latest file), and raise the hard-coded migration counts in `migrate.test.ts` and
`migrate.pg.test.ts` by one:

```sql
-- Roadmap 37 contract: drop rooms.state_blob.
--
-- Release 2 stopped writing state_blob and kept only a read-only load fallback, so the column is
-- now stale for every converted room. A room with `state` null and a blob present has its ONLY
-- copy in the blob; dropping the column would lose it. The guard refuses the drop in that case
-- (the migration runs in one transaction, so nothing is changed). Every production room already
-- has `state`, so this passes there.
--
-- quarantined_blob stays: it holds recovered copies for inspection.
--
-- Rollback: a release before release 2 reads and writes state_blob, so it cannot run against
-- this schema. Restoring the column requires a backup (docs/operations/deployment.md).

do $$
begin
  if exists (select 1 from rooms where state is null and state_blob is not null) then
    raise exception 'rooms still unconverted (state null, state_blob present): convert or reset them first; see "The drop" in docs/operations/deployment.md';
  end if;
end $$;

alter table rooms drop column if exists state_blob;
```

A reset room (state and blob both null) passes the guard by design: nothing is lost.

Lock note: `drop column` takes `ACCESS EXCLUSIVE` on `rooms`. It queues behind in-flight
transactions there (saves, the fight-summary writer) and, while queued, blocks every new
`rooms` query for up to the runner's 10 s `lock_timeout`. After that the migration rolls back
cleanly, the deploy fails and the previous release keeps serving. Retry the deploy; nothing was
changed. The drop itself is instant.

## Tests to restore

Add to `packages/server/src/migrate.pg.test.ts` (it needs `readFileSync` in the `node:fs`
import), inside `suite('runMigrations against Postgres', ...)`, before the "rolls back a
failing migration" test:

```ts
	describe('drop_state_blob guard (roadmap 37 contract)', () => {
		const DROP = '20260930140000_drop_state_blob.sql';
		const hasBlobColumn = () =>
			withDb(async (p) => {
				const r = await p.query(
					`select 1 from information_schema.columns where table_name = 'rooms' and column_name = 'state_blob'`
				);
				return r.rowCount === 1;
			});

		async function migrateAllButDrop(): Promise<string> {
			await stubSupabase();
			const all = readdirSync(repoMigrations).filter((f) => f.endsWith('.sql')).sort();
			expect(all).to.include(DROP);
			const before = Object.fromEntries(
				all.filter((f) => f !== DROP).map((f) => [f, readFileSync(path.join(repoMigrations, f), 'utf8')])
			);
			const report = await runMigrations({ connectionString: dbUrl, dir: tempDir(before), log: quiet });
			expect(report.ok).to.equal(true);
			return DROP;
		}

		async function insertRoom(cols: string, vals: string): Promise<void> {
			await withDb(async (p) => {
				await p.query(`insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001')`);
				await p.query(`insert into profiles (id, display_name) values ('00000000-0000-0000-0000-000000000001', 't') on conflict (id) do nothing`);
				await p.query(
					`insert into rooms (id, name, owner_id, invite_code, ${cols}) values ('00000000-0000-0000-0000-0000000000aa', 'r', '00000000-0000-0000-0000-000000000001', 'abcd1234', ${vals})`
				);
			});
		}

		it('refuses while a room has state null and a blob, leaving the column and the blob intact', async () => {
			await migrateAllButDrop();
			await insertRoom('state_blob', `'the-only-copy'`);

			const report = await runMigrations({ connectionString: dbUrl, dir: repoMigrations, log: quiet });
			expect(report.ok).to.equal(false);
			expect(report.failed?.filename).to.equal(DROP);
			expect(report.failed?.error).to.match(/rooms still unconverted/);
			expect(await hasBlobColumn()).to.equal(true);
			const r = await withDb((p) => p.query(`select state_blob from rooms`));
			expect(r.rows[0].state_blob).to.equal('the-only-copy');
		});

		it('drops the column when every room has state (a stale blob alongside it is fine)', async () => {
			await migrateAllButDrop();
			await insertRoom('state, state_blob', `'{"name":"Game","options":{}}'::jsonb, 'stale'`);

			const report = await runMigrations({ connectionString: dbUrl, dir: repoMigrations, log: quiet });
			expect(report.ok).to.equal(true);
			expect(report.applied).to.deep.equal([DROP]);
			expect(await hasBlobColumn()).to.equal(false);
		});

		it('passes when a room has both state and blob null (a new or reset room), and with no rooms at all', async () => {
			await migrateAllButDrop();
			// No rooms yet: the guard's exists() is false.
			const empty = await runMigrations({ connectionString: dbUrl, dir: repoMigrations, log: quiet });
			expect(empty.ok).to.equal(true);
			expect(await hasBlobColumn()).to.equal(false);
		});

		it('passes with a room whose state and blob are both null', async () => {
			await migrateAllButDrop();
			await insertRoom('state', 'null');
			const report = await runMigrations({ connectionString: dbUrl, dir: repoMigrations, log: quiet });
			expect(report.ok).to.equal(true);
			expect(await hasBlobColumn()).to.equal(false);
		});
	});
```

Also in `state-store.pg.test.ts`, replace the "state_blob is untouched" assertion with one that
checks `information_schema` has no `state_blob` column (the column is gone after this
migration), and remove any pg test that inserts into `state_blob`.

## Rollback

After the drop, a rollback to any release that references the column (release 2 or earlier)
breaks room load, create and reset. Going back means restoring the column and its contents from
a backup (Supabase daily backups), which also discards every room save since. Roll **forward**.
