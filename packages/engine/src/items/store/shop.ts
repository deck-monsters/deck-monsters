import fantasyNames from 'fantasy-names';
import { random, sample } from '../../helpers/random.js';
import { getBackRoom, getCards, getItems } from './stock.js';
import { nextShopBoundary } from './refresh-boundary.js';
import PRONOUNS, { type PronounSet } from '../../helpers/pronouns.js';

const genders = Object.keys(PRONOUNS) as Array<keyof typeof PRONOUNS>;

const ADJECTIVES = [
	'rusty',
	'moss-covered',
	'gilded',
	'heavy',
	'newly-installed glass',
	'mysterious',
	'hidden',
	'bright red',
	'small, round'
];

export interface Shop {
	adjective: string;
	backRoom: any[];
	backRoomOffset: number;
	cards: any[];
	closingTime: Date;
	items: any[];
	name: string;
	priceOffset: number;
	pronouns: PronounSet;
}

/** Room-scoped owner of a shop instance — satisfied by `Game`. See docs/room-scoping.md. */
export interface ShopHost {
	shop: Shop;
	commitShop(shop: Shop): void;
}

export const generateShop = (now: number = Date.now()): Shop => ({
	adjective: sample(ADJECTIVES) ?? ADJECTIVES[0],
	backRoom: getBackRoom(),
	backRoomOffset: random(5.5, 9.5),
	cards: getCards(),
	closingTime: nextShopBoundary(now),
	items: getItems(),
	name: fantasyNames('places', 'magic_shops') as string,
	priceOffset: random(0.6, 0.9),
	pronouns: PRONOUNS[sample(genders) ?? 'male']
});

/** Returns the stored shop while it's still open, otherwise a freshly generated one. */
export const resolveShop = (stored: Shop | undefined, now: number = Date.now()): Shop => {
	if (stored && Number(new Date(stored.closingTime)) > now) return stored;
	return generateShop(now);
};

export default resolveShop;
