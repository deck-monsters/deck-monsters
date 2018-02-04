const { expect, sinon } = require('../shared/test-setup');

const { randomCharacter } = require('../characters');
const FistsOfVirtueCard = require('./fists-of-virtue');

describe('./cards/fists-of-virtue.js', () => {
	it('can be instantiated with defaults', () => {
		const virtue = new FistsOfVirtueCard();

		expect(virtue).to.be.an.instanceof(FistsOfVirtueCard);
		expect(virtue.stats).to.equal(`Hit: 1d20 vs ac / Damage: 1d8
Strikes opponent with highest current hp.`);
		expect(virtue.icon).to.equal('🙏');
	});

	it('can be played', () => {
		const virtue = new FistsOfVirtueCard();

		const playerCharacter = randomCharacter();
		const player = playerCharacter.monsters[0];
		const target1Character = randomCharacter();
		const target1 = target1Character.monsters[0];
		const target2Character = randomCharacter();
		const target2 = target2Character.monsters[0];
		const target3Character = randomCharacter();
		const target3 = target3Character.monsters[0];

		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 },
				{ character: {}, monster: target3 }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		player.hp = 40;
		target1.hp = 20;
		target2.hp = 25;
		target3.hp = 15;

		const hitCheckSpy = sinon.spy(virtue, 'hitCheck');

		return virtue
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				expect(hitCheckSpy).to.have.been.calledWith(player, target2);
			});
	});
});
