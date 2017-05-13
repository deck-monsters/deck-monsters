/* eslint-disable max-len */

const BaseCard = require('./base');
const { roll } = require('../helpers/chance');

class HitCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			icon: '🚬'
		};

		super(Object.assign(defaultOptions, options));
	}

	rollForAttack (player) {
		const attackRoll1 = roll({ primaryDice: this.attackDice, modifier: player.attackModifier, bonusDice: player.bonusAttackDice });
		const attackRoll2 = roll({ primaryDice: this.attackDice, modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

		if (attackRoll2.naturalRoll.result > attackRoll1.naturalRoll.result) {
			return attackRoll2;
		}

		return attackRoll1;
	}
}

HitCard.cardType = 'Lucky Strike';
HitCard.probability = 20;
HitCard.description = 'Roll for attack twice, use the best roll to see if you hit.';

module.exports = HitCard;
