const shuffle = require('lodash.shuffle');

const isProbable = require('../helpers/is-probable');
const HitCard = require('./hit');
const HealCard = require('./heal');
const FleeCard = require('./flee');

const all = [
	HitCard,
	HealCard,
	FleeCard
];

const draw = () => {
	const shuffledDeck = shuffle(all);

	const Card = shuffledDeck.find(isProbable) || draw();

	return new Card();
};

const getInitialDeck = () => [
	new HitCard(),
	new HitCard(),
	new HealCard(),
	new FleeCard(),
	draw()
];

module.exports = {
	all,
	draw,
	getInitialDeck
};
