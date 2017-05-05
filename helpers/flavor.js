const { percent } = require('./chance');
const shuffle = require('lodash.shuffle');

const flavor = {
	getFlavor (category) {
		const possibleWords = shuffle(flavor.flavors[category]);

		const words = possibleWords.find(card => percent() <= card[1]) || flavor.getFlavor(category);

		return words[0];
	},

	flavors: {
		hits: [
			['punches', 80],
			['slices', 70],
			['smacks', 70],
			['trounces', 70],
			['bashes', 70],
			['stabs', 70],
			['mauls', 70],
			['bites', 50],
			['incinerates', 50],
			['pulls on the hair of', 20],
			['farts in the general direction of', 5],
			['pokes', 10],
			['whaps', 30],
			['grabs by the lower half, twirls around in circles, and throws across the field mercilessly', 2]
		]
	}
};

module.exports = flavor;
