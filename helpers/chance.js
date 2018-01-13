const Roll = require('roll');

const dice = new Roll();

const chance = {
	// Returns an object with a breakdown of the results
	roll ({ primaryDice, modifier = 0, bonusDice, crit }) {
		const naturalRoll = dice.roll(primaryDice);
		const bonusResult = bonusDice ? dice.roll(bonusDice).result : 0;

		let strokeOfLuck = false;
		let curseOfLoki = false;

		if (crit) {
			// Stroke of Luck
			if (naturalRoll.result === chance.max(primaryDice)) {
				strokeOfLuck = true;
			} else if (naturalRoll.result === 1) {
				curseOfLoki = true;
			}
		}

		return {
			primaryDice,
			bonusDice,
			result: Math.max(naturalRoll.result + bonusResult + modifier, 0),
			naturalRoll,
			bonusResult,
			modifier,
			strokeOfLuck,
			curseOfLoki
		};
	},
	// Returns the highest possible roll, unmodified
	max (primaryDice) {
		const matches = primaryDice.match(/([\d]+d[\d]+)/ig) || [];
		const result = matches.reduce((sum, match) => {
			const [quantity, sides] = match.split('d');
			return sum + (quantity * sides);
		}, 0);

		return result;
	},
	percent () {
		return dice.roll('d%').result;
	},
	randomInt ({ min = 0, max }) {
		return Math.floor(Math.random() * ((max - min) + 1)) + min;
	}
};

module.exports = chance;
