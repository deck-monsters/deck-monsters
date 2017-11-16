const HitCard = require('./hit');

class PoundCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageDice = '2d6', // Lucky you, the pound card does double damage
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

module.exports = PoundCard;
