const { getMinimumDeck } = require('./deck');
const all = require('./all');
const draw = require('./draw');
const getCardCounts = require('../../items/helpers/counts').getItemCounts;
const isMatchingCard = require('./is-matching');

const hydrateCard = (cardObj, monster, deck = []) => {
	const existingCard = deck.find(card => isMatchingCard(card, cardObj)); // restore cards from the players deck if possible
	if (existingCard) return existingCard;

	const Card = all.find(({ name }) => name === cardObj.name);
	if (Card) return new Card(cardObj.options);

	return draw({}, monster);
};

const hydrateDeck = (deckJSON = [], monster) => {
	let deck = typeof deckJSON === 'string' ? JSON.parse(deckJSON) : deckJSON;
	deck = deck.map(cardObj => hydrateCard(cardObj, monster));

	const minimumDeck = getMinimumDeck();
	const minimumDeckCardCounts = getCardCounts(minimumDeck);
	const deckCardCounts = getCardCounts(deck);

	Object.keys(minimumDeckCardCounts).forEach((expectedCardType) => {
		for (let i = deckCardCounts[expectedCardType] || 0; i < minimumDeckCardCounts[expectedCardType]; i++) {
			const card = minimumDeck.find(({ cardType }) => cardType === expectedCardType);
			if (card) deck.push(card);
		}
	});

	return deck;
};

module.exports = {
	hydrateCard,
	hydrateDeck
};
