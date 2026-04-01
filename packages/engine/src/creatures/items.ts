import { itemCard } from '../helpers/card.js';
import { eachSeries } from '../helpers/promise.js';
import type { BaseCreature, ItemInstance, ChannelFn, ChannelWithManager } from './base.js';

// ---------------------------------------------------------------------------
// Lazy-loaded item helpers (circular dependency workaround — same pattern as base.ts)
// ---------------------------------------------------------------------------

import type { sortItemsAlphabetically as SortItemsFn } from '../items/helpers/sort.js';
import type { getItemCounts as GetItemCountsFn } from '../items/helpers/counts.js';
import type { default as getUniqueItemsFn } from '../items/helpers/unique-items.js';
import type { default as isMatchingItemFn } from '../items/helpers/is-matching.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sortItemsAlphabetically: typeof SortItemsFn = (items: any[]) => items;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _getItemCounts: typeof GetItemCountsFn = (items: any[]) => ({} as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _getUniqueItems: typeof getUniqueItemsFn = (items: any[]) => items;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _isMatchingItem: typeof isMatchingItemFn = () => false;

const getItemsHelpers = async () => {
	const [sort, counts, unique, matching] = await Promise.all([
		import('../items/helpers/sort.js'),
		import('../items/helpers/counts.js'),
		import('../items/helpers/unique-items.js'),
		import('../items/helpers/is-matching.js')
	]);
	_sortItemsAlphabetically = sort.sortItemsAlphabetically;
	_getItemCounts = counts.getItemCounts;
	_getUniqueItems = unique.default ?? (unique as any).getUniqueItems ?? unique;
	_isMatchingItem = matching.default ?? (matching as any).isMatchingItem ?? matching;
};

getItemsHelpers().catch(() => {
	// Items helpers may not exist yet during generation; stubs remain in place
});

// ---------------------------------------------------------------------------
// Item operations
// ---------------------------------------------------------------------------

export function addItem (self: BaseCreature, item: ItemInstance): void {
	self.items = _sortItemsAlphabetically([...self.items, item]);

	if (item.onAdded) item.onAdded(self);

	item.emit('added', { creature: self });
	self.emit('itemAdded', { item });
}

export function removeItem (self: BaseCreature, itemToRemove: ItemInstance): ItemInstance | undefined {
	const itemIndex = self.items.findIndex((item: ItemInstance) => _isMatchingItem(item, itemToRemove));

	if (itemIndex >= 0) {
		const foundItem = self.items.splice(itemIndex, 1)[0];

		if (foundItem.onRemoved) foundItem.onRemoved(self);

		foundItem.emit('removed', { creature: self });
		self.emit('itemRemoved', { item: foundItem });

		return foundItem;
	}

	return undefined;
}

export function giveItem (self: BaseCreature, itemToGive: ItemInstance, recipient: BaseCreature): void {
	const item = removeItem(self, itemToGive);

	if (item) {
		recipient.addItem(item);
		self.emit('itemGiven', { item, recipient });
	}
}

export function useItem (self: BaseCreature, { channel, channelName, character = self as unknown as BaseCreature, item, monster }: {
	channel: ChannelFn;
	channelName?: string;
	character?: BaseCreature;
	item: ItemInstance;
	monster?: BaseCreature;
}): Promise<unknown> {
	return Promise.resolve()
		.then(() => {
			if (monster && monster.inEncounter && !monster.items.find((potentialItem: ItemInstance) => _isMatchingItem(potentialItem, item))) {
				return Promise.reject(channel({
					announce: `${monster.givenName} doesn't seem to be holding that item.`
				}));
			}

			return item.use({ channel, channelName, character, monster });
		});
}

export function lookAtItems (self: BaseCreature, channel: ChannelFn, items: ItemInstance[] = self.items): Promise<void> {
	if (items.length < 1) return Promise.reject();

	const sortedItems = _sortItemsAlphabetically(items);
	const channelWithMgr = channel as unknown as ChannelWithManager;
	const { channelManager, channelName } = channelWithMgr;

	return Promise.resolve()
		.then(() => eachSeries(_getUniqueItems(sortedItems), (item: ItemInstance) => channelManager.queueMessage({
			announce: itemCard(item, true),
			channel,
			channelName
		})))
		.then(() => channelManager.queueMessage({
			announce: Object.entries(_getItemCounts(sortedItems) as Record<string, number>).reduce(
				(counts: string, [card, count]: [string, number]) => `${counts}${card} (${count})\n`,
				''
			),
			channel,
			channelName
		}))
		.then(() => channelManager.sendMessages());
}
