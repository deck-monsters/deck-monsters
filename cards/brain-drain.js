/* eslint-disable max-len */

const CurseCard = require('./curse');
const HitCard = require('./hit');

const { CLERIC } = require('../constants/creature-classes');
const { JINN } = require('../constants/creature-types');
const { max } = require('../helpers/chance');
const { PSYCHIC } = require('../constants/card-classes');
const { REASONABLE } = require('../helpers/costs');
const STATS = require('../constants/stats');

class BrainDrainCard extends CurseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🤡',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () {
		const hit = new HitCard(this.options);
		let stats = `Curse: ${this.cursedProp} ${this.curseAmount}
Can reduce ${this.cursedProp} down to ${STATS.MAX_PROP_MODIFICATIONS[this.cursedProp]}, then takes ${max(this.damageDice)} from hp instead.`;

		if (this.hasChanceToHit) {
			stats = `${hit.stats}
${stats}`;
		}

		return stats;
	}
}

BrainDrainCard.cardClass = [PSYCHIC];
BrainDrainCard.cardType = 'Brain Drain';
BrainDrainCard.permittedClassesAndTypes = [CLERIC, JINN];
BrainDrainCard.description = 'And we shall bury our enemies in their own confusion.';
BrainDrainCard.cost = REASONABLE.cost;

BrainDrainCard.defaults = {
	...CurseCard.defaults,
	curseAmount: -20,
	cursedProp: 'xp',
	targetProp: 'int'
};

module.exports = BrainDrainCard;
