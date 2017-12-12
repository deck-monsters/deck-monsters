const BaseCard = require('./base');

class CurseCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		curseAmount,
		icon = '😖',
		cursedProp
	} = {}) {
		super({ curseAmount, icon, cursedProp });
	}

	get curseAmount () {
		return this.options.curseAmount;
	}

	get cursedProp () {
		return this.options.cursedProp;
	}

	get stats () {
		return `Curse: ${this.cursedProp} ${this.curseAmount}`;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			target.setModifier(this.cursedProp, this.curseAmount);

			resolve(true);
		});
	}
}

CurseCard.cardType = 'Soften';
CurseCard.probability = 10;
CurseCard.description = 'Sweep the leg... You have a problem with that? No mercy.';
CurseCard.cost = 2;
CurseCard.level = 1;
CurseCard.defaults = {
	curseAmount: -1,
	cursedProp: 'ac'
};

module.exports = CurseCard;
