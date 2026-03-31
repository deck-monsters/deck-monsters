import allMonsters from './helpers/all.js';
import equipMonster from './helpers/equip.js';
import spawnMonster from './helpers/spawn.js';
import { hydrateMonster, hydrateMonsters } from './helpers/hydrate.js';

export { default as BaseMonster } from './base.js';
export { default as Basilisk } from './basilisk.js';
export { default as Gladiator } from './gladiator.js';
export { default as Jinn } from './jinn.js';
export { default as Minotaur } from './minotaur.js';
export { default as WeepingAngel } from './weeping-angel.js';
export { default as Environment } from './environment.js';

export {
	allMonsters,
	allMonsters as all,
	equipMonster,
	equipMonster as equip,
	spawnMonster,
	spawnMonster as spawn,
	hydrateMonster,
	hydrateMonsters,
};
