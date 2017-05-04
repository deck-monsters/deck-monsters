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

	static effect (player, target, game) { // eslint-disable-line no-unused-vars
		let weakenRoll = roll(this.healthDice);
		let strokeOfLuck = false;
		let curseOfLoki = false;

		// Stroke of Luck
		if (isProbable({ probability: 1 })) {
			weakenRoll = 6;
			strokeOfLuck = true;
		} else if (isProbable({ probability: 10 })) {
			weakenRoll = 0;
			curseOfLoki = true;
		}

		this.emit('rolled', { weakenRoll, player, strokeOfLuck, curseOfLoki });

		target.condition('ac', weakenRoll);
	}
}

CurseCard.cardType = 'Weaken';
CurseCard.probability = 10;
CurseCard.description = "Sweep the leg... You have a problem with that? No mercy.";

module.exports = CurseCard;
