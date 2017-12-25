const HitCard = require('./hit');

class CurseCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		curseAmount,
		icon = '😖',
		cursedProp,
		hasChanceToHit,
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			hasChanceToHit,
			cursedProp,
			curseAmount
		});
	}

	get hasChanceToHit () {
		return this.options.hasChanceToHit;
	}

	get curseAmount () {
		return this.options.curseAmount;
	}

	get cursedProp () {
		return this.options.cursedProp;
	}

	get stats () {
		let stats = `Curse: ${this.cursedProp} ${this.curseAmount}`;

		if (this.hasChanceToHit) {
			stats = `${super.stats}
${stats}`;
		}

		return stats;
	}

	getCurseNarrative (player, target) {
		return `${player.givenName} skillfully harries ${target.givenName} with a targetted sweeping blow intended to sting and distract.
${target.givenName}'s ${this.cursedProp} is lowered by ${Math.abs(this.curseAmount)}`;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			const acPenalty = target.getRawAc() - (target.ac - this.curseAmount);

			if (acPenalty > target.maxModifications[this.cursedProp]) {
				this.emit('narration', {
					narration: `${target.givenName}'s ${this.cursedProp} penalties have been maxed out. Taking ${Math.abs(this.curseAmount)} from HP instead.`
				});
				target.hit(Math.abs(this.cursedAmount), player, this);
			} else {
				this.emit('narration', {
					narration: this.getCurseNarrative(player, target)
				});
				target.setCurse(this.cursedProp, this.cursedAmount);
			}

			if (this.hasChanceToHit) {
				return resolve(super.effect(player, target, ring));
			}

			return resolve(true);
		});
	}
}

CurseCard.cardType = 'Soften';
CurseCard.probability = 30;
CurseCard.description = 'Sweep the leg... You have a problem with that? No mercy.';
CurseCard.cost = 2;
CurseCard.level = 1;
CurseCard.defaults = {
	...HitCard.defaults,
	curseAmount: -1,
	cursedProp: 'ac',
	hasChanceToHit: true,
	damageDice: '1d4'
};

module.exports = CurseCard;
