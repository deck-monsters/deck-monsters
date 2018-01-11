/* eslint-disable max-len */

const HitCard = require('./hit');

const { FIGHTER } = require('../helpers/classes');
const { MINOTAUR } = require('../helpers/creature-types');
const { roll } = require('../helpers/chance');

class WoodenSpearCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		strengthModifier,
		icon = '🌳',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			strengthModifier
		});
	}

	get creatureType () {
		return this.constructor.creatureType;
	}

	get strengthModifier () {
		return this.options.strengthModifier;
	}

	get stats () {
		return `${super.stats}
+${this.strengthModifier} damage vs ${this.creatureType}`;
	}

	getDamageRoll (player, target) {
		if (target.name === this.creatureType) {
			return roll({ primaryDice: this.damageDice, modifier: player.strengthModifier + this.strengthModifier, bonusDice: player.bonusDamageDice });
		}

		return super.getDamageRoll(player, target);
	}
}

WoodenSpearCard.cardType = 'Wooden Spear';
WoodenSpearCard.creatureType = MINOTAUR;
WoodenSpearCard.probability = 60;
WoodenSpearCard.description = `A simple weapon fashioned for ${WoodenSpearCard.creatureType}-hunting.`;
WoodenSpearCard.cost = 6;
WoodenSpearCard.level = 1;
WoodenSpearCard.permittedClassesAndTypes = [FIGHTER];
WoodenSpearCard.defaults = {
	...HitCard.defaults,
	strengthModifier: 3
};

WoodenSpearCard.flavors = {
	hits: [
		['spears', 80],
		['stabs', 50],
		['chases into the bush and slaughters', 5]
	]
};

module.exports = WoodenSpearCard;
