const random = require('lodash.random');

const drawCard = require('../../cards/helpers/draw');
const drawItem = require('../helpers/draw');

const DEFAULT_MIN_INVENTORY_SIZE = 5;
const DEFAULT_MAX_INVENTORY_SIZE = 20;

const DEFAULT_MIN_BACK_ROOM_INVENTORY_SIZE = 1;
const DEFAULT_MAX_BACK_ROOM_INVENTORY_SIZE = 3;

const canHoldBackRoom = {
	canHoldCard: card => card.notForSale && !card.neverForSale,
	canHoldItem: item => item.notForSale && !item.neverForSale
};

const getBackRoom = () => {
	const cards = [];
	const cardInventorySize = random(DEFAULT_MIN_BACK_ROOM_INVENTORY_SIZE, DEFAULT_MAX_BACK_ROOM_INVENTORY_SIZE);

	while (cards.length < cardInventorySize) {
		cards.push(drawCard({}, canHoldBackRoom));
	}

	const items = [];
	const itemInventorySize = random(DEFAULT_MIN_BACK_ROOM_INVENTORY_SIZE, DEFAULT_MAX_BACK_ROOM_INVENTORY_SIZE);

	while (items.length < itemInventorySize) {
		const item = drawItem({}, canHoldBackRoom);

		if (item) {
			items.push(item);
		} else {
			break;
		}
	}

	return [...cards, ...items];
};

const canHoldStandard = {
	canHoldCard: card => !card.notForSale && !card.neverForSale,
	canHoldItem: item => !item.notForSale && !item.neverForSale
};

const getCards = () => {
	const cards = [];
	const cardInventorySize = random(DEFAULT_MIN_INVENTORY_SIZE, DEFAULT_MAX_INVENTORY_SIZE);

	while (cards.length < cardInventorySize) {
		cards.push(drawCard({}, canHoldStandard));
	}

	return cards;
};

const getItems = () => {
	const items = [];
	const itemInventorySize = random(DEFAULT_MIN_INVENTORY_SIZE, DEFAULT_MAX_INVENTORY_SIZE);

	while (items.length < itemInventorySize) {
		items.push(drawItem({}, canHoldStandard));
	}

	return items;
};

module.exports = {
	getBackRoom,
	getCards,
	getItems
};
