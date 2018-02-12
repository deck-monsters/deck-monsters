/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { roll } = require('../helpers/chance');
const { GLADIATOR, MINOTAUR, BASILISK, JINN } = require('../constants/creature-types');
const { EPIC } = require('../helpers/probabilities');
const { EXPENSIVE } = require('../helpers/costs');
const { MELEE } = require('../constants/card-classes');

class CoilCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		freedomSavingThrowTargetAttr,
		icon = '➰',
		...rest
	} = {}) {
		super({ freedomSavingThrowTargetAttr, icon, ...rest });
	}

	getAttackRoll (player, target) {
		return roll({ primaryDice: this.attackDice, modifier: player.strModifier + this.getAttackModifier(target), bonusDice: player.bonusAttackDice, crit: true });
	}

	get stats () {
		return `Immobilize and hit your opponent by coiling your serpentine body around them and squeezing. If opponent is immune, hit instead.

${super.stats}`;
	}
}

CoilCard.cardClass = [MELEE];
CoilCard.cardType = 'Coil';
CoilCard.actions = { IMMOBILIZE: 'coil', IMMOBILIZES: 'coils', IMMOBILIZED: 'coiled' };
CoilCard.permittedClassesAndTypes = [BASILISK];
CoilCard.strongAgainstCreatureTypes = [GLADIATOR, MINOTAUR];
CoilCard.weakAgainstCreatureTypes = [BASILISK, JINN];
CoilCard.uselessAgainstCreatureTypes = [];
CoilCard.probability = EPIC.probability;
CoilCard.description = 'Coil around your enemies with your body, and squeeze.';
CoilCard.level = 0;
CoilCard.cost = EXPENSIVE.cost;
CoilCard.notForSale = true;

CoilCard.defaults = {
	...ImmobilizeCard.defaults,
	doDamageOnImmobilize: true,
	ongoingDamage: 1,
	freedomSavingThrowTargetAttr: 'dex'
};

CoilCard.flavors = {
	hits: [
		['squeezes', 80],
		['squeezes and squeezes', 50],
		['tightens so hard that anything on the inside that could easily come to the outside, well... _does_. This not only damages, but utterly humiliates', 5]
	]
};

module.exports = CoilCard;
