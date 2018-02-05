const { expect } = require('../shared/test-setup');

const { BARBARIAN, FIGHTER } = require('../helpers/classes');
const AdrenalineRushCard = require('./adrenaline-rush');

describe('./cards/adrenaline-rush.js', () => {
	it('can be instantiated with defaults', () => {
		const adrenalineRush = new AdrenalineRushCard();

		expect(adrenalineRush).to.be.an.instanceof(AdrenalineRushCard);
		expect(adrenalineRush.cardType).to.equal('Adrenaline Rush');
		expect(adrenalineRush.icon).to.equal('❗️');
		expect(adrenalineRush.permittedClassesAndTypes).to.deep.equal([BARBARIAN, FIGHTER]);
		expect(adrenalineRush.description).to.equal('Life or Death brings about a certain focus... A certain AWAKENESS most people don\'t actually want. It\'s what you live for. It\'s how you know you exist. You embrace it a welcome the rush.'); // eslint-disable-line max-len
	});
});
