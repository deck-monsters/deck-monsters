/**
 * Applies pending `supabase/migrations/*.sql` files. Run by Railway as the server's pre-deploy
 * command (`node packages/server/dist/migrate.js`), so a release never goes live ahead of its
 * schema and a failed migration fails the deploy while the previous release keeps serving.
 *
 * Why it looks the way it does:
 * - Production once missed a migration for twelve days (the owner had to remember
 *   `supabase db push`), and a release needing new columns went live without them.
 * - The history table is Supabase's own `supabase_migrations.schema_migrations`, so
 *   `supabase db push` keeps working alongside this runner.
 * - Production connects through the Supabase pooler (port 6543, transaction mode), where a
 *   session-level advisory lock is not reliable across statements. So the lock is
 *   `pg_advisory_xact_lock` taken INSIDE each migration's transaction, and the version is
 *   re-checked after the lock is held.
 * - A file whose NAME is already recorded counts as applied: hand-applied migrations were once
 *   recorded under a different version, and re-running them would fail or duplicate work.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import pg from 'pg';

import { handleIdleClientErrors } from './db/pool-errors.js';
import { createLogger, type Logger } from './logger.js';

/** Fixed advisory-lock key ("dmmigrat" as ASCII) shared by every deploy. */
export const MIGRATION_LOCK_KEY = '6874242113213339508';

export interface MigrationFile {
	version: string;
	name: string;
	filename: string;
}

export interface MigrationReport {
	applied: string[];
	skipped: string[];
	failed?: { filename: string; error: string };
	ok: boolean;
}

export interface RunMigrationsOptions {
	pool?: pg.Pool;
	connectionString?: string;
	dir?: string;
	log?: Logger;
}

/** `20260101000000_initial.sql` -> { version: '20260101000000', name: 'initial' }; null if not a migration file. */
export function parseMigrationFilename(filename: string): MigrationFile | null {
	const match = /^(\d+)_(.+)\.sql$/.exec(filename);
	if (!match) return null;
	return { version: match[1]!, name: match[2]!, filename };
}

/** Migration files in a directory, ordered by filename (i.e. by version). */
export function listMigrationFiles(dir: string): MigrationFile[] {
	return readdirSync(dir)
		.filter((f) => f.endsWith('.sql'))
		.sort()
		.map((f) => parseMigrationFilename(f))
		.filter((m): m is MigrationFile => m !== null);
}

async function ensureHistoryTable(pool: pg.Pool): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('select pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
		// Only create when missing: never alter Supabase's own table, and avoid needing
		// create-schema privileges when it already exists.
		const exists = await client.query(
			`select 1 from information_schema.tables
			 where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'`
		);
		if (exists.rowCount === 0) {
			await client.query('create schema if not exists supabase_migrations');
			await client.query(
				`create table if not exists supabase_migrations.schema_migrations (
					version text not null primary key,
					name text,
					statements text[]
				)`
			);
		}
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK').catch(() => undefined);
		throw err;
	} finally {
		client.release();
	}
}

export async function runMigrations(options: RunMigrationsOptions = {}): Promise<MigrationReport> {
	const log = options.log ?? createLogger('migrate');
	const dir = path.resolve(options.dir ?? process.env['MIGRATIONS_DIR'] ?? 'supabase/migrations');
	const ownPool = !options.pool;
	const connectionString = options.connectionString ?? process.env['DATABASE_URL'];
	if (ownPool && !connectionString) throw new Error('DATABASE_URL environment variable is required');
	const pool = options.pool ?? new pg.Pool({ connectionString });
	// A dropped idle connection must not crash the run as an unhandled 'error' event.
	if (ownPool) handleIdleClientErrors(pool, log);
	const report: MigrationReport = { applied: [], skipped: [], ok: true };

	try {
		const files = listMigrationFiles(dir);
		await ensureHistoryTable(pool);

		for (const file of files) {
			const client = await pool.connect();
			try {
				await client.query('BEGIN');
				await client.query('select pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
				// Re-check under the lock: a concurrent deploy may have applied it while we waited.
				const seen = await client.query<{ version: string; name: string | null }>(
					'select version, name from supabase_migrations.schema_migrations where version = $1 or name = $2',
					[file.version, file.name]
				);
				const byVersion = seen.rows.find((r) => r.version === file.version);
				if (byVersion || seen.rows.length > 0) {
					await client.query('COMMIT');
					if (!byVersion) {
						log.warn('migration already recorded under a different version; skipping', {
							file: file.filename,
							recordedVersion: seen.rows[0]!.version,
						});
					} else {
						log.info('migration already applied; skipping', { file: file.filename });
					}
					report.skipped.push(file.filename);
					continue;
				}

				const sql = readFileSync(path.join(dir, file.filename), 'utf8');
				await client.query(sql);
				await client.query(
					'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3::text[])',
					[file.version, file.name, [sql]]
				);
				await client.query('COMMIT');
				log.info('migration applied', { file: file.filename });
				report.applied.push(file.filename);
			} catch (err) {
				await client.query('ROLLBACK').catch(() => undefined);
				const message = err instanceof Error ? err.message : String(err);
				log.error('migration failed; rolled back', { file: file.filename, error: message });
				report.failed = { filename: file.filename, error: message };
				report.ok = false;
				break;
			} finally {
				client.release();
			}
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('migration run failed', { error: message });
		report.ok = false;
		report.failed = report.failed ?? { filename: '(setup)', error: message };
	} finally {
		if (ownPool) await pool.end();
	}

	log.info('migration run finished', {
		ok: report.ok,
		applied: report.applied.length,
		skipped: report.skipped.length,
	});
	return report;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
	runMigrations().then(
		(report) => {
			process.exitCode = report.ok ? 0 : 1;
		},
		(err) => {
			createLogger('migrate').error('migration run crashed', { error: err instanceof Error ? err.message : String(err) });
			process.exitCode = 1;
		}
	);
}
