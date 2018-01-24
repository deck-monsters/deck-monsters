const sort = (toBeSorted, byProperty = 'cardType') => [...toBeSorted].sort((a, b) => {
	if (a[byProperty] > b[byProperty]) {
		return 1;
	}

	if (a[byProperty] < b[byProperty]) {
		return -1;
	}

	return 0;
});

const sortByLevel = toBeSorted => sort(toBeSorted, 'level');
const sortByProbability = toBeSorted => sort(toBeSorted, 'probability');
const sortByCost = toBeSorted => sort(toBeSorted, 'cost');

module.exports = {
	sort,
	sortByLevel,
	sortByProbability,
	sortByCost
};
