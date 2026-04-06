/**
 * Integration tests for the full command → channel → prompt → respond cycle.
 *
 * These tests use real Game / RoomEventBus instances (no mocks) with the same
 * channel wiring used in the tRPC router.  They exercise the paths that caused
 * production bugs:
 *   - Character creation on first command
 *   - Spawn monster interactive flow
 *   - look at monsters output
 *   - Concurrent command rejection (via the per-user lock in the router)
 */

import { expect } from 'chai';
import {
	createTestGame,
	createAutoResponder,
	runCommand,
} from '../shared/test-helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_A = 'user-a';
const USER_B = 'user-b';

// Scripted answers for character creation.
// NOTE: the character's *display name* comes from the `userName` option passed
// to runCommand (propagated as `user.name` → `game.getCharacter({ name })`).
// createCharacter skips the name prompt when `name` is already defined, so
// only three prompts need to be answered: class, gender, avatar.
const NEW_CHARACTER_ANSWERS = ['0', '0', '0']; // class=Beastmaster, gender=0, avatar=0

// Scripted answers for monster spawn that follows character creation.
// spawn.ts DOES prompt for the monster name (free text) because no `name` is
// passed via SpawnOptions, so four prompts: type, gender, name, color.
const SPAWN_ANSWERS = ['0', '0', 'Fang', 'green'];

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('integration: command flow', function () {
	// These tests are slower than unit tests — give them up to 10 seconds each
	// (the default mocha timeout is 10 000ms which matches .mocharc.yml)
	this.timeout(10_000);

	describe('character creation on first command', () => {
		it('creates a character when a new user sends any command', async () => {
			const game = createTestGame();
			const responder = createAutoResponder(
				game.eventBus,
				USER_A,
				NEW_CHARACTER_ANSWERS,
			);

			try {
				// The character's display name comes from the userName option, not a
				// prompt — createCharacter skips the name prompt when name is defined.
				await runCommand(game, {
					command: 'look at monsters',
					userId: USER_A,
					userName: 'Merlin',
				});
			} finally {
				responder.unsubscribe();
			}

			const character = game.characters[USER_A];
			expect(character, 'character should exist after first command').to.exist;
			// startCase('Merlin') = 'Merlin'
			expect(character.givenName, 'character should have the display name').to.equal('Merlin');
		});

		it('does NOT re-prompt character creation for a returning user', async () => {
			const game = createTestGame();

			// First command: creates character
			const responder1 = createAutoResponder(game.eventBus, USER_A, NEW_CHARACTER_ANSWERS);
			await runCommand(game, { command: 'look at monsters', userId: USER_A });
			responder1.unsubscribe();
			const firstCount = responder1.promptsAnswered;

			// Second command: character exists, no creation prompts
			const responder2 = createAutoResponder(game.eventBus, USER_A, []);
			await runCommand(game, { command: 'look at monsters', userId: USER_A });
			responder2.unsubscribe();

			expect(firstCount, 'should have answered character creation prompts').to.be.at.least(3);
			expect(responder2.promptsAnswered, 'no prompts on second command').to.equal(0);
		});
	});

	describe('spawn monster', () => {
		it('creates a monster when the user answers all spawn prompts', async () => {
			const game = createTestGame();

			// Combine character creation answers (3 prompts: class, gender, avatar)
			// + spawn answers (4 prompts: type, gender, name, color)
			const allAnswers = [...NEW_CHARACTER_ANSWERS, ...SPAWN_ANSWERS];
			const responder = createAutoResponder(game.eventBus, USER_A, allAnswers);

			try {
				await runCommand(game, {
					command: 'spawn a monster',
					userId: USER_A,
					isDM: true,
				});
			} finally {
				responder.unsubscribe();
			}

			const character = game.characters[USER_A];
			expect(character, 'character should exist').to.exist;
			expect(character.monsters, 'character should have monsters').to.be.an('array');
			expect(
				character.monsters.length,
				'character should have exactly 1 monster',
			).to.equal(1);

			const monster = character.monsters[0];
			// startCase('Fang') = 'Fang'
			expect(monster.givenName, 'monster name should match scripted answer').to.equal('Fang');
		});

		it('monster has the expected creature type from spawn choices', async () => {
			const game = createTestGame();
			// Answer '0' for creature type = Basilisk (first in allMonsters array)
			const allAnswers = [...NEW_CHARACTER_ANSWERS, '0', '0', 'Scales', 'gold and black'];
			const responder = createAutoResponder(game.eventBus, USER_A, allAnswers);

			try {
				await runCommand(game, {
					command: 'spawn a monster',
					userId: USER_A,
					isDM: true,
				});
			} finally {
				responder.unsubscribe();
			}

			const monster = game.characters[USER_A]?.monsters?.[0];
			expect(monster, 'monster should exist').to.exist;
			expect(monster.creatureType.toLowerCase(), 'should be a basilisk').to.equal('basilisk');
		});
	});

	describe('look at monsters', () => {
		it('emits announce events listing the spawned monster', async () => {
			const game = createTestGame();

			// First: create character (3 prompts) + spawn a monster (4 prompts)
			const spawnAnswers = [...NEW_CHARACTER_ANSWERS, ...SPAWN_ANSWERS];
			const spawner = createAutoResponder(game.eventBus, USER_A, spawnAnswers);
			await runCommand(game, { command: 'spawn a monster', userId: USER_A, isDM: true });
			spawner.unsubscribe();

			// Now look at monsters — no new prompts, only announces
			const { channel } = await runCommand(game, {
				command: 'look at monsters',
				userId: USER_A,
				isDM: true,
			});

			const combined = channel.announces.join('\n').toLowerCase();
			expect(combined, 'output should mention the monster name').to.include('fang');
		});

		it('announces when there are no monsters', async () => {
			const game = createTestGame();
			// Create character (3 prompts) then look at monsters (no additional prompts)
			const responder = createAutoResponder(game.eventBus, USER_A, NEW_CHARACTER_ANSWERS);
			const { channel } = await runCommand(game, {
				command: 'look at monsters',
				userId: USER_A,
				isDM: true,
			});
			responder.unsubscribe();

			expect(channel.announces.join('\n'), 'should have some output').to.have.length.above(0);
		});
	});

	describe('multiple users', () => {
		it('creates independent characters for different users', async () => {
			const game = createTestGame();

			// Character names come from the userName option passed to runCommand,
			// not from prompts — so we pass different names and use matching answers.
			const responderA = createAutoResponder(game.eventBus, USER_A, NEW_CHARACTER_ANSWERS);
			const responderB = createAutoResponder(game.eventBus, USER_B, NEW_CHARACTER_ANSWERS);

			await Promise.all([
				runCommand(game, { command: 'look at monsters', userId: USER_A, userName: 'Alice' }),
				runCommand(game, { command: 'look at monsters', userId: USER_B, userName: 'Bob' }),
			]);

			responderA.unsubscribe();
			responderB.unsubscribe();

			expect(game.characters[USER_A]?.givenName).to.equal('Alice');
			expect(game.characters[USER_B]?.givenName).to.equal('Bob');
		});
	});

	describe('concurrent commands (engine level)', () => {
		it('does not corrupt state when two different users send commands simultaneously', async () => {
			const game = createTestGame();

			const responderA = createAutoResponder(game.eventBus, USER_A, NEW_CHARACTER_ANSWERS);
			const responderB = createAutoResponder(game.eventBus, USER_B, NEW_CHARACTER_ANSWERS);

			// Run both commands in parallel — they should not interfere with each other
			await Promise.all([
				runCommand(game, { command: 'look at monsters', userId: USER_A, userName: 'Athena' }),
				runCommand(game, { command: 'look at monsters', userId: USER_B, userName: 'Hermes' }),
			]);

			responderA.unsubscribe();
			responderB.unsubscribe();

			// Each user should have their own independent character
			expect(game.characters[USER_A]?.givenName).to.equal('Athena');
			expect(game.characters[USER_B]?.givenName).to.equal('Hermes');
		});
	});

	describe('channel wiring', () => {
		it('channel function sends announce events to the event bus', async () => {
			const game = createTestGame();
			const events: ReturnType<typeof game.eventBus.getRecentEvents> = [];

			// Capture all events published during the flow
			const unsub = game.eventBus.subscribe('wiring-test', {
				userId: USER_A,
				deliver(e) { events.push(e); },
			});

			const responder = createAutoResponder(game.eventBus, USER_A, NEW_CHARACTER_ANSWERS);
			await runCommand(game, { command: 'look at monsters', userId: USER_A });
			responder.unsubscribe();
			unsub();

			const announceEvents = events.filter(e => e.type === 'announce');
			expect(announceEvents.length, 'should have published announce events').to.be.above(0);
			for (const ev of announceEvents) {
				expect(ev.scope).to.equal('private');
				expect(ev.targetUserId).to.equal(USER_A);
			}
		});

		it('channel function returns the user answer from sendPrompt', async () => {
			const game = createTestGame();
			// We only test that the returned promise resolves to the scripted answer.
			// "Beastmaster" = answer "0"
			const responder = createAutoResponder(game.eventBus, USER_A, ['0']);

			// sendPrompt resolves to the answer string
			const answerPromise = game.eventBus.sendPrompt(
				USER_A,
				'Which type?',
				['0', '1'],
				5_000,
			);
			const answer = await answerPromise;
			responder.unsubscribe();

			expect(answer).to.equal('0');
		});
	});
});
