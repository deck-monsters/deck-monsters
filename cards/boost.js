const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');
const isProbable = require('../helpers/is-probable');

const delayTimes = require('../helpers/delay-times.js');

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
			let outcome = '';

			// Stroke of Luck
			if (isProbable({ probability: 1 })) {
				boostResult += max(this.boostDice);
				boostRoll.result = boostResult;
				strokeOfLuck = true;
				outcome = 'BLESSED! Max boost!';
			} else if (isProbable({ probability: 10 })) {
				boostResult = 0;
				boostRoll.result = boostResult;
				curseOfLoki = true;
				outcome = 'CURSED! No effect.';
			}
			setTimeout(() => {
				this.emit('rolling', {
					reason: `for ${this.options.boostedProp.toUpperCase()} boost amount`,
					card: this,
					roll: boostRoll,
					strokeOfLuck,
					curseOfLoki,
					player,
					target
				});

				setTimeout(() => {
					this.emit('rolled', {
						reason: `to boost ${this.options.boostedProp.toUpperCase()}`,
						card: this,
						roll: boostRoll,
						strokeOfLuck,
						curseOfLoki,
						player,
						target,
						outcome
					});

					setTimeout(() => {
						player.setCondition(this.options.boostedProp, boostResult);

						resolve(true);
					}, delayTimes.mediumDelay());
				}, delayTimes.longDelay());
			}, delayTimes.longDelay());
		});
	}
}

BoostCard.cardType = 'Harden';
BoostCard.probability = 10;
BoostCard.description = "It's time to put on your big boy pants, and toughen up!";

module.exports = BoostCard;
