const { expect, sinon } = require('../shared/test-setup');

const SurvivalKnifeCard = require('./survival-knife');
const Basilisk = require('../monsters/basilisk');

const HitCard = require('./hit');
const HealCard = require('./heal');

const { FIGHTER } = require('../helpers/classes');

describe('./cards/survival-knife.js', () => {
	it('can be instantiated with defaults', () => {
		const survivalKnife = new SurvivalKnifeCard();
		const hit = new HitCard({ damageDice: survivalKnife.damageDice });
		const heal = new HealCard({ healthDice: survivalKnife.damageDice });

		expect(survivalKnife).to.be.an.instanceof(SurvivalKnifeCard);
		expect(survivalKnife.stats).to.equal(`${hit.stats}\n- or, below 1/4 health -\n${heal.stats}`);
		expect(survivalKnife.permittedClassesAndTypes).to.deep.equal([FIGHTER]);
		expect(survivalKnife.icon).to.equal('🗡');
		expect(survivalKnife.damageDice).to.equal('2d4');
	});

	it('can be instantiated with options', () => {
		const survivalKnife = new SurvivalKnifeCard({ icon: '🤷‍♂️', damageDice: '1d4' });
		const hit = new HitCard({ damageDice: survivalKnife.damageDice });
		const heal = new HealCard({ healthDice: survivalKnife.damageDice });

		expect(survivalKnife).to.be.an.instanceof(SurvivalKnifeCard);
		expect(survivalKnife.stats).to.equal(`${hit.stats}\n- or, below 1/4 health -\n${heal.stats}`);
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
