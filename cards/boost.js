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

	get boostDice () {
		return this.options.boostDice;
	}

	get stats () {
		return `Boost: ${this.boostDice}`;
	}

	effect (player, target, game) { // eslint-disable-line no-unused-vars
		const boostRoll = roll({ primaryDice: this.boostDice });
		let boostResult = boostRoll.result;
		let strokeOfLuck = false;
		let curseOfLoki = false;

		// Stroke of Luck
		if (isProbable({ probability: 1 })) {
			boostResult += max(this.boostDice);
			strokeOfLuck = true;
		} else if (isProbable({ probability: 10 })) {
			boostResult = 0;
			curseOfLoki = true;
		}

		this.emit('rolled', {
			boostResult,
			boostRoll,
			curseOfLoki,
			player,
			strokeOfLuck
		});

		player.setCondition('ac', boostResult);
	}
}

BoostCard.cardType = 'Harden';
BoostCard.probability = 10;
BoostCard.description = "It's time to put on your big boy pants, and toughen up!";

module.exports = BoostCard;
