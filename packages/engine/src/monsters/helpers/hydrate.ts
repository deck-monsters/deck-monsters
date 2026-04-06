import type BaseMonster from '../base.js';
import allMonsters from './all.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CardInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ItemInstance = any;

interface MonsterObj {
	name: string;
	options: {
		cards?: CardInstance[];
		items?: ItemInstance[];
		[key: string]: unknown;
	};
}

// Lazy-load cards/items hydration to break circular dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _hydrateCard: (cardObj: any, monster: any, deck: any) => CardInstance = obj => obj;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _hydrateItem: (itemObj: any, monster: any) => ItemInstance = obj => obj;

const loadHydrators = async () => {
	const [cardsModule, itemsModule] = await Promise.all([
		import('../../cards/helpers/hydrate.js').catch(() => null),
		import('../../items/helpers/hydrate.js').catch(() => null),
	]);
	if (cardsModule) {
		_hydrateCard =
			(cardsModule as any).hydrateCard ?? (cardsModule as any).default ?? _hydrateCard;
	}
	if (itemsModule) {
		_hydrateItem =
			(itemsModule as any).hydrateItem ?? (itemsModule as any).default ?? _hydrateItem;
	}
};

loadHydrators().catch(() => {
	// Hydrators not ready yet; stubs remain in place
});

const hydrateMonster = (monsterObj: MonsterObj, deck?: CardInstance[]): BaseMonster => {
	const MonsterClass = allMonsters.find(({ name }) => name === monsterObj.name);

	if (!MonsterClass) {
		throw new Error(`Unknown monster type: ${monsterObj.name}`);
	}

	const options = {
		...monsterObj.options,
		cards: [] as CardInstance[],
	};

	const monster = new MonsterClass(options);

	if (monsterObj.options.cards) {
		monster.cards = monsterObj.options.cards
			.map((cardObj: CardInstance) => _hydrateCard(cardObj, monster, deck))
			.filter(Boolean);
	}

	if (monsterObj.options.items) {
		monster.items = monsterObj.options.items
			.map((itemObj: ItemInstance) => _hydrateItem(itemObj, monster))
			.filter(Boolean);
	}

	return monster;
};

const hydrateMonsters = (monstersJSON: string): BaseMonster[] =>
	(JSON.parse(monstersJSON) as MonsterObj[]).map(obj => hydrateMonster(obj));

export { hydrateMonster, hydrateMonsters };
