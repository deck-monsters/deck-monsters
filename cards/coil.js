/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');

class CoilCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '➰',
		...rest
	} = {}) {
		super({ icon, ...rest });
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
CoilCard.probability = 5;
CoilCard.description = 'Your body is the weapon.';
CoilCard.level = 0;
CoilCard.cost = 80;

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
