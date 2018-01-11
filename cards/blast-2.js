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
		return `Blast II: Does damage equal to spell bonus of caster`;
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return activeContestants.map(({ monster }) => monster).filter(target => target !== player);
	}

	effect (player, target) {
		return target.hit(player.intModifier, player, this);
	}
}

Blast2Card.cardType = 'Blast II';
Blast2Card.probability = 40;
Blast2Card.level = 1;

module.exports = Blast2Card;
