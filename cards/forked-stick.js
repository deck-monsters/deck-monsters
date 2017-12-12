/* eslint-disable max-len */

const ImmobilizeCard = require('./immoblize');

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');
const { DEFENSE_PHASE } = require('../helpers/phases');
const { roll } = require('../helpers/chance');

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
Chance to immobilize opponent by capturing their neck between prongs.

Small chance to do damage.`;
	}

ForkedStickCard.cardType = 'Forked Stick';
ForkedStickCard.strongAgainstCreatureTypes = [GLADIATOR, BASILISK];
ForkedStickCard.probability = 30;
ForkedStickCard.description = `A simple weapon fashioned for ${ForkedStickCard.creatureType[1]}-hunting.`;
ForkedStickCard.permittedClasses = [FIGHTER, BARBARIAN];
ForkedStickCard.weakAgainstCreatureTypes = [MINOTAUR];
ForkedStickCard.defaults = {
	...HitCard.defaults,
	attackModifier: 2,
	hitOnFail: false
};
ForkedStickCard.action = ["pin", "pins", "pinned"];

ForkedStickCard.flavors = {
	hits: [
		[`${ForkedStickCard.action[1]} head to the ground`, 80],
		[`${ForkedStickCard.action[1]} neck to the wall`, 50],
		['in a fit of brute strength, snags by the neck, and brutally lofts into the air, where they dangle like a toddler\'s booger', 5]
	]
};

module.exports = ForkedStickCard;
