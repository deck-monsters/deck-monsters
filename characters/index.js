const emoji = require('node-emoji');

const { hydrateCard, fillDeck } = require('../cards');
const { hydrateMonster } = require('../monsters');
const { getChoices, getCreatureTypeChoices } = require('../helpers/choices');
const PRONOUNS = require('../helpers/pronouns');
const Beastmaster = require('./beastmaster');

const genders = Object.keys(PRONOUNS);

const all = [
	Beastmaster
];

// Channel should be a function that takes a question and an optional array of
// choices and returns an answer to the question (or a Promise that resolves to
// an answer to the question), or that takes a statement to announce.
const create = (channel, { type, name, gender, icon } = {}) => {
	const options = {};

	const iconChoices = [];
	for (let i = 0; i < 7; i++) {
		iconChoices.push(emoji.random().emoji);
	}

	let Character;
	return Promise
		.resolve()
		.then(() => {
			if (type !== undefined) {
				return type;
			}

			return channel({
				question:
`Which type of character would you like to be?

${getCreatureTypeChoices(all)}`,
				choices: Object.keys(all)
			});
		})
		.then((answer) => {
			Character = all[answer];

			if (name !== undefined) {
				return name;
			}

			return channel({
				question: `What would you like to name your new ${Character.creatureType.toLowerCase()}?`
			});
		})
		.then((answer) => {
			// TO-DO: Keep a master list of monsters and ensure that there are no duplicate names
			options.name = answer;

			if (gender !== undefined) {
				return gender;
			}

			return channel({
				question:
`What gender would you like your ${Character.creatureType.toLowerCase()} to be?

${getChoices(genders)}`,
				choices: Object.keys(genders)
			});
		})
		.then((answer) => {
			options.gender = genders[answer].toLowerCase();

			if (icon !== undefined) {
				return icon;
			}

			return channel({
				question:
`Finally, choose an avatar:

${getChoices(iconChoices)}`,
				choices: Object.keys(iconChoices)
			});
		})
		.then((answer) => {
			options.icon = iconChoices[answer];

			return new Character(options);
		});
};

const hydrateCharacter = (characterObj) => {
	const Character = all.find(({ name }) => name === characterObj.name);
	const options = Object.assign({ deck: [], monsters: [] }, characterObj.options);

	options.deck = options.deck.map(hydrateCard);
	options.monsters = options.monsters.map(hydrateMonster);

	const character = new Character(options);

	// if deck minimum changes, and player now has fewer than minimum cards in already initialized deck, fill them up! (yes, this has happened)
	character.deck = fillDeck(options.deck, { level: character.level });

	return character;
};

const hydrateCharacters = charactersJSON => JSON
	.parse(charactersJSON)
	.map(hydrateCharacter);

module.exports = {
	all,
	create,
	hydrateCharacter,
	hydrateCharacters,
	Beastmaster
};
