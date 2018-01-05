/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');

class ConstrictCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackModifier,
		hitOnFail,
		icon = '➰',
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
Chance to immobilize opponent by coiling your serpentine body around them and then squeezing.`;
	}
}

ConstrictCard.cardType = 'Constrict';
ConstrictCard.strongAgainstCreatureTypes = [GLADIATOR, MINOTAUR];
ConstrictCard.probability = 30;
ConstrictCard.description = 'Your body is the weapon.';
ConstrictCard.permittedClassesAndTypes = [BASILISK];
ConstrictCard.weakAgainstCreatureTypes = [BASILISK];
ConstrictCard.defaults = {
	...ImmobilizeCard.defaults,
	doDamageOnImmobilize: true,
	freedomThresholdModifier: 3
};
ConstrictCard.actions = ['constrict', 'constricts', 'constricted'];

ConstrictCard.flavors = {
	hits: [
		[`${ConstrictCard.actions[1]}`, 80],
		['squeezes and squeezes', 50],
		['tightens so hard that anything on the inside that could easily come to the outside, well... _does_. This not only damages, but utterly humiliates', 5]
	]
};

module.exports = ConstrictCard;
