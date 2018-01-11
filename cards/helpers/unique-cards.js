module.exports = cards => cards.reduce(
	(uniqueCards, card) =>
		uniqueCards.concat(!uniqueCards.find(possibleCard =>
			possibleCard.name === card.name) ? [card] : [])
	, []
);
