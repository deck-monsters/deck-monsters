const CurseCard = require('./curse');
const HitCard = require('./hit');

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
(up to a maximum total of pre-battle XP - ${STATS.MAX_PROP_MODIFICATIONS[this.cursedProp]})`;

		if (this.hasChanceToHit) {
			stats = `${hit.stats}
${stats}`;
		}

		return stats;
	}
}

BrainDrainCard.cardType = 'Brain Drain';
BrainDrainCard.description = 'And we shall bury our enemies in their own confusion.';
BrainDrainCard.cost = REASONABLE.cost;

BrainDrainCard.defaults = {
	...CurseCard.defaults,
	curseAmount: -20,
	cursedProp: 'xp'
};

module.exports = BrainDrainCard;
