/* eslint-disable max-len */
const { expect } = require('../../shared/test-setup');

const SirRobinScroll = require('./sir-robin');
const Jinn = require('../../monsters/jinn');

describe('./items/scrolls/sir-robin.js', () => {
	it('can be instantiated with defaults', () => {
		const sirRobin = new SirRobinScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(sirRobin).to.be.an.instanceof(SirRobinScroll);
		expect(sirRobin.numberOfUses).to.equal(3);
		expect(sirRobin.expired).to.be.false;
		expect(sirRobin.stats).to.equal('Usable 3 times.');
		expect(sirRobin.icon).to.equal('🙏');
		expect(sirRobin.getTargetingDetails(jenn)).to.equal('whenever Jenn is in the ring she will bravely look about, choose the opponent with the highest current hp, and target them, unless directed otherwise by a specific card.');
	});
});
