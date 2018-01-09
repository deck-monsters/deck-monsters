/* eslint-disable max-len */
const sample = require('lodash.sample');

const BaseCard = require('./base');

class PickPocketCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👇'
	} = {}) {
		super({ icon });
	}

	play (player, proposedTarget, ring, activeContestants) {
		this.emit('played', { player });

		const mostExperienced = activeContestants.reduce((potentialTarget, { monster }) => {
			if (monster !== player && monster.xp > potentialTarget.xp) {
				return monster;
			}

			return potentialTarget;
		}, proposedTarget);

		const randomCard = sample(mostExperienced.cards);

		this.emit('narration', {
			narration: `${player.givenName} steals a card from the hand of ${mostExperienced.givenName}`
		});
		
		randomCard.originalEffect = randomCard.effect;
		randomCard.effect = (...args) => this.effect(...args);
		this.randomCard = randomCard;

		return randomCard.play(player, proposedTarget, ring, activeContestants);
	}

	effect (player, target, ring, activeContestants) {
		return this.randomCard.originalEffect.call(this.randomCard, player, target, ring, activeContestants);
	}
}

PickPocketCard.cardType = 'Pick Pocket';
PickPocketCard.probability = 30;
PickPocketCard.description = 'Reach into the pocket of the most skilled player and grab one of their cards to play as your own.';

module.exports = PickPocketCard;
