const sortCardsAlphabetically = cards => [...cards].sort((a, b) => {
	if (a.cardType > b.cardType) {
		return 1;
	}

	if (a.cardType < b.cardType) {
		return -1;
	}

	return 0;
});

module.exports = {
	sortCardsAlphabetically
};
