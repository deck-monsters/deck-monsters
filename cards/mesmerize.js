/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const {
	GLADIATOR, MINOTAUR, BASILISK, WEEPING_ANGEL
} = require('../helpers/creature-types');

class MesmerizeCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackModifier,
		hitOnFail,
		icon = '🌠',
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
Chance to immobilize everyone with your shocking beauty.`;
	}

	getFreedomThreshold () {
		return 10 + this.freedomThresholdModifier;
	}
}

MesmerizeCard.cardType = 'Mesmerize';
MesmerizeCard.strongAgainstCreatureTypes = [GLADIATOR, BASILISK];
MesmerizeCard.probability = 30;
MesmerizeCard.description = 'You strut and preen. Your beauty overwhelms and mesmerizes everyone, including yourself.';
MesmerizeCard.permittedClassesAndTypes = [WEEPING_ANGEL];
MesmerizeCard.weakAgainstCreatureTypes = [MINOTAUR, WEEPING_ANGEL];
MesmerizeCard.defaults = {
	...ImmobilizeCard.defaults,
	attackModifier: 2,
	hitOnFail: false,
	freedomThresholdModifier: 0,
	affectAll: true
};
MesmerizeCard.action = ['mesmerize', 'mesmerizes', 'mesmerized'];

MesmerizeCard.flavors = {
	hits: [
		['You mesmerize your adversaries', 80],
		['Your natural beauty overwhelmes your enemies', 30],
		['Narcisus himself would be distracted by your beauty... and that\'s when you hit.', 5]
	]
};

module.exports = MesmerizeCard;
