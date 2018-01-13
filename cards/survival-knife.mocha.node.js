const { expect, sinon } = require('../shared/test-setup');

const SurvivalKnifeCard = require('./survival-knife');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

const { FIGHTER } = require('../helpers/classes');

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
		expect(survivalKnife.permittedClassesAndTypes).to.deep.equal([FIGHTER]);
		expect(survivalKnife.icon).to.equal('🗡');
		expect(survivalKnife.damageDice).to.equal('2d4');
	});

	it('can be instantiated with options', () => {
		const survivalKnife = new SurvivalKnifeCard({ icon: '🤷‍♂️', damageDice: '1d4' });

		expect(survivalKnife).to.be.an.instanceof(SurvivalKnifeCard);
		expect(survivalKnife.stats).to.equal('Hit: 1d20 vs AC / Damage: 1d4\n- or, below 1/4 health -\nHealth: 1d4\nPossiblity of Stroke of Luck'); // eslint-disable-line max-len
		expect(survivalKnife.permittedClassesAndTypes).to.deep.equal([FIGHTER]);
		expect(survivalKnife.icon).to.equal('🤷‍♂️');
		expect(survivalKnife.damageDice).to.equal('1d4');
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
			.then(() => {
				expect(player.hp).to.be.above(1);
				expect(healEffectSpy).to.have.been.calledOnce;
			})
			.then(() => healEffectSpy.restore());
	});
});
