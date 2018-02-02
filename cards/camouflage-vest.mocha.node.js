const { expect } = require('../shared/test-setup');

const CamouflageVestCard = require('./camouflage-vest');
const Minotaur = require('../monsters/minotaur');

describe('./cards/camouflage-vest.js', () => {
	it('can be instantiated with defaults', () => {
		const camouflage = new CamouflageVestCard();

		expect(camouflage).to.be.an.instanceof(CamouflageVestCard);
		expect(camouflage.icon).to.equal('☁️');
	});

	it('can be drawn', () => {
		const camouflage = new CamouflageVestCard();

		const monster = new Minotaur({ name: 'player', xp: 50 });

		expect(monster.canHoldCard(CamouflageVestCard)).to.equal(true);
		expect(monster.canHoldCard(camouflage)).to.equal(true);
	});
});
