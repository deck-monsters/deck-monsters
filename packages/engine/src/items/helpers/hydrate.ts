import { sortItemsAlphabetically } from './sort.js';
import all from './all.js';
import draw from './draw.js';

export const hydrateItem = (itemObj: { name: string; options?: Record<string, unknown> }, monster?: any): any => {
	const Item = all.find(({ name }: { name: string }) => name === itemObj.name);
	if (Item) return new Item(itemObj.options);

	return draw({}, monster);
};

export const hydrateItems = (itemsJSON: string | Array<{ name: string; options?: Record<string, unknown> }> = [], monster?: any): any[] => {
	let items = typeof itemsJSON === 'string' ? JSON.parse(itemsJSON) as Array<{ name: string; options?: Record<string, unknown> }> : itemsJSON;
	const hydrated = items.map((itemObj: { name: string; options?: Record<string, unknown> }) => hydrateItem(itemObj, monster));
	return sortItemsAlphabetically(hydrated);
};
