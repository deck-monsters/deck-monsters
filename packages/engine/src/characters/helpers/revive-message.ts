import { agree, type PronounSet } from '../../helpers/pronouns.js';
import { capitalize } from '../../helpers/capitalize.js';
import { formatRelative } from '../../helpers/time.js';

interface RevivingMonster {
	givenName: string;
	pronouns: PronounSet;
	displayLevel: string;
	respawnTimeoutLength?: number;
	respawnTimeoutBegan?: number;
}

/**
 * "right away" for a beginner (no wait), otherwise "in about 5 minutes".
 *
 * `formatRelative` already says "in 5 minutes", so prefixing it with "in about" naively
 * would print "in about in 5 minutes". It is stripped first; anything that is not a future
 * time (it should never be) falls back to "right away" rather than "about 5 minutes ago".
 */
const whenBack = (monster: RevivingMonster, timeToRevive: number): string => {
	if (!monster.respawnTimeoutLength) return 'right away';
	const relative = formatRelative(timeToRevive, monster.respawnTimeoutBegan);
	return relative.startsWith('in ') ? `in about ${relative.slice(3)}` : 'right away';
};

/**
 * What `revive` tells the player (new-player walk 2 #5). The old line said when the monster
 * would be revived but not what it comes back as: a revived monster always returns with
 * 1 HP (`respawn` in creatures/health.ts) and then heals one HP per `TIME_TO_HEAL_MS`
 * while it rests (`applyPassiveHealing`), which a new player had no way to know.
 */
export const reviveAnnouncement = (monster: RevivingMonster, timeToRevive: number): string => {
	const { pronouns } = monster;
	return `${monster.givenName} has begun to revive. ${capitalize(pronouns.he)} ${pronouns.is ?? 'is'} a ${monster.displayLevel} monster, so ${pronouns.he} ${agree(pronouns, 'comes', 'come')} back ${whenBack(monster, timeToRevive)}, with 1 HP. Monsters heal a little at a time while they rest.`;
};
