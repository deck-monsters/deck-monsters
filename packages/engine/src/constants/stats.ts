export const AC_VARIANCE = 2;
export const BASE_AC = 5;
export const BASE_DEX = 5;
export const BASE_HP = 28;
export const BASE_INT = 5;
export const BASE_STR = 5;
export const HP_VARIANCE = 5;

export const MAX_BOOSTS = {
	ac: (BASE_AC * 2) + AC_VARIANCE,
	dex: 10,
	hp: (BASE_HP * 2) + HP_VARIANCE,
	int: 8,
	str: 6,
} as const;

/**
 * The most a temporary DEX, STR, or INT change can add up to in one fight, either way.
 * Since #175 those changes move rolls one for one, and the cap was `level + 1`: a stacked
 * Molasses reached -21 DEX at level 20 (the target's accuracy and defense on a d20), and
 * two copies won 12-26 points more than plain Hits (roadmap 33). Owner's choice: +/-5,
 * which is `level + 1` until level 4 and changes nothing below it. AC keeps `level + 1`.
 */
export const MAX_TEMPORARY_STAT_CHANGE = 5;

export const MAX_PROP_MODIFICATIONS = {
	ac: 1,
	dex: 1,
	hp: 12,
	int: 1,
	str: 1,
	xp: 40,
} as const;
