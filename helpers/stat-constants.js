const MAX_PROP_MODIFICATIONS = {
	ac: 1,
	str: 1,
	dex: 1,
	int: 1,
	xp: 40,
	hp: 12
};
const BASE_AC = 5;
const BASE_STR = 5;
const BASE_DEX = 5;
const BASE_INT = 5;
const AC_VARIANCE = 2;
const BASE_HP = 28;
const HP_VARIANCE = 5;
const MAX_BOOSTS = {
	dex: 10,
	str: 6,
	int: 8,
	hp: (BASE_HP * 2) + HP_VARIANCE,
	ac: (BASE_AC * 2) + AC_VARIANCE
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
