/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const MesmerizeCard = require('./mesmerize');

const { UNCOMMON } = require('../helpers/probabilities');
const { REASONABLE } = require('../helpers/costs');

const {
	BASILISK,
	GLADIATOR,
	JINN,
	MINOTAUR,
	WEEPING_ANGEL
} = require('../helpers/creature-types');

class EnthrallCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🎇',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.mesmerizeCard = new MesmerizeCard();
	}

	getFreedomThresholdBase (player) {
		return this.mesmerizeCard.getFreedomThresholdBase(player);
	}

	getAttackRoll (player, target) {
		return this.mesmerizeCard.getAttackRoll(player, target);
	}

	getTargetPropValue (target) {
		return this.mesmerizeCard.getTargetPropValue(target);
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return activeContestants.map(({ monster }) => monster).filter(target => target !== player);
	}
}

EnthrallCard.cardType = 'Enthrall';
EnthrallCard.actions = { IMMOBILIZE: 'enthrall', IMMOBILIZES: 'enthralls', IMMOBILIZED: 'enthralled' };
EnthrallCard.permittedClassesAndTypes = [JINN, WEEPING_ANGEL];
EnthrallCard.strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
EnthrallCard.weakAgainstCreatureTypes = [MINOTAUR, WEEPING_ANGEL];
EnthrallCard.uselessAgainstCreatureTypes = [JINN];
EnthrallCard.probability = UNCOMMON.probability;
EnthrallCard.description = `You strut and preen. Your beauty ${EnthrallCard.actions.IMMOBILIZES} everyone, except yourself.`;
EnthrallCard.level = 2;
EnthrallCard.cost = REASONABLE.cost;

EnthrallCard.defaults = {
	...ImmobilizeCard.defaults
};

EnthrallCard.flavors = {
	hits: [
		['stuns', 80],
		['uses their natural beauty to incapacitate', 30],
		['burns even Narcissus himself with their beauty... Which leaves no hope for', 5]
	]
};

module.exports = EnthrallCard;
