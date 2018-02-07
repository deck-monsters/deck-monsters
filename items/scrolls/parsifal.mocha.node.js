/* eslint-disable max-len */
const { expect } = require('../../shared/test-setup');

const ParsifalScroll = require('./parsifal');
const Jinn = require('../../monsters/jinn');

const { TARGET_NEXT_PLAYER } = require('../../helpers/targeting-strategies');

describe('./items/scrolls/parsifal.js', () => {
	it('can be instantiated with defaults', () => {
		const parsifal = new ParsifalScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(parsifal).to.be.an.instanceof(ParsifalScroll);
		expect(parsifal.numberOfUses).to.equal(0);
		expect(parsifal.expired).to.be.false;
		expect(parsifal.icon).to.equal('🏇');
		expect(parsifal.targetingStrategy).to.equal(TARGET_NEXT_PLAYER);
		expect(parsifal.stats).to.equal('Usable an unlimited number of times.');
		expect(parsifal.getTargetingDetails(jenn)).to.equal('Jenn will obey her mother and keep her friends close and her enemies closer, always attacking the opponent next to her unless directed otherwise by a specific card.');
	});
});
