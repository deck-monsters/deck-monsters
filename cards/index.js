const shuffle = require('lodash.shuffle');

const isProbable = require('../helpers/is-probable');
const BoostCard = require('./boost');
const CurseCard = require('./curse');
const FleeCard = require('./flee');
const HitCard = require('./hit');
const HealCard = require('./heal');
const PoundCard = require('./pound');
const LuckyStrike = require('./lucky-strike');
const HitHarderCard = require('./hit-harder');
const RehitCard = require('./rehit');
// const ReviveCard = require('./revive');

const DEFAULT_MINIMUM_CARDS = 10;

const all = [
	BoostCard,
	CurseCard,
	FleeCard,
	HitCard,
	HealCard,
	PoundCard,
	LuckyStrike,
	HitHarderCard,
	RehitCard
];

const draw = (opts) => {
	const defaultOptions = {
		character: {
			level: 1
		}
	};

	const options = Object.assign(defaultOptions, opts);

	const shuffledDeck = shuffle(all);
	const filteredDeck = shuffledDeck.filter(card => options.character.level >= card.level);

	const Card = filteredDeck.find(isProbable);

	if (!Card) return draw(options);

	return new Card(options);
};

// fills deck up with random cards appropriate for player's level
const fillDeck = (deck, options) => {
	while (deck.length < DEFAULT_MINIMUM_CARDS) {
		deck.push(draw(options));
	}

	return deck;
};

const getInitialDeck = (options) => {
	const deck = [
		new HitCard(options),
		new HitCard(options),
		new HitCard(options),
		new HitCard(options),
		new HealCard(options),
		new HealCard(options),
		new FleeCard(options)
	];

	return fillDeck(deck, options);
};

const getCardCounts = (cards) => {
	const cardCounts = {};

	cards.forEach((card) => {
		cardCounts[card.cardType] = cardCounts[card.cardType] || 0;
		cardCounts[card.cardType] += 1;
	});

	return cardCounts;
};

const getUniqueCards = cards =>
	cards.reduce((uniqueCards, card) =>
		uniqueCards.concat(!uniqueCards.find(possibleCard =>
			possibleCard.name === card.name
		) ? [card] : [])
	, []);

const hydrateCard = (cardObj) => {
	const Card = all.find(({ name }) => name === cardObj.name);
	return new Card(cardObj.options);
};

const hydrateDeck = deckJSON => JSON
	.parse(deckJSON)
	.map(hydrateCard);

module.exports = {
	all,
	draw,
	getInitialDeck,
	fillDeck,
	hydrateCard,
	hydrateDeck,
	getUniqueCards,
	getCardCounts
};
