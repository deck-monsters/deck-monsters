const Roll = require('roll');

const dice = new Roll();

const chance = {
	// Returns an object with a breakdown of the results
	roll ({ primaryDice, modifier = 0, bonusDice }) {
		const naturalRoll = dice.roll(primaryDice);
		const bonusResult = bonusDice ? dice.roll(bonusDice).result : 0;

		return {
			result: naturalRoll.result + bonusResult + modifier,
			naturalRoll,
			bonusResult,
			modifier
		};
	},
	// Returns the highest possible roll, unmodified
	max (primaryDice) {
		const matches = primaryDice.match(/([\d]+d[\d]+)/ig) | [];
		const result = matches.reduce((sum, match) => {
			const [quantity, sides] = match.split('d');
			return sum + (quantity * sides);
		}, 0);

		return result;
	},
	percent () {
		return dice.roll('d%').result;
	}
};

module.exports = chance;
