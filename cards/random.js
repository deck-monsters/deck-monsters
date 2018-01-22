/* eslint-disable max-len */

const BaseCard = require('./base');

const { COMMON } = require('../helpers/probabilities');

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

		randomCard.originalGetTargets = randomCard.getTargets;
		randomCard.getTargets = (...args) => this.getTargets(...args);

		randomCard.originalEffect = randomCard.effect;
		randomCard.effect = (...args) => this.effect(...args);

		this.randomCard = randomCard;

		return randomCard.play(player, proposedTarget, ring, activeContestants);
	}

	getTargets (player, proposedTarget, ring, activeContestants) {
		return this.randomCard.originalGetTargets.call(this.randomCard, player, proposedTarget, ring, activeContestants);
	}

	effect (player, target, ring, activeContestants) {
		return this.randomCard.originalEffect.call(this.randomCard, player, target, ring, activeContestants);
	}
}

RandomCard.cardType = 'Random Play';
RandomCard.probability = COMMON.probability;
RandomCard.description = 'You find the illegible scraps of an ancient card in the corner. Curious to see what it does, you play it --as it crumbles to dust.';
RandomCard.cost = 5;

module.exports = RandomCard;
