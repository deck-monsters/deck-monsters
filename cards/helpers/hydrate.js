const { sortCardsAlphabetically } = require('./sort');
const all = require('./all');
const draw = require('./draw');
const isMatchingCard = require('./is-matching');

const DelayedHitCard = require('../delayed-hit');

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
	deck = sortCardsAlphabetically(deck);

	// give them two delayedHit cards if they don't have them already.
	// To be ripped out as soon as everyone has their 2
	const delayedHitCard = new DelayedHitCard();
	if (!deck.find(card => card.cardType === delayedHitCard.cardType)) {
		deck.push(new DelayedHitCard());
		deck.push(new DelayedHitCard());
	}

	return deck;
};

module.exports = {
	hydrateCard,
	hydrateDeck
};
