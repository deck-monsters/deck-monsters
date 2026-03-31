import { getFinalItemChoices } from '../../helpers/choices.js';
import { sortItemsAlphabetically } from './sort.js';
import chooseItems from './choose.js';

interface TransferOptions {
	from: any;
	to: any;
	itemSelection?: string[];
	channel: any;
}

const transferItems = ({ from, to, itemSelection, channel }: TransferOptions): Promise<void> => {
	const checkEncounter = (arg?: any): Promise<any> => {
		if (to.inEncounter) {
			return Promise.reject(channel({
				announce: `You cannot give items to ${to.givenName} while they are fighting!`
			}));
		}

		if (from.inEncounter) {
			return Promise.reject(channel({
				announce: `You cannot remove items from ${from.givenName} while they are fighting!`
			}));
		}

		return Promise.resolve(arg);
	};

	return Promise.resolve()
		.then(checkEncounter)
		.then(() => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const items: any[] = sortItemsAlphabetically(
				from.items.filter((item: any) => to.canHoldItem(item))
			);

			if (items.length < 1) {
				return Promise.reject(channel({
					announce: `${from.givenName} doesn't have any items that ${to.givenName} can use.`
				}));
			}

			if (itemSelection && itemSelection.length > 0) {
				return itemSelection.reduce((selectedItems: any[], itemType: string) => {
					const itemIndex = items.findIndex(
						(potentialItem: any) => potentialItem.itemType.toLowerCase() === itemType.toLowerCase()
					);

					if (itemIndex >= 0) {
						const selectedItem = items.splice(itemIndex, 1)[0];
						selectedItems.push(selectedItem);
					} else {
						channel({
							announce: `${to.givenName} can not hold ${itemType.toLowerCase()}.`
						});
					}

					return selectedItems;
				}, []);
			}

			const { itemSlots } = to;
			const currentItemCount = to.items.length;
			const remainingSlots = itemSlots - currentItemCount;

			if (remainingSlots < 1) {
				return Promise.reject(channel({
					announce: `${to.givenName} doesn't have space for any more items!`
				}));
			}

			let currentItemDescription: string;
			if (currentItemCount === 0) {
				currentItemDescription = 'no items';
			} else if (currentItemCount === 1) {
				currentItemDescription = 'one item';
			} else {
				currentItemDescription = `${currentItemCount} items`;
			}

			const getQuestion = ({ itemChoices }: { itemChoices: string }): string =>
				`${to.givenName} is holding ${currentItemDescription} and has space for ${remainingSlots} more:\n\n${itemChoices}\n\nWhich item(s) should ${from.givenName} give ${to.pronouns.him}?`;

			return chooseItems({
				items,
				channel,
				getQuestion
			})
				.then(checkEncounter)
				.then((selectedItems: any[]) => {
					const trimmedItems = selectedItems.slice(0, remainingSlots);

					const itemStr = trimmedItems.length === 1 ? 'item' : 'items';
					let message: string;
					if (trimmedItems.length < selectedItems.length) {
						message = `${to.givenName} has run out of space, but ${from.givenName} has given ${to.pronouns.him} the following ${itemStr}`;
					} else {
						message = `${from.givenName} has given ${to.givenName} the following ${itemStr}`;
					}

					return channel({
						announce: `${message}:\n\n${getFinalItemChoices(trimmedItems)}`
					})
						.then(() => trimmedItems.forEach((item: any) => from.giveItem(item, to)));
				});
		});
};

export default transferItems;
export { transferItems };
