/* eslint-disable max-len */

const BlastCard = require('./blast');

const { UNCOMMON } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class Blast2Card extends BlastCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damage,
		icon = '💥',
		levelDamage
	} = {}) {
		super({ damage, icon, levelDamage });
	}

	get stats () {
		return `Blast II: ${this.damage} base damage + int bonus of caster`;
	}

	effect (player, target) {
		const damage = this.damage + player.intModifier;
		return target.hit(damage, player, this);
	}
}

Blast2Card.cardType = 'Blast II';
Blast2Card.description = 'A strong magical blast against every opponent in the encounter.';
Blast2Card.probability = UNCOMMON.probability;
Blast2Card.level = 2;
Blast2Card.cost = PRICEY.cost;
Blast2Card.notForSale = true;

Blast2Card.defaults = {
	damage: 3
};

module.exports = Blast2Card;
