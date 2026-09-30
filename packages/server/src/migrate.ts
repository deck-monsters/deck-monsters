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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { handleIdleClientErrors } from './db/pool-errors.js';
import { createLogger, type Logger } from './logger.js';

/** Fixed advisory-lock key shared by every deploy. Any constant works; it only has to never change. */
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
	/** Max wait for the advisory lock or any table lock, per migration transaction. Default 10 s. */
	lockTimeoutMs?: number;
	/** Max run time of any one statement, per migration transaction. Default 120 s. */
	statementTimeoutMs?: number;
}

const DEFAULT_LOCK_TIMEOUT_MS = 10_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 120_000;
const CONNECTION_TIMEOUT_MS = 15_000;

function envMs(name: string, fallback: number): number {
	const n = Number(process.env[name]);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Default migrations directory, resolved from this file (dist/ or src/, both three levels below
 * the repo root and /app in the image) so it does not depend on the working directory. Falls back
 * to `supabase/migrations` under the working directory.
 */
export function defaultMigrationsDir(): string {
	const fromFile = fileURLToPath(new URL('../../../supabase/migrations', import.meta.url));
	return existsSync(fromFile) ? fromFile : path.resolve('supabase/migrations');
}

const FORBIDDEN = ['begin', 'commit', 'rollback', 'start transaction', 'savepoint', 'concurrently'];

/** SQL with comments, quoted strings/identifiers and dollar-quoted bodies blanked out. */
export function stripSqlNoise(sql: string): string {
	let out = '';
	let i = 0;
	while (i < sql.length) {
		const rest = sql.slice(i);
		let m: RegExpExecArray | null;
		if (rest.startsWith('--')) {
			const end = sql.indexOf('\n', i);
			i = end === -1 ? sql.length : end;
		} else if (rest.startsWith('/*')) {
			// Block comments nest in Postgres.
			let depth = 0;
			let j = i;
			do {
				if (sql.startsWith('/*', j)) { depth++; j += 2; }
				else if (sql.startsWith('*/', j)) { depth--; j += 2; }
				else j++;
			} while (depth > 0 && j < sql.length);
			i = j;
			out += ' ';
		} else if (rest[0] === "'" || rest[0] === '"') {
			const q = rest[0];
			let j = i + 1;
			while (j < sql.length) {
				if (sql[j] === q) {
					if (sql[j + 1] === q) { j += 2; continue; }
					break;
				}
				j++;
			}
			i = j + 1;
			out += ' ';
		} else if ((m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest))) {
			const end = sql.indexOf(m[0], i + m[0].length);
			i = end === -1 ? sql.length : end + m[0].length;
			out += ' ';
		} else {
			out += sql[i];
			i++;
		}
	}
	return out;
}

/** The first forbidden transaction-control keyword outside comments/strings/bodies, or null. */
export function findForbiddenKeyword(sql: string): string | null {
	const text = stripSqlNoise(sql).toLowerCase().replace(/\s+/g, ' ');
	let best: { kw: string; at: number } | null = null;
	for (const kw of FORBIDDEN) {
		const m = new RegExp(`(^|[^a-z0-9_])${kw}([^a-z0-9_]|$)`).exec(text);
		if (m && (!best || m.index < best.at)) best = { kw, at: m.index };
	}
	return best ? best.kw : null;
}

function describeError(err: unknown): Record<string, unknown> {
	const e = err as { message?: string; code?: string; position?: string; detail?: string; hint?: string };
	return {
		error: err instanceof Error ? err.message : String(err),
		...(e.code ? { code: e.code } : {}),
		...(e.position ? { position: e.position } : {}),
		...(e.detail ? { detail: e.detail } : {}),
		...(e.hint ? { hint: e.hint } : {}),
	};
}

/** `20260101000000_initial.sql` -> { version: '20260101000000', name: 'initial' }; null if not a migration file. */
export function parseMigrationFilename(filename: string): MigrationFile | null {
	const match = /^(\d+)_(.+)\.sql$/.exec(filename);
	if (!match) return null;
	return { version: match[1]!, name: match[2]!, filename };
}

