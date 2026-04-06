import { getItemChoices, getItemChoicesWithPrice, getFinalItemChoices } from '../../helpers/choices.js';
import { getArray } from '../../helpers/get-array.js';
import { reduceSeries } from '../../helpers/promise.js';

import { getItemCounts, getItemCountsWithPrice } from './counts.js';

const itemChoiceQuestion = ({ itemChoices }: { itemChoices: string }): string =>
	`Choose one or more of the following items:\n\n${itemChoices}`;

const itemChoiceResult = ({ selectedItems }: { selectedItems: Array<{ itemType: string }> }): string => {
	if (selectedItems.length <= 0) {
		return 'You selected no items.';
	} else if (selectedItems.length === 1) {
		return `You selected a ${selectedItems[0].itemType.toLowerCase()} item.`;
	}

	return `You selected the following items:\n\n${getFinalItemChoices(selectedItems)}`;
};

interface ChooseItemsOptions {
	items: Array<{ itemType: string; cost: number }>;
	channel: any;
	showPrice?: boolean;
	priceOffset?: number;
	getQuestion?: (opts: { itemChoices: string }) => string;
	getResult?: (opts: { selectedItems: Array<{ itemType: string }> }) => string;
}

const chooseItems = ({
	items,
	channel,
	showPrice,
	priceOffset = 1,
	getQuestion = itemChoiceQuestion,
	getResult = itemChoiceResult
}: ChooseItemsOptions): Promise<any[]> => {
	const itemCatalog = showPrice ? getItemCountsWithPrice(items, priceOffset) : getItemCounts(items);
	const itemChoices = showPrice
		? getItemChoicesWithPrice(itemCatalog as any)
		: getItemChoices(itemCatalog as any);

	return Promise
		.resolve()
		.then(() => channel({
			question: getQuestion({ itemChoices }),
			choices: Object.keys(itemCatalog),
		}))
		.then((answer: unknown) => {
			const selectedItemIndexes = getArray(answer) ?? [];
			const remainingItems = [...items];

			return reduceSeries(selectedItemIndexes, (selection: any[], index: string) => {
				const itemType = Object.keys(itemCatalog)[Number(index)];
				const itemIndex = remainingItems.findIndex(
					(potentialItem: { itemType: string }) => potentialItem.itemType === itemType
				);

				if (itemIndex >= 0) {
					const selectedItem = remainingItems.splice(itemIndex, 1)[0];
					selection.push(selectedItem);
				} else {
					return Promise.reject(channel({
						announce: `Invalid selection: ${itemType || index}`
					}));
				}

				return selection;
			}, [])
				.then((selectedItems: any[]) =>
					channel({
						announce: getResult({ selectedItems })
					}).then(() => selectedItems)
				);
		});
};

export default chooseItems;
export { chooseItems };
