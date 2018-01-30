/* eslint-disable max-len */

const LuckyStrikeCard = require('./lucky-strike');

const { MINOTAUR } = require('../helpers/creature-types');

const { roll } = require('../helpers/chance');

class HornSwipeCard extends LuckyStrikeCard {
	constructor ({
		icon = '⾓', // This character means "horn"
		targetProp,
		...rest
	} = {}) {
		super({ targetProp, icon, ...rest });
	}

	// use strModifier for some variety. Idea being it is less about precision and more about brute force. If they block the
	// first one you power through and stab with the second
	getAttackRoll (player) {
		return roll({ primaryDice: this.attackDice, modifier: player.strModifier, bonusDice: player.bonusAttackDice, crit: true });
	}

	getAttackCommentary (player, target, betterRoll, worseRoll) {
		let commentary = '';

		const { success: horn1Success } = this.checkSuccess(worseRoll, target[this.targetProp]);
		if (!horn1Success) {
			commentary = `(${worseRoll.result}) ${target.givenName} manages to block your first horn...
`;

			const { success: horn2Success } = this.checkSuccess(betterRoll, target[this.targetProp]);
			if (!horn2Success) {
				commentary += `(${betterRoll.result}) and your second horn as well.`;

				return commentary;
			}
		}

		commentary += `(${betterRoll.naturalRoll.result}) ${!horn1Success ? 'but' : target.givenName} fails to block your${!horn1Success ? ' second' : ''} horn.`;

		return commentary;
	}
}

HornSwipeCard.cardType = 'Horn Swipe';
HornSwipeCard.permittedClassesAndTypes = [MINOTAUR];
HornSwipeCard.description = 'Swing your horns at your opponent. If they block the first, maybe you\'ll power through and hit with the second out of sheer brute force.';
HornSwipeCard.defaults = {
	...LuckyStrikeCard.defaults,
	targetProp: 'str'
};

HornSwipeCard.flavors = {
	hits: [
		['rams a horn into', 80, '🐮'],
		['slams the side of a horn into', 70, '🐮'],
		['stabs with a horn', 50, '🐮'],
		['just barely catches, and rips a huge chunk out of, the arm of', 5, '🐮'],
		['bellows in rage and charges, swinging horns back and forth in a blind rage. The crowds winces as a sickening wet sucking plunging sound reverberates throughout the ring and a horn stabs all the way into', 1, '🐮']
	]
};

module.exports = HornSwipeCard;
