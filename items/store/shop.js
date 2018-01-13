const fantasyNames = require('fantasy-names');
const random = require('lodash.random');
const sample = require('lodash.sample');
const throttle = require('lodash.throttle');

const { getBackRoom, getCards } = require('./stock');

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
		backRoomOffset: random(6, 9),
		items: [],
		cards: getCards(),
		backRoom: getBackRoom()
	};

	return currentShop;
}, 28800000); // Eight hours

module.exports = getShop;
