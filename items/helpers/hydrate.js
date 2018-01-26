const { sortItemsAlphabetically } = require('./sort');
const all = require('./all');
const draw = require('./draw');

const hydrateItem = (itemObj, monster) => {
	const Item = all.find(({ name }) => name === itemObj.name);
	if (Item) return new Item(itemObj.options);

	return draw({}, monster);
};

const hydrateItems = (itemsJSON = [], monster) => {
	let items = typeof itemsJSON === 'string' ? JSON.parse(itemsJSON) : itemsJSON;
	items = items.map(itemObj => hydrateItem(itemObj, monster));
	items = sortItemsAlphabetically(items);

	return items;
};

module.exports = {
	hydrateItem,
	hydrateItems
};
