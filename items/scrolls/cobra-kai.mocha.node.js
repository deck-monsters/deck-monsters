/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const CobraKaiScroll = require('./cobra-kai');
const Jinn = require('../../monsters/jinn');

describe('./items/scrolls/cobra-kai.js', () => {
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

		expect(cobraKai).to.be.an.instanceof(CobraKaiScroll);
		expect(cobraKai.numberOfUses).to.equal(3);
		expect(cobraKai.expired).to.be.false;
		expect(cobraKai.stats).to.equal('Usable 3 times.');
		expect(cobraKai.icon).to.equal('🐍');
		expect(cobraKai.getTargetingDetails(jenn)).to.equal('Jenn will target the player with the lowest current xp while she is in the ring unless directed otherwise by a specific card.');
	});

	it('can report usage number correctly', () => {
		const cobraKai = new CobraKaiScroll();

		expect(cobraKai.numberOfUses).to.equal(3);
		expect(cobraKai.expired).to.be.false;
		cobraKai.used = 1;
		expect(cobraKai.numberOfUses).to.equal(3);
		expect(cobraKai.used).to.equal(1);
		expect(cobraKai.expired).to.be.false;
		expect(cobraKai.stats).to.equal('Usable 2 more times (of 3 total).');
		cobraKai.used = 3;
		expect(cobraKai.numberOfUses).to.equal(3);
		expect(cobraKai.used).to.equal(3);
		expect(cobraKai.expired).to.be.true;
		expect(cobraKai.stats).to.equal('All used up!');
	});
});
