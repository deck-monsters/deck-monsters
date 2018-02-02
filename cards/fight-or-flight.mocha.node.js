const { expect, sinon } = require('../shared/test-setup');

const FightOrFlightCard = require('./fight-or-flight');
const Basilisk = require('../monsters/basilisk');

describe('./cards/fight-or-flight.js', () => {
	it('can be instantiated with defaults', () => {
		const fightOrFlight = new FightOrFlightCard();

		expect(fightOrFlight).to.be.an.instanceof(FightOrFlightCard);
		expect(fightOrFlight.stats).to.equal('Hit: 1d20 vs ac / Damage: 1d6\nChance to flee if below a quarter health');
	});

	it('can be played when at full health', () => {
		const fightOrFlight = new FightOrFlightCard();

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

		const fleeEffectSpy = sinon.spy(fightOrFlight, 'fleeEffect');

		return fightOrFlight.play(player, target, ring, ring.contestants)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(fleeEffectSpy).to.not.have.been.called;
			});
	});

	it('can be played when at low health', () => {
		const fightOrFlight = new FightOrFlightCard();

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

		const fleeEffectSpy = sinon.spy(fightOrFlight, 'fleeEffect');

		return fightOrFlight.play(player, target, ring, ring.contestants)
			.then(() => expect(fleeEffectSpy).to.have.been.calledOnce);
	});
});
