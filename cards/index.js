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

const draw = (options, monster) => {
	let deck = shuffle(all);

	if (monster) {
		deck = deck.filter(card => monster.canHoldCard(card));
	}

	const Card = deck.find(isProbable);

	if (!Card) return draw(options, monster);

	// In the future we may want to pass some options to the cards,
	// but we need to make sure that we only pass card-related options.
	// For example, the level is not meant to passed to the card.
	return new Card(options);
};

// fills deck up with random cards appropriate for player's level
const fillDeck = (deck, options, monster) => {
	while (deck.length < DEFAULT_MINIMUM_CARDS) {
		deck.push(draw(options, monster));
	}

	return deck;
};

const getInitialDeck = (options, monster) => {
	// See above re: options
	const deck = [
		new HitCard(),
		new HitCard(),
		new HitCard(),
		new HitCard(),
		new HealCard(),
		new FleeCard()
	];

	return fillDeck(deck, options, monster);
};

const getCardCounts = cards =>
	cards.reduce((cardCounts, card) => {
		cardCounts[card.cardType] = cardCounts[card.cardType] || 0;
		cardCounts[card.cardType] += 1;
		return cardCounts;
	}, {});

const getUniqueCards = cards =>
	cards.reduce(
		(uniqueCards, card) =>
			uniqueCards.concat(!uniqueCards.find(possibleCard =>
				possibleCard.name === card.name) ? [card] : [])
		, []
	);

const hydrateCard = (cardObj, monster) => {
	const Card = all.find(({ name }) => name === cardObj.name);

	if (Card) {
		return new Card(cardObj.options);
	}

	return draw({}, monster);
};

const hydrateDeck = (deckJSON, monster) => JSON
	.parse(deckJSON)
	.map(cardObj => hydrateCard(cardObj, monster));

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
