module.exports = cards => cards.reduce((cardCounts, card) => {
	cardCounts[card.cardType] = (cardCounts[card.cardType] || 0) + 1;

	return cardCounts;
}, {});
