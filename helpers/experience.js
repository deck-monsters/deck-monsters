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

const getAverageLevel = (monster, contestants) => {
	const levelTotal = contestants.reduce(
		(totalLevels, contestant) =>
			((monster === contestant.monster) ? totalLevels : totalLevels + contestant.monster.level)
		, 0
	);

	return Math.ceil(levelTotal / (contestants.length - 1));
};


const calculateXP = (contestant, contestants) => {
	let levelDifference = 0;
	let gainedXP = 0;
	const { monster } = contestant;
	const killed = contestant.killed || [];
	const rounds = contestant.rounds || 1;
	let reasons = [];
	let xp;

	killed.forEach((opponentKilled) => {
		levelDifference = monster.level - opponentKilled.level;
		xp = xpFormula(levelDifference, BASE_XP_PER_KILL);

		reasons.push(`Gained ${xp} XP for killing ${opponentKilled.givenName} (${levelDifference * -1} level difference)`);

		gainedXP += xp;
	});

	if (contestant.killedBy) {
		levelDifference = monster.level - contestant.killedBy.level;
		const levelDifferenceText = levelDifference === 0 ? 'same level' : `${levelDifference * -1} level difference`;
		xp = xpFormula(levelDifference, BASE_XP_PER_KILLED_BY);

		reasons.push(`Gained ${xp} XP for being killed by ${contestant.killedBy.givenName} (${levelDifferenceText})`);

		gainedXP += xp;
	} else {
		// XP for being the last monster standing or fleeing
		const avgLevel = getAverageLevel(monster, contestants);
		const averageLevelDifference = monster.level - avgLevel;
		const xpBase = contestant.fled ? BASE_XP_PER_FLEEING : BASE_XP_LAST_ONE_STANDING;
		xp = Math.min(xpFormula(averageLevelDifference, xpBase), xpBase * rounds);

		reasons.push(`Gained ${xp} XP for ${contestant.fled ? 'fleeing' : 'being the last one standing'} as a level ${monster.level} monster lasting ${rounds} rounds in battle with opponents at an average level of ${avgLevel}`);// eslint-disable-line max-len

		gainedXP += xp;
	}

	reasons = reasons.join('\n');

	return { gainedXP, reasons };
};

module.exports = {
	BASE_XP_PER_KILL,
	BASE_XP_PER_KILLED_BY,
	BASE_XP_LAST_ONE_STANDING,
	XP_PER_VICTORY,
	XP_PER_DEFEAT,
	STARTING_XP,
	calculateXP,
	xpFormula,
	getAverageLevel
};
