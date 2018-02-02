/* eslint-disable max-len */
const ImmobilizeCard = require('./immobilize');

const { COMMON } = require('../helpers/probabilities');
const { VERY_CHEAP } = require('../helpers/costs');
const { TARGET_ALL_CONTESTANTS, getTarget } = require('../helpers/targeting-strategies');

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

	get stats () {
		return `Immobilize everyone.

${super.stats}`;
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return getTarget({
			contestants: activeContestants,
			ignoreSelf: false,
			playerMonster: player,
			strategy: TARGET_ALL_CONTESTANTS
		}).map(({ monster }) => monster);
	}
}

MesmerizeCard.cardType = 'Mesmerize';
MesmerizeCard.actions = { IMMOBILIZE: 'mesmerize', IMMOBILIZES: 'mesmerizes', IMMOBILIZED: 'mesmerized' };
MesmerizeCard.permittedClassesAndTypes = [WEEPING_ANGEL];
MesmerizeCard.strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
MesmerizeCard.weakAgainstCreatureTypes = [MINOTAUR, WEEPING_ANGEL];
MesmerizeCard.uselessAgainstCreatureTypes = [JINN];
MesmerizeCard.probability = COMMON.probability;
MesmerizeCard.description = `You strut and preen. Your beauty ${MesmerizeCard.actions.IMMOBILIZES} everyone, including yourself.`;
MesmerizeCard.cost = VERY_CHEAP.cost;
MesmerizeCard.isAreaOfEffect = true;

MesmerizeCard.defaults = {
	...ImmobilizeCard.defaults,
	freedomSavingThrowTargetAttr: 'int',
	targetProp: 'int'
};

MesmerizeCard.flavors = {
	hits: [
		['overwhelms', 80],
		['uses their natural beauty to overwhelm', 30],
		['stuns', 30]
	]
};

module.exports = MesmerizeCard;
