const HitCard = require('./hit');

class PoundCard extends HitCard {
	constructor (options) {
		super(options);

		// Lucky you, the pound card does double damage
		this.damageDice = '2d6';
	}
}

PoundCard.probability = 10;
PoundCard.description = 'You wield the mighty pound card and can do double the damage.';

module.exports = PoundCard;
