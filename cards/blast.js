/* eslint-disable max-len */

const BaseCard = require('./base');

const { CLERIC } = require('../helpers/classes');

class BlastCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damage,
		icon = '💥',
		levelDamage
	} = {}) {
		super({ damage, icon, levelDamage });
	}

	get damage () {
		return this.options.damage;
	}

	get levelDamage () {
		return this.options.levelDamage;
	}

	get stats () {
		return `Blast: ${this.damage} base damage +${this.levelDamage} per level of the caster`;
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return activeContestants.map(({ monster }) => monster).filter(target => target !== player);
	}

	effect (player, target) {
		const damage = this.damage + (this.levelDamage * player.level);

		return target.hit(damage, player, this);
	}
}

BlastCard.cardType = 'Blast';
BlastCard.permittedClassesAndTypes = [CLERIC];
BlastCard.probability = 60;
BlastCard.description = 'A magical blast against every opponent in the encounter.';
BlastCard.level = 0;
BlastCard.cost = 30;

BlastCard.defaults = {
	damage: 3,
	levelDamage: 1
};

BlastCard.flavors = {
	hits: [
		['blasts', 80],
		['sends a magical blast hurtling into', 70],
		['invokes an ancient spell against', 70],
		['incinerates', 50],
		['farts in the general direction of', 5]
	]
};

module.exports = BlastCard;
