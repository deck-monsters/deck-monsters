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

const draw = (options) => {
	const shuffledDeck = shuffle(all);

	const Card = shuffledDeck.find(isProbable) || draw();

	return new Card(options);
};

const getInitialDeck = options => [
	new HitCard(options),
	new HitCard(options),
	new HealCard(options),
	new FleeCard(options),
	draw(options)
];

const hydrateDeck = deckJSON => JSON
	.parse(deckJSON)
	.map((cardObj) => {
		const Card = all.find(({ name }) => name === cardObj.name);
		return new Card(cardObj.options);
	});

module.exports = {
	all,
	draw,
	getInitialDeck,
	hydrateDeck
};
