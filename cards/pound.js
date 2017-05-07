const HitCard = require('./hit');

class PoundCard extends HitCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			damageDice: '2d6', // Lucky you, the pound card does double damage
			icon: '⚒'
		};

		super(Object.assign(defaultOptions, options));
	}
}

PoundCard.cardType = 'Pound';
PoundCard.probability = 10;
PoundCard.description = 'You wield the mighty pound card and can do double the damage.';

module.exports = PoundCard;
