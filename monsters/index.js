const { hydrateMonster, hydrateMonsters } = require('./helpers/hydrate');
const allMonsters = require('./helpers/all');
const equipMonster = require('./helpers/equip');
const spawnMonster = require('./helpers/spawn');

module.exports = {
	all: allMonsters,
	allMonsters,
	equip: equipMonster,
	equipMonster,
	hydrateMonster,
	hydrateMonsters,
	spawn: spawnMonster,
	spawnMonster
};
