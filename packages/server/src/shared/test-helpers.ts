/**
 * Re-exports engine testing helpers so server integration tests stay aligned
 * with the canonical implementations in `@deck-monsters/engine`.
 */
export {
	noopStateStore,
	createTestGame,
	createTestChannel,
	createAutoResponder,
	runCommand,
} from '@deck-monsters/engine';

export type { ChannelMessage, TestChannel, AutoResponder } from '@deck-monsters/engine';
