/**
 * Centralized startup gate for the engine.
 *
 * All lazy-helper modules export their loadHelpers() promise. This file
 * collects them all so the server can await engineReady once at startup,
 * guaranteeing no command runs against stub helpers (which would produce
 * empty decks, "undefined" card types, etc.).
 *
 * Each module still fires-and-forgets its own call for standalone use
 * (tests, etc.). This file just gathers them.
 */

import { helpersReady as randomReady } from '../characters/helpers/random.js';
import { hydrateHelpersReady, getCharacterHydratorStatus } from '../characters/helpers/hydrate.js';
import { createHelperReady } from '../characters/helpers/create.js';
import { characterBaseReady } from '../characters/base.js';
import { beastmasterReady } from '../characters/beastmaster.js';
import { spawnHelpersReady } from '../monsters/helpers/spawn.js';
import { equipHelpersReady } from '../monsters/helpers/equip.js';
import { monsterHydrateReady, getMonsterHydratorStatus } from '../monsters/helpers/hydrate.js';

export const engineReady: Promise<void> = Promise.all([
	randomReady,
	hydrateHelpersReady,
	createHelperReady,
	characterBaseReady,
	beastmasterReady,
	spawnHelpersReady,
	equipHelpersReady,
	monsterHydrateReady,
]).then(() => undefined);

/**
 * Returns the current hydrator status for all lazy-loaded helpers.
 * All values should be `true` once `engineReady` has resolved.
 * Call this after `await engineReady` to verify nothing was silently skipped.
 */
export const getHydratorStatus = (): Record<string, boolean> => ({
	...getCharacterHydratorStatus(),
	...getMonsterHydratorStatus(),
});
