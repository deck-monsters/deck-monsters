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
RandomCard.description = 'You find the illegible scraps of an ancient card in the corner. Curious to see what it does, you play it --as it crumbles to dust.';

module.exports = RandomCard;
