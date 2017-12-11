/* eslint-disable max-len */

const HitCard = require('./hit');

const { FIGHTER } = require('../helpers/classes');
const { MINOTAUR, BASILISK } = require('../helpers/creature-types');
const { roll } = require('../helpers/chance');

class ForkedStickCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageModifier,
		attackModifier,
		icon = '⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			damageModifier,
			attackModifier
		});
	}

	get creatureType () {
		return this.constructor.creatureType;
	}

	get weakAgainstCreatureType () {
		return this.constructor.weakAgainstCreatureType;
	}

	get damageModifier () {
		return this.options.damageModifier;
	}

	get attackModifier () {
		return this.options.attackModifier;
	}

	getDamageModifier (target) {
		if (target.name === this.creatureType) {
			return this.options.damageModifier;
		} else if (target.name === this.weakAgainstCreatureType) {
			return -this.options.damageModifier;
		} else {
			return 0;
		}
	}

	get stats () {
		return `${super.stats}
Hit: ${this.attackDice}+${this.attackModifier} vs AC / Damage: ${this.damageDice}+${this.damageModifier} vs ${this.creatureType}
Hit: ${this.attackDice}+${this.attackModifier} vs AC / Damage: ${this.damageDice}-${this.damageModifier} vs ${this.weakAgainstCreatureType}`;
	}

	getAttackRoll (player) {
		return roll({ primaryDice: this.attackDice, modifier: player.attackModifier + this.attackModifier, bonusDice: player.bonusAttackDice });
	}

	getDamageRoll (player, target) {
		return roll({ primaryDice: this.damageDice, modifier: player.damageModifier + this.getDamageModifier(target), bonusDice: player.bonusDamageDice });
	}
}

ForkedStickCard.cardType = 'Forked Stick';
ForkedStickCard.creatureType = BASILISK;
ForkedStickCard.probability = 30;
ForkedStickCard.description = `A simple weapon fashioned for ${ForkedStickCard.creatureType}-hunting.`;
ForkedStickCard.cost = 6;
ForkedStickCard.level = 1;
ForkedStickCard.permittedClasses = [FIGHTER, MINOTAUR];
ForkedStickCard.weakAgainstCreatureType = MINOTAUR;
ForkedStickCard.defaults = {
	...HitCard.defaults,
	damageModifier: 1,
	attackModifier: 2
};

ForkedStickCard.flavors = {
	hits: [
		['pins head to the ground, and stomps mercilessly', 80],
		['bludgeons', 50],
		['catches body, thrusts into air, and flings into the arena wall with a wet thud and several bone snapping crunches', 5]
	]
};

module.exports = ForkedStickCard;
