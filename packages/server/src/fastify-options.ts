/**
 * Fastify instance options shared by the production server bootstrap.
 *
 * Why `maxParamLength` is raised: tRPC's `httpBatchLink` encodes multiple
 * procedure names in a single path parameter
 * (`/trpc/room.info,game.ringHistory,...`). Fastify defaults to
 * `maxParamLength: 100`. The Terminal room mount fires 7 queries whose joined
 * path is ~114 characters, so Fastify returns its own 404 *before* the tRPC
 * plugin runs — console history, ring history, pending prompts, and myMonsters
 * all fail to load while the WebSocket subscription still connects. That
 * surfaced as "RECONNECTING…" / empty panes after room-load query count grew.
 *
 * Value matches the official `@trpc/server` Fastify adapter guidance.
 */
export const FASTIFY_MAX_PARAM_LENGTH = 5000;

export function createFastifyOptions(logLevel: string) {
	return {
		logger: { level: logLevel },
		routerOptions: { maxParamLength: FASTIFY_MAX_PARAM_LENGTH },
	} as const;
}
