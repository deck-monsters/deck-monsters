/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');

class ForkedStickCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackModifier,
		hitOnFail,
		icon = '⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			attackModifier,
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
ForkedStickCard.description = `A simple weapon fashioned for ${ForkedStickCard.strongAgainstCreatureTypes[1]}-hunting.`;
ForkedStickCard.permittedClassesAndTypes = [FIGHTER, BARBARIAN];
ForkedStickCard.weakAgainstCreatureTypes = [MINOTAUR];
ForkedStickCard.defaults = {
	...ImmobilizeCard.defaults
};
ForkedStickCard.actions = ['pin', 'pins', 'pinned'];

ForkedStickCard.flavors = {
	hits: [
		[`${ForkedStickCard.actions[1]} to the ground, the head of`, 80],
		[`${ForkedStickCard.actions[1]} to the wall, the neck of`, 50],
		['in a fit of brute strength, snags by the neck, and brutally lofts into the air, where they dangle like a toddler\'s booger', 5]
	]
};

module.exports = ForkedStickCard;
