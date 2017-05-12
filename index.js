const reduce = require('lodash.reduce');

const Game = require('./game');
const { hydrateCharacter } = require('./characters');

const restoreGame = (publicChannel, gameJSON, log) => {
	const gameObj = typeof gameJSON === 'string' ? JSON.parse(gameJSON) : Object.assign({}, gameJSON);
	const options = Object.assign({ characters: {} }, gameObj.options);

	// Hydrate characters
	options.characters = reduce(options.characters, (characters, character, id) => {
		characters[id] = hydrateCharacter(character);

		return characters;
	}, {});

	return new Game(publicChannel, options, log);
};

module.exports = {
	Game,
	restoreGame
};
