import { agree, type PronounSet } from './pronouns.js';
import { capitalize } from './capitalize.js';
import {
	TARGET_HIGHEST_HP_PLAYER,
	TARGET_LOWEST_HP_PLAYER,
	TARGET_PLAYER_WHO_HIT_YOU_LAST,
	TARGET_RANDOM_PLAYER,
} from './targeting-strategies.js';

/*
 * Boss temperaments (owner, 2026-09-27; docs/roadmap/31-pass-b-rings-and-bosses.md). Every
 * boss used to share TARGET_HUMAN_PLAYER_WEAK, so a pack of bosses all acted alike. Now each
 * draws a temperament when it is made. Bosses are still on the Boss team, and these
 * strategies all respect teams, so a boss still only goes for challengers; what changes is
 * which one, and the arrival line tells the room so players can plan around it.
 */
export interface BossPersonality {
	id: 'bully' | 'glory' | 'grudge' | 'wild';
	strategy: string;
	/** A sentence about the boss, for its arrival. */
	temperament: (pronouns: PronounSet) => string;
}

const he = (p: PronounSet): string => capitalize(p.he);

export const BOSS_PERSONALITIES: readonly BossPersonality[] = [
	{
		id: 'bully',
		strategy: TARGET_LOWEST_HP_PLAYER,
		temperament: p => `${he(p)} ${agree(p, 'picks', 'pick')} on whoever looks weakest.`,
	},
	{
		id: 'glory',
		strategy: TARGET_HIGHEST_HP_PLAYER,
		temperament: p => `${he(p)} ${agree(p, 'wants', 'want')} the strongest challenger, and nobody else will do.`,
	},
	{
		id: 'grudge',
		strategy: TARGET_PLAYER_WHO_HIT_YOU_LAST,
		temperament: p => `${he(p)} never ${agree(p, 'forgets', 'forget')} who hit ${p.him} last.`,
	},
	{
		id: 'wild',
		strategy: TARGET_RANDOM_PLAYER,
		temperament: p => `Nobody knows who ${p.he} will go for next, least of all ${p.him}.`,
	},
];

export const bossPersonalityFor = (strategy: string | undefined): BossPersonality | undefined =>
	BOSS_PERSONALITIES.find(personality => personality.strategy === strategy);
