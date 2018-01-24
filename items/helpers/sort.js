module.exports = items => items.sort((a, b) => {
	if (a.itemType > b.itemType) {
		return 1;
	}

	if (a.itemType < b.itemType) {
		return -1;
	}

	return 0;
});
