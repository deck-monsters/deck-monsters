/* eslint-disable max-len */

const HitCard = require('./hit');
const { roll } = require('../helpers/chance');
const { FIGHTER } = require('../helpers/classes');

class WoodenSpearCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageModifier = 3,
		icon = '🌳',
		...rest
	} = {}) {
		super({ icon, ...rest });
		this.options.damageModifier = damageModifier;
	}

	get damageModifier () {
		return this.options.damageModifier;
	}

	get stats () {
		return `${super.stats}
+${this.damageModifier} damage vs Minotaurs`;
	}

	getDamageRoll (player, target) {
		if (target.name === 'Minotaur') {
			return roll({ primaryDice: this.damageDice, modifier: player.damageModifier + this.damageModifier, bonusDice: player.bonusDamageDice });
		}

		return super.getDamageRoll(player, target);
	}
}

WoodenSpearCard.cardType = 'Wooden Spear';
WoodenSpearCard.probability = 30;
WoodenSpearCard.description = 'A simple weapon fashioned for Minotaur-hunting.';
WoodenSpearCard.cost = 6;
WoodenSpearCard.level = 1;
WoodenSpearCard.permittedClasses = [FIGHTER];

WoodenSpearCard.flavors = {
	hits: [
		['spears', 80],
		['stabs', 50],
		['chases into the bush and slaughters', 5]
	]
};

module.exports = WoodenSpearCard;
