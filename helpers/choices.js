const { monsterCard } = require('../helpers/card');

const getChoices = array => array.map((choice, index) => `${index}) ${choice}`).join('\n');

const getItemChoices = items => getChoices(Object.keys(items).map(item => `${item} [${items[item]}]`));

const getFinalItemChoices = items => getChoices(items.map(item => item.itemType));

const getMonsterChoices = monsters => getChoices(monsters.map(monster => monsterCard(monster, false)));

const getCreatureTypeChoices = creatures => getChoices(creatures.map(creature => creature.creatureType));

const getAttributeChoices = options => getChoices(Object.keys(options).map(key => `${key} (${JSON.stringify(options[key])})`));

module.exports = {
	getAttributeChoices,
	getCardChoices: getItemChoices,
	getChoices,
	getCreatureTypeChoices,
	getFinalCardChoices: getFinalItemChoices,
	getFinalItemChoices,
	getItemChoices,
	getMonsterChoices
};
