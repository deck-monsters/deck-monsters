const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');
const isProbable = require('../helpers/is-probable');

class BoostCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			boostDice: '1d4'
		};

		super(Object.assign(defaultOptions, options));
	}

	// This doesn't have to be static if it needs access to the instance
	static effect (player, target, game) { // eslint-disable-line no-unused-vars
		let boostRoll = roll(this.boostDice);
		let strokeOfLuck = false;
		let curseOfLoki = false;

		// Stroke of Luck
		if (isProbable({ probability: 1 })) {
			boostRoll += max(this.boostDice);
			strokeOfLuck = true;
		} else if (isProbable({ probability: 10 })) {
			boostRoll = 0;
			curseOfLoki = true;
		}

		this.emit('rolled', { boostRoll, player, strokeOfLuck, curseOfLoki });

		player.condition('ac', boostRoll);
	}
}

BoostCard.cardType = 'Harden';
BoostCard.probability = 10;
BoostCard.description = "It's time to put on your big boy pants, and toughen up!";

module.exports = BoostCard;
