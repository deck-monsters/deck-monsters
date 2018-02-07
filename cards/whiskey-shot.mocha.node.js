const { expect } = require('../shared/test-setup');

const WhiskeyShotCard = require('./whiskey-shot');
const HealCard = require('./heal');
const Basilisk = require('../monsters/basilisk');

describe('./cards/whiskey-shot.js', () => {
	it('can be instantiated with defaults', () => {
		const whiskeyShot = new WhiskeyShotCard();
		const heal = new HealCard({ healthDice: whiskeyShot.healthDice });

		expect(whiskeyShot).to.be.an.instanceof(WhiskeyShotCard);
		expect(whiskeyShot.healthDice).to.equal('1d8');
		expect(whiskeyShot.probability).to.equal(40);
		expect(whiskeyShot.stats).to.equal(heal.stats);
	});

	it('heals the player', () => {
		const whiskeyShot = new WhiskeyShotCard();

		const player = new Basilisk({ name: 'player', hp: 2 });
		const before = player.hp;

		return whiskeyShot.play(player)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(player.hp).to.be.above(before);
			});
	});
});
