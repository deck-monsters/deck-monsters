import allCharacters from './helpers/all.js';
import Beastmaster from './beastmaster.js';
import createCharacter from './helpers/create.js';
import randomCharacter from './helpers/random.js';
import { hydrateCharacter, hydrateCharacters } from './helpers/hydrate.js';

export type { RandomCharacterOptions } from './helpers/random.js';

export {
	allCharacters,
	allCharacters as all,
	Beastmaster,
	createCharacter,
	createCharacter as create,
	hydrateCharacter,
	hydrateCharacters,
	randomCharacter,
};

export { default as BaseCharacter } from './base.js';
