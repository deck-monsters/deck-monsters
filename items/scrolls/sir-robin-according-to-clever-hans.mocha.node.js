/* eslint-disable max-len */
const { expect } = require('../../shared/test-setup');

const SirRobinScroll = require('./sir-robin-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');

const { TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');
const { COMMON } = require('../../helpers/probabilities');

describe('./items/scrolls/sir-robin-according-to-clever-hans.js', () => {
	it('can be instantiated with defaults', () => {
		const sirRobin = new SirRobinScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(sirRobin.probability).to.equal(COMMON.probability);
		expect(sirRobin.cost).to.equal(ALMOST_NOTHING.cost);
		expect(sirRobin).to.be.an.instanceof(SirRobinScroll);
		expect(sirRobin.numberOfUses).to.equal(3);
		expect(sirRobin.expired).to.be.false;
		expect(sirRobin.stats).to.equal('Usable 3 times.');
		expect(sirRobin.icon).to.equal('👦');
		expect(sirRobin.itemType).to.equal('The Tale of Sir Robin According to Clever Hans');
		expect(sirRobin.targetingStrategy).to.equal(TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS);
		expect(sirRobin.getTargetingDetails(jenn)).to.equal("Clever Jenn's mother told her that whenever she is in the ring she should bravely look about, choose the monster with the highest current hp, and target them, unless directed otherwise by a specific card, and that's exactly what she'll do.");
		expect(sirRobin.description).to.equal(`He was not in the least bit scared to be mashed into a pulp, or to have his eyes gouged out, and his elbows broken, to have his kneecaps split, and his body burned away... brave Sir Robin!

Your mother told you to target whichever monster currently has the highest hp, and that's exactly what you'll do.`);
	});
});
