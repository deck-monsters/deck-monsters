/* eslint-disable max-len */
const Promise = require('bluebird');

const ImmobilizeCard = require('./immobilize');

const { roll } = require('../helpers/chance');
const { COMMON } = require('../helpers/probabilities');
const { VERY_CHEAP } = require('../helpers/costs');

const {
	BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL
} = require('../helpers/creature-types');


class MesmerizeCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		freedomSavingThrowTargetAttr,
		icon = '🌠',
		...rest
	} = {}) {
		super({ freedomSavingThrowTargetAttr, icon, ...rest });
	}

	getAttackRoll (player, target) {
		return roll({ primaryDice: this.attackDice, modifier: player.intModifier + this.getAttackModifier(target), bonusDice: player.bonusAttackDice, crit: true });
	}

	getTargetPropValue (target) { // eslint-disable-line class-methods-use-this
		return target.int;
	}

	effect (player, target, ring, activeContestants) {
		return Promise.map(activeContestants, ({ monster }) => super.effect(player, monster, ring, activeContestants))
			.then(() => !target.dead);
	}
}

MesmerizeCard.cardType = 'Mesmerize';
MesmerizeCard.actions = { IMMOBILIZE: 'mesmerize', IMMOBILIZES: 'mesmerizes', IMMOBILIZED: 'mesmerized' };
MesmerizeCard.permittedClassesAndTypes = [WEEPING_ANGEL];
MesmerizeCard.strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
MesmerizeCard.weakAgainstCreatureTypes = [JINN, MINOTAUR, WEEPING_ANGEL];
MesmerizeCard.uselessAgainstCreatureTypes = [];
MesmerizeCard.probability = COMMON.probability;
MesmerizeCard.description = `You strut and preen. Your beauty ${MesmerizeCard.actions.IMMOBILIZES} everyone, including yourself.`;
MesmerizeCard.cost = VERY_CHEAP.cost;

MesmerizeCard.defaults = {
	...ImmobilizeCard.defaults,
	freedomSavingThrowTargetAttr: 'int'
};

MesmerizeCard.flavors = {
	hits: [
		['overwhelms', 80],
		['uses their natural beauty to overwhelm', 30],
		['stuns', 30]
	]
};

module.exports = MesmerizeCard;
