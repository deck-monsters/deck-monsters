const shuffle = require('lodash.shuffle');

const isProbable = require('../helpers/is-probable');
const BlastCard = require('./blast');
const BoostCard = require('./boost');
const CurseCard = require('./curse');
const EnchantedFaceswapCard = require('./enchanted-faceswap');
const FleeCard = require('./flee');
const HealCard = require('./heal');
const HitCard = require('./hit');
const HitHarderCard = require('./hit-harder');
const LuckyStrike = require('./lucky-strike');
const PoundCard = require('./pound');
const RandomCard = require('./random');
const RehitCard = require('./rehit');
// const ReviveCard = require('./revive');

const DEFAULT_MINIMUM_CARDS = 10;

const all = [
	BlastCard,
	BoostCard,
	CurseCard,
	EnchantedFaceswapCard,
	FleeCard,
	HealCard,
	HitCard,
	HitHarderCard,
	LuckyStrike,
	PoundCard,
	RandomCard,
	RehitCard
];

const draw = (options, creature) => {
	let deck = shuffle(all);

	if (creature) {
		deck = deck.filter(card => creature.canHoldCard(card));
	}

	const Card = deck.find(isProbable);

	if (!Card) return draw(options, creature);

	// In the future we may want to pass some options to the cards,
	// but we need to make sure that we only pass card-related options.
	// For example, the level is not meant to passed to the card.
	return new Card(options);
};

// fills deck up with random cards appropriate for player's level
const fillDeck = (deck, options, creature) => {
	while (deck.length < DEFAULT_MINIMUM_CARDS) {
		deck.push(draw(options, creature));
	}

	return deck;
};

const getInitialDeck = (options, creature) => {
	// See above re: options
	const deck = [
		new HitCard(),
		new HitCard(),
		new HitCard(),
		new HitCard(),
		new HealCard(),
		new FleeCard()
	];

	return fillDeck(deck, options, creature);
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
