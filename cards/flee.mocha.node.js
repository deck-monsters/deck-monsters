const { expect, sinon } = require('../shared/test-setup');

const FleeCard = require('./flee');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

describe('./cards/flee.js', () => {
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

		return flee.play(player, target)
			.then(result => expect(result).to.equal(true));
	});

	it('returns false if the player flees', () => {
		const flee = new FleeCard();

		const checkSuccessStub = sinon.stub(flee, 'checkSuccess');
		checkSuccessStub.returns({ success: true });

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const ring = {
			channelManager: {
				sendMessages: sinon.stub()
			}
		};
		ring.channelManager.sendMessages.resolves();

		player.hp = 2;

		return flee.play(player, target, ring, [{ monster: target }])
			.then(result => expect(result).to.equal(false));
	});

	it('returns true if the player fails to flee', () => {
		const flee = new FleeCard();

		const checkSuccessStub = sinon.stub(flee, 'checkSuccess');
		checkSuccessStub.returns({ success: false });

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const ring = {
			channelManager: {
				sendMessages: sinon.stub()
			}
		};
		ring.channelManager.sendMessages.resolves();

		player.hp = 2;

		return flee.play(player, target, ring)
			.then(result => expect(result).to.equal(true));
	});
});
