import { random } from '../../helpers/random.js';
import { sortItemsAlphabetically, drawItem } from '../index.js';

// Cards module cross-reference — cards may not be fully generated yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cardsModule: any = null;
const getCardsModule = async () => {
	if (!cardsModule) {
		try {
			cardsModule = await import('../../cards/index.js');
		} catch {
			cardsModule = { sortCardsAlphabetically: (x: any[]) => x, draw: () => null };
		}
	}

	return cardsModule;
};

const DEFAULT_MIN_INVENTORY_SIZE = 5;
const DEFAULT_MAX_INVENTORY_SIZE = 20;

const DEFAULT_MIN_BACK_ROOM_INVENTORY_SIZE = 1;
const DEFAULT_MAX_BACK_ROOM_INVENTORY_SIZE = 3;

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

	return sortItemsAlphabetically(items);
};

export const getCards = (): any[] => [];

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

export { getCardsModule };
