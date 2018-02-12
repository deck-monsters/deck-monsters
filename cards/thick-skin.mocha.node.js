const { expect } = require('../shared/test-setup');

const ThickSkinCard = require('./thick-skin');
const Basilisk = require('../monsters/basilisk');

describe('./cards/thick-skin.js', () => {
	it('can be instantiated with defaults', () => {
		const thickSkin = new ThickSkinCard();

		expect(thickSkin).to.be.an.instanceof(ThickSkinCard);
		expect(thickSkin.icon).to.equal('🔬');
		expect(thickSkin.boostAmount).to.equal(2);
		expect(thickSkin.boostedProp).to.equal('ac');
		expect(thickSkin.stats).to.equal('Boost: ac +2 (max boost of level * 2, or 1 for beginner, then boost granted to hp instead).\nIf hit by melee attack, damage comes out of ac boost first.'); // eslint-disable-line max-len
	});

	it('increases ac', () => {
		const thickSkin = new ThickSkinCard();

		const player = new Basilisk({ name: 'player' });
		const before = player.ac;

		return thickSkin.play(player)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(player.ac).to.be.above(before);
			});
	});
});
