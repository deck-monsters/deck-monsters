import { expect } from 'chai';

import spawnMonster, { spawnHelpersReady } from './spawn.js';

describe('monsters/helpers/spawn', () => {
	before(async () => {
		await spawnHelpersReady;
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
