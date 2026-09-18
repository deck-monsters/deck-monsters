import { expect } from 'chai';

import spawnMonster, { spawnHelpersReady } from './spawn.js';
import { CommandRefusalError } from '../../helpers/command-refusal-error.js';

describe('monsters/helpers/spawn', () => {
	before(async () => {
		await spawnHelpersReady;
	});

	describe('askForCreatureType (via spawnMonster)', () => {
		// allMonsters order is [Basilisk, Gladiator, Jinn, Minotaur, WeepingAngel] — index 2 is Jinn.
		it('resolves a numeric index answer, the shape the web client sends', async () => {
			const answers = ['2', 'female', 'Saffron', 'violet smoke'];
			const monster = await spawnMonster(async () => answers.shift());

			expect(monster.creatureType).to.equal('Jinn');
		});

		it('resolves a label answer, the shape the Discord connector sends', async () => {
			const answers = ['Jinn', 'female', 'Saffron', 'violet smoke'];
			const monster = await spawnMonster(async () => answers.shift());

			expect(monster.creatureType).to.equal('Jinn');
		});

		it('rejects an unrecognised creature type answer instead of spawning undefined', async () => {
			let error: unknown;
			try {
				await spawnMonster(async () => 'Not A Monster');
			} catch (caught) {
				error = caught;
			}

			expect(error).to.be.instanceOf(CommandRefusalError);
			expect((error as Error).message).to.include('Not A Monster');
		});
	});

	it('accepts a supplied gender enum without treating it as a choice index', async () => {
		const monster = await spawnMonster(
			async () => {
				throw new Error('A fully specified spawn must not prompt.');
			},
			{
				type: 2,
				gender: 'female',
				name: 'Saffron',
				color: 'violet smoke',
			},
		);

		expect(monster.givenName).to.equal('Saffron');
		expect(monster.gender).to.equal('female');
	});

	it('continues to accept the numeric choice format used by interactive channels', async () => {
		const answers = [1, 'Saffron', 'violet smoke'];
		const monster = await spawnMonster(async () => answers.shift(), { type: 2 });

		expect(monster.gender).to.equal('female');
	});

	it('rejects an unknown supplied gender with a useful error', async () => {
		let error: unknown;
		try {
			await spawnMonster(async () => undefined, {
				type: 2,
				gender: 'unknown',
				name: 'Saffron',
				color: 'violet smoke',
			});
		} catch (caught) {
			error = caught;
		}

		expect(error).to.be.instanceOf(Error);
		expect((error as Error).message).to.equal('Unknown monster gender: unknown');
	});
});
