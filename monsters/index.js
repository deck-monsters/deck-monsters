const startCase = require('lodash.startcase');

const Basilisk = require('./basilisk');
const Minotaur = require('./minotaur');
const WeepingAngel = require('./weeping-angel');
const PRONOUNS = require('../helpers/pronouns');

const all = [
	Basilisk,
	Minotaur,
	WeepingAngel
];

// Callback should be a function that takes a question and an optional array of
// choices and returns an answer to the question (or a Promise that resolves to
// an answer to the question)
const spawn = (callback) => {
	const monsterTypes = all.map(monster => monster.creatureType);
	const options = {};
	let Monster;

	return Promise
		.resolve()
		.then(() => callback({
			question: 'Which type of monster would you like to spawn?',
			choices: monsterTypes
		}))
		.then((answer) => {
			Monster = all.find(monster => monster.creatureType.toLowerCase() === answer.toLowerCase());

			return callback({
				question: `What would you like to name your new ${Monster.creatureType.toLowerCase()}?`
			});
		})
		.then((answer) => {
			options.name = startCase(answer.toLowerCase());

			return callback({
				question: `What color should ${options.name} be?`
			});
		})
		.then((answer) => {
			options.color = answer.toLowerCase();

			return callback({
				question: `What gender is ${options.name} the ${options.color} ${Monster.creatureType.toLowerCase()}?`,
				choices: Object.keys(PRONOUNS)
			});
		})
		.then((answer) => {
			options.gender = answer.toLowerCase();

			return new Monster(options);
		});
};

const hydrateMonster = (monsterObj) => {
	const Monster = all.find(({ name }) => name === monsterObj.name);
	return new Monster(monsterObj.options);
};

const hydrateMonsters = monstersJSON => JSON
	.parse(monstersJSON)
	.map(hydrateMonster);

module.exports = {
	all,
	spawn,
	hydrateMonster,
	hydrateMonsters
};
