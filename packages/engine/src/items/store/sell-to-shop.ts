import { getItemKey } from '../helpers/counts.js';
import { removeCardFromPool } from '../helpers/remove-card-from-pool.js';
import { getSalePrice, getSaleTotal } from './sell-pricing.js';
import type { ShopHost } from './shop.js';

export type SellSection = 'items' | 'cards';

export interface SellSelection {
	section: SellSection;
	// Matched against `getItemKey` (itemType, or cardType for cards) case-insensitively,
	// same as the console's answer-by-name path (helpers/choose.ts) — the web sends the
	// display name it already rendered rather than an index into an array the player
	// never saw as a list.
	type: string;
	count: number;
}

export interface ShopSaleLine {
	section: SellSection;
	type: string;
	count: number;
	unitPrice: number;
	total: number;
}

export interface ShopSaleResult {
	sold: ShopSaleLine[];
	totalValue: number;
	remainingCoins: number;
}

/**
 * Prompt-free, atomic shop sale used by the web Workshop — the counterpart to
 * `purchaseShopItem`. Mirrors the console's `sellItems` (sell.ts) rules exactly, since
 * that flow's tests are the contract for what "the same sale" means:
 *
 * - only the CHARACTER's own unequipped deck (`character.cards`) and pocket items
 *   (`character.items`) are sellable — a card equipped onto a monster's deck, or an
 *   item a monster is carrying, has already left those two arrays (see
 *   `docs/architecture/workshop-and-items.md#inventory-read-model`), so there is
 *   nothing extra to refuse here: the pools this function reads from simply don't
 *   contain them. Monster-carried items are not sellable from the web either, for the
 *   same reason.
 * - price is `getSalePrice`/`getSaleTotal` against `shop.priceOffset`, the same shared
 *   helper sell.ts now uses, so a console sale and a web sale of the same items in the
 *   same shop can never disagree.
 * - an item's `expired` state (all uses spent) does not block selling it — the console
 *   flow never checked this either, so a used-up potion can still be sold for scrap.
 *
 * Like `purchaseShopItem`, the shop is re-read inside the serialized mutation and the
 * closing-time token is revalidated before anything is charged: the price this call
 * pays is whatever `shop.priceOffset` is *now*, and the merchant (and its rate) rotates
 * every 6 hours, so a stale confirmation dialog must not lock in a stale price — the
 * player is asked to refresh and re-confirm instead of silently selling at a rate they
 * never saw.
 */
export const sellToShop = ({
	character,
	host,
	selections,
	expectedClosingTime,
}: {
	character: any;
	host: ShopHost;
	selections: SellSelection[];
	expectedClosingTime: string;
}): ShopSaleResult => {
	const shop = host.shop;
	if (new Date(shop.closingTime).toISOString() !== expectedClosingTime) {
		throw new Error('The shop has rotated since you opened it. Refresh the shop and try again.');
	}

	if (!Array.isArray(selections) || selections.length === 0) {
		throw new Error('Choose at least one item or card to sell.');
	}

	const pools: Record<SellSection, any[]> = {
		items: [...(character.items ?? [])],
		cards: [...(character.cards ?? [])],
	};

	const toRemove: Record<SellSection, any[]> = { items: [], cards: [] };
	const sold: ShopSaleLine[] = [];

	for (const selection of selections) {
		const { section, type, count } = selection;

		if (section !== 'items' && section !== 'cards') {
			throw new Error('Unknown selection.');
		}
		if (!type || !Number.isInteger(count) || count < 1) {
			throw new Error('Choose at least one item or card to sell.');
		}

		const pool = pools[section];
		const matches: any[] = [];
		// Same order the console's `chooseItems` resolves a named selection in
		// (`helpers/choose.ts`): first matching instance in array order, not last —
		// selling "2 Bandages" sells the two the player has held longest, and two web
		// sales of the same type in one call can never pick the same instance twice.
		for (let i = 0; i < pool.length && matches.length < count; i += 1) {
			if (getItemKey(pool[i]).toLowerCase() === type.toLowerCase()) {
				matches.push(pool[i]);
			}
		}

		if (matches.length < count) {
			const label = count > 1 ? `${count} ${type}s` : `a ${type}`;
			throw new Error(`You don't have ${label} to sell.`);
		}

		matches.forEach((match) => {
			pool.splice(pool.indexOf(match), 1);
		});

		toRemove[section].push(...matches);
		sold.push({
			section,
			type,
			count,
			unitPrice: getSalePrice(matches[0], shop.priceOffset),
			total: getSaleTotal(matches, shop.priceOffset),
		});
	}

	const totalValue = sold.reduce((total, line) => total + line.total, 0);

	// Re-read (`shop` above, inside this one atomic call) and merge onto the *current*
	// stock — same reasoning as `purchaseShopItem` and the console flow's commit step:
	// building this on a snapshot from before the mutation ran would discard another
	// room member's purchase made in between.
	const newItems = [...shop.items];
	const newCards = [...shop.cards];

	toRemove.items.forEach((item) => {
		character.removeItem(item);
		newItems.push(item);
	});
	toRemove.cards.forEach((card) => {
		// Not `character.removeCard` — see remove-card-from-pool.ts (bug #182): a real
		// Beastmaster's `removeCard` also wipes any monster's whole hand that happens to
		// hold a JSON-identical card.
		removeCardFromPool(character, card);
		newCards.push(card);
	});

	host.commitShop({ ...shop, items: newItems, cards: newCards });
	character.coins += totalValue;

	return { sold, totalValue, remainingCoins: character.coins };
};

export default sellToShop;
