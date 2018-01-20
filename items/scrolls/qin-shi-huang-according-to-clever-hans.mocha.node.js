/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const QinShiHuangScroll = require('./qin-shi-huang-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');

const { TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');

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

		expect(qinShiHuangScroll.probability).to.equal(75);
		expect(qinShiHuangScroll.cost).to.equal(18);
		expect(qinShiHuangScroll).to.be.an.instanceof(QinShiHuangScroll);
		expect(qinShiHuangScroll.numberOfUses).to.equal(3);
		expect(qinShiHuangScroll.expired).to.be.false;
		expect(qinShiHuangScroll.stats).to.equal('Usable 3 times.');
		expect(qinShiHuangScroll.icon).to.equal('👦');
		expect(qinShiHuangScroll.itemType).to.equal('The Annals of Qin Shi Huang According to Clever Hans');
		expect(qinShiHuangScroll.targetingStrategy).to.equal(TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS);
		expect(qinShiHuangScroll.getTargetingDetails(jenn)).to.equal('Jenn will seek to consolidate her power and lay waste to the biggest monster in the ring by targeting anyone with the highest xp, unless directed otherwise by a specific card.');
		expect(qinShiHuangScroll.description).to.equal(`焚書坑儒

Target the player who has the highest xp.`);
	});
});
