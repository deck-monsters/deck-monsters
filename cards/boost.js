const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');
const isProbable = require('../helpers/is-probable');

class BoostCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			boostDice: '1d4',
			icon: '🆙',
			boostedProp: 'ac'
		};

		super(Object.assign(defaultOptions, options));
	}

	get boostDice () {
		return this.options.boostDice;
	}

	get stats () {
		return `Boost: ${this.boostDice}`;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
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
				reason: `to determine how much to boost ${this.options.boostedProp.toUpperCase()} by`,
				card: this,
				roll: boostRoll,
				strokeOfLuck,
				curseOfLoki,
				player,
				target,
				outcome: ''
			});

			player.setCondition(this.options.boostedProp, boostResult);

			resolve(true);
		});
	}
}

BoostCard.cardType = 'Harden';
BoostCard.probability = 10;
BoostCard.description = "It's time to put on your big boy pants, and toughen up!";

module.exports = BoostCard;
