/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const CobraKaiScroll = require('./cobra-kai-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');
const { TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');
const { COMMON } = require('../../helpers/probabilities');

describe('./items/scrolls/cobra-kai-according-to-clever-hans.js', () => {
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
		const cobraKai = new CobraKaiScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(cobraKai.probability).to.equal(COMMON.probability);
		expect(cobraKai.cost).to.equal(ALMOST_NOTHING.cost);
		expect(cobraKai).to.be.an.instanceof(CobraKaiScroll);
		expect(cobraKai.numberOfUses).to.equal(3);
		expect(cobraKai.expired).to.be.false;
		expect(cobraKai.stats).to.equal('Usable 3 times.');
		expect(cobraKai.icon).to.equal('👦');
		expect(cobraKai.targetingStrategy).to.equal(TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS);
		expect(cobraKai.description).to.equal(`We do not train to be merciful here. Mercy is for the weak. Here, in the streets, in competition: A man confronts you, he is the enemy. An enemy deserves no mercy.

Your mother told you to target the weakest monster in the ring, every time, and that's exactly what you'll do.`);
		expect(cobraKai.getTargetingDetails(jenn)).to.equal("Clever Jenn's mother told her that she should target the monster with the lowest current xp while she is in the ring unless directed otherwise by a specific card, and that's exactly what she'll do.");
	});
});
