const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');
const isProbable = require('../helpers/is-probable');

const delayTimes = require('../helpers/delay-times.js');

class CurseCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			weakenDice: '1d4',
			icon: '🤢',
			cursedProp: 'ac'
		};

		super(Object.assign(defaultOptions, options));
	}

	get weakenDice () {
		return this.options.weakenDice;
	}

	get stats () {
		return `Curse: ${this.weakenDice}`;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			const weakenRoll = roll({ primaryDice: this.weakenDice });
			let weakenResult = -weakenRoll.result;
			let strokeOfLuck = false;
			let curseOfLoki = false;
			let outcome = '';

			// Stroke of Luck
			if (isProbable({ probability: 1 })) {
				weakenResult = -max(this.weakenDice);
				weakenResult.result = weakenResult;
				strokeOfLuck = true;
				outcome = 'BLESSED! Max weaken!';
			} else if (isProbable({ probability: 10 })) {
				weakenResult = 0;
				weakenResult.result = weakenResult;
				curseOfLoki = true;
				outcome = 'CURSED! No effect.';
			}
			setTimeout(() => {
				this.emit('rolling', {
					reason: `for ${this.options.cursedProp.toUpperCase()} curse amount`,
					card: this,
					roll: weakenRoll,
					strokeOfLuck,
					curseOfLoki,
					player,
					target
				});

				setTimeout(() => {
					this.emit('rolled', {
						reason: `to weaken opponent's ${this.options.cursedProp.toUpperCase()}`,
						card: this,
						roll: weakenRoll,
						strokeOfLuck,
						curseOfLoki,
						player,
						target,
						outcome
					});


					setTimeout(() => {
						target.setCondition(this.options.cursedProp, weakenResult);

						resolve(true);
					}, delayTimes.mediumDelay());
				}, delayTimes.longDelay());
			}, delayTimes.longDelay());
		});
	}
}

CurseCard.cardType = 'Weaken';
CurseCard.probability = 10;
CurseCard.description = 'Sweep the leg... You have a problem with that? No mercy.';

module.exports = CurseCard;
