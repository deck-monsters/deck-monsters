const reduce = require('lodash.reduce');

const Game = require('./game');
const { hydratePlayer } = require('./players');

const restoreGame = (publicChannel, gameJSON) => {
	const gameObj = typeof gameJSON === 'string' ? JSON.parse(gameJSON) : gameJSON;
	const options = Object.assign({ players: {} }, gameObj.options);

	// Hydrate players
	options.players = reduce(options.players, (players, player, id) => {
		players[id] = hydratePlayer(player);

		return players;
	}, {});

	return new Game(publicChannel, options);
};

module.exports = {
	Game,
	restoreGame
};
