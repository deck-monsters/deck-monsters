/* eslint-disable max-len */

const BaseCard = require('./base');

class RandomCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🎲'
	} = {}) {
		super({ icon });
	}

	effect (player, target, ring, activeContestants) {
		const { draw } = require('./index'); // eslint-disable-line global-require
		const randomCard = draw(this.options, player);

		return randomCard.play(player, target, ring, activeContestants);
	}
}

RandomCard.cardType = 'Random Play';
RandomCard.probability = 30;
RandomCard.description = 'Go wild. Draw a random card from the deck and play it.';

module.exports = RandomCard;
