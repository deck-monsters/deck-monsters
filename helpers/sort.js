const sortByLevel = toBeSorted => toBeSorted.sort((a, b) => {
	if (a.level > b.level) {
		return 1;
	}

	if (a.level < b.level) {
		return -1;
	}

	return 0;
});

const sortByProbability = toBeSorted => toBeSorted.sort((a, b) => {
	if (a.probability > b.probability) {
		return 1;
	}

	if (a.probability < b.probability) {
		return -1;
	}

	return 0;
});

const sortByCost = toBeSorted => toBeSorted.sort((a, b) => {
	if (a.cost > b.cost) {
		return 1;
	}

	if (a.cost < b.cost) {
		return -1;
	}

	return 0;
});


module.exports = {
	sortByLevel,
	sortByProbability,
	sortByCost
};