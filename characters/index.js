const { hydrateCharacter, hydrateCharacters } = require('./helpers/hydrate');
const allCharacters = require('./helpers/all');
const Beastmaster = require('./beastmaster');
const createCharacter = require('./helpers/create');
const randomCharacter = require('./helpers/random');

module.exports = {
	all: allCharacters,
	allCharacters,
	Beastmaster,
	create: createCharacter,
	createCharacter,
	hydrateCharacter,
	hydrateCharacters,
	randomCharacter
};
