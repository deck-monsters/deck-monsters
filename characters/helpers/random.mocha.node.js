const { expect } = require('../../shared/test-setup');

const Beastmaster = require('../beastmaster');

const randomCharacter = require('./random');

describe('./characters/index.js', () => {
	it('can get a random character', () => {
		const character = randomCharacter();

		expect(character).to.be.an.instanceof(Beastmaster);
		expect(character.monsters.length).to.equal(1);
		expect(character.monsters[0].cards.length).to.equal(character.monsters[0].cardSlots);
		expect(character.givenName).to.be.a('string');
		expect(character.monsters[0].givenName).to.be.a('string');
	});
});
