const { getItemChoices, getItemChoicesWithPrice, getFinalItemChoices } = require('../../helpers/choices');
const getArray = require('../../helpers/get-array');

const { getItemCounts, getItemCountsWithPrice } = require('./counts');

const itemChoiceQuestion = ({ itemChoices }) => `Choose one or more of the following items:

${itemChoices}`;

const itemChoiceResult = ({ selectedItems }) => {
	if (selectedItems.length <= 0) {
		return 'You selected no items.';
	} else if (selectedItems.length === 1) {
		return `You selected a ${selectedItems[0].itemType.toLowerCase()} item.`;
	}

	return `You selected the following items:

${getFinalItemChoices(selectedItems)}`;
};

module.exports = ({
	items,
	channel,
	showPrice,
	priceOffset = 1,
	getQuestion = itemChoiceQuestion,
	getResult = itemChoiceResult
}) => {
	const itemCatalog = showPrice ? getItemCountsWithPrice(items, priceOffset) : getItemCounts(items);
	const itemChoices = showPrice ? getItemChoicesWithPrice(itemCatalog) : getItemChoices(itemCatalog);

	return Promise
		.resolve()
		.then(() => channel({
			question: getQuestion({ itemChoices })
		}))
		.then((answer) => {
			let selectedItemIndexes = getArray(answer);
			if (!Array.isArray(selectedItemIndexes)) selectedItemIndexes = [selectedItemIndexes];

			const remainingItems = [...items];
			const selectedItems = selectedItemIndexes.reduce((selection, index) => {
				const itemType = Object.keys(itemCatalog)[index - 0];
				const itemIndex = remainingItems.findIndex(potentialItem => potentialItem.itemType === itemType);

				if (itemIndex >= 0) {
					const selectedItem = remainingItems.splice(itemIndex, 1)[0];
					selection.push(selectedItem);
				} else {
					throw new Error('Your selection could not be found.');
				}

				return selection;
			}, []);

			return channel({
				announce: getResult({ selectedItems })
			})
				.then(() => selectedItems);
		});
};
