const { expect, sinon } = require('../shared/test-setup');

const { randomCharacter } = require('../characters');
const FistsOfVillainyCard = require('./fists-of-villainy');

describe('./cards/fists-of-villainy.js', () => {
	it('can be instantiated with defaults', () => {
		const villainy = new FistsOfVillainyCard();

		expect(villainy).to.be.an.instanceof(FistsOfVillainyCard);
		expect(villainy.stats).to.equal(`Hit: 1d20 vs ac / Damage: 1d6
Strikes opponent with lowest current hp.`);
		expect(villainy.icon).to.equal('🐀');
	});

	it('can be played', () => {
		const villainy = new FistsOfVillainyCard();

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

		const hitCheckSpy = sinon.spy(villainy, 'hitCheck');

		return villainy
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				expect(hitCheckSpy).to.have.been.calledWith(player, target3);
			});
	});
});
