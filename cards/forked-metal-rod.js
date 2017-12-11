/* eslint-disable max-len */

const ForkedStickCard = require('./forked-stick');

const { roll } = require('../helpers/chance');
const { DEFENSE_PHASE } = require('../helpers/phases');

class ForkedMetalRodCard extends ForkedStickCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '⑂⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () {
		return `${super.stats}
Chance to immobilize opponent by capturing their neck between strong prongs.

Chance to do damage.`;
	}

	getFreedomThreshold (player, target) {
		return player.ac * 1.5;
	}

	getDamageRoll (player, target) {
		if (this.getAttackRoll(player) > target.ac) {
			return roll({ primaryDice: this.damageDice, modifier: player.damageModifier, bonusDice: player.bonusDamageDice });
		}

		return 0;
	}
}

ForkedMetalRodCard.cardType = 'Forked Metal Rod';
ForkedMetalRodCard.probability = 20;
ForkedMetalRodCard.description = `A dangerously strong weapon fashioned for ${ForkedMetalRodCard.creatureType}-hunting.`;
ForkedMetalRodCard.level = 2;
ForkedMetalRodCard.defaults = {
	...ForkedStickCard.defaults,
	attackModifier: 3,
	hitOnFail: true
};

module.exports = ForkedMetalRodCard;
