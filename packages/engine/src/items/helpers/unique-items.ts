const uniqueItems = <T extends { itemType: string }>(items: T[]): T[] =>
	items.reduce<T[]>(
		(acc, item) =>
			acc.concat(!acc.find(possibleItem => possibleItem.itemType === item.itemType) ? [item] : []),
		[]
	);

export default uniqueItems;
export { uniqueItems };
