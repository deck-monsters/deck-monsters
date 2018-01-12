const drawCard = require('../../cards/helpers/draw');

const DEFAULT_CARD_INVENTORY_SIZE = 20;

const canHold = {
	canHoldCard: card => !card.notForSale
};

const getCards = () => {
	const cards = [];

	while (cards.length < DEFAULT_CARD_INVENTORY_SIZE) {
		cards.push(drawCard({}, canHold));
	}

	return cards;
};

module.exports = {
	getCards
};
