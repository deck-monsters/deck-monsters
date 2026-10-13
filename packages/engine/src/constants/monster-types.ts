import { BASILISK, DRAGON, GLADIATOR, JINN, MINOTAUR, UNICORN, WEEPING_ANGEL } from './creature-types.js';

/**
 * Every monster type a player can train, in the order the guides list them. Cards with matchups
 * (the hold family) treat any type on neither their strong nor their weak list as neutral, and
 * name these in their card text; `monster-types.test.ts` keeps this list equal to the monster
 * registry, so a new monster cannot be silently left out.
 */
export const MONSTER_TYPES = [BASILISK, DRAGON, GLADIATOR, JINN, MINOTAUR, UNICORN, WEEPING_ANGEL] as const;
