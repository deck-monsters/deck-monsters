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

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return [activeContestants.reduce((potentialTarget, { monster }) => {
			if (monster !== player && monster.xp > potentialTarget.xp) {
				return monster;
			}

			return potentialTarget;
		}, proposedTarget)];
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		const randomCard = sample(target.cards);

		this.emit('narration', {
			narration: `${player.givenName} steals a card from the hand of ${target.givenName}`
		});

		return randomCard.play(player, target, ring, activeContestants);
	}
}

PickPocketCard.cardType = 'Pick Pocket';
PickPocketCard.probability = 30;
PickPocketCard.description = 'Reach into the pocket of the most skilled player and grab one of their cards to play as your own.';

module.exports = PickPocketCard;
