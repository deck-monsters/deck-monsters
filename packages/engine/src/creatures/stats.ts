import {
	BASE_AC,
	BASE_DEX,
	BASE_HP,
	BASE_INT,
	BASE_STR,
	MAX_BOOSTS,
	MAX_PROP_MODIFICATIONS,
	MAX_TEMPORARY_STAT_CHANGE,
} from '../constants/stats.js';
import { STARTING_XP } from '../helpers/experience.js';
import type { BaseCreature } from './base.js';

export function getMaxModifications (self: BaseCreature, prop: string): number {
	switch (prop) {
		case 'hp':
			return MAX_PROP_MODIFICATIONS.hp;
		case 'ac':
			return Math.ceil(MAX_PROP_MODIFICATIONS.ac * (self.level + 1));
		case 'xp':
			// Can't use level here — circular reference with xp
			return Math.max(getPreBattlePropValue(self, 'xp')! - MAX_PROP_MODIFICATIONS.xp, MAX_PROP_MODIFICATIONS.xp);
		case 'int':
			return Math.min(Math.ceil(MAX_PROP_MODIFICATIONS.int * (self.level + 1)), MAX_TEMPORARY_STAT_CHANGE);
		case 'str':
			return Math.min(Math.ceil(MAX_PROP_MODIFICATIONS.str * (self.level + 1)), MAX_TEMPORARY_STAT_CHANGE);
		case 'dex':
			return Math.min(Math.ceil(MAX_PROP_MODIFICATIONS.dex * (self.level + 1)), MAX_TEMPORARY_STAT_CHANGE);
		default:
			return 4;
	}
}

/**
 * Pre-battle modifier only: type offset, level, and permanent training.
 *
 * Must not call `getModifier`. That getter includes the encounter delta, and
 * `getProp` adds the same delta on top of this value. Using `getModifier`
 * here would count one temporary DEX/STR/INT change twice on the raw stat.
 * Rolls read `getModifier` once; the raw stat picks the delta up only in
 * `getProp`. See 10b-bugs-fixed.md #175.
 */
export function getPreBattleModifier (self: BaseCreature, targetProp: string): number {
	const targetModifier = `${targetProp}Modifier`;
	let modifier = (self.options[targetModifier] as number) || 0;
	const maxBoost = (MAX_BOOSTS as Record<string, number>)[targetProp] ?? 0;

	// Level scaling: +1 per level up to the stat cap
	modifier += Math.min(self.level, maxBoost);

	// Permanent modifiers set via setModifier(..., permanent=true)
	const permanentModifiers = (self.options.modifiers as Record<string, number>) || {};
	modifier += Math.min(permanentModifiers[targetProp] || 0, maxBoost);

	return modifier;
}

/**
 * A class's youth AC at a level: the full amount to level 3, half (rounded up) to level 6,
 * none from level 7. Roadmap 35 measured it with the before/after matrix on searched hands:
 * a flat bonus helped the Dragon and Gladiator late too, where they did not need it, and
 * the owner wants brutes strong early, not everywhere.
 */
export function youthAcBonus (level: number, youthAc = 0): number {
	if (!youthAc || level >= 7) return 0;
	return level <= 3 ? youthAc : Math.ceil(youthAc / 2);
}

export function getPreBattlePropValue (self: BaseCreature, prop: string): number | undefined {
	switch (prop) {
		case 'dex':
			return BASE_DEX + getPreBattleModifier(self, 'dex');
		case 'str':
			return BASE_STR + getPreBattleModifier(self, 'str');
		case 'int':
			return BASE_INT + getPreBattleModifier(self, 'int');
		case 'ac': {
			let raw = BASE_AC + self.acVariance + youthAcBonus(self.level, (self.constructor as typeof BaseCreature).youthAc);
			raw += Math.min(self.level, (MAX_BOOSTS as Record<string, number>)['ac']); // AC level bonus not in getModifier
			return raw;
		}
		case 'hp':
			return BASE_HP + self.hpVariance + Math.min(self.level * 3, MAX_BOOSTS.hp) +
				Math.min((self.modifiers as Record<string, number>).maxHp || 0, MAX_PROP_MODIFICATIONS.hp);
		case 'xp':
			return (self.options.xp as number | undefined) ?? STARTING_XP;
		default:
			return undefined;
	}
}

export function getProp (self: BaseCreature, targetProp: string): number {
	let prop = getPreBattlePropValue(self, targetProp) ?? 0;
	prop += Math.min((self.encounterModifiers[targetProp] as number) || 0, getMaxModifications(self, targetProp));

	// XP can be 0 (STARTING_XP), so it must not use the combat-stat floor of 1 —
	// that made a fresh monster read xp 1 and the first award land +1 high. It still
	// floors at 0: no encounterModifiers.xp exists today, but a negative one must
	// never be able to drive a monster's XP below zero.
	if (targetProp === 'xp') {
		return Math.max(prop, 0);
	}

	return Math.max(prop, 1);
}

export function getModifier (self: BaseCreature, targetProp: string): number {
	// Same cap getProp uses, so a boost cannot raise the roll by more than it
	// raises the raw stat. Math.min leaves a curse (a negative delta) intact;
	// the raw stat still floors at 1 in getProp.
	const encounter = Math.min(
		(self.encounterModifiers[targetProp] as number) || 0,
		getMaxModifications(self, targetProp),
	);

	return getPreBattleModifier(self, targetProp) + encounter;
}
