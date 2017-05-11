const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');
const isProbable = require('../helpers/is-probable');

class CurseCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			curseDice: '1d4',
			icon: '🤢',
			cursedProp: 'ac'
		};

		super(Object.assign(defaultOptions, options));
	}

	get curseDice () {
		return this.options.curseDice;
	}

	get stats () {
		return `Curse: ${this.curseDice}`;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			const curseRoll = roll({ primaryDice: this.curseDice });
			let curseResult = -curseRoll.result;
			let strokeOfLuck = false;
			let curseOfLoki = false;
			let outcome = '';

			// Stroke of Luck
			if (isProbable({ probability: 1 })) {
				curseResult = -max(this.curseDice);
				curseResult.result = curseResult;
				strokeOfLuck = true;
				outcome = 'BLESSED! Max soften!';
			} else if (isProbable({ probability: 10 })) {
				curseResult = 0;
				curseResult.result = curseResult;
				curseOfLoki = true;
				outcome = 'CURSED! No effect.';
			}

			this.emit('rolling', {
				reason: `for ${this.options.cursedProp.toUpperCase()} curse amount`,
				card: this,
				roll: curseRoll,
				strokeOfLuck,
				curseOfLoki,
				player,
				target
			});

			this.emit('rolled', {
				reason: `to soften opponent's ${this.options.cursedProp.toUpperCase()}`,
				card: this,
				roll: curseRoll,
				strokeOfLuck,
				curseOfLoki,
				player,
				target,
				outcome
			});

			target.setCondition(this.options.cursedProp, curseResult);

			resolve(true);
		});
	}
}

CurseCard.cardType = 'Soften';
CurseCard.probability = 10;
CurseCard.description = 'Sweep the leg... You have a problem with that? No mercy.';

module.exports = CurseCard;
