import type { ShopHost } from './shop.js';

export type ShopItemSection = 'items' | 'backRoom' | 'cards';

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
	const stock = section === 'backRoom' ? shop.backRoom : section === 'cards' ? shop.cards : shop.items;
	const item = stock[stockIndex];
	// Cards' `itemType` getter is aliased to `cardType` (see `cards/base.ts`), but plain
	// fixtures/test doubles for card stock only set `cardType` — fall back to it so the
	// stock-token check works for both real card instances and lightweight test shapes.
	const identity = item?.itemType ?? item?.cardType;

	if (!item || identity !== expectedItemType) {
		throw new Error('That item is no longer in stock. Refresh the shop and try again.');
	}

	// Cards price identically to standard items (`priceOffset * 2` — see buy.ts's console
	// flow, which uses the same multiplier for both the "Items" and "Cards" menu options).
	// Only the back room has its own, steeper offset.
	const priceOffset = section === 'backRoom' ? shop.backRoomOffset : shop.priceOffset * 2;
	const price = Math.round(item.cost * priceOffset);
	if (price > character.coins) {
		throw new Error(`You need ${price} coins to buy ${identity}.`);
	}

	const remaining = stock.slice();
	remaining.splice(stockIndex, 1);
	character.coins -= price;
	// Cards go to the character's deck (`addCard`), never `character.items` — the two
	// inventories are tracked separately and equipping/using each goes through different
	// flows. Buying a card through the graphical shop must land it in the same place the
	// console's `chooseCards` purchase path does.
	if (section === 'cards') {
		character.addCard(item);
	} else {
		character.addItem(item);
	}
	host.commitShop({ ...shop, [section]: remaining });

	return { item, price, remainingCoins: character.coins };
};
