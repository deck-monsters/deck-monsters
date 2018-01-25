const { fillDeck, hydrateDeck } = require('../../cards');
const { hydrateItems } = require('../../items');
const { hydrateMonster } = require('../../monsters');

const allCharacters = require('./all');

const hydrateCharacter = (characterObj) => {
	const Character = allCharacters.find(({ name }) => name === characterObj.name);
	const options = Object.assign({ deck: [], items: [], monsters: [] }, characterObj.options);

	options.deck = hydrateDeck(options.deck);
	options.items = hydrateItems(options.items);
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
	hydrateCharacter,
	hydrateCharacters
};
