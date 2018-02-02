/* eslint-disable max-len */
const { expect } = require('../../shared/test-setup');

const LaCarambadaScroll = require('./la-carambada');
const Jinn = require('../../monsters/jinn');

describe('./items/scrolls/la-carambada.js', () => {
	it('can be instantiated with defaults', () => {
		const laCarambada = new LaCarambadaScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(laCarambada).to.be.an.instanceof(LaCarambadaScroll);
		expect(laCarambada.numberOfUses).to.equal(3);
		expect(laCarambada.expired).to.be.false;
		expect(laCarambada.stats).to.equal('Usable 3 times.');
		expect(laCarambada.icon).to.equal('💃');
		expect(laCarambada.getTargetingDetails(jenn)).to.equal('Jenn will target whichever living opponent would have the highest hp if they were at full health (that is, the highest maximum hp), unless directed otherwise by a specific card.');
	});
});
