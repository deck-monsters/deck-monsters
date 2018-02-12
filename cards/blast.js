/* eslint-disable max-len */

const BaseCard = require('./base');

const { AOE } = require('../constants/card-classes');
const { CLERIC } = require('../constants/creature-classes');
const { ABUNDANT } = require('../helpers/probabilities');
const { REASONABLE } = require('../helpers/costs');
const { TARGET_ALL_CONTESTANTS, getTarget } = require('../helpers/targeting-strategies');

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
		return getTarget({
			contestants: activeContestants,
			playerMonster: player,
			strategy: TARGET_ALL_CONTESTANTS
		}).map(({ monster }) => monster);
	}

	effect (player, target) {
		const damage = this.damage + (this.levelDamage * player.level);

		return target.hit(damage, player, this);
	}
}

BlastCard.cardClass = [AOE];
BlastCard.cardType = 'Blast';
BlastCard.permittedClassesAndTypes = [CLERIC];
BlastCard.probability = ABUNDANT.probability;
BlastCard.description = 'A magical blast against every opponent in the encounter.';
BlastCard.level = 0;
BlastCard.cost = REASONABLE.cost;

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
