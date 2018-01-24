/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const QinShiHuangScroll = require('./qin-shi-huang-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');

const { TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');
const { ABUNDANT } = require('../../helpers/probabilities');

describe('./items/scrolls/qin-shi-huang-according-to-clever-hans.js', () => {
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
		const qinShiHuangScroll = new QinShiHuangScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(qinShiHuangScroll.probability).to.equal(ABUNDANT.probability);
		expect(qinShiHuangScroll.cost).to.equal(ALMOST_NOTHING.cost);
		expect(qinShiHuangScroll).to.be.an.instanceof(QinShiHuangScroll);
		expect(qinShiHuangScroll.numberOfUses).to.equal(3);
		expect(qinShiHuangScroll.expired).to.be.false;
		expect(qinShiHuangScroll.stats).to.equal('Usable 3 times.');
		expect(qinShiHuangScroll.icon).to.equal('👦');
		expect(qinShiHuangScroll.itemType).to.equal('The Annals of Qin Shi Huang According to Clever Hans');
		expect(qinShiHuangScroll.targetingStrategy).to.equal(TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS);
		expect(qinShiHuangScroll.getTargetingDetails(jenn)).to.equal("Clever Jenn's mother told her she should seek to consolidate her power and lay waste to the biggest monster in the ring by targeting the monster with the highest xp, unless directed otherwise by a specific card, and that's exactly what she'll do.");
		expect(qinShiHuangScroll.description).to.equal(`焚書坑儒

Your mother told you to target the monster who has the highest xp, and that's exactly what you'll do.`);
	});
});
