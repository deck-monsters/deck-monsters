const Basilisk = require('./basilisk');
const Minotaur = require('./minotaur');
const WeepingAngel = require('./weeping-angel');

const all = [
	Basilisk,
	Minotaur,
	WeepingAngel
];

const hydrateMonster = (monsterObj) => {
	const Monster = all.find(({ name }) => name === monsterObj.name);
	return new Monster(monsterObj.options);
};

const hydrateMonsters = monstersJSON => JSON
	.parse(monstersJSON)
	.map(hydrateMonster);

module.exports = {
	all,
	hydrateMonster,
	hydrateMonsters
};
