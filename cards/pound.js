const HitCard = require('./hit');
const { BARBARIAN } = require('../helpers/classes');

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
PoundCard.probability = 10;
PoundCard.description = 'You wield the mighty pound card and can do double the damage.';
PoundCard.cost = 8;
PoundCard.level = 3;
PoundCard.permittedClasses = [BARBARIAN];
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
