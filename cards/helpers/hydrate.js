const all = require('./all');
const draw = require('./draw');
const isMatchingCard = require('./is-matching');
const SandstormCard = require('../sandstorm');

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

	if (!deck.find(({ cardType }) => cardType === SandstormCard.cardType)) {
		deck.push(new SandstormCard());
	}

	return deck;
};

module.exports = {
	hydrateCard,
	hydrateDeck
};
