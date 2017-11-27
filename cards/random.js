/* eslint-disable max-len */

const BaseCard = require('./base');
const cards = require('./index');

class RandomCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🎲'
	} = {}) {
		super({ icon });
	}

	effect (player, target, ring) {
		const randomCard = cards.draw(this.options, player);

		return randomCard.play(player, target, ring);
	}
}

RandomCard.cardType = 'Random Play';
RandomCard.probability = 20;
RandomCard.description = 'Go wild. Draw a random card from the deck and play it.';

module.exports = RandomCard;
