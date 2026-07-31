import { getItemChoices, getItemChoicesWithPrice, getFinalItemChoices } from '../../helpers/choices.js';
import { getArray } from '../../helpers/get-array.js';
import { PROMPT_CANCELLED, PromptCancelledError } from '../../events/index.js';

import { getItemCounts, getItemCountsWithPrice, getItemKey } from './counts.js';

const itemChoiceQuestion = ({ itemChoices }: { itemChoices: string }): string =>
	`Choose one or more of the following items:\n\n${itemChoices}`;

const itemChoiceResult = ({ selectedItems }: { selectedItems: Array<{ itemType?: string }> }): string => {
	if (selectedItems.length <= 0) {
		return 'You selected no items.';
	} else if (selectedItems.length === 1) {
		return `You selected a ${(getItemKey(selectedItems[0])).toLowerCase()} item.`;
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
			// A cancelled flow resolves the prompt with a sentinel — abort cleanly
			// instead of treating it as a selection.
			if (answer === PROMPT_CANCELLED) {
				throw new PromptCancelledError();
			}

			const selectedTokens = getArray(answer) ?? [];
			const catalogKeys = Object.keys(itemCatalog);
			const remainingItems = [...items];
			const selectedItems: any[] = [];
			const invalidTokens: string[] = [];

			// Selections may be the displayed numeric indices or the item names
			// themselves (case-insensitive). Invalid entries are skipped with a
			// notice rather than aborting the whole flow.
			selectedTokens.forEach((token: unknown) => {
				const trimmed = String(token).trim();
				if (!trimmed) return;

				let itemType: string | undefined = /^\d+$/.test(trimmed)
					? catalogKeys[Number(trimmed)]
					: undefined;
				if (itemType === undefined) {
					itemType = catalogKeys.find(key => key.toLowerCase() === trimmed.toLowerCase());
				}

				const itemIndex = itemType === undefined
					? -1
					: remainingItems.findIndex(
						(potentialItem: any) => getItemKey(potentialItem) === itemType
					);

				if (itemIndex >= 0) {
					selectedItems.push(remainingItems.splice(itemIndex, 1)[0]);
				} else {
					invalidTokens.push(trimmed);
				}
			});

			return Promise.resolve()
				.then(() => {
					if (invalidTokens.length > 0) {
						return channel({
							announce: `Skipped ${invalidTokens.length > 1 ? 'invalid selections' : 'an invalid selection'}: ${invalidTokens.join(', ')}`
						});
					}
					return undefined;
				})
				.then(() =>
					channel({
						announce: getResult({ selectedItems })
					})
				)
				.then(() => selectedItems);
		});
};

export default chooseItems;
export { chooseItems };
