import { getLevel } from '@deck-monsters/engine';

/**
 * Max XP that still maps to `targetLevel` via `getLevel()` (same algorithm as Ring).
 */
export function getXpCapForLevel(targetLevel: number): number {
	const normalizedLevel = Math.max(0, Math.floor(targetLevel));
	let lower = 0;
	let upper = 1;

	while (getLevel(upper) <= normalizedLevel) {
		lower = upper;
		upper *= 2;
	}

	while (lower + 1 < upper) {
		const mid = Math.floor((lower + upper) / 2);
		if (getLevel(mid) <= normalizedLevel) {
			lower = mid;
		} else {
			upper = mid;
		}
	}

	return lower;
}
