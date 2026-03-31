import { expect } from 'chai';
import Beastmaster from '../beastmaster.js';
import randomCharacter from './random.js';

describe('characters/helpers/random', () => {
	it('returns a Beastmaster instance', () => {
		const character = randomCharacter();

		expect(character).to.be.instanceOf(Beastmaster);
	});

	it('character has a given name', () => {
		const character = randomCharacter();

		expect(character.givenName).to.be.a('string');
	});

	it('returns a boss when isBoss is set', () => {
		const character = randomCharacter({ isBoss: true });

		expect(character).to.be.instanceOf(Beastmaster);
		expect((character as any).isBoss).to.equal(true);
	});
});
