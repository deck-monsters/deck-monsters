/* eslint-disable max-len */

const HitCard = require('./hit');

class LuckyStrike extends HitCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			icon: '🚬'
		};

		super(Object.assign(defaultOptions, options));
	}

	rollForAttack (player) {
		const attackRoll1 = super.rollForAttack(player);
		const attackRoll2 = super.rollForAttack(player);

		if (attackRoll2.naturalRoll.result > attackRoll1.naturalRoll.result) {
			return attackRoll2;
		}

		return attackRoll1;
	}
}

LuckyStrike.cardType = 'Lucky Strike';
LuckyStrike.probability = 20;
LuckyStrike.description = 'Roll for attack twice, use the best roll to see if you hit.';

module.exports = LuckyStrike;
