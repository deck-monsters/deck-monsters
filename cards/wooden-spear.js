/* eslint-disable max-len */

const HitCard = require('./hit');

const { BARD, FIGHTER } = require('../constants/creature-classes');
const { MINOTAUR } = require('../constants/creature-types');
const { roll } = require('../helpers/chance');
const { COMMON } = require('../helpers/probabilities');
const { CHEAP } = require('../helpers/costs');

class WoodenSpearCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		strModifier,
		icon = '🌳',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			strModifier
		});
	}

	get creatureType () {
		return this.constructor.creatureType;
	}

	get strModifier () {
		return this.options.strModifier;
	}

	get stats () {
		return `${super.stats}
+${this.strModifier} damage vs ${this.creatureType}`;
	}

	getDamageRoll (player, target) {
		if (target.name === this.creatureType) {
			return roll({ primaryDice: this.damageDice, modifier: player.strModifier + this.strModifier, bonusDice: player.bonusDamageDice });
		}

		return super.getDamageRoll(player, target);
	}
}

WoodenSpearCard.cardType = 'Wooden Spear';
WoodenSpearCard.permittedClassesAndTypes = [BARD, FIGHTER];
WoodenSpearCard.creatureType = MINOTAUR;
WoodenSpearCard.probability = COMMON.probability;
WoodenSpearCard.description = `A simple weapon fashioned for ${WoodenSpearCard.creatureType}-hunting.`;
WoodenSpearCard.level = 1;
WoodenSpearCard.cost = CHEAP.cost;

WoodenSpearCard.defaults = {
	...HitCard.defaults,
	strModifier: 3
};

WoodenSpearCard.flavors = {
	hits: [
		['spears', 80],
		['stabs', 50],
		['chases into the bush and slaughters', 5]
	]
};

module.exports = WoodenSpearCard;
