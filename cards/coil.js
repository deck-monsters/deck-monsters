/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { roll } = require('../helpers/chance');
const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');
const { EPIC } = require('../helpers/probabilities');
const { EXPENSIVE } = require('../helpers/costs');

class CoilCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '➰',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	getAttackRoll (player, target) {
		return roll({ primaryDice: this.attackDice, modifier: player.strModifier + this.getAttackModifier(target), bonusDice: player.bonusAttackDice, crit: true });
	}

	get stats () {
		return `${super.stats}
Chance to immobilize opponent by coiling your serpentine body around them and squeezing.`;
	}
}

CoilCard.cardType = 'Coil';
CoilCard.permittedClassesAndTypes = [BASILISK];
CoilCard.strongAgainstCreatureTypes = [GLADIATOR, MINOTAUR];
CoilCard.weakAgainstCreatureTypes = [BASILISK];
CoilCard.probability = EPIC.probability;
CoilCard.description = 'Your body is the weapon.';
CoilCard.level = 0;
CoilCard.cost = EXPENSIVE.cost;
CoilCard.notForSale = true;

CoilCard.defaults = {
	...ImmobilizeCard.defaults,
	doDamageOnImmobilize: true,
	ongoingDamage: 1,
	freedomThresholdModifier: 0
};
CoilCard.actions = ['coil', 'coils', 'coiled'];

CoilCard.flavors = {
	hits: [
		['squeezes', 80],
		['squeezes and squeezes', 50],
		['tightens so hard that anything on the inside that could easily come to the outside, well... _does_. This not only damages, but utterly humiliates', 5]
	]
};

module.exports = CoilCard;
