const { formatCard } = require('../helpers/card');

const getChoices = array => array.map((choice, index) => `${index}) ${choice}`).join('\n');

const getCardChoices = remainingCards => getChoices(remainingCards.map(card => card.cardType));

const getMonsterChoices = monsters => getChoices(
	monsters.map(monster => formatCard({
		title: `${monster.icon}  ${monster.name} > ${monster.givenName}`,
		description: monster.individualDescription,
		stats: monster.stats
	}))
);

const getMonsterTypeChoices = monsters => getChoices(monsters.map(monster => monster.creatureType));

module.exports = {
	getChoices,
	getCardChoices,
	getMonsterChoices,
	getMonsterTypeChoices
};
