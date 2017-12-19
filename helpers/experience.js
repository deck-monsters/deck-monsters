const XP_PER_VICTORY = 10;
const XP_PER_DEFEAT = 1;
const BASE_XP_PER_KILL = 10;
const STARTING_XP = 0;

const calculateXP = (monster) => {
	let levelDifference = 0;
	let gainedXP = 0;

	monster.killed.forEach((opponentKilled) => {
		levelDifference =  monster.level - opponentKilled.level;

		// console.log(`${monster.givenName} ${monster.level} gained ${Math.round(Math.pow(10, (-0.3 * levelDifference)) * BASE_XP_PER_KILL)} XP for killing ${opponentKilled.givenName} ${opponentKilled.level}`);
		// This formula calculates XP based on the following logarithmic function
		// -0.3x = log(y) where x is the level difference of the two monsters
		gainedXP += Math.round(Math.pow(10, (-0.3 * levelDifference)) * BASE_XP_PER_KILL);
	});

	return gainedXP;
};

module.exports = {
	XP_PER_VICTORY,
	XP_PER_DEFEAT,
	STARTING_XP,
	calculateXP
};
