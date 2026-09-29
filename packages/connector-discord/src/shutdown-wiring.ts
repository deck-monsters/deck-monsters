import { createShutdown, type ShutdownDeps } from '@deck-monsters/server/shutdown';

/**
 * The connector builds its own RoomManager on the same database and store as the server, so it
 * needs the same SIGTERM flush; without it every connector deploy dropped up to 30 s of
 * debounced changes in Discord rooms (roadmap 37). Order (close client, flush rooms, end pool)
 * is createShutdown's.
 */
export function installShutdown(
	deps: { bot: { stop(): Promise<unknown> } } & Omit<ShutdownDeps, 'server'>,
	proc: { on(signal: 'SIGTERM' | 'SIGINT', handler: () => void): unknown } = process
): (signal: string) => Promise<void> {
	const { bot, ...rest } = deps;
	const shutdown = createShutdown({ ...rest, server: { close: () => bot.stop() } });
	proc.on('SIGTERM', () => void shutdown('SIGTERM'));
	proc.on('SIGINT', () => void shutdown('SIGINT'));
	return shutdown;
}
