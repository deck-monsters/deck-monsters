/* eslint-disable max-len */

const ImmobilizeCard = require('./immoblize');

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');
const { DEFENSE_PHASE } = require('../helpers/phases');
const { roll } = require('../helpers/chance');

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
Chance to immobilize opponent by coiling around them and then squeezing.`;
	}

ConstrictCard.cardType = 'Constrict';
ConstrictCard.strongAgainstCreatureTypes = [GLADIATOR, MINOTAUR];
ConstrictCard.probability = 30;
ConstrictCard.description = `Your body _is_ the weapon`;
ConstrictCard.permittedClassesAndTypes = [BASILISK];
ConstrictCard.weakAgainstCreatureTypes = [BASILISK];
ConstrictCard.defaults = {
	...HitCard.defaults,
	attackModifier: 2,
	alwaysDoDamage: true,
	hitOnFail: false
};
ConstrictCard.action = ["constrict", "constricts", "constricted"];

ConstrictCard.flavors = {
	hits: [
		[`${ConstrictCard.action[1]}`, 80],
		['squeezes and squeezes', 50],
		['tightens so hard that anything on the inside that could easily come to the outside, well... _does_', 5]
	]
};

module.exports = ConstrictCard;
