const Roll = require('roll');

const dice = new Roll();

const chance = {
	roll (...args) {
		return dice.roll(...args).result;
	},
	rolls (...args) {
		return dice.roll(...args).rolled;
	},
	max (...args) { // Returns the highest possible roll, unmodified
		return dice.max(...args).result;
	},
	percent () {
		return chance.roll('d%');
	}
};

module.exports = chance;
