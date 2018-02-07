const { expect, sinon } = require('../../shared/test-setup');

const DeathCard = require('./death');

const pause = require('../../helpers/pause');

describe('./exploration/discoveries/death.js', () => {
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
		const death = new DeathCard();

		expect(death).to.be.an.instanceof(DeathCard);
		expect(death.icon).to.equal('💀');
	});
});
