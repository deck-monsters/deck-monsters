/**
 * Likely decks: what a player who knows their monster tends to equip (Pass C,
 * docs/archive/roadmap/32-pass-c-mega-boss-and-balance.md). The random hand (`buildHuman`'s default)
 * is a floor for how well a human plays; these are the other end, a player who picks their
 * monster's signature cards and the handbook's example builds (`BUILD_STRATEGIES` in the
 * engine's player-handbook-content.ts). There is no equipped-deck telemetry yet, so they are
 * hand-written; replace them with the real distribution when it exists (roadmap 11).
 *
 * Each list is a preference order, not a fixed hand: a monster keeps the entries it can hold
 * at its level (`canHoldCard`), in order, and fills the rest of its slots the way a random
 * hand does. So a level 1 monster whose signature card needs level 2 plays without it.
 */
import type { SimMonsterType } from './simulate.js';

export const LIKELY_DECKS: Record<SimMonsterType, readonly string[]> = {
	Basilisk: ['Constrict', 'Coil', 'Thick Skin', 'Delayed Hit', 'Delayed Hit', 'Hit Harder', 'Berserk', 'Whiskey Shot', 'Hit', 'Ecdysis'],
	Minotaur: ['Horn Gore', 'Horn Swipe', 'Delayed Hit', 'Delayed Hit', 'Hit Harder', 'Berserk', 'Turkey Thigh', 'Heal', 'Hit'],
	Gladiator: ['Battle Focus', 'Survival Knife', 'Forked Metal Rod', 'Delayed Hit', 'Delayed Hit', 'Lucky Strike', 'Wooden Spear', 'Heal', 'Hit Harder'],
	Jinn: ['Sandstorm', 'Enchanted Faceswap', 'Lucky Strike', 'Soften', 'Delayed Hit', 'Delayed Hit', 'Forked Stick', 'Heal', 'Bad Batch'],
	WeepingAngel: ['Blink', 'Mesmerize', 'Enthrall', 'Blast', 'Blast', 'Delayed Hit', 'Delayed Hit', 'Scotch', 'Heal'],
	Unicorn: ['Sticketh', 'Horn of Proof', 'Unconquerable Horn', 'Gloaming Rest', 'Dissonant Voice', 'Blast', 'Delayed Hit', 'Heal', 'Hit'],
	Dragon: ['Fire Breath', 'Take Wing', 'Mood Scales', 'Tsunami', 'Delayed Hit', 'Delayed Hit', 'Heal', 'Hit', 'Cloak of Invisibility'],
};
