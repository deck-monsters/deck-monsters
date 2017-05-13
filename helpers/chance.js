const Roll = require('roll');

const dice = new Roll();

const chance = {
	// Returns an object with a breakdown of the results
	roll ({ primaryDice, modifier = 0, bonusDice }) {
		const naturalRoll = dice.roll(primaryDice);
		const bonusResult = bonusDice ? dice.roll(bonusDice).result : 0;

		return {
			primaryDice,
			bonusDice,
			result: Math.max(naturalRoll.result + bonusResult + modifier, 0),
			naturalRoll,
			bonusResult,
			modifier
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
	nat20 (roll) {
		if (roll.primaryDice === '1d20' && roll.naturalRoll.result === 20) {
			return true;
		}

		return false;
	}
};

module.exports = chance;
