const Roll = require('roll');

const dice = new Roll();

const chance = {
	roll (...args) {
		return dice.roll(...args).result;
	},
	rolls (...args) {
		return dice.roll(...args).rolled;
	},
	percent () {
		return chance.roll('d%');
	}
};

module.exports = chance;
