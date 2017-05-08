const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');
const isProbable = require('../helpers/is-probable');

class CurseCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			weakenDice: '1d4',
			icon: '🤢'
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

			// Stroke of Luck
			if (isProbable({ probability: 1 })) {
				weakenResult = -max(this.weakenDice);
				strokeOfLuck = true;
			} else if (isProbable({ probability: 10 })) {
				weakenResult = 0;
				curseOfLoki = true;
			}

			this.emit('rolled', {
				card: this,
				roll: weakenRoll,
				strokeOfLuck,
				curseOfLoki,
				player,
				target
			});

			target.setCondition('ac', weakenResult);

			resolve(true);
		});
	}
}

CurseCard.cardType = 'Weaken';
CurseCard.probability = 10;
CurseCard.description = 'Sweep the leg... You have a problem with that? No mercy.';

module.exports = CurseCard;
