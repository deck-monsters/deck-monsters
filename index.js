const Game = require('./game');
const { hydratePlayer } = require('./players');

const restoreGame = (publicChannel, gameJSON) => {
	const gameObj = JSON.parse(gameJSON);
	const options = Object.assign({ players: {} }, gameObj.options);

	// Hydrate players
	options.players = options.players.reduce((players, player, id) => {
		players[id] = hydratePlayer(player);

		return players;
	}, {});

	return new Game(publicChannel, options);
};

module.exports = {
	Game,
	restoreGame
};
