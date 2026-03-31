import fantasyNames from 'fantasy-names';
import { random, sample } from '../../helpers/random.js';
import { throttle } from '../../helpers/throttle.js';
import { getBackRoom, getCards, getItems } from './stock.js';
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

const EIGHT_HOURS = 28800000;

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

let currentShop: Shop | undefined;

const getShop = throttle((): Shop => {
	currentShop = {
		adjective: sample(ADJECTIVES) ?? ADJECTIVES[0],
		backRoom: getBackRoom(),
		backRoomOffset: random(5.5, 9.5),
		cards: getCards(),
		closingTime: new Date(Date.now() + EIGHT_HOURS),
		items: getItems(),
		name: fantasyNames('places', 'magic_shops') as string,
		priceOffset: random(0.6, 0.9),
		pronouns: PRONOUNS[sample(genders) ?? 'male']
	};

	return currentShop;
}, EIGHT_HOURS);

export default getShop;
