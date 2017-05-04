const Roll = require('roll');

const dice = new Roll();

dice.max = () => this.quantity * this.sides;

const chance = {
	roll (...args) {
		return dice.roll(...args).result;
	},
	rolls (...args) {
		return dice.roll(...args).rolled;
	},
	max () { // Returns the highest possible roll, unmodified
		return dice.max();
	},
	percent () {
		return chance.roll('d%');
	}
};

module.exports = chance;
