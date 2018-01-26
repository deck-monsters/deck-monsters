/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const QinShiHuangScroll = require('./qin-shi-huang');
const Jinn = require('../../monsters/jinn');

describe('./items/scrolls/qin-shi-huang.js', () => {
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
		const qinShiHuang = new QinShiHuangScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(qinShiHuang).to.be.an.instanceof(QinShiHuangScroll);
		expect(qinShiHuang.numberOfUses).to.equal(3);
		expect(qinShiHuang.expired).to.be.false;
		expect(qinShiHuang.stats).to.equal('Usable 3 times.');
		expect(qinShiHuang.icon).to.equal('焚');
		expect(qinShiHuang.getTargetingDetails(jenn)).to.equal('Jenn will seek to consolidate her power and lay waste to her biggest foes in the ring by targeting the opponent with the highest xp, unless directed otherwise by a specific card.');
	});
});
