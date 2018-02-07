const STARTING_LEVEL = 0;

// levels are a Fibonacci sequence (100, 200, 300, 500, 800, 1300, 2100, ...)
const getLevel = (xp = 0, prevPrevThreshold = 0, prevThreshold = 50, level = STARTING_LEVEL) => {
	const threshold = prevPrevThreshold + prevThreshold;

	if (xp < threshold) {
		return level;
	}

	return getLevel(xp, prevThreshold, threshold, level + 1);
};

const describeLevels = (...levels) => {
	let description;
	let difference;
	let opponentLevel;
	let playerLevel;

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
		playerLevel = levels.shift();
		opponentLevel = Math.round(levels.reduce((total, lvl) => total + lvl, 0) / levels.length);
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

module.exports = {
	describeLevels,
	getLevel
};
