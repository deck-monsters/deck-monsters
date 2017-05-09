const { monsterCard } = require('../helpers/card');

const getChoices = array => array.map((choice, index) => `${index}) ${choice}`).join('\n');

const getCardChoices = remainingCards => getChoices(remainingCards.map(card => card.cardType));

const getMonsterChoices = monsters => getChoices(
	monsters.map(monster => monsterCard(monster))
);

const getCreatureTypeChoices = creatures => getChoices(creatures.map(creature => creature.creatureType));

module.exports = {
	getChoices,
	getCardChoices,
	getMonsterChoices,
	getCreatureTypeChoices
};
