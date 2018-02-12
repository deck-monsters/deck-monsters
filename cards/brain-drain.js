/* eslint-disable max-len */

const CurseCard = require('./curse');
const HitCard = require('./hit');

const { max } = require('../helpers/chance');
const { PSYCHIC } = require('./helpers/constants');
const { REASONABLE } = require('../helpers/costs');

const STATS = require('../helpers/stat-constants');

class BrainDrainCard extends CurseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🤡',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () {
		const hit = new HitCard({ damageDice: this.damageDice });
		let stats = `Curse: ${this.cursedProp} ${this.curseAmount}
can reduce ${this.cursedProp} down to ${STATS.MAX_PROP_MODIFICATIONS[this.cursedProp]}, then takes ${max(this.damageDice)} from hp instead.`;

		if (this.hasChanceToHit) {
			stats = `${hit.stats}
${stats}`;
		}

		return stats;
	}
}

BrainDrainCard.cardClass = [PSYCHIC];
BrainDrainCard.cardType = 'Brain Drain';
BrainDrainCard.description = 'And we shall bury our enemies in their own confusion.';
BrainDrainCard.cost = REASONABLE.cost;

BrainDrainCard.defaults = {
	...CurseCard.defaults,
	curseAmount: -20,
	cursedProp: 'xp'
};

module.exports = BrainDrainCard;
