const { expect, sinon } = require('../shared/test-setup');

const nothing = require('./nothing');

const pause = require('../helpers/pause');

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
		const flee = new FleeCard();

		expect(flee).to.be.an.instanceof(FleeCard);
		expect(flee.icon).to.equal('🏃');
	});

	it('returns true if the player is not bloodied', () => {
		const flee = new FleeCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		return flee.play(player, target, null, [{ monster: target }])
			.then(result => expect(result).to.equal(true));
	});
});
