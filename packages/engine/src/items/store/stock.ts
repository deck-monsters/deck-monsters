import { random } from '../../helpers/random.js';
import { sortItemsAlphabetically, drawItem } from '../index.js';
import { all as allCards, draw as drawCard, sortCardsAlphabetically } from '../../cards/index.js';

// Cards used to be reached through an async `getCardsModule()` dynamic `import()`, on the
// asserted-but-never-checked claim that a static import from `cards/index.js` would create
// an import cycle. It doesn't: nothing under `cards/` imports `items/index.ts` or
// `items/store/*` (cards/base.ts and its helpers reach into `items/base.js` and individual
// `items/helpers/*.js` files directly, never the barrel) — see the dependency audit in
// docs/roadmap/10b-bugs-fixed.md, item #5. `getItems`/`getBackRoom`/`generateShop`/
// `resolveShop`/`Game.shop` are all synchronous, so the async indirection could never
// actually be awaited from any of them — `getCards()` was hard-coded to `[]` specifically
// because there was no sync way to reach the dynamically-imported module. A plain static
// import removes the problem instead of working around it.

const DEFAULT_MIN_INVENTORY_SIZE = 5;
const DEFAULT_MAX_INVENTORY_SIZE = 20;

// Standard shelf card count. Half of `getItems`'s ceiling on purpose: a single card is
// worth strictly more than a single item (it's a permanent deck upgrade, not a
// consumable), and the shop already lists cards inline in the same choice prompt as
// items/back-room goods — a 5-20 spread there would make an already-long shop menu
// unreadable. 4-10 keeps every visit likely to have *something* new to buy (the whole
// point of this fix — see docs/roadmap/19-player-agency-and-items.md §3) without turning
// "browse cards" into a wall of text.
const DEFAULT_MIN_CARD_INVENTORY_SIZE = 4;
const DEFAULT_MAX_CARD_INVENTORY_SIZE = 10;

const DEFAULT_MIN_BACK_ROOM_INVENTORY_SIZE = 1;
const DEFAULT_MAX_BACK_ROOM_INVENTORY_SIZE = 3;

// Smaller than the back room's item range — back-room cards are priced through the same
// steep `backRoomOffset` (5.5-9.5x, see shop.ts) as back-room items, and most eligible
// cards sit at the PRICEY/EXPENSIVE cost tiers already (see cards/*.ts), so 1-2 keeps the
// back room a rare treat rather than a second full shelf.
const DEFAULT_MIN_BACK_ROOM_CARD_INVENTORY_SIZE = 1;
const DEFAULT_MAX_BACK_ROOM_CARD_INVENTORY_SIZE = 2;

interface ItemFilter {
	canHoldCard?: (card: any) => boolean;
	canHoldItem: (item: any) => boolean;
}

const canHoldBackRoom: ItemFilter = {
	canHoldCard: (card: any) => card.notForSale && !card.neverForSale,
	canHoldItem: (item: any) => item.notForSale && !item.neverForSale
};

const canHoldStandard: ItemFilter = {
	canHoldCard: (card: any) => !card.notForSale && !card.neverForSale,
	canHoldItem: (item: any) => !item.notForSale && !item.neverForSale
};

/**
 * `cards/helpers/draw.ts`'s `draw()` takes a creature-shaped `canHoldCard` filter (which
 * `ItemFilter` above already matches, same trick as passing `canHoldStandard`/
 * `canHoldBackRoom` straight into `drawItem` as the "creature") — but unlike `drawItem`,
 * it has no floor check: if the filtered pool is empty, `deck.find(...)` returns
 * `undefined` and it recurses forever instead of returning `null`. It was always safe
 * before because it was only ever called with a real creature, whose level gate leaves
 * *some* eligible card. A shop filter is not guaranteed that, so check the pool size up
 * front and mirror `drawItem`'s null-return contract here rather than risk a hang.
 */
const drawEligibleCard = (filter: ItemFilter): any | null => {
	const eligible = allCards.filter((Card: any) => filter.canHoldCard!(Card));

	if (eligible.length <= 0) return null;

	return drawCard({}, filter);
};

export const getBackRoom = (): any[] => {
	const items: any[] = [];
	const itemInventorySize = random(DEFAULT_MIN_BACK_ROOM_INVENTORY_SIZE, DEFAULT_MAX_BACK_ROOM_INVENTORY_SIZE);

	while (items.length < itemInventorySize) {
		const item = drawItem({}, canHoldBackRoom);

		if (item) {
			items.push(item);
		} else {
			break;
		}
	}

	// `canHoldBackRoom.canHoldCard` (notForSale && !neverForSale) was defined for exactly
	// this and never used — the back room stocked rare items but never rare cards, even
	// though the filter for it already existed. See docs/roadmap/10b-bugs-fixed.md #5.
	const cards: any[] = [];
	const cardInventorySize = random(DEFAULT_MIN_BACK_ROOM_CARD_INVENTORY_SIZE, DEFAULT_MAX_BACK_ROOM_CARD_INVENTORY_SIZE);

	while (cards.length < cardInventorySize) {
		const card = drawEligibleCard(canHoldBackRoom);

		if (card) {
			cards.push(card);
		} else {
			break;
		}
	}

	// Sorted as two blocks, not one merged-then-sorted array: items sort by `itemType` and
	// cards by `cardType`, so sorting a mixed array on either key leaves every entry of the
	// other type comparing as `undefined` (always equal) and stuck in draw order — that
	// reads as broken alphabetising, not real interleaving. Two clean blocks are honest
	// about what's actually sorted.
	return [...sortItemsAlphabetically(items), ...sortCardsAlphabetically(cards)];
};

export const getCards = (): any[] => {
	const cards: any[] = [];
	const cardInventorySize = random(DEFAULT_MIN_CARD_INVENTORY_SIZE, DEFAULT_MAX_CARD_INVENTORY_SIZE);

	while (cards.length < cardInventorySize) {
		const card = drawEligibleCard(canHoldStandard);

		if (card) {
			cards.push(card);
		} else {
			break;
		}
	}

	return sortCardsAlphabetically(cards);
};

export const getItems = (): any[] => {
	const items: any[] = [];
	const itemInventorySize = random(DEFAULT_MIN_INVENTORY_SIZE, DEFAULT_MAX_INVENTORY_SIZE);

	while (items.length < itemInventorySize) {
		const item = drawItem({}, canHoldStandard);

		if (item) {
			items.push(item);
		} else {
			break;
		}
	}

	return sortItemsAlphabetically(items);
};
