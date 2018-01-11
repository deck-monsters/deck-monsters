module.exports = items => items.reduce((itemCounts, item) => {
	itemCounts[item.itemType] = (itemCounts[item.itemType] || 0) + 1;

	return itemCounts;
}, {});
