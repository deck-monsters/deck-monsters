const XP_PER_LEVEL = 100;
const XP_PER_VICTORY = 10;
const XP_PER_DEFEAT = 1;
const STARTING_XP = 10;

const getLevel = (xp = 0) => Math.floor(xp / XP_PER_LEVEL);

module.exports = {
	XP_PER_LEVEL,
	XP_PER_VICTORY,
	XP_PER_DEFEAT,
	STARTING_XP,
	getLevel
};
