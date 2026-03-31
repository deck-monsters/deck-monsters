import zlib from 'node:zlib';

import { hydrateCharacter } from './characters/index.js';
import { gameStateSchema } from './schemas/state.js';
import Game from './game.js';
import type { ChannelCallback } from './channel/index.js';

export { Game };
export type { ChannelCallback };

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
			characters[id] = hydrateCharacter(character as any);

			return characters;
		},
		{}
	);

	return options;
};

export const restoreGame = (
	publicChannel: ChannelCallback,
	gameJSON: string | Record<string, unknown>,
	log?: (err: unknown) => void
): Game => {
	const options = getOptions(gameJSON);

	return new Game(publicChannel, options, log);
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
