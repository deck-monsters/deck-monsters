import { earlyXpDiscount } from '../constants/progression.js';

const STARTING_LEVEL = 0;

/**
 * Cumulative "full price" XP needed to reach `level`, using the original Fibonacci-
 * style growth this game has always used: each level's threshold is the sum of the
 * previous two (seeded 0, 50), i.e. 50, 100, 150, 250, 400, 650, 1050, ...
 *
 * This used to be inlined as recursive default parameters on `getLevel` itself
 * (`prevPrevThreshold`/`prevThreshold`). Pulling it out as its own function is what
 * makes `earlyXpDiscount` (constants/progression.ts) possible to apply cleanly: we
 * need the *raw* per-level threshold to discount, not just a running xp/threshold
 * comparison.
 */
const RAW_LEVEL_ONE_THRESHOLD = 50;

export const rawLevelThreshold = (level: number): number => {
	if (level <= 0) return 0;

	let prevPrev = 0; // raw[-1]
	let prev = RAW_LEVEL_ONE_THRESHOLD; // raw[0]
	let current = prev;

	for (let l = 1; l <= level; l += 1) {
		current = prevPrev + prev;
		prevPrev = prev;
		prev = current;
	}

	return current;
};

/**
 * Cumulative XP needed to reach `level`, after the early-game discount. Identical to
 * `rawLevelThreshold` from `EARLY_XP_DISCOUNT_CONVERGE_LEVEL` onward — see
 * constants/progression.ts for why and by how much the earlier levels are discounted.
 */
export const discountedLevelThreshold = (level: number): number => {
	if (level <= 0) return 0;
	return Math.round(rawLevelThreshold(level) * earlyXpDiscount(level));
};

export const getLevel = (xp = 0): number => {
	let level = STARTING_LEVEL;

	while (xp >= discountedLevelThreshold(level + 1)) {
		level += 1;
	}

	return level;
};

export interface LevelDescription {
	description: string;
	difference: number | undefined;
	opponentLevel: number | undefined;
	playerLevel: number | undefined;
}

export const describeLevels = (...levels: number[]): LevelDescription => {
	let description: string;
	let difference: number | undefined;
	let opponentLevel: number | undefined;
	let playerLevel: number | undefined;

	if (levels.length === 1) {
		playerLevel = levels[0];
		description = playerLevel ? `level ${playerLevel}` : 'beginner';
	} else if (levels.length === 2) {
		playerLevel = levels[0];
		opponentLevel = levels[1];

		difference = playerLevel - opponentLevel;

		if (difference === 0) {
			description = 'same level';
		} else {
			const absdiff = Math.abs(difference);
			const levelstr = absdiff === 1 ? 'level' : 'levels';

			description = `${absdiff} ${levelstr}`;
			if (difference > 0) {
				description = `${description} lower`;
			} else {
				description = `${description} higher`;
			}
		}
	} else {
		const levelsCopy = [...levels];
		playerLevel = levelsCopy.shift()!;
		opponentLevel = Math.round(
			levelsCopy.reduce((total, lvl) => total + lvl, 0) / levelsCopy.length
		);
		difference = playerLevel - opponentLevel;

		description = `average level of ${opponentLevel || 'beginner'}`;
	}

	return {
		description,
		difference,
		opponentLevel,
		playerLevel
	};
};
