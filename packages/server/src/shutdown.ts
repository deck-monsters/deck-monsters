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
	totalBudgetMs?: number;
}

/** Under Railway's default 10 s SIGTERM grace period. */
export const SHUTDOWN_FLUSH_TIMEOUT_MS = 8000;
/** Whole-shutdown budget: the pool gets what the flush left, so we exit before SIGKILL. */
export const SHUTDOWN_TOTAL_BUDGET_MS = 9500;

export function createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
	const { server, roomManager, pool, log, exit = process.exit, flushTimeoutMs = SHUTDOWN_FLUSH_TIMEOUT_MS, totalBudgetMs = SHUTDOWN_TOTAL_BUDGET_MS } = deps;
	let started = false;
	return async (signal: string) => {
		if (started) return; // ignore repeated signals
		started = true;
		const startedAt = Date.now();
		log.info('shutting down', { signal });
		// Each step is best-effort: a failure must not skip the flush or the exit.
		await server.close().catch((err: unknown) => log.error('server close failed', { err }));
		await roomManager.flushAll(flushTimeoutMs).catch((err: unknown) => log.error('flushAll failed', { err }));
		// pg-pool's end() waits for every checked-out client, and a write abandoned at the flush
		// deadline may still hold one; bound it by the remaining budget and exit either way.
		const remaining = Math.max(0, totalBudgetMs - (Date.now() - startedAt));
		let timer: NodeJS.Timeout | undefined;
		const timedOut = await Promise.race([
			pool.end().then(() => false, (err: unknown) => { log.error('pool end failed', { err }); return false; }),
			new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(true), remaining); }),
		]);
		clearTimeout(timer);
		if (timedOut) log.error('pool end timed out; exiting anyway', { remainingMs: remaining });
		exit(0);
	};
}
