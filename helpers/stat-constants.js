const AC_VARIANCE = 2;
const BASE_AC = 5;
const BASE_DEX = 5;
const BASE_HP = 28;
const BASE_INT = 5;
const BASE_STR = 5;
const HP_VARIANCE = 5;
const MAX_BOOSTS = {
	ac: (BASE_AC * 2) + AC_VARIANCE,
	dex: 10,
	hp: (BASE_HP * 2) + HP_VARIANCE,
	int: 8,
	str: 6
};
const MAX_PROP_MODIFICATIONS = {
	ac: 1,
	dex: 1,
	hp: 12,
	int: 1,
	str: 1,
	xp: 40
};

module.exports = {
	AC_VARIANCE,
	BASE_AC,
	BASE_DEX,
	BASE_HP,
	BASE_INT,
	BASE_STR,
	HP_VARIANCE,
	MAX_BOOSTS,
	MAX_PROP_MODIFICATIONS
};
