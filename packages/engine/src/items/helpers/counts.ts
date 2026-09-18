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
	items: Array<{ itemType?: string; cardType?: string; name?: string; cost: number }>,
	priceOffset: number
): Record<string, ItemCountEntry> =>
	items.reduce<Record<string, ItemCountEntry>>((itemCounts, item) => {
		// Keyed through `getItemKey` (itemType ?? cardType ?? name), not `item.itemType`
		// directly — the back room mixes items and cards in one pool (see
		// items/store/stock.ts `getBackRoom`), and every card in that pool has no
		// `itemType`, so keying on it directly collapsed all of them under the key
		// `"undefined"` and mispriced them together. `getItemCounts` (no price) and
		// `getFinalItemChoices` already went through `getItemKey`; this was the one
		// holdout.
		const key = getItemKey(item);

		if (!itemCounts[key]) {
			itemCounts[key] = { count: 0, cost: Math.round(item.cost * priceOffset) };
		}

		itemCounts[key].count += 1;
		return itemCounts;
	}, {});
