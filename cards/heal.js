const BaseCard = require('./base');
const { roll, percent } = require('../helpers/chance');

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

		this.emit('rolled', { healRoll, player });

		// Stroke of Luck
		if (percent() === 100) {
			healRoll = player.maxHp;
		}

		player.heal(healRoll);
	}
}

HealCard.probability = 60;
HealCard.description = 'A well-timed healing can be the difference between sweet victory and devastating defeat.';

module.exports = HealCard;