/** Migration files in a directory, ordered by filename (i.e. by version). */
export function listMigrationFiles(dir: string): MigrationFile[] {
	const files = readdirSync(dir)
		.filter((f) => f.endsWith('.sql'))
		.sort()
		.map((f) => parseMigrationFilename(f))
		.filter((m): m is MigrationFile => m !== null);
	// A name match counts as "applied" (hand-applied migrations), so two files sharing a name
	// would silently hide one of them.
	const seen = new Map<string, string>();
	for (const f of files) {
		const other = seen.get(f.name);
		if (other) throw new Error(`Duplicate migration name "${f.name}": ${other} and ${f.filename}`);
		seen.set(f.name, f.filename);
	}
	return files;
}

async function ensureHistoryTable(pool: pg.Pool): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('select pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
		// Only create when missing: never alter Supabase's own table, and avoid needing
		// create-schema privileges when it already exists.
		const exists = await client.query<{ missing: boolean }>(
			`select to_regclass('supabase_migrations.schema_migrations') is null as missing`
		);
		if (exists.rows[0]!.missing) {
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
	const dir = path.resolve(options.dir ?? process.env['MIGRATIONS_DIR'] ?? defaultMigrationsDir());
	const lockMs = options.lockTimeoutMs ?? envMs('MIGRATE_LOCK_TIMEOUT_MS', DEFAULT_LOCK_TIMEOUT_MS);
	const stmtMs = options.statementTimeoutMs ?? envMs('MIGRATE_STATEMENT_TIMEOUT_MS', DEFAULT_STATEMENT_TIMEOUT_MS);
	const ownPool = !options.pool;
	const connectionString = options.connectionString ?? process.env['DATABASE_URL'];
	if (ownPool && !connectionString) throw new Error('DATABASE_URL environment variable is required');
	const pool = options.pool ?? new pg.Pool({ connectionString, connectionTimeoutMillis: CONNECTION_TIMEOUT_MS });
	// A dropped idle connection must not crash the run as an unhandled 'error' event.
	if (ownPool) handleIdleClientErrors(pool, log);
	const report: MigrationReport = { applied: [], skipped: [], ok: true };

	try {
		const files = listMigrationFiles(dir);
		await ensureHistoryTable(pool);

		const recorded = await pool.query<{ version: string; name: string | null }>(
			'select version, name from supabase_migrations.schema_migrations'
		);
		const isRecorded = (f: MigrationFile) =>
			recorded.rows.some((r) => r.version === f.version || r.name === f.name);
		log.info(`migrate: ${files.length} files in ${dir}, ${recorded.rows.length} recorded`);

		// Refuse files that manage their own transaction BEFORE touching anything: a COMMIT inside
		// the file would end the runner's transaction (and its lock) early, leaving a partial apply.
		for (const file of files.filter((f) => !isRecorded(f))) {
			const kw = findForbiddenKeyword(readFileSync(path.join(dir, file.filename), 'utf8'));
			if (kw) {
				throw new Error(
					`${file.filename} contains "${kw}"; the runner wraps each file in its own transaction, so migrations must not use begin/commit/rollback/start transaction/savepoint/concurrently`
				);
			}
		}

		for (const file of files) {
			const client = await pool.connect();
			try {
				await client.query('BEGIN');
				// SET LOCAL is transaction-scoped, so it is safe through the transaction-mode pooler.
				await client.query(`set local lock_timeout = ${Math.floor(lockMs)}`);
				await client.query(`set local statement_timeout = ${Math.floor(stmtMs)}`);
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
				log.error('migration failed; rolled back', { file: file.filename, ...describeError(err) });
				report.failed = { filename: file.filename, error: message };
				report.ok = false;
				break;
			} finally {
				client.release();
			}
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('migration run failed', describeError(err));
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
