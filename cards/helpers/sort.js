module.exports = cards => cards.sort((a, b) => {
	if (a.cardType > b.cardType) {
		return 1;
	}

	if (a.cardType < b.cardType) {
		return -1;
	}

	return 0;
});
