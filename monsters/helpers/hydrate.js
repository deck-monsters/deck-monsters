const { hydrateCard } = require('../../cards');

const allMonsters = require('./all');

const hydrateMonster = (monsterObj, deck) => {
	const Monster = allMonsters.find(({ name }) => name === monsterObj.name);
	const options = {
		...monsterObj.options,
		cards: []
	};

	const monster = new Monster(options);

	if (monsterObj.options.cards) {
		monster.cards = monsterObj.options.cards.map(cardObj => hydrateCard(cardObj, monster, deck));
	}

	return monster;
};

const hydrateMonsters = monstersJSON => JSON
	.parse(monstersJSON)
	.map(hydrateMonster);

module.exports = {
	hydrateMonster,
	hydrateMonsters
};
