const Player = require('./base');
const { hydrateCard } = require('../cards');
const { hydrateMonster } = require('../monsters');

const hydratePlayer = (playerObj) => {
	const options = Object.assign({ deck: [], monsters: [] }, playerObj.options);

	options.deck = options.deck.map(hydrateCard);
	options.monsters = options.monsters.map(hydrateMonster);

	return new Player(options);
};

const hydratePlayers = playersJSON => JSON
	.parse(playersJSON)
	.map(hydratePlayer);

module.exports = {
	hydratePlayer,
	hydratePlayers
};
