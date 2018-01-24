/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const ChaosTheoryAccordingToHansScroll = require('./chaos-theory-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');
const { TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');
const { ABUNDANT } = require('../../helpers/probabilities');

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

		expect(chaosTheory.probability).to.equal(ABUNDANT.probability);
		expect(chaosTheory.cost).to.equal(ALMOST_NOTHING);
		expect(chaosTheory).to.be.an.instanceof(ChaosTheoryAccordingToHansScroll);
		expect(chaosTheory.itemType).to.equal('Chaos Theory for Beginners According to Clever Hans');
		expect(chaosTheory.numberOfUses).to.equal(3);
		expect(chaosTheory.expired).to.be.false;
		expect(chaosTheory.stats).to.equal('Usable 3 times.');
		expect(chaosTheory.icon).to.equal('👦');
		expect(chaosTheory.targetingStrategy).to.equal(TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS);
		expect(chaosTheory.getTargetingDetails(jenn)).to.equal("Clever Jenn's mother told her that she should look around the ring and pick a random monster to target, unless directed otherwise by a specific card, and that's exactly what she'll do.");
		expect(chaosTheory.description).to.equal(`Tiny variations, the orientation of hairs on your hand, the amount of blood distending your vessels, imperfections in the skin... vastly affect the outcome.

Your mother told you to target a random monster in the ring rather than following a defined order, and that's exactly what you'll do.`);
	});
});
