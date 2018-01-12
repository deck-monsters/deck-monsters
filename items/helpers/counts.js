const getItemCounts = items => items.reduce((itemCounts, item) => {
	itemCounts[item.itemType] = (itemCounts[item.itemType] || 0) + 1;

	return itemCounts;
}, {});

const getItemCountsWithPrice = (items, priceOffset) => items.reduce((itemCounts, item) => {
	itemCounts[item.itemType] = itemCounts[item.itemType] || { count: 0, cost: Math.round(item.cost * priceOffset) };
	itemCounts[item.itemType].count += 1;

	return itemCounts;
}, {});

module.exports = {
	getItemCounts,
	getItemCountsWithPrice
};
