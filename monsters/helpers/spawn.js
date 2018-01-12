const { getChoices, getCreatureTypeChoices } = require('../../helpers/choices');
const PRONOUNS = require('../../helpers/pronouns');

const allMonsters = require('./all');

const genders = Object.keys(PRONOUNS);

// Spawn a new monster
module.exports = (channel, {
	type, name, color, gender, cards, game, xp
} = {}) => {
	const options = {};

	if (cards && cards.length > 0) {
		options.cards = cards;
	}

	if (xp && xp > 0) {
		options.xp = xp;
	}

	let monsterNames = [];
	if (game) {
		monsterNames = Object.keys(game.getAllMonstersLookup());
	}

	const askForCreatureType = () => Promise
		.resolve()
		.then(() => {
			if (type !== undefined) {
				return type;
			}

			return channel({
				question:
`Which type of monster would you like to spawn?

${getCreatureTypeChoices(allMonsters)}`,
				choices: Object.keys(allMonsters)
			});
		})
		.then((answer) => {
			const Monster = allMonsters[answer];

			return Monster;
		});

	const askForName = (Monster, alreadyTaken) => Promise
		.resolve()
		.then(() => {
			if (name !== undefined && !alreadyTaken) {
				return name;
			}

			let question = '';
			if (alreadyTaken) question += 'That name is already taken, please choose a different name. ';

			question += `What would you like to name your new ${Monster.creatureType.toLowerCase()}?`;

			return channel({
				question
			});
		})
		.then((answer) => {
			if (monsterNames.includes(answer.toLowerCase())) {
				return askForName(Monster, true);
			}

			options.name = answer;
			return options;
		});

	const askForColor = () => Promise
		.resolve()
		.then(() => {
			if (color !== undefined) {
				return color;
			}

			return channel({
				question: `What color should ${options.name} be?`
			});
		})
		.then((answer) => {
			options.color = answer.toLowerCase();
			return options;
		});

	const askForGender = Monster => Promise
		.resolve()
		.then(() => {
			if (gender !== undefined) {
				return gender;
			}

			return channel({
				question:
`What gender is ${options.name} the ${options.color} ${Monster.creatureType.toLowerCase()}?

${getChoices(genders)}`,
				choices: Object.keys(genders)
			});
		})
		.then((answer) => {
			options.gender = genders[answer].toLowerCase();
			return options;
		});

	let Monster;
	return Promise
		.resolve()
		.then(askForCreatureType)
		.then((Type) => {
			Monster = Type;

			return Monster;
		})
		.then(() => askForName(Monster))
		.then(askForColor)
		.then(() => askForGender(Monster))
		.then(() => new Monster(options));
};
