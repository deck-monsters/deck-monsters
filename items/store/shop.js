const fantasyNames = require('fantasy-names');
const random = require('lodash.random');
const sample = require('lodash.sample');
const throttle = require('lodash.throttle');

const { getCards } = require('./stock');

const ADJECTIVES = [
	'rusty',
	'moss-covered',
	'gilded',
	'heavy',
	'newly-installed glass',
	'mysterious',
	'hidden',
	'bright red',
	'small, round'
];

let currentShop;
const getShop = throttle(() => {
	currentShop = {
		name: fantasyNames('places', 'magic_shops'),
		adjective: sample(ADJECTIVES),
		priceOffset: random(0.6, 0.9),
		items: [],
		cards: getCards()
	};

	return currentShop;
}, 7200000);

module.exports = getShop;
