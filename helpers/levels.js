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
	let level;
	let compare;
	let description;
	let difference;

	if (levels.length === 1) {
		level = levels[0];
		description = level ? `level ${level}` : 'beginner';
	} else if (levels.length === 2) {
		level = levels[1];
		compare = levels[0];
		difference = compare - level;

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
		compare = levels.shift();
		level = Math.round(levels.reduce((total, lvl) => total + lvl, 0) / levels.length);
		difference = compare - level;

		description = `average level of ${level || 'beginner'}`;
	}

	return {
		level,
		compare,
		description,
		difference
	};
};

module.exports = {
	describeLevels,
	getLevel
};
