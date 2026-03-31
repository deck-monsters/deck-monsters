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

export const MAX_PROP_MODIFICATIONS = {
	ac: 1,
	dex: 1,
	hp: 12,
	int: 1,
	str: 1,
	xp: 40,
} as const;
