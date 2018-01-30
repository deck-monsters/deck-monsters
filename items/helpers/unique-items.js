module.exports = items => items.reduce(
	(uniqueItems, item) =>
		uniqueItems.concat(!uniqueItems.find(possibleItem =>
			possibleItem.itemType === item.itemType) ? [item] : [])
	, []
);
