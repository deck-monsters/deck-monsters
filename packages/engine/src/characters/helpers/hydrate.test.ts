import { expect } from 'chai';
import Beastmaster from '../beastmaster.js';
import { hydrateCharacter } from './hydrate.js';

const sampleCharacterData = {
	name: 'Beastmaster',
	options: {
		acVariance: 2,
		hpVariance: 2,
		gender: 'male',
		deck: [],
		monsterSlots: 4,
		monsters: [],
		name: 'testcharacter',
		icon: '🎭',
		hp: 42,
		battles: { wins: 5, losses: 10, total: 15 },
		xp: 50,
		coins: 0,
	},
};

describe('characters/helpers/hydrate', () => {
	it('can hydrate a character', () => {
		const character = hydrateCharacter(sampleCharacterData);

		expect(character).to.be.instanceOf(Beastmaster);
		expect((character as any).monsters.length).to.equal(0);
	});

	it('throws on unknown character type', () => {
		const badData = { name: 'UnknownClass', options: {} };

		expect(() => hydrateCharacter(badData as any)).to.throw('Unknown character type');
	});
});
