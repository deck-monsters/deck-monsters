const { monsterCard } = require('../helpers/card');

const getChoices = array => array.map((choice, index) => `${index}) ${choice}`).join('\n');

const getCardChoices = remainingCards => getChoices(Object.keys(remainingCards).map(card => `${card} [${remainingCards[card]}]`));

const getFinalCardChoices = deck => getChoices(deck.map(card => card.cardType));

const getMonsterChoices = monsters => getChoices(monsters.map(monster => monsterCard(monster)));

const getCreatureTypeChoices = creatures => getChoices(creatures.map(creature => creature.creatureType));

const getAttributeChoices = options => getChoices(Object.keys(options).map(key => `${key} (${options[key]})`));

module.exports = {
	getChoices,
	getCardChoices,
	getFinalCardChoices,
	getMonsterChoices,
	getCreatureTypeChoices,
	getAttributeChoices
};
