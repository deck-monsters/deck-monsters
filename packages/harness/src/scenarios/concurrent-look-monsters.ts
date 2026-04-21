/**
 * Simulates two users sending `look at monsters` at the same time against one room.
 * When wrapped with `createRoomCommandRunner` (same pattern as production
 * `RoomManager.runSerializedEngineWork`), command chains do not interleave.
 */

import '../set-env.js';
import type { Game } from '@deck-monsters/engine';
import {
	createAutoResponder,
	createRoomCommandRunner,
	runCommand,
} from '@deck-monsters/engine';

const USER_A = 'harness-user-a';
const USER_B = 'harness-user-b';
const NEW_CHARACTER_ANSWERS = ['0', '0', '0'];

export async function runConcurrentLookMonsters(game: Game): Promise<void> {
	const roomId = game.roomId;
	const run = createRoomCommandRunner();

	const responderA = createAutoResponder(game.eventBus, USER_A, NEW_CHARACTER_ANSWERS);
	const responderB = createAutoResponder(game.eventBus, USER_B, NEW_CHARACTER_ANSWERS);

	try {
		await Promise.all([
			run(roomId, () =>
				runCommand(game, {
					command: 'look at monsters',
					userId: USER_A,
					userName: 'Alice',
				})
			),
			run(roomId, () =>
				runCommand(game, {
					command: 'look at monsters',
					userId: USER_B,
					userName: 'Bob',
				})
			),
		]);
	} finally {
		responderA.unsubscribe();
		responderB.unsubscribe();
	}

	if (game.characters[USER_A]?.givenName !== 'Alice') {
		throw new Error('expected Alice character');
	}
	if (game.characters[USER_B]?.givenName !== 'Bob') {
		throw new Error('expected Bob character');
	}
}
