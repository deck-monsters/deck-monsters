const { randomColor } = require('grab-color-names');
const emoji = require('node-emoji');
const sample = require('lodash.sample');
const shuffle = require('lodash.shuffle');

const { getChoices, getCreatureTypeChoices } = require('../helpers/choices');
const { hydrateDeck, fillDeck } = require('../cards');
const { all: allMonsters, hydrateMonster } = require('../monsters');
const { randomInt } = require('../helpers/chance');
const { XP_PER_VICTORY } = require('../helpers/experience');
const Beastmaster = require('./beastmaster');
const PRONOUNS = require('../helpers/pronouns');

const genders = Object.keys(PRONOUNS);

const all = [
	Beastmaster
];

// Channel should be a function that takes a question and an optional array of
// choices and returns an answer to the question (or a Promise that resolves to
// an answer to the question), or that takes a statement to announce.
const create = (channel, {
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

const randomCharacter = ({
	battles = {},
	isBoss,
	Monsters,
	...options
} = {}) => {
	if (!battles.total) {
		battles.total = randomInt({ max: 80 });
		battles.wins = randomInt({ max: battles.total });
		battles.losses = battles.total - battles.wins;
	}

	const icon = emoji.random().emoji;

	const xp = XP_PER_VICTORY * battles.wins;

	const monsters = (Monsters || [sample(allMonsters)]).map((Monster) => {
		const monster = new Monster({
			battles,
			color: randomColor()[1].toLowerCase(),
			isBoss,
			xp,
			...options
		});

		if (isBoss) {
			const { canHold } = monster;

			monster.canHold = object => canHold.call(monster, object) && !object.noBosses;
		}

		return monster;
	});

	const character = new Beastmaster({
		battles,
		icon,
		isBoss,
		monsters,
		xp,
		...options
	});

	// If this is a boss, clean up the deck (reducing probability of certain cards)
	if (isBoss) {
		let deck = fillDeck([], {}, character);
		deck = deck.filter(card => card.cardType !== 'Heal' && card.cardType !== 'WhiskeyShot');
		character.deck = fillDeck(deck, {}, character);
	}

	// Equip the monster
	monsters.forEach((monster) => {
		monster.cards = [
			...shuffle(character.deck.filter(card => monster.canHoldCard(card))),
			...fillDeck([], {}, monster) // Add more cards just in case the character doesn't have enough
		].slice(0, monster.cardSlots);
	});

	return character;
};

const hydrateCharacter = (characterObj) => {
	const Character = all.find(({ name }) => name === characterObj.name);
	const options = Object.assign({ deck: [], monsters: [] }, characterObj.options);

	options.deck = hydrateDeck(options.deck);
	options.monsters = options.monsters.map(monsterObj => hydrateMonster(monsterObj, options.deck));

	const character = new Character(options);

	// if deck minimum changes, and player now has fewer than minimum cards in already initialized deck, fill them up! (yes, this has happened)
	character.deck = fillDeck(options.deck, options, character);

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
	randomCharacter,
	Beastmaster
};
