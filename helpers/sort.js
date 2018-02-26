const sort = (toBeSorted, byProperty = 'cardType') => [...toBeSorted].sort((a, b) => {
	if (a[byProperty] > b[byProperty]) {
		return 1;
	}

	if (a[byProperty] < b[byProperty]) {
		return -1;
	}

	return 0;
});

const sortByCost = toBeSorted => sort(toBeSorted, 'cost');
const sortByLevel = toBeSorted => sort(toBeSorted, 'level');
const sortByProbability = toBeSorted => sort(toBeSorted, 'probability');
const sortByXP = toBeSorted => sort(toBeSorted, 'xp');

module.exports = {
	sort,
	sortByCost,
	sortByLevel,
	sortByProbability,
	sortByXP
};
