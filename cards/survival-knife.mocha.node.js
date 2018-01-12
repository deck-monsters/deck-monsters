const { expect, sinon } = require('../shared/test-setup');

const SurvivalKnifeCard = require('./survival-knife');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

describe('./cards/survival-knife.js', () => {
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
		const survivalKnife = new SurvivalKnifeCard();

		expect(survivalKnife).to.be.an.instanceof(SurvivalKnifeCard);
		expect(survivalKnife.stats).to.equal('Hit: 1d20 vs AC / Damage: 2d4\n- or, below 1/4 health -\nHealth: 2d4\nPossiblity of Stroke of Luck'); // eslint-disable-line max-len
	});

	it('can be played when at full health', () => {
		const survivalKnife = new SurvivalKnifeCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const healEffectSpy = sinon.spy(survivalKnife.healCard, 'effect');

		return survivalKnife.play(player, target, ring, ring.contestants)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(healEffectSpy).to.not.have.been.called;
			});
	});

	it('can be played when at low health', () => {
		const survivalKnife = new SurvivalKnifeCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		player.hp = 1;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const healEffectSpy = sinon.spy(survivalKnife.healCard, 'effect');

		return survivalKnife.play(player, target, ring, ring.contestants)
			.then(() => expect(healEffectSpy).to.have.been.calledOnce);
	});
});
