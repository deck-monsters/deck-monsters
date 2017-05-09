const Beastmaster = require('./beastmaster');
const { hydrateCard } = require('../cards');
const { hydrateMonster } = require('../monsters');

const hydrateCharacher = (characterObj) => {
	const options = Object.assign({ deck: [], monsters: [] }, characterObj.options);

	options.deck = options.deck.map(hydrateCard);
	options.monsters = options.monsters.map(hydrateMonster);

	return new Beastmaster(options);
};

const hydrateCharachers = charactersJSON => JSON
	.parse(charactersJSON)
	.map(hydrateCharacher);

module.exports = {
	hydrateCharacher,
	hydrateCharachers,
	Beastmaster
};
