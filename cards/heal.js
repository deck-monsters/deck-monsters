const BaseCard = require('./base');
const { roll } = require('../helpers/chance');
const isProbable = require('../helpers/is-probable');

class HealCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			healthDice: '1d4'
		};

		super(Object.assign(defaultOptions, options));
	}

	get healthDice () {
		return this.options.healthDice;
	}

	get stats () {
		return `Health: ${this.healthDice} / Possible Stroke of Luck`;
	}

	// This doesn't have to be static if it needs access to the instance
	effect (player, target, game) { // eslint-disable-line no-unused-vars
		let healRoll = roll(this.healthDice);
		let strokeOfLuck = false;

		// Stroke of Luck
		if (isProbable({ probability: 1 })) {
			healRoll = player.maxHp;
			strokeOfLuck = true;
		}

		this.emit('rolled', { healRoll, player, strokeOfLuck });

		player.heal(healRoll);
	}
}

HealCard.cardType = 'Heal';
HealCard.probability = 60;
HealCard.description = 'A well-timed healing can be the difference between sweet victory and devastating defeat.';

module.exports = HealCard;
