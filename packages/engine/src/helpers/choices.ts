import { monsterCard } from './card.js';

const getChoices = (array: string[]): string =>
	array.map((choice, index) => `${index}) ${choice}`).join('\n');

const getItemChoices = (items: Record<string, unknown>): string =>
	getChoices(Object.keys(items).map(item => `${item} [${items[item]}]`));

const getItemChoicesWithPrice = (
	items: Record<string, { count: unknown; cost: unknown }>
): string =>
	getChoices(
		Object.keys(items).map(item => `${item} [${items[item].count}] - ${items[item].cost} coins`)
	);

const getFinalItemChoices = (items: Array<{ itemType?: string }>): string =>
	getChoices(items.map(item => item.itemType ?? ''));

const getMonsterChoices = (monsters: Array<Record<string, unknown>>): string =>
	getChoices(monsters.map(monster => monsterCard(monster as Parameters<typeof monsterCard>[0], false)));

const getCreatureTypeChoices = (creatures: Array<{ creatureType?: string }>): string =>
	getChoices(creatures.map(creature => creature.creatureType ?? ''));

const getAttributeChoices = (options: Record<string, unknown>): string =>
	getChoices(
		Object.keys(options).map(key => `${key} (${JSON.stringify(options[key])})`)
	);

export {
	getAttributeChoices,
	getItemChoices as getCardChoices,
	getChoices,
	getCreatureTypeChoices,
	getFinalItemChoices as getFinalCardChoices,
	getFinalItemChoices,
	getItemChoices,
	getItemChoicesWithPrice,
	getMonsterChoices
};
