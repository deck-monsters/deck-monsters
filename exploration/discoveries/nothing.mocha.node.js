const { expect, sinon } = require('../../shared/test-setup');

const NothingCard = require('./nothing');

const pause = require('../../helpers/pause');

describe('./exploration/discoveries/nothing.js', () => {
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
		const nothing = new NothingCard();

		expect(nothing).to.be.an.instanceof(NothingCard);
		expect(nothing.icon).to.equal('🤷‍');
		expect(nothing.stats).to.be.a('string');
	});
});
