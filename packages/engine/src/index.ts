import zlib from 'node:zlib';

import { hydrateCharacter } from './characters/index.js';
import { gameStateSchema } from './schemas/state.js';
import Game from './game.js';
import type { ChannelCallback } from './channel/index.js';
import { ConnectorAdapter } from './channel/index.js';
import { RoomEventBus } from './events/index.js';
import type { GameEvent, EventType, EventScope, EventSubscriber, EventsSinceResult } from './events/index.js';

export { Game, ConnectorAdapter, RoomEventBus };
export type { GameAnalyticsCallbacks, LeaderboardSortKey } from './game.js';
export type { ChannelCallback, GameEvent, EventType, EventScope, EventSubscriber, EventsSinceResult };
export type { StateStore } from './types/state-store.js';
export { engineReady, getHydratorStatus } from './helpers/engine-ready.js';
export { COMMAND_CATALOG } from './commands/catalog.js';
export type { CommandEntry, CommandCategory } from './commands/catalog.js';

/** Test harness and integration helpers (no Slack/HTTP/DB). */
export * from './testing/index.js';

/** Seeded ring contestants for simulations (used by @deck-monsters/harness). */
export { randomContestant } from './helpers/bosses.js';
export type { RandomContestantOptions } from './helpers/bosses.js';
export { createKeyedPromiseQueue } from './helpers/room-engine-queue.js';

export const getOptions = (gameJSON: string | Record<string, unknown>): Record<string, unknown> => {
	let gameObj: Record<string, unknown>;

	if (typeof gameJSON === 'string') {
		try {
			gameObj = JSON.parse(gameJSON) as Record<string, unknown>;
		} catch {
			gameObj = JSON.parse(
				zlib.gunzipSync(Buffer.from(gameJSON, 'base64')).toString()
			) as Record<string, unknown>;
		}
	} else {
		gameObj = Object.assign({}, gameJSON);
	}

	const parsedState = gameStateSchema.safeParse(gameObj);

	if (!parsedState.success) {
		throw new Error('Invalid game state payload');
	}

	gameObj = parsedState.data as Record<string, unknown>;

	const options: Record<string, unknown> = Object.assign(
		{ characters: {} },
		(gameObj as any).options
	);

	const rawCharacters = options.characters as Record<string, unknown>;
	options.characters = Object.entries(rawCharacters).reduce(
		(characters: Record<string, unknown>, [id, character]) => {
			try {
				characters[id] = hydrateCharacter(character as any);
			} catch (err) {
				// Skip one bad character rather than losing the entire game state.
				// The bad data is already quarantined at the RoomManager layer.
			}

			return characters;
		},
		{}
	);

	return options;
};

export const restoreGame = (
	gameJSON: string | Record<string, unknown>,
	log?: (err: unknown) => void
): Game => {
	const options = getOptions(gameJSON);

	return new Game(options, log);
};

export const resetGame = (
	game: Game,
	gameJSON: string | Record<string, unknown>
): void => {
	const options = getOptions(gameJSON);

	if (options) {
		game.reset(options);
	}
};
