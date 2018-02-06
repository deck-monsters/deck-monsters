const fantasyNames = require('fantasy-names');
const random = require('lodash.random');
const sample = require('lodash.sample');
const throttle = require('lodash.throttle');

const { getBackRoom, getCards, getItems } = require('./stock');
const PRONOUNS = require('../../helpers/pronouns');

const genders = Object.keys(PRONOUNS);

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

const hours = 28800000; // Eight hours

let currentShop;
const getShop = throttle(() => {
	currentShop = {
		adjective: sample(ADJECTIVES),
		backRoom: getBackRoom(),
		backRoomOffset: random(5.5, 9.5),
		cards: getCards(),
		closingTime: new Date(Date.now() + hours),
		items: getItems(),
		name: fantasyNames('places', 'magic_shops'),
		priceOffset: random(0.6, 0.9),
		pronouns: PRONOUNS[sample(genders)]
	};

	return currentShop;
}, hours); // Eight hours

module.exports = getShop;
