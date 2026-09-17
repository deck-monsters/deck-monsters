import type { ShopHost } from './shop.js';

export type ShopItemSection = 'items' | 'backRoom';

export interface ShopPurchaseResult {
	item: any;
	price: number;
	remainingCoins: number;
}

/**
 * Prompt-free, atomic shop purchase used by graphical clients.
 *
	 * The closing boundary, stock position and expected name form an optimistic stock token:
	 * callers may render a shop for as long as they like, but a rotated shop or another
	 * player's purchase cannot silently buy an item from a different listing. The host is
	 * read only inside the serialized mutation, so every operation commits against the
	 * current room-scoped shop.
 */
export const purchaseShopItem = ({
	character,
	host,
	section,
	stockIndex,
	expectedItemType,
	expectedClosingTime,
}: {
	character: any;
	host: ShopHost;
	section: ShopItemSection;
	stockIndex: number;
	expectedItemType: string;
	expectedClosingTime: string;
}): ShopPurchaseResult => {
	const shop = host.shop;
	if (new Date(shop.closingTime).toISOString() !== expectedClosingTime) {
		throw new Error('The shop has rotated since you opened it. Refresh the shop and try again.');
	}
	const stock = section === 'backRoom' ? shop.backRoom : shop.items;
	const item = stock[stockIndex];

	if (!item || item.itemType !== expectedItemType) {
		throw new Error('That item is no longer in stock. Refresh the shop and try again.');
	}

	const priceOffset = section === 'backRoom' ? shop.backRoomOffset : shop.priceOffset * 2;
	const price = Math.round(item.cost * priceOffset);
	if (price > character.coins) {
		throw new Error(`You need ${price} coins to buy ${item.itemType}.`);
	}

	const remaining = stock.slice();
	remaining.splice(stockIndex, 1);
	character.coins -= price;
	character.addItem(item);
	host.commitShop({ ...shop, [section]: remaining });

	return { item, price, remainingCoins: character.coins };
};
