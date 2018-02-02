/* eslint-disable max-len */
const { expect } = require('../../shared/test-setup');

const HouseLannisterScroll = require('./house-lannister-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');

const { TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');
const { COMMON } = require('../../helpers/probabilities');

describe('./items/scrolls/house-lannister-according-to-clever-hans.js', () => {
	it('can be instantiated with defaults', () => {
		const houseLannister = new HouseLannisterScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(houseLannister.probability).to.equal(COMMON.probability);
		expect(houseLannister.cost).to.equal(ALMOST_NOTHING.cost);
		expect(houseLannister).to.be.an.instanceof(HouseLannisterScroll);
		expect(houseLannister.numberOfUses).to.equal(3);
		expect(houseLannister.expired).to.be.false;
		expect(houseLannister.stats).to.equal('Usable 3 times.');
		expect(houseLannister.icon).to.equal('👦');
		expect(houseLannister.targetingStrategy).to.equal(TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS);
		expect(houseLannister.itemType).to.equal('House Lannister According To Clever Hans');
		expect(houseLannister.getTargetingDetails(jenn)).to.equal("Clever Jenn's mother told her that she should target the monster who attacked her last, unless directed otherwise by a specific card, and that's exactly what she'll do.");
		expect(houseLannister.description).to.equal(`A Lannister always pays his debts...

Your mother told you to target the monster who attacked you last, unless directed otherwise by a specific card, and that's exactly what you'll do.`);
	});
});
