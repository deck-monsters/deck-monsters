/* eslint-disable max-len */
const sample = require('lodash.sample');

const BaseCard = require('./base');

const { COMMON } = require('../helpers/probabilities');
const { VERY_CHEAP } = require('../helpers/costs');
const { TARGET_HIGHEST_XP_PLAYER, getTarget } = require('../helpers/targeting-strategies');

class PickPocketCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👇'
	} = {}) {
		super({ icon });
	}

	play (player, proposedTarget, ring, activeContestants) {
		this.emit('played', { player });

		const mostExperienced = getTarget({
			contestants: activeContestants,
			playerMonster: player,
			strategy: TARGET_HIGHEST_XP_PLAYER
		}).monster;

		const randomCard = sample(mostExperienced.cards.filter(card => !['Pick Pocket'].includes(card.cardType))).clone();

		this.emit('narration', {
			narration: `${player.givenName} steals a card from the hand of ${mostExperienced.givenName}`
		});

		this.randomCard = randomCard;

		return randomCard.play(player, proposedTarget, ring, activeContestants);
	}
}

PickPocketCard.cardType = 'Pick Pocket';
PickPocketCard.probability = COMMON.probability;
PickPocketCard.description = 'Reach into the pocket of the most skilled player and grab one of their cards to play as your own.';
PickPocketCard.cost = VERY_CHEAP.cost;

module.exports = PickPocketCard;
