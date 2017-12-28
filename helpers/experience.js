const BASE_XP_PER_KILL = 10;
const BASE_XP_PER_KILLED_BY = 1;
const BASE_XP_PER_FLEEING = 2;
const BASE_XP_LAST_ONE_STANDING = 3;
const XP_PER_VICTORY = 10;
const XP_PER_DEFEAT = 1;
const STARTING_XP = 0;

const xpFormula = (levelDifference, base) =>
	// This formula calculates XP based on the following logarithmic function
	// -0.3x = log(y) where x is the level difference of the monsters
	Math.round(Math.pow(10, (-0.3 * levelDifference)) * base);

const getAverageLevel = contestants =>
	contestants.reduce((totalLevels, contestant) => totalLevels + contestant.monster.level, 0) / contestants.length;

const calculateXP = (contestant, contestants) => {
	let levelDifference = 0;
	let gainedXP = 0;
	const { monster } = contestant;
	const killed = contestant.killed || [];

	killed.forEach((opponentKilled) => {
		levelDifference = monster.level - opponentKilled.level;

		gainedXP += xpFormula(levelDifference, BASE_XP_PER_KILL);
	});

	if (contestant.killedBy) {
		levelDifference = monster.level - contestant.killedBy.level;

		gainedXP += xpFormula(levelDifference, BASE_XP_PER_KILLED_BY);
	} else {
		// XP for being the last monster standing or fleeing
		const averageLevelDifference = monster.level - getAverageLevel(contestants);
		const xpBase = contestant.fled ? BASE_XP_PER_FLEEING : BASE_XP_LAST_ONE_STANDING;

		gainedXP += Math.max(xpFormula(averageLevelDifference, xpBase), 5 * contestant.rounds);
	}

	return gainedXP;
};

module.exports = {
	BASE_XP_PER_KILL,
	BASE_XP_PER_KILLED_BY,
	BASE_XP_LAST_ONE_STANDING,
	XP_PER_VICTORY,
	XP_PER_DEFEAT,
	STARTING_XP,
	calculateXP
};
