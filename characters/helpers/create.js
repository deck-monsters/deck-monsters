const emoji = require('node-emoji');

const { getChoices, getCreatureTypeChoices } = require('../../helpers/choices');
const PRONOUNS = require('../../helpers/pronouns');

const allCharacters = require('./all');

const genders = Object.keys(PRONOUNS);

// Create a new character for yourself
module.exports = (channel, {
	type, name, gender, icon
} = {}) => {
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

${getCreatureTypeChoices(allCharacters)}`,
				choices: Object.keys(allCharacters)
			});
		})
		.then((answer) => {
			Character = allCharacters[answer];

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
