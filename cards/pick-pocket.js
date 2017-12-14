/* eslint-disable max-len */
const shuffle = require('lodash.shuffle');

const BaseCard = require('./base');

class PickPocketCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👇'
	} = {}) {
		super({ icon });
	}

	effect (player, oldTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		const target = activeContestants.reduce((potentialTarget, { monster }) => {
			if (monster !== player && monster.xp > potentialTarget.xp) {
				return monster;
			}

			return potentialTarget;
		}, oldTarget);
		const randomCard = shuffle(target.cards)[0];

		this.emit('narration', {
			narration: `${player.givenName} steals a card from the hand of ${target.givenName}`
		});

		return randomCard.play(player, oldTarget, ring, activeContestants);
	}
}

PickPocketCard.cardType = 'Pick Pocket';
PickPocketCard.probability = 20;
PickPocketCard.description = 'Reach into the pocket of another player and grab one of their cards to play as your own.';

module.exports = PickPocketCard;
