const BaseCard = require('./base');

class HealCard extends BaseCard {
	// Only needed if you want to do something else in the constructor
	// constructor (options) {
	// 	super(options);
	// }

	// This doesn't have to be static if it needs access to the instance
	static effect (player, target, game) { // eslint-disable-line no-unused-vars
		let healRoll = roll('1d4');

		const maxBonus = roll('1d100');
		if (maxBonus === 100) {
			healRoll = player.maxHp();
		}

		player.heal(healRoll);
	}
}

HealCard.probability = 60;
HealCard.description = 'A well-timed healing can be the difference between sweet victory and devastating defeat.';

module.exports = HealCard;
