const Roll = require('roll');

const roll = new Roll().roll;

const chance = {
	roll (...args) {
		return roll(...args).result;
	},
	rolls (...args) {
		return roll(...args).rolled;
	},
	percent () {
		return chance.roll('d%');
	}
};

module.exports = chance;
