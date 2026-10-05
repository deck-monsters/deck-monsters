import allMonsters from './all.js';
import { levelBonus } from '../../creatures/stats.js';

/** What reaching `level` changes, against the level before it. */
export interface LevelUpGains {
	level: number;
	hp: number;
	ac: number;
	str: number;
	dex: number;
	int: number;
}

/**
 * What a monster of this type gains on reaching the level after `level`: the Workshop's
 * level-up details (bug 225). Each number is a change and can be 0 (a stat at its cap) or
 * negative: the Dragon and Gladiator's youth AC shrinks at levels 4 and 7. An unknown type
 * is treated as having no youth bonus, which is what the stats would do.
 */
export const levelUpGains = (type: string, level: number): LevelUpGains => {
	const Monster = allMonsters.find((M) => (M as { creatureType?: string }).creatureType === type) as
		| { youthAc?: number }
		| undefined;
	const youthAc = Monster?.youthAc ?? 0;
	const next = level + 1;
	const gain = (prop: string) => levelBonus(next, prop, youthAc) - levelBonus(level, prop, youthAc);
	return { level: next, hp: gain('hp'), ac: gain('ac'), str: gain('str'), dex: gain('dex'), int: gain('int') };
};
