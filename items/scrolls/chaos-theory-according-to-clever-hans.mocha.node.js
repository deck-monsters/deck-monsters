/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const ChaosTheoryAccordingToHansScroll = require('./chaos-theory-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');

describe('./items/scrolls/chaos-theory-according-to-clever-hans.js', () => {
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
		const chaosTheory = new ChaosTheoryAccordingToHansScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(chaosTheory).to.be.an.instanceof(ChaosTheoryAccordingToHansScroll);
		expect(chaosTheory.numberOfUses).to.equal(3);
		expect(chaosTheory.expired).to.be.false;
		expect(chaosTheory.stats).to.equal('Usable 3 times.');
		expect(chaosTheory.icon).to.equal('👦');
		expect(chaosTheory.getTargetingDetails(jenn)).to.equal('Jenn will look around the ring and pick a random foe to target, unless directed otherwise by a specific card.');
	});
});
