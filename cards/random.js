/* eslint-disable max-len */

const BaseCard = require('./base');

const { COMMON } = require('../helpers/probabilities');
const { ALMOST_NOTHING } = require('../helpers/costs');

class RandomCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🎲'
	} = {}) {
		super({ icon });
	}

	play (player, proposedTarget, ring, activeContestants) {
		this.emit('played', { player });

		const { draw } = require('./index'); // eslint-disable-line global-require
		const randomCard = draw(this.options, player);

		this.randomCard = randomCard;
		this.cardClass = randomCard.cardClass;

		return randomCard.play(player, proposedTarget, ring, activeContestants);
	}
}

RandomCard.cardClass = 'Psychic';
RandomCard.cardType = 'Random Play';
RandomCard.probability = COMMON.probability;
RandomCard.description = 'You find the illegible scraps of an ancient card in the corner. Curious to see what it does, you play it --as it crumbles to dust.';
RandomCard.cost = ALMOST_NOTHING.cost;

module.exports = RandomCard;
