/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const SirRobinScroll = require('./sir-robin');
const Jinn = require('../../monsters/jinn');

describe('./items/scrolls/la-carambada.js', () => {
	let channelStub;
	let pauseStub;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const sirRobin = new SirRobinScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(sirRobin).to.be.an.instanceof(SirRobinScroll);
		expect(sirRobin.numberOfUses).to.equal(3);
		expect(sirRobin.expired).to.be.false;
		expect(sirRobin.stats).to.equal('Usable 3 times.');
		expect(sirRobin.getTargetingDetails(jenn)).to.equal('whenever Jenn is in the ring she will bravely look about, choose the player with the highest current hp, and target them, unless directed otherwise by a specific card.');
	});
});
