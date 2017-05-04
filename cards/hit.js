const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');

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
		let strokeOfLuck = false;
		let curseOfLoki = false;
		const attackRoll = roll(this.attackDice);

		let damageRoll = roll(this.damageDice);
		if (attackRoll.naturalRoll === max(this.attackDice)) {
			strokeOfLuck = true;
			damageRoll = max(this.damageDice) * 2;
		} else if (attackRoll.naturalRoll === 1) {
			curseOfLoki = true;
		}

		this.emit('rolled', { attackRoll, damageRoll, player, target, strokeOfLuck, curseOfLoki });

		// Compare the attack roll to AC
		if (strokeOfLuck || (!curseOfLoki && target.ac <= attackRoll)) {
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
