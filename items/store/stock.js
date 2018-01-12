const drawCard = require('../../cards/helpers/draw');

const DEFAULT_CARD_INVENTORY_SIZE = 20;

const canHoldBackRoom = {
	canHoldCard: card => card.notForSale && !card.neverForSale
};

const getBackRoom = () => {
	const items = [];

	while (items.length < 1) {
		items.push(drawCard({}, canHoldBackRoom));
	}

	// TODO: Draw a special item (potion, scroll, etc) and push it here as well

	return items;
};

const canHoldStandard = {
	canHoldCard: card => !card.notForSale && !card.neverForSale
};

const getCards = () => {
	const cards = [];

	while (cards.length < DEFAULT_CARD_INVENTORY_SIZE) {
		cards.push(drawCard({}, canHoldStandard));
	}

	return cards;
};

module.exports = {
	getBackRoom,
	getCards
};
