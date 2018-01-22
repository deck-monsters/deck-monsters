/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { BARD, BARBARIAN, FIGHTER } = require('../helpers/classes');
const { BASILISK, GLADIATOR, JINN, MINOTAUR } = require('../helpers/creature-types');
const { UNCOMMON } = require('../helpers/probabilities');

class ForkedStickCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		dexModifier,
		hitOnFail,
		icon = '⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			dexModifier,
			hitOnFail
		});
	}
	get stats () {
		return `${super.stats}
Attempt to pin your opponent between the branches of a forked stick.`;
	}
}

ForkedStickCard.cardType = 'Forked Stick';
ForkedStickCard.actions = ['pin', 'pins', 'pinned'];
ForkedStickCard.permittedClassesAndTypes = [BARD, BARBARIAN, FIGHTER];
ForkedStickCard.strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
ForkedStickCard.weakAgainstCreatureTypes = [JINN, MINOTAUR];
ForkedStickCard.probability = UNCOMMON.probability;
ForkedStickCard.description = `A simple weapon fashioned for ${ForkedStickCard.strongAgainstCreatureTypes.join(' and ')}-hunting.`;
ForkedStickCard.cost = 20;

ForkedStickCard.defaults = {
	...ImmobilizeCard.defaults
};

ForkedStickCard.flavors = {
	hits: [
		['hits', 80],
		['pokes (in a not-so-facebook-flirting kind of way)', 50],
		['snags and brutally lofts into the air their thoroughly surprised opponent', 5]
	],
	spike: 'branch'
};

module.exports = ForkedStickCard;
