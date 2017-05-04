const BaseCard = require('./base');
const { roll } = require('../helpers/chance');
const isProbable = require('../helpers/is-probable');

class CurseCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			weakenDice: '1d4'
		};

		super(Object.assign(defaultOptions, options));
	}

	get weakenDice () {
		return this.options.weakenDice;
	}

	get stats () {
		return `Curse: ${this.weakenDice}`;
	}

	effect (player, target, game) { // eslint-disable-line no-unused-vars
		const weakenRoll = roll({ primaryDice: this.weakenDice });
		let weakenResult = 0 - weakenRoll.result;
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
			curseOfLoki,
			player,
			strokeOfLuck,
			target,
			weakenResult,
			weakenRoll
		});

		target.condition('ac', weakenResult);
	}
}

CurseCard.cardType = 'Weaken';
CurseCard.probability = 10;
CurseCard.description = 'Sweep the leg... You have a problem with that? No mercy.';

module.exports = CurseCard;
