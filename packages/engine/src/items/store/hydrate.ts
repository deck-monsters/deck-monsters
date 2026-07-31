import { hydrateItems } from '../helpers/hydrate.js';
import { hydrateDeck } from '../../cards/helpers/hydrate.js';
import type { Shop } from './shop.js';

export const hydrateShop = (shopObj: Record<string, unknown>): Shop => ({
	...shopObj,
	backRoom: hydrateItems(shopObj.backRoom as any),
	cards: hydrateDeck(shopObj.cards as any),
	closingTime: new Date(shopObj.closingTime as string | number),
	items: hydrateItems(shopObj.items as any)
} as Shop);

export default hydrateShop;
