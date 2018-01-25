const emoji = require('node-emoji');

const { getChoices, getCreatureTypeChoices } = require('../../helpers/choices');
const allCharacters = require('./all');
const names = require('../../helpers/names');
const PRONOUNS = require('../../helpers/pronouns');

const genders = Object.keys(PRONOUNS);

// Create a new character for yourself
module.exports = (channel, {
	type, name, game, gender, icon
} = {}) => {
	const options = {};

	const iconChoices = [];
	for (let i = 0; i < 7; i++) {
		iconChoices.push(emoji.random().emoji);
	}

	const askForCreatureType = () => Promise
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
			const Character = allCharacters[answer];

			return Character;
		});

	const askForGender = Character => Promise
		.resolve()
		.then(() => {
			if (gender !== undefined) {
				return gender;
			}

			return channel({
				question:
`What gender should your ${Character.creatureType.toLowerCase()} be?

${getChoices(genders)}`,
				choices: Object.keys(genders)
			});
		})
		.then((answer) => {
			options.gender = genders[answer].toLowerCase();
			return options;
		});

	const askForName = (Character, alreadyTaken) => Promise
		.resolve()
		.then(() => {
			if (name !== undefined && !alreadyTaken) {
				return name;
			}

			let question = '';
			if (alreadyTaken) question += 'That name is already taken, please choose a different name. ';

			const name1 = names(Character.creatureType, options.gender);
			const name2 = names(Character.creatureType, options.gender, [name1]);

			question += `What would you like to name ${PRONOUNS[options.gender].him}? ${name1}? ${name2}? Something else?`;

			return channel({
				question
			});
		})
		.then((answer) => {
			if (game && game.findCharacterByName(answer)) {
				return askForName(Character, true);
			}

			options.name = answer;
			return options;
		});

	const askForAvatar = () => Promise
		.resolve()
		.then(() => {
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
			return options;
		});

	let Character;
	return Promise
		.resolve()
		.then(askForCreatureType)
		.then((Type) => {
			Character = Type;

			return Character;
		})
		.then(() => askForGender(Character))
		.then(() => askForName(Character))
		.then(() => askForAvatar())
		.then(() => new Character(options));
};
