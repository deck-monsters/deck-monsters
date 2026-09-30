/**
 * Entry point for Railway's pre-deploy command: `node packages/server/dist/migrate-cli.js`.
 *
 * Deliberately has no "am I the main module" check: an earlier design put that check in
 * migrate.ts, and any mismatch (symlink, wrapper) would have exited 0 having done nothing, so a
 * deploy would go green without migrating. This file always runs.
 */
import { createLogger } from './logger.js';
import { runMigrations } from './migrate.js';

const log = createLogger('migrate');

// Backstop: if some handle keeps the event loop alive after the run, still exit.
function exitSoon(code: number): void {
	process.exitCode = code;
	setTimeout(() => process.exit(code), 5000).unref();
}

log.info('migrate: starting');
runMigrations({ log }).then(
	(report) => exitSoon(report.ok ? 0 : 1),
	(err) => {
		log.error('migration run crashed', { error: err instanceof Error ? err.message : String(err) });
		exitSoon(1);
	}
);
