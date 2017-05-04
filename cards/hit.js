const BaseCard = require('./base');
const { roll } = require('../helpers/chance');

class HitCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			attackDice: '1d20',
			damageDice: '1d6'
		};

		super(Object.assign(defaultOptions, options));
	}

	get attackDice () {
		return this.options.attackDice;
	}

	get damageDice () {
		return this.options.damageDice;
	}

	get stats () {
		return `Attack: ${this.attackDice} / Damage: ${this.damageDice}`;
	}

	effect (player, target, game) { // eslint-disable-line no-unused-vars
		// Add any player modifiers and roll the dice
		const attackRoll = roll(this.attackDice + player.accuracyModifier);
		const damageRoll = roll(this.damageDice + player.damageModifier);

		this.emit('rolled', { attackRoll, damageRoll, player, target });

		// Compare the attack roll to AC
		if (target.ac <= attackRoll) {
			// If we hit then do some damage
			target.hit(damageRoll, player);
		} else {
			this.emit('miss', { attackRoll, player, target });
		}
	}
}

HitCard.cardType = 'Hit';
HitCard.probability = 80;
HitCard.description = 'A basic attack, the staple of all good monsters.';

module.exports = HitCard;
