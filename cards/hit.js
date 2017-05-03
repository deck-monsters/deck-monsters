const BaseCard = require('./base');
const { roll } = require('../helpers/chance');

class HitCard extends BaseCard {
	constructor (options) {
		super(options);

		// For now, we'll say that all hit cards have the same basic properties
		this.attackDice = '1d20';
		this.damageDice = '1d6';
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
			target.hit(damageRoll);
		}
	}
}

HitCard.probability = 80;
HitCard.description = 'A basic attack, the staple of all good monsters.';

module.exports = HitCard;
