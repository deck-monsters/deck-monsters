/**
 * Graceful shutdown (roadmap 37 task 4b). Without it a deploy dropped up to 30 s of debounced
 * changes in every active room. Order matters: stop new work, save every room, then close the
 * pool the saves need, then exit.
 */
export interface ShutdownDeps {
	server: { close(): Promise<unknown> };
	roomManager: { flushAll(timeoutMs: number): Promise<unknown> };
	pool: { end(): Promise<unknown> };
	log: { info(msg: string, ctx?: object): void; error(msg: string, ctx?: object): void };
	exit?: (code: number) => void;
	flushTimeoutMs?: number;
}

/** Under Railway's default 10 s SIGTERM grace period. */
export const SHUTDOWN_FLUSH_TIMEOUT_MS = 8000;

export function createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
	const { server, roomManager, pool, log, exit = process.exit, flushTimeoutMs = SHUTDOWN_FLUSH_TIMEOUT_MS } = deps;
	let started = false;
	return async (signal: string) => {
		if (started) return; // ignore repeated signals
		started = true;
		log.info('shutting down', { signal });
		// Each step is best-effort: a failure must not skip the flush or the exit.
		await server.close().catch((err: unknown) => log.error('server close failed', { err }));
		await roomManager.flushAll(flushTimeoutMs).catch((err: unknown) => log.error('flushAll failed', { err }));
		await pool.end().catch((err: unknown) => log.error('pool end failed', { err }));
		exit(0);
	};
}
