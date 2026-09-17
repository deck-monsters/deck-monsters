import { sortItemsAlphabetically } from './sort.js';
import chooseItems from './choose.js';
import { mapSeries } from '../../helpers/promise.js';
import { announceAndThrow } from '../../helpers/announce-and-throw.js';

interface UseItemsOptions {
	channel: any;
	character: any;
	/**
	 * Skip the "Are you sure?" prompt. The prompt exists because in a chat client the only
	 * thing between a typo and a spent item is that question — there is no button to not
	 * press. A caller that already got a deliberate confirmation from its own UI (the web
	 * client's use button) has nothing left to ask, and asking anyway is what made item use
	 * impossible from the browser: prompts cannot be answered inside a tRPC mutation.
	 *
	 * This skips only the confirmation. Which items are usable, and the mid-fight narrowing
	 * to `monster.items`, stay here so there is one source of truth for the rule.
	 */
	confirmed?: boolean;
	itemSelection?: string[];
	monster?: any;
	use: (opts: { channel: any; isMonsterItem: boolean; item: any; monster?: any }) => Promise<any>;
}

const useItems = ({ channel, character, confirmed, itemSelection, monster, use }: UseItemsOptions): Promise<any> =>
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
				return announceAndThrow(channel, `${character.givenName} doesn't have any items that ${character.pronouns.he} can use on ${targetStr}.`);
			}

			if (itemSelection && itemSelection.length > 0) {
				const selected = itemSelection.reduce((selectedItems: any[], itemType: string) => {
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

				// Nothing matched. Previously this fell through to the confirmation and then a
				// no-op `mapSeries([])`, so the caller was told the use succeeded while nothing
				// happened — invisible in chat, and a lie to an API caller.
				if (selected.length < 1) {
					return announceAndThrow(
						channel,
						`${character.givenName} can not use ${itemSelection.join(', ').toLowerCase()} on ${targetStr}.`
					);
				}

				return selected;
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
		.then((selectedItems: any[]) => {
			if (confirmed) return selectedItems;

			return channel({
				question: 'Are you sure? (yes/no)'
			}).then((answer: string = '') => {
				if (answer.toLowerCase() === 'yes') {
					return selectedItems;
				}

				return announceAndThrow(channel, 'You know what they always say, "An item saved is an item earned."');
			});
		})
		.then((selectedItems: any[]) =>
			mapSeries(selectedItems, (item: any) =>
				use({ channel, isMonsterItem: !!monster || !item.usableWithoutMonster, item, monster })
			)
		);

export default useItems;
export { useItems };
