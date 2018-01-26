const HitCard = require('./hit');

const { BARD, BARBARIAN } = require('../helpers/classes');
const { VERY_RARE } = require('../helpers/probabilities');
const { EXPENSIVE } = require('../helpers/costs');

class PoundCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageDice,
		icon = '⚒',
		...rest
	} = {}) {
		super({ damageDice, icon, ...rest });
	}
}

PoundCard.cardType = 'Pound';
PoundCard.permittedClassesAndTypes = [BARD, BARBARIAN];
PoundCard.probability = VERY_RARE.probability;
PoundCard.description = 'You wield the mighty pound card and can do double the damage.';
PoundCard.level = 3;
PoundCard.cost = EXPENSIVE.cost;
PoundCard.notForSale = true;

PoundCard.defaults = {
	...HitCard.defaults,
	damageDice: '2d6' // Lucky you, the pound card does double damage
};

PoundCard.flavors = {
	hits: [
		['pounds', 80],
		['mercilessly beats', 70],
		['trashes', 70],
		['clubs', 50],
		['performs a vicious wedgie on', 5]
	]
};

module.exports = PoundCard;
