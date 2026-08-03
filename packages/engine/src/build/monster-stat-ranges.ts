import {
	AC_VARIANCE,
	BASE_AC,
	BASE_DEX,
	BASE_HP,
	BASE_INT,
	BASE_STR,
	HP_VARIANCE,
	MAX_BOOSTS,
} from '../constants/stats.js';

export interface MonsterTypeOffsets {
	creatureType: string;
	classLabel: string;
	typeAcOffset: number;
	typeHpOffset: number;
	dexModifier: number;
	strModifier: number;
	intModifier: number;
}

export interface NumericRange {
	min: number;
	max: number;
}

/** Spawn roll is random(0, globalVariance) inclusive; total variance adds the type offset. */
export function spawnVarianceRange(typeOffset: number, globalVariance: number): NumericRange {
	return {
		min: typeOffset,
		max: typeOffset + globalVariance,
	};
}

export function hpRangeAtLevel(typeHpOffset: number, level: number): NumericRange {
	const variance = spawnVarianceRange(typeHpOffset, HP_VARIANCE);
	const levelBonus = Math.min(level * 3, MAX_BOOSTS.hp);

	return {
		min: BASE_HP + variance.min + levelBonus,
		max: BASE_HP + variance.max + levelBonus,
	};
}

export function acRangeAtLevel(typeAcOffset: number, level: number): NumericRange {
	const variance = spawnVarianceRange(typeAcOffset, AC_VARIANCE);
	const levelBonus = Math.min(level, MAX_BOOSTS.ac);

	return {
		min: BASE_AC + variance.min + levelBonus,
		max: BASE_AC + variance.max + levelBonus,
	};
}

export function formatNumericRange(range: NumericRange): string {
	return `${range.min}–${range.max}`;
}

export function formatStatLine(offsets: MonsterTypeOffsets, level = 0): string {
	const sign = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
	const hp = hpRangeAtLevel(offsets.typeHpOffset, level);
	const ac = acRangeAtLevel(offsets.typeAcOffset, level);

	return [
		`  ${offsets.creatureType} (${offsets.classLabel})`,
		`    HP: ${formatNumericRange(hp)}  AC: ${formatNumericRange(ac)}`,
		`    STR ${sign(offsets.strModifier)}  DEX ${sign(offsets.dexModifier)}  INT ${sign(offsets.intModifier)}`,
	].join('\n');
}

export function baseSpawnHpRange(): NumericRange {
	return hpRangeAtLevel(0, 0);
}

export function baseSpawnAcRange(): NumericRange {
	return acRangeAtLevel(0, 0);
}

export function getMonsterTypeOffsets(Monster: new (...args: any[]) => any): MonsterTypeOffsets {
	const instance = new Monster();
	const m = Monster as any;

	return {
		creatureType: m.creatureType ?? instance.creatureType ?? Monster.name,
		classLabel: m.class ?? 'Unknown',
		typeAcOffset: m.acVariance ?? 0,
		typeHpOffset: m.hpVariance ?? 0,
		dexModifier: instance.options?.dexModifier ?? 0,
		strModifier: instance.options?.strModifier ?? 0,
		intModifier: instance.options?.intModifier ?? 0,
	};
}

export const STAT_RANGE_FORMULA_NOTE = `
Spawn formulas (match engine):
  hpVariance = random(0, ${HP_VARIANCE}) + typeHpOffset
  acVariance = random(0, ${AC_VARIANCE}) + typeAcOffset
  HP at level L = ${BASE_HP} + hpVariance + min(L × 3, ${MAX_BOOSTS.hp})
  AC at level L = ${BASE_AC} + acVariance + min(L, ${MAX_BOOSTS.ac})
`.trim();
