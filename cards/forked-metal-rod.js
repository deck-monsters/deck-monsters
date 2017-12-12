/* eslint-disable max-len */

const ForkedStickCard = require('./forked-stick');

const ImmobilizeCard = require('./immoblize');

const { roll } = require('../helpers/chance');

class ForkedMetalRodCard extends ForkedStickCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '⑂⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () {
		return `${ImmobilizeCard.stats}
Chance to immobilize opponent by capturing their neck between strong prongs.

Chance to do damage.`;
	}

	getFreedomThreshold (player) { // eslint-disable-line class-methods-use-this
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
ForkedMetalRodCard.description = `A dangerously strong weapon fashioned for ${ForkedStickCard.creatureTypes[1]}-hunting.`;
ForkedMetalRodCard.level = 2;
ForkedMetalRodCard.defaults = {
	...ForkedStickCard.defaults,
	attackModifier: 3,
	hitOnFail: true
};

module.exports = ForkedMetalRodCard;
