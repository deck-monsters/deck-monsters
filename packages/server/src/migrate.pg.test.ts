import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';
import pg from 'pg';

import { createLogger } from './logger.js';
import { runMigrations } from './migrate.js';

// Real-Postgres check of the pre-deploy migration runner. Skipped unless TEST_DATABASE_URL is set.
// Each test gets a FRESH database on that server so the shared dev database is never touched.
const url = process.env['TEST_DATABASE_URL'];
const suite = url ? describe : describe.skip;

const repoMigrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
const quiet = createLogger('migrate-test');

function urlFor(db: string): string {
	const u = new URL(url!);
	u.pathname = `/${db}`;
	return u.toString();
}

// Supabase-provided pieces the repo's migrations lean on, absent from plain Postgres.
const SUPABASE_STUBS = `
	do $$ begin
		if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
		if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
		if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
	exception when duplicate_object then null; end $$;
	create schema auth;
	create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
	create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
	create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
`;

suite('runMigrations against Postgres', () => {
	let admin: pg.Pool;
	let dbName: string;
	let dbUrl: string;
	let tmp: string[] = [];

	before(() => {
		admin = new pg.Pool({ connectionString: url });
	});
	after(async () => {
		await admin.end();
	});

	beforeEach(async () => {
		dbName = `dm_migrate_test_${randomBytes(6).toString('hex')}`;
		await admin.query(`create database ${dbName}`);
		dbUrl = urlFor(dbName);
	});
	afterEach(async () => {
		await admin.query(`drop database if exists ${dbName} with (force)`);
		for (const d of tmp) rmSync(d, { recursive: true, force: true });
		tmp = [];
	});

	async function withDb<T>(fn: (p: pg.Pool) => Promise<T>): Promise<T> {
		const p = new pg.Pool({ connectionString: dbUrl });
		p.on('error', () => undefined);
		try {
			return await fn(p);
		} finally {
			await p.end();
		}
	}

	async function stubSupabase() {
		await withDb((p) => p.query(SUPABASE_STUBS));
	}

	function tempDir(files: Record<string, string>): string {
		const d = mkdtempSync(path.join(os.tmpdir(), 'dm-migrations-'));
		tmp.push(d);
		for (const [name, sql] of Object.entries(files)) writeFileSync(path.join(d, name), sql);
		return d;
	}

	it('applies all real repo migrations in order, records them, and a second run applies none', async () => {
		await stubSupabase();
		const files = readdirSync(repoMigrations).filter((f) => f.endsWith('.sql')).sort();
		expect(files).to.have.length(13);

		const first = await runMigrations({ connectionString: dbUrl, dir: repoMigrations, log: quiet });
		expect(first.ok).to.equal(true);
		expect(first.applied).to.deep.equal(files);

		const rows = await withDb((p) =>
			p.query('select version, name, statements from supabase_migrations.schema_migrations order by version')
		);
		expect(rows.rows.map((r) => `${r.version}_${r.name}.sql`)).to.deep.equal(files);
		expect(rows.rows[0].statements).to.have.length(1);

		const second = await runMigrations({ connectionString: dbUrl, dir: repoMigrations, log: quiet });
		expect(second.ok).to.equal(true);
		expect(second.applied).to.have.length(0);
		expect(second.skipped).to.deep.equal(files);
	});

	it('rolls back a failing migration, keeps the earlier one, and reports failure', async () => {
		const dir = tempDir({
			'20260101000000_good.sql': 'create table good_t (id int);',
			'20260102000000_bad.sql': 'create table half_t (id int); select * from does_not_exist;',
			'20260103000000_never.sql': 'create table never_t (id int);',
		});
		const report = await runMigrations({ connectionString: dbUrl, dir, log: quiet });
		expect(report.ok).to.equal(false);
		expect(report.applied).to.deep.equal(['20260101000000_good.sql']);
		expect(report.failed?.filename).to.equal('20260102000000_bad.sql');

		await withDb(async (p) => {
			const rec = await p.query('select version from supabase_migrations.schema_migrations order by version');
			expect(rec.rows.map((r) => r.version)).to.deep.equal(['20260101000000']);
			const tables = await p.query(
				`select table_name from information_schema.tables where table_schema = 'public' order by 1`
			);
			expect(tables.rows.map((r) => r.table_name)).to.deep.equal(['good_t']);
		});
	});

	it('skips a file whose name is recorded under a different version', async () => {
		await withDb(async (p) => {
			await p.query(`create schema supabase_migrations;
				create table supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);
				insert into supabase_migrations.schema_migrations (version, name) values ('20990101000000', 'hand_applied');`);
		});
		const dir = tempDir({
			// Would fail if run, since it references a missing table.
			'20260101000000_hand_applied.sql': 'select * from does_not_exist;',
			'20260102000000_next.sql': 'create table next_t (id int);',
		});
		const report = await runMigrations({ connectionString: dbUrl, dir, log: quiet });
		expect(report.ok).to.equal(true);
		expect(report.skipped).to.deep.equal(['20260101000000_hand_applied.sql']);
		expect(report.applied).to.deep.equal(['20260102000000_next.sql']);
	});

	it('applies each migration exactly once when two runs race', async () => {
		const dir = tempDir({
			// Not idempotent: a double apply would throw "already exists".
			'20260101000000_one.sql': 'create table one_t (id int); select pg_sleep(0.3);',
			'20260102000000_two.sql': 'create table two_t (id int);',
		});
		const [a, b] = await Promise.all([
			runMigrations({ connectionString: dbUrl, dir, log: quiet }),
			runMigrations({ connectionString: dbUrl, dir, log: quiet }),
		]);
		expect(a.ok).to.equal(true);
		expect(b.ok).to.equal(true);
		expect([...a.applied, ...b.applied].sort()).to.deep.equal([
			'20260101000000_one.sql',
			'20260102000000_two.sql',
		]);
		const n = await withDb((p) => p.query('select count(*)::int as n from supabase_migrations.schema_migrations'));
		expect(n.rows[0].n).to.equal(2);
	});

	it('fails clearly within the lock timeout when a table lock is held elsewhere', async () => {
		await withDb((p) => p.query('create table locked_t (id int)'));
		const holder = new pg.Client({ connectionString: dbUrl });
		await holder.connect();
		try {
			await holder.query('begin');
			await holder.query('lock table locked_t in access exclusive mode');
			const dir = tempDir({ '20260101000000_alter.sql': 'alter table locked_t add column x int;' });
			const started = Date.now();
			const report = await runMigrations({ connectionString: dbUrl, dir, log: quiet, lockTimeoutMs: 500 });
			expect(Date.now() - started).to.be.lessThan(8000);
			expect(report.ok).to.equal(false);
			expect(report.failed?.filename).to.equal('20260101000000_alter.sql');
			expect(report.failed?.error).to.match(/lock timeout/);
		} finally {
			await holder.query('rollback').catch(() => undefined);
			await holder.end();
		}
	});

	it('refuses a pending file that manages its own transaction, before applying anything', async () => {
		const dir = tempDir({
			'20260101000000_ok.sql': 'create table ok_t (id int);',
			'20260102000000_tx.sql': 'begin; create table tx_t (id int); commit;',
		});
		const report = await runMigrations({ connectionString: dbUrl, dir, log: quiet });
		expect(report.ok).to.equal(false);
		expect(report.applied).to.have.length(0);
		expect(report.failed?.error).to.match(/20260102000000_tx\.sql contains "begin".*own transaction/);
	});

	it('returns a failed report, not a hang, for an unreachable host', async () => {
		const dir = tempDir({ '20260101000000_a.sql': 'select 1;' });
		const report = await runMigrations({
			connectionString: 'postgres://x@127.0.0.1:1/db',
			dir,
			log: quiet,
		});
		expect(report.ok).to.equal(false);
		expect(report.failed?.filename).to.equal('(setup)');
	});
});
