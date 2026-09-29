import type { EventEmitter } from 'node:events';

import { createLogger, type Logger } from '../logger.js';
import { dbIdleClientErrors } from '../metrics/index.js';

const log = createLogger('db');

/**
 * Keep a dropped idle connection from killing the process.
 *
 * `pg-pool` re-emits an error from an idle client (one sitting in the pool between queries) as
 * an `'error'` event on the pool, and Node throws an `'error'` event nobody listens to. The
 * Supabase pooler closes idle connections, so without a listener the server crashed with
 * "Connection terminated unexpectedly" whenever one was dropped, mid-fight or not (production,
 * 2026-09-29: a fight in Game Night was lost with the process). With a listener the pool
 * discards the dead client and opens a new one on the next query; nothing else needs doing.
 */
export function handleIdleClientErrors(pool: EventEmitter, logger: Pick<Logger, 'warn'> = log): void {
	pool.on('error', (err: unknown) => {
		dbIdleClientErrors.inc();
		logger.warn('idle database connection dropped; the pool will replace it', {
			err: err instanceof Error ? err.message : String(err),
		});
	});
}
