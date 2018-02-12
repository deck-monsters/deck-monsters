const reduce = require('lodash.reduce');
const zlib = require('zlib');

const Game = require('./game');
const { hydrateCharacter } = require('./characters');

const getOptions = (gameJSON) => {
	let gameObj;

	if (typeof gameJSON === 'string') {
		try {
			gameObj = JSON.parse(gameJSON);
		} catch (err) {
			gameObj = JSON.parse(zlib.gunzipSync(Buffer.from(gameJSON, 'base64')));
		}
	} else {
		gameObj = Object.assign({}, gameJSON);
	}

	const options = Object.assign({ characters: {} }, gameObj.options);

	// Hydrate characters
	options.characters = reduce(options.characters, (characters, character, id) => {
		characters[id] = hydrateCharacter(character);

		return characters;
	}, {});

	return options;
};

const restoreGame = (channels, gameJSON, log) => {
	const options = getOptions(gameJSON);

	return new Game(channels, options, log);
};

const resetGame = (game, gameJSON) => {
	const options = getOptions(gameJSON);

	if (options) {
		game.reset(options);
	}
};

module.exports = {
	Game,
	getOptions,
	restoreGame,
	resetGame
};
