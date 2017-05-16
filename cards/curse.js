const BaseCard = require('./base');

class CurseCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			curseAmount: -1,
			icon: '😖',
			cursedProp: 'ac'
		};

		super(Object.assign(defaultOptions, options));
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
			target.setCondition(this.cursedProp, this.curseAmount);

			resolve(true);
		});
	}
}

CurseCard.cardType = 'Soften';
CurseCard.probability = 10;
CurseCard.description = 'Sweep the leg... You have a problem with that? No mercy.';
CurseCard.cost = 2;
CurseCard.level = 1;

module.exports = CurseCard;
