/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const CleverHansScroll = require('./clever-hans');
const Jinn = require('../../monsters/jinn');

describe('./items/scrolls/clever-hans.js', () => {
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
		const cleverHans = new CleverHansScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(cleverHans).to.be.an.instanceof(CleverHansScroll);
		expect(cleverHans.numberOfUses).to.equal(0);
		expect(cleverHans.expired).to.be.false;
		expect(cleverHans.stats).to.equal('Usable an unlimited number of times.');
		expect(cleverHans.getTargetingDetails(jenn)).to.equal('Jenn will obey her mother and keep her friends close and her enemies closer, always attacking the next opponent in line unless directed otherwise by a specific card.');
	});
});
