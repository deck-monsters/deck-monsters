export interface ItemCountEntry {
	count: number;
	cost: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getItemKey = (item: any): string =>
	item.itemType ?? item.cardType ?? item.name ?? 'Unknown';

export const getItemCounts = (items: Array<{ itemType?: string; cardType?: string; name?: string }>): Record<string, number> =>
	items.reduce<Record<string, number>>((itemCounts, item) => {
		const key = getItemKey(item);
		itemCounts[key] = (itemCounts[key] ?? 0) + 1;
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
