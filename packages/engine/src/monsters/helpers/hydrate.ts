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

let _hydratorStatus = { hydrateCard: false, hydrateItem: false };

/** Returns whether lazy hydrators were successfully loaded (not stubs). */
export const getMonsterHydratorStatus = (): { hydrateCard: boolean; hydrateItem: boolean } =>
	({ ..._hydratorStatus });

const loadHydrators = async () => {
	const [cardsModule, itemsModule] = await Promise.all([
		import('../../cards/helpers/hydrate.js').catch(() => null),
		import('../../items/helpers/hydrate.js').catch(() => null),
	]);
	if (cardsModule) {
		const fn = (cardsModule as any).hydrateCard ?? (cardsModule as any).default;
		if (typeof fn === 'function') {
			_hydrateCard = fn;
			_hydratorStatus.hydrateCard = true;
		}
	}
	if (itemsModule) {
		const fn = (itemsModule as any).hydrateItem ?? (itemsModule as any).default;
		if (typeof fn === 'function') {
			_hydrateItem = fn;
			_hydratorStatus.hydrateItem = true;
		}
	}
};

export const monsterHydrateReady: Promise<void> = loadHydrators().catch((err) => {
	console.error('[engine] monsterHydrateReady FAILED — card/item hydration will be broken:', err);
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
