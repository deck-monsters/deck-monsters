/* eslint-disable max-len */

const BlastCard = require('./blast');

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
		return `Blast II: ${this.damage} base damage +spell bonus of caster`;
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return activeContestants.map(({ monster }) => monster).filter(target => target !== player);
	}

	effect (player, target) {
		const damage = this.damage + player.intModifier;
		return target.hit(damage, player, this);
	}
}

Blast2Card.cardType = 'Blast II';
Blast2Card.probability = 50;
Blast2Card.level = 1;
Blast2Card.defaults = {
	damage: 3
};

module.exports = Blast2Card;
