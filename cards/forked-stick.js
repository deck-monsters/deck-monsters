/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');

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
ForkedStickCard.strongAgainstCreatureTypes = [GLADIATOR, BASILISK];
ForkedStickCard.probability = 30;
ForkedStickCard.description = `A simple weapon fashioned for ${ForkedStickCard.strongAgainstCreatureTypes.join(' and ')}-hunting.`;
ForkedStickCard.permittedClassesAndTypes = [FIGHTER, BARBARIAN];
ForkedStickCard.weakAgainstCreatureTypes = [MINOTAUR];
ForkedStickCard.defaults = {
	...ImmobilizeCard.defaults
};
ForkedStickCard.actions = ['pin', 'pins', 'pinned'];

ForkedStickCard.flavors = {
	hits: [
		['hits', 80],
		['pokes (in a not-so-facebook-flirting kind of way)', 50],
		['snags and brutally lofts into the air their thoroughly surprised opponent', 5]
	]
};

module.exports = ForkedStickCard;
