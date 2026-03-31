import { sortItemsAlphabetically } from './sort.js';
import chooseItems from './choose.js';
import { mapSeries } from '../../helpers/promise.js';

interface UseItemsOptions {
	channel: any;
	character: any;
	itemSelection?: string[];
	monster?: any;
	use: (opts: { channel: any; isMonsterItem: boolean; item: any; monster?: any }) => Promise<any>;
}

const useItems = ({ channel, character, itemSelection, monster, use }: UseItemsOptions): Promise<any> =>
	Promise.resolve()
		.then(() => {
			let items: any[];
			let targetStr: string;

			if (monster) {
				items = [...monster.items];

				if (!monster.inEncounter) {
					items = [...items, ...character.items.filter((item: any) => monster.canUseItem(item))];
					targetStr = monster.givenName;
				} else {
					targetStr = `${monster.givenName} while ${monster.pronouns.he} is in an encounter`;
				}
			} else {
				items = character.items.filter((item: any) => character.canUseItem(item));
				targetStr = `${character.pronouns.him}self`;
			}

			if (items.length < 1) {
				return Promise.reject(channel({
					announce: `${character.givenName} doesn't have any items that ${character.pronouns.he} can use on ${targetStr}.`
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
							announce: `${character.givenName} can not use ${itemType.toLowerCase()} on ${targetStr}.`
						});
					}

					return selectedItems;
				}, []);
			}

			items = sortItemsAlphabetically(items);

			const getQuestion = ({ itemChoices }: { itemChoices: string }): string =>
				`Which item should ${character.givenName} use on ${targetStr}?\n\n${itemChoices}`;

			return chooseItems({
				items,
				channel,
				getQuestion
			});
		})
		.then((selectedItems: any[]) =>
			channel({
				question: 'Are you sure? (yes/no)'
			}).then((answer: string = '') => {
				if (answer.toLowerCase() === 'yes') {
					return selectedItems;
				}

				return Promise.reject(
					channel({ announce: 'You know what they always say, "An item saved is an item earned."' })
				);
			})
		)
		.then((selectedItems: any[]) =>
			mapSeries(selectedItems, (item: any) =>
				use({ channel, isMonsterItem: !!monster || !item.usableWithoutMonster, item, monster })
			)
		);

export default useItems;
export { useItems };
