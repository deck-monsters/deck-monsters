export interface ItemCountEntry {
	count: number;
	cost: number;
}

export const getItemCounts = (items: Array<{ itemType: string }>): Record<string, number> =>
	items.reduce<Record<string, number>>((itemCounts, item) => {
		itemCounts[item.itemType] = (itemCounts[item.itemType] ?? 0) + 1;
		return itemCounts;
	}, {});

export const getItemCountsWithPrice = (
	items: Array<{ itemType: string; cost: number }>,
	priceOffset: number
): Record<string, ItemCountEntry> =>
	items.reduce<Record<string, ItemCountEntry>>((itemCounts, item) => {
		if (!itemCounts[item.itemType]) {
			itemCounts[item.itemType] = { count: 0, cost: Math.round(item.cost * priceOffset) };
		}

		itemCounts[item.itemType].count += 1;
		return itemCounts;
	}, {});
