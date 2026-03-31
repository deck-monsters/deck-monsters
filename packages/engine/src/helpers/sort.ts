export const sort = <T extends Record<string, unknown>>(
	toBeSorted: T[],
	byProperty: keyof T = 'cardType'
): T[] =>
	[...toBeSorted].sort((a, b) => {
		if (a[byProperty] > b[byProperty]) return 1;
		if (a[byProperty] < b[byProperty]) return -1;
		return 0;
	});

export const sortByCost = <T extends Record<string, unknown>>(toBeSorted: T[]): T[] =>
	sort(toBeSorted, 'cost');

export const sortByLevel = <T extends Record<string, unknown>>(toBeSorted: T[]): T[] =>
	sort(toBeSorted, 'level');

export const sortByProbability = <T extends Record<string, unknown>>(toBeSorted: T[]): T[] =>
	sort(toBeSorted, 'probability');

export const sortByXP = <T extends Record<string, unknown>>(toBeSorted: T[]): T[] =>
	sort(toBeSorted, 'xp');
